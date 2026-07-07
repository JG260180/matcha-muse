import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CafePicker, { type CafeChoice } from '../components/CafePicker';
import ReviewForm, { type ReviewDraft } from '../components/ReviewForm';
import { saveReviewOrQueue } from '../lib/api';

export default function NewReview() {
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [choice, setChoice] = useState<CafeChoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState(false);

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoUrl(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(draft: ReviewDraft) {
    if (!choice) return;
    setSaving(true);
    try {
      const result = await saveReviewOrQueue(choice, draft, photo);
      if (result === 'queued') setQueued(true);
      else navigate('/');
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  if (queued) {
    return (
      <div className="px-6 py-10">
        <h2 className="font-display text-xl">Saved on your phone</h2>
        <p className="mt-2 text-ink/70">No signal right now — this matcha will sync automatically once you're back online.</p>
        <Link to="/" className="mt-6 block rounded-xl bg-matcha-deep p-4 text-center text-cream">Done</Link>
      </div>
    );
  }

  return (
    <div className="pb-6 pt-2">
      <div className="px-6 pb-4">
        <label className="block">
          {photoUrl ? (
            <img src={photoUrl} alt="Your matcha" className="h-56 w-full rounded-2xl object-cover" />
          ) : (
            <span className="flex h-56 w-full items-center justify-center rounded-2xl bg-matcha-mist text-matcha-deep">
              Tap to photograph your matcha
            </span>
          )}
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
        </label>
      </div>

      {!choice ? (
        <CafePicker onSelect={setChoice} />
      ) : (
        <>
          <p className="px-6 pb-2 text-sm text-ink/60">
            {choice.kind === 'candidate' ? choice.candidate.name : choice.name}
            {' · '}
            <button type="button" onClick={() => setChoice(null)} className="underline">change cafe</button>
          </p>
          {saving ? <p className="px-6 text-ink/60">Saving…</p> : <ReviewForm onSubmit={onSubmit} />}
          {error && <p className="px-6 pt-2 text-sm text-red-700">Couldn't save. Check your connection and try again.</p>}
        </>
      )}
    </div>
  );
}
