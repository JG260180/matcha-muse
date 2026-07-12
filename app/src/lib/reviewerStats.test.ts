import { computeStats } from './reviewerStats';
import type { Cafe, Review } from './types';

function cafe(id: string, name: string): Cafe {
  return { id, name, address: null, suburb: null, latitude: null, longitude: null, google_place_id: null };
}

function review(over: Partial<Review>): Review {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1',
    cafe_id: 'c1', photo_path: null, drank_at: '2026-06-01T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: null, milk: null, drink_style: null, size: null,
    price: 6, occasions: [], note: null, status: 'complete', cafe: cafe('c1', 'Cafe A'),
    ...over,
  };
}

describe('computeStats', () => {
  it('returns the empty shape for no reviews', () => {
    const s = computeStats([]);
    expect(s.matchaCount).toBe(0);
    expect(s.favouriteCafe).toBeNull();
    expect(s.usualMilk).toBeNull();
    expect(s.serveLean).toBeNull();
    expect(s.avgOverall).toBeNull();
    expect(s.priciest).toBeNull();
  });

  it('ignores drafts', () => {
    const s = computeStats([review({ status: 'draft' })]);
    expect(s.matchaCount).toBe(0);
  });

  it('counts matchas and distinct cafes', () => {
    const b = cafe('c2', 'Cafe B');
    const s = computeStats([review({}), review({}), review({ cafe_id: 'c2', cafe: b })]);
    expect(s.matchaCount).toBe(3);
    expect(s.cafeCount).toBe(2);
  });

  it('favourite cafe is the most visited; ties go to the most recent visit', () => {
    const b = cafe('c2', 'Cafe B');
    const s = computeStats([
      review({ drank_at: '2026-01-01T10:00:00Z' }),
      review({ cafe_id: 'c2', cafe: b, drank_at: '2026-06-01T10:00:00Z' }),
    ]);
    expect(s.favouriteCafe).toBe('Cafe B');
  });

  it('usual milk is the most common non-null milk', () => {
    const s = computeStats([review({ milk: 'oat' }), review({ milk: 'oat' }), review({ milk: 'dairy' })]);
    expect(s.usualMilk).toBe('oat');
  });

  it('serve lean reads mostly hot / mostly iced / mixed', () => {
    expect(computeStats([review({ temperature: 'hot' }), review({ temperature: 'hot' })]).serveLean).toBe('mostly hot');
    expect(computeStats([review({ temperature: 'iced' }), review({ temperature: 'iced' })]).serveLean).toBe('mostly iced');
    expect(computeStats([review({ temperature: 'hot' }), review({ temperature: 'iced' })]).serveLean).toBe('mixed');
    expect(computeStats([review({})]).serveLean).toBeNull();
  });

  it('averages overall to one decimal and finds the priciest matcha', () => {
    const b = cafe('c2', 'Cafe B');
    const s = computeStats([review({ overall: 4, price: 6 }), review({ overall: 5, price: 9.5, cafe_id: 'c2', cafe: b })]);
    expect(s.avgOverall).toBe('4.5');
    expect(s.priciest).toEqual({ price: 9.5, cafeName: 'Cafe B' });
  });
});
