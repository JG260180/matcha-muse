import { haversineMetres, formatDistance } from './nearMe';

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
