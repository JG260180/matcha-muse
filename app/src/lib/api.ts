import { supabase } from './supabase';
import type { CafeChoice } from '../components/CafePicker';
import type { ReviewDraft } from '../components/ReviewForm';
import { enqueue, blobToBase64, base64ToBlob, type QueuedReview } from './offlineQueue';

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

export async function saveReviewOrQueue(
  choice: CafeChoice,
  draft: ReviewDraft,
  photo: Blob | null
): Promise<'saved' | 'queued'> {
  try {
    await saveReview(choice, draft, photo);
    return 'saved';
  } catch (e) {
    const isNetwork = e instanceof TypeError || !navigator.onLine;
    if (!isNetwork) throw e;
    await enqueue({
      choice,
      draft,
      photoBase64: photo ? await blobToBase64(photo) : null,
      drankAt: new Date().toISOString(),
    });
    return 'queued';
  }
}

export async function submitQueued(item: QueuedReview): Promise<void> {
  const photo = item.photoBase64 ? await base64ToBlob(item.photoBase64) : null;
  await saveReview(item.choice, item.draft, photo, new Date(item.drankAt));
}
