import { haversineMetres, formatDistance } from './nearMe';
import {
  MILK_BUCKETS, groupReviews, sortGroups,
  type MilkBucket, type NearMeFilters,
} from './nearMe';
import type { Cafe, Review } from './types';

describe('haversineMetres', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMetres(-34.9285, 138.6007, -34.9285, 138.6007)).toBe(0);
  });

  it('returns ~111.2 km for one degree of latitude', () => {
    // 1° of latitude ≈ 111,195 m on a 6,371 km sphere
    expect(haversineMetres(-34, 138, -35, 138)).toBeCloseTo(111195, -3);
  });
});

describe('formatDistance', () => {
  it('shows whole metres under 1 km', () => {
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(999)).toBe('999 m');
  });

  it('shows one-decimal km from 1000 m', () => {
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1200)).toBe('1.2 km');
  });
});

const cafeA: Cafe = {
  id: 'a', name: 'Cafe A', address: '1 King William St', suburb: null,
  latitude: -34.9285, longitude: 138.6007, google_place_id: 'place-a',
};
const cafeB: Cafe = {
  id: 'b', name: 'Cafe B', address: '99 Rundle St', suburb: null,
  latitude: -34.9300, longitude: 138.6100, google_place_id: 'place-b',
};
const manualCafe: Cafe = {
  id: 'm', name: 'Hidden Gem', address: null, suburb: 'Norwood',
  latitude: null, longitude: null, google_place_id: null,
};

let seq = 0;
function makeReview(over: Partial<Review> & { cafe: Cafe }): Review {
  seq += 1;
  return {
    id: `r${seq}`,
    cafe_id: over.cafe.id,
    photo_path: null,
    drank_at: `2026-06-${String((seq % 27) + 1).padStart(2, '0')}T10:00:00Z`,
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: null, milk: null, drink_style: null, size: null,
    price: 6, occasions: [], note: null, status: 'complete',
    ...over,
  };
}

const allMilks = new Set<MilkBucket>(MILK_BUCKETS);
const noFilter: NearMeFilters = { serve: 'all', milks: allMilks };
const here = { latitude: -34.9285, longitude: 138.6007 }; // at Cafe A

describe('groupReviews', () => {
  it('groups by cafe with count, avg (display) and best (sort key)', () => {
    const reviews = [
      makeReview({ cafe: cafeA, overall: 5, drank_at: '2026-06-01T10:00:00Z' }),
      makeReview({ cafe: cafeA, overall: 3, drank_at: '2026-06-20T10:00:00Z' }),
      makeReview({ cafe: cafeB, overall: 4 }),
    ];
    const groups = groupReviews(reviews, noFilter, here);
    const a = groups.find((g) => g.cafe.id === 'a')!;
    expect(a.reviews).toHaveLength(2);
    expect(a.reviews[0].drank_at).toBe('2026-06-20T10:00:00Z'); // most recent first
    expect(a.avg).toBe(4);
    expect(a.best).toBe(5);
    expect(a.distanceM).toBeCloseTo(0, 0);
    expect(groups.find((g) => g.cafe.id === 'b')!.distanceM).toBeGreaterThan(500);
  });

  it('gives null distance without a position or without cafe coordinates', () => {
    const withCoords = groupReviews([makeReview({ cafe: cafeA })], noFilter, null);
    expect(withCoords[0].distanceM).toBeNull();
    const manual = groupReviews([makeReview({ cafe: manualCafe })], noFilter, here);
    expect(manual[0].distanceM).toBeNull();
  });

  it('excludes drafts', () => {
    const groups = groupReviews(
      [makeReview({ cafe: cafeA, status: 'draft' })], noFilter, here
    );
    expect(groups).toHaveLength(0);
  });

  it('serve filter: iced excludes hot and unrecorded temperatures', () => {
    const reviews = [
      makeReview({ cafe: cafeA, temperature: 'iced' }),
      makeReview({ cafe: cafeA, temperature: 'hot' }),
      makeReview({ cafe: cafeA, temperature: null }),
    ];
    const groups = groupReviews(reviews, { serve: 'iced', milks: allMilks }, here);
    expect(groups[0].reviews).toHaveLength(1);
    expect(groups[0].reviews[0].temperature).toBe('iced');
  });

  it('milk exclusion: unticking dairy hides dairy; null milk is unspecified, not other', () => {
    const reviews = [
      makeReview({ cafe: cafeA, milk: 'dairy' }),
      makeReview({ cafe: cafeA, milk: 'other' }),
      makeReview({ cafe: cafeA, milk: null }),
    ];
    const noDairy = new Set<MilkBucket>(MILK_BUCKETS.filter((m) => m !== 'dairy'));
    expect(
      groupReviews(reviews, { serve: 'all', milks: noDairy }, here)[0].reviews
    ).toHaveLength(2);

    const noUnspecified = new Set<MilkBucket>(MILK_BUCKETS.filter((m) => m !== 'unspecified'));
    const kept = groupReviews(reviews, { serve: 'all', milks: noUnspecified }, here)[0].reviews;
    expect(kept).toHaveLength(2);
    expect(kept.map((r) => r.milk)).toEqual(expect.arrayContaining(['dairy', 'other']));
  });

  it('a cafe with no matching reviews disappears', () => {
    const noDairy = new Set<MilkBucket>(MILK_BUCKETS.filter((m) => m !== 'dairy'));
    const groups = groupReviews(
      [makeReview({ cafe: cafeB, milk: 'dairy' })],
      { serve: 'all', milks: noDairy }, here
    );
    expect(groups).toHaveLength(0);
  });
});

describe('sortGroups', () => {
  const reviews = [
    makeReview({ cafe: cafeA, overall: 3 }),   // nearest
    makeReview({ cafe: cafeB, overall: 4 }),   // ~1 km away
    makeReview({ cafe: manualCafe, overall: 5 }), // no coords
  ];
  const groups = groupReviews(reviews, noFilter, here);

  it('nearest: by distance, coordinate-less cafes last', () => {
    const ids = sortGroups(groups, 'nearest').map((g) => g.cafe.id);
    expect(ids).toEqual(['a', 'b', 'm']);
  });

  it('top rated: by best score descending', () => {
    const ids = sortGroups(groups, 'top').map((g) => g.cafe.id);
    expect(ids).toEqual(['m', 'b', 'a']);
  });
});
