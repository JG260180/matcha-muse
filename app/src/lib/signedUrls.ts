import { supabase } from './supabase';

// Signed photo URLs used to be minted per <img> mount: a 10-matcha journal
// paid ten round-trips before the first image byte arrived, and every mint
// produced a different token — so the browser could never reuse its HTTP cache
// and re-downloaded every full-size photo on each visit. This module fixes
// both: requests made in the same tick are batched into ONE createSignedUrls
// call, and results are reused until shortly before the signature expires, so
// the URL (and the browser's cached image bytes) stay stable across
// navigations within a session.

const SIGN_SECONDS = 3600;
// Reuse well inside the signature's lifetime so a cached URL handed to an
// <img> still has time to start (and finish) loading.
const REUSE_MS = 45 * 60 * 1000;

interface Entry {
  url: Promise<string | null>;
  expiresAt: number;
}

const cache = new Map<string, Entry>();
let pending: Map<string, (url: string | null) => void> | null = null;

async function flush(batch: Map<string, (url: string | null) => void>) {
  const paths = [...batch.keys()];
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrls(paths, SIGN_SECONDS);
  const byPath = new Map((data ?? []).map((d) => [d.path, d]));
  for (const [path, resolve] of batch) {
    const d = byPath.get(path);
    const url = !error && d && !d.error ? d.signedUrl : null;
    // Failures aren't cached — a later mount (or retry) gets a fresh attempt
    // instead of an hour of guaranteed-grey placeholders.
    if (url == null) cache.delete(path);
    resolve(url);
  }
}

/** Signed URL for a photos-bucket path; null when it can't be minted. */
export function getSignedUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && Date.now() < hit.expiresAt) return hit.url;
  let resolve!: (url: string | null) => void;
  const url = new Promise<string | null>((r) => {
    resolve = r;
  });
  cache.set(path, { url, expiresAt: Date.now() + REUSE_MS });
  if (!pending) {
    const batch = new Map<string, (url: string | null) => void>();
    pending = batch;
    // All effects of a render commit run in the same task, so this collects
    // every image on the screen into one request.
    queueMicrotask(() => {
      pending = null;
      void flush(batch);
    });
  }
  pending.set(path, resolve);
  return url;
}

/** Storage path of the card-sized copy uploaded next to a full photo
 *  (`reviews/x.jpg` → `reviews/x.thumb.jpg`). Older photos have no thumb;
 *  SignedImage falls back to the full photo when the mint fails. */
export function thumbPath(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? `${path}.thumb` : `${path.slice(0, dot)}.thumb${path.slice(dot)}`;
}

/** Drop a cached URL (e.g. after an <img> error — likely an expired token). */
export function invalidateSignedUrl(path: string): void {
  cache.delete(path);
}

export function clearSignedUrlCacheForTests(): void {
  cache.clear();
}
