import type { Cafe, Milk, Review, Temperature } from './types';

export function haversineMetres(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export type MilkBucket = Milk | 'unspecified';

export const MILK_BUCKETS: readonly MilkBucket[] = [
  'dairy', 'oat', 'soy', 'almond', 'coconut', 'other', 'unspecified',
];

export interface NearMeFilters {
  serve: Temperature | 'all';
  /** Milks to show; an EMPTY set means "all milks" (2026-07-17 All-chip model). */
  milks: ReadonlySet<MilkBucket>;
}

export interface CafeGroup {
  cafe: Cafe;
  reviews: Review[];       // matching reviews, most recent first
  distanceM: number | null; // null without user position or cafe coordinates
  avg: number;              // displayed on the collapsed stack
  best: number;             // Top-rated sort key
}

export function milkBucket(review: Review): MilkBucket {
  return review.milk ?? 'unspecified';
}

export function groupReviews(
  reviews: Review[],
  filters: NearMeFilters,
  pos: { latitude: number; longitude: number } | null
): CafeGroup[] {
  const matching = reviews.filter(
    (r) =>
      r.status === 'complete' &&
      r.cafe != null &&
      (filters.serve === 'all' || r.temperature === filters.serve) &&
      (filters.milks.size === 0 || filters.milks.has(milkBucket(r)))
  );

  const byCafe = new Map<string, Review[]>();
  for (const r of matching) {
    const list = byCafe.get(r.cafe!.id) ?? [];
    list.push(r);
    byCafe.set(r.cafe!.id, list);
  }

  return [...byCafe.values()].map((list) => {
    const sorted = [...list].sort((a, b) => b.drank_at.localeCompare(a.drank_at));
    const cafe = sorted[0].cafe!;
    const scores = sorted.map((r) => Number(r.overall));
    const hasCoords = cafe.latitude != null && cafe.longitude != null;
    return {
      cafe,
      reviews: sorted,
      distanceM:
        pos && hasCoords
          ? haversineMetres(pos.latitude, pos.longitude, cafe.latitude!, cafe.longitude!)
          : null,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      best: Math.max(...scores),
    };
  });
}

export function sortGroups(
  groups: CafeGroup[],
  by: 'nearest' | 'top'
): CafeGroup[] {
  return [...groups].sort((a, b) => {
    if (by === 'top') return b.best - a.best;
    if (a.distanceM == null && b.distanceM == null) return b.best - a.best;
    if (a.distanceM == null) return 1;
    if (b.distanceM == null) return -1;
    return a.distanceM - b.distanceM;
  });
}
