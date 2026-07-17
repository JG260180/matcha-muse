import { useEffect } from 'react';

interface Props {
  canSave: boolean; // "Save matcha" available (valid + has a cafe)
  canDraft: boolean;
  onSave: () => void;
  onDraft: () => void;
  onDiscard: () => void; // leave without keeping the review
  onStay: () => void; // keep editing (✕, Escape, "Keep editing")
  discardLabel: string; // "Don't save" for new, "Delete this matcha" for drafts
}

// The "you're leaving a half-finished matcha" dialog (owner request
// 2026-07-17). Same dialog pattern as CafeMenu's viewer: aria-modal,
// autofocus, Escape closes (= stay).
export default function SaveBeforeLeaving({
  canSave, canDraft, onSave, onDraft, onDiscard, onStay, discardLabel,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save before leaving?"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-cream p-6 sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-lg">Before you go —</h2>
          <button
            type="button"
            autoFocus
            onClick={onStay}
            aria-label="Close"
            className="-mr-2 -mt-2 flex h-10 w-10 items-center justify-center rounded-full text-lg leading-none text-ink/60"
          >
            ✕
          </button>
        </div>
        <p className="pt-1 text-sm text-ink/60">This matcha isn't saved yet.</p>
        <div className="space-y-3 pt-4">
          <button
            type="button"
            disabled={!canSave}
            onClick={onSave}
            className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream disabled:opacity-40"
          >
            Save matcha
          </button>
          <button
            type="button"
            disabled={!canDraft}
            onClick={onDraft}
            className="w-full rounded-xl border border-matcha-deep p-3 text-matcha-deep disabled:opacity-40"
          >
            Save as draft
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="w-full rounded-xl border border-red-700 p-3 text-red-700"
          >
            {discardLabel}
          </button>
          <button type="button" onClick={onStay} className="w-full p-2 text-ink/60 underline">
            Keep editing
          </button>
        </div>
        {!canSave && (
          <p className="pt-3 text-xs text-ink/60">
            "Save matcha" needs at least the overall stars, a price, and a cafe — drafts just need the stars.
          </p>
        )}
      </div>
    </div>
  );
}
