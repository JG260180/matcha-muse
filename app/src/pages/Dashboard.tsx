import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Review } from '../lib/types';
import SignedImage from '../components/SignedImage';

export default function Dashboard() {
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    supabase
      .from('reviews')
      .select('*, cafe:cafes(*)')
      .order('drank_at', { ascending: false })
      .then(({ data }) => setReviews((data as Review[] | null) ?? []));
  }, []);

  if (reviews === null) return <p className="px-6 text-ink/60">Brewing…</p>;

  const avg = (xs: number[]) =>
    xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '–';
  const cafeCount = new Set(reviews.map((r) => r.cafe_id).filter(Boolean)).size;
  const drafts = reviews.filter((r) => r.status === 'draft');

  return (
    <div className="px-6 pb-24">
      <div className="grid grid-cols-3 gap-3 py-4">
        <Stat label="Matchas" value={String(reviews.length)} />
        <Stat label="Cafes" value={String(cafeCount)} />
        <Stat label="Avg score" value={avg(reviews.map((r) => Number(r.overall)))} />
      </div>

      {drafts.length > 0 && (
        <p className="mb-3 rounded-xl bg-sand/60 p-3 text-sm text-sand-ink">
          {drafts.length} draft{drafts.length > 1 ? 's' : ''} waiting for details.
        </p>
      )}

      {reviews.length === 0 && (
        <p className="py-10 text-center text-ink/60">Your first matcha awaits — tap the + to begin.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {reviews.map((r) => (
          <div key={r.id} className="overflow-hidden rounded-2xl border border-sand bg-white">
            <SignedImage path={r.photo_path} alt={r.cafe?.name ?? 'Matcha'} className="h-36 w-full object-cover" />
            <div className="p-3">
              <p className="truncate font-display">{r.cafe?.name ?? 'Unknown cafe'}</p>
              <p className="text-sm text-ink/60">
                {Number(r.overall).toFixed(1)} ★ · ${Number(r.price).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/new"
        aria-label="New matcha review"
        className="fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-matcha-deep text-3xl text-cream"
      >
        +
      </Link>
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
