# Matcha Muse — Review detail: view, edit, delete (design spec)

**Date:** 2026-07-10
**Owner:** Justina Gardiner (non-technical)
**Status:** Approved for planning
**Relationship to prior work:** Post-v1 feature (second after "Near me"). v1 and Near me are deployed and accepted. No database schema changes; RLS already scopes reviews/photos to the owner.

## Summary

Every logged matcha becomes tappable, opening a full-screen review page at `/review/:id` where the owner can view all details, edit any field (including the photo), finish drafts, or delete the review (two-step confirm). The drafts notice on the Journal becomes a filter toggle. Motivation: test data needs deleting, mistakes need fixing, and drafts need a way to be finished.

## Entry points

1. **Journal grid cards** — each card wraps in a link to `/review/:id`.
2. **Drafts notice** ("N drafts waiting for details") — becomes a toggle: tap → journal grid shows only drafts; tap again (or a "show all" affordance) → back to everything. Draft cards additionally show a small **"Draft" badge** at all times (filtered or not).
3. **Near me** — the fanned-out per-review cards inside an expanded stack, and the card body of a single-review cafe, link to `/review/:id`. The stack *header* keeps its current fan-out toggle behaviour. (This intentionally supersedes the earlier "single-review card is not interactive" rule from the Near me spec; tests asserting that will be updated.)

## The review page (`/review/:id`)

- Fetches the review by id with cafe join (same select shape as Dashboard). Unknown id or fetch failure → the app-standard "couldn't load" message.
- Layout top to bottom: photo (SignedImage, full-width, with the NewReview-style ✕ overlay), cafe name + drank-at date (read-only), then the review form pre-filled with all saved values.
- **Form reuse:** `ReviewForm` gains an optional `initial?: ReviewDraft` prop (defaults to the current EMPTY) and configurable button labels, so NewReview behaviour is unchanged and the detail page reuses the same component. Occasions, chips, stars, price, note all behave exactly as when logging.
- **Buttons on the detail page:**
  - **Save changes** (primary) — persists edits; if the review was a draft, this also flips `status` to `complete`.
  - **Keep as draft** (secondary, shown only when the review is currently a draft) — saves edits, stays `draft`.
  - **Delete this matcha** (destructive, bottom) — see Deleting.
- **Cafe is not editable.** Wrong cafe = delete and re-log. Recorded as a deliberate v1-of-this-feature limit.

## Photo editing

- ✕ removes the current photo; the two add options (Take a photo / Choose from library) appear, identical to NewReview.
- A replacement photo runs through the existing `downscalePhoto` before upload.
- On save with a changed photo: upload new file first, update the row, then **best-effort delete** the old storage object (a failed cleanup never fails the save — same "orphan accepted" stance as v1's Task 12 decision).
- Saving with the photo removed (and none added) clears `photo_path` and best-effort deletes the old object.

## Deleting

- Two-step inline confirm, no browser dialogs: tap 1 → button text changes to "Tap again to confirm — this can't be undone"; tap 2 → delete. Tapping anywhere else / navigating away resets the button.
- Delete order: best-effort remove the photo from storage, then delete the review row. Row deletion failure surfaces the standard error message; storage cleanup failure is silent (orphan accepted).
- After successful delete → navigate to `/` (journal).

## Drafts flow

- Dashboard keeps fetching all reviews. Draft cards get a "Draft" badge chip; the notice becomes a button toggling a `showDraftsOnly` state (local state, not a URL param). When filtered, an obvious way back exists (the notice itself toggles off; visible "show all" text).
- Opening a draft uses the same review page; **Save changes** completes it, **Keep as draft** doesn't.
- Near me continues to exclude drafts (unchanged).

## Connectivity

- Editing and deleting are **online-only**. Failures (network or otherwise) show the app-standard "couldn't save/delete — check your connection" message and leave the data untouched. The offline queue remains new-reviews-only. Recorded as a deliberate limit; offline editing is a future project if ever needed.

## API additions (`app/src/lib/api.ts`)

- `updateReview(id, draft, photoAction)` where photoAction is one of: keep / replace(blob) / remove. Handles downscale + upload + row update + best-effort old-photo cleanup.
- `deleteReview(id, photoPath)` — best-effort storage remove, then row delete.
- No RLS/schema changes; policies already restrict all of this to the owner's rows.

## Out of scope (future)

- Changing a review's cafe.
- Offline editing/deleting (queue only covers new saves).
- Bulk delete / multi-select.
- Editing `drank_at`.

## Testing

- **Unit (TDD):** `ReviewForm` initial-values prop (pre-fills fields; EMPTY default keeps NewReview behaviour; draft-only secondary button visibility); two-step delete confirm component behaviour (first tap arms, second fires, reset on re-render/navigation); Dashboard drafts filter logic (badge presence, notice toggle) via component tests; CafeStack link changes (fanned cards and single card link to `/review/:id`; stack header still toggles).
- **API functions:** follow the existing codebase pattern (supabase-calling functions in `api.ts` are exercised via mocks only where cheap; heavy paths verified on-device).
- **Manual (on-device with owner):** open from all three entry points; edit fields and save; finish a draft both ways; replace and remove a photo; delete with the two-step confirm (including backing out after first tap); delete every unwanted test review as the real acceptance run.
