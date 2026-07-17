# Matcha Muse — Session Handoff (written 2026-07-07, late evening)

**For the next agent (any model): read this file, the spec, and the plan before doing anything.**

> **REPO MOVED (2026-07-17):** the repo now lives at
> `C:\Users\justi\OneDrive - LightSpeed Consulting\APPS\MatchaMuse`
> (was `C:\Users\justi\OneDrive\Documents\MatchaMuse`) — part of the
> Microsoft-tenancy move. All old paths in this file should be read
> against the new root. Newest section: "Owner improvements (2026-07-17)".

- Spec (approved): `docs/superpowers/specs/2026-07-07-matcha-muse-design.md`
- Plan (v1, with amendments): `docs/superpowers/plans/2026-07-07-matcha-muse-v1.md`
- Owner: Justina Gardiner (justina@lightspeedconsulting.com.au) — **non-technical**. Explain things plainly, guide her step-by-step through any browser/account work, never ask her to run commands.

## Process being followed

Execution uses **superpowers:subagent-driven-development**: one fresh implementer subagent per plan task (full task text pasted into the prompt — subagents don't read the plan file), then a **spec-compliance review subagent**, then a **code-quality review subagent** (superpowers:code-reviewer), before the next task starts. Implementer model: sonnet (tasks are fully specified). Reviews: sonnet (haiku for trivial diffs). All review findings so far were either applied as controller-authorized fix messages to the same implementer, or recorded as plan amendments. TDD is followed strictly on tasks marked (TDD).

Work is on branch **`build/v1`** (repo root `C:\Users\justi\OneDrive\Documents\MatchaMuse`, `main` holds only docs). App lives in `app/` (Vite + React 19 + TS + Tailwind 3). When v1 is complete: final whole-implementation code review, then superpowers:finishing-a-development-branch (merge build/v1 → main; no remote exists).

> **2026-07-10 wrap-up:** build/v1 merged to `main` (fast-forward) and deleted; all work now on `main`. Private GitHub remote exists: `https://github.com/JG260180/matcha-muse` (origin; GCM browser auth on this machine). Future feature branches should fork from `main` and push there. v1 + Near me + review-detail are ALL shipped, on-device accepted, and backed up. Parked ideas: interactive Google map "once we scale", multi-user accounts, OTP login revisit, Google-links tap-target sizing, storage-orphan sweep.

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

### Cafe menu photos (2026-07-15) — CODE COMPLETE on `feature/cafe-menu`, awaiting Justina's browser/on-device acceptance

- Spec `docs/superpowers/specs/2026-07-15-cafe-menu-photos-design.md`; plan `docs/superpowers/plans/2026-07-15-cafe-menu-photos.md` (see its Amendments section). Owner-approved design: menu photos live on the review page ONLY (view mode, cafe reviews only — invisible on journal/Near me), multiple photos per cafe oldest-first, any signed-in reviewer can add/remove.
- **Branch forked from `feature/shared-journal` (unmerged!). Merge order: shared-journal → cafe-menu → main, then deploy.**
- **No database work was needed**: the `menu_photos` table + RLS + storage policies have existed since v1 (schema.sql) — this feature finally wired them to UI. Storage path prefix `menus/`.
- Built via subagent-driven development, Tasks 0–3 done, each through spec + quality review. Quality review of Task 2 caught two real issues, both fixed (`747f20c`): (1) viewer-close race — removal state is now photo-id-scoped (`removingId`/`removeFailedId`), success closes via pure functional `setViewing` compare; (2) the full-screen viewer is the app's FIRST `role="dialog"` — it now has `aria-modal`, autofocus on ✕, Escape-to-close, focus return. **Reuse this dialog pattern for any future modal.** Reviewer's non-blocking notes on record: no focus trap; cross-photo delete-failure is silent (photo staying in the row is the signal); `removeArmed` still a global boolean (safe direction).
- State: 113 tests passing (was 89), tsc + `npm run build` clean. Commits: `bf5b470` (lib) → `71a1e41` (CafeMenu) → `747f20c` (fix round) → `9f8a60a` (ReviewDetail mount).
- **STILL TO DO:** (1) Justina signs in on the dev server and live-checks: add menu photo (library + camera), see it from another review at the same cafe, viewer zoom, remove with confirm, journal/Near me unchanged — assistant must NOT enter her password, ever; (2) her iPhone check (portrait menu photo stays upright); (3) final whole-feature review verdict recorded below/in session; (4) merge (after shared-journal) + deploy + add pages.dev acceptance.
- `.claude/launch.json` added at repo root (dev-server launch config for the in-app preview browser).

### 2026-07-15 DEPLOY: shared-journal + cafe-menu + forgot-password ALL SHIPPED to production

- All three stacked branches fast-forward-merged to `main` in order (shared-journal → cafe-menu → forgot-password), pushed to origin (`37d444c`), and **deployed live** to https://matcha-muse.pages.dev (deploy hash fb7b6f03; `npm run build` + `npx wrangler pages deploy dist --project-name matcha-muse --branch main --commit-dirty=true`). 138 tests, tsc + build clean. Verified: production login screen shows the "Forgot password?" link (new bundle serving).
- Added a final cosmetic fix in the deploy (`37d444c`): Login clears the stale sign-in error banner when opening Forgot password (final-review Minor #1).
- **Gmail SMTP is live** on Supabase (custom SMTP, app password) — this now carries ALL auth emails. Reset template is code-only (`{{ .Token }}`, no link). **Email OTP length was 8 by default → changed to 6** (Auth → Sign In/Providers → Email → Email OTP length) to match the app's 6-digit input. Confirmed: recovery email arrives via Gmail with a 6-digit code and NO link — defeats the M365 link scanner that killed v1 magic links.
- **Remaining = Justina's on-device acceptance on the LIVE site (she drives, assistant never types passwords):** (1) Forgot password → 6-digit code → set a password she'll remember (this is how she gets a known password; the Supabase dashboard has NO admin set-password action); (2) add a real menu photo on a cafe review (camera on iPhone — portrait must stay upright via downscalePhoto EXIF) and confirm the other reviewer sees it; (3) confirm menu stays invisible on journal/Near me. Final whole-feature reviews for BOTH features already passed (menu: ready; forgot-pw: ready). Non-blocking minors on record in the plans.
- Feature branches (`feature/shared-journal`, `feature/cafe-menu`, `feature/forgot-password`) can be deleted once she's happy — kept for now.

### Forgot password (2026-07-15) — CODE COMPLETE (see DEPLOY note above)

- Spec `docs/superpowers/specs/2026-07-15-forgot-password-design.md`; plan `docs/superpowers/plans/2026-07-15-forgot-password.md` (READ THE AMENDMENTS — the story changed twice). Trigger: Justina forgot her password; **the Supabase dashboard has NO admin "set password" action** (verified by driving the Users panel — only send-recovery/magic-link/ban/delete), so this feature is the only self-serve path.
- Design: 6-digit emailed CODE, never a link — her M365 scanner consumes one-time links (v1 lesson). The reset email template must contain `{{ .Token }}` and NO `{{ .ConfirmationURL }}` (same underlying token — a scanned link kills the code too).
- **Template editing is LOCKED on free Supabase without custom SMTP** (v1 note confirmed by screenshot). Owner chose Gmail SMTP (app password; needs Google 2-Step Verification), after declining Brevo to avoid another provider. As of session end she had SMTP working (template unlocked) and was pasting the code-only body; final "Send password recovery → code-only email arrives" test may still be pending — CHECK WITH HER.
- Branch stacked on `feature/cafe-menu`. **Merge train: shared-journal → cafe-menu → forgot-password → main.**
- Code: `lib/passwordReset.ts` (requestReset / confirmReset=verifyOtp-recovery-then-updateUser / isRateLimit), `components/ForgotPassword.tsx` (two-step UI, neutral no-oracle messaging, 60 s resend cooldown via single interval — per-tick setTimeout stalls under fake timers, gotcha!), Login entry. 137 tests total, tsc + build clean. Commits `d274db7` → `a4fba80` → `e0a068d` (fix round: "kitchen" copy bug, confirm-step coverage, Back disabled while busy) → `a100244`.
- Quality-review notes on record: hung request briefly leaves no enabled controls on the code step (accepted); cross-photo… (n/a here); skipped minors: "Too many attempts" string dedupe, Send-again re-invoke assertion.
- UI round-trip verified in the preview app (login → forgot → back). **STILL TO DO:** her template test email; live end-to-end reset with HER typing the password (assistant never touches passwords — also true of the SMTP key); her first real use of the flow doubles as setting her password (dashboard can't); then menu-feature acceptance in the same sitting; final whole-feature review verdict; merge + deploy.

### Owner improvements (2026-07-17) — CODE COMPLETE on `feature/owner-improvements`, NOT merged/deployed

Six improvements Justina requested on 2026-07-17, built in one autonomous session
(no live Q&A — design decisions follow existing patterns and are recorded in the
spec). Spec `docs/superpowers/specs/2026-07-17-owner-improvements-design.md`;
plan `docs/superpowers/plans/2026-07-17-owner-improvements.md` (READ ITS
AMENDMENTS — including the same-day **Round 2** owner-feedback batch: milk
All-chip model on both views, leave-guard save/draft/delete dialog, drafts can
skip the cafe until publishing, photo marked optional; spec has the details).
State: **177 tests passing, tsc + `npm run build` clean.** Commits
`6d3917c` (docs) → `12121e3`/`d31cb77` (price) → `a59a22b` (date) → `cf9e94b`
(draft menu/delete) → `b5db479` (journal filters) → `55c59c7` (crop) → `3dfa1a4`
(review fixes).

1. **Date field** on create/edit (defaults today, capped at today; same-day
   keeps the original timestamp, changed day saves local noon — `lib/drankAt.ts`).
2. **Drafts save without a price** (Save-matcha still requires one).
   ✅ **DB migration APPLIED 2026-07-17** — Justina ran
   `app/supabase/migrations/2026-07-17-draft-price-null.sql` in the SQL editor
   and verified `information_schema.columns.is_nullable = YES` for
   `reviews.price`. Nothing further needed on the database.
3. **Menu photos from drafts** — CafeMenu now renders in edit mode too
   (amends the 2026-07-15 menu spec's "view mode only" rule, owner-requested).
4. **Draft delete without publishing** — two-tap ConfirmDelete in draft edit
   mode, with delete-specific busy/error copy.
5. **Photo crop/position** — `PhotoAdjust` full-screen dialog (drag + zoom
   slider, 4:3 frame; `lib/crop.ts` holds the math) on NewReview and
   ReviewDetail edit, including the already-saved photo via storage download.
   Re-adjust always starts from the as-picked original (no compounding crops).
   Falls back to the untouched original on any render failure (downscalePhoto
   stance). Pinch-zoom parked; slider only.
6. **Journal filters** — Serve + Milk chip rows on the Dashboard, identical to
   Near Me, composing with reviewer chips + drafts toggle; stat tiles follow;
   changing them resets drafts-only (same reassert-guard as reviewer chips).

**Gotcha for this machine:** vitest's default parallel run now flakes with
24 test files (random timeouts in untouched suites — jsdom worker overload +
OneDrive). Use `npx vitest run --no-file-parallelism`. Not a code issue.

**STILL TO DO:** (1) ~~price migration~~ DONE 2026-07-17; (2) her on-device acceptance:
date edit, no-price draft, menu photo from a draft, draft delete, Adjust on a
real iPhone photo (portrait must stay upright — createImageBitmap EXIF path),
journal filters; (3) merge `feature/owner-improvements` → `main`, push, deploy
(`npm run build` then `npx wrangler pages deploy dist --project-name
matcha-muse --branch main --commit-dirty=true` from `app/`). Deploy was NOT
run this session (owner not present).

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
