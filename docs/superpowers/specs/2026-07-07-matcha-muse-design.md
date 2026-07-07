# Matcha Muse — Design Specification

**Date:** 2026-07-07
**Owner:** Justina Gardiner
**Status:** Approved design, pre-implementation

## What it is

Matcha Muse is a personal matcha-reviewing app for iPhone. Justina photographs a matcha, rates it, and the app associates it with the cafe she is at. Over time it becomes a searchable, filterable journal of every matcha she has had — and the seed of a future public brand (Instagram audience → sponsorship/advertising).

## Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Private journal: capture, rate, cafes, dashboard, back-dating, menu photos, Instagram share cards | **This spec** |
| 2 | Public audience: Instagram growth, possibly other reviewers | Designed-for, not built |
| 3 | Income: sponsorship, advertising | Designed-for, not built |

Phase 1 is deliberately private: single user, email-link login, no public pages.

## Decisions log (agreed 2026-07-07)

- **Platform:** Progressive Web App (PWA) added to the iPhone home screen via Safari. No App Store, no Mac, no Apple fees for v1. Upgrade path to App Store exists (wrap the PWA or rebuild native) when going public.
- **Ratings:** 1–5 in half steps for overall, taste, sweetness, texture. Overall is Justina's own gut-feel score (not an auto-average) and is the headline number everywhere.
- **Size:** recorded as fact (S / M / L, optional ml), not rated. Combined with price it powers value-for-money comparisons.
- **Drink details recorded:** hot/iced, milk type (dairy/oat/soy/almond/none), drink style (latte/straight/other), optional free-text note.
- **Occasion tickboxes:** Hangout, Grab & go, Business mtg, Dessert/occasion — multi-select, any combination.
- **Data:** cloud database from day one (Supabase). Photos in Supabase Storage.
- **Instagram:** two-tap share cards via the iOS share sheet. No Meta developer app in v1.
- **Menu photos:** attached to the cafe page for reference. No OCR/price extraction in v1.
- **Visual direction:** "Ceremony" — warm cream background, soft matcha greens, serif headings, calm gallery feel. Timeless over trendy.
- **Name:** Matcha Muse.

## Architecture

```
iPhone (Safari PWA, home-screen icon)
  └─ React + Vite single-page app, Tailwind CSS, Ceremony theme
       ├─ Supabase (one free project)
       │    ├─ Postgres database (reviews, cafes, menu photos)
       │    ├─ Auth (email magic link, single user in v1)
       │    └─ Storage (review photos, menu photos)
       ├─ Google Places API (cafe nearby-search + name lookup)
       └─ Service worker (offline queue + caching)
Hosting: Cloudflare Pages (free), later a custom domain.
```

Running cost target: **$0/month** at personal scale. One-time setups: free Supabase account; Google Cloud account with billing enabled (Places API stays within free monthly credit at this volume).

### Why this stack (alternatives considered)

- Python/Flask backend (consistent with lsc-admin): rejected — needs an always-on server; free tiers sleep; more upkeep for a non-technical owner.
- Firebase: rejected — Firestore makes future "rank cafes near me across all users" queries clumsy; data export harder than Postgres.
- Native iOS app now: rejected — no Mac, $150/yr fee, slow iteration while the app is single-user.

## Data model

- **cafes** — id, name, address, suburb, latitude, longitude, google_place_id, created_at. Shared records (future-proof for multi-user).
- **reviews** — id, user_id, cafe_id, photo_path, drank_at (EXIF date for imports, now for live), overall*, taste, sweetness, texture (all 0.5–5.0 in 0.5 steps), temperature (hot/iced), milk, drink_style, size (S/M/L), size_ml (optional), price* (AUD as paid), occasions (set of: hangout, grab_go, business_mtg, dessert_occasion), note, status (complete | draft), created_at. Fields marked * are required; everything else optional so a rushed entry can be completed later (drafts surfaced on the dashboard).
- **menu_photos** — id, cafe_id, photo_path, taken_at.

Derived, not stored: value-for-money (price normalised by size), per-cafe averages, distance from current location.

Row-level security: every table locked to the authenticated user in v1 (cafes readable by any authenticated user — trivially "just Justina" now, correct shape for Phase 2).

## Features

### 1. Live capture flow (target: under 30 seconds)

1. Open app → prominent camera button → photograph the drink.
2. App requests location, calls Google Places nearby-search (cafes, ~150 m radius), shows the closest few → Justina taps to confirm the cafe. Fallbacks: no match or location denied → search by name; still nothing → create cafe manually (name + suburb).
3. Single rating screen: overall + three dimension star rows (big tap targets, half-star support), hot/iced toggle, milk chips, drink-style chips, size chips, price field (numeric pad), four occasion tickboxes, optional note.
4. Save. If offline, the review (and photo) queue in IndexedDB and sync automatically when connectivity returns; queued state is visible so nothing silently vanishes.

### 2. Back-dating / import flow

- "Add from photos": pick one or more images from the iOS photo picker (camera roll; OneDrive photos are reachable via the iOS Files/photo picker — no OneDrive API integration needed in v1).
- The app reads the photo's EXIF original-capture date as drank_at (editable; falls back to file date, then today).
- Cafe association by name: type the cafe name → Google Places text search returns name + address → confirm → cafe record created with coordinates. Then the normal rating screen.

### 3. Cafes

- Cafe page: name, address, map pin, visit count, average overall / dimensions across visits, price history, all review photos, all menu photos.
- Menu photos: camera or photo-picker upload directly from the cafe page (or during a review).
- "Near me": ranks cafes by Justina's own average rating, showing distance, headline score, and last-paid price. Answers "best matcha within walking distance."

### 4. Dashboard (home)

- Header stats: total matchas, cafes visited, average price, average overall.
- Photo-grid journal, newest first; each tile → full review.
- Filters (combinable): overall rating range, price range, hot/iced, milk, drink style, occasion tags, suburb, date range. Sort by date, rating, price, value.
- Draft reviews flagged for completion.

### 5. Instagram share cards

- On any review: "Share card" renders the review photo in a Ceremony-styled frame (cream border, serif cafe name, overall score with star detail, Matcha Muse wordmark) to a PNG via canvas, then hands it to the iOS share sheet → Instagram.
- Card is generated on-device; nothing is posted automatically.

## Visual design — "Ceremony"

- Palette: warm cream background (#F7F4ED family), deep green ink for text, soft matcha green accents, muted sand for chips/tags.
- Type: serif for headings and cafe names (quiet, editorial); clean sans for UI and numbers.
- Feel: calm, gallery-like, generous whitespace. Photography is the hero — UI recedes.
- Big touch targets throughout (one-handed use with a matcha in the other hand is the design constraint).
- App icon: simple chasen (bamboo whisk) or matcha-bowl mark in the palette, so the home-screen icon looks intentional from day one.

## Error handling

- **Offline:** reviews queue locally and sync later; the app shell is cached so it opens without signal.
- **Location denied/unavailable:** fall through to name search; app remains fully usable without location.
- **Google Places unavailable/over quota:** manual cafe creation always available.
- **Photo upload failure:** review saves with photo queued for retry; never lose ratings because a photo failed.
- **Missing EXIF on imports:** fall back to file date, then today — always editable.

## Testing

- Unit tests for pure logic: value-for-money calculation, filter/sort logic, share-card layout data, EXIF date fallback chain.
- Manual acceptance checklist run on the actual iPhone (Safari): add-to-home-screen, camera capture, location confirm, offline save/sync, photo import, share card to Instagram.

## Out of scope for v1

- Automatic Instagram posting (Meta developer app) — Phase 2.
- Other users, public pages, comments, follows — Phase 2.
- Sponsorship/advertising features — Phase 3.
- Menu OCR / automatic price extraction.
- App Store listing.
- OneDrive API integration (photo picker covers imports).

## Accounts and setup Justina will need (guided, one-time)

1. Supabase account (free) — database, login, photo storage.
2. Google Cloud account with billing enabled — Places API key (usage stays in free credit).
3. Cloudflare Pages (free) — hosting.
4. Optional, later: custom domain (~$20/yr), Instagram account for the brand.
