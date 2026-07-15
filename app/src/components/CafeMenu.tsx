import { useEffect, useRef, useState } from 'react';
import { fetchMenuPhotos, addMenuPhoto, deleteMenuPhoto, type MenuPhoto } from '../lib/menu';
import SignedImage from './SignedImage';

interface Props {
  cafeId: string;
  cafeName: string;
}

// The cafe's shared menu photos: thumbnail row + add controls + full-screen
// viewer with remove. Any signed-in reviewer can add or remove (menus are
// shared facts about a cafe, and menu_photos RLS is authenticated-full-access).
// No horizontal padding of its own — the parent section provides px-6.
export default function CafeMenu({ cafeId, cafeName }: Props) {
  const [photos, setPhotos] = useState<MenuPhoto[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addFailed, setAddFailed] = useState(false);
  const [viewing, setViewing] = useState<MenuPhoto | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [removeArmed, setRemoveArmed] = useState(false);
  // Removal state is scoped to the photo id: the viewer can be closed and
  // reopened on a different photo while a slow delete is still in flight,
  // and that other photo's viewer must not inherit "Removing…"/failure state.
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeFailedId, setRemoveFailedId] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhotos(null);
    setLoadFailed(false);
    fetchMenuPhotos(cafeId)
      .then((p) => { if (!cancelled) setPhotos(p); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [cafeId]);

  // Same iOS quirk as ConfirmDelete: blur is unreliable, so an armed remove
  // button also disarms itself after a few seconds.
  useEffect(() => {
    if (!removeArmed) return;
    const t = setTimeout(() => setRemoveArmed(false), 5000);
    return () => clearTimeout(t);
  }, [removeArmed]);

  // Escape closes the viewer while it's open.
  useEffect(() => {
    if (!viewing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewing]);

  // Return focus to whatever opened the viewer once it closes — covers both
  // closeViewer and the functional close in onRemove's success path.
  useEffect(() => {
    if (viewing) return;
    const el = returnFocusRef.current;
    if (el) {
      returnFocusRef.current = null;
      el.focus();
    }
  }, [viewing]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    setAdding(true);
    setAddFailed(false);
    try {
      const added = await addMenuPhoto(cafeId, file);
      setPhotos((ps) => [...(ps ?? []), added]);
    } catch {
      setAddFailed(true);
    } finally {
      setAdding(false);
    }
  }

  function openViewer(p: MenuPhoto) {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setViewing(p);
    setZoomed(false);
    setRemoveArmed(false);
    setRemoveFailedId(null);
  }

  function closeViewer() {
    setViewing(null);
    setZoomed(false);
    setRemoveArmed(false);
    setRemoveFailedId(null);
  }

  async function onRemove() {
    if (!viewing) return;
    if (!removeArmed) {
      setRemoveArmed(true);
      return;
    }
    const target = viewing;
    setRemovingId(target.id);
    setRemoveFailedId(null);
    try {
      await deleteMenuPhoto(target);
      setPhotos((ps) => (ps ?? []).filter((p) => p.id !== target.id));
      // Close only if the viewer is still on the deleted photo — the user may
      // have closed it and opened another photo while the delete was in flight.
      setViewing((v) => (v && v.id === target.id ? null : v));
    } catch {
      setRemoveFailedId(target.id);
      setRemoveArmed(false);
    } finally {
      setRemovingId((id) => (id === target.id ? null : id));
    }
  }

  if (loadFailed) {
    return <p className="pt-4 text-sm text-ink/60">Couldn't load the menu — check your connection.</p>;
  }
  if (photos === null) return null; // quiet while loading — the section just appears

  return (
    <div className="pt-2">
      <h3 className="font-display text-lg">Menu</h3>

      {photos.length === 0 ? (
        <p className="pt-1 text-sm text-ink/60">No menu photos yet — add one below.</p>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openViewer(p)}
              aria-label={`Menu photo ${i + 1} of ${photos.length} — ${cafeName}`}
              className="shrink-0"
            >
              <SignedImage path={p.photo_path} alt="" className="h-28 w-24 rounded-xl object-cover" />
            </button>
          ))}
        </div>
      )}

      {adding ? (
        <p role="status" className="pt-3 text-sm text-ink/60">Adding…</p>
      ) : (
        <div className="flex items-center gap-4 pt-3">
          <label className="cursor-pointer rounded-xl bg-matcha-deep px-4 py-2 text-sm text-cream">
            Take a photo
            <input type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
          </label>
          <label className="cursor-pointer text-sm underline">
            Choose from library
            <input type="file" accept="image/*" onChange={onPick} className="hidden" />
          </label>
        </div>
      )}
      {addFailed && (
        <p className="pt-2 text-sm text-red-700">Couldn't add the photo. Check your connection and try again.</p>
      )}

      {viewing && (
        <div role="dialog" aria-modal="true" aria-label={`Menu photo — ${cafeName}`} className="fixed inset-0 z-50 flex flex-col bg-ink/95">
          <div className="flex justify-end p-3">
            <button
              type="button"
              autoFocus
              onClick={closeViewer}
              aria-label="Close menu photo"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-cream/20 text-lg leading-none text-cream"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <button
              type="button"
              onClick={() => setZoomed(!zoomed)}
              aria-label="Zoom menu photo"
              aria-pressed={zoomed}
              className="block min-h-full min-w-full text-left"
            >
              <SignedImage
                path={viewing.photo_path}
                alt={`Menu — ${cafeName}`}
                className={zoomed ? 'max-w-none' : 'w-full'}
              />
            </button>
          </div>
          <div className="p-4">
            {removingId === viewing.id ? (
              <p role="status" className="text-center text-cream/80">Removing…</p>
            ) : (
              <button
                type="button"
                aria-live="polite"
                onClick={onRemove}
                onBlur={() => setRemoveArmed(false)}
                className={`w-full rounded-xl border border-red-400 p-3 ${
                  removeArmed ? 'bg-red-700 text-cream' : 'text-red-300'
                }`}
              >
                {removeArmed ? "Tap again to confirm — this can't be undone" : 'Remove this photo'}
              </button>
            )}
            {removeFailedId === viewing.id && (
              <p className="pt-2 text-center text-sm text-red-300">Couldn't remove. Check your connection and try again.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
