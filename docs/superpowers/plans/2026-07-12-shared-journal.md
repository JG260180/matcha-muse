# Shared Journal & Reviewer Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Matcha Muse into an invite-only shared journal: directions + back buttons (quick wins), everyone sees everyone's completed reviews, reviewer initials/filter on the journal, a required first-sign-in taste quiz, and reviewer profile pages with free derived stats.

**Architecture:** Vite + React 19 + TS + Tailwind 3 SPA in `app/`, Supabase (Postgres + RLS + private `photos` storage bucket). New `profiles` table (1 row per auth user); reviews RLS widened to "read completed-or-own, write own". Profiles are joined to reviews **client-side** by `user_id`. Stats are pure client-side functions over already-fetched reviews — no new services.

**Tech Stack:** React Router 7, @supabase/supabase-js, Vitest + Testing Library, Tailwind ceremony theme (`cream/ink/sand/sand-ink/matcha-deep/matcha-mist`, `font-display`).

**Spec:** `docs/superpowers/specs/2026-07-12-shared-journal-design.md` (approved by owner 2026-07-12).

**Branch:** all work on `feature/shared-journal`, forked from `main`. Owner is non-technical: human steps (SQL, acceptance) must be guided click-by-click, never ask her to run commands.

**Conventions (match existing code):**
- Tests colocated (`Foo.test.tsx` beside `Foo.tsx`), Vitest globals on (no imports of `describe/it/expect/vi`).
- All commands run from `app/`. Test: `npx vitest run <file>`; all: `npx vitest run`; types: `npx tsc -b --noEmit`.
- Errors to users are friendly sentences ("check your connection and try again"), never raw messages.
- Chip buttons: `aria-pressed`, `rounded-full px-4 py-1.5 text-sm`, active = `bg-matcha-deep text-cream`, inactive = `bg-sand/60 text-sand-ink`.

---

### Task 1: Feature branch + Directions button on journal cards (TDD)

**Files:**
- Modify: `app/src/pages/Dashboard.tsx`
- Test: `app/src/pages/Dashboard.test.tsx`

- [ ] **Step 1: Create the branch**

```bash
git checkout main && git pull origin main && git checkout -b feature/shared-journal
```

- [ ] **Step 2: Write the failing tests**

Add to the bottom of the existing `describe` block in `app/src/pages/Dashboard.test.tsx` (the file already defines `cafe`, `makeReview`, `renderDashboard`):

```tsx
  it('shows a Directions link when the cafe has location data', async () => {
    const located = {
      ...cafe, latitude: -34.9, longitude: 138.6, google_place_id: 'place123',
    };
    renderDashboard([makeReview({ cafe: located })]);
    const link = await screen.findByRole('link', { name: /directions/i });
    expect(link.getAttribute('href')).toContain('google.com/maps');
    expect(link.getAttribute('href')).toContain('place123');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('shows no Directions link when the cafe has no location data', async () => {
    renderDashboard([makeReview({})]); // default cafe has null lat/lng/place_id
    await screen.findAllByRole('link');
    expect(screen.queryByRole('link', { name: /directions/i })).toBeNull();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: the two new tests FAIL (no Directions link rendered); existing 4 pass.

- [ ] **Step 4: Implement the card footer**

In `app/src/pages/Dashboard.tsx`:

Add import: `import { directionsUrl } from '../lib/googleLinks';`

Replace the card `<Link>` block inside `visible.map` with (the review link and the
directions link are **siblings** — never nest an `<a>` inside a `<Link>`):

```tsx
        {visible.map((r) => {
          const c = r.cafe;
          const hasDirections =
            c && c.latitude != null && c.longitude != null && c.google_place_id != null;
          return (
            <div key={r.id} className="overflow-hidden rounded-2xl border border-sand bg-white">
              <Link to={`/review/${r.id}`} className="block">
                <div className="relative">
                  <SignedImage path={r.photo_path} alt={c?.name ?? 'Matcha'} className="h-36 w-full object-cover" />
                  {r.status === 'draft' && (
                    <span className="absolute left-2 top-2 rounded-full bg-sand px-2 py-0.5 text-xs text-sand-ink">Draft</span>
                  )}
                </div>
                <div className="p-3 pb-1">
                  <p className="truncate font-display">{c?.name ?? 'Unknown cafe'}</p>
                  <p className="text-sm text-ink/60">
                    {Number(r.overall).toFixed(1)} ★ · ${Number(r.price).toFixed(2)}
                  </p>
                </div>
              </Link>
              {hasDirections ? (
                <a
                  href={directionsUrl(c.latitude!, c.longitude!, c.google_place_id!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center px-3 pb-1 text-sm text-matcha-deep underline"
                >
                  Directions ↗
                </a>
              ) : (
                <div className="pb-2" />
              )}
            </div>
          );
        })}
```

(The `min-h-11` gives the 44px tap target the review-detail feature deferred.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: all 6 PASS. Then `npx tsc -b --noEmit` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx
git commit -m "feat: directions link on journal cards"
```

---

### Task 2: "← Journal" back button on subpages

**Files:**
- Create: `app/src/components/BackToJournal.tsx`
- Test: `app/src/components/BackToJournal.test.tsx`
- Modify: `app/src/pages/ReviewDetail.tsx`, `app/src/pages/NewReview.tsx`, `app/src/pages/NearMe.tsx`

- [ ] **Step 1: Write the failing test**

`app/src/components/BackToJournal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackToJournal from './BackToJournal';

it('links back to the journal home', () => {
  render(<MemoryRouter><BackToJournal /></MemoryRouter>);
  const link = screen.getByRole('link', { name: /journal/i });
  expect(link.getAttribute('href')).toBe('/');
});
```

- [ ] **Step 2: Run it — expect FAIL** (`npx vitest run src/components/BackToJournal.test.tsx`, module not found)

- [ ] **Step 3: Implement**

`app/src/components/BackToJournal.tsx`:

```tsx
import { Link } from 'react-router-dom';

// Explicit way back for anyone who doesn't know the header is tappable.
// The header link stays — this is in addition (owner request 2026-07-12).
export default function BackToJournal() {
  return (
    <Link to="/" className="inline-flex min-h-11 items-center px-6 text-sm text-matcha-deep">
      ← Journal
    </Link>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Mount it on the three subpages**

- `ReviewDetail.tsx`: add `import BackToJournal from '../components/BackToJournal';`; in the main return, make `<BackToJournal />` the first child of `<div className="pb-10 pt-2">`.
- `NewReview.tsx`: same import; first child of `<div className="pb-6 pt-2">` (the main return, not the `queued` return — that screen already has a Done link home).
- `NearMe.tsx`: same import; its root div is padded (`px-6`), so wrap the return in a fragment:

```tsx
  return (
    <>
      <BackToJournal />
      <div className="space-y-4 px-6 pb-24">
        {/* ...existing content unchanged... */}
      </div>
    </>
  );
```

- [ ] **Step 6: Verify**

Run: `npx vitest run` — all pass (ReviewDetail tests must still pass). `npx tsc -b --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/BackToJournal.tsx src/components/BackToJournal.test.tsx src/pages/ReviewDetail.tsx src/pages/NewReview.tsx src/pages/NearMe.tsx
git commit -m "feat: back-to-journal button on subpages"
```

- [ ] **Step 8 (optional, owner's call): early-deploy the quick wins**

From `app/`: `npm run build` then `npx wrangler pages deploy dist --project-name matcha-muse --branch main --commit-dirty=true`. Safe to ship before the DB migration — nothing here touches the database.

---

### Task 3: Database migration — `profiles` table + shared-reviews policies (HUMAN STEP, guided)

**Files:**
- Modify: `app/supabase/schema.sql` (running record)

- [ ] **Step 1: Append to `app/supabase/schema.sql`**

```sql
-- Added 2026-07-12 (shared-journal feature): reviewer profiles + shared visibility.
create table profiles (
  id uuid primary key references auth.users(id),
  display_name text not null,
  about_me text,
  avatar_path text,
  quiz jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "authenticated read profiles" on profiles
  for select to authenticated using (true);
create policy "insert own profile" on profiles
  for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Reviews: everyone signed in reads completed reviews; drafts stay private;
-- writes remain owner-only. Replaces the v1 "own reviews only" FOR ALL policy.
drop policy "own reviews only" on reviews;
create policy "read completed or own reviews" on reviews
  for select to authenticated
  using (status = 'complete' or user_id = auth.uid());
create policy "insert own reviews" on reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy "update own reviews" on reviews
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own reviews" on reviews
  for delete to authenticated using (user_id = auth.uid());
```

- [ ] **Step 2: Guide Justina through applying it** (she runs it; agent never has her credentials)

Give her, in chat, numbered steps: 1) open supabase.com → sign in → project **matcha-muse**; 2) left sidebar → **SQL Editor**; 3) **New query**; 4) paste the SQL block above (provide it in a copy-paste block); 5) press **Run** (or Ctrl+Enter); 6) expected result: "Success. No rows returned".

- [ ] **Step 3: Verify with her**

Ask her to open **Table Editor** → confirm a `profiles` table exists with columns `id, display_name, about_me, avatar_path, quiz, created_at`; then **Authentication → Policies** (or Table Editor → reviews → view policies) → confirm `reviews` shows the four new policies and NOT "own reviews only".

- [ ] **Step 4: Commit the schema record**

```bash
git add supabase/schema.sql
git commit -m "feat: profiles table + shared-review policies (applied via SQL editor)"
```

---

### Task 4: Types + profile library (TDD on initials)

**Files:**
- Modify: `app/src/lib/types.ts`
- Create: `app/src/lib/profile.ts`
- Test: `app/src/lib/profile.test.ts`
- Touch-up: any test fixture missing the new required `user_id`

- [ ] **Step 1: Add quiz constants and types to `app/src/lib/types.ts`**

Append:

```ts
export const SWEETNESS_PREFS = [
  { key: 'purist', label: 'Purist — no sweetener' },
  { key: 'lightly_sweet', label: 'Lightly sweet' },
  { key: 'sweet_tooth', label: 'Sweet tooth' },
] as const;
export const ADVENTUROUSNESS = [
  { key: 'usual', label: 'I stick to my usual' },
  { key: 'sometimes', label: "I'll branch out sometimes" },
  { key: 'anything', label: "I'll try anything on the menu" },
] as const;
export const FREQUENCY = [
  { key: 'daily', label: 'Daily ritual' },
  { key: 'weekly', label: 'Weekly treat' },
  { key: 'occasional', label: 'Special occasions' },
] as const;
export const PRIORITIES = [
  { key: 'taste', label: 'Taste' },
  { key: 'texture', label: 'Texture' },
  { key: 'colour', label: 'Colour' },
  { key: 'intensity', label: 'Intensity of matcha taste' },
  { key: 'vibe', label: 'Vibe of the cafe' },
  { key: 'value', label: 'Value for money' },
] as const;
export const MILK_OPTIONS = MILKS.map((m) => ({
  key: m,
  label: m.charAt(0).toUpperCase() + m.slice(1),
}));

export interface TasteQuiz {
  sweetness: string;
  milk: string;
  adventurousness: string;
  frequency: string;
  priority: string;
}

export interface Profile {
  id: string;
  display_name: string;
  about_me: string | null;
  avatar_path: string | null;
  quiz: Partial<TasteQuiz>;
}
```

And add to the `Review` interface (after `id: string;`):

```ts
  user_id: string;
```

plus, at the end of the interface (after `cafe?: Cafe;`):

```ts
  profile?: Profile; // joined client-side by user_id
```

- [ ] **Step 2: Fix fixtures broken by the new required field**

Run: `npx tsc -b --noEmit`. For every error `Property 'user_id' is missing in type ... 'Review'`, add `user_id: 'u1',` to that object literal (expected in `Dashboard.test.tsx` `makeReview`, and possibly `ReviewDetail.test.tsx`, `CafeStack.test.tsx`, `nearMe.test.ts`). Re-run until clean.

- [ ] **Step 3: Write the failing initials tests**

`app/src/lib/profile.test.ts`:

```ts
import { initialsFrom } from './profile';

describe('initialsFrom', () => {
  it('takes first letters of the first two words, uppercased', () => {
    expect(initialsFrom('Justina Gardiner')).toBe('JG');
  });
  it('single word gives one letter', () => {
    expect(initialsFrom('Justina')).toBe('J');
  });
  it('ignores extra whitespace and later words', () => {
    expect(initialsFrom('  mary  jane  watson ')).toBe('MJ');
  });
  it('falls back to ? for empty input', () => {
    expect(initialsFrom('   ')).toBe('?');
  });
});
```

- [ ] **Step 4: Run — expect FAIL** (`npx vitest run src/lib/profile.test.ts`, module not found)

- [ ] **Step 5: Implement `app/src/lib/profile.ts`**

```ts
import { supabase } from './supabase';
import { downscalePhoto } from './api';
import type { Profile, TasteQuiz } from './types';

export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

export async function fetchOwnProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Not signed in');
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return (data as Profile[] | null) ?? [];
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

// Avatars live in the same private bucket as review photos; smaller edge —
// they only ever render as a circle.
export async function uploadAvatar(blob: Blob, userId: string): Promise<string> {
  const small = await downscalePhoto(blob, 800);
  const path = `avatars/${userId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('photos').upload(path, small);
  if (error) throw error;
  return path;
}

export interface ProfileInput {
  display_name: string;
  about_me: string | null;
  avatar_path: string | null;
  quiz: TasteQuiz;
}

// Upsert = same call path for first-time setup (insert) and later edits
// (update); RLS restricts both to the caller's own row.
export async function saveProfile(input: ProfileInput): Promise<Profile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Not signed in');
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userData.user.id, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}
```

- [ ] **Step 6: Run — expect PASS**, plus `npx vitest run` (all suites) and `npx tsc -b --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/profile.ts src/lib/profile.test.ts src/pages/Dashboard.test.tsx
git commit -m "feat: profile types and profile lib with initials derivation"
```

(Also `git add` any other test files touched in Step 2.)

---

### Task 5: Reviewer stats (TDD, pure functions)

**Files:**
- Create: `app/src/lib/reviewerStats.ts`
- Test: `app/src/lib/reviewerStats.test.ts`

- [ ] **Step 1: Write the failing tests**

`app/src/lib/reviewerStats.test.ts`:

```ts
import { computeStats } from './reviewerStats';
import type { Cafe, Review } from './types';

function cafe(id: string, name: string): Cafe {
  return { id, name, address: null, suburb: null, latitude: null, longitude: null, google_place_id: null };
}

function review(over: Partial<Review>): Review {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1',
    cafe_id: 'c1', photo_path: null, drank_at: '2026-06-01T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: null, milk: null, drink_style: null, size: null,
    price: 6, occasions: [], note: null, status: 'complete', cafe: cafe('c1', 'Cafe A'),
    ...over,
  };
}

describe('computeStats', () => {
  it('returns the empty shape for no reviews', () => {
    const s = computeStats([]);
    expect(s.matchaCount).toBe(0);
    expect(s.favouriteCafe).toBeNull();
    expect(s.usualMilk).toBeNull();
    expect(s.serveLean).toBeNull();
    expect(s.avgOverall).toBeNull();
    expect(s.priciest).toBeNull();
  });

  it('ignores drafts', () => {
    const s = computeStats([review({ status: 'draft' })]);
    expect(s.matchaCount).toBe(0);
  });

  it('counts matchas and distinct cafes', () => {
    const b = cafe('c2', 'Cafe B');
    const s = computeStats([review({}), review({}), review({ cafe_id: 'c2', cafe: b })]);
    expect(s.matchaCount).toBe(3);
    expect(s.cafeCount).toBe(2);
  });

  it('favourite cafe is the most visited; ties go to the most recent visit', () => {
    const b = cafe('c2', 'Cafe B');
    const s = computeStats([
      review({ drank_at: '2026-01-01T10:00:00Z' }),
      review({ cafe_id: 'c2', cafe: b, drank_at: '2026-06-01T10:00:00Z' }),
    ]);
    expect(s.favouriteCafe).toBe('Cafe B');
  });

  it('usual milk is the most common non-null milk', () => {
    const s = computeStats([review({ milk: 'oat' }), review({ milk: 'oat' }), review({ milk: 'dairy' })]);
    expect(s.usualMilk).toBe('oat');
  });

  it('serve lean reads mostly hot / mostly iced / mixed', () => {
    expect(computeStats([review({ temperature: 'hot' }), review({ temperature: 'hot' })]).serveLean).toBe('mostly hot');
    expect(computeStats([review({ temperature: 'iced' }), review({ temperature: 'iced' })]).serveLean).toBe('mostly iced');
    expect(computeStats([review({ temperature: 'hot' }), review({ temperature: 'iced' })]).serveLean).toBe('mixed');
    expect(computeStats([review({})]).serveLean).toBeNull();
  });

  it('averages overall to one decimal and finds the priciest matcha', () => {
    const b = cafe('c2', 'Cafe B');
    const s = computeStats([review({ overall: 4, price: 6 }), review({ overall: 5, price: 9.5, cafe_id: 'c2', cafe: b })]);
    expect(s.avgOverall).toBe('4.5');
    expect(s.priciest).toEqual({ price: 9.5, cafeName: 'Cafe B' });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

- [ ] **Step 3: Implement `app/src/lib/reviewerStats.ts`**

```ts
import type { Review } from './types';

export interface ReviewerStats {
  matchaCount: number;
  cafeCount: number;
  favouriteCafe: string | null;
  usualMilk: string | null;
  serveLean: 'mostly hot' | 'mostly iced' | 'mixed' | null;
  avgOverall: string | null;
  priciest: { price: number; cafeName: string } | null;
}

// All stats derive from the reviewer's completed reviews — free, no services.
export function computeStats(reviews: Review[]): ReviewerStats {
  const done = reviews.filter((r) => r.status === 'complete');

  const byCafe = new Map<string, { name: string; count: number; last: string }>();
  for (const r of done) {
    if (!r.cafe_id || !r.cafe) continue;
    const cur = byCafe.get(r.cafe_id) ?? { name: r.cafe.name, count: 0, last: '' };
    cur.count += 1;
    if (r.drank_at > cur.last) cur.last = r.drank_at;
    byCafe.set(r.cafe_id, cur);
  }
  const fav = [...byCafe.values()].sort(
    (a, b) => b.count - a.count || b.last.localeCompare(a.last)
  )[0];

  const milkCounts = new Map<string, number>();
  for (const r of done) if (r.milk) milkCounts.set(r.milk, (milkCounts.get(r.milk) ?? 0) + 1);
  const usualMilk = [...milkCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const hot = done.filter((r) => r.temperature === 'hot').length;
  const iced = done.filter((r) => r.temperature === 'iced').length;
  let serveLean: ReviewerStats['serveLean'] = null;
  if (hot + iced > 0) {
    const hotShare = hot / (hot + iced);
    serveLean = hotShare >= 0.6 ? 'mostly hot' : hotShare <= 0.4 ? 'mostly iced' : 'mixed';
  }

  const avgOverall = done.length
    ? (done.reduce((a, r) => a + Number(r.overall), 0) / done.length).toFixed(1)
    : null;

  let priciest: ReviewerStats['priciest'] = null;
  for (const r of done) {
    if (!priciest || Number(r.price) > priciest.price) {
      priciest = { price: Number(r.price), cafeName: r.cafe?.name ?? 'Unknown cafe' };
    }
  }

  return {
    matchaCount: done.length,
    cafeCount: byCafe.size,
    favouriteCafe: fav?.name ?? null,
    usualMilk,
    serveLean,
    avgOverall,
    priciest,
  };
}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run src/lib/reviewerStats.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reviewerStats.ts src/lib/reviewerStats.test.ts
git commit -m "feat: reviewer stats derived from review history"
```

---

### Task 6: Profile form + Welcome page + first-sign-in gate (TDD)

**Files:**
- Create: `app/src/components/ProfileForm.tsx`, `app/src/pages/Welcome.tsx`
- Modify: `app/src/App.tsx`
- Test: `app/src/components/ProfileForm.test.tsx`, `app/src/App.test.tsx`

- [ ] **Step 1: Write the failing ProfileForm tests**

`app/src/components/ProfileForm.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileForm from './ProfileForm';
import type { Profile } from '../lib/types';

const saveProfile = vi.fn();
vi.mock('../lib/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/profile')>()),
  saveProfile: (...args: unknown[]) => saveProfile(...args),
  uploadAvatar: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ remove: vi.fn().mockResolvedValue({ error: null }), createSignedUrl: vi.fn().mockResolvedValue({ data: null }) }) } },
}));

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Justina Gardiner' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lightly sweet' }));
  fireEvent.click(screen.getByRole('button', { name: 'Oat' }));
  fireEvent.click(screen.getByRole('button', { name: "I'll branch out sometimes" }));
  fireEvent.click(screen.getByRole('button', { name: 'Weekly treat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Taste' }));
}

describe('ProfileForm', () => {
  it('disables save until name and all five taste answers are given', () => {
    render(<ProfileForm initial={null} onSaved={() => {}} />);
    const save = screen.getByRole('button', { name: /save/i });
    expect(save.hasAttribute('disabled')).toBe(true);
    fillRequired();
    expect(save.hasAttribute('disabled')).toBe(false);
  });

  it('saves the profile and reports it back', async () => {
    const saved: Profile = {
      id: 'u1', display_name: 'Justina Gardiner', about_me: null, avatar_path: null,
      quiz: { sweetness: 'lightly_sweet', milk: 'oat', adventurousness: 'sometimes', frequency: 'weekly', priority: 'taste' },
    };
    saveProfile.mockResolvedValue(saved);
    const onSaved = vi.fn();
    render(<ProfileForm initial={null} onSaved={onSaved} />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: 'Justina Gardiner',
        quiz: { sweetness: 'lightly_sweet', milk: 'oat', adventurousness: 'sometimes', frequency: 'weekly', priority: 'taste' },
      })
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/components/ProfileForm.test.tsx`)

- [ ] **Step 3: Implement `app/src/components/ProfileForm.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { saveProfile, uploadAvatar } from '../lib/profile';
import {
  MILK_OPTIONS, SWEETNESS_PREFS, ADVENTUROUSNESS, FREQUENCY, PRIORITIES,
  type Profile, type TasteQuiz,
} from '../lib/types';
import SignedImage from './SignedImage';

interface Props {
  initial: Profile | null; // null = first-time setup; Profile = editing
  onSaved: (p: Profile) => void;
  onCancel?: () => void;
}

function ChoiceGroup({ label, options, value, onChange }: {
  label: string;
  options: readonly { key: string; label: string }[];
  value: string | undefined;
  onChange: (key: string) => void;
}) {
  return (
    <div>
      <p className="pb-2 text-sm text-sand-ink">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key} type="button" aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${value === o.key ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProfileForm({ initial, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.display_name ?? '');
  const [aboutMe, setAboutMe] = useState(initial?.about_me ?? '');
  const [quiz, setQuiz] = useState<Partial<TasteQuiz>>(initial?.quiz ?? {});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<'photo' | 'save' | null>(null);

  useEffect(() => {
    return () => { if (photoUrl) URL.revokeObjectURL(photoUrl); };
  }, [photoUrl]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    e.target.value = '';
  }

  const setAnswer = (k: keyof TasteQuiz) => (v: string) => setQuiz({ ...quiz, [k]: v });
  const quizComplete = (['sweetness', 'milk', 'adventurousness', 'frequency', 'priority'] as const)
    .every((k) => quiz[k]);
  const canSave = name.trim().length > 0 && quizComplete && !busy;

  async function onSave() {
    setBusy(true);
    setFailed(null);
    let avatarPath = initial?.avatar_path ?? null;
    if (photo) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        avatarPath = await uploadAvatar(photo, userData.user?.id ?? 'me');
      } catch {
        setFailed('photo');
        setBusy(false);
        return;
      }
    }
    try {
      const saved = await saveProfile({
        display_name: name.trim(),
        about_me: aboutMe.trim() || null,
        avatar_path: avatarPath,
        quiz: quiz as TasteQuiz,
      });
      // Best-effort cleanup of a replaced avatar (same stance as review photos).
      if (photo && initial?.avatar_path && initial.avatar_path !== avatarPath) {
        const { error } = await supabase.storage.from('photos').remove([initial.avatar_path]);
        if (error) console.warn('avatar cleanup failed:', error.message);
      }
      onSaved(saved);
    } catch {
      setFailed('save');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 px-6 pb-10">
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt="Your profile photo" className="h-20 w-20 rounded-full object-cover" />
        ) : initial?.avatar_path ? (
          <SignedImage path={initial.avatar_path} alt="Your profile photo" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-matcha-mist text-sm text-matcha-deep">Photo</div>
        )}
        <div className="space-y-1">
          <label className="block cursor-pointer text-sm text-matcha-deep underline">
            {photoUrl || initial?.avatar_path ? 'Change photo' : 'Add a photo (optional)'}
            <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
          </label>
          {photo && (
            <button type="button" className="block text-sm text-ink/60 underline"
              onClick={() => { setPhoto(null); setPhotoUrl(null); setFailed(null); }}>
              Remove new photo
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="profile-name" className="block pb-2 text-sm text-sand-ink">Name</label>
        <input
          id="profile-name" type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-sand bg-white p-3"
        />
      </div>

      <div>
        <label htmlFor="profile-about" className="block pb-2 text-sm text-sand-ink">About me (optional)</label>
        <textarea
          id="profile-about" value={aboutMe} rows={3}
          onChange={(e) => setAboutMe(e.target.value)}
          className="w-full rounded-xl border border-sand bg-white p-3"
          placeholder="A sentence or two about your matcha journey…"
        />
      </div>

      <ChoiceGroup label="How sweet do you like it?" options={SWEETNESS_PREFS} value={quiz.sweetness} onChange={setAnswer('sweetness')} />
      <ChoiceGroup label="Go-to milk" options={MILK_OPTIONS} value={quiz.milk} onChange={setAnswer('milk')} />
      <ChoiceGroup label="How adventurous are you?" options={ADVENTUROUSNESS} value={quiz.adventurousness} onChange={setAnswer('adventurousness')} />
      <ChoiceGroup label="How often do you drink matcha?" options={FREQUENCY} value={quiz.frequency} onChange={setAnswer('frequency')} />
      <ChoiceGroup label="What matters most?" options={PRIORITIES} value={quiz.priority} onChange={setAnswer('priority')} />

      <button
        type="button" disabled={!canSave} onClick={onSave}
        className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream disabled:opacity-40"
      >
        {busy ? 'Saving…' : 'Save profile'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="w-full p-2 text-sm text-ink/60 underline">
          Cancel
        </button>
      )}
      {failed === 'photo' && (
        <p className="text-sm text-red-700">Your photo didn't upload — try again, or remove it and save without a photo for now.</p>
      )}
      {failed === 'save' && (
        <p className="text-sm text-red-700">Couldn't save. Check your connection and try again.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run src/components/ProfileForm.test.tsx`)

- [ ] **Step 5: Create `app/src/pages/Welcome.tsx`**

```tsx
import type { Profile } from '../lib/types';
import ProfileForm from '../components/ProfileForm';

// First-sign-in gate target: rendered instead of the app until a profile
// row exists (required setup — spec 2026-07-12).
export default function Welcome({ onSaved }: { onSaved: (p: Profile) => void }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="px-6 pt-8 pb-2">
        <h1 className="font-display text-2xl">Matcha Muse</h1>
      </header>
      <div className="px-6 pb-4">
        <h2 className="font-display text-xl">Welcome — tell us your taste</h2>
        <p className="pt-1 text-sm text-ink/60">
          A one-off setup so your reviews carry your name. Takes a minute.
        </p>
      </div>
      <ProfileForm initial={null} onSaved={onSaved} />
    </div>
  );
}
```

- [ ] **Step 6: Write the failing gate tests**

`app/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';
import type { Profile } from './lib/types';

const fetchOwnProfile = vi.fn();
vi.mock('./lib/profile', () => ({ fetchOwnProfile: () => fetchOwnProfile() }));
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));
vi.mock('./lib/offlineQueue', () => ({ flush: vi.fn() }));
vi.mock('./lib/api', () => ({ submitQueued: vi.fn() }));
vi.mock('./pages/Dashboard', () => ({ default: () => <div>JOURNAL-PAGE</div> }));
vi.mock('./pages/Welcome', () => ({ default: () => <div>WELCOME-PAGE</div> }));

describe('first-sign-in profile gate', () => {
  it('shows the Welcome setup when the user has no profile yet', async () => {
    fetchOwnProfile.mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByText('WELCOME-PAGE')).toBeDefined();
    expect(screen.queryByText('JOURNAL-PAGE')).toBeNull();
  });

  it('shows the app when a profile exists', async () => {
    const p: Profile = { id: 'u1', display_name: 'Justina', about_me: null, avatar_path: null, quiz: {} };
    fetchOwnProfile.mockResolvedValue(p);
    render(<App />);
    expect(await screen.findByText('JOURNAL-PAGE')).toBeDefined();
  });

  it('shows a retry message when the profile lookup fails', async () => {
    fetchOwnProfile.mockRejectedValue(new Error('network'));
    render(<App />);
    expect(await screen.findByRole('button', { name: /try again/i })).toBeDefined();
  });
});
```

- [ ] **Step 7: Run — expect FAIL** (Welcome never rendered by App yet)

- [ ] **Step 8: Add the gate + new routes to `app/src/App.tsx`**

Replace the whole file with:

```tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { flush } from './lib/offlineQueue';
import { submitQueued } from './lib/api';
import { fetchOwnProfile } from './lib/profile';
import type { Profile } from './lib/types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewReview from './pages/NewReview';
import NearMe from './pages/NearMe';
import ReviewDetail from './pages/ReviewDetail';
import Welcome from './pages/Welcome';
import Reviewers from './pages/Reviewers';
import ReviewerProfile from './pages/ReviewerProfile';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // undefined = loading, null = no profile yet (gate), Profile = ready
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [profileError, setProfileError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setProfileError(false);
    fetchOwnProfile()
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setProfileError(true); });
    return () => { cancelled = true; };
  }, [session, attempt]);

  useEffect(() => {
    if (!session) return;
    const sync = () => { void flush(submitQueued); };
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (profileError) {
    return (
      <div className="min-h-screen bg-cream px-6 py-16 text-center text-ink">
        <p className="text-ink/60">Couldn't load your profile — check your connection.</p>
        <button
          type="button"
          onClick={() => { setProfile(undefined); setAttempt((a) => a + 1); }}
          className="mt-4 rounded-xl bg-matcha-deep px-5 py-2.5 text-cream"
        >
          Try again
        </button>
      </div>
    );
  }
  if (profile === undefined) return null;
  if (profile === null) return <Welcome onSaved={setProfile} />;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-cream text-ink">
        <header className="px-6 pt-8 pb-2">
          <h1 className="font-display text-2xl">
            <Link to="/">Matcha Muse</Link>
          </h1>
          <nav className="mt-2 flex gap-2" aria-label="View">
            {[{ to: '/', label: 'Journal' }, { to: '/near', label: 'Near me' }].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `rounded-full px-4 py-1.5 text-sm ${isActive ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewReview />} />
          <Route path="/near" element={<NearMe />} />
          <Route path="/review/:id" element={<ReviewDetail />} />
          <Route path="/reviewers" element={<Reviewers />} />
          <Route path="/reviewer/:id" element={<ReviewerProfile />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
```

**Note:** `Reviewers` and `ReviewerProfile` don't exist until Task 8. To keep this task green, create minimal placeholders now (Task 8 replaces them):

`app/src/pages/Reviewers.tsx`:
```tsx
export default function Reviewers() {
  return <p className="px-6 text-ink/60">Brewing…</p>;
}
```

`app/src/pages/ReviewerProfile.tsx`:
```tsx
export default function ReviewerProfile() {
  return <p className="px-6 text-ink/60">Brewing…</p>;
}
```

- [ ] **Step 9: Run — expect PASS**: `npx vitest run` (all), `npx tsc -b --noEmit` clean.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/pages/Welcome.tsx src/components/ProfileForm.tsx src/components/ProfileForm.test.tsx src/pages/Reviewers.tsx src/pages/ReviewerProfile.tsx
git commit -m "feat: first-sign-in taste quiz gate and profile form"
```

---

### Task 7: Journal initials badges, reviewer filter, Reviewers link (TDD)

**Files:**
- Modify: `app/src/pages/Dashboard.tsx`
- Test: `app/src/pages/Dashboard.test.tsx`

- [ ] **Step 1: Update the supabase mock and helpers in `Dashboard.test.tsx`**

Dashboard will now also fetch `profiles`. Replace the mock + `renderDashboard` at the top of the file:

```tsx
const order = vi.fn();
const profilesSelect = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) =>
      table === 'profiles'
        ? { select: () => profilesSelect() }
        : { select: () => ({ order: () => order() }) },
  },
}));
```

and:

```tsx
import type { Cafe, Profile, Review } from '../lib/types';

const justina: Profile = { id: 'u1', display_name: 'Justina Gardiner', about_me: null, avatar_path: null, quiz: {} };
const sam: Profile = { id: 'u2', display_name: 'Sam Lee', about_me: null, avatar_path: null, quiz: {} };

function renderDashboard(reviews: Review[], profiles: Profile[] = [justina]) {
  order.mockResolvedValue({ data: reviews, error: null });
  profilesSelect.mockResolvedValue({ data: profiles, error: null });
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}
```

(`makeReview` already sets `user_id: 'u1'` from Task 4.)

- [ ] **Step 2: Write the failing tests** (append to the describe block)

```tsx
  it('shows the reviewer initials badge linking to their profile', async () => {
    const r = makeReview({});
    renderDashboard([r]);
    const badge = await screen.findByRole('link', { name: /justina gardiner's profile/i });
    expect(badge.textContent).toBe('JG');
    expect(badge.getAttribute('href')).toBe('/reviewer/u1');
  });

  it('hides reviewer chips while there is only one reviewer', async () => {
    renderDashboard([makeReview({})]);
    await screen.findAllByRole('link');
    expect(screen.queryByRole('group', { name: /reviewer/i })).toBeNull();
  });

  it('filters cards and stat tiles by reviewer chip', async () => {
    const mine = makeReview({});
    const theirs = makeReview({ user_id: 'u2', overall: 2 });
    renderDashboard([mine, theirs], [justina, sam]);

    const chips = await screen.findByRole('group', { name: /reviewer/i });
    expect(chips).toBeDefined();
    // Both cards visible under "All"
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'))).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Sam Lee' }));
    const cards = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'));
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('href')).toBe(`/review/${theirs.id}`);
    // Stat tiles follow the filter: 1 matcha + 1 cafe tiles, avg 2.0
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText('2.0')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/review/'))).toHaveLength(2);
  });

  it('links to the reviewers list below the grid', async () => {
    renderDashboard([makeReview({})]);
    const link = await screen.findByRole('link', { name: /^reviewers$/i });
    expect(link.getAttribute('href')).toBe('/reviewers');
  });
```

- [ ] **Step 3: Run — expect the new tests to FAIL**

- [ ] **Step 4: Implement in `app/src/pages/Dashboard.tsx`**

Replace the whole file with:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Profile, Review } from '../lib/types';
import { initialsFrom } from '../lib/profile';
import { directionsUrl } from '../lib/googleLinks';
import SignedImage from '../components/SignedImage';
import NewFab from '../components/NewFab';

export default function Dashboard() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [showDraftsOnly, setShowDraftsOnly] = useState(false);
  const [reviewer, setReviewer] = useState<string>('all');

  useEffect(() => {
    Promise.all([
      supabase.from('reviews').select('*, cafe:cafes(*)').order('drank_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]).then(([r, p]) => {
      if (r.error) { setFetchError(true); setReviews([]); return; }
      setReviews((r.data as Review[] | null) ?? []);
      // Profile fetch failure is non-fatal: the journal still works,
      // badges and chips just don't appear.
      if (!p.error) setProfiles((p.data as Profile[] | null) ?? []);
    });
  }, []);

  if (reviews === null) return <p className="px-6 text-ink/60">Brewing…</p>;
  if (fetchError) return <p className="px-6 py-10 text-center text-ink/60">Couldn't load your journal — check your connection and try again.</p>;

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const reviewerIds = [...new Set(reviews.map((r) => r.user_id))]
    .filter((id) => profileById.has(id));

  const avg = (xs: number[]) =>
    xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '–';
  const byReviewer = reviewer === 'all' ? reviews : reviews.filter((r) => r.user_id === reviewer);
  const cafeCount = new Set(byReviewer.map((r) => r.cafe_id).filter(Boolean)).size;
  const drafts = byReviewer.filter((r) => r.status === 'draft');
  const visible = showDraftsOnly && drafts.length > 0 ? drafts : byReviewer;

  return (
    <div className="px-6 pb-24">
      <div className="grid grid-cols-3 gap-3 py-4">
        <Stat label="Matchas" value={String(byReviewer.length)} />
        <Stat label="Cafes" value={String(cafeCount)} />
        <Stat label="Avg score" value={avg(byReviewer.map((r) => Number(r.overall)))} />
      </div>

      {reviewerIds.length >= 2 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Reviewer">
          <button
            type="button" aria-pressed={reviewer === 'all'} onClick={() => setReviewer('all')}
            className={`rounded-full px-4 py-1.5 text-sm ${reviewer === 'all' ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
          >
            All
          </button>
          {reviewerIds.map((id) => (
            <button
              key={id} type="button" aria-pressed={reviewer === id} onClick={() => setReviewer(id)}
              className={`rounded-full px-4 py-1.5 text-sm ${reviewer === id ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
            >
              {profileById.get(id)!.display_name}
            </button>
          ))}
        </div>
      )}

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

      {reviews.length === 0 && (
        <p className="py-10 text-center text-ink/60">Your first matcha awaits — tap the + to begin.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {visible.map((r) => {
          const c = r.cafe;
          const p = profileById.get(r.user_id);
          const hasDirections =
            c && c.latitude != null && c.longitude != null && c.google_place_id != null;
          return (
            <div key={r.id} className="relative overflow-hidden rounded-2xl border border-sand bg-white">
              <Link to={`/review/${r.id}`} className="block">
                <div className="relative">
                  <SignedImage path={r.photo_path} alt={c?.name ?? 'Matcha'} className="h-36 w-full object-cover" />
                  {r.status === 'draft' && (
                    <span className="absolute left-2 top-2 rounded-full bg-sand px-2 py-0.5 text-xs text-sand-ink">Draft</span>
                  )}
                </div>
                <div className="p-3 pb-1">
                  <p className="truncate font-display">{c?.name ?? 'Unknown cafe'}</p>
                  <p className="text-sm text-ink/60">
                    {Number(r.overall).toFixed(1)} ★ · ${Number(r.price).toFixed(2)}
                  </p>
                </div>
              </Link>
              {p && (
                <Link
                  to={`/reviewer/${r.user_id}`}
                  aria-label={`${p.display_name}'s profile`}
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-xs font-medium text-cream backdrop-blur"
                >
                  {initialsFrom(p.display_name)}
                </Link>
              )}
              {hasDirections ? (
                <a
                  href={directionsUrl(c.latitude!, c.longitude!, c.google_place_id!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center px-3 pb-1 text-sm text-matcha-deep underline"
                >
                  Directions ↗
                </a>
              ) : (
                <div className="pb-2" />
              )}
            </div>
          );
        })}
      </div>

      <Link to="/reviewers" className="mt-6 block text-center text-sm text-ink/60 underline">
        Reviewers
      </Link>

      <NewFab />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sand/50 p-3 text-center">
      <p className="font-display text-xl">{value}</p>
      <p className="text-xs text-sand-ink">{label}</p>
    </div>
  );
}
```

(The initials badge sits top-right of the photo — opposite the Draft badge — as a **sibling** of the card Link, absolutely positioned over it, so tapping it opens the profile, not the review.)

- [ ] **Step 5: Run — expect ALL Dashboard tests PASS**, `npx vitest run` all green, `npx tsc -b --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx
git commit -m "feat: reviewer initials, filter chips, reviewers link on journal"
```

---

### Task 8: Reviewer profile page + Reviewers list (TDD)

**Files:**
- Replace placeholders: `app/src/pages/ReviewerProfile.tsx`, `app/src/pages/Reviewers.tsx`
- Test: `app/src/pages/ReviewerProfile.test.tsx`

- [ ] **Step 1: Write the failing tests**

`app/src/pages/ReviewerProfile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReviewerProfile from './ReviewerProfile';
import type { Profile, Review } from '../lib/types';

const profileResult = vi.fn();
const reviewsResult = vi.fn();
const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    from: (table: string) =>
      table === 'profiles'
        ? { select: () => ({ eq: () => ({ maybeSingle: () => profileResult() }) }) }
        : { select: () => ({ eq: () => ({ eq: () => reviewsResult() }) }) },
    storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null }) }) },
  },
}));

const sam: Profile = {
  id: 'u2', display_name: 'Sam Lee', about_me: 'Oat latte devotee.', avatar_path: null,
  quiz: { sweetness: 'lightly_sweet', milk: 'oat', adventurousness: 'anything', frequency: 'weekly', priority: 'intensity' },
};

function makeReview(over: Partial<Review>): Review {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u2',
    cafe_id: 'c1', photo_path: null, drank_at: '2026-06-20T10:00:00Z',
    overall: 4, taste: null, sweetness: null, texture: null,
    temperature: 'iced', milk: 'oat', drink_style: null, size: null,
    price: 6, occasions: [], note: null, status: 'complete',
    cafe: { id: 'c1', name: 'Cafe A', address: null, suburb: null, latitude: null, longitude: null, google_place_id: null },
    ...over,
  };
}

function renderPage(profile: Profile | null, reviews: Review[], ownId = 'u1') {
  profileResult.mockResolvedValue({ data: profile, error: null });
  reviewsResult.mockResolvedValue({ data: reviews, error: null });
  getUser.mockResolvedValue({ data: { user: { id: ownId } }, error: null });
  render(
    <MemoryRouter initialEntries={['/reviewer/u2']}>
      <Routes>
        <Route path="/reviewer/:id" element={<ReviewerProfile />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReviewerProfile', () => {
  it('shows name, about-me, quiz answers as labels, and derived stats', async () => {
    renderPage(sam, [makeReview({}), makeReview({ price: 9.5 })]);
    expect(await screen.findByText('Sam Lee')).toBeDefined();
    expect(screen.getByText('Oat latte devotee.')).toBeDefined();
    expect(screen.getByText('Intensity of matcha taste')).toBeDefined(); // quiz label, not key
    expect(screen.getByText('Cafe A')).toBeDefined(); // favourite cafe
    expect(screen.getByText(/\$9\.50/)).toBeDefined(); // priciest
  });

  it('shows the empty-stats state for a reviewer with no matchas', async () => {
    renderPage(sam, []);
    expect(await screen.findByText(/no matchas logged yet/i)).toBeDefined();
  });

  it('offers Edit profile only on your own page', async () => {
    renderPage(sam, [makeReview({})], 'u2'); // viewing own profile
    expect(await screen.findByRole('button', { name: /edit profile/i })).toBeDefined();
  });

  it('hides Edit profile on someone else\'s page', async () => {
    renderPage(sam, [makeReview({})], 'u1');
    await screen.findByText('Sam Lee');
    expect(screen.queryByRole('button', { name: /edit profile/i })).toBeNull();
  });

  it('explains when a profile does not exist yet', async () => {
    renderPage(null, []);
    expect(await screen.findByText(/hasn't set up their profile yet/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (placeholder page renders none of this)

- [ ] **Step 3: Implement `app/src/pages/ReviewerProfile.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { computeStats } from '../lib/reviewerStats';
import { initialsFrom } from '../lib/profile';
import {
  SWEETNESS_PREFS, ADVENTUROUSNESS, FREQUENCY, PRIORITIES, MILK_OPTIONS,
  type Profile, type Review,
} from '../lib/types';
import SignedImage from '../components/SignedImage';
import BackToJournal from '../components/BackToJournal';
import ProfileForm from '../components/ProfileForm';

function quizLabel(
  options: readonly { key: string; label: string }[],
  key: string | undefined
): string | null {
  return options.find((o) => o.key === key)?.label ?? null;
}

function StatRow({ label, value }: { label: string; value: string | null }) {
  if (value == null) return null;
  return (
    <p className="text-sm">
      <span className="text-ink/60">{label}: </span>{value}
    </p>
  );
}

export default function ReviewerProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ownId, setOwnId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setProfile(undefined);
    setEditing(false);
    setLoadFailed(false);
    if (!id) return;
    Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('reviews').select('*, cafe:cafes(*)').eq('user_id', id).eq('status', 'complete'),
      supabase.auth.getUser(),
    ]).then(([p, r, u]) => {
      if (p.error || r.error) { setLoadFailed(true); return; }
      setProfile((p.data as Profile | null) ?? null);
      setReviews((r.data as Review[] | null) ?? []);
      setOwnId(u.data.user?.id ?? null);
    });
  }, [id]);

  if (loadFailed) {
    return <p className="px-6 py-10 text-center text-ink/60">Couldn't load this profile — check your connection and try again.</p>;
  }
  if (profile === undefined) return <p className="px-6 text-ink/60">Brewing…</p>;
  if (profile === null) {
    return (
      <div className="pt-2">
        <BackToJournal />
        <p className="px-6 py-10 text-center text-ink/60">This reviewer hasn't set up their profile yet.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="pt-2">
        <BackToJournal />
        <h2 className="px-6 pb-4 font-display text-xl">Edit profile</h2>
        <ProfileForm
          initial={profile}
          onSaved={(p) => { setProfile(p); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const stats = computeStats(reviews);
  const quizRows = [
    { label: 'Sweetness', value: quizLabel(SWEETNESS_PREFS, profile.quiz.sweetness) },
    { label: 'Go-to milk', value: quizLabel(MILK_OPTIONS, profile.quiz.milk) },
    { label: 'Adventurousness', value: quizLabel(ADVENTUROUSNESS, profile.quiz.adventurousness) },
    { label: 'Matcha habit', value: quizLabel(FREQUENCY, profile.quiz.frequency) },
    { label: 'What matters most', value: quizLabel(PRIORITIES, profile.quiz.priority) },
  ].filter((q) => q.value != null);

  return (
    <div className="pb-10 pt-2">
      <BackToJournal />
      <div className="flex items-center gap-4 px-6 py-4">
        {profile.avatar_path ? (
          <SignedImage path={profile.avatar_path} alt={`${profile.display_name}'s photo`} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-matcha-deep font-display text-xl text-cream">
            {initialsFrom(profile.display_name)}
          </div>
        )}
        <div>
          <h2 className="font-display text-xl">{profile.display_name}</h2>
          {profile.about_me && <p className="text-sm text-ink/70">{profile.about_me}</p>}
        </div>
      </div>

      {quizRows.length > 0 && (
        <div className="mx-6 mb-4 space-y-1 rounded-2xl bg-sand/50 p-4">
          <h3 className="pb-1 font-display">Taste profile</h3>
          {quizRows.map((q) => (
            <p key={q.label} className="text-sm">
              <span className="text-ink/60">{q.label}: </span>{q.value}
            </p>
          ))}
        </div>
      )}

      <div className="mx-6 space-y-1 rounded-2xl bg-sand/50 p-4">
        <h3 className="pb-1 font-display">From the journal</h3>
        {stats.matchaCount === 0 ? (
          <p className="text-sm text-ink/60">No matchas logged yet.</p>
        ) : (
          <>
            <StatRow label="Matchas logged" value={String(stats.matchaCount)} />
            <StatRow label="Cafes visited" value={String(stats.cafeCount)} />
            <StatRow label="Favourite cafe" value={stats.favouriteCafe} />
            <StatRow
              label="Usual order"
              value={[stats.usualMilk, stats.serveLean].filter(Boolean).join(', ') || null}
            />
            <StatRow label="Average score" value={stats.avgOverall ? `${stats.avgOverall} ★` : null} />
            <StatRow
              label="Priciest matcha"
              value={stats.priciest ? `$${stats.priciest.price.toFixed(2)} at ${stats.priciest.cafeName}` : null}
            />
          </>
        )}
      </div>

      {ownId === profile.id && (
        <div className="px-6 pt-4">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream"
          >
            Edit profile
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run src/pages/ReviewerProfile.test.tsx`)

- [ ] **Step 5: Implement `app/src/pages/Reviewers.tsx`** (replace placeholder)

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProfiles, initialsFrom } from '../lib/profile';
import type { Profile } from '../lib/types';
import SignedImage from '../components/SignedImage';
import BackToJournal from '../components/BackToJournal';

export default function Reviewers() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetchProfiles()
      .then(setProfiles)
      .catch(() => { setFetchError(true); setProfiles([]); });
  }, []);

  if (profiles === null) return <p className="px-6 text-ink/60">Brewing…</p>;
  if (fetchError) return <p className="px-6 py-10 text-center text-ink/60">Couldn't load reviewers — check your connection and try again.</p>;

  return (
    <div className="pb-10 pt-2">
      <BackToJournal />
      <h2 className="px-6 pb-4 font-display text-xl">Reviewers</h2>
      <div className="space-y-3 px-6">
        {profiles.map((p) => (
          <Link
            key={p.id}
            to={`/reviewer/${p.id}`}
            className="flex items-center gap-3 rounded-2xl border border-sand bg-white p-3"
          >
            {p.avatar_path ? (
              <SignedImage path={p.avatar_path} alt={`${p.display_name}'s photo`} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha-deep text-sm text-cream">
                {initialsFrom(p.display_name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display">{p.display_name}</p>
              {p.about_me && <p className="truncate text-sm text-ink/60">{p.about_me}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Full verify**

Run: `npx vitest run` — all green. `npx tsc -b --noEmit` clean. `npm run build` clean.

- [ ] **Step 7: Commit**

```bash
git add src/pages/ReviewerProfile.tsx src/pages/ReviewerProfile.test.tsx src/pages/Reviewers.tsx
git commit -m "feat: reviewer profile page with derived stats, reviewers list"
```

---

### Task 9: Final review, deploy, on-device acceptance (partly HUMAN)

**Files:** none new — verification, deploy, docs.

- [ ] **Step 1: Whole-feature verification**

From `app/`: `npx vitest run` (all pass), `npx tsc -b --noEmit` (clean), `npm run build` (clean).

- [ ] **Step 2: Final whole-feature code review** (superpowers:requesting-code-review / code-reviewer subagent) against spec `docs/superpowers/specs/2026-07-12-shared-journal-design.md`. Apply any fixes, commit.

- [ ] **Step 3: Confirm the DB migration is applied** (Task 3 must be done and verified BEFORE deploying — the profile gate 404s against a missing `profiles` table otherwise).

- [ ] **Step 4: Deploy**

From `app/`:

```bash
npm run build
npx wrangler pages deploy dist --project-name matcha-muse --branch main --commit-dirty=true
```

Expected: deployment URL `https://matcha-muse.pages.dev`.

- [ ] **Step 5: On-device acceptance with Justina (guided, on her iPhone)**

1. Open the app → she should see the one-off **Welcome quiz** → complete it (name, optional photo, about-me, 5 answers) → lands on the journal.
2. Journal cards show her **JG initials badge**; tapping the badge opens her profile; tapping the card still opens the review.
3. A card for a cafe with location shows **Directions ↗** → opens Google Maps at the cafe.
4. **← Journal** appears on review detail, new review, and near me; header tap still works.
5. **Reviewers** link below the grid → her profile listed → profile shows quiz answers + real stats.
6. **Edit profile** works (change about-me; add/replace photo).
7. **Second user test**: guide her to create a test user in Supabase (Authentication → Users → Add user, email + password, auto-confirm). Sign in as that user in a private browser window (or her iPad/desktop): quiz gate appears → complete it → the test user **sees Justina's reviews**; log one test review → Justina sees it with the test user's initials; **reviewer chips now appear** and filter correctly.
8. **Draft privacy**: save a draft as the test user → confirm Justina cannot see it.
9. Anything surfaced: fix, re-test, re-deploy.

- [ ] **Step 6: Wrap the branch**

Use superpowers:finishing-a-development-branch — merge `feature/shared-journal` → `main`, push to `origin` (GitHub backup), update `docs/superpowers/HANDOFF.md` with the outcome.

```bash
git commit -m "chore: shared journal deployed, on-device acceptance run"
```
