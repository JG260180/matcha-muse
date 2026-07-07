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

export async function flush(
  submit: (item: QueuedReview) => Promise<void>,
  kv: KV = idb
): Promise<number> {
  const queue = (await kv.get(KEY)) ?? [];
  const remaining: QueuedReview[] = [];
  let sent = 0;
  for (const item of queue) {
    try {
      await submit(item);
      sent++;
    } catch {
      remaining.push(item);
    }
  }
  await kv.set(KEY, remaining);
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

export async function base64ToBlob(b64: string): Promise<Blob> {
  return (await fetch(b64)).blob();
}
