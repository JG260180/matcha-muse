# Matcha Muse — Session Handoff (written 2026-07-07, late evening)

**For the next agent (any model): read this file, the spec, and the plan before doing anything.**

- Spec (approved): `docs/superpowers/specs/2026-07-07-matcha-muse-design.md`
- Plan (v1, with amendments): `docs/superpowers/plans/2026-07-07-matcha-muse-v1.md`
- Owner: Justina Gardiner (justina@lightspeedconsulting.com.au) — **non-technical**. Explain things plainly, guide her step-by-step through any browser/account work, never ask her to run commands.

## Process being followed

Execution uses **superpowers:subagent-driven-development**: one fresh implementer subagent per plan task (full task text pasted into the prompt — subagents don't read the plan file), then a **spec-compliance review subagent**, then a **code-quality review subagent** (superpowers:code-reviewer), before the next task starts. Implementer model: sonnet (tasks are fully specified). Reviews: sonnet (haiku for trivial diffs). All review findings so far were either applied as controller-authorized fix messages to the same implementer, or recorded as plan amendments. TDD is followed strictly on tasks marked (TDD).

Work is on branch **`build/v1`** (repo root `C:\Users\justi\OneDrive\Documents\MatchaMuse`, `main` holds only docs). App lives in `app/` (Vite + React 19 + TS + Tailwind 3). When v1 is complete: final whole-implementation code review, then superpowers:finishing-a-development-branch (merge build/v1 → main; no remote exists).

## Task status (plan Task numbers)

| # | Task | Status |
|---|------|--------|
| 1 | Scaffold | ✅ Done + both reviews passed |
| 2 | Ceremony theme/shell | ✅ Done + reviews |
| 3 | Icon/PWA assets | ✅ Done + reviews |
| 4 | Supabase project (human) | ✅ Done |
| 5 | Schema/RLS/storage | ✅ Done — applied & verified in dashboard |
| 6 | Types/client/login | ✅ Done + reviews + fixes (see amendments) |
| 7 | StarRating (TDD) | ✅ Done + reviews + a11y fix |
| 8 | Places lookup (TDD) | ✅ Code done + both reviews. ⏳ **HUMAN STEP PENDING: Google API key** (see below) |
| 10 | ReviewForm (TDD) | ✅ Built (commit 58488bf), ✅ spec review passed. ⏳ **Quality review was in flight when session ended** — check for its result in this session's history; if absent, re-run quality review on range ba47cce..58488bf before building on it |
| 9 | Offline queue (TDD) | ❌ Not started. **Deliberately reordered to AFTER Tasks 10+11** (its imports need ReviewForm + CafePicker types; plan sanctions this) |
| 11 | CafePicker | ❌ Not started. Includes plan amendment Step 1b: add `AbortSignal.timeout(8000)` to both fetches in `places.ts` |
| 12 | Save pipeline + NewReview | ❌ Not started |
| 13 | Dashboard/routing/flush | ❌ Not started |
| 14 | Deploy + iPhone acceptance | ❌ Not started (human-assisted: Cloudflare account, post-deploy config) |

**Execution order for remaining work: (close out 10's quality review) → 11 → 9 → 12 → 13 → 14.**

## Key decisions & deviations (all recorded in plan amendments too)

1. **Login is email + PASSWORD, not magic link.** Justina's Microsoft 365 mail security pre-scans links and consumes the one-time token (`otp_expired`); free Supabase can't edit email templates without custom SMTP. She created her own user (Authentication → Users → Add user, auto-confirm) and **has successfully signed in** on desktop. Revisit OTP in Phase 2.
2. React 19 (not 18) — scaffold pulled latest; harmless, noted.
3. `vite.config.ts` imports defineConfig from `'vitest/config'` (Vitest 4 typing); `tsconfig.app.json` types = `["vite/client", "vitest/globals"]`.
4. `Occasion` union type exists in `types.ts`; `occasions` fields are `Occasion[]` everywhere.
5. StarRating container is `role="group"` (not radiogroup) with `aria-live="polite"` readout; Task 10's test queries `getByRole('group', ...)` accordingly.
6. supabase key in use is a new-style `sb_publishable_...` key — equivalent to anon key, do not "fix".

## Environment / accounts

- **Supabase**: project `matcha-muse`, ref `sodkpgrdoufcicajqoks`, region Sydney. Schema + RLS + private `photos` bucket applied (via SQL editor) and verified. Auth Site URL set to `http://localhost:5173`. Justina's user exists with password (she knows it; never handle her password).
- **`app/.env.local`** (gitignored, already populated): real `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; `VITE_GOOGLE_PLACES_KEY` still placeholder `YOUR-PLACES-KEY`.
- **Google Places key — NEXT HUMAN STEP.** Justina was given the full walkthrough (console.cloud.google.com → project `matcha-muse` → enable billing → enable "Places API (New)" → create API key → restrict to Websites `http://localhost:5173/*` + Places API (New) only). When she supplies the key: put it in `app/.env.local`, restart any dev server, and later (Task 14) add the pages.dev URL to the key's website restrictions.
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
