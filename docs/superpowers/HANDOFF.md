# Matcha Muse — Session Handoff (written 2026-07-07, late evening)

**For the next agent (any model): read this file, the spec, and the plan before doing anything.**

- Spec (approved): `docs/superpowers/specs/2026-07-07-matcha-muse-design.md`
- Plan (v1, with amendments): `docs/superpowers/plans/2026-07-07-matcha-muse-v1.md`
- Owner: Justina Gardiner (justina@lightspeedconsulting.com.au) — **non-technical**. Explain things plainly, guide her step-by-step through any browser/account work, never ask her to run commands.

## Process being followed

Execution uses **superpowers:subagent-driven-development**: one fresh implementer subagent per plan task (full task text pasted into the prompt — subagents don't read the plan file), then a **spec-compliance review subagent**, then a **code-quality review subagent** (superpowers:code-reviewer), before the next task starts. Implementer model: sonnet (tasks are fully specified). Reviews: sonnet (haiku for trivial diffs). All review findings so far were either applied as controller-authorized fix messages to the same implementer, or recorded as plan amendments. TDD is followed strictly on tasks marked (TDD).

Work is on branch **`build/v1`** (repo root `C:\Users\justi\OneDrive\Documents\MatchaMuse`, `main` holds only docs). App lives in `app/` (Vite + React 19 + TS + Tailwind 3). When v1 is complete: final whole-implementation code review, then superpowers:finishing-a-development-branch (merge build/v1 → main; no remote exists).

## Task status (plan Task numbers) — updated 2026-07-08, overnight run complete

**Tasks 1–13 ALL DONE, each through both reviews + any fix. Only Task 14 (deploy, human-assisted) remains.** A final whole-implementation review passed: no critical/blocking issues; end-to-end data flow, offline round-trip (drankAt preserved, flush concurrency), and RLS-vs-client-insert all verified coherent. Verdict: **ready for deployment.** State: 20 source files, **12 tests passing**, `tsc -b --noEmit` clean, `npm run build` clean. Google Places key done + live-verified. Only Task 14 is left.

| # | Task | Status |
|---|------|--------|
| 1 | Scaffold | ✅ Done + reviews |
| 2 | Ceremony theme/shell | ✅ Done + reviews |
| 3 | Icon/PWA assets | ✅ Done + reviews |
| 4 | Supabase project (human) | ✅ Done |
| 5 | Schema/RLS/storage | ✅ Done — applied & verified in dashboard |
| 6 | Types/client/login | ✅ Done + reviews + fixes |
| 7 | StarRating (TDD) | ✅ Done + reviews + a11y fix |
| 8 | Places lookup (TDD) | ✅ Done + reviews + key live-verified |
| 9 | Offline queue (TDD) | ✅ Done + reviews + flush-race fix (concurrency-safe) |
| 10 | ReviewForm (TDD) | ✅ Done + reviews + price-hardening |
| 11 | CafePicker | ✅ Done + reviews + unmount guard + fetch timeouts |
| 12 | Save pipeline + NewReview | ✅ Done + reviews (downscale/orphan decisions recorded) |
| 13 | Dashboard/routing/flush | ✅ Done + reviews + concurrent-flush guard, `_redirects`, dashboard error state |
| — | Final whole-app review | ✅ Passed — ready for deploy; chips capitalized + dead icons.svg removed |
| 14 | Deploy + iPhone acceptance | 🚧 **Deploy DONE (2026-07-08); iPhone acceptance + Step 4b remain (on-device with Justina).** |

### Task 14 progress (updated 2026-07-08)

**DONE (from Justina's machine):**
- `npm run build` clean, 12 tests passing.
- `wrangler login` (Justina's Cloudflare account, justina@lightspeedconsulting.com.au, account id a7da89bb5f2a02f20be36b193e05f6e5).
- Pages project `matcha-muse` created (production branch `main`); deployed `app/dist` to production. **Live at https://matcha-muse.pages.dev** (200; deep-link `/new` returns 200 via `_redirects`). Note: we deploy from `build/v1` with `--branch main --commit-dirty=true` so it lands on the production URL.
- Supabase → Auth → URL Configuration: Site URL = `https://matcha-muse.pages.dev`; Redirect URL `https://matcha-muse.pages.dev/**` added.
- Google Cloud → Maps Platform API Key → Website restrictions: added `https://matcha-muse.pages.dev/*` (localhost referrer kept). Google warns settings can take ~5 min to propagate.

**STILL TO DO (needs Justina + her iPhone, on-device):**
- Step 4 iPhone acceptance checklist (items 1–8 below).
- Step 4b: implement + verify `downscalePhoto` in `app/src/lib/api.ts` WITH her present (do NOT ship blind — must confirm portrait photos stay upright on her actual iPhone). Update the pointer comment in `offlineQueue.ts` once done.
- Step 5 commit (`chore: v1 deployed to Cloudflare Pages, iPhone acceptance run`) after acceptance passes.

### v1 acceptance progress (2026-07-10)

- Items 1–3 ✅ (home screen, password login, camera capture). Owner-requested additions shipped mid-checklist: photo library picker + removable-photo X (`9073423`), header tap returns to journal (`cc38efc`).
- Item 4: first attempt failed — **iOS Settings → Privacy → Location Services → Safari Websites was set to "Never"**, so no prompt ever appeared and nearby lookup failed silently (text search worked). Fixed by setting "While Using the App". Spot-check pending next time she's near a cafe. Record this quirk for any future geolocation issue.
- Items 5–8 pending (full save, airplane-mode sync, draft, upright photo).

### Review-detail feature (view/edit/delete) — SHIPPED + ACCEPTED on-device 2026-07-10

- Spec `docs/superpowers/specs/2026-07-10-review-detail-design.md`; plan `docs/superpowers/plans/2026-07-10-review-detail.md`. Tasks 1–5 via subagent-driven development (two-stage reviews; fixes: ConfirmDelete auto-disarm/aria-live, api cleanup-error inspection, pendingDraft edit preservation, id-change state reset, test hardening). Final whole-feature review passed. Owner acceptance: "works perfectly".
- **Schema amendment:** `photos` bucket delete policy was missing (Task 3 quality review caught it — cleanup silently failed forever). Owner applied it via SQL editor; recorded in `app/supabase/schema.sql`.
- Owner-requested extras shipped en route: clipboard-copied confirmation on "Review on Google"; header links home.
- Deferred minors on record: Google-links tap-target sizing; grid-Link display class; ConfirmDelete rearm-after-failed-delete UX.

### "Near me" feature (post-v1) — SHIPPED 2026-07-10, on-device ACCEPTED (all 8 checks)

- Spec `docs/superpowers/specs/2026-07-09-near-me-design.md`; plan `docs/superpowers/plans/2026-07-09-near-me.md` (Tasks 1–5 done via subagent-driven development, each through spec + quality review; final whole-feature review passed with one empty-state fix `56623d3`).
- Google Maps Static API: already enabled + already in the key's 35-API allowlist — no console changes were needed. Live-verified with pages.dev referer (200, image/png).
- Deployed commits through `56623d3` (bundle `index-BTxNWEg-.js`). Task 6 on-device checklist (plan Task 6 Step 4) still to run with Justina; note final review's ask to eyeball single-marker map zoom.

### Task 14 playbook (the only remaining work)

Follow the plan's Task 14 steps AND its amendment notes (Step 4b photo-downscale; iPhone checklist item 8 about upright photos). Sequence:
1. **Human:** Justina creates a free Cloudflare account (dash.cloudflare.com — email+password, no card).
2. From `app/`: `npm run build`, then `npx wrangler login` (opens browser for her to approve), `npx wrangler pages project create matcha-muse --production-branch main`, `npx wrangler pages deploy dist --project-name matcha-muse`. Yields a `https://matcha-muse.pages.dev` URL. (`_redirects` already in `app/public/`, so SPA deep links work.)
3. **Post-deploy config:** Supabase → Auth → URL Configuration: set Site URL + add Redirect URL to the pages.dev URL. Google Cloud → the Places API key → Website restrictions: add `https://matcha-muse.pages.dev/*`.
4. **Then implement Step 4b (photo downscaling) WITH Justina present** so it's verified on her actual iPhone (upright-photo check) — do NOT ship it blind; that's why it was deferred here.
5. **iPhone acceptance checklist** (plan Task 14 Step 4, items 1–8): add-to-home-screen, password login (autofill), camera capture, nearby-cafe confirm, full save appears on dashboard, airplane-mode offline save → reconnect → syncs, draft save, and photo displays upright.
6. Fix anything the checklist surfaces, then: final branch wrap via **superpowers:finishing-a-development-branch** (merge build/v1 → main; no git remote exists yet — offer to create a private GitHub repo if she wants off-machine backup).

## Key decisions & deviations (all recorded in plan amendments too)

1. **Login is email + PASSWORD, not magic link.** Justina's Microsoft 365 mail security pre-scans links and consumes the one-time token (`otp_expired`); free Supabase can't edit email templates without custom SMTP. She created her own user (Authentication → Users → Add user, auto-confirm) and **has successfully signed in** on desktop. Revisit OTP in Phase 2.
2. React 19 (not 18) — scaffold pulled latest; harmless, noted.
3. `vite.config.ts` imports defineConfig from `'vitest/config'` (Vitest 4 typing); `tsconfig.app.json` types = `["vite/client", "vitest/globals"]`.
4. `Occasion` union type exists in `types.ts`; `occasions` fields are `Occasion[]` everywhere.
5. StarRating container is `role="group"` (not radiogroup) with `aria-live="polite"` readout; Task 10's test queries `getByRole('group', ...)` accordingly.
6. supabase key in use is a new-style `sb_publishable_...` key — equivalent to anon key, do not "fix".

## Environment / accounts

- **Supabase**: project `matcha-muse`, ref `sodkpgrdoufcicajqoks`, region Sydney. Schema + RLS + private `photos` bucket applied (via SQL editor) and verified. Auth Site URL set to `http://localhost:5173`. Justina's user exists with password (she knows it; never handle her password).
- **`app/.env.local`** (gitignored, fully populated): real `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_GOOGLE_PLACES_KEY` (added 2026-07-07 after Justina created it; website-restricted to `http://localhost:5173/*`, Places API (New) only). **Verified working** — a live searchText call with Referer localhost:5173 returned real Adelaide matcha cafes. Remaining at Task 14: add the pages.dev URL to the key's website restrictions.
- **Cloudflare** (Task 14): account not created yet. Post-deploy config also required: Supabase Site URL + redirect URLs → pages.dev; Google key referrer += pages.dev.
- Dev server: was running during the session; stopped at session end. Start with `npm run dev` in `app/` (Vite may pick 5174+ if 5173 is taken — check).

## Machine/tooling quirks learned (avoid re-learning these painfully)

- **Windows process kill**: TaskStop on a backgrounded `npm run dev` does NOT kill the node process tree — find the PID via `netstat -ano | findstr :5173` / `Get-NetTCPConnection` and `Stop-Process -Force`, then verify the port refuses connections.
- **Chrome extension automation on supabase.com**: `javascript_tool` (Runtime.evaluate) times out consistently — unusable this machine/session. Typing large text into Monaco editors freezes the tab (autocomplete inserts garbage — this caused a failed schema run mentioning `email_change_confirm_status`; harmless, transaction aborted). **Working recipe**: `mcp__computer-use__write_clipboard` (needs request_access with clipboardWrite; Justina approves) → click into the editor → Ctrl+V → verify content by paging with PageDown screenshots → Ctrl+Enter to run. Monaco's final-viewport render sometimes paints blank — it's a render glitch, PageUp/PageDown to force repaint.
- Vitest with no test files exits 1 ("No test files found") — that was expected only in early tasks; from Task 7 on, tests exist (5 passing as of 58488bf: StarRating 2, places 2, ReviewForm 1).
- Git identity is configured repo-locally (Justina Gardiner / her email). LF→CRLF warnings are normal noise.
- OneDrive hosts the repo — occasional slow file ops; nothing broken so far.

## Commit log (build/v1, oldest first — see `git log --oneline`)

scaffold `bac546e` → vitest/config fix `67e403f` → docs React19 `25bd134` → theme `ea94de8` → icons `07ebced` → env+schema `8448aed` → types/client/login `1444226` → login fixes `8ef6129` → docs occasions `6b110b0` → StarRating `ef8e091` → docs a11y `404d005` → tsconfig vitest globals `4545ff3` → StarRating a11y `6a596be` → password login `506fe72` → docs password amendment `f29c264` → places `ba47cce` → docs star/group amendments (in f29c264/404d005) → ReviewForm `58488bf` → (this handoff + Task 11 timeout amendment: next commit).

## How to resume tomorrow

1. Read this file, then the plan's remaining tasks (11 → 9 → 12 → 13 → 14, after closing Task 10's quality review).
2. Confirm whether Justina has the Google Places key; if yes, write it into `app/.env.local` (never commit it).
3. Continue subagent-driven execution exactly as above (full task text in each subagent prompt, two-stage review per task, exact commit messages from the plan).
4. Remaining human moments to schedule with her: Google key (if not done), Cloudflare account + `npx wrangler login` (Task 14), iPhone acceptance checklist (Task 14, on her phone), and the post-deploy Supabase/Google URL config.
5. Before claiming v1 done: run the full Task 14 checklist, then final whole-branch code review, then finishing-a-development-branch.
