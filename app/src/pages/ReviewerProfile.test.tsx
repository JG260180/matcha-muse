import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReviewerProfile from './ReviewerProfile';
import type { Profile, Review } from '../lib/types';

const profileResult = vi.fn();
const reviewsResult = vi.fn();
const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    from: (table: string) =>
      table === 'profiles'
        ? { select: () => ({ eq: () => ({ maybeSingle: () => profileResult() }) }) }
        : { select: () => ({ eq: () => ({ eq: () => reviewsResult() }) }) },
    storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null }) }) },
  },
}));

const sam: Profile = {
  id: 'u2', display_name: 'Sam Lee', about_me: 'Oat latte devotee.', avatar_path: null,
  quiz: { sweetness: 'lightly_sweet', milk: 'oat', adventurousness: 'anything', frequency: 'weekly', priority: 'intensity' },
};

function makeReview(over: Partial<Review>): Review {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u2',
    cafe_id: 'c1', photo_path: null, drank_at: '2026-06-20T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: 'iced', milk: 'oat', drink_style: null, size: null,
    price: 6, occasions: [], note: null, status: 'complete',
    cafe: { id: 'c1', name: 'Cafe A', address: null, suburb: null, latitude: null, longitude: null, google_place_id: null },
    ...over,
  };
}

function renderPage(profile: Profile | null, reviews: Review[], ownId = 'u1') {
  profileResult.mockResolvedValue({ data: profile, error: null });
  reviewsResult.mockResolvedValue({ data: reviews, error: null });
  getUser.mockResolvedValue({ data: { user: { id: ownId } }, error: null });
  render(
    <MemoryRouter initialEntries={['/reviewer/u2']}>
      <Routes>
        <Route path="/reviewer/:id" element={<ReviewerProfile />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReviewerProfile', () => {
  it('shows name, about-me, quiz answers as labels, and derived stats', async () => {
    renderPage(sam, [makeReview({}), makeReview({ price: 9.5 })]);
    expect(await screen.findByText('Sam Lee')).toBeDefined();
    expect(screen.getByText('Oat latte devotee.')).toBeDefined();
    expect(screen.getByText('Intensity of matcha taste')).toBeDefined(); // quiz label, not key
    expect(screen.getByText('Cafe A')).toBeDefined(); // favourite cafe
    expect(screen.getByText(/\$9\.50/)).toBeDefined(); // priciest
  });

  it('shows the empty-stats state for a reviewer with no matchas', async () => {
    renderPage(sam, []);
    expect(await screen.findByText(/no matchas logged yet/i)).toBeDefined();
  });

  it('offers Edit profile only on your own page', async () => {
    renderPage(sam, [makeReview({})], 'u2'); // viewing own profile
    expect(await screen.findByRole('button', { name: /edit profile/i })).toBeDefined();
  });

  it('hides Edit profile on someone else\'s page', async () => {
    renderPage(sam, [makeReview({})], 'u1');
    await screen.findByText('Sam Lee');
    expect(screen.queryByRole('button', { name: /edit profile/i })).toBeNull();
  });

  it('explains when a profile does not exist yet', async () => {
    renderPage(null, []);
    expect(await screen.findByText(/hasn't set up their profile yet/i)).toBeDefined();
  });
});
