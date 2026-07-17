import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReviewDetail from './ReviewDetail';
import { LeaveGuardProvider } from '../lib/leaveGuard';
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
// CafePicker hits geolocation/Places on mount — stub it to a one-tap chooser.
vi.mock('../components/CafePicker', () => ({
  default: ({ onSelect }: { onSelect: (c: unknown) => void }) => (
    <button type="button" onClick={() => onSelect({ kind: 'manual', name: 'Picked Cafe', suburb: '' })}>
      pick-a-cafe
    </button>
  ),
}));

const cafe: Cafe = {
  id: 'c1', name: 'Cafe A', address: '1 King William St', suburb: null,
  latitude: -34.9285, longitude: 138.6007, google_place_id: 'place-a',
};

function makeReview(over: Partial<Review>): Review {
  return {
    // photo_path set by default: publishing requires a photo (2026-07-17)
    id: 'r1', user_id: 'u1', cafe_id: 'c1', photo_path: 'reviews/p.jpg', drank_at: '2026-06-20T10:00:00Z',
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
      <LeaveGuardProvider>
        <Routes>
          <Route path="/review/:id" element={<ReviewDetail />} />
          <Route path="/" element={<p>journal home</p>} />
        </Routes>
      </LeaveGuardProvider>
    </MemoryRouter>
  );
}

describe('ReviewDetail', () => {
  // Call counts must not leak across tests now that several tests assert on
  // updateReview/deleteReview counts.
  beforeEach(() => vi.clearAllMocks());

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

  // 2026-07-17 owner feedback: leaving a half-finished draft asks first.
  it('guards leaving a draft edit: the back link opens the save dialog', async () => {
    renderDetail(makeReview({ status: 'draft' }));
    await screen.findByRole('button', { name: 'Save changes' });
    fireEvent.click(screen.getByRole('link', { name: /journal/i }));
    expect(screen.getByRole('dialog', { name: /save before leaving/i })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined();
  });

  it('dialog "Save as draft" saves and then leaves', async () => {
    vi.mocked(updateReview).mockResolvedValueOnce(null);
    renderDetail(makeReview({ status: 'draft' }));
    await screen.findByRole('button', { name: 'Save changes' });
    fireEvent.click(screen.getByRole('link', { name: /journal/i }));
    const dialog = screen.getByRole('dialog', { name: /save before leaving/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save as draft' }));
    await vi.waitFor(() => expect(updateReview).toHaveBeenCalled());
    expect(await screen.findByText('journal home')).toBeDefined();
  });

  it('dialog "Delete this matcha" deletes the draft and leaves', async () => {
    vi.mocked(deleteReview).mockResolvedValueOnce(undefined);
    renderDetail(makeReview({ status: 'draft' }));
    await screen.findByRole('button', { name: 'Save changes' });
    fireEvent.click(screen.getByRole('link', { name: /journal/i }));
    const dialog = screen.getByRole('dialog', { name: /save before leaving/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete this matcha' }));
    await vi.waitFor(() => expect(deleteReview).toHaveBeenCalledOnce());
    expect(await screen.findByText('journal home')).toBeDefined();
  });

  it('does not guard leaving a completed review in view mode', async () => {
    renderDetail(makeReview({}));
    await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(screen.getByRole('link', { name: /journal/i }));
    expect(await screen.findByText('journal home')).toBeDefined();
  });

  // 2026-07-17 owner feedback: drafts may start without a cafe; publishing
  // requires picking one first.
  it('cafe-less draft: publish is blocked until a cafe is picked', async () => {
    vi.mocked(updateReview).mockResolvedValueOnce(null);
    renderDetail(makeReview({ status: 'draft', cafe: undefined, cafe_id: null }));
    await screen.findByRole('button', { name: 'Save changes' });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Add the cafe before publishing/)).toBeDefined();
    expect(updateReview).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'pick-a-cafe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(() =>
      expect(updateReview).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'complete' }),
        expect.anything(),
        expect.objectContaining({ kind: 'manual', name: 'Picked Cafe' })
      )
    );
  });

  it('offers an Adjust button on the photo while editing', async () => {
    renderDetail(makeReview({ photo_path: 'reviews/x.jpg' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Adjust' })).toBeDefined();
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
