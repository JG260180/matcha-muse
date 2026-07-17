# Owner improvements — design (2026-07-17)

Six improvements requested by Justina on 2026-07-17, designed in an autonomous
session (no live Q&A — decisions below follow existing app patterns; anything
she wants different is a cheap follow-up).

> Note: the repo now lives at
> `C:\Users\justi\OneDrive - LightSpeed Consulting\APPS\MatchaMuse`
> (moved from `OneDrive\Documents\MatchaMuse` as part of the tenancy move).

## 1. Adjust the date when editing a review

- `ReviewDraft` gains `drankAtDate?: string` (local `YYYY-MM-DD`; optional so
  queued offline reviews from older builds still submit).
- `ReviewForm` gains a native `<input type="date">` labelled **Date**, with
  `max` = today. Defaults to today for new reviews; pre-filled from
  `drank_at` when editing.
- New `lib/drankAt.ts`:
  - `localDateString(iso)` → local `YYYY-MM-DD` for pre-filling.
  - `applyDrankAtDate(baseIso, dateStr?)` → if `dateStr` is missing, blank, or
    the same local date as `baseIso`, keep `baseIso` unchanged (preserves
    time-of-day ordering); otherwise return local **noon** of the chosen date
    as ISO (noon avoids timezone day-shift at the UTC boundary).
- `saveReview` and `updateReview` persist the computed `drank_at`;
  `ReviewDetail` reflects it in local state after save.

## 2. Save a draft without a price

- `ReviewForm`: the **complete** save still requires overall + valid price.
  The **draft** button now only requires overall; price may be empty (but if
  typed, must be valid — no silently saving garbage).
- `Review.price` becomes `number | null` in types; `saveReview`/`updateReview`
  send `null` for an empty price.
- Displays guard null: Dashboard card and ReviewDetail view show the price
  only when present.
- **Database migration required** (one-time, Supabase SQL editor — recorded in
  `app/supabase/schema.sql` and `app/supabase/migrations/2026-07-17-draft-price-null.sql`):
  ```sql
  alter table reviews alter column price drop not null;
  alter table reviews add constraint price_required_when_complete
    check (status = 'draft' or price is not null);
  ```
  Until it's applied, saving a draft with an empty price shows the normal
  "Couldn't save" error and nothing else changes.

## 3. Add menu photos without publishing first

Drafts open straight into edit mode, and `CafeMenu` only rendered in view
mode — so a review had to be published before the Menu section appeared.
Fix: `ReviewDetail` renders `CafeMenu` in **both** modes (below the form when
editing), whenever the review has a cafe. Menu photos are cafe-scoped, so
adding one from a draft is safe. (`NewReview` still has no menu section — the
cafe row may not exist yet there; save a draft first, which now takes seconds
because price is optional.)

## 4. Delete a draft without publishing first

Same root cause as #3: `ConfirmDelete` only rendered in view mode. Fix: while
editing, if the review is a draft and the viewer owns it, show the existing
`ConfirmDelete` (same two-tap arm/confirm) under the form's Cancel link,
wired to the existing `onDelete`.

## 5. Crop / position a photo

- New `lib/crop.ts` (pure math, unit-tested): given natural image size, a
  fixed frame aspect, zoom and pan offset, compute the source crop rect,
  clamped so the frame is always fully covered (no letterboxing, zoom 1–3).
- New `PhotoAdjust.tsx`: full-screen dialog following the app's CafeMenu
  dialog pattern (`role="dialog"`, `aria-modal`, autofocus, Escape closes,
  focus returns). Shows the photo in a fixed **4:3** frame; drag to position
  (pointer events), slider to zoom; **Use photo** renders the crop to a JPEG
  via canvas (`createImageBitmap` with `imageOrientation: 'from-image'`, same
  EXIF stance as `downscalePhoto`, same fallback-to-original-on-any-failure
  stance); **Cancel** keeps the photo as-is.
- 4:3 was chosen because the journal card (~1.1:1) and the detail header
  (~1.7:1) crop from it modestly in both directions.
- Entry points — an **Adjust** button on the photo preview:
  - `NewReview` (freshly picked photo);
  - `ReviewDetail` edit mode, for a newly picked replacement **and** for the
    existing photo (downloaded via `supabase.storage.download`, adjusted,
    then treated as a replace — old file cleaned up by the existing
    `updateReview` path).

## 6. Filters on the Journal view (as per Near Me)

Dashboard gains the same two chip rows as Near Me — **Serve** (All / Hot /
Iced) and **Milk** (buckets incl. "unspecified") — reusing `MILK_BUCKETS` and
`milkBucket` from `lib/nearMe.ts`, with identical styling and `aria` groups.
Filters compose with the existing reviewer chips and drafts toggle; the stat
tiles keep following whatever is filtered (they already follow the reviewer
chips). Reviews with no serve/milk recorded fall into "unspecified" (milk) and
are excluded by a specific serve filter, matching Near Me behaviour.

## Testing

TDD on the new pure logic (`drankAt`, `crop`) and behaviour-level tests on the
changed components (ReviewForm date + draft gating, Dashboard filters,
ReviewDetail draft delete/menu-in-edit, PhotoAdjust). Existing suites updated
where `ReviewDraft`/price types shift. `tsc -b --noEmit` and `npm run build`
must stay clean.

## Round 2 (same day) — owner test feedback

Justina tested round 1 (partly against the live site — items she reported as
"missing" were confirmed present on the dev build) and asked for four changes:

1. **Milk filter model**: an explicit **All** chip first (like Serve), specific
   milks start deselected; picking milks narrows to them, All clears. Applied
   to BOTH Journal and Near me via a shared `MilkChips` component; an empty
   milk set in `NearMeFilters` now means "all milks".
2. **Leave-warning**: navigating away mid-review (back link, header title,
   Journal/Near me tabs) opens a **Save matcha / Save as draft / Delete /
   Keep editing** dialog (`SaveBeforeLeaving`), driven by a tiny
   `LeaveGuardProvider` context (plain BrowserRouter has no useBlocker) and a
   `ReviewFormHandle` (`controlRef`) that lets the dialog submit the form from
   outside. Guards NewReview (anything entered) and draft edits on
   ReviewDetail. Discard = "Don't save" on a new review, "Delete this matcha"
   on an existing draft.
3. **Cafe-optional drafts**: CafePicker gains "Skip for now — add the cafe
   when you finish the draft" (`CafeChoice { kind: 'none' }`, `cafe_id` null —
   the column was always nullable). Publishing still requires a cafe: both
   save paths block with "Add the cafe before publishing" until one is picked;
   a cafe-less draft's edit screen embeds CafePicker and `updateReview` gains
   an optional `cafeChoice` applied on save (then refetches the joined row).
4. **Photo block labelled "(optional)"** — it never was compulsory, but read
   as if it were.

## Round 3 (same day) — PhotoAdjust glitch + photo rule

1. **PhotoAdjust StrictMode bug (the "grey image / dead zoom / Preparing…
   forever" glitch):** the mount effect revoked the object URL and latched an
   `unmounted` flag during StrictMode's simulated unmount, and nothing reset
   them on the re-run. Object-URL creation now lives inside the effect (keyed
   on the photo) with `unmounted.current = false` reset in the body. Rule of
   thumb recorded: any effect cleanup that revokes/undoes a mount-time
   resource must recreate it in the effect body, never at render/state-init.
2. **Photo required to publish, optional for drafts** (owner rule): ReviewForm
   gains `hasPhoto` (pages pass photo presence in); "Save matcha" disabled
   without one, with a "Publishing needs a photo — drafts don't." hint; photo
   block copy now says "needed to publish, drafts can skip it". Removing the
   photo while editing a published review blocks re-publishing until a new
   one is added. App-level rule only (no DB constraint — deliberate, to avoid
   another migration).

## Out of scope (parked)

- Menu section inside NewReview before any save (needs early cafe creation +
  offline-queue dedupe work).
- Pinch-to-zoom in PhotoAdjust (slider only for v1 of the crop).
- Backfilling crops onto other reviewers' photos.
