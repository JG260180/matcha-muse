import type { Review } from './types';

export interface ReviewerStats {
  matchaCount: number;
  cafeCount: number;
  favouriteCafe: string | null;
  usualMilk: string | null;
  serveLean: 'mostly hot' | 'mostly iced' | 'mixed' | null;
  avgOverall: string | null;
  priciest: { price: number; cafeName: string } | null;
}

// All stats derive from the reviewer's completed reviews — free, no services.
export function computeStats(reviews: Review[]): ReviewerStats {
  const done = reviews.filter((r) => r.status === 'complete');

  const byCafe = new Map<string, { name: string; count: number; last: string }>();
  for (const r of done) {
    if (!r.cafe_id || !r.cafe) continue;
    const cur = byCafe.get(r.cafe_id) ?? { name: r.cafe.name, count: 0, last: '' };
    cur.count += 1;
    if (r.drank_at > cur.last) cur.last = r.drank_at;
    byCafe.set(r.cafe_id, cur);
  }
  const fav = [...byCafe.values()].sort(
    (a, b) => b.count - a.count || b.last.localeCompare(a.last)
  )[0];

  const milkCounts = new Map<string, number>();
  for (const r of done) if (r.milk) milkCounts.set(r.milk, (milkCounts.get(r.milk) ?? 0) + 1);
  const usualMilk = [...milkCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const hot = done.filter((r) => r.temperature === 'hot').length;
  const iced = done.filter((r) => r.temperature === 'iced').length;
  let serveLean: ReviewerStats['serveLean'] = null;
  if (hot + iced > 0) {
    const hotShare = hot / (hot + iced);
    serveLean = hotShare >= 0.6 ? 'mostly hot' : hotShare <= 0.4 ? 'mostly iced' : 'mixed';
  }

  const avgOverall = done.length
    ? (done.reduce((a, r) => a + Number(r.overall), 0) / done.length).toFixed(1)
    : null;

  let priciest: ReviewerStats['priciest'] = null;
  for (const r of done) {
    if (!priciest || Number(r.price) > priciest.price) {
      priciest = { price: Number(r.price), cafeName: r.cafe?.name ?? 'Unknown cafe' };
    }
  }

  return {
    matchaCount: done.length,
    cafeCount: byCafe.size,
    favouriteCafe: fav?.name ?? null,
    usualMilk,
    serveLean,
    avgOverall,
    priciest,
  };
}
