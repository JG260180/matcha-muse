# Matcha Muse — "Near me" view (design spec)

**Date:** 2026-07-09
**Owner:** Justina Gardiner (non-technical)
**Status:** Approved for planning
**Relationship to v1:** Post-v1 feature. Originally parked for "Plan 2". v1 (log + journal + offline) is deployed and in iPhone acceptance; this is additive and changes no existing v1 behaviour.

## Summary

A second view of the user's own matcha journal, organised by physical proximity to where she is now. It answers "where near me have I had good matcha?" It reuses existing data only — **no database schema changes**. Cafes already store `latitude`/`longitude`/`google_place_id`; reviews already store `overall`, `temperature` (hot/iced), and `milk`.

Explicitly a view over the user's **own logged matchas** — not a discovery tool for new cafes (that is what the existing CafePicker does when logging).

## Navigation

- Add a lightweight segmented toggle beneath the "Matcha Muse" header: **Journal · Near me**.
- New route `/near`. Existing `/` (Journal/Dashboard) and `/new` are unchanged.
- The floating **+** button (new review) remains present on both views.
- Chosen over a bottom tab bar to keep the UI simple and avoid crowding the + button. Revisit if a third top-level view is added.

## Screen layout (`/near`), top to bottom

1. **Static map** — a Google Static Maps image showing one pin per cafe present in the *currently filtered* result set, with the user's own location marked. Cafes without coordinates (manually-added) contribute no pin.
2. **Sort control** — `Nearest` (default when location is available) or `Top rated`.
3. **Filters:**
   - **Serve:** All / Hot / Iced (single select; default All).
   - **Milk:** checkbox chips `dairy, oat, soy, almond, coconut, other` — **all pre-ticked by default**. Unticking a box excludes that milk from the results. (Exclusion model: the user removes what she doesn't want, e.g. untick dairy to see only alternative milks.) Reviews with no milk recorded are treated as `other`. All boxes unticked = empty result set with the standard empty-state message.
4. **List, grouped by cafe as card stacks** — the list's first job is location, then ratings, so the unit of the list is the **cafe**, not the individual matcha. One entry per cafe matching the filters:
   - **Single matching review** → an ordinary card: photo (via existing `SignedImage`), cafe name, distance from user (e.g. "450 m" / "1.2 km"), overall score, milk · serve.
   - **Multiple matching reviews at the same cafe** → a **stack** (visually layered like playing cards, offset edges hinting at depth). Collapsed, the stack shows: top review's photo, cafe name, distance, **average overall score of the matching reviews**, and a count badge ("4 matchas"). Tapping the stack **fans it out** in place, expanding to reveal each review as its own card (photo, score, milk · serve, note snippet); tapping the header again collapses it. Only one stack needs to be open at a time (opening another may close the previous — implementer's choice for smoothness).
   - Filters apply to individual reviews first; a cafe's stack contains only its matching reviews, and the count/average reflect the filtered set. A cafe with no matching reviews disappears entirely.
   - Sorting is at cafe level: `Nearest` by distance; `Top rated` by that cafe's average overall (of matching reviews).
   - Cafe-level actions (shown on the card/stack header, only for cafes with a `google_place_id`):
     - **Open in Google Maps** — directions to the cafe. Link: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>&query_place_id=<place_id>`.
     - **Review on Google** — copies the most recent matching review's `note` to the clipboard (if present), then opens `https://search.google.com/local/writereview?placeid=<place_id>` where the user completes and submits the review herself. (Google provides no API to auto-post consumer reviews; this is the frictionless manual path.)

## Distance

- Computed client-side with the haversine formula from the user's current position (`navigator.geolocation.getCurrentPosition`, reusing the existing pattern in `CafePicker`) to each cafe's stored `latitude`/`longitude`.
- No API calls; works for already-loaded cafes even offline.
- Formatting: `< 1000 m` → whole metres ("450 m"); `>= 1000 m` → one decimal km ("1.2 km").

## Data flow

- Fetch reviews with cafe join exactly as the Dashboard does: `reviews.select('*, cafe:cafes(*)')`. Only `status = 'complete'` reviews appear in "Near me" (drafts are excluded; they live in the Journal's drafts notice).
- Filtering and sorting happen in memory on the fetched set.
- Map pins and distance derive from `review.cafe.latitude/longitude`.

## Edge cases & fallbacks

- **Location denied/unavailable:** list still renders. Distances are hidden, the sort defaults to `Top rated` and the `Nearest` option is disabled, the map centres on the mean of the user's cafe coordinates (or is omitted if none have coordinates), and a short note explains that distances need location access.
- **Manually-added cafes** (no coordinates, no `google_place_id`): appear in the list marked "added manually"; no distance, no map pin, no Google buttons. When sorting by Nearest, these sort last.
- **No complete reviews yet:** friendly empty state pointing at the + button (consistent with Dashboard tone).
- **Cafe has coordinates but no `google_place_id`** (shouldn't happen for Google-picked cafes, but defensive): distance + pin work; Google buttons hidden.
- **Fetch error:** same treatment as Dashboard — a plain "couldn't load" message.

## Google Static Maps

- Image URL built client-side against `https://maps.googleapis.com/maps/api/staticmap` with: `size`, `markers` for each cafe (and a distinct marker for the user), and the existing `VITE_GOOGLE_PLACES_KEY`.
- Requires enabling **Maps Static API** on the Google Cloud project and confirming the key's API restrictions permit it (guided browser step with the owner, as with earlier setup). The key is already HTTP-referrer restricted; the pages.dev referrer is already added.
- Cost: small per-image-load; negligible at personal scale.
- The API key appears in the image URL — acceptable because the key is referrer-restricted.

## Explicitly out of scope (future)

- **Interactive Google map** (pan/zoom, tappable pins) — the intended upgrade "once we scale". Static image is the interim.
- Discovering/among new cafes not yet reviewed.
- Any automatic push of reviews to Google.

## Testing

- **Unit (TDD):**
  - `haversine(lat1,lng1,lat2,lng2)` distance helper — known-distance fixtures.
  - `formatDistance(metres)` — boundary cases (999 m, 1000 m, 1500 m).
  - Filter/group/sort pure function over a fixture set of reviews: serve filter; milk exclusion filter (all ticked = all shown, unticked milk excluded, null milk treated as `other`); grouping by cafe with per-cafe count and average of matching reviews; Nearest sort (missing-coordinate cafe sorts last); Top-rated sort by cafe average.
  - Google URL builders (`writereview`, `maps directions`, static map `markers`) produce expected strings.
- **Manual (on-device with owner):** location permission grant/deny paths, map renders with pins, filters/sort behave, distances look right, stack fan-out/collapse feels right on the phone, both Google buttons open the correct place, clipboard copy works on iOS Safari.

## No database or auth changes

RLS, storage, and the schema are untouched. This feature is read-only over existing data plus outbound links.
