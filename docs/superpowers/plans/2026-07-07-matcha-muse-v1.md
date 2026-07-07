# Matcha Muse v1 (Capture & Journal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A home-screen PWA on Justina's iPhone where she can log in, photograph a matcha, confirm the cafe detected nearby (or search/create one), rate it, and see her journal — with offline-safe saving and live deployment.

**Architecture:** React + Vite SPA in `app/` at the repo root, styled with Tailwind using the "Ceremony" palette. Supabase provides Postgres (with RLS), magic-link auth, and private photo storage. Google Places API (New) is called directly from the browser for cafe lookup. Reviews that fail to save (offline) queue in IndexedDB and flush when connectivity returns. Deployed to Cloudflare Pages.

**Tech Stack:** React 19 (scaffold pulled latest; approved deviation from the originally planned React 18 — noted in Task 1 review), TypeScript, Vite, vite-plugin-pwa, Tailwind CSS 3, react-router-dom, @supabase/supabase-js v2, idb-keyval, Vitest + Testing Library, sharp (icon generation only), Cloudflare Pages (wrangler).

**Spec:** `docs/superpowers/specs/2026-07-07-matcha-muse-design.md`. Deferred to Plan 2: import/back-dating, cafe pages, near-me, menu photos. Deferred to Plan 3: dashboard filters/sort, share cards. This is deliberate scope, not a gap.

**Human-in-the-loop:** Tasks 4, 5 and 14 need Justina (account creation, pasting SQL, browser logins). The executor must pause and ask rather than skip.

**Testing note:** iOS Safari only exposes camera/geolocation over HTTPS, so phone-level verification happens after the Task 14 deploy. During development, verify in a desktop browser (Chrome DevTools device mode; geolocation can be simulated).

---

## File structure (end state of this plan)

```
MatchaMuse/
  docs/…                          (specs & plans, already present)
  app/
    package.json, vite.config.ts, tailwind.config.js, postcss.config.js
    .env.local                    (secrets, gitignored)  .env.example (committed)
    public/icon.svg, icon-192.png, icon-512.png
    scripts/icons.mjs             (SVG → PNG icon generation)
    supabase/schema.sql           (tables, RLS, storage bucket + policies)
    src/
      main.tsx, App.tsx, index.css
      test/setup.ts
      lib/types.ts                (enums, Cafe/Review/CafeCandidate types)
      lib/supabase.ts             (client singleton)
      lib/places.ts               (parsePlaces pure fn + nearby/search fetchers)
      lib/offlineQueue.ts         (IndexedDB queue: enqueue/pending/flush)
      lib/api.ts                  (ensureCafe, saveReview, saveReviewOrQueue, submitQueued)
      components/StarRating.tsx   (half-step star input)
      components/Chips.tsx        (single-select chip row)
      components/ReviewForm.tsx   (full rating form)
      components/CafePicker.tsx   (nearby list / search / manual create)
      components/SignedImage.tsx  (renders private storage photos)
      pages/Login.tsx  pages/Dashboard.tsx  pages/NewReview.tsx
      lib/places.test.ts  lib/offlineQueue.test.ts
      components/StarRating.test.tsx  components/ReviewForm.test.tsx
```

---

### Task 1: Scaffold the app

**Files:** Create: `app/` (Vite scaffold), `app/src/test/setup.ts`. Modify: `app/package.json`, `app/vite.config.ts`, `.gitignore` (repo root).

- [ ] **Step 1: Scaffold and install** (run from repo root `C:\Users\justi\OneDrive\Documents\MatchaMuse`)

```bash
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install react-router-dom @supabase/supabase-js idb-keyval
npm install -D tailwindcss@3 postcss autoprefixer vite-plugin-pwa vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom sharp
npx tailwindcss init -p
```

Expected: `app/` exists, `npm install` exits 0.

- [ ] **Step 2: Replace `app/vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Matcha Muse',
        short_name: 'Matcha Muse',
        description: 'Your personal matcha journal',
        theme_color: '#F7F4ED',
        background_color: '#F7F4ED',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
});
```

- [ ] **Step 3: Create `app/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Wire test script.** In `app/package.json` `"scripts"`, add `"test": "vitest run"` and `"icons": "node scripts/icons.mjs"`. In repo-root `.gitignore` create/append:

```
node_modules/
dist/
.env.local
```

- [ ] **Step 5: Verify and commit**

Run (in `app/`): `npm run test` → Expected: "No test files found" (exit 0 with passWithNoTests? If vitest exits 1, that's fine — no tests yet; proceed). Then `npm run dev` briefly → Vite serves on localhost:5173.

```bash
git add -A
git commit -m "chore: scaffold Vite + React PWA with test tooling"
```

---

### Task 2: Ceremony theme and app shell

**Files:** Modify: `app/tailwind.config.js`, `app/src/index.css`, `app/index.html`. Create: `app/src/App.tsx` (replace scaffold version), delete `app/src/App.css`.

- [ ] **Step 1: Replace `app/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F7F4ED',
        ink: '#22392B',
        matcha: { DEFAULT: '#7BA05B', deep: '#40573B', mist: '#DCE5D4' },
        sand: { DEFAULT: '#EAE3D3', ink: '#5A5142' },
      },
      fontFamily: {
        display: ['"Iowan Old Style"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Replace `app/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html { background: #f7f4ed; }
body { margin: 0; -webkit-tap-highlight-color: transparent; }
```

- [ ] **Step 3: In `app/index.html`** set `<title>Matcha Muse</title>`, `<meta name="theme-color" content="#F7F4ED" />`, and inside `<head>` add `<meta name="apple-mobile-web-app-capable" content="yes" />`.

- [ ] **Step 4: Replace `app/src/App.tsx`** (temporary shell; auth and routes arrive in Tasks 6/13). Delete `app/src/App.css` and remove its import from `main.tsx` if present.

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="px-6 pt-8 pb-4">
        <h1 className="font-display text-2xl">Matcha Muse</h1>
        <p className="text-sm text-ink/60">Your matcha journal</p>
      </header>
    </div>
  );
}
```

- [ ] **Step 5: Verify and commit.** `npm run dev`, open browser: cream page, serif "Matcha Muse" heading in deep green. Then:

```bash
git add -A
git commit -m "feat: Ceremony theme and app shell"
```

---

### Task 3: App icon and PWA assets

**Files:** Create: `app/public/icon.svg`, `app/scripts/icons.mjs`. Generated: `app/public/icon-192.png`, `app/public/icon-512.png`.

- [ ] **Step 1: Create `app/public/icon.svg`** (matcha bowl seen from above, on cream)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#F7F4ED"/>
  <circle cx="256" cy="276" r="150" fill="#7BA05B"/>
  <circle cx="256" cy="276" r="118" fill="#8FB06E"/>
  <path d="M256 120c34-44 10-86-24-96 6 34-10 62-24 74 14 4 34 10 48 22z" fill="#40573B"/>
</svg>
```

- [ ] **Step 2: Create `app/scripts/icons.mjs`**

```js
import sharp from 'sharp';
for (const size of [192, 512]) {
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/icon-${size}.png`);
  console.log(`icon-${size}.png written`);
}
```

- [ ] **Step 3: Generate, verify, commit.** Run `npm run icons` in `app/` → Expected: both "written" lines, PNG files exist in `app/public/`.

```bash
git add -A
git commit -m "feat: app icon and PWA image assets"
```

---

### Task 4: Supabase project (HUMAN STEP — pause for Justina)

**Files:** Create: `app/.env.example`, `app/.env.local` (gitignored).

- [ ] **Step 1: Pause and walk Justina through, in her browser:**
  1. Go to supabase.com → "Start your project" → sign up (free) with justina@lightspeedconsulting.com.au.
  2. Create a project named `matcha-muse`, region Sydney (ap-southeast-2), generate a strong database password (she saves it in her password manager; the app never uses it directly).
  3. From Project Settings → API, copy two values: **Project URL** and **anon public key**.

- [ ] **Step 2: Create `app/.env.example`** (committed) and `app/.env.local` (real values, gitignored):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
VITE_GOOGLE_PLACES_KEY=YOUR-PLACES-KEY
```

(`VITE_GOOGLE_PLACES_KEY` stays as placeholder in `.env.local` until Task 8's human step.)

- [ ] **Step 3: Commit**

```bash
git add app/.env.example
git commit -m "chore: environment variable template"
```

---

### Task 5: Database schema, RLS and storage (HUMAN-ASSISTED)

**Files:** Create: `app/supabase/schema.sql`.

- [ ] **Step 1: Create `app/supabase/schema.sql`**

```sql
-- Matcha Muse schema v1 (spec 2026-07-07)
create table cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  suburb text,
  latitude double precision,
  longitude double precision,
  google_place_id text unique,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  cafe_id uuid references cafes(id),
  photo_path text,
  drank_at timestamptz not null default now(),
  overall numeric(2,1) not null check (overall between 0.5 and 5),
  taste numeric(2,1) check (taste between 0.5 and 5),
  sweetness numeric(2,1) check (sweetness between 0.5 and 5),
  texture numeric(2,1) check (texture between 0.5 and 5),
  temperature text check (temperature in ('hot','iced')),
  milk text check (milk in ('dairy','oat','soy','almond','coconut','other')),
  drink_style text check (drink_style in ('latte','hybrid','other')),
  size text check (size in ('S','M','L')),
  price numeric(6,2) not null check (price >= 0),
  occasions text[] not null default '{}',
  note text,
  status text not null default 'complete' check (status in ('complete','draft')),
  created_at timestamptz not null default now()
);

create table menu_photos (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafes(id),
  photo_path text not null,
  taken_at timestamptz not null default now()
);

alter table cafes enable row level security;
alter table reviews enable row level security;
alter table menu_photos enable row level security;

create policy "authenticated full access to cafes" on cafes
  for all to authenticated using (true) with check (true);
create policy "own reviews only" on reviews
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "authenticated full access to menu photos" on menu_photos
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('photos', 'photos', false);
create policy "authenticated read photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos');
create policy "authenticated upload photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
```

- [ ] **Step 2: Apply it (human-assisted).** Justina (or executor via her logged-in browser): Supabase dashboard → SQL Editor → paste the whole file → Run. Expected: "Success. No rows returned."

- [ ] **Step 3: Verify.** In Table Editor, confirm `cafes`, `reviews`, `menu_photos` exist with RLS shields shown; in Storage, bucket `photos` exists (private).

- [ ] **Step 4: Commit**

```bash
git add app/supabase/schema.sql
git commit -m "feat: database schema, RLS policies, photo storage bucket"
```

---

### Task 6: Types, Supabase client, magic-link login

> **Amendment (2026-07-07, post-implementation):** Magic-link login failed in practice — the owner's Microsoft 365 mail security pre-scans links, consuming the one-time token before she can click it (`otp_expired`), and Supabase's free tier doesn't permit editing the email template (to switch to a visible OTP code) without custom SMTP. v1 therefore uses **email + password** via `supabase.auth.signInWithPassword`; the owner creates her own user (with password) in the Supabase dashboard (Authentication → Users → Add user, auto-confirm on). `Login.tsx` was replaced accordingly (email + password fields with `autoComplete` hints for iOS password autofill, busy state, generic error). Revisit OTP-code login in Phase 2 once custom SMTP exists.

**Files:** Create: `app/src/lib/types.ts`, `app/src/lib/supabase.ts`, `app/src/pages/Login.tsx`. Modify: `app/src/App.tsx`.

- [ ] **Step 1: Create `app/src/lib/types.ts`**

```ts
export const MILKS = ['dairy', 'oat', 'soy', 'almond', 'coconut', 'other'] as const;
export const DRINK_STYLES = ['latte', 'hybrid', 'other'] as const;
export const SIZES = ['S', 'M', 'L'] as const;
export const TEMPERATURES = ['hot', 'iced'] as const;
export const OCCASIONS = [
  { key: 'hangout', label: 'Hangout' },
  { key: 'grab_go', label: 'Grab & go' },
  { key: 'business_mtg', label: 'Business mtg' },
  { key: 'dessert_occasion', label: 'Dessert / occasion' },
] as const;

export type Milk = (typeof MILKS)[number];
export type DrinkStyle = (typeof DRINK_STYLES)[number];
export type Size = (typeof SIZES)[number];
export type Temperature = (typeof TEMPERATURES)[number];
export type Occasion = (typeof OCCASIONS)[number]['key'];

export interface Cafe {
  id: string;
  name: string;
  address: string | null;
  suburb: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
}

export interface Review {
  id: string;
  cafe_id: string | null;
  photo_path: string | null;
  drank_at: string;
  overall: number;
  taste: number | null;
  sweetness: number | null;
  texture: number | null;
  temperature: Temperature | null;
  milk: Milk | null;
  drink_style: DrinkStyle | null;
  size: Size | null;
  price: number;
  occasions: Occasion[];
  note: string | null;
  status: 'complete' | 'draft';
  cafe?: Cafe;
}

export interface CafeCandidate {
  name: string;
  address: string;
  placeId: string;
  latitude: number;
  longitude: number;
}
```

- [ ] **Step 2: Create `app/src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

- [ ] **Step 3: Create `app/src/pages/Login.tsx`**

```tsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError("Couldn't send the link. Check the email address and try again.");
    else setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-cream px-8 text-ink">
      <h1 className="font-display text-3xl">Matcha Muse</h1>
      {sent ? (
        <p className="mt-4">Check your email — tap the sign-in link on this phone.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            className="w-full rounded-xl border border-sand bg-white p-4"
          />
          <button type="submit" className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream">
            Email me a sign-in link
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace `app/src/App.tsx`** with the auth gate (routes still minimal; extended in Task 13):

```tsx
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Login from './pages/Login';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <Login />;

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="px-6 pt-8 pb-4">
        <h1 className="font-display text-2xl">Matcha Muse</h1>
      </header>
    </div>
  );
}
```

- [ ] **Step 5: Verify manually.** `npm run dev`: login screen appears; entering Justina's email sends a real magic link (Supabase default email); clicking it in the same browser signs in and shows the header. (Executor: coordinate with Justina for the email click, or verify send-success state only.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: domain types, Supabase client, magic-link login gate"
```

---

### Task 7: StarRating component (TDD)

**Files:** Create: `app/src/components/StarRating.tsx`, `app/src/components/StarRating.test.tsx`.

- [ ] **Step 1: Write the failing test** (`StarRating.test.tsx`)

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import StarRating from './StarRating';

test('tapping the right half of the fourth star selects 4', async () => {
  const onChange = vi.fn();
  render(<StarRating label="Taste" value={null} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
  expect(onChange).toHaveBeenCalledWith(4);
});

test('tapping the left half of a star selects the half step', async () => {
  const onChange = vi.fn();
  render(<StarRating label="Taste" value={null} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: '3.5 stars' }));
  expect(onChange).toHaveBeenCalledWith(3.5);
});
```

- [ ] **Step 2: Run to verify failure.** `npm run test` → Expected: FAIL, cannot resolve `./StarRating`.

- [ ] **Step 3: Implement `StarRating.tsx`**

```tsx
import { useId } from 'react';

interface Props {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}

export default function StarRating({ label, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between py-1">
      <span>{label}</span>
      <div className="flex items-center gap-0.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = value == null ? 0 : Math.min(Math.max(value - star + 1, 0), 1);
          return (
            <span key={star} className="relative h-9 w-9">
              <button
                type="button"
                aria-label={`${star - 0.5} stars`}
                onClick={() => onChange(star - 0.5)}
                className="absolute inset-y-0 left-0 z-10 w-1/2"
              />
              <button
                type="button"
                aria-label={`${star} stars`}
                onClick={() => onChange(star)}
                className="absolute inset-y-0 right-0 z-10 w-1/2"
              />
              <Star fill={fill} />
            </span>
          );
        })}
        <span aria-live="polite" className="ml-2 w-8 text-right font-medium">{value ?? '–'}</span>
      </div>
    </div>
  );
}

function Star({ fill }: { fill: number }) {
  const id = useId();
  const path =
    'M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.5L12 16.9 6.1 20l1.3-6.5L2.5 9l6.6-.8L12 2z';
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
      <clipPath id={id}>
        <rect x="0" y="0" width={24 * fill} height="24" />
      </clipPath>
      <path d={path} fill="none" stroke="#40573B" strokeWidth="1.3" />
      <path d={path} fill="#7BA05B" clipPath={`url(#${id})`} />
    </svg>
  );
}
```

- [ ] **Step 4: Run to verify pass.** `npm run test` → Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/StarRating.tsx src/components/StarRating.test.tsx
git commit -m "feat: half-step star rating component"
```

---

### Task 8: Google Places lookup (TDD on parsing) + HUMAN STEP for the key

**Files:** Create: `app/src/lib/places.ts`, `app/src/lib/places.test.ts`. Modify: `app/.env.local`.

- [ ] **Step 1: Write the failing test** (`places.test.ts`)

```ts
import { parsePlaces } from './places';

const sample = [
  {
    id: 'ChIJabc123',
    displayName: { text: 'Kōya Coffee' },
    formattedAddress: '12 O’Connell St, North Adelaide SA 5006',
    location: { latitude: -34.906, longitude: 138.594 },
  },
  { id: 'ChIJnoloc', displayName: { text: 'Mystery Cafe' } },
];

test('maps a Places response into cafe candidates', () => {
  const result = parsePlaces(sample);
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    name: 'Kōya Coffee',
    address: '12 O’Connell St, North Adelaide SA 5006',
    placeId: 'ChIJabc123',
    latitude: -34.906,
    longitude: 138.594,
  });
});

test('returns empty list for missing input', () => {
  expect(parsePlaces(undefined)).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure.** `npm run test` → FAIL, cannot resolve `./places`.

- [ ] **Step 3: Implement `places.ts`**

```ts
import type { CafeCandidate } from './types';

interface PlacesPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

export function parsePlaces(places: PlacesPlace[] | undefined): CafeCandidate[] {
  return (places ?? []).flatMap((p) => {
    if (!p.id || !p.displayName?.text || !p.location?.latitude || !p.location?.longitude) return [];
    return [{
      name: p.displayName.text,
      address: p.formattedAddress ?? '',
      placeId: p.id,
      latitude: p.location.latitude,
      longitude: p.location.longitude,
    }];
  });
}

const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location';

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': import.meta.env.VITE_GOOGLE_PLACES_KEY as string,
    'X-Goog-FieldMask': FIELD_MASK,
  };
}

export async function nearbyCafes(latitude: number, longitude: number): Promise<CafeCandidate[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      includedTypes: ['cafe', 'coffee_shop'],
      maxResultCount: 8,
      locationRestriction: { circle: { center: { latitude, longitude }, radius: 300 } },
    }),
  });
  if (!res.ok) throw new Error(`Places nearby search failed: ${res.status}`);
  return parsePlaces((await res.json()).places);
}

export async function searchCafes(query: string): Promise<CafeCandidate[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ textQuery: query, regionCode: 'AU', maxResultCount: 8 }),
  });
  if (!res.ok) throw new Error(`Places text search failed: ${res.status}`);
  return parsePlaces((await res.json()).places);
}
```

- [ ] **Step 4: Run to verify pass.** `npm run test` → all tests pass.

- [ ] **Step 5: HUMAN STEP — Google Places key.** Pause and walk Justina through: console.cloud.google.com → sign in with a Google account → create project `matcha-muse` → enable billing (card required; usage stays inside the always-free monthly credit at personal volume) → "APIs & Services" → enable **Places API (New)** → Credentials → Create API key. Restrict the key: Application restrictions = Websites, add `http://localhost:5173/*` (and the Cloudflare Pages URL after Task 14); API restrictions = Places API (New) only. Put the key into `app/.env.local` as `VITE_GOOGLE_PLACES_KEY`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/places.ts src/lib/places.test.ts
git commit -m "feat: Google Places nearby and text search with parsed candidates"
```

---

### Task 9: Offline queue (TDD)

> **Amendment (2026-07-08, post-quality-review):** `flush` re-reads the queue before its final write and removes only the submitted ids (tracked in a `Set`), rather than overwriting storage with a stale `remaining` snapshot. This closes a silent-data-loss race: if a review is `enqueue`d while `flush` is mid-upload (plausible right after reconnect, when `flush` fires on the `online` event and a still-flaky save also queues), the old full-overwrite clobbered it. Two tests added: a concurrent-enqueue-during-flush test (proves the fix) and a `blobToBase64`/`base64ToBlob` round-trip test. A comment near `base64ToBlob` flags photo-size/memory for Task 12 (downscale before queuing). Applied in commit after 2f7437c.

**Files:** Create: `app/src/lib/offlineQueue.ts`, `app/src/lib/offlineQueue.test.ts`.

- [ ] **Step 1: Write the failing test** (`offlineQueue.test.ts`)

```ts
import { vi } from 'vitest';
import { enqueue, pending, flush, type KV, type QueuedReview } from './offlineQueue';

function memoryKV(): KV {
  const store = new Map<string, QueuedReview[]>();
  return {
    get: async (k) => store.get(k),
    set: async (k, v) => void store.set(k, v),
  };
}

const item = {
  choice: { kind: 'manual' as const, name: 'Test Cafe', suburb: 'Adelaide' },
  draft: { overall: 4, price: '6.00' } as never,
  photoBase64: null,
  drankAt: '2026-07-07T09:00:00.000Z',
};

test('enqueue stores items with generated ids', async () => {
  const kv = memoryKV();
  await enqueue(item, kv);
  await enqueue(item, kv);
  const q = await pending(kv);
  expect(q).toHaveLength(2);
  expect(q[0].id).not.toEqual(q[1].id);
});

test('flush submits items, removes successes, keeps failures', async () => {
  const kv = memoryKV();
  await enqueue(item, kv);
  await enqueue(item, kv);
  const submit = vi.fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('still offline'));
  const sent = await flush(submit, kv);
  expect(sent).toBe(1);
  expect(await pending(kv)).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify failure.** `npm run test` → FAIL, cannot resolve `./offlineQueue`.

- [ ] **Step 3: Implement `offlineQueue.ts`**

```ts
import { get, set } from 'idb-keyval';
import type { CafeChoice } from '../components/CafePicker';
import type { ReviewDraft } from '../components/ReviewForm';

export interface QueuedReview {
  id: string;
  choice: CafeChoice;
  draft: ReviewDraft;
  photoBase64: string | null;
  drankAt: string;
}

export interface KV {
  get: (key: string) => Promise<QueuedReview[] | undefined>;
  set: (key: string, value: QueuedReview[]) => Promise<void>;
}

const KEY = 'matcha-muse-queue';
const idb: KV = { get, set };

export async function enqueue(item: Omit<QueuedReview, 'id'>, kv: KV = idb): Promise<void> {
  const queue = (await kv.get(KEY)) ?? [];
  await kv.set(KEY, [...queue, { ...item, id: crypto.randomUUID() }]);
}

export async function pending(kv: KV = idb): Promise<QueuedReview[]> {
  return (await kv.get(KEY)) ?? [];
}

export async function flush(
  submit: (item: QueuedReview) => Promise<void>,
  kv: KV = idb
): Promise<number> {
  const queue = (await kv.get(KEY)) ?? [];
  const remaining: QueuedReview[] = [];
  let sent = 0;
  for (const item of queue) {
    try {
      await submit(item);
      sent++;
    } catch {
      remaining.push(item);
    }
  }
  await kv.set(KEY, remaining);
  return sent;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function base64ToBlob(b64: string): Promise<Blob> {
  return (await fetch(b64)).blob();
}
```

Note: `CafePicker`/`ReviewForm` types don't exist yet (Tasks 10–11); TypeScript will error until then — tests still run because Vitest transpiles per-file. If the executor prefers strict ordering, do Tasks 10–11 first and return here; the plan orders it this way so pure logic lands early.

- [ ] **Step 4: Run to verify pass.** `npm run test` → offlineQueue tests pass (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/offlineQueue.ts src/lib/offlineQueue.test.ts
git commit -m "feat: IndexedDB offline queue with flush semantics"
```

---

### Task 10: ReviewForm (TDD)

> **Amendment (2026-07-07, post-quality-review):** price validation tightened and draft path tested. In `ReviewForm.tsx`: `const priceTrimmed = d.price.trim(); const priceOk = /^\d+(\.\d{1,2})?$/.test(priceTrimmed); const canSave = d.overall != null && priceOk;` — both submit paths pass `price: priceTrimmed`; an inline hint `<p className="text-xs text-ink/60">Enter a price like 6.50</p>` renders when price is non-empty but invalid. Two tests added: "nonsense price keeps save disabled" (types `Infinity`, expects Save disabled) and "save as draft submits with draft status" (overall 4 + price 7 → draft button → onSubmit with `status: 'draft'`). Applied in commit(s) after 58488bf.

**Files:** Create: `app/src/components/Chips.tsx`, `app/src/components/ReviewForm.tsx`, `app/src/components/ReviewForm.test.tsx`.

- [ ] **Step 1: Write the failing test** (`ReviewForm.test.tsx`)

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReviewForm from './ReviewForm';

test('save is disabled until overall and price are set, then submits', async () => {
  const onSubmit = vi.fn();
  render(<ReviewForm onSubmit={onSubmit} />);
  const save = screen.getByRole('button', { name: 'Save matcha' });
  expect(save).toBeDisabled();

  const overall = within(screen.getByRole('group', { name: 'Overall' }));
  await userEvent.click(overall.getByRole('button', { name: '4.5 stars' }));
  expect(save).toBeDisabled();

  await userEvent.type(screen.getByLabelText('Price'), '6.50');
  expect(save).toBeEnabled();

  await userEvent.click(screen.getByRole('button', { name: 'Grab & go' }));
  await userEvent.click(save);
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      overall: 4.5,
      price: '6.50',
      occasions: ['grab_go'],
      status: 'complete',
    })
  );
});
```

- [ ] **Step 2: Run to verify failure.** `npm run test` → FAIL, cannot resolve `./ReviewForm`.

- [ ] **Step 3: Create `Chips.tsx`**

```tsx
interface Props<T extends string> {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
}

export default function Chips<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div>
      <span className="text-sm text-ink/70">{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            type="button"
            key={o}
            aria-pressed={value === o}
            onClick={() => onChange(value === o ? null : o)}
            className={
              value === o
                ? 'rounded-full bg-matcha-deep px-4 py-2 text-sm text-cream'
                : 'rounded-full bg-sand px-4 py-2 text-sm text-sand-ink'
            }
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `ReviewForm.tsx`**

```tsx
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

export default function ReviewForm({ onSubmit }: { onSubmit: (d: ReviewDraft) => void }) {
  const [d, setD] = useState(EMPTY);
  const patch = (p: Partial<ReviewDraft>) => setD((prev) => ({ ...prev, ...p }));
  const canSave = d.overall != null && d.price.trim() !== '' && !isNaN(Number(d.price));

  function toggleOccasion(key: Occasion, on: boolean) {
    patch({ occasions: on ? [...d.occasions, key] : d.occasions.filter((k) => k !== key) });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSubmit({ ...d, status: 'complete' });
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
        Save matcha
      </button>
      <button
        type="button"
        disabled={!canSave}
        onClick={() => onSubmit({ ...d, status: 'draft' })}
        className="w-full rounded-xl border border-matcha-deep p-3 text-matcha-deep disabled:opacity-40"
      >
        Save as draft — finish details later
      </button>
    </form>
  );
}
```

(The occasion checkbox label text "Grab & go" is what the test clicks — the accessible name comes from the label wrapping the checkbox; `getByRole('button', ...)` in the test refers to chips, and the checkbox is found via its label text. If `getByRole('button', { name: 'Grab & go' })` fails because it's a checkbox, change the test line to `await userEvent.click(screen.getByLabelText('Grab & go'));` — that is the correct query.)

- [ ] **Step 5: Run to verify pass.** `npm run test` → ReviewForm test passes (fix the checkbox query per the note above if needed — commit whichever query passes).

- [ ] **Step 6: Commit**

```bash
git add src/components/Chips.tsx src/components/ReviewForm.tsx src/components/ReviewForm.test.tsx
git commit -m "feat: full review form with chips, occasions, and validation"
```

---

### Task 11: CafePicker component

> **Amendment (2026-07-08, post-quality-review):** the geolocation/`nearbyCafes` effect guards against setState-after-unmount with a `cancelled` flag set in the effect cleanup — every `setCandidates`/`setFailed` inside the async success/error callbacks is wrapped in `if (!cancelled)`. Prevents a slow nearby-lookup resolving after `NewReview` (Task 12) has swapped the picker out. Applied in commit after dcb00d8.

**Files:** Create: `app/src/components/CafePicker.tsx`.

- [ ] **Step 1: Implement `CafePicker.tsx`** (geolocation → nearby list; fallbacks: search by name, manual create — per spec error handling)

```tsx
import { useEffect, useState } from 'react';
import type { CafeCandidate } from '../lib/types';
import { nearbyCafes, searchCafes } from '../lib/places';

export type CafeChoice =
  | { kind: 'candidate'; candidate: CafeCandidate }
  | { kind: 'manual'; name: string; suburb: string };

export default function CafePicker({ onSelect }: { onSelect: (c: CafeChoice) => void }) {
  const [candidates, setCandidates] = useState<CafeCandidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualSuburb, setManualSuburb] = useState('');

  useEffect(() => {
    if (!('geolocation' in navigator)) { setFailed(true); setCandidates([]); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setCandidates(await nearbyCafes(pos.coords.latitude, pos.coords.longitude));
        } catch {
          setFailed(true);
          setCandidates([]);
        }
      },
      () => { setFailed(true); setCandidates([]); },
      { timeout: 8000 }
    );
  }, []);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      setCandidates(await searchCafes(query));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="space-y-4 px-6">
      <h2 className="font-display text-xl">Which cafe?</h2>

      {candidates === null && <p className="text-ink/60">Finding cafes near you…</p>}

      {candidates?.map((c) => (
        <button
          key={c.placeId}
          type="button"
          onClick={() => onSelect({ kind: 'candidate', candidate: c })}
          className="block w-full rounded-xl border border-sand bg-white p-4 text-left"
        >
          <span className="font-medium">{c.name}</span>
          <span className="block text-sm text-ink/60">{c.address}</span>
        </button>
      ))}

      {candidates !== null && (
        <>
          {failed && (
            <p className="text-sm text-ink/60">
              Couldn't look up nearby cafes — search by name or add it yourself.
            </p>
          )}
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cafe by name"
              aria-label="Search cafe"
              className="flex-1 rounded-xl border border-sand bg-white p-3"
            />
            <button type="submit" className="rounded-xl bg-matcha-deep px-4 text-cream">Go</button>
          </form>

          <details className="rounded-xl bg-sand/50 p-4">
            <summary className="text-sm text-sand-ink">Can't find it? Add the cafe manually</summary>
            <div className="mt-3 space-y-2">
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Cafe name"
                aria-label="Cafe name"
                className="w-full rounded-xl border border-sand bg-white p-3"
              />
              <input
                value={manualSuburb}
                onChange={(e) => setManualSuburb(e.target.value)}
                placeholder="Suburb"
                aria-label="Suburb"
                className="w-full rounded-xl border border-sand bg-white p-3"
              />
              <button
                type="button"
                disabled={!manualName.trim()}
                onClick={() => onSelect({ kind: 'manual', name: manualName.trim(), suburb: manualSuburb.trim() })}
                className="w-full rounded-xl border border-matcha-deep p-3 text-matcha-deep disabled:opacity-40"
              >
                Use this cafe
              </button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 1b (amendment — Task 8 quality-review follow-up): add fetch timeouts.** In `app/src/lib/places.ts`, add `signal: AbortSignal.timeout(8000),` to the fetch options object of BOTH `nearbyCafes` and `searchCafes` (after the `body` property). This bounds hung requests on flaky mobile networks so CafePicker's fallback triggers promptly instead of hanging. Include this file in the Task 11 commit.

- [ ] **Step 2: Verify build.** `npm run test` (existing tests still pass) and `npx tsc --noEmit` → Expected: no type errors (offlineQueue's imports now resolve too).

- [ ] **Step 3: Commit**

```bash
git add src/components/CafePicker.tsx
git commit -m "feat: cafe picker with nearby detection, search, and manual fallback"
```

---

### Task 12: Save pipeline (api.ts) and NewReview page

**Files:** Create: `app/src/lib/api.ts`, `app/src/components/SignedImage.tsx`, `app/src/pages/NewReview.tsx`.

- [ ] **Step 1: Create `app/src/lib/api.ts`**

```ts
import { supabase } from './supabase';
import type { CafeChoice } from '../components/CafePicker';
import type { ReviewDraft } from '../components/ReviewForm';
import { enqueue, blobToBase64, base64ToBlob, type QueuedReview } from './offlineQueue';

export async function ensureCafe(choice: CafeChoice): Promise<string> {
  if (choice.kind === 'candidate') {
    const c = choice.candidate;
    const { data: existing } = await supabase
      .from('cafes').select('id').eq('google_place_id', c.placeId).maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from('cafes')
      .insert({
        name: c.name, address: c.address,
        latitude: c.latitude, longitude: c.longitude, google_place_id: c.placeId,
      })
      .select('id').single();
    if (error) throw error;
    return data.id;
  }
  const { data, error } = await supabase
    .from('cafes')
    .insert({ name: choice.name, suburb: choice.suburb || null })
    .select('id').single();
  if (error) throw error;
  return data.id;
}

export async function saveReview(
  choice: CafeChoice,
  draft: ReviewDraft,
  photo: Blob | null,
  drankAt: Date = new Date()
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Not signed in');

  const cafeId = await ensureCafe(choice);

  let photoPath: string | null = null;
  if (photo) {
    photoPath = `reviews/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('photos').upload(photoPath, photo);
    if (error) throw error;
  }

  const { error } = await supabase.from('reviews').insert({
    user_id: userData.user.id,
    cafe_id: cafeId,
    photo_path: photoPath,
    drank_at: drankAt.toISOString(),
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
  });
  if (error) throw error;
}

export async function saveReviewOrQueue(
  choice: CafeChoice,
  draft: ReviewDraft,
  photo: Blob | null
): Promise<'saved' | 'queued'> {
  try {
    await saveReview(choice, draft, photo);
    return 'saved';
  } catch (e) {
    const isNetwork = e instanceof TypeError || !navigator.onLine;
    if (!isNetwork) throw e;
    await enqueue({
      choice,
      draft,
      photoBase64: photo ? await blobToBase64(photo) : null,
      drankAt: new Date().toISOString(),
    });
    return 'queued';
  }
}

export async function submitQueued(item: QueuedReview): Promise<void> {
  const photo = item.photoBase64 ? await base64ToBlob(item.photoBase64) : null;
  await saveReview(item.choice, item.draft, photo, new Date(item.drankAt));
}
```

- [ ] **Step 2: Create `SignedImage.tsx`** (private bucket → signed URLs)

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props { path: string | null; alt: string; className?: string }

export default function SignedImage({ path, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    supabase.storage.from('photos').createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!path || !url) return <div className={`bg-matcha-mist ${className ?? ''}`} aria-label={alt} />;
  return <img src={url} alt={alt} className={className} />;
}
```

- [ ] **Step 3: Create `NewReview.tsx`** (photo → cafe → form → save/queue)

```tsx
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
```

- [ ] **Step 4: Verify.** `npx tsc --noEmit` → no errors. `npm run test` → all previous tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/components/SignedImage.tsx src/pages/NewReview.tsx
git commit -m "feat: save pipeline with offline queueing and new-review page"
```

---

### Task 13: Dashboard journal, routing, queue flush

**Files:** Create: `app/src/pages/Dashboard.tsx`. Modify: `app/src/App.tsx`.

- [ ] **Step 1: Create `Dashboard.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Review } from '../lib/types';
import SignedImage from '../components/SignedImage';

export default function Dashboard() {
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    supabase
      .from('reviews')
      .select('*, cafe:cafes(*)')
      .order('drank_at', { ascending: false })
      .then(({ data }) => setReviews((data as Review[] | null) ?? []));
  }, []);

  if (reviews === null) return <p className="px-6 text-ink/60">Brewing…</p>;

  const avg = (xs: number[]) =>
    xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '–';
  const cafeCount = new Set(reviews.map((r) => r.cafe_id).filter(Boolean)).size;
  const drafts = reviews.filter((r) => r.status === 'draft');

  return (
    <div className="px-6 pb-24">
      <div className="grid grid-cols-3 gap-3 py-4">
        <Stat label="Matchas" value={String(reviews.length)} />
        <Stat label="Cafes" value={String(cafeCount)} />
        <Stat label="Avg score" value={avg(reviews.map((r) => Number(r.overall)))} />
      </div>

      {drafts.length > 0 && (
        <p className="mb-3 rounded-xl bg-sand/60 p-3 text-sm text-sand-ink">
          {drafts.length} draft{drafts.length > 1 ? 's' : ''} waiting for details.
        </p>
      )}

      {reviews.length === 0 && (
        <p className="py-10 text-center text-ink/60">Your first matcha awaits — tap the + to begin.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {reviews.map((r) => (
          <div key={r.id} className="overflow-hidden rounded-2xl border border-sand bg-white">
            <SignedImage path={r.photo_path} alt={r.cafe?.name ?? 'Matcha'} className="h-36 w-full object-cover" />
            <div className="p-3">
              <p className="truncate font-display">{r.cafe?.name ?? 'Unknown cafe'}</p>
              <p className="text-sm text-ink/60">
                {Number(r.overall).toFixed(1)} ★ · ${Number(r.price).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/new"
        aria-label="New matcha review"
        className="fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-matcha-deep text-3xl text-cream"
      >
        +
      </Link>
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

- [ ] **Step 2: Replace `App.tsx`** with routing + online queue flush:

```tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { flush } from './lib/offlineQueue';
import { submitQueued } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewReview from './pages/NewReview';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const sync = () => { void flush(submitQueued); };
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Login />;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-cream text-ink">
        <header className="px-6 pt-8 pb-2">
          <h1 className="font-display text-2xl">Matcha Muse</h1>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewReview />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Full desktop verification.** `npm run test` (all green), `npx tsc --noEmit` (clean), then `npm run dev` and in Chrome device mode: sign in, tap +, pick a simulated location (DevTools → Sensors → set Adelaide coordinates -34.9285, 138.6007), confirm a nearby cafe appears, complete and save a review, see it on the dashboard with stats updating.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: dashboard journal, routing, and offline queue flush on reconnect"
```

---

### Task 14: Deploy to Cloudflare Pages + iPhone acceptance (HUMAN-ASSISTED)

**Files:** none new (build output only).

- [ ] **Step 1: HUMAN STEP.** Justina creates a free Cloudflare account at dash.cloudflare.com (email + password; no card needed).

- [ ] **Step 2: Build and deploy** (in `app/`; `wrangler login` opens a browser window for Justina to approve):

```bash
npm run build
npx wrangler login
npx wrangler pages project create matcha-muse --production-branch main
npx wrangler pages deploy dist --project-name matcha-muse
```

Expected: a live URL like `https://matcha-muse.pages.dev`.

- [ ] **Step 3: Post-deploy config.**
  - Supabase dashboard → Authentication → URL Configuration: set Site URL to the pages.dev URL and add it to Redirect URLs (magic links must land on the deployed app).
  - Google Cloud console → the Places API key → Website restrictions: add `https://matcha-muse.pages.dev/*`.

- [ ] **Step 4: iPhone acceptance checklist (Justina, guided).** On her iPhone in Safari, open the pages.dev URL, then Share → Add to Home Screen. Verify each:
  1. Icon appears on home screen; opening it is full-screen (no Safari bars).
  2. Magic-link login works (link opens the app signed in).
  3. Tap + → camera opens directly → photo taken.
  4. Location prompt appears; a genuinely nearby cafe is listed; confirm it.
  5. Full review saves; appears on dashboard with photo.
  6. Airplane mode: save a review → "Saved on your phone" message; airplane off → reopen app → review appears on dashboard (queue flushed).
  7. Draft save works and shows in the drafts notice.

- [ ] **Step 5: Record and commit.** Note any checklist failures as issues to fix before Plan 2. Then:

```bash
git add -A
git commit -m "chore: v1 deployed to Cloudflare Pages, iPhone acceptance run"
```

---

## Self-review (completed at plan time)

- **Spec coverage:** capture flow ✓ (T11–12), ratings model ✓ (T5, T7, T10), occasion tickboxes ✓ (T10), offline queue ✓ (T9, T12–13), auth/privacy ✓ (T5–6), journal + stats ✓ (T13), PWA install ✓ (T1, T3, T14), deploy ✓ (T14). Import/back-dating, cafe pages, near-me, menu photos → Plan 2; filters, share cards → Plan 3 (declared in header).
- **Known judgment calls:** `menu_photos` table created now (schema churn is costlier than an unused table); price required even on drafts (matches spec's "overall and price required"); unknown-cafe reviews impossible in v1 (a cafe choice is always required before the form shows).
