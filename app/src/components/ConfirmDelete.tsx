import { useEffect, useState } from 'react';

// Two-step destructive button: first tap arms, second tap fires.
// Tapping elsewhere (blur) or unmounting resets the armed state.
export default function ConfirmDelete({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);

  // iOS Safari doesn't reliably blur when tapping empty space, so an armed
  // button also disarms itself after a few seconds.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      aria-live="polite"
      onClick={() => (armed ? onDelete() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={`w-full rounded-xl border border-red-700 p-3 ${
        armed ? 'bg-red-700 text-cream' : 'text-red-700'
      }`}
    >
      {armed ? "Tap again to confirm — this can't be undone" : 'Delete this matcha'}
    </button>
  );
}
