import { supabase } from './supabase';
import { downscalePhoto } from './api';
import type { Profile, TasteQuiz } from './types';

export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

export async function fetchOwnProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Not signed in');
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return (data as Profile[] | null) ?? [];
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

// Avatars live in the same private bucket as review photos; smaller edge —
// they only ever render as a circle.
export async function uploadAvatar(blob: Blob, userId: string): Promise<string> {
  const small = await downscalePhoto(blob, 800);
  const path = `avatars/${userId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('photos').upload(path, small);
  if (error) throw error;
  return path;
}

export interface ProfileInput {
  display_name: string;
  about_me: string | null;
  avatar_path: string | null;
  quiz: TasteQuiz;
}

// Upsert = same call path for first-time setup (insert) and later edits
// (update); RLS restricts both to the caller's own row.
export async function saveProfile(input: ProfileInput): Promise<Profile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Not signed in');
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userData.user.id, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}
