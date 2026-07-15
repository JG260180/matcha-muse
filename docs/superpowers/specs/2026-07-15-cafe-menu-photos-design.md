# Cafe menu photos — design (approved 2026-07-15)

Owner: Justina Gardiner. Feature: reviewers can photograph a cafe's menu and attach
it to the cafe. The menu is **not** visible on the journal grid or the Near me page;
it appears only inside the review page (`/review/:id`) for a review at that cafe.

## Decisions (owner-confirmed)

1. **Placement:** the menu lives in a new "Menu" section on the review page,
   below the review details. Navigation is unchanged — no new cafe page.
2. **Count:** a cafe can have **multiple** menu photos (multi-page menus).
3. **Permissions:** **any signed-in reviewer** can add or remove any menu photo.
   Matches the existing `menu_photos` RLS ("authenticated full access") — **no
   database or RLS changes needed**.

## Existing foundations (already live in Supabase)

- Table `menu_photos (id uuid pk, cafe_id uuid not null references cafes, photo_path text not null, taken_at timestamptz default now())` — created in v1, never wired to UI.
- RLS: `authenticated full access to menu photos` (all ops, all signed-in users).
- Storage: private `photos` bucket with authenticated insert/select/delete policies —
  menu photos reuse it under a `menus/` path prefix (`menus/<uuid>.jpg`).
- `downscalePhoto` in `app/src/lib/api.ts` (EXIF-upright, ≤1600px, jpeg 0.8) — reuse as-is.
- `SignedImage` component for rendering private-bucket images.

## Components and data flow

### `app/src/lib/menu.ts` (new, TDD)

- `MenuPhoto` type mirroring the table row (`id`, `cafe_id`, `photo_path`, `taken_at`).
- `fetchMenuPhotos(cafeId): Promise<MenuPhoto[]>` — select by `cafe_id`,
  **ordered by `taken_at` ascending** (page 1 stays first).
- `addMenuPhoto(cafeId, blob): Promise<MenuPhoto>` — `downscalePhoto` → upload to
  `menus/${crypto.randomUUID()}.jpg` → insert row → return it. Upload-before-insert,
  same as reviews; on insert failure the uploaded file is an accepted orphan (console.warn).
- `deleteMenuPhoto(photo): Promise<void>` — best-effort storage remove (failure =
  console.warn, accepted orphan), then row delete; row-delete failure surfaces to caller.
  Same stance as `deleteReview`.

### `app/src/components/CafeMenu.tsx` (new, TDD)

Props: `{ cafeId: string; cafeName: string }`. Self-contained: fetches on mount
(with unmount guard), owns its state. States:

- **Loading:** nothing rendered until the fetch resolves (section quietly appears; no spinner).
- **Fetch failed:** small muted line "Couldn't load the menu — check your connection."
- **Empty:** heading "Menu", muted "No menu photos yet — add one below.", add controls.
- **Photos:** heading "Menu", horizontal scroll row of thumbnails (`SignedImage`,
  ~h-28 w-24, rounded, object-cover, tappable), then add controls.
- **Add controls:** same two-option pattern as elsewhere — primary "Take a photo"
  (`capture="environment"`) and "Choose from library" labels wrapping hidden file inputs.
  While uploading: "Adding…" text replaces the controls. On failure: red
  "Couldn't add the photo. Check your connection and try again."
- **Full-screen viewer:** tapping a thumbnail opens a fixed overlay (dark backdrop):
  the photo starts fitted to the screen width; tapping the photo toggles it to natural
  size inside an `overflow-auto` container (so fine print is readable by scrolling;
  native pinch-zoom is a bonus where iOS allows it),
  a ✕ close button (aria-label "Close menu photo"), and a compact "Remove this photo"
  button using the two-tap arm/confirm pattern from `ConfirmDelete` (first tap arms →
  label becomes "Tap again to confirm", auto-disarms after a few seconds). Removal deletes via
  `deleteMenuPhoto`, closes the viewer, drops the photo from the row. Delete failure
  shows the friendly error inside the viewer and leaves the photo in place.

### `ReviewDetail.tsx` (edit)

In **view mode only** (not while editing), after the existing detail block, render
`<CafeMenu cafeId={review.cafe.id} cafeName={review.cafe.name} />` when `review.cafe`
exists. No menu section for cafe-less reviews. Journal, Near me, CafeStack: untouched.

## Error handling

- All add/remove operations are online-only (the review page already requires a
  connection to load). Failures use the app's existing tone: "Couldn't … — check
  your connection and try again." Nothing is queued offline.
- A photo is never lost by downscaling (`downscalePhoto` falls back to the original).

## Accessibility

- Thumbnails are buttons with alt/aria "Menu photo N of M — {cafeName}".
- Viewer close and remove controls are real buttons with labels; status messages
  use `role="status"` where they replace controls.

## Testing (all via existing Vitest + Testing Library setup)

- `menu.test.ts`: fetch orders ascending; add uploads then inserts (path prefix
  `menus/`); add surfaces upload/insert errors; delete removes storage then row;
  storage-cleanup failure doesn't block row delete.
- `CafeMenu.test.tsx`: empty state; thumbnails render for fetched photos; fetch-failure
  message; add flow calls `addMenuPhoto` and appends; viewer opens/closes; remove flow
  arm→confirm calls `deleteMenuPhoto` and updates the row; failure messaging.
- `ReviewDetail.test.tsx`: menu section present in view mode with a cafe; absent when
  `cafe` is null; absent while editing.

## Out of scope (YAGNI, parked)

- Captions/labels per photo, reordering, "menu last updated" notices.
- Offline queueing of menu uploads.
- A dedicated cafe page (revisit if the app ever needs cafe-level browsing).

## Process notes

- Branch: fork from `feature/shared-journal` (not `main`) — that branch is unmerged
  and owns the current `ReviewDetail.tsx`. Merge order: shared-journal first, then this.
- Execution: superpowers:subagent-driven-development, TDD tasks, two-stage reviews,
  same as prior features.
