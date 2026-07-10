import { useState } from 'react';
import StarRating from './StarRating';
import Chips from './Chips';
import {
  MILKS, DRINK_STYLES, SIZES, TEMPERATURES, OCCASIONS,
  type Milk, type DrinkStyle, type Size, type Temperature, type Occasion,
} from '../lib/types';

export interface ReviewDraft {
  overall: number | null;
  taste: number | null;
  sweetness: number | null;
  texture: number | null;
  temperature: Temperature | null;
  milk: Milk | null;
  drink_style: DrinkStyle | null;
  size: Size | null;
  price: string;
  occasions: Occasion[];
  note: string;
  status: 'complete' | 'draft';
}

const EMPTY: ReviewDraft = {
  overall: null, taste: null, sweetness: null, texture: null,
  temperature: null, milk: null, drink_style: null, size: null,
  price: '', occasions: [], note: '', status: 'complete',
};

interface Props {
  onSubmit: (d: ReviewDraft) => void;
  initial?: ReviewDraft;
  submitLabel?: string;
  draftLabel?: string | null; // null hides the secondary button
  onCancel?: () => void;
}

export default function ReviewForm({
  onSubmit,
  initial = EMPTY,
  submitLabel = 'Save matcha',
  draftLabel = 'Save as draft — finish details later',
  onCancel,
}: Props) {
  const [d, setD] = useState(initial);
  const patch = (p: Partial<ReviewDraft>) => setD((prev) => ({ ...prev, ...p }));
  const priceTrimmed = d.price.trim();
  const priceOk = /^\d+(\.\d{1,2})?$/.test(priceTrimmed);
  const canSave = d.overall != null && priceOk;

  function toggleOccasion(key: Occasion, on: boolean) {
    patch({ occasions: on ? [...d.occasions, key] : d.occasions.filter((k) => k !== key) });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSubmit({ ...d, price: priceTrimmed, status: 'complete' });
      }}
      className="space-y-4 px-6 pb-10"
    >
      <StarRating label="Overall" value={d.overall} onChange={(v) => patch({ overall: v })} />
      <StarRating label="Taste" value={d.taste} onChange={(v) => patch({ taste: v })} />
      <StarRating label="Sweetness" value={d.sweetness} onChange={(v) => patch({ sweetness: v })} />
      <StarRating label="Texture" value={d.texture} onChange={(v) => patch({ texture: v })} />

      <Chips label="Serve" options={TEMPERATURES} value={d.temperature} onChange={(v) => patch({ temperature: v })} />
      <Chips label="Milk" options={MILKS} value={d.milk} onChange={(v) => patch({ milk: v })} />
      <Chips label="Style" options={DRINK_STYLES} value={d.drink_style} onChange={(v) => patch({ drink_style: v })} />
      <Chips label="Size" options={SIZES} value={d.size} onChange={(v) => patch({ size: v })} />

      <label className="block">
        <span className="text-sm text-ink/70">Price (AUD)</span>
        <input
          inputMode="decimal"
          aria-label="Price"
          value={d.price}
          onChange={(e) => patch({ price: e.target.value })}
          placeholder="6.50"
          className="mt-1 w-full rounded-xl border border-sand bg-white p-3"
        />
      </label>
      {d.price.trim() !== '' && !priceOk && (
        <p className="text-xs text-ink/60">Enter a price like 6.50</p>
      )}

      <fieldset>
        <legend className="text-sm text-ink/70">Occasion</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {OCCASIONS.map((o) => (
            <label key={o.key} className="flex items-center gap-2 rounded-xl bg-sand/60 p-3 text-sm text-sand-ink">
              <input
                type="checkbox"
                checked={d.occasions.includes(o.key)}
                onChange={(e) => toggleOccasion(o.key, e.target.checked)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <textarea
        value={d.note}
        onChange={(e) => patch({ note: e.target.value })}
        placeholder="A note (optional)"
        rows={2}
        className="w-full rounded-xl border border-sand bg-white p-3"
      />

      <button
        type="submit"
        disabled={!canSave}
        className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream disabled:opacity-40"
      >
        {submitLabel}
      </button>
      {draftLabel !== null && (
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSubmit({ ...d, price: priceTrimmed, status: 'draft' })}
          className="w-full rounded-xl border border-matcha-deep p-3 text-matcha-deep disabled:opacity-40"
        >
          {draftLabel}
        </button>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel} className="w-full p-2 text-ink/60 underline">
          Cancel
        </button>
      )}
    </form>
  );
}
