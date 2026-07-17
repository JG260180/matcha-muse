import { supabase } from './supabase';
import { thumbPath } from './signedUrls';
import type { CafeChoice } from '../components/CafePicker';
import type { ReviewDraft } from '../components/ReviewForm';
import { enqueue, blobToBase64, base64ToBlob, type QueuedReview } from './offlineQueue';
import { applyDrankAtDate } from './drankAt';
import type { Review } from './types';

export async function ensureCafe(choice: CafeChoice): Promise<string | null> {
  if (choice.kind === 'none') return null; // cafe-less draft (2026-07-17)
  if (choice.kind === 'candidate') {
    const c = choice.candidate;
    const { data: existing } = await supabase
      .from('cafes').select('id').eq('google_place_id', c.placeId).maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from('cafes')
      .insert({
        name: c.name, address: c.address,
        latitude: c.latitude, longitude: c.longitude, google_place_id: c.placeId,
      })
      .select('id').single();
    if (error) throw error;
    return data.id;
  }
  const { data, error } = await supabase
    .from('cafes')
    .insert({ name: choice.name, suburb: choice.suburb || null })
    .select('id').single();
  if (error) throw error;
  return data.id;
}

export async function saveReview(
  choice: CafeChoice,
  draft: ReviewDraft,
  photo: Blob | null,
  drankAt: Date = new Date()
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Not signed in');

  const cafeId = await ensureCafe(choice);

  let photoPath: string | null = null;
  if (photo) {
    photoPath = `reviews/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('photos').upload(photoPath, photo);
    if (error) throw error;
    await uploadThumb(photoPath, photo);
  }

  const { error } = await supabase.from('reviews').insert({
    user_id: userData.user.id,
    cafe_id: cafeId,
    photo_path: photoPath,
    drank_at: applyDrankAtDate(drankAt.toISOString(), draft.drankAtDate),
    overall: draft.overall,
    taste: draft.taste,
    sweetness: draft.sweetness,
    texture: draft.texture,
    temperature: draft.temperature,
    milk: draft.milk,
    drink_style: draft.drink_style,
    size: draft.size,
    price: draft.price.trim() === '' ? null : Number(draft.price),
    occasions: draft.occasions,
    note: draft.note || null,
    status: draft.status,
  });
  if (error) throw error;
}

// Shrinks a photo before upload/queueing. Decodes via createImageBitmap with
// imageOrientation: 'from-image' so iOS EXIF rotation is baked into the pixels
// (a portrait iPhone photo must stay upright). Falls back to the original blob
// on ANY failure — a photo must never be lost or corrupted by this step.
export async function downscalePhoto(
  blob: Blob,
  maxEdge = 1600,
  quality = 0.8
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const result = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!result || result.size >= blob.size) return blob;
    return result;
  } catch {
    return blob;
  }
}

// Card-sized copy uploaded next to the full photo, so the journal grid pulls
// ~10x fewer bytes per card. Best-effort on EVERY failure path: a missing
// thumb only costs bandwidth — SignedImage falls back to the full photo.
async function uploadThumb(path: string, photo: Blob): Promise<void> {
  try {
    const thumb = await downscalePhoto(photo, 640, 0.7);
    const { error } = await supabase.storage.from('photos').upload(thumbPath(path), thumb);
    if (error) console.warn('thumb upload failed:', error.message);
  } catch {
    /* full photo remains the fallback */
  }
}

// Removes a photo and its thumb. Orphan accepted — cleanup failure must never
// fail the operation, but surface it so storage-policy problems are
// discoverable. (Old photos have no thumb; remove ignores missing paths.)
async function cleanupPhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from('photos').remove([path, thumbPath(path)]);
  if (error) console.warn('photo cleanup failed:', error.message);
}

export async function saveReviewOrQueue(
  choice: CafeChoice,
  draft: ReviewDraft,
  photo: Blob | null
): Promise<'saved' | 'queued'> {
  const upload = photo ? await downscalePhoto(photo) : null;
  try {
    await saveReview(choice, draft, upload);
    return 'saved';
  } catch (e) {
    const isNetwork = e instanceof TypeError || !navigator.onLine;
    if (!isNetwork) throw e;
    await enqueue({
      choice,
      draft,
      photoBase64: upload ? await blobToBase64(upload) : null,
      drankAt: new Date().toISOString(),
    });
    return 'queued';
  }
}

export async function submitQueued(item: QueuedReview): Promise<void> {
  const photo = item.photoBase64 ? await base64ToBlob(item.photoBase64) : null;
  await saveReview(item.choice, item.draft, photo, new Date(item.drankAt));
}

export type PhotoAction =
  | { kind: 'keep' }
  | { kind: 'replace'; blob: Blob }
  | { kind: 'remove' };

// Applies an edit to an existing review. Returns the review's final photo_path.
// Old-photo cleanup is best-effort: an orphaned file is accepted; a failed
// cleanup must never fail the save (same stance as v1's upload-before-insert).
// cafeChoice (2026-07-17): a cafe-less draft gains its cafe on save.
export async function updateReview(
  review: Review,
  draft: ReviewDraft,
  photo: PhotoAction = { kind: 'keep' },
  cafeChoice?: CafeChoice
): Promise<string | null> {
  const cafeId = cafeChoice ? await ensureCafe(cafeChoice) : undefined;
  let photoPath = review.photo_path;
  if (photo.kind === 'replace') {
    const small = await downscalePhoto(photo.blob);
    const newPath = `reviews/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('photos').upload(newPath, small);
    if (error) throw error;
    await uploadThumb(newPath, small);
    photoPath = newPath;
  } else if (photo.kind === 'remove') {
    photoPath = null;
  }

  const { error } = await supabase
    .from('reviews')
    .update({
      ...(cafeId !== undefined ? { cafe_id: cafeId } : {}),
      photo_path: photoPath,
      drank_at: applyDrankAtDate(review.drank_at, draft.drankAtDate),
      overall: draft.overall,
      taste: draft.taste,
      sweetness: draft.sweetness,
      texture: draft.texture,
      temperature: draft.temperature,
      milk: draft.milk,
      drink_style: draft.drink_style,
      size: draft.size,
      price: draft.price.trim() === '' ? null : Number(draft.price),
      occasions: draft.occasions,
      note: draft.note || null,
      status: draft.status,
    })
    .eq('id', review.id);
  if (error) throw error;

  if (photo.kind !== 'keep' && review.photo_path) {
    await cleanupPhoto(review.photo_path);
  }

  return photoPath;
}

// Commits an adjusted photo immediately: "Use photo" IS the save for a photo
// that's already on the card (owner feedback 2026-07-17 follow-up — requiring
// a second "Save changes" tap was sloppy). Only the photo columns change;
// in-progress form edits stay pending. Same upload-before-update stance as
// updateReview; old-photo cleanup is best-effort.
export async function replaceReviewPhoto(review: Review, blob: Blob): Promise<string> {
  const small = await downscalePhoto(blob);
  const newPath = `reviews/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('photos').upload(newPath, small);
  if (error) throw error;
  await uploadThumb(newPath, small);
  const { error: updateError } = await supabase
    .from('reviews').update({ photo_path: newPath }).eq('id', review.id);
  if (updateError) throw updateError;
  if (review.photo_path) await cleanupPhoto(review.photo_path);
  return newPath;
}

// Best-effort photo removal first, then the row. Row-delete failure surfaces
// to the caller; photo cleanup failure is an accepted orphan.
export async function deleteReview(review: Review): Promise<void> {
  if (review.photo_path) {
    await cleanupPhoto(review.photo_path);
  }
  const { error } = await supabase.from('reviews').delete().eq('id', review.id);
  if (error) throw error;
}
