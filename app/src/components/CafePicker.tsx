import { useEffect, useState } from 'react';
import type { CafeCandidate } from '../lib/types';
import { nearbyCafes, searchCafes } from '../lib/places';

export type CafeChoice =
  | { kind: 'candidate'; candidate: CafeCandidate }
  | { kind: 'manual'; name: string; suburb: string }
  // Drafts may skip the cafe and add it later (owner request 2026-07-17).
  | { kind: 'none' };

interface Props {
  onSelect: (c: CafeChoice) => void;
  /** Shows a "skip for now" option (draft flow only). */
  onSkip?: () => void;
}

export default function CafePicker({ onSelect, onSkip }: Props) {
  const [candidates, setCandidates] = useState<CafeCandidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualSuburb, setManualSuburb] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!('geolocation' in navigator)) { setFailed(true); setCandidates([]); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await nearbyCafes(pos.coords.latitude, pos.coords.longitude);
          if (!cancelled) setCandidates(result);
        } catch {
          if (!cancelled) { setFailed(true); setCandidates([]); }
        }
      },
      () => { if (!cancelled) { setFailed(true); setCandidates([]); } },
      { timeout: 8000 }
    );
    return () => { cancelled = true; };
  }, []);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      setCandidates(await searchCafes(query));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="space-y-4 px-6">
      <h2 className="font-display text-xl">Which cafe?</h2>
      {onSkip && (
        <button type="button" onClick={onSkip} className="text-sm text-ink/60 underline">
          Skip for now — add the cafe when you finish the draft
        </button>
      )}

      {candidates === null && <p className="text-ink/60">Finding cafes near you…</p>}

      {candidates?.map((c) => (
        <button
          key={c.placeId}
          type="button"
          onClick={() => onSelect({ kind: 'candidate', candidate: c })}
          className="block w-full rounded-xl border border-sand bg-white p-4 text-left"
        >
          <span className="font-medium">{c.name}</span>
          <span className="block text-sm text-ink/60">{c.address}</span>
        </button>
      ))}

      {candidates !== null && (
        <>
          {failed && (
            <p className="text-sm text-ink/60">
              Couldn't look up nearby cafes — search by name or add it yourself.
            </p>
          )}
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cafe by name"
              aria-label="Search cafe"
              className="flex-1 rounded-xl border border-sand bg-white p-3"
            />
            <button type="submit" className="rounded-xl bg-matcha-deep px-4 text-cream">Go</button>
          </form>

          <details className="rounded-xl bg-sand/50 p-4">
            <summary className="text-sm text-sand-ink">Can't find it? Add the cafe manually</summary>
            <div className="mt-3 space-y-2">
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Cafe name"
                aria-label="Cafe name"
                className="w-full rounded-xl border border-sand bg-white p-3"
              />
              <input
                value={manualSuburb}
                onChange={(e) => setManualSuburb(e.target.value)}
                placeholder="Suburb"
                aria-label="Suburb"
                className="w-full rounded-xl border border-sand bg-white p-3"
              />
              <button
                type="button"
                disabled={!manualName.trim()}
                onClick={() => onSelect({ kind: 'manual', name: manualName.trim(), suburb: manualSuburb.trim() })}
                className="w-full rounded-xl border border-matcha-deep p-3 text-matcha-deep disabled:opacity-40"
              >
                Use this cafe
              </button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
