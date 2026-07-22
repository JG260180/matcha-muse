import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CafePicker, { type CafeChoice } from '../components/CafePicker';
import ReviewForm, { type ReviewDraft, type ReviewFormHandle } from '../components/ReviewForm';
import BackToJournal from '../components/BackToJournal';
import PhotoAdjust from '../components/PhotoAdjust';
import SaveBeforeLeaving from '../components/SaveBeforeLeaving';
import CafeMenu from '../components/CafeMenu';
import { useLeaveGuard } from '../lib/leaveGuard';
import { saveReviewOrQueue, downscalePhoto, ensureCafe } from '../lib/api';
import { writeReviewUrl } from '../lib/googleLinks';

export default function NewReview() {
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<Blob | null>(null);
  // The as-picked photo (downscaled), kept so repeated Adjusts re-crop the
  // original instead of compounding crops.
  const [original, setOriginal] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [choice, setChoice] = useState<CafeChoice | null>(null);
  // Cafe row created eagerly for Google-picked cafes, so menu photos can be
  // added while the matcha is still being logged (owner request 2026-07-22).
  const [menuCafeId, setMenuCafeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);
  // Post-save Google prompt (owner request 2026-07-22): saving used to jump
  // straight to the journal, so the Google-review option was never seen.
  const [savedGoogle, setSavedGoogle] = useState<{ placeId: string; note: string } | null>(null);
  const [noteCopied, setNoteCopied] = useState(false);
  const [error, setError] = useState(false);
  const [needCafe, setNeedCafe] = useState(false);
  // Leave-guard (owner request 2026-07-17): navigating away mid-review opens
  // the save/draft/discard dialog instead.
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const formRef = useRef<ReviewFormHandle | null>(null);
  const navAfterSave = useRef('/');

  const dirty = (choice != null || photo != null) && !queued && !saving;
  useLeaveGuard(dirty ? (to) => { setLeaveTo(to); return true; } : null);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    // Reset so picking the same file again after removing still fires onChange.
    e.target.value = '';
    if (!file) return;
    // Shrink BEFORE anything renders or adjusts it: a full-resolution phone
    // photo (12–48MP) held decoded by the preview and PhotoAdjust is enough to
    // crash the mobile tab outright (white screen, page dead until reload).
    // Saved photos never hit this because they're stored at ≤1600px — only
    // freshly picked files did. downscalePhoto never throws.
    setPreparing(true);
    const small = await downscalePhoto(file);
    setPhoto(small);
    setOriginal(small);
    setPhotoUrl(URL.createObjectURL(small));
    setPreparing(false);
  }

  function removePhoto() {
    setPhoto(null);
    setOriginal(null);
    setAdjusting(false);
    setPhotoUrl(null);
  }

  // Revoke the object URL when it changes or on unmount so blobs aren't leaked.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // Menu photos need a cafe row, so Google-picked cafes are created eagerly
  // (ensureCafe dedupes on google_place_id — saving later reuses the same
  // row). Manual cafes stay save-time-only to avoid duplicate rows; their
  // menu section appears once the matcha is saved, as before. Best-effort:
  // offline or failed lookup just means no menu section while logging.
  useEffect(() => {
    setMenuCafeId(null);
    if (!choice || choice.kind !== 'candidate') return;
    let cancelled = false;
    ensureCafe(choice)
      .then((id) => {
        if (!cancelled && id) setMenuCafeId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [choice]);

  async function onSubmit(draft: ReviewDraft) {
    if (!choice) return;
    // Publishing needs a real cafe; skipped-cafe reviews stay drafts.
    if (draft.status === 'complete' && choice.kind === 'none') {
      setNeedCafe(true);
      return;
    }
    setNeedCafe(false);
    setSaving(true);
    try {
      const result = await saveReviewOrQueue(choice, draft, photo);
      if (result === 'queued') setQueued(true);
      else if (draft.status === 'complete' && choice.kind === 'candidate') {
        // Published at a Google-known cafe: offer the Google review NOW,
        // instead of hiding the link inside the saved matcha card.
        setSavedGoogle({ placeId: choice.candidate.placeId, note: draft.note });
      } else navigate(navAfterSave.current);
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  if (savedGoogle) {
    return (
      <div className="px-6 py-10">
        <h2 className="font-display text-xl">Matcha saved</h2>
        <p className="mt-2 text-ink/70">Want to share it as a Google review while it's fresh?</p>
        {/* Same copy-then-open pattern as the matcha card: clipboard write
            stays inside the tap gesture, target=_blank keeps the page alive. */}
        <a
          href={writeReviewUrl(savedGoogle.placeId)}
          target="_blank"
          rel="noreferrer"
          onClick={async () => {
            if (!savedGoogle.note) return;
            try {
              await navigator.clipboard.writeText(savedGoogle.note);
              setNoteCopied(true);
            } catch {
              // Clipboard can fail (permissions); the link still opens.
            }
          }}
          className="mt-6 block rounded-xl bg-matcha-deep p-4 text-center font-medium text-cream"
        >
          Copy review to Google ↗
        </a>
        {noteCopied && (
          <p role="status" className="mt-3 rounded-xl bg-matcha-mist p-3 text-xs text-matcha-deep">
            Your note is copied — paste it into the Google review.
          </p>
        )}
        <button
          type="button"
          onClick={() => navigate(navAfterSave.current)}
          className="mt-3 block w-full p-3 text-center text-ink/70 underline"
        >
          Done
        </button>
      </div>
    );
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
            <button
              type="button"
              onClick={() => setAdjusting(true)}
              className="absolute bottom-3 right-3 rounded-full bg-ink/60 px-3 py-1.5 text-sm text-cream backdrop-blur"
            >
              Adjust
            </button>
          </div>
        ) : (
          <div className="flex h-56 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-matcha-mist text-matcha-deep">
            {preparing ? (
              <p role="status" className="text-sm">Preparing photo…</p>
            ) : (
              <>
                <span className="px-6 text-center text-sm">Add a photo of your matcha — needed to publish, drafts can skip it</span>
                <label className="cursor-pointer rounded-xl bg-matcha-deep px-5 py-2.5 text-cream">
                  Take a photo
                  <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
                </label>
                <label className="cursor-pointer text-sm underline">
                  Choose from library
                  <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
                </label>
              </>
            )}
          </div>
        )}
      </div>

      {adjusting && (original ?? photo) && (
        <PhotoAdjust
          photo={(original ?? photo)!}
          onDone={(cropped) => {
            setPhoto(cropped);
            setPhotoUrl(URL.createObjectURL(cropped));
            setAdjusting(false);
          }}
          onCancel={() => setAdjusting(false)}
        />
      )}

      {!choice ? (
        <CafePicker onSelect={setChoice} onSkip={() => setChoice({ kind: 'none' })} />
      ) : (
        <>
          <p className="px-6 pb-2 text-sm text-ink/60">
            {choice.kind === 'candidate'
              ? choice.candidate.name
              : choice.kind === 'manual'
                ? choice.name
                : 'No cafe yet — add it when you finish the draft'}
            {' · '}
            <button type="button" onClick={() => { setChoice(null); setNeedCafe(false); }} className="underline">
              {choice.kind === 'none' ? 'pick the cafe' : 'change cafe'}
            </button>
          </p>
          {saving ? (
            <p className="px-6 text-ink/60">Saving…</p>
          ) : (
            <ReviewForm onSubmit={onSubmit} controlRef={formRef} hasPhoto={photo != null} />
          )}
          {needCafe && (
            <p className="px-6 pt-2 text-sm text-red-700">Add the cafe before publishing — or save it as a draft.</p>
          )}
          {error && <p className="px-6 pt-2 text-sm text-red-700">Couldn't save. Check your connection and try again.</p>}
          {/* Menu photos while logging (owner request 2026-07-22) — needs the
              eagerly created cafe row, so Google-picked cafes only. */}
          {menuCafeId != null && choice.kind === 'candidate' && !saving && (
            <div className="px-6 pt-4">
              <CafeMenu cafeId={menuCafeId} cafeName={choice.candidate.name} />
            </div>
          )}
        </>
      )}

      {leaveTo != null && (
        <SaveBeforeLeaving
          canSave={(formRef.current?.canSave ?? false) && choice != null && choice.kind !== 'none'}
          canDraft={(formRef.current?.canDraft ?? false) && choice != null}
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
          onDiscard={() => navigate(leaveTo)}
          onStay={() => setLeaveTo(null)}
          discardLabel="Don't save"
        />
      )}
    </div>
  );
}
