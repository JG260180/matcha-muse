# Matcha Muse — Shared Journal & Reviewer Profiles (design spec)

**Date:** 2026-07-12
**Owner:** Justina Gardiner (non-technical — human steps must be guided click-by-click)
**Status:** Approved approach "Option A": one project, quick wins first.

## Summary

Justina's five requested improvements in one feature branch (the quiz and the
profile pages are listed separately below), sequenced so the two small card
fixes ship first, then the shared-journal work:

1. **Directions button on journal cards** — opens Google Maps for that cafe.
2. **"← Journal" back button** on subpages (Review detail, New review, Near me).
   The tappable header stays exactly as it is — the button is in addition.
3. **Shared journal** — all signed-in users see everyone's *completed* reviews;
   drafts stay private; only the owner can edit/delete their reviews.
4. **First sign-in setup (taste quiz)** — required once per user: name, optional
   profile photo, "about me", five taste questions.
5. **Reviewer initials on cards + filter chips** on the journal.
6. **Reviewer profile pages** — photo, about-me, quiz answers, live stats computed
   free from their own reviews (no AI service, no ongoing cost). Not above the
   fold: reached by tapping a card's initials badge or a quiet "Reviewers" link
   below the journal grid.

Invite-only stays: Justina creates each new user in the Supabase dashboard
(Authentication → Users → Add user, auto-confirm), same as her own account.
No public sign-up screens exist.

## Database changes (applied by Justina via SQL editor, guided)

### New `profiles` table

```sql
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
```

No delete policy — profiles aren't deletable from the app.

### Reviews visibility

Replace the single `"own reviews only"` FOR ALL policy with per-command policies:

```sql
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

Storage needs no change: the private `photos` bucket already allows all
authenticated users to read/upload/delete, which now also serves avatars.
`app/supabase/schema.sql` is updated to match (as the running record).

## Feature details

### 1. Directions from a card

- Small "Directions" pill button on each journal card (bottom-right of the info
  area), shown only when the cafe has `latitude`, `longitude` and
  `google_place_id`. Uses the existing `directionsUrl()` from `googleLinks.ts`,
  opens in a new tab. Tap must not trigger the card's link to the review
  (stopPropagation / separate element, not nested inside the `<Link>`).
- Minimum ~44px tap target (this was already a deferred note from review-detail).

### 2. Back to journal

- A "← Journal" text button at the top-left of Review detail, New review and
  Near me pages, navigating to `/`. Header tap behaviour unchanged.

### 3. First sign-in setup gate

- After login, the app loads the signed-in user's `profiles` row. If none
  exists, all routes redirect to `/welcome` (setup page). Completing setup
  inserts the row and unlocks the app. Applies to existing users too (Justina
  sees it once after this ships).
- Setup form fields:
  - **Name** (required, free text) — initials are derived from it: first letter
    of the first two words, uppercased (single word → first letter only).
  - **Profile photo** (optional) — picker/camera, downscaled client-side like
    review photos, uploaded to the `photos` bucket under `avatars/<user_id>-<timestamp>.jpg`;
    path stored in `avatar_path`. Replacing the photo later deletes the old file
    (best-effort, same cleanup pattern as review photos).
  - **About me** (optional, multiline free text).
  - **Five taste questions** (each single-choice, required):
    1. **Sweetness** — Purist, no sweetener / Lightly sweet / Sweet tooth
    2. **Go-to milk** — Dairy / Oat / Soy / Almond / Coconut / Other
    3. **Adventurousness** — I stick to my usual / I'll branch out sometimes /
       I'll try anything on the menu
    4. **How often do you drink matcha?** — Daily ritual / Weekly treat /
       Special occasions
    5. **What matters most?** — Taste / Texture / Colour / Intensity of matcha
       taste / Vibe of the cafe / Value for money
  - Quiz answers stored in the `quiz` jsonb as
    `{ sweetness, milk, adventurousness, frequency, priority }` (string values).
- Setup requires being online (first sign-in always is). Errors show a plain
  retry message; nothing is saved partially — profile insert happens last,
  after any photo upload succeeds.
- Editing later: your own profile page has an "Edit profile" button reusing the
  same form, pre-filled (update instead of insert).

### 4. Journal changes (initials + filter + directions)

- Dashboard query becomes `select('*, cafe:cafes(*)')` on reviews (unchanged)
  plus one `profiles` fetch; reviews are joined to profiles client-side by
  `user_id` (avoids FK/embedding complications with `auth.users`).
- **Initials badge**: small circle with the reviewer's initials on the photo
  corner opposite the Draft badge. Tapping it opens that reviewer's profile
  (`/reviewer/:id`), not the review.
- **Filter chips**: a horizontal row above the grid — "All" plus one chip per
  reviewer who has at least one visible review. Tapping filters the grid; the
  three stat tiles (Matchas / Cafes / Avg score) follow the active filter.
  Filter state is in-memory only (resets on reload). The existing drafts
  toggle stays and combines with the reviewer filter.
- With only one reviewer (today's state), the chips row is hidden and badges
  still show — nothing looks broken before others join.
- **"Reviewers" link**: a modest text link below the journal grid to
  `/reviewers`, a simple list of all profiles (photo, name, one-line about-me
  snippet) each linking to their profile page. Deliberately not above the fold.

### 5. Reviewer profile page (`/reviewer/:id`)

- Shows: profile photo (or initials circle fallback), name, about-me, the five
  quiz answers presented as friendly labels, and **live stats** computed
  client-side from that reviewer's completed reviews:
  - Matchas logged, cafes visited
  - Favourite cafe (most-reviewed; ties broken by most recent)
  - Usual order (most common milk + hot vs iced lean + most common drink style)
  - Average overall score
  - Priciest matcha (price + cafe)
- Stats section shows a gentle "No matchas logged yet" state for new users.
- "Edit profile" button visible only on your own page.
- Stats are computed in the browser from data already being fetched — zero
  extra services, zero ongoing cost. (The "AI-driven preferences" idea is
  satisfied by these derived stats; revisit an LLM-written blurb only if ever
  wanted, as it would need a paid API key.)

## Architecture notes

- New files: `pages/Welcome.tsx` (setup/quiz form), `pages/ReviewerProfile.tsx`,
  `pages/Reviewers.tsx`, `lib/profile.ts` (fetch/insert/update profile, initials
  derivation, avatar upload), `lib/reviewerStats.ts` (pure stats functions).
- `App.tsx` gains the profile gate (load own profile once per session; redirect
  to `/welcome` when missing) and the new routes.
- Types: `Profile` type in `types.ts`; `Review` gains an optional joined
  `profile` field populated client-side.
- Existing patterns respected: signed URLs via `SignedImage`, photo downscale
  reuse from `api.ts`, Tailwind ceremony theme, tests with Vitest.

## Error handling

- Profile fetch failure at gate: show the existing friendly error style with
  retry — do not lock the user out silently.
- Avatar upload failure: setup can still be submitted without the photo
  (message offers "try again or skip photo for now").
- Reviewer profile for an id with no profile row: "This reviewer hasn't set up
  their profile yet."

## Testing

TDD where there's logic: initials derivation, reviewerStats (favourite cafe
tie-break, usual order, empty state), profile gate redirect (no profile →
/welcome; profile → journal), quiz form validation (required fields), reviewer
filter + stat tiles following the filter, directions button visibility rule.
Existing 12+ tests keep passing; `tsc -b --noEmit` and `npm run build` clean.

## Sequencing (quick wins first)

1. Directions button + "← Journal" back buttons (ship/deployable immediately).
2. SQL migration (profiles table + reviews policies) — human step, guided.
3. Profile gate + setup quiz.
4. Journal initials, filter chips, Reviewers link.
5. Reviewer profile page + stats + edit profile.
6. Deploy + iPhone acceptance checklist (including one pass as a brand-new
   second user to verify the quiz gate and shared visibility).

## Out of scope (unchanged parked ideas)

Public sign-up, OTP login revisit, interactive Google map, notifications,
comments/reactions on each other's reviews, storage-orphan sweep.
