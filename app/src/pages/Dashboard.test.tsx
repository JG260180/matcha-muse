import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import type { Cafe, Profile, Review } from '../lib/types';

const order = vi.fn();
const profilesSelect = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) =>
      table === 'profiles'
        ? { select: () => profilesSelect() }
        : { select: () => ({ order: () => order() }) },
  },
}));
vi.mock('../components/SignedImage', () => ({
  default: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

const cafe: Cafe = {
  id: 'c1', name: 'Cafe A', address: null, suburb: null,
  latitude: null, longitude: null, google_place_id: null,
};

const justina: Profile = { id: 'u1', display_name: 'Justina Gardiner', about_me: null, avatar_path: null, quiz: {} };
const sam: Profile = { id: 'u2', display_name: 'Sam Lee', about_me: null, avatar_path: null, quiz: {} };

function makeReview(over: Partial<Review>): Review {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    cafe_id: 'c1', photo_path: null, drank_at: '2026-06-20T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: null, milk: null, drink_style: null, size: null,
    price: 6, occasions: [], note: null, status: 'complete', cafe,
    ...over,
  };
}

function renderDashboard(reviews: Review[], profiles: Profile[] = [justina]) {
  order.mockResolvedValue({ data: reviews, error: null });
  profilesSelect.mockResolvedValue({ data: profiles, error: null });
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

  it('does not badge completed cards', async () => {
    const r = makeReview({});
    renderDashboard([r]);
    await screen.findAllByRole('link');
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('toggles a drafts-only filter via the notice', async () => {
    const complete = makeReview({});
    const draft = makeReview({ status: 'draft' });
    renderDashboard([complete, draft]);

    const notice = await screen.findByRole('button', { name: /draft.*waiting/i });
    expect(notice.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(notice);
    expect(notice.getAttribute('aria-pressed')).toBe('true');
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

  it('shows a Directions link when the cafe has location data', async () => {
    const located = {
      ...cafe, latitude: -34.9, longitude: 138.6, google_place_id: 'place123',
    };
    renderDashboard([makeReview({ cafe: located })]);
    const link = await screen.findByRole('link', { name: /directions/i });
    expect(link.getAttribute('href')).toContain('google.com/maps');
    expect(link.getAttribute('href')).toContain('place123');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('shows no Directions link when the cafe has no location data', async () => {
    renderDashboard([makeReview({})]); // default cafe has null lat/lng/place_id
    await screen.findAllByRole('link');
    expect(screen.queryByRole('link', { name: /directions/i })).toBeNull();
  });

  it('shows the reviewer initials badge linking to their profile', async () => {
    const r = makeReview({});
    renderDashboard([r]);
    const badge = await screen.findByRole('link', { name: /justina gardiner's profile/i });
    expect(badge.textContent).toBe('JG');
    expect(badge.getAttribute('href')).toBe('/reviewer/u1');
  });

  it('hides reviewer chips while there is only one reviewer', async () => {
    renderDashboard([makeReview({})]);
    await screen.findAllByRole('link');
    expect(screen.queryByRole('group', { name: /reviewer/i })).toBeNull();
  });

  it('filters cards and stat tiles by reviewer chip', async () => {
    const mine = makeReview({});
    const theirs = makeReview({ user_id: 'u2', overall: 2 });
    renderDashboard([mine, theirs], [justina, sam]);

    const chips = await screen.findByRole('group', { name: /reviewer/i });
    expect(chips).toBeDefined();
    // Both cards visible under "All"
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'))).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Sam Lee' }));
    const cards = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'));
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('href')).toBe(`/review/${theirs.id}`);
    // Stat tiles follow the filter: 1 matcha + 1 cafe tiles, avg 2.0
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText('2.0')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'))).toHaveLength(2);
  });

  it('links to the reviewers list below the grid', async () => {
    renderDashboard([makeReview({})]);
    const link = await screen.findByRole('link', { name: /^reviewers$/i });
    expect(link.getAttribute('href')).toBe('/reviewers');
  });

  it('resets the drafts-only toggle when switching reviewer', async () => {
    const myDraft = makeReview({ status: 'draft' });
    const myComplete = makeReview({});
    const theirs = makeReview({ user_id: 'u2' });
    renderDashboard([myDraft, myComplete, theirs], [justina, sam]);

    // Turn drafts-only on
    const notice = await screen.findByRole('button', { name: /draft.*waiting/i });
    fireEvent.click(notice);
    expect(
      screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'))
    ).toHaveLength(1);

    // Switching reviewer clears the toggle: all of Sam's cards show
    fireEvent.click(screen.getByRole('button', { name: 'Sam Lee' }));
    const samCards = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'));
    expect(samCards).toHaveLength(1);
    expect(samCards[0].getAttribute('href')).toBe(`/review/${theirs.id}`);

    // Back to All: every card visible — drafts-only did not silently reassert
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(
      screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'))
    ).toHaveLength(3);
  });

  it('still renders the journal when the profiles fetch fails', async () => {
    const r = makeReview({});
    order.mockResolvedValue({ data: [r], error: null });
    profilesSelect.mockResolvedValue({ data: null, error: { message: 'boom' } });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    const card = (await screen.findAllByRole('link'))
      .find((l) => l.getAttribute('href') === `/review/${r.id}`);
    expect(card).toBeDefined();
    expect(screen.queryByRole('link', { name: /profile/i })).toBeNull();
  });
});
