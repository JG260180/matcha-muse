import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { updateReview, deleteReview, type PhotoAction } from '../lib/api';
import { OCCASIONS, type Review } from '../lib/types';
import ReviewForm, { type ReviewDraft } from '../components/ReviewForm';
import SignedImage from '../components/SignedImage';
import ConfirmDelete from '../components/ConfirmDelete';

function toDraft(r: Review): ReviewDraft {
  const num = (x: number | null) => (x == null ? null : Number(x));
  return {
    overall: Number(r.overall),
    taste: num(r.taste), sweetness: num(r.sweetness), texture: num(r.texture),
    temperature: r.temperature, milk: r.milk, drink_style: r.drink_style, size: r.size,
    price: r.price == null ? '' : String(Number(r.price)),
    occasions: r.occasions ?? [], note: r.note ?? '', status: r.status,
  };
}

function Rating({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <p className="text-sm">
      {label}: {Number(value).toFixed(1)} ★
    </p>
  );
}

export default function ReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState<Review | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [photoAction, setPhotoAction] = useState<PhotoAction>({ kind: 'keep' });
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    supabase
      .from('reviews')
      .select('*, cafe:cafes(*)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setLoadFailed(true); return; }
        const r = data as Review;
        setReview(r);
        setEditing(r.status === 'draft'); // drafts open straight into edit mode
      });
  }, [id]);

  useEffect(() => {
    return () => {
      if (newPhotoUrl) URL.revokeObjectURL(newPhotoUrl);
    };
  }, [newPhotoUrl]);

  if (loadFailed) {
    return <p className="px-6 py-10 text-center text-ink/60">Couldn't load this matcha — check your connection and try again.</p>;
  }
  if (!review) return <p className="px-6 text-ink/60">Brewing…</p>;

  const isDraft = review.status === 'draft';

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPhotoAction({ kind: 'replace', blob: file });
    setNewPhotoUrl(URL.createObjectURL(file));
    e.target.value = '';
  }

  function removePhoto() {
    setPhotoAction({ kind: 'remove' });
    setNewPhotoUrl(null);
  }

  function resetEdit() {
    setPhotoAction({ kind: 'keep' });
    setNewPhotoUrl(null);
    setFailed(false);
  }

  async function onSave(draft: ReviewDraft) {
    if (!review) return;
    setBusy(true);
    setFailed(false);
    try {
      const newPath = await updateReview(review, draft, photoAction);
      setReview({
        ...review,
        photo_path: newPath,
        overall: draft.overall ?? review.overall,
        taste: draft.taste, sweetness: draft.sweetness, texture: draft.texture,
        temperature: draft.temperature, milk: draft.milk,
        drink_style: draft.drink_style, size: draft.size,
        price: Number(draft.price), occasions: draft.occasions,
        note: draft.note || null, status: draft.status,
      });
      setEditing(false);
      resetEdit();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function onCancel() {
    resetEdit();
    if (isDraft) navigate('/');
    else setEditing(false);
  }

  async function onDelete() {
    if (!review) return;
    setBusy(true);
    setFailed(false);
    try {
      await deleteReview(review);
      navigate('/');
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="pb-10 pt-2">
      <div className="px-6 pb-4">
        {editing ? (
          photoAction.kind === 'keep' && review.photo_path ? (
            <div className="relative">
              <SignedImage path={review.photo_path} alt={review.cafe?.name ?? 'Matcha'} className="h-56 w-full rounded-2xl object-cover" />
              <button
                type="button" onClick={removePhoto} aria-label="Remove photo"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-lg leading-none text-cream backdrop-blur"
              >
                ✕
              </button>
            </div>
          ) : photoAction.kind === 'replace' && newPhotoUrl ? (
            <div className="relative">
              <img src={newPhotoUrl} alt="New matcha photo" className="h-56 w-full rounded-2xl object-cover" />
              <button
                type="button" onClick={removePhoto} aria-label="Remove photo"
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
                <input type="file" accept="image/*" capture="environment" onChange={onPickPhoto} className="hidden" />
              </label>
              <label className="cursor-pointer text-sm underline">
                Choose from library
                <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
              </label>
            </div>
          )
        ) : (
          <SignedImage path={review.photo_path} alt={review.cafe?.name ?? 'Matcha'} className="h-56 w-full rounded-2xl object-cover" />
        )}
      </div>

      <div className="px-6 pb-2">
        <h2 className="font-display text-xl">{review.cafe?.name ?? 'Unknown cafe'}</h2>
        <p className="text-sm text-ink/60">
          {new Date(review.drank_at).toLocaleDateString()}
          {isDraft ? ' · Draft' : ''}
        </p>
      </div>

      {editing ? (
        <>
          {busy ? (
            <p className="px-6 text-ink/60">Saving…</p>
          ) : (
            <ReviewForm
              onSubmit={onSave}
              initial={toDraft(review)}
              submitLabel="Save changes"
              draftLabel={isDraft ? 'Keep as draft' : null}
              onCancel={onCancel}
            />
          )}
          {failed && <p className="px-6 pt-2 text-sm text-red-700">Couldn't save. Check your connection and try again.</p>}
        </>
      ) : (
        <div className="space-y-4 px-6">
          <div className="space-y-1">
            <Rating label="Overall" value={review.overall} />
            <Rating label="Taste" value={review.taste} />
            <Rating label="Sweetness" value={review.sweetness} />
            <Rating label="Texture" value={review.texture} />
          </div>
          <p className="text-sm text-ink/60">
            {[review.milk, review.temperature, review.drink_style, review.size].filter(Boolean).join(' · ') || 'No details recorded'}
          </p>
          <p className="text-sm">${Number(review.price).toFixed(2)}</p>
          {review.occasions.length > 0 && (
            <p className="text-sm text-ink/60">
              {OCCASIONS.filter((o) => review.occasions.includes(o.key)).map((o) => o.label).join(' · ')}
            </p>
          )}
          {review.note && <p className="rounded-xl bg-sand/50 p-3 text-sm">{review.note}</p>}

          <button
            type="button"
            onClick={() => { resetEdit(); setEditing(true); }}
            className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream"
          >
            Edit
          </button>
          {busy ? <p className="text-center text-ink/60">Deleting…</p> : <ConfirmDelete onDelete={onDelete} />}
          {failed && <p className="pt-2 text-sm text-red-700">Couldn't delete. Check your connection and try again.</p>}
        </div>
      )}
    </div>
  );
}
