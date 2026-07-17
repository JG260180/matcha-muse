import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReviewDetail from './ReviewDetail';
import { updateReview, deleteReview } from '../lib/api';
import type { Cafe, Review } from '../lib/types';

const maybeSingle = vi.fn();
const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }),
  },
}));
vi.mock('../lib/api', () => ({
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
}));
vi.mock('../components/SignedImage', () => ({
  default: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));
vi.mock('../components/CafeMenu', () => ({
  default: ({ cafeId }: { cafeId: string }) => <div data-testid="cafe-menu" data-cafe={cafeId} />,
}));

const cafe: Cafe = {
  id: 'c1', name: 'Cafe A', address: '1 King William St', suburb: null,
  latitude: -34.9285, longitude: 138.6007, google_place_id: 'place-a',
};

function makeReview(over: Partial<Review>): Review {
  return {
    id: 'r1', user_id: 'u1', cafe_id: 'c1', photo_path: null, drank_at: '2026-06-20T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: 'iced', milk: 'oat', drink_style: null, size: null,
    price: 6.5, occasions: [], note: 'silky', status: 'complete', cafe,
    ...over,
  };
}

function renderDetail(review: Review | null, ownId = 'u1') {
  maybeSingle.mockResolvedValue({ data: review, error: null });
  getUser.mockResolvedValue({ data: { user: { id: ownId } }, error: null });
  render(
    <MemoryRouter initialEntries={['/review/r1']}>
      <Routes>
        <Route path="/review/:id" element={<ReviewDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReviewDetail', () => {
  it('opens a completed review in view mode with Edit and Delete', async () => {
    renderDetail(makeReview({}));
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.getByText('Cafe A')).toBeDefined();
    expect(screen.getByText(/silky/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete this matcha' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('switches to a pre-filled form when Edit is tapped', async () => {
    renderDetail(makeReview({}));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText('Price') as HTMLInputElement).value).toBe('6.5');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Keep as draft/ })).toBeNull(); // completed → no draft button
  });

  it('opens a draft directly in edit mode with Keep as draft', async () => {
    renderDetail(makeReview({ status: 'draft' }));
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep as draft' })).toBeDefined();
  });

  it('shows the standard message when the review cannot be loaded', async () => {
    renderDetail(null);
    expect(await screen.findByText(/Couldn't load this matcha/)).toBeDefined();
  });

  it('keeps in-progress edits when a save fails', async () => {
    vi.mocked(updateReview).mockRejectedValueOnce(new Error('offline'));
    renderDetail(makeReview({ status: 'draft' }));
    const price = (await screen.findByLabelText('Price')) as HTMLInputElement;
    fireEvent.change(price, { target: { value: '9.99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Couldn't save/)).toBeDefined();
    expect((screen.getByLabelText('Price') as HTMLInputElement).value).toBe('9.99');
  });

  it('hides Edit and Delete on someone else\'s review', async () => {
    renderDetail(makeReview({ user_id: 'u2' }), 'u1');
    expect(await screen.findByText('Cafe A')).toBeDefined();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete this matcha' })).toBeNull();
  });

  it('shows Edit and Delete on your own review', async () => {
    renderDetail(makeReview({}), 'u1');
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete this matcha' })).toBeDefined();
  });

  it('shows the cafe menu section in view mode', async () => {
    renderDetail(makeReview({}));
    await screen.findByRole('button', { name: 'Edit' });
    expect(screen.getByTestId('cafe-menu').getAttribute('data-cafe')).toBe('c1');
  });

  // 2026-07-17 owner request: menu photos must be addable without publishing,
  // so the menu section now also shows while editing (drafts open in edit mode).
  it('shows the menu section while editing a draft', async () => {
    renderDetail(makeReview({ status: 'draft' }));
    await screen.findByRole('button', { name: 'Save changes' });
    expect(screen.getByTestId('cafe-menu').getAttribute('data-cafe')).toBe('c1');
  });

  it('lets a draft be deleted while editing (two-tap confirm)', async () => {
    vi.mocked(deleteReview).mockResolvedValueOnce(undefined);
    renderDetail(makeReview({ status: 'draft' }));
    const del = await screen.findByRole('button', { name: 'Delete this matcha' });
    fireEvent.click(del);
    fireEvent.click(screen.getByRole('button', { name: /tap again to confirm/i }));
    await vi.waitFor(() => expect(deleteReview).toHaveBeenCalledOnce());
  });

  it('shows a delete-specific error when deleting a draft fails', async () => {
    vi.mocked(deleteReview).mockRejectedValueOnce(new Error('offline'));
    renderDetail(makeReview({ status: 'draft' }));
    const del = await screen.findByRole('button', { name: 'Delete this matcha' });
    fireEvent.click(del);
    fireEvent.click(screen.getByRole('button', { name: /tap again to confirm/i }));
    expect(await screen.findByText(/Couldn't delete/)).toBeDefined();
    // The form is still there — the draft was not lost
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined();
  });

  it('offers no delete button while editing a completed review', async () => {
    renderDetail(makeReview({}));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('button', { name: 'Delete this matcha' })).toBeNull();
  });

  it('hides the menu section when the review has no cafe', async () => {
    renderDetail(makeReview({ cafe: undefined, cafe_id: null }));
    await screen.findByText('Unknown cafe');
    expect(screen.queryByTestId('cafe-menu')).toBeNull();
  });
});
