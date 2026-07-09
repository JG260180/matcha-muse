import { render, screen, fireEvent } from '@testing-library/react';
import CafeStack from './CafeStack';
import type { CafeGroup } from '../lib/nearMe';
import type { Cafe, Review } from '../lib/types';

vi.mock('./SignedImage', () => ({
  default: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

const cafe: Cafe = {
  id: 'a', name: 'Cafe A', address: '1 King William St', suburb: null,
  latitude: -34.9285, longitude: 138.6007, google_place_id: 'place-a',
};

function makeReview(over: Partial<Review>): Review {
  return {
    id: Math.random().toString(36).slice(2),
    cafe_id: 'a', photo_path: null, drank_at: '2026-06-20T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: 'iced', milk: 'oat', drink_style: null, size: null,
    price: 6, occasions: [], note: null, status: 'complete', cafe,
    ...over,
  };
}

function makeGroup(reviews: Review[]): CafeGroup {
  const scores = reviews.map((r) => Number(r.overall));
  return {
    cafe, reviews, distanceM: 450,
    avg: scores.reduce((x, y) => x + y, 0) / scores.length,
    best: Math.max(...scores),
  };
}

describe('CafeStack', () => {
  it('renders a single review as a plain card with distance and details', () => {
    render(<CafeStack group={makeGroup([makeReview({})])} expanded={false} onToggle={() => {}} />);
    expect(screen.getByText('Cafe A')).toBeDefined();
    expect(screen.getByText(/450 m/)).toBeDefined();
    expect(screen.getByText(/oat · iced/)).toBeDefined();
    expect(screen.queryByText(/matchas/)).toBeNull(); // no count badge
  });

  it('renders multiple reviews as a collapsed stack with count and average', () => {
    const group = makeGroup([makeReview({ overall: 5 }), makeReview({ overall: 4 })]);
    render(<CafeStack group={group} expanded={false} onToggle={() => {}} />);
    expect(screen.getByText('2 matchas')).toBeDefined();
    expect(screen.getByText(/4\.5 ★/)).toBeDefined();
    expect(screen.getByRole('button', { name: /Cafe A/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('calls onToggle when the stack header is tapped', () => {
    const onToggle = vi.fn();
    const group = makeGroup([makeReview({}), makeReview({})]);
    render(<CafeStack group={group} expanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /Cafe A/ }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('fans out each review when expanded', () => {
    const group = makeGroup([
      makeReview({ overall: 5, note: 'silky' }),
      makeReview({ overall: 3, milk: 'dairy', temperature: 'hot' }),
    ]);
    render(<CafeStack group={group} expanded onToggle={() => {}} />);
    expect(screen.getByText(/silky/)).toBeDefined();
    expect(screen.getByText(/dairy · hot/)).toBeDefined();
  });

  it('shows Google links when the cafe has a place id, hides them otherwise', () => {
    render(<CafeStack group={makeGroup([makeReview({})])} expanded={false} onToggle={() => {}} />);
    expect(screen.getByRole('link', { name: /Open in Google Maps/ })).toBeDefined();
    expect(screen.getByRole('link', { name: /Review on Google/ })).toBeDefined();

    const manual: CafeGroup = {
      ...makeGroup([makeReview({})]),
      cafe: { ...cafe, google_place_id: null, latitude: null, longitude: null },
      distanceM: null,
    };
    render(<CafeStack group={manual} expanded={false} onToggle={() => {}} />);
    expect(screen.getAllByRole('link', { name: /Google/ })).toHaveLength(2); // only from first render
    expect(screen.getByText(/added manually/)).toBeDefined();
  });
});
