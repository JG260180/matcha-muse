import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Profile, Review, Temperature } from '../lib/types';
import { milkBucket, type MilkBucket } from '../lib/nearMe';
import { initialsFrom } from '../lib/profile';
import MilkChips from '../components/MilkChips';
import { directionsUrl } from '../lib/googleLinks';
import SignedImage from '../components/SignedImage';
import NewFab from '../components/NewFab';
import MoreFilters from '../components/MoreFilters';

const SERVES: (Temperature | 'all')[] = ['all', 'hot', 'iced'];

export default function Dashboard() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [showDraftsOnly, setShowDraftsOnly] = useState(false);
  const [reviewer, setReviewer] = useState<string>('all');
  // 2026-07-17: same serve/milk filters as Near Me, composing with the above.
  // milks: empty set = All (the All-chip model).
  const [serve, setServe] = useState<Temperature | 'all'>('all');
  const [milks, setMilks] = useState<ReadonlySet<MilkBucket>>(new Set());

  useEffect(() => {
    Promise.all([
      supabase.from('reviews').select('*, cafe:cafes(*)').order('drank_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]).then(([r, p]) => {
      if (r.error) { setFetchError(true); setReviews([]); return; }
      setReviews((r.data as Review[] | null) ?? []);
      // Profile fetch failure is non-fatal: the journal still works,
      // badges and chips just don't appear.
      if (!p.error) setProfiles((p.data as Profile[] | null) ?? []);
    });
  }, []);

  if (reviews === null) return <p className="px-6 text-ink/60">Brewing…</p>;
  if (fetchError) return <p className="px-6 py-10 text-center text-ink/60">Couldn't load your journal — check your connection and try again.</p>;

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const reviewerIds = [...new Set(reviews.map((r) => r.user_id))]
    .filter((id) => profileById.has(id));

  const avg = (xs: number[]) =>
    xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '–';
  const byReviewer = reviewer === 'all' ? reviews : reviews.filter((r) => r.user_id === reviewer);
  const filtered = byReviewer.filter(
    (r) =>
      (serve === 'all' || r.temperature === serve) &&
      (milks.size === 0 || milks.has(milkBucket(r)))
  );
  const cafeCount = new Set(filtered.map((r) => r.cafe_id).filter(Boolean)).size;
  const drafts = filtered.filter((r) => r.status === 'draft');
  const visible = showDraftsOnly && drafts.length > 0 ? drafts : filtered;

  return (
    <div className="px-6 pb-24">
      <div className="grid grid-cols-3 gap-3 py-4">
        <Stat label="Matchas" value={String(filtered.length)} />
        <Stat label="Cafes" value={String(cafeCount)} />
        <Stat label="Avg score" value={avg(filtered.map((r) => Number(r.overall)))} />
      </div>

      {reviewerIds.length >= 2 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Reviewer">
          <button
            type="button" aria-pressed={reviewer === 'all'} onClick={() => { setReviewer('all'); setShowDraftsOnly(false); }}
            className={`rounded-full px-4 py-1.5 text-sm ${reviewer === 'all' ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
          >
            All
          </button>
          {reviewerIds.map((id) => (
            <button
              key={id} type="button" aria-pressed={reviewer === id} onClick={() => { setReviewer(id); setShowDraftsOnly(false); }}
              className={`rounded-full px-4 py-1.5 text-sm ${reviewer === id ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
            >
              {profileById.get(id)!.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Serve/milk live behind "More filters" (owner feedback: the filter
          rows ate too much screen). They keep filtering while collapsed. */}
      <div className="mb-3">
        <MoreFilters activeCount={(serve !== 'all' ? 1 : 0) + (milks.size > 0 ? 1 : 0)}>
          <div className="flex gap-2" role="group" aria-label="Serve">
            {SERVES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={serve === s}
                onClick={() => { setServe(s); setShowDraftsOnly(false); }}
                className={`rounded-full px-4 py-1.5 text-sm capitalize ${serve === s ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <MilkChips selected={milks} onChange={(s) => { setMilks(s); setShowDraftsOnly(false); }} />
        </MoreFilters>
      </div>

      {drafts.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDraftsOnly(!showDraftsOnly)}
          aria-pressed={showDraftsOnly}
          className="mb-3 w-full rounded-xl bg-sand/60 p-3 text-left text-sm text-sand-ink"
        >
          {showDraftsOnly
            ? 'Showing drafts only — tap to show all.'
            : `${drafts.length} draft${drafts.length > 1 ? 's' : ''} waiting for details — tap to view.`}
        </button>
      )}

      {reviews.length === 0 && (
        <p className="py-10 text-center text-ink/60">Your first matcha awaits — tap the + to begin.</p>
      )}
      {reviews.length > 0 && visible.length === 0 && (
        <p className="py-10 text-center text-ink/60">No matchas match — widen the filters.</p>
      )}

      {/* Full-width horizontal cards (owner feedback 2026-07-17 follow-up):
          portrait photo on the left, details on the right. The photo slot
          crops the adjusted 4:3 image to portrait from its centre — the
          closest honouring of the framed position a vertical slot allows. */}
      <div className="space-y-3">
        {visible.map((r) => {
          const c = r.cafe;
          const p = profileById.get(r.user_id);
          const hasDirections =
            c && c.latitude != null && c.longitude != null && c.google_place_id != null;
          return (
            <div key={r.id} className="relative flex min-h-40 overflow-hidden rounded-2xl border border-sand bg-white">
              <div className="relative w-28 shrink-0">
                <SignedImage path={r.photo_path} alt={c?.name ?? 'Matcha'} thumb className="absolute inset-0 h-full w-full object-cover" />
                {r.status === 'draft' && (
                  <span className="absolute left-2 top-2 rounded-full bg-sand px-2 py-0.5 text-xs text-sand-ink">Draft</span>
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="p-3 pb-1 pr-12">
                  <p className="truncate font-display">{c?.name ?? 'Unknown cafe'}</p>
                  <p className="text-sm text-ink/60">
                    {Number(r.overall).toFixed(1)} ★{r.price != null ? ` · $${Number(r.price).toFixed(2)}` : ''}
                  </p>
                  <p className="text-sm text-ink/60">
                    {[r.milk, r.temperature].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {hasDirections ? (
                  <a
                    href={directionsUrl(c.latitude!, c.longitude!, c.google_place_id!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative z-10 mt-auto flex min-h-11 w-fit items-center px-3 pb-1 text-sm text-matcha-deep underline"
                  >
                    Directions ↗
                  </a>
                ) : (
                  <div className="pb-2" />
                )}
              </div>
              {/* Whole-card tap target, stretched over the content; the
                  Directions and profile links sit above it (z-10). */}
              <Link to={`/review/${r.id}`} aria-label={c?.name ?? 'Matcha'} className="absolute inset-0" />
              {p && (
                <Link
                  to={`/reviewer/${r.user_id}`}
                  aria-label={`${p.display_name}'s profile`}
                  className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-xs font-medium text-cream backdrop-blur"
                >
                  {initialsFrom(p.display_name)}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <Link to="/reviewers" className="mt-6 block text-center text-sm text-ink/60 underline">
        Reviewers
      </Link>

      <NewFab />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sand/50 p-3 text-center">
      <p className="font-display text-xl">{value}</p>
      <p className="text-xs text-sand-ink">{label}</p>
    </div>
  );
}
