import {
  getSignedUrl,
  invalidateSignedUrl,
  clearSignedUrlCacheForTests,
} from './signedUrls';

const createSignedUrls = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[], expiresIn: number) =>
          createSignedUrls(paths, expiresIn),
      }),
    },
  },
}));

const ok = (paths: string[]) => ({
  data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })),
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  clearSignedUrlCacheForTests();
});

describe('getSignedUrl', () => {
  it('batches same-tick requests into one createSignedUrls call', async () => {
    createSignedUrls.mockImplementation((paths: string[]) => Promise.resolve(ok(paths)));
    const [a, b] = await Promise.all([getSignedUrl('reviews/a.jpg'), getSignedUrl('reviews/b.jpg')]);
    expect(a).toBe('https://signed/reviews/a.jpg');
    expect(b).toBe('https://signed/reviews/b.jpg');
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(['reviews/a.jpg', 'reviews/b.jpg'], 3600);
  });

  it('reuses a cached URL on later requests (browser cache stays warm)', async () => {
    createSignedUrls.mockImplementation((paths: string[]) => Promise.resolve(ok(paths)));
    const first = await getSignedUrl('reviews/a.jpg');
    const second = await getSignedUrl('reviews/a.jpg');
    expect(second).toBe(first);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it('resolves null on a mint failure and does NOT cache it', async () => {
    createSignedUrls.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    expect(await getSignedUrl('reviews/a.jpg')).toBeNull();
    createSignedUrls.mockImplementation((paths: string[]) => Promise.resolve(ok(paths)));
    expect(await getSignedUrl('reviews/a.jpg')).toBe('https://signed/reviews/a.jpg');
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
  });

  it('resolves null for a per-path error inside an otherwise-good batch', async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'reviews/a.jpg', signedUrl: 'https://signed/reviews/a.jpg', error: null },
        { path: null, signedUrl: '', error: 'Object not found' },
      ],
      error: null,
    });
    const [a, b] = await Promise.all([getSignedUrl('reviews/a.jpg'), getSignedUrl('reviews/gone.jpg')]);
    expect(a).toBe('https://signed/reviews/a.jpg');
    expect(b).toBeNull();
  });

  it('invalidateSignedUrl forces a fresh mint', async () => {
    createSignedUrls.mockImplementation((paths: string[]) => Promise.resolve(ok(paths)));
    await getSignedUrl('reviews/a.jpg');
    invalidateSignedUrl('reviews/a.jpg');
    await getSignedUrl('reviews/a.jpg');
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
  });
});
