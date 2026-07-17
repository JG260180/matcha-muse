import { useState } from 'react';

interface Props {
  /** Filters currently narrowing results — shown on the collapsed bar so a
   *  hidden-but-active filter is never a mystery ("why is my list short?"). */
  activeCount: number;
  children: React.ReactNode;
}

// Collapsible home for the serve/milk filter rows (owner feedback 2026-07-17
// follow-up: the filter rows had grown to eat too much of the screen). Filters
// keep applying while collapsed; only their controls hide.
export default function MoreFilters({ activeCount, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between rounded-xl bg-sand/60 px-3 py-2 text-sm text-sand-ink"
      >
        <span>More filters{activeCount > 0 ? ` · ${activeCount} on` : ''}</span>
        <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}
