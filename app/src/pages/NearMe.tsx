import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Review, Temperature } from '../lib/types';
import {
  MILK_BUCKETS, groupReviews, sortGroups, type MilkBucket,
} from '../lib/nearMe';
import { staticMapUrl } from '../lib/googleLinks';
import CafeStack from '../components/CafeStack';
import NewFab from '../components/NewFab';
import BackToJournal from '../components/BackToJournal';

const SERVES: (Temperature | 'all')[] = ['all', 'hot', 'iced'];

export default function NearMe() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [pos, setPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locFailed, setLocFailed] = useState(false);
  const [serve, setServe] = useState<Temperature | 'all'>('all');
  const [milks, setMilks] = useState<ReadonlySet<MilkBucket>>(new Set(MILK_BUCKETS));
  const [sort, setSort] = useState<'nearest' | 'top'>('nearest');
  const [openCafe, setOpenCafe] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('reviews')
      .select('*, cafe:cafes(*)')
      .eq('status', 'complete')
      .then(({ data, error }) => {
        if (error) { setFetchError(true); setReviews([]); return; }
        setReviews((data as Review[] | null) ?? []);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!('geolocation' in navigator)) { setLocFailed(true); setSort('top'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!cancelled) setPos({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      },
      () => { if (!cancelled) { setLocFailed(true); setSort('top'); } },
      { timeout: 8000 }
    );
    return () => { cancelled = true; };
  }, []);

  if (reviews === null) return <p className="px-6 text-ink/60">Brewing…</p>;
  if (fetchError) {
    return <p className="px-6 py-10 text-center text-ink/60">Couldn't load your matchas — check your connection and try again.</p>;
  }

  const effectiveSort = pos ? sort : 'top';
  const groups = sortGroups(groupReviews(reviews, { serve, milks }, pos), effectiveSort);
  const pins = groups
    .filter((g) => g.cafe.latitude != null && g.cafe.longitude != null)
    .map((g) => ({ latitude: g.cafe.latitude!, longitude: g.cafe.longitude! }));

  function toggleMilk(m: MilkBucket) {
    const next = new Set(milks);
    if (next.has(m)) next.delete(m); else next.add(m);
    setMilks(next);
  }

  return (
    <>
      <BackToJournal />
      <div className="space-y-4 px-6 pb-24">
        {pins.length > 0 && (
          <img
            src={staticMapUrl(pins, pos, import.meta.env.VITE_GOOGLE_PLACES_KEY as string)}
            alt="Map of your matcha cafes"
            className="h-40 w-full rounded-2xl object-cover"
          />
        )}

        {locFailed && (
          <p className="rounded-xl bg-sand/60 p-3 text-sm text-sand-ink">
            Distances need location access — showing top rated instead.
          </p>
        )}

        <div className="flex gap-2" role="group" aria-label="Sort">
          <button
            type="button"
            disabled={!pos}
            aria-pressed={effectiveSort === 'nearest'}
            onClick={() => setSort('nearest')}
            className={`rounded-full px-4 py-1.5 text-sm disabled:opacity-40 ${effectiveSort === 'nearest' ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
          >
            Nearest
          </button>
          <button
            type="button"
            aria-pressed={effectiveSort === 'top'}
            onClick={() => setSort('top')}
            className={`rounded-full px-4 py-1.5 text-sm ${effectiveSort === 'top' ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
          >
            Top rated
          </button>
        </div>

        <div className="flex gap-2" role="group" aria-label="Serve">
          {SERVES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={serve === s}
              onClick={() => setServe(s)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${serve === s ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Milk">
          {MILK_BUCKETS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={milks.has(m)}
              onClick={() => toggleMilk(m)}
              className={`rounded-full px-3 py-1.5 text-sm capitalize ${milks.has(m) ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink line-through'}`}
            >
              {m}
            </button>
          ))}
        </div>

        {groups.length === 0 && (
          <p className="py-10 text-center text-ink/60">
            {reviews.length === 0
              ? 'Your first matcha awaits — tap the + to begin.'
              : 'No matchas match — widen the filters, or tap + to log one.'}
          </p>
        )}

        <div className="space-y-4">
          {groups.map((g) => (
            <CafeStack
              key={g.cafe.id}
              group={g}
              expanded={openCafe === g.cafe.id}
              onToggle={() => setOpenCafe(openCafe === g.cafe.id ? null : g.cafe.id)}
            />
          ))}
        </div>

        <NewFab />
      </div>
    </>
  );
}
