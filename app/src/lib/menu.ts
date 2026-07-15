import { supabase } from './supabase';
import { downscalePhoto } from './api';

export interface MenuPhoto {
  id: string;
  cafe_id: string;
  photo_path: string;
  taken_at: string;
}

export async function fetchMenuPhotos(cafeId: string): Promise<MenuPhoto[]> {
  const { data, error } = await supabase
    .from('menu_photos')
    .select('*')
    .eq('cafe_id', cafeId)
    .order('taken_at', { ascending: true });
  if (error) throw error;
  return (data as MenuPhoto[] | null) ?? [];
}

// Upload-before-insert, same stance as reviews: if the insert fails, the
// uploaded file is an accepted orphan (warned, not cleaned up).
export async function addMenuPhoto(cafeId: string, blob: Blob): Promise<MenuPhoto> {
  const small = await downscalePhoto(blob);
  const path = `menus/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage.from('photos').upload(path, small);
  if (uploadError) throw uploadError;
  const { data, error } = await supabase
    .from('menu_photos')
    .insert({ cafe_id: cafeId, photo_path: path })
    .select('*')
    .single();
  if (error) {
    console.warn('menu photo insert failed after upload:', error.message);
    throw error;
  }
  return data as MenuPhoto;
}

// Best-effort storage removal first, then the row. Row-delete failure surfaces
// to the caller; storage cleanup failure is an accepted orphan (same as deleteReview).
export async function deleteMenuPhoto(photo: MenuPhoto): Promise<void> {
  const { error: cleanupError } = await supabase.storage.from('photos').remove([photo.photo_path]);
  if (cleanupError) console.warn('menu photo cleanup failed:', cleanupError.message);
  const { error } = await supabase.from('menu_photos').delete().eq('id', photo.id);
  if (error) throw error;
}
