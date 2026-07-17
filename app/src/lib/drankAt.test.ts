import { localDateString, todayLocalDate, applyDrankAtDate } from './drankAt';

describe('localDateString', () => {
  it('formats an ISO timestamp as a local YYYY-MM-DD', () => {
    // Construct from local parts so the expectation holds in any timezone.
    const iso = new Date(2026, 5, 20, 10, 30).toISOString();
    expect(localDateString(iso)).toBe('2026-06-20');
  });

  it('pads single-digit months and days', () => {
    const iso = new Date(2026, 0, 5, 9, 0).toISOString();
    expect(localDateString(iso)).toBe('2026-01-05');
  });
});

describe('todayLocalDate', () => {
  it('returns today as YYYY-MM-DD', () => {
    expect(todayLocalDate()).toBe(localDateString(new Date().toISOString()));
  });
});

describe('applyDrankAtDate', () => {
  const base = new Date(2026, 5, 20, 10, 30).toISOString();

  it('keeps the timestamp when no date is chosen', () => {
    expect(applyDrankAtDate(base, undefined)).toBe(base);
    expect(applyDrankAtDate(base, '')).toBe(base);
  });

  it('keeps the timestamp (and its time of day) when the chosen date matches', () => {
    expect(applyDrankAtDate(base, '2026-06-20')).toBe(base);
  });

  it('moves to local noon of a different chosen date', () => {
    const result = applyDrankAtDate(base, '2026-06-18');
    expect(result).toBe(new Date(2026, 5, 18, 12, 0, 0).toISOString());
    expect(localDateString(result)).toBe('2026-06-18');
  });

  it('ignores a malformed date string', () => {
    expect(applyDrankAtDate(base, 'not-a-date')).toBe(base);
  });
});
