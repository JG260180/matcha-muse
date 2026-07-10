import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import type { Cafe, Review } from '../lib/types';

const order = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => order() }) }),
  },
}));
vi.mock('../components/SignedImage', () => ({
  default: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

const cafe: Cafe = {
  id: 'c1', name: 'Cafe A', address: null, suburb: null,
  latitude: null, longitude: null, google_place_id: null,
};

function makeReview(over: Partial<Review>): Review {
  return {
    id: Math.random().toString(36).slice(2),
    cafe_id: 'c1', photo_path: null, drank_at: '2026-06-20T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: null, milk: null, drink_style: null, size: null,
    price: 6, occasions: [], note: null, status: 'complete', cafe,
    ...over,
  };
}

function renderDashboard(reviews: Review[]) {
  order.mockResolvedValue({ data: reviews, error: null });
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard review links and drafts filter', () => {
  it('renders each review card as a link to its detail page', async () => {
    const r = makeReview({});
    renderDashboard([r]);
    const link = (await screen.findAllByRole('link'))
      .find((l) => l.getAttribute('href') === `/review/${r.id}`);
    expect(link).toBeDefined();
  });

  it('badges draft cards', async () => {
    renderDashboard([makeReview({ status: 'draft' })]);
    expect(await screen.findByText('Draft')).toBeDefined();
  });

  it('toggles a drafts-only filter via the notice', async () => {
    const complete = makeReview({});
    const draft = makeReview({ status: 'draft' });
    renderDashboard([complete, draft]);

    const notice = await screen.findByRole('button', { name: /draft.*waiting/i });
    fireEvent.click(notice);
    // Only the draft card remains (1 review link + the + FAB link)
    const reviewLinks = screen.getAllByRole('link')
      .filter((l) => l.getAttribute('href')?.startsWith('/review/'));
    expect(reviewLinks).toHaveLength(1);
    expect(reviewLinks[0].getAttribute('href')).toBe(`/review/${draft.id}`);

    fireEvent.click(screen.getByRole('button', { name: /show all/i }));
    expect(
      screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'))
    ).toHaveLength(2);
  });
});
