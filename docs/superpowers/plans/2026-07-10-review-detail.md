# Review Detail (view / edit / delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every logged matcha opens at `/review/:id` — view mode first, explicit Edit button (drafts open straight into edit), full-field editing incl. photo replace/remove, two-step delete, and a drafts filter on the Journal.

**Architecture:** One new page (`ReviewDetail.tsx`) owning view/edit mode state; `ReviewForm` gains an `initial` prop + configurable buttons so the same form serves logging and editing; two new API functions (`updateReview`, `deleteReview`) in `api.ts`; a small reusable `ConfirmDelete` component; entry-point links added to Dashboard and CafeStack. ~~No schema/RLS changes.~~ **Amendment 2026-07-10:** Task 3's quality review found the `photos` bucket lacked a `delete` storage policy (cleanup would silently fail forever) — one policy added, applied by the owner, recorded in `app/supabase/schema.sql`.

**Tech Stack:** Vite + React 19 + TypeScript + Tailwind 3, Vitest + Testing Library (globals: `describe/it/expect/vi`), Supabase JS, react-router-dom 7.

**Spec:** `docs/superpowers/specs/2026-07-10-review-detail-design.md` (read it first).

**Working directory for all commands: `app/`.** Tests: `npx vitest run <file>` / `npx vitest run`; typecheck: `npx tsc -b --noEmit`; build: `npm run build`. Baseline suite: 35 passing.

---

## File map

| File | Role |
|---|---|
| Modify `app/src/components/ReviewForm.tsx` | Add `initial`, `submitLabel`, `draftLabel` (null hides), `onCancel` props; defaults keep NewReview behaviour identical |
| Modify `app/src/components/ReviewForm.test.tsx` | New prop tests |
| Create `app/src/components/ConfirmDelete.tsx` | Two-step delete button (arm → confirm; blur resets) |
| Create `app/src/components/ConfirmDelete.test.tsx` | Component tests |
| Modify `app/src/lib/api.ts` | `PhotoAction` type, `updateReview`, `deleteReview` |
| Create `app/src/pages/ReviewDetail.tsx` | The `/review/:id` page: fetch, view mode, edit mode, photo editing, save/cancel/delete |
| Create `app/src/pages/ReviewDetail.test.tsx` | Mode-switching component tests (supabase/api/SignedImage mocked) |
| Modify `app/src/App.tsx` | Add `/review/:id` route |
| Modify `app/src/pages/Dashboard.tsx` | Cards become Links, Draft badges, drafts-notice filter toggle |
| Create `app/src/pages/Dashboard.test.tsx` | Filter/badge/link tests |
| Modify `app/src/components/CafeStack.tsx` | Single card + fanned cards link to `/review/:id` |
| Modify `app/src/components/CafeStack.test.tsx` | Wrap renders in MemoryRouter; add link assertions |

---

### Task 1: ReviewForm `initial` + configurable buttons (TDD)

**Files:**
- Modify: `app/src/components/ReviewForm.tsx`
- Test: `app/src/components/ReviewForm.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append to `app/src/components/ReviewForm.test.tsx` (inside the existing `describe` if there is one, otherwise at top level; match the file's existing style):

```tsx
const filled: ReviewDraft = {
  overall: 4, taste: 3, sweetness: null, texture: null,
  temperature: 'iced', milk: 'oat', drink_style: 'latte', size: 'M',
  price: '6.50', occasions: ['hangout'], note: 'silky', status: 'complete',
};

it('pre-fills fields from initial and uses the given submit label', () => {
  render(<ReviewForm onSubmit={() => {}} initial={filled} submitLabel="Save changes" />);
  expect((screen.getByLabelText('Price') as HTMLInputElement).value).toBe('6.50');
  expect(screen.getByDisplayValue('silky')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined();
});

it('hides the secondary draft button when draftLabel is null', () => {
  render(<ReviewForm onSubmit={() => {}} initial={filled} draftLabel={null} />);
  expect(screen.queryByText(/draft/i)).toBeNull();
});

it('shows Cancel when onCancel is provided and calls it without submitting', () => {
  const onCancel = vi.fn();
  const onSubmit = vi.fn();
  render(<ReviewForm onSubmit={onSubmit} onCancel={onCancel} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
});
```

Add any missing imports at the top of the test file: `ReviewDraft` is exported from `./ReviewForm`; `fireEvent`/`screen`/`render` from `@testing-library/react`.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `npx vitest run src/components/ReviewForm.test.tsx`
Expected: FAIL — unknown props / missing buttons.

- [ ] **Step 3: Implement**

In `app/src/components/ReviewForm.tsx`, replace the component signature and the two existing buttons; leave everything else untouched:

```tsx
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
  // ...body unchanged...
```

Buttons block at the bottom of the form becomes:

```tsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ReviewForm.test.tsx` — all passing (existing + 3 new).
Then the full suite: `npx vitest run` — 38 passing (NewReview's usage is unchanged by the defaults).

- [ ] **Step 5: Commit**

```bash
git add src/components/ReviewForm.tsx src/components/ReviewForm.test.tsx
git commit -m "feat: ReviewForm initial values, configurable buttons, optional cancel"
```

---

### Task 2: ConfirmDelete component (TDD)

**Files:**
- Create: `app/src/components/ConfirmDelete.tsx`
- Test: `app/src/components/ConfirmDelete.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `app/src/components/ConfirmDelete.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDelete from './ConfirmDelete';

describe('ConfirmDelete', () => {
  it('arms on first tap without deleting', () => {
    const onDelete = vi.fn();
    render(<ConfirmDelete onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete this matcha' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Tap again to confirm/ })).toBeDefined();
  });

  it('deletes on the second tap', () => {
    const onDelete = vi.fn();
    render(<ConfirmDelete onDelete={onDelete} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('disarms when focus leaves the button', () => {
    const onDelete = vi.fn();
    render(<ConfirmDelete onDelete={onDelete} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.blur(btn);
    expect(screen.getByRole('button', { name: 'Delete this matcha' })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ConfirmDelete.test.tsx`
Expected: FAIL — cannot resolve `./ConfirmDelete`.

- [ ] **Step 3: Implement**

Create `app/src/components/ConfirmDelete.tsx`:

```tsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ConfirmDelete.test.tsx` — 3 passing. Full suite: 41.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConfirmDelete.tsx src/components/ConfirmDelete.test.tsx
git commit -m "feat: two-step ConfirmDelete button"
```

---

### Task 3: `updateReview` + `deleteReview` in api.ts

**Files:**
- Modify: `app/src/lib/api.ts`

No unit tests for this task: `api.ts` functions are thin supabase compositions and the project's established pattern (v1 decision) is to verify them via the typecheck, the page-level mocked tests (Task 4), and on-device acceptance (Task 6). Do NOT invent a supabase mock harness here.

- [ ] **Step 1: Implement**

In `app/src/lib/api.ts`: add `Review` to the type imports (`import type { Review } from './types';` merged with existing imports if present) and append:

```ts
export type PhotoAction =
  | { kind: 'keep' }
  | { kind: 'replace'; blob: Blob }
  | { kind: 'remove' };

// Applies an edit to an existing review. Returns the review's final photo_path.
// Old-photo cleanup is best-effort: an orphaned file is accepted; a failed
// cleanup must never fail the save (same stance as v1's upload-before-insert).
export async function updateReview(
  review: Review,
  draft: ReviewDraft,
  photo: PhotoAction = { kind: 'keep' }
): Promise<string | null> {
  let photoPath = review.photo_path;
  if (photo.kind === 'replace') {
    const small = await downscalePhoto(photo.blob);
    const newPath = `reviews/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('photos').upload(newPath, small);
    if (error) throw error;
    photoPath = newPath;
  } else if (photo.kind === 'remove') {
    photoPath = null;
  }

  const { error } = await supabase
    .from('reviews')
    .update({
      photo_path: photoPath,
      overall: draft.overall,
      taste: draft.taste,
      sweetness: draft.sweetness,
      texture: draft.texture,
      temperature: draft.temperature,
      milk: draft.milk,
      drink_style: draft.drink_style,
      size: draft.size,
      price: Number(draft.price),
      occasions: draft.occasions,
      note: draft.note || null,
      status: draft.status,
    })
    .eq('id', review.id);
  if (error) throw error;

  if (photo.kind !== 'keep' && review.photo_path) {
    try {
      await supabase.storage.from('photos').remove([review.photo_path]);
    } catch {
      // orphan accepted
    }
  }

  return photoPath;
}

// Best-effort photo removal first, then the row. Row-delete failure surfaces
// to the caller; photo cleanup failure is an accepted orphan.
export async function deleteReview(review: Review): Promise<void> {
  if (review.photo_path) {
    try {
      await supabase.storage.from('photos').remove([review.photo_path]);
    } catch {
      // orphan accepted
    }
  }
  const { error } = await supabase.from('reviews').delete().eq('id', review.id);
  if (error) throw error;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b --noEmit` — clean. `npx vitest run` — 41 passing (nothing broken).

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: updateReview and deleteReview with best-effort photo cleanup"
```

---

### Task 4: ReviewDetail page + route (TDD)

**Files:**
- Create: `app/src/pages/ReviewDetail.tsx`
- Test: `app/src/pages/ReviewDetail.test.tsx`
- Modify: `app/src/App.tsx` (route only)

Behaviour (from spec): completed review → view mode (photo, cafe + date, read-only details, **Edit**, **Delete this matcha**); draft → edit mode immediately. Edit mode: photo with ✕/replace/choose (NewReview pattern, new photo runs `downscalePhoto` via `updateReview`), pre-filled `ReviewForm` with **Save changes** / **Keep as draft** (drafts only) / **Cancel**. Save returns to view mode with updated values; Cancel discards (draft: back to `/`). Delete → `deleteReview` → navigate `/`. Load failure → standard message.

- [ ] **Step 1: Write the failing tests**

Create `app/src/pages/ReviewDetail.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReviewDetail from './ReviewDetail';
import type { Cafe, Review } from '../lib/types';

const maybeSingle = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }),
  },
}));
vi.mock('../lib/api', () => ({
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
}));
vi.mock('../components/SignedImage', () => ({
  default: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

const cafe: Cafe = {
  id: 'c1', name: 'Cafe A', address: '1 King William St', suburb: null,
  latitude: -34.9285, longitude: 138.6007, google_place_id: 'place-a',
};

function makeReview(over: Partial<Review>): Review {
  return {
    id: 'r1', cafe_id: 'c1', photo_path: null, drank_at: '2026-06-20T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: 'iced', milk: 'oat', drink_style: null, size: null,
    price: 6.5, occasions: [], note: 'silky', status: 'complete', cafe,
    ...over,
  };
}

function renderDetail(review: Review | null) {
  maybeSingle.mockResolvedValue({ data: review, error: null });
  render(
    <MemoryRouter initialEntries={['/review/r1']}>
      <Routes>
        <Route path="/review/:id" element={<ReviewDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReviewDetail', () => {
  it('opens a completed review in view mode with Edit and Delete', async () => {
    renderDetail(makeReview({}));
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.getByText('Cafe A')).toBeDefined();
    expect(screen.getByText(/silky/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete this matcha' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('switches to a pre-filled form when Edit is tapped', async () => {
    renderDetail(makeReview({}));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText('Price') as HTMLInputElement).value).toBe('6.5');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Keep as draft/ })).toBeNull(); // completed → no draft button
  });

  it('opens a draft directly in edit mode with Keep as draft', async () => {
    renderDetail(makeReview({ status: 'draft' }));
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep as draft' })).toBeDefined();
  });

  it('shows the standard message when the review cannot be loaded', async () => {
    renderDetail(null);
    expect(await screen.findByText(/Couldn't load this matcha/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/ReviewDetail.test.tsx`
Expected: FAIL — cannot resolve `./ReviewDetail`.

- [ ] **Step 3: Implement the page**

Create `app/src/pages/ReviewDetail.tsx`:

```tsx
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
```

- [ ] **Step 4: Add the route**

In `app/src/App.tsx`: add `import ReviewDetail from './pages/ReviewDetail';` beside the page imports, and add beside the existing routes:

```tsx
<Route path="/review/:id" element={<ReviewDetail />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pages/ReviewDetail.test.tsx` — 4 passing.
Full suite: `npx vitest run` — 45 passing. `npx tsc -b --noEmit` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ReviewDetail.tsx src/pages/ReviewDetail.test.tsx src/App.tsx
git commit -m "feat: review detail page — view mode, edit mode, photo editing, delete"
```

---

### Task 5: Entry points — Dashboard links/badge/filter + CafeStack links (TDD)

**Files:**
- Modify: `app/src/pages/Dashboard.tsx`
- Create: `app/src/pages/Dashboard.test.tsx`
- Modify: `app/src/components/CafeStack.tsx`
- Modify: `app/src/components/CafeStack.test.tsx`

- [ ] **Step 1: Write the failing Dashboard tests**

Create `app/src/pages/Dashboard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import type { Cafe, Review } from '../lib/types';

const order = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => order() }) }),
  },
}));
vi.mock('../components/SignedImage', () => ({
  default: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

const cafe: Cafe = {
  id: 'c1', name: 'Cafe A', address: null, suburb: null,
  latitude: null, longitude: null, google_place_id: null,
};

function makeReview(over: Partial<Review>): Review {
  return {
    id: Math.random().toString(36).slice(2),
    cafe_id: 'c1', photo_path: null, drank_at: '2026-06-20T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: null, milk: null, drink_style: null, size: null,
    price: 6, occasions: [], note: null, status: 'complete', cafe,
    ...over,
  };
}

function renderDashboard(reviews: Review[]) {
  order.mockResolvedValue({ data: reviews, error: null });
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard review links and drafts filter', () => {
  it('renders each review card as a link to its detail page', async () => {
    const r = makeReview({});
    renderDashboard([r]);
    const link = (await screen.findAllByRole('link'))
      .find((l) => l.getAttribute('href') === `/review/${r.id}`);
    expect(link).toBeDefined();
  });

  it('badges draft cards', async () => {
    renderDashboard([makeReview({ status: 'draft' })]);
    expect(await screen.findByText('Draft')).toBeDefined();
  });

  it('toggles a drafts-only filter via the notice', async () => {
    const complete = makeReview({});
    const draft = makeReview({ status: 'draft' });
    renderDashboard([complete, draft]);

    const notice = await screen.findByRole('button', { name: /draft.*waiting/i });
    fireEvent.click(notice);
    // Only the draft card remains (1 review link + the + FAB link)
    const reviewLinks = screen.getAllByRole('link')
      .filter((l) => l.getAttribute('href')?.startsWith('/review/'));
    expect(reviewLinks).toHaveLength(1);
    expect(reviewLinks[0].getAttribute('href')).toBe(`/review/${draft.id}`);

    fireEvent.click(screen.getByRole('button', { name: /show all/i }));
    expect(
      screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'))
    ).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: FAIL — cards aren't links yet, no badge, notice isn't a button.

- [ ] **Step 3: Implement the Dashboard changes**

In `app/src/pages/Dashboard.tsx`:

1. Add to imports: `import { Link } from 'react-router-dom';` (it was removed in the NewFab refactor).
2. Add state beside the others: `const [showDraftsOnly, setShowDraftsOnly] = useState(false);`
3. After the `drafts` computation add: `const visible = showDraftsOnly && drafts.length > 0 ? drafts : reviews;`
4. Replace the drafts notice `<p>` block with:

```tsx
      {drafts.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDraftsOnly(!showDraftsOnly)}
          aria-pressed={showDraftsOnly}
          className="mb-3 w-full rounded-xl bg-sand/60 p-3 text-left text-sm text-sand-ink"
        >
          {showDraftsOnly
            ? 'Showing drafts only — tap to show all.'
            : `${drafts.length} draft${drafts.length > 1 ? 's' : ''} waiting for details — tap to view.`}
        </button>
      )}
```

5. Replace the grid's `reviews.map` card `<div>` with a `Link` over `visible`, adding the Draft badge:

```tsx
      <div className="grid grid-cols-2 gap-3">
        {visible.map((r) => (
          <Link key={r.id} to={`/review/${r.id}`} className="overflow-hidden rounded-2xl border border-sand bg-white">
            <div className="relative">
              <SignedImage path={r.photo_path} alt={r.cafe?.name ?? 'Matcha'} className="h-36 w-full object-cover" />
              {r.status === 'draft' && (
                <span className="absolute left-2 top-2 rounded-full bg-sand px-2 py-0.5 text-xs text-sand-ink">Draft</span>
              )}
            </div>
            <div className="p-3">
              <p className="truncate font-display">{r.cafe?.name ?? 'Unknown cafe'}</p>
              <p className="text-sm text-ink/60">
                {Number(r.overall).toFixed(1)} ★ · ${Number(r.price).toFixed(2)}
              </p>
            </div>
          </Link>
        ))}
      </div>
```

- [ ] **Step 4: Run the Dashboard tests**

Run: `npx vitest run src/pages/Dashboard.test.tsx` — 3 passing.

- [ ] **Step 5: Write the failing CafeStack link tests**

In `app/src/components/CafeStack.test.tsx`:

1. Add `import { MemoryRouter } from 'react-router-dom';` and a helper, replacing every direct `render(<CafeStack …/>)` call with `renderStack(<CafeStack …/>)`:

```tsx
function renderStack(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}
```

(Also add `import type React from 'react';` if the file needs it for the helper's type.)

2. Append two tests inside the main describe:

```tsx
  it('links a single-review card to its review detail page', () => {
    const group = makeGroup([makeReview({})]);
    renderStack(<CafeStack group={group} expanded={false} onToggle={() => {}} />);
    const link = screen.getAllByRole('link')
      .find((l) => l.getAttribute('href') === `/review/${group.reviews[0].id}`);
    expect(link).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull(); // still not a toggle
  });

  it('links each fanned-out card to its review detail page', () => {
    const group = makeGroup([makeReview({}), makeReview({})]);
    renderStack(<CafeStack group={group} expanded onToggle={() => {}} />);
    for (const r of group.reviews) {
      const link = screen.getAllByRole('link')
        .find((l) => l.getAttribute('href') === `/review/${r.id}`);
      expect(link).toBeDefined();
    }
  });
```

- [ ] **Step 6: Run to verify the new tests fail**

Run: `npx vitest run src/components/CafeStack.test.tsx`
Expected: the two new tests FAIL (no such links); pre-existing tests pass (MemoryRouter wrap is harmless before Link is introduced).

- [ ] **Step 7: Implement the CafeStack changes**

In `app/src/components/CafeStack.tsx`:

1. Add `import { Link } from 'react-router-dom';`
2. Single-review card: replace the `headerBody` else-branch with a Link:

```tsx
        {multi ? (
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="block w-full">
            {headerBody}
          </button>
        ) : (
          <Link to={`/review/${latest.id}`} className="block">
            {headerBody}
          </Link>
        )}
```

3. Fanned-out cards: replace the inner `<div key={r.id} className="flex gap-3 …">` wrapper with a Link carrying the same classes:

```tsx
          {reviews.map((r) => (
            <Link
              key={r.id}
              to={`/review/${r.id}`}
              className="flex gap-3 overflow-hidden rounded-xl border border-sand bg-white"
            >
              <SignedImage path={r.photo_path} alt={cafe.name} className="h-20 w-20 shrink-0 object-cover" />
              <div className="py-2 pr-3">
                <p className="text-sm">
                  {Number(r.overall).toFixed(1)} ★ · {detailLine(r)}
                </p>
                {r.note && <p className="mt-1 line-clamp-2 text-sm text-ink/60">{r.note}</p>}
              </div>
            </Link>
          ))}
```

- [ ] **Step 8: Full verification**

Run: `npx vitest run` — 50 passing. `npx tsc -b --noEmit` — clean. `npm run build` — clean.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx src/components/CafeStack.tsx src/components/CafeStack.test.tsx
git commit -m "feat: tappable cards everywhere — journal links, draft badges/filter, near-me card links"
```

---

### Task 6: Deploy + on-device acceptance (human-assisted)

**Do this WITH Justina.** No new code unless the checklist surfaces fixes.

- [ ] **Step 1: Deploy**

```bash
npm run build
npx wrangler pages deploy dist --project-name matcha-muse --branch main --commit-dirty=true
```

Confirm `https://matcha-muse.pages.dev/` serves the new bundle (compare `dist/assets/index-*.js` name against the live HTML). Ask Justina to fully close and reopen the PWA.

- [ ] **Step 2: On-device acceptance (Justina's iPhone)**

1. Journal card tap → review page in view mode (photo, details, Edit, Delete).
2. Edit → change stars/price/note → Save changes → back in view mode with new values; journal reflects them.
3. Draft: badge visible in grid; drafts notice tap filters to drafts; notice tap again restores; opening the draft lands directly in the form; **Save changes** completes it (badge gone); **Keep as draft** path also tried.
4. Photo: replace a photo (✕ then retake/choose) → new photo shows after save and is upright; remove a photo entirely → card shows placeholder state.
5. Delete: first tap arms ("Tap again to confirm"), tapping elsewhere disarms; two taps deletes and returns to journal.
6. Near me: single-review cafe card opens the review; a stack fans out and its inner cards open the right reviews; stack header still toggles; Google links still work.
7. **The real acceptance:** Justina deletes every unwanted test review.

- [ ] **Step 3: Record and commit**

Fix anything surfaced (via the standard review loop), update `docs/superpowers/HANDOFF.md` (feature shipped + date), then:

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "chore: review detail shipped and verified on-device"
```
