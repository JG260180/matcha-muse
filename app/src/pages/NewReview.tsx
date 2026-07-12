import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CafePicker, { type CafeChoice } from '../components/CafePicker';
import ReviewForm, { type ReviewDraft } from '../components/ReviewForm';
import BackToJournal from '../components/BackToJournal';
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
    if (!file) return;
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    // Reset so picking the same file again after removing still fires onChange.
    e.target.value = '';
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoUrl(null);
  }

  // Revoke the object URL when it changes or on unmount so blobs aren't leaked.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

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
      <BackToJournal />
      <div className="px-6 pb-4">
        {photoUrl ? (
          <div className="relative">
            <img src={photoUrl} alt="Your matcha" className="h-56 w-full rounded-2xl object-cover" />
            <button
              type="button"
              onClick={removePhoto}
              aria-label="Remove photo"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-lg leading-none text-cream backdrop-blur"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex h-56 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-matcha-mist text-matcha-deep">
            <span className="text-sm">Add a photo of your matcha</span>
            <label className="cursor-pointer rounded-xl bg-matcha-deep px-5 py-2.5 text-cream">
              Take a photo
              <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
            </label>
            <label className="cursor-pointer text-sm underline">
              Choose from library
              <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
            </label>
          </div>
        )}
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
