import { MILK_BUCKETS, type MilkBucket } from '../lib/nearMe';

interface Props {
  selected: ReadonlySet<MilkBucket>; // empty = all milks
  onChange: (next: ReadonlySet<MilkBucket>) => void;
}

// Milk filter row shared by the Journal and Near me (owner request
// 2026-07-17): an explicit "All" chip like the Serve row, specific milks
// start deselected, tapping milks narrows to just those, All clears.
export default function MilkChips({ selected, onChange }: Props) {
  function toggle(m: MilkBucket) {
    const next = new Set(selected);
    if (next.has(m)) next.delete(m); else next.add(m);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Milk">
      <button
        type="button"
        aria-pressed={selected.size === 0}
        onClick={() => onChange(new Set())}
        className={`rounded-full px-4 py-1.5 text-sm ${selected.size === 0 ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
      >
        All
      </button>
      {MILK_BUCKETS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={selected.has(m)}
          onClick={() => toggle(m)}
          className={`rounded-full px-3 py-1.5 text-sm capitalize ${selected.has(m) ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
