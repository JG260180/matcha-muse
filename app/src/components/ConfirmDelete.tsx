import { useState } from 'react';

// Two-step destructive button: first tap arms, second tap fires.
// Tapping elsewhere (blur) or unmounting resets the armed state.
export default function ConfirmDelete({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
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
