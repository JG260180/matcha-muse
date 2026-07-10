import { supabase } from './supabase';
import type { CafeChoice } from '../components/CafePicker';
import type { ReviewDraft } from '../components/ReviewForm';
import { enqueue, blobToBase64, base64ToBlob, type QueuedReview } from './offlineQueue';
import type { Review } from './types';

export async function ensureCafe(choice: CafeChoice): Promise<string> {
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
  }

  const { error } = await supabase.from('reviews').insert({
    user_id: userData.user.id,
    cafe_id: cafeId,
    photo_path: photoPath,
    drank_at: drankAt.toISOString(),
    overall: draft.overall,
    taste: draft.taste,
    sweetness: draft.sweetness,
    texture: draft.texture,
    temperature: draft.temperature,
    milk: draft.milk,
    drink_style: draft.drink_style,
    size: draft.size,
    price: Number(draft.price),
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
export async function updateReview(
  review: Review,
  draft: ReviewDraft,
  photo: PhotoAction = { kind: 'keep' }
): Promise<string | null> {
  let photoPath = review.photo_path;
  if (photo.kind === 'replace') {
    const small = await downscalePhoto(photo.blob);
    const newPath = `reviews/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('photos').upload(newPath, small);
    if (error) throw error;
    photoPath = newPath;
  } else if (photo.kind === 'remove') {
    photoPath = null;
  }

  const { error } = await supabase
    .from('reviews')
    .update({
      photo_path: photoPath,
      overall: draft.overall,
      taste: draft.taste,
      sweetness: draft.sweetness,
      texture: draft.texture,
      temperature: draft.temperature,
      milk: draft.milk,
      drink_style: draft.drink_style,
      size: draft.size,
      price: Number(draft.price),
      occasions: draft.occasions,
      note: draft.note || null,
      status: draft.status,
    })
    .eq('id', review.id);
  if (error) throw error;

  if (photo.kind !== 'keep' && review.photo_path) {
    const { error: cleanupError } = await supabase.storage.from('photos').remove([review.photo_path]);
    // Orphan accepted — cleanup failure must never fail the operation, but
    // surface it in the console so storage-policy problems are discoverable.
    if (cleanupError) console.warn('photo cleanup failed:', cleanupError.message);
  }

  return photoPath;
}

// Best-effort photo removal first, then the row. Row-delete failure surfaces
// to the caller; photo cleanup failure is an accepted orphan.
export async function deleteReview(review: Review): Promise<void> {
  if (review.photo_path) {
    const { error: cleanupError } = await supabase.storage.from('photos').remove([review.photo_path]);
    // Orphan accepted — cleanup failure must never fail the operation, but
    // surface it in the console so storage-policy problems are discoverable.
    if (cleanupError) console.warn('photo cleanup failed:', cleanupError.message);
  }
  const { error } = await supabase.from('reviews').delete().eq('id', review.id);
  if (error) throw error;
}
