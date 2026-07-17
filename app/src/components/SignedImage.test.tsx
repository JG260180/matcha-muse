import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import SignedImage from './SignedImage';

const getSignedUrl = vi.fn();
const invalidateSignedUrl = vi.fn();

vi.mock('../lib/signedUrls', () => ({
  getSignedUrl: (path: string) => getSignedUrl(path),
  invalidateSignedUrl: (path: string) => invalidateSignedUrl(path),
  thumbPath: (path: string) => path.replace(/\.jpg$/, '.thumb.jpg'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getSignedUrl.mockResolvedValue('https://signed/reviews/a.jpg');
});

describe('SignedImage', () => {
  it('renders the placeholder without a path and never mints a URL', () => {
    render(<SignedImage path={null} alt="Matcha" />);
    expect(screen.getByLabelText('Matcha')).toBeDefined();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('shows the placeholder, then the image once the signed URL resolves', async () => {
    render(<SignedImage path="reviews/a.jpg" alt="Matcha" />);
    expect(screen.queryByRole('img')).toBeNull();
    const img = (await screen.findByRole('img')) as HTMLImageElement;
    expect(img.src).toBe('https://signed/reviews/a.jpg');
    // Lazy decode/load keeps a 10-card journal from decoding everything at once.
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('stays on the placeholder when the URL cannot be minted', async () => {
    getSignedUrl.mockResolvedValue(null);
    render(<SignedImage path="reviews/a.jpg" alt="Matcha" />);
    await vi.waitFor(() => expect(getSignedUrl).toHaveBeenCalled());
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByLabelText('Matcha')).toBeDefined();
  });

  it('uses the thumb URL for card contexts', async () => {
    getSignedUrl.mockImplementation((p: string) =>
      Promise.resolve(p.includes('.thumb') ? 'https://signed/thumb.jpg' : 'https://signed/full.jpg')
    );
    render(<SignedImage path="reviews/a.jpg" alt="Matcha" thumb />);
    const img = (await screen.findByRole('img')) as HTMLImageElement;
    expect(img.src).toBe('https://signed/thumb.jpg');
    expect(getSignedUrl).toHaveBeenCalledWith('reviews/a.thumb.jpg');
  });

  it('falls back to the full photo when no thumb exists (older photos)', async () => {
    getSignedUrl.mockImplementation((p: string) =>
      Promise.resolve(p.includes('.thumb') ? null : 'https://signed/full.jpg')
    );
    render(<SignedImage path="reviews/a.jpg" alt="Matcha" thumb />);
    const img = (await screen.findByRole('img')) as HTMLImageElement;
    expect(img.src).toBe('https://signed/full.jpg');
  });

  it('re-mints once when the image errors (expired token), then gives up', async () => {
    render(<SignedImage path="reviews/a.jpg" alt="Matcha" />);
    fireEvent.error(await screen.findByRole('img'));
    expect(invalidateSignedUrl).toHaveBeenCalledWith('reviews/a.jpg');
    await vi.waitFor(() => expect(getSignedUrl).toHaveBeenCalledTimes(2));
    fireEvent.error(await screen.findByRole('img'));
    expect(getSignedUrl).toHaveBeenCalledTimes(2);
    expect(invalidateSignedUrl).toHaveBeenCalledTimes(1);
  });
});
