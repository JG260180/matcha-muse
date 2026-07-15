# Cafe Menu Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reviewers can attach photos of a cafe's menu to the cafe; the menu appears only inside the review page (`/review/:id`), never on the journal grid or Near me.

**Architecture:** A new `lib/menu.ts` wraps the existing (already-live, never-used) Supabase `menu_photos` table + private `photos` storage bucket under a `menus/` path prefix. A self-contained `CafeMenu` component fetches and renders the cafe's menu photos with add/view/remove flows, and `ReviewDetail` mounts it in view mode when the review has a cafe. No schema, RLS, or storage-policy changes — v1 already shipped them.

**Tech Stack:** Vite + React 19 + TypeScript + Tailwind 3, Supabase JS client, Vitest + Testing Library (jsdom). Repo root `C:\Users\justi\OneDrive\Documents\MatchaMuse`; app code in `app/`. All commands below run from `app/`.

**Spec:** `docs/superpowers/specs/2026-07-15-cafe-menu-photos-design.md`

**Branch:** `feature/cafe-menu`, forked from `feature/shared-journal` (NOT `main` — shared-journal is unmerged and owns the current `ReviewDetail.tsx`). Merge order later: shared-journal first, then this.

## File structure

- Create: `app/src/lib/menu.ts` — data access: fetch/add/delete menu photos (one responsibility: the `menu_photos` table + its storage objects).
- Create: `app/src/lib/menu.test.ts`
- Create: `app/src/components/CafeMenu.tsx` — the whole Menu section UI: thumbnail row, add controls, full-screen viewer with remove. Self-contained (fetches its own data) so `ReviewDetail` only decides *whether* to render it.
- Create: `app/src/components/CafeMenu.test.tsx`
- Modify: `app/src/pages/ReviewDetail.tsx` — one conditional render line + import.
- Modify: `app/src/pages/ReviewDetail.test.tsx` — mock CafeMenu, three presence/absence tests.

Existing code reused, do not modify: `downscalePhoto` (`app/src/lib/api.ts`), `SignedImage` (`app/src/components/SignedImage.tsx`), arm/confirm pattern copied from `ConfirmDelete` (`app/src/components/ConfirmDelete.tsx` — copied, not reused: its label text and full-page styling are review-specific).

---

### Task 0: Branch setup

- [ ] **Step 1: Create the feature branch**

```bash
cd "C:/Users/justi/OneDrive/Documents/MatchaMuse"
git checkout -b feature/cafe-menu feature/shared-journal
```

Expected: `Switched to a new branch 'feature/cafe-menu'`. Verify with `git status` (clean) and `git log --oneline -1` (should show the shared-journal tip, `50aee8e` or later).

- [ ] **Step 2: Confirm the test baseline is green**

```bash
cd app
npx vitest run
```

Expected: all existing tests pass (30+ tests across ~13 files). If not, STOP and report — do not build on a red baseline.

---

### Task 1: `lib/menu.ts` — data access (TDD)

**Files:**
- Create: `app/src/lib/menu.test.ts`
- Create: `app/src/lib/menu.ts`

The `menu_photos` table already exists in Supabase (see `app/supabase/schema.sql`): `id uuid pk, cafe_id uuid not null, photo_path text not null, taken_at timestamptz default now()`, RLS "authenticated full access". Storage: private bucket `photos`, authenticated insert/select/delete. Nothing to migrate.

- [ ] **Step 1: Write the failing tests**

Create `app/src/lib/menu.test.ts`. Note the mock style: `vi.mock` factories are hoisted, so they must *close over* the `vi.fn()` consts and call them lazily at runtime (same pattern as `ReviewDetail.test.tsx`).

```ts
import { fetchMenuPhotos, addMenuPhoto, deleteMenuPhoto, type MenuPhoto } from './menu';

const order = vi.fn();
const single = vi.fn();
const insertArg = vi.fn();
const deleteEq = vi.fn();
const upload = vi.fn();
const remove = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: (col: string, opts: unknown) => order(col, opts) }),
      }),
      insert: (row: unknown) => {
        insertArg(row);
        return { select: () => ({ single: () => single() }) };
      },
      delete: () => ({ eq: (col: string, val: unknown) => deleteEq(col, val) }),
    }),
    storage: {
      from: () => ({
        upload: (path: string, body: unknown) => upload(path, body),
        remove: (paths: string[]) => remove(paths),
      }),
    },
  },
}));

// Downscale is covered by its own tests; here it just passes the blob through.
vi.mock('./api', () => ({ downscalePhoto: vi.fn(async (b: Blob) => b) }));

const photo: MenuPhoto = {
  id: 'm1', cafe_id: 'c1', photo_path: 'menus/abc.jpg', taken_at: '2026-07-15T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchMenuPhotos', () => {
  it('returns photos ordered oldest-first (page 1 stays first)', async () => {
    order.mockResolvedValue({ data: [photo], error: null });
    const result = await fetchMenuPhotos('c1');
    expect(order).toHaveBeenCalledWith('taken_at', { ascending: true });
    expect(result).toEqual([photo]);
  });

  it('returns [] when the table has no rows for the cafe', async () => {
    order.mockResolvedValue({ data: null, error: null });
    expect(await fetchMenuPhotos('c1')).toEqual([]);
  });

  it('throws on fetch error', async () => {
    order.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(fetchMenuPhotos('c1')).rejects.toThrow('boom');
  });
});

describe('addMenuPhoto', () => {
  it('uploads under menus/ then inserts a row pointing at the same path', async () => {
    upload.mockResolvedValue({ error: null });
    single.mockResolvedValue({ data: photo, error: null });
    const result = await addMenuPhoto('c1', new Blob(['x']));
    const uploadedPath = upload.mock.calls[0][0] as string;
    expect(uploadedPath).toMatch(/^menus\/[0-9a-f-]+\.jpg$/);
    expect(insertArg).toHaveBeenCalledWith({ cafe_id: 'c1', photo_path: uploadedPath });
    expect(result).toEqual(photo);
  });

  it('surfaces an upload failure and never inserts', async () => {
    upload.mockResolvedValue({ error: new Error('storage down') });
    await expect(addMenuPhoto('c1', new Blob(['x']))).rejects.toThrow('storage down');
    expect(insertArg).not.toHaveBeenCalled();
  });

  it('surfaces an insert failure (uploaded file is an accepted orphan)', async () => {
    upload.mockResolvedValue({ error: null });
    single.mockResolvedValue({ data: null, error: new Error('rls says no') });
    await expect(addMenuPhoto('c1', new Blob(['x']))).rejects.toThrow('rls says no');
  });
});

describe('deleteMenuPhoto', () => {
  it('removes the storage object, then the row', async () => {
    remove.mockResolvedValue({ error: null });
    deleteEq.mockResolvedValue({ error: null });
    await deleteMenuPhoto(photo);
    expect(remove).toHaveBeenCalledWith(['menus/abc.jpg']);
    expect(deleteEq).toHaveBeenCalledWith('id', 'm1');
  });

  it('still deletes the row when storage cleanup fails (accepted orphan)', async () => {
    remove.mockResolvedValue({ error: new Error('nope') });
    deleteEq.mockResolvedValue({ error: null });
    await expect(deleteMenuPhoto(photo)).resolves.toBeUndefined();
    expect(deleteEq).toHaveBeenCalledWith('id', 'm1');
  });

  it('throws when the row delete fails', async () => {
    remove.mockResolvedValue({ error: null });
    deleteEq.mockResolvedValue({ error: new Error('row gone wrong') });
    await expect(deleteMenuPhoto(photo)).rejects.toThrow('row gone wrong');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/lib/menu.test.ts
```

Expected: FAIL — `Cannot find module './menu'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/menu.ts`:

```ts
import { supabase } from './supabase';
import { downscalePhoto } from './api';

export interface MenuPhoto {
  id: string;
  cafe_id: string;
  photo_path: string;
  taken_at: string;
}

export async function fetchMenuPhotos(cafeId: string): Promise<MenuPhoto[]> {
  const { data, error } = await supabase
    .from('menu_photos')
    .select('*')
    .eq('cafe_id', cafeId)
    .order('taken_at', { ascending: true });
  if (error) throw error;
  return (data as MenuPhoto[] | null) ?? [];
}

// Upload-before-insert, same stance as reviews: if the insert fails, the
// uploaded file is an accepted orphan (warned, not cleaned up).
export async function addMenuPhoto(cafeId: string, blob: Blob): Promise<MenuPhoto> {
  const small = await downscalePhoto(blob);
  const path = `menus/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage.from('photos').upload(path, small);
  if (uploadError) throw uploadError;
  const { data, error } = await supabase
    .from('menu_photos')
    .insert({ cafe_id: cafeId, photo_path: path })
    .select('*')
    .single();
  if (error) {
    console.warn('menu photo insert failed after upload:', error.message);
    throw error;
  }
  return data as MenuPhoto;
}

// Best-effort storage removal first, then the row. Row-delete failure surfaces
// to the caller; storage cleanup failure is an accepted orphan (same as deleteReview).
export async function deleteMenuPhoto(photo: MenuPhoto): Promise<void> {
  const { error: cleanupError } = await supabase.storage.from('photos').remove([photo.photo_path]);
  if (cleanupError) console.warn('menu photo cleanup failed:', cleanupError.message);
  const { error } = await supabase.from('menu_photos').delete().eq('id', photo.id);
  if (error) throw error;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/lib/menu.test.ts
```

Expected: PASS — 9 tests.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc -b --noEmit
cd .. && git add app/src/lib/menu.ts app/src/lib/menu.test.ts && git commit -m "feat: menu photo data access (fetch/add/delete on existing menu_photos table)" && cd app
```

---

### Task 2: `CafeMenu` component (TDD)

**Files:**
- Create: `app/src/components/CafeMenu.test.tsx`
- Create: `app/src/components/CafeMenu.tsx`

Behaviour (from spec): self-contained section. Fetches on mount with an unmount guard. Renders nothing while loading; a muted error line if the fetch fails; heading "Menu" + empty-state line or a horizontal thumbnail row; add controls ("Take a photo" / "Choose from library", the app's standard pattern); a full-screen viewer on thumbnail tap with ✕ close, tap-photo-to-zoom, and a two-tap "Remove this photo" button (arm/confirm copied from `ConfirmDelete`, incl. 5s auto-disarm and blur-disarm). Any signed-in reviewer may add/remove. No horizontal padding of its own on the section (the parent provides `px-6`).

- [ ] **Step 1: Write the failing tests**

Create `app/src/components/CafeMenu.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import CafeMenu from './CafeMenu';
import type { MenuPhoto } from '../lib/menu';

const fetchMenuPhotos = vi.fn();
const addMenuPhoto = vi.fn();
const deleteMenuPhoto = vi.fn();
vi.mock('../lib/menu', () => ({
  fetchMenuPhotos: (...a: unknown[]) => fetchMenuPhotos(...a),
  addMenuPhoto: (...a: unknown[]) => addMenuPhoto(...a),
  deleteMenuPhoto: (...a: unknown[]) => deleteMenuPhoto(...a),
}));
vi.mock('./SignedImage', () => ({
  default: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

function makePhoto(over: Partial<MenuPhoto>): MenuPhoto {
  return { id: 'm1', cafe_id: 'c1', photo_path: 'menus/a.jpg', taken_at: '2026-07-15T10:00:00Z', ...over };
}

function renderMenu(photos: MenuPhoto[] | Error) {
  if (photos instanceof Error) fetchMenuPhotos.mockRejectedValue(photos);
  else fetchMenuPhotos.mockResolvedValue(photos);
  render(<CafeMenu cafeId="c1" cafeName="Cafe A" />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CafeMenu', () => {
  it('shows the empty state with add controls when the cafe has no menu photos', async () => {
    renderMenu([]);
    expect(await screen.findByText('Menu')).toBeDefined();
    expect(screen.getByText(/No menu photos yet/)).toBeDefined();
    expect(screen.getByLabelText('Take a photo')).toBeDefined();
    expect(screen.getByLabelText('Choose from library')).toBeDefined();
  });

  it('renders a positioned, labelled thumbnail per photo', async () => {
    renderMenu([makePhoto({}), makePhoto({ id: 'm2', photo_path: 'menus/b.jpg' })]);
    expect(await screen.findByRole('button', { name: 'Menu photo 1 of 2 — Cafe A' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Menu photo 2 of 2 — Cafe A' })).toBeDefined();
    expect(screen.queryByText(/No menu photos yet/)).toBeNull();
  });

  it('shows the friendly error line when the fetch fails', async () => {
    renderMenu(new Error('offline'));
    expect(await screen.findByText(/Couldn't load the menu/)).toBeDefined();
    expect(screen.queryByText('Menu')).toBeNull();
  });

  it('adds a photo via the library input and appends its thumbnail', async () => {
    renderMenu([makePhoto({})]);
    await screen.findByText('Menu');
    addMenuPhoto.mockResolvedValue(makePhoto({ id: 'm2', photo_path: 'menus/new.jpg' }));
    const file = new File(['x'], 'menu.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Choose from library'), { target: { files: [file] } });
    expect(await screen.findByRole('button', { name: 'Menu photo 2 of 2 — Cafe A' })).toBeDefined();
    expect(addMenuPhoto).toHaveBeenCalledWith('c1', file);
  });

  it('shows the friendly error when adding fails, and keeps the add controls', async () => {
    renderMenu([]);
    await screen.findByText('Menu');
    addMenuPhoto.mockRejectedValue(new Error('offline'));
    const file = new File(['x'], 'menu.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Choose from library'), { target: { files: [file] } });
    expect(await screen.findByText(/Couldn't add the photo/)).toBeDefined();
    expect(screen.getByLabelText('Choose from library')).toBeDefined();
  });

  it('opens the full-screen viewer from a thumbnail and closes it with ✕', async () => {
    renderMenu([makePhoto({})]);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' }));
    expect(screen.getByRole('dialog', { name: 'Menu photo — Cafe A' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close menu photo' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('removes a photo only after arm-then-confirm, then closes the viewer', async () => {
    deleteMenuPhoto.mockResolvedValue(undefined);
    renderMenu([makePhoto({})]);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' }));
    const remove = screen.getByRole('button', { name: 'Remove this photo' });
    fireEvent.click(remove);
    expect(deleteMenuPhoto).not.toHaveBeenCalled();
    expect(screen.getByText(/Tap again to confirm/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Tap again to confirm/ }));
    expect(deleteMenuPhoto).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/No menu photos yet/)).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the photo and shows the friendly error when removal fails', async () => {
    deleteMenuPhoto.mockRejectedValue(new Error('offline'));
    renderMenu([makePhoto({})]);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove this photo' }));
    fireEvent.click(screen.getByRole('button', { name: /Tap again to confirm/ }));
    expect(await screen.findByText(/Couldn't remove/)).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined(); // viewer stays open
    fireEvent.click(screen.getByRole('button', { name: 'Close menu photo' }));
    expect(screen.getByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' })).toBeDefined();
  });

  it('toggles the viewer photo between fitted and natural size on tap', async () => {
    renderMenu([makePhoto({})]);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' }));
    const zoom = screen.getByRole('button', { name: 'Zoom menu photo' });
    expect(zoom.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(zoom);
    expect(zoom.getAttribute('aria-pressed')).toBe('true');
  });
});
```

Note on `getByLabelText('Take a photo')`: the hidden `<input type="file">` sits inside a `<label>` whose text is the accessible name — the same markup `NewReview`/`ReviewDetail` already use, so the query resolves to the input.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/components/CafeMenu.test.tsx
```

Expected: FAIL — `Cannot find module './CafeMenu'`.

- [ ] **Step 3: Write the implementation**

Create `app/src/components/CafeMenu.tsx`:

```tsx
import { useEffect, useState } from 'react';
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
  const [removing, setRemoving] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);

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
    setViewing(p);
    setZoomed(false);
    setRemoveArmed(false);
    setRemoveFailed(false);
  }

  function closeViewer() {
    setViewing(null);
    setZoomed(false);
    setRemoveArmed(false);
    setRemoveFailed(false);
  }

  async function onRemove() {
    if (!viewing) return;
    if (!removeArmed) {
      setRemoveArmed(true);
      return;
    }
    setRemoving(true);
    setRemoveFailed(false);
    try {
      await deleteMenuPhoto(viewing);
      setPhotos((ps) => (ps ?? []).filter((p) => p.id !== viewing.id));
      closeViewer();
    } catch {
      setRemoveFailed(true);
      setRemoveArmed(false);
    } finally {
      setRemoving(false);
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
        <div role="dialog" aria-label={`Menu photo — ${cafeName}`} className="fixed inset-0 z-50 flex flex-col bg-ink/95">
          <div className="flex justify-end p-3">
            <button
              type="button"
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
            {removing ? (
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
            {removeFailed && (
              <p className="pt-2 text-center text-sm text-red-300">Couldn't remove. Check your connection and try again.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/components/CafeMenu.test.tsx
```

Expected: PASS — 9 tests.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc -b --noEmit
cd .. && git add app/src/components/CafeMenu.tsx app/src/components/CafeMenu.test.tsx && git commit -m "feat: CafeMenu section - thumbnails, add controls, full-screen viewer with remove" && cd app
```

---

### Task 3: Mount CafeMenu in ReviewDetail (TDD)

**Files:**
- Modify: `app/src/pages/ReviewDetail.test.tsx` (add a mock + three tests)
- Modify: `app/src/pages/ReviewDetail.tsx` (one import + one render line)

The menu renders in **view mode only**, and only when the review has a joined cafe. It sits inside the existing view-mode `<div className="space-y-4 px-6">`, after the note, **before** the owner-only Edit/Delete block (details → menu → actions). Journal, Near me, and CafeStack are untouched — that is what keeps the menu invisible outside the review page.

- [ ] **Step 1: Add the failing tests**

In `app/src/pages/ReviewDetail.test.tsx`, add this mock directly below the existing `vi.mock('../components/SignedImage', ...)` block:

```tsx
vi.mock('../components/CafeMenu', () => ({
  default: ({ cafeId }: { cafeId: string }) => <div data-testid="cafe-menu" data-cafe={cafeId} />,
}));
```

Then add these tests at the end of the `describe('ReviewDetail', ...)` block:

```tsx
  it('shows the cafe menu section in view mode', async () => {
    renderDetail(makeReview({}));
    await screen.findByRole('button', { name: 'Edit' });
    expect(screen.getByTestId('cafe-menu').getAttribute('data-cafe')).toBe('c1');
  });

  it('hides the menu section while editing', async () => {
    renderDetail(makeReview({ status: 'draft' })); // drafts open straight into edit mode
    await screen.findByRole('button', { name: 'Save changes' });
    expect(screen.queryByTestId('cafe-menu')).toBeNull();
  });

  it('hides the menu section when the review has no cafe', async () => {
    renderDetail(makeReview({ cafe: undefined, cafe_id: null }));
    await screen.findByText('Unknown cafe');
    expect(screen.queryByTestId('cafe-menu')).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

```bash
npx vitest run src/pages/ReviewDetail.test.tsx
```

Expected: the three new tests FAIL (`cafe-menu` test id not found for the first; the other two may pass vacuously — that's fine, the first must fail); all pre-existing tests still pass.

- [ ] **Step 3: Wire in the component**

In `app/src/pages/ReviewDetail.tsx`:

Add to the imports (after the `BackToJournal` import):

```tsx
import CafeMenu from '../components/CafeMenu';
```

In the view-mode branch, insert the menu between the note and the owner block, i.e. change:

```tsx
          {review.note && <p className="rounded-xl bg-sand/50 p-3 text-sm">{review.note}</p>}

          {isOwner && (
```

to:

```tsx
          {review.note && <p className="rounded-xl bg-sand/50 p-3 text-sm">{review.note}</p>}

          {review.cafe && <CafeMenu cafeId={review.cafe.id} cafeName={review.cafe.name} />}

          {isOwner && (
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: PASS — every file, including the three new ReviewDetail tests (no other test renders ReviewDetail, so nothing else needs the CafeMenu mock).

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc -b --noEmit
cd .. && git add app/src/pages/ReviewDetail.tsx app/src/pages/ReviewDetail.test.tsx && git commit -m "feat: cafe menu photos on the review page (view mode, cafe reviews only)" && cd app
```

---

### Task 4: Whole-feature verification

**Files:** none created; this is verification only.

- [ ] **Step 1: Full suite, types, production build**

```bash
npx vitest run
npx tsc -b --noEmit
npm run build
```

Expected: all tests pass, no type errors, clean build.

- [ ] **Step 2: Verify in the running app (dev server + browser)**

Start the dev server (`npm run dev` from `app/` — Vite may pick 5174+ if 5173 is taken) and check in the browser against the real Supabase project:

1. Journal and Near me: **no** menu anywhere (unchanged).
2. Open a review at a real cafe: "Menu" section appears below the details with "No menu photos yet — add one below."
3. Add a photo via "Choose from library" → thumbnail appears; reload the page → it persists; open a *different* review at the same cafe → same menu shows.
4. Tap the thumbnail → full-screen viewer; tap the photo → zooms to natural size; ✕ closes.
5. In the viewer: "Remove this photo" → "Tap again to confirm" → photo gone; reload → still gone (row and storage object deleted — check the Supabase dashboard `menu_photos` table is empty for that cafe if in doubt).
6. Open a draft review (edit mode): no menu section.

Clean up any test photos added to real cafes before finishing.

- [ ] **Step 3: Update docs and hand off**

- Tick the checkboxes in this plan.
- Append a section to `docs/superpowers/HANDOFF.md` recording: feature shipped on `feature/cafe-menu` (forked from `feature/shared-journal`), merge order (shared-journal → cafe-menu), that `menu_photos`/RLS/storage needed **no** changes, and any new gotchas learned.
- Commit:

```bash
cd "C:/Users/justi/OneDrive/Documents/MatchaMuse"
git add docs/superpowers/plans/2026-07-15-cafe-menu-photos.md docs/superpowers/HANDOFF.md
git commit -m "docs: cafe menu photos - plan executed, handoff updated"
```

- [ ] **Step 4: On-device acceptance (with Justina, later)**

Not part of this session's automated work — record as pending in HANDOFF: on her iPhone, add a menu photo with the camera (portrait must stay upright — `downscalePhoto` handles EXIF), view/zoom it, remove one, and confirm the second reviewer sees the same menu. Deployment to Cloudflare Pages happens after `feature/shared-journal` and this branch merge to `main`, using the usual `npm run build` + `npx wrangler pages deploy dist --project-name matcha-muse --branch main` recipe.

---

## Out of scope (per spec)

Captions, reordering, offline queueing of menu uploads, a dedicated cafe page.
