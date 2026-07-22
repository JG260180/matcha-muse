import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { updateReview, deleteReview, replaceReviewPhoto, downscalePhoto, type PhotoAction } from '../lib/api';
import { OCCASIONS, type Review } from '../lib/types';
import ReviewForm, { type ReviewDraft, type ReviewFormHandle } from '../components/ReviewForm';
import CafePicker, { type CafeChoice } from '../components/CafePicker';
import SaveBeforeLeaving from '../components/SaveBeforeLeaving';
import { useLeaveGuard } from '../lib/leaveGuard';
import PhotoAdjust from '../components/PhotoAdjust';
import SignedImage from '../components/SignedImage';
import ConfirmDelete from '../components/ConfirmDelete';
import BackToJournal from '../components/BackToJournal';
import CafeMenu from '../components/CafeMenu';
import { localDateString, applyDrankAtDate } from '../lib/drankAt';
import { writeReviewUrl } from '../lib/googleLinks';

function toDraft(r: Review): ReviewDraft {
  const num = (x: number | null) => (x == null ? null : Number(x));
  return {
    overall: Number(r.overall),
    taste: num(r.taste), sweetness: num(r.sweetness), texture: num(r.texture),
    temperature: r.temperature, milk: r.milk, drink_style: r.drink_style, size: r.size,
    price: r.price == null ? '' : String(Number(r.price)),
    occasions: r.occasions ?? [], note: r.note ?? '', status: r.status,
    drankAtDate: localDateString(r.drank_at),
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
  const [ownId, setOwnId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [photoAction, setPhotoAction] = useState<PhotoAction>({ kind: 'keep' });
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Distinguishes delete from save so edit mode's busy/error copy is honest.
  const [deleting, setDeleting] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<ReviewDraft | null>(null);
  // Crop/position (2026-07-17): the blob open in the PhotoAdjust dialog, the
  // as-picked/as-downloaded original (so repeat Adjusts don't compound crops),
  // and the existing-photo download state.
  const [adjustSrc, setAdjustSrc] = useState<Blob | null>(null);
  const [pickedOriginal, setPickedOriginal] = useState<Blob | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustFailed, setAdjustFailed] = useState(false);
  // Adjusting an already-saved photo commits on "Use photo"; when that save
  // fails, the crop is kept as a pending change and this explains why.
  const [photoSaveFailed, setPhotoSaveFailed] = useState(false);
  // Cafe-less drafts (2026-07-17): the cafe picked during this edit session,
  // applied on save; publishing without one is blocked with needCafe.
  const [pendingCafe, setPendingCafe] = useState<CafeChoice | null>(null);
  const [needCafe, setNeedCafe] = useState(false);
  // Leave-guard (2026-07-17): navigating away from a draft edit opens the
  // save/draft/delete dialog instead.
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  // Google-review copy confirmation (owner request 2026-07-17 follow-up:
  // the Review-on-Google path must also exist inside the matcha card).
  const [noteCopied, setNoteCopied] = useState(false);
  const formRef = useRef<ReviewFormHandle | null>(null);
  const navAfterSave = useRef<string | null>(null);

  const guardActive = review != null && editing && review.status === 'draft' && !busy;
  useLeaveGuard(guardActive ? (to) => { setLeaveTo(to); return true; } : null);

  useEffect(() => {
    // Router reuses this component across /review/:id navigations, so clear
    // any edit-session state from a previous review before loading the next.
    setReview(null);
    setOwnId(null);
    setLoadFailed(false);
    setPhotoAction({ kind: 'keep' });
    setNewPhotoUrl(null);
    setBusy(false);
    setFailed(false);
    setDeleting(false);
    setPendingDraft(null);
    setAdjustSrc(null);
    setPickedOriginal(null);
    setPreparingPhoto(false);
    setAdjustLoading(false);
    setAdjustFailed(false);
    setPhotoSaveFailed(false);
    setPendingCafe(null);
    setNeedCafe(false);
    setLeaveTo(null);
    setNoteCopied(false);
    navAfterSave.current = null;
    Promise.all([
      supabase.from('reviews').select('*, cafe:cafes(*)').eq('id', id).maybeSingle(),
      supabase.auth.getUser(),
    ]).then(([res, u]) => {
      if (res.error || !res.data) { setLoadFailed(true); return; }
      const r = res.data as Review;
      setReview(r);
      setOwnId(u.data.user?.id ?? null);
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
  const isOwner = ownId != null && review.user_id === ownId;
  // Publishing requires a photo (owner rule 2026-07-17); "remove" drops it.
  const editHasPhoto =
    photoAction.kind === 'replace' || (photoAction.kind === 'keep' && review.photo_path != null);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    // Shrink BEFORE anything renders or adjusts it — a full-resolution phone
    // photo held decoded by the preview/PhotoAdjust crashes the mobile tab
    // (white screen). Same fix as NewReview; downscalePhoto never throws.
    setPreparingPhoto(true);
    const small = await downscalePhoto(file);
    setPhotoAction({ kind: 'replace', blob: small });
    setPickedOriginal(small);
    setNewPhotoUrl(URL.createObjectURL(small));
    setPreparingPhoto(false);
  }

  function removePhoto() {
    setPhotoAction({ kind: 'remove' });
    setPickedOriginal(null);
    setNewPhotoUrl(null);
  }

  function resetEdit() {
    setPhotoAction({ kind: 'keep' });
    setNewPhotoUrl(null);
    setFailed(false);
    setAdjustSrc(null);
    setPickedOriginal(null);
    setPreparingPhoto(false);
    setAdjustLoading(false);
    setAdjustFailed(false);
    setPhotoSaveFailed(false);
    setPendingCafe(null);
    setNeedCafe(false);
  }

  // Adjusting the saved photo needs its pixels — download once, then reuse.
  async function adjustExistingPhoto() {
    if (!review?.photo_path || adjustLoading) return;
    if (pickedOriginal) {
      // Already downloaded this edit session (e.g. a cancelled Adjust) —
      // reuse it instead of paying the network round-trip again.
      setAdjustSrc(pickedOriginal);
      return;
    }
    setAdjustLoading(true);
    setAdjustFailed(false);
    try {
      const { data, error } = await supabase.storage.from('photos').download(review.photo_path);
      if (error || !data) throw error ?? new Error('no data');
      setPickedOriginal(data);
      setAdjustSrc(data);
    } catch {
      setAdjustFailed(true);
    } finally {
      setAdjustLoading(false);
    }
  }

  async function onSave(draft: ReviewDraft) {
    setPendingDraft(draft);
    if (!review) return;
    // Publishing needs a real cafe; cafe-less drafts must gain one first.
    if (draft.status === 'complete' && !review.cafe_id && !pendingCafe) {
      setNeedCafe(true);
      navAfterSave.current = null;
      return;
    }
    setNeedCafe(false);
    setBusy(true);
    setFailed(false);
    setDeleting(false);
    try {
      const newPath = await updateReview(review, draft, photoAction, pendingCafe ?? undefined);
      setReview({
        ...review,
        photo_path: newPath,
        drank_at: applyDrankAtDate(review.drank_at, draft.drankAtDate),
        // overall is guaranteed non-null by ReviewForm's canSave gate; the
        // fallback only satisfies the Review type.
        overall: draft.overall ?? review.overall,
        taste: draft.taste, sweetness: draft.sweetness, texture: draft.texture,
        temperature: draft.temperature, milk: draft.milk,
        drink_style: draft.drink_style, size: draft.size,
        price: draft.price.trim() === '' ? null : Number(draft.price),
        occasions: draft.occasions,
        note: draft.note || null, status: draft.status,
      });
      if (pendingCafe) {
        // The edit gained a cafe — refetch for the joined cafe row (name,
        // links, menu). Best-effort: the local update above already holds.
        const { data } = await supabase
          .from('reviews').select('*, cafe:cafes(*)').eq('id', review.id).maybeSingle();
        if (data) setReview(data as Review);
      }
      setEditing(false);
      resetEdit();
      setPendingDraft(null);
      const dest = navAfterSave.current;
      navAfterSave.current = null;
      if (dest) navigate(dest);
    } catch {
      setFailed(true);
      navAfterSave.current = null;
    } finally {
      setBusy(false);
    }
  }

  function onCancel() {
    resetEdit();
    setPendingDraft(null);
    if (isDraft) navigate('/');
    else setEditing(false);
  }

  async function onDelete(dest = '/') {
    if (!review) return;
    setBusy(true);
    setFailed(false);
    setDeleting(true);
    try {
      await deleteReview(review);
      navigate(dest);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="pb-10 pt-2">
      <BackToJournal />
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
              <button
                type="button" onClick={adjustExistingPhoto}
                className="absolute bottom-3 right-3 rounded-full bg-ink/60 px-3 py-1.5 text-sm text-cream backdrop-blur"
              >
                {adjustLoading ? 'Loading…' : 'Adjust'}
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
              <button
                type="button"
                onClick={() => setAdjustSrc(pickedOriginal ?? photoAction.blob)}
                className="absolute bottom-3 right-3 rounded-full bg-ink/60 px-3 py-1.5 text-sm text-cream backdrop-blur"
              >
                Adjust
              </button>
            </div>
          ) : (
            <div className="flex h-56 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-matcha-mist text-matcha-deep">
              {preparingPhoto ? (
                <p role="status" className="text-sm">Preparing photo…</p>
              ) : (
                <>
                  <span className="px-6 text-center text-sm">Add a photo of your matcha — needed to publish, drafts can skip it</span>
                  <label className="cursor-pointer rounded-xl bg-matcha-deep px-5 py-2.5 text-cream">
                    Take a photo
                    <input type="file" accept="image/*" capture="environment" onChange={onPickPhoto} className="hidden" />
                  </label>
                  <label className="cursor-pointer text-sm underline">
                    Choose from library
                    <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
                  </label>
                </>
              )}
            </div>
          )
        ) : (
          <SignedImage path={review.photo_path} alt={review.cafe?.name ?? 'Matcha'} className="h-56 w-full rounded-2xl object-cover" />
        )}
        {editing && adjustFailed && (
          <p className="pt-2 text-sm text-red-700">Couldn't load the photo to adjust. Check your connection and try again.</p>
        )}
        {editing && photoSaveFailed && (
          <p className="pt-2 text-sm text-red-700">Couldn't save the adjusted photo — it's kept here. Check your connection, then tap Save changes.</p>
        )}
      </div>

      {adjustSrc && (
        <PhotoAdjust
          photo={adjustSrc}
          onDone={async (cropped) => {
            // Adjusting the photo already on the card: "Use photo" IS the
            // save (owner feedback 2026-07-17 follow-up) — no second "Save
            // changes" tap. The dialog stays up (its busy state) until the
            // upload lands. Other in-progress form edits stay pending.
            if (photoAction.kind === 'keep' && review.photo_path) {
              setPhotoSaveFailed(false);
              try {
                const newPath = await replaceReviewPhoto(review, cropped);
                setReview({ ...review, photo_path: newPath });
              } catch {
                // Never lose the crop: keep it as a pending replace that
                // "Save changes" will commit, and say why.
                setPhotoAction({ kind: 'replace', blob: cropped });
                setNewPhotoUrl(URL.createObjectURL(cropped));
                setPhotoSaveFailed(true);
              } finally {
                setAdjustSrc(null);
              }
              return;
            }
            // A newly picked photo isn't uploaded yet — the whole replacement
            // saves together on "Save changes", as before.
            setPhotoAction({ kind: 'replace', blob: cropped });
            setNewPhotoUrl(URL.createObjectURL(cropped));
            setAdjustSrc(null);
          }}
          onCancel={() => setAdjustSrc(null)}
        />
      )}

      <div className="px-6 pb-2">
        <h2 className="font-display text-xl">
          {review.cafe?.name ?? (isDraft ? 'No cafe yet' : 'Unknown cafe')}
        </h2>
        <p className="text-sm text-ink/60">
          {new Date(review.drank_at).toLocaleDateString()}
          {isDraft ? ' · Draft' : ''}
        </p>
      </div>

      {editing ? (
        <>
          {/* Cafe-less draft: pick the cafe here; it's applied on save. */}
          {!review.cafe && !busy && (
            pendingCafe && pendingCafe.kind !== 'none' ? (
              <p className="px-6 pb-2 text-sm text-ink/60">
                {pendingCafe.kind === 'candidate' ? pendingCafe.candidate.name : pendingCafe.name}
                {' · '}
                <button type="button" onClick={() => setPendingCafe(null)} className="underline">change cafe</button>
              </p>
            ) : (
              <div className="pb-2">
                <CafePicker onSelect={setPendingCafe} />
              </div>
            )
          )}
          {busy ? (
            <p className="px-6 text-ink/60">{deleting ? 'Deleting…' : 'Saving…'}</p>
          ) : (
            <ReviewForm
              onSubmit={onSave}
              controlRef={formRef}
              hasPhoto={editHasPhoto}
              initial={pendingDraft ?? toDraft(review)}
              submitLabel="Save changes"
              draftLabel={isDraft ? 'Keep as draft' : null}
              onCancel={onCancel}
            />
          )}
          {needCafe && (
            <p className="px-6 pt-2 text-sm text-red-700">Add the cafe before publishing — or keep it as a draft.</p>
          )}
          {failed && (
            <p className="px-6 pt-2 text-sm text-red-700">
              {deleting ? "Couldn't delete." : "Couldn't save."} Check your connection and try again.
            </p>
          )}
          {/* 2026-07-17: menu photos and draft delete no longer require publishing */}
          {review.cafe && (
            <div className="px-6 pt-2">
              <CafeMenu cafeId={review.cafe.id} cafeName={review.cafe.name} />
            </div>
          )}
          {isDraft && isOwner && !busy && (
            <div className="px-6 pt-4">
              <ConfirmDelete onDelete={onDelete} />
            </div>
          )}
          {leaveTo != null && (
            <SaveBeforeLeaving
              canSave={(formRef.current?.canSave ?? false) && (review.cafe_id != null || (pendingCafe != null && pendingCafe.kind !== 'none'))}
              canDraft={formRef.current?.canDraft ?? false}
              onSave={() => {
                navAfterSave.current = leaveTo;
                setLeaveTo(null);
                formRef.current?.requestSubmit('complete');
              }}
              onDraft={() => {
                navAfterSave.current = leaveTo;
                setLeaveTo(null);
                formRef.current?.requestSubmit('draft');
              }}
              onDiscard={() => {
                const to = leaveTo;
                setLeaveTo(null);
                void onDelete(to);
              }}
              onStay={() => setLeaveTo(null)}
              discardLabel="Delete this matcha"
            />
          )}
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
          {review.price != null && <p className="text-sm">${Number(review.price).toFixed(2)}</p>}
          {review.occasions.length > 0 && (
            <p className="text-sm text-ink/60">
              {OCCASIONS.filter((o) => review.occasions.includes(o.key)).map((o) => o.label).join(' · ')}
            </p>
          )}
          {review.note && <p className="rounded-xl bg-sand/50 p-3 text-sm">{review.note}</p>}

          {/* Only the review's own author sees this — pushing someone else's
              words into your Google review would be wrong. Same copy-then-open
              pattern as Near me: clipboard write stays inside the tap gesture,
              target=_blank keeps the pending promise alive. */}
          {isOwner && review.cafe?.google_place_id && (
            <div>
              <a
                href={writeReviewUrl(review.cafe.google_place_id)}
                target="_blank"
                rel="noreferrer"
                onClick={async () => {
                  if (!review.note) return;
                  try {
                    await navigator.clipboard.writeText(review.note);
                    setNoteCopied(true);
                  } catch {
                    // Clipboard can fail (permissions); the link still opens.
                  }
                }}
                className="text-sm text-matcha-deep underline"
              >
                Copy review to Google ↗
              </a>
              {noteCopied && (
                <p role="status" className="mt-2 rounded-xl bg-matcha-mist p-3 text-xs text-matcha-deep">
                  Your note is copied — paste it into the Google review.
                </p>
              )}
            </div>
          )}

          {review.cafe && <CafeMenu cafeId={review.cafe.id} cafeName={review.cafe.name} />}

          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => { resetEdit(); setEditing(true); }}
                className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream"
              >
                Edit
              </button>
              {busy ? <p className="text-center text-ink/60">Deleting…</p> : <ConfirmDelete onDelete={onDelete} />}
              {failed && <p className="pt-2 text-sm text-red-700">Couldn't delete. Check your connection and try again.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
