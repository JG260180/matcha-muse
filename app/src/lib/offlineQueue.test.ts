import { vi } from 'vitest';
import { enqueue, pending, flush, type KV, type QueuedReview } from './offlineQueue';

function memoryKV(): KV {
  const store = new Map<string, QueuedReview[]>();
  return {
    get: async (k) => store.get(k),
    set: async (k, v) => void store.set(k, v),
  };
}

const item = {
  choice: { kind: 'manual' as const, name: 'Test Cafe', suburb: 'Adelaide' },
  draft: { overall: 4, price: '6.00' } as never,
  photoBase64: null,
  drankAt: '2026-07-07T09:00:00.000Z',
};

test('enqueue stores items with generated ids', async () => {
  const kv = memoryKV();
  await enqueue(item, kv);
  await enqueue(item, kv);
  const q = await pending(kv);
  expect(q).toHaveLength(2);
  expect(q[0].id).not.toEqual(q[1].id);
});

test('flush submits items, removes successes, keeps failures', async () => {
  const kv = memoryKV();
  await enqueue(item, kv);
  await enqueue(item, kv);
  const submit = vi.fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('still offline'));
  const sent = await flush(submit, kv);
  expect(sent).toBe(1);
  expect(await pending(kv)).toHaveLength(1);
});
