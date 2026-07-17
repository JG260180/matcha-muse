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

## Out of scope (parked)

- Menu section inside NewReview before any save (needs early cafe creation +
  offline-queue dedupe work).
- Pinch-to-zoom in PhotoAdjust (slider only for v1 of the crop).
- Backfilling crops onto other reviewers' photos.
