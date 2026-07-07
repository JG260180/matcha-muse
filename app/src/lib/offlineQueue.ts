import { get, set } from 'idb-keyval';
import type { CafeChoice } from '../components/CafePicker';
import type { ReviewDraft } from '../components/ReviewForm';

export interface QueuedReview {
  id: string;
  choice: CafeChoice;
  draft: ReviewDraft;
  photoBase64: string | null;
  drankAt: string;
}

export interface KV {
  get: (key: string) => Promise<QueuedReview[] | undefined>;
  set: (key: string, value: QueuedReview[]) => Promise<void>;
}

const KEY = 'matcha-muse-queue';
const idb: KV = { get, set };

export async function enqueue(item: Omit<QueuedReview, 'id'>, kv: KV = idb): Promise<void> {
  const queue = (await kv.get(KEY)) ?? [];
  await kv.set(KEY, [...queue, { ...item, id: crypto.randomUUID() }]);
}

export async function pending(kv: KV = idb): Promise<QueuedReview[]> {
  return (await kv.get(KEY)) ?? [];
}

let inFlight: Promise<number> | null = null;

export function flush(
  submit: (item: QueuedReview) => Promise<void>,
  kv: KV = idb
): Promise<number> {
  if (inFlight) return inFlight;
  inFlight = flushInternal(submit, kv).finally(() => { inFlight = null; });
  return inFlight;
}

async function flushInternal(
  submit: (item: QueuedReview) => Promise<void>,
  kv: KV = idb
): Promise<number> {
  const queue = (await kv.get(KEY)) ?? [];
  const submittedIds = new Set<string>();
  let sent = 0;
  for (const item of queue) {
    try {
      await submit(item);
      sent++;
      submittedIds.add(item.id);
    } catch {
      // leave in queue; only submitted ids are removed below
    }
  }
  const latest = (await kv.get(KEY)) ?? [];
  await kv.set(KEY, latest.filter((i) => !submittedIds.has(i.id)));
  return sent;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Photos are stored as base64 in the queue; downscaling is deferred to Task 14 (needs on-device
// verification of EXIF orientation) to bound IndexedDB size and speed up uploads on mobile.
export async function base64ToBlob(b64: string): Promise<Blob> {
  return (await fetch(b64)).blob();
}
