# Matcha Muse — Development Playbook

**Written 2026-07-10 after shipping v1, "Near me", and review-detail (view/edit/delete). Updated 2026-07-17 after the owner-improvements release (dates, draft rules, crop, filters, leave-guard).**
Purpose: the distilled learnings, decisions, and working recipe from the entire build, so any future development session — with any assistant/model, or a human developer — starts here instead of relearning. Current project *state* lives in `docs/superpowers/HANDOFF.md`; this file is the *how and why*.

---

## 1. The owner and how to work with her

Justina Gardiner (justina@lightspeedconsulting.com.au) — non-technical business owner, and the app's only user.

- **Plain language, always.** No jargon without a one-line explanation. Analogies land well ("swapping the doorway, not the house").
- **Numbered click-by-click steps** for anything in a browser or on the phone. She executes them flawlessly; vague instructions stall.
- **Never ask her to run terminal commands.** Browser OAuth flows (wrangler login, Git Credential Manager) work well — she just approves a popup.
- **She runs security-sensitive actions herself** with exact text supplied: SQL policies, account creation, sign-ins. Never handle her passwords.
- **She makes crisp decisions when given honest trade-offs.** State constraints plainly (e.g. "Google doesn't allow auto-posted reviews — here's the closest legal thing"). She appreciates being told what *can't* be done.
- **Ask one question at a time**, multiple-choice where possible. She dismisses questions she isn't ready for — treat a dismissal as "wait", not "yes".
- **She spots real UX issues fast** ("looks like a lime", "looks like a McDonald's M", "how do I go back?", "user won't know it's on the clipboard"). Take her aesthetic and usability instincts seriously — she was right every time.
- Confirm before deploying while she may be mid-test on her phone.

## 2. UX decisions (settled — don't relitigate)

**Navigation & structure**
- Tapping the "Matcha Muse" header always returns to the Journal.
- Segmented toggle under the title (Journal · Near me), not a bottom tab bar.
- The floating **+** button appears on every top-level view.
- Every card everywhere is tappable and opens `/review/:id`.

**Review detail**
- Completed reviews open in **view mode**; editing requires an explicit **Edit** button. Drafts open **directly in edit mode** (their purpose is being finished).
- Cancel discards edits (drafts: back to journal). Failed saves must **preserve in-progress edits** — losing typed input is unacceptable.
- Delete = **two taps on the same button** (no browser dialogs): first arms + relabels, second confirms; disarms on blur AND after 5 s (iOS blur is unreliable).
- The cafe on a review is not editable — delete and re-log. Exception (2026-07-17): a **cafe-less draft** embeds the cafe picker in its edit screen and gains its cafe on save.

**Drafts vs published — the owner's rules (2026-07-17, settled)**
- **Drafts are deliberately low-friction:** only the overall stars are required. No price, no cafe, no photo needed. Draft = "capture the moment, finish later".
- **Publishing ("Save matcha") is strict:** requires stars + valid price + a cafe + **a photo** ("a photo is absolutely compulsory... otherwise it completely ruins the experience"). Enforced in the form gates with visible hints ("Publishing needs a photo — drafts don't."), price also by DB constraint.
- Drafts can do everything without publishing first: add menu photos, be deleted, adjust their photo, change their date.
- **Never let navigation lose work:** leaving a half-finished review (back link, header, view tabs) opens a **Save matcha / Save as draft / Don't save-or-Delete / Keep editing** dialog. New reviews say "Don't save"; existing drafts say "Delete this matcha".
- The review **date is editable** (defaults to today, capped at today). Same-day keeps the original timestamp; a changed day saves as local noon (timezone-safe).
- **Photo crop/position:** every photo preview has an "Adjust" pill → full-screen drag + zoom-slider dialog, 4:3 frame; re-adjusting always starts from the as-picked original (crops never compound); any render failure silently keeps the original (a photo must never be lost).
- Anything optional must SAY so in its label — an unmarked field reads as compulsory to her.

**Filters & sorting (Journal + Near me)**
- Milk filter (2026-07-17, replaced the earlier exclusion model, owner-requested): an explicit **"All" chip first** (like the Serve row), specific milks start **deselected**; tapping milks narrows to just those, All clears. Shared `MilkChips` component on both views; in code an **empty milk set means "all"**. Null milk is its own **"Unspecified"** bucket — never lump into "Other" (Other = deliberately obscure milks).
- The Journal has the same Serve + Milk chip rows as Near me; they compose with the reviewer chips and the drafts toggle, the stat tiles follow the filtered set, and changing ANY filter resets the drafts-only toggle (otherwise it silently reasserts later — a bug class we hit twice).
- **Top rated sorts by the cafe's BEST matcha**, not the average (the stack *displays* the average).
- Multiple reviews at one cafe render as a **playing-card stack** that fans out on tap; one stack open at a time.
- Static map image now; interactive Google map is the agreed upgrade "once we scale". "Open in Google Maps" covers directions meanwhile.

**Feedback & affordances**
- Any invisible action needs visible confirmation (e.g. "Your note is copied — paste it into the Google review").
- Empty states must distinguish "you have nothing yet" (warm, points at +) from "your filters excluded everything" (suggests widening).
- Drafts get badges; the drafts notice is a tap-to-filter toggle.
- Photos: two explicit options — "Take a photo" and "Choose from library" — plus an ✕ overlay to remove/replace. (`capture="environment"` alone hides the library on iOS; use two inputs.)

**Aesthetic**
- Palette: cream `#F7F4ED`, ink `#22392B`, matcha `#7BA05B` / deep `#40573B` / mist `#DCE5D4`, sand `#EAE3D3`. Serif display font (Iowan Old Style/Georgia). Calm, ceremonial, editorial.
- Icon: serif "M" in a top-down matcha bowl on deep green. Lessons: a plain green circle reads as a **lime**; a rounded double-arch M reads as **McDonald's**. Pointed serif letterforms avoid both.
- Error copy pattern: "Couldn't ___ — check your connection and try again." Loading: "Brewing…".

**Scope stances (deliberate, recorded)**
- Login is email + **password** (Microsoft 365 mail security eats magic-link tokens). Revisit OTP only with custom SMTP.
- Offline queue covers **new reviews only**; editing/deleting are online-only.
- Orphaned storage files on rare failure paths are accepted (single-user scale); cleanup is best-effort and must never fail the user action.
- Parked: interactive map, multi-user accounts, bulk delete, Google-links tap-target sizing, storage-orphan sweep, pinch-to-zoom in the photo Adjust dialog, menu photos inside the new-review page pre-save. (Editing drank_at: shipped 2026-07-17.)

## 3. Technical learnings (the traps we hit — with fixes)

**iOS / iPhone PWA**
- **No location prompt at all** ⇒ check iOS Settings → Privacy & Security → Location Services → **Safari Websites** — "Never" makes requests fail silently. Home-screen PWAs inherit Safari's permission.
- **Icons are cached**: after changing the app icon, the user must remove the app from the home screen and re-add via Safari. Data is unaffected.
- After every deploy, the PWA must be **fully closed and reopened** to pick up the new version.
- iOS Safari **blur doesn't fire reliably** when tapping empty space — any "reset on tap-elsewhere" needs a timeout fallback.
- Clipboard writes must happen synchronously in the user-gesture handler; `target="_blank"` on the link keeps the pending clipboard promise alive.
- EXIF rotation: decode with `createImageBitmap(blob, { imageOrientation: 'from-image' })` before canvas work, or portrait photos rotate. Downscale params: maxEdge 1600, JPEG quality 0.8. On any failure return the original blob — never lose a photo.

**Supabase**
- Numeric columns come back as **strings** via PostgREST — wrap in `Number()` before arithmetic/`toFixed` (established pattern across the app).
- `supabase-js` storage methods **don't throw**; they resolve `{ error }`. A try/catch around them is dead code — destructure and inspect (at least `console.warn`).
- **Audit RLS policies for every verb you use.** The photos bucket had select+insert but no **delete** — so every cleanup silently failed, forever, with zero user-visible symptoms. Reviews caught it; on-device testing never would have. Policy lives in `app/supabase/schema.sql` (keep it in sync with what's applied live).
- New-style `sb_publishable_...` key ≡ anon key. Don't "fix" it.
- Owner applies SQL herself via the dashboard SQL editor (paste + Run). Automating the editor is fragile (Monaco freezes on large typed input; clipboard-paste recipe in HANDOFF).

**Cloudflare Pages**
- Deploy from `app/`: `npm run build`, then `npx wrangler pages deploy dist --project-name matcha-muse --branch main --commit-dirty=true` (the `--branch main` is what lands it on the production URL regardless of local branch).
- Production HTML can serve the **previous bundle for ~1 minute** (edge cache). Verify by comparing `dist/assets/index-*.js` hash against the live HTML before telling the owner to test.
- `_redirects` with the SPA rule already handles deep links.

**Google**
- One API key ("Maps Platform API Key", project `matcha-muse-501713`) covers Places (New) + Static Maps; HTTP-referrer restricted to `http://localhost:5173/*` and `https://matcha-muse.pages.dev/*`. Referrer changes take ~5 min.
- **No API exists to auto-post consumer Google reviews.** The shipped pattern: `https://search.google.com/local/writereview?placeid=…` deep link + clipboard-copied note + visible confirmation.
- Static Maps auto-fits markers when center/zoom omitted.

**React specifics that bit us**
- A form that seeds `useState(initial)` reads the prop **once at mount** (like `defaultValue`). Do NOT "fix" with an effect syncing state from the prop — when the parent rebuilds `initial` each render, the effect wipes in-progress edits. Preserve failed-save edits via a `pendingDraft` fed back on remount.
- React Router **reuses a component across `/route/:id` param changes** — reset per-item state in the id-keyed effect.
- Revoke `URL.createObjectURL` blobs on change/unmount; reset `input.value = ''` after file pick so re-picking the same file fires.
- **StrictMode runs mount effects twice (mount → cleanup → mount).** Any resource an effect's CLEANUP destroys (revoking an object URL, latching an "unmounted" flag) must be CREATED/RESET in the effect body, never at render or state-init. Violating this caused the worst bug of 2026-07-17: PhotoAdjust showed a grey image, dead zoom, and hung on "Preparing…" forever, because the simulated unmount revoked a render-created URL and latched a flag nothing reset. Pattern: `useEffect(() => { flag.current = false; const u = URL.createObjectURL(x); setUrl(u); return () => { flag.current = true; URL.revokeObjectURL(u); }; }, [x])`.
- Plain `BrowserRouter` has **no `useBlocker`** (that needs a data router). The shipped navigation-guard is a tiny context (`lib/leaveGuard.tsx`): pages register an interceptor, guarded links call it in `onClick` and `preventDefault()` when it returns true. Re-register every render (ref assignment) so the interceptor never closes over stale state.
- To let an external dialog submit a form that owns its own state, expose a handle via a plain `controlRef` prop reassigned every render (`ReviewFormHandle`: `requestSubmit(status)`, `canSave`, `canDraft`) — no `forwardRef`/`useImperativeHandle` ceremony needed.

**Testing gotchas (Vitest + Testing Library)**
- **This machine flakes on parallel test runs** once the suite got big (~24 files): random timeouts in untouched suites (jsdom worker overload + OneDrive). Always run `npx vitest run --no-file-parallelism`. It is NOT a code problem — don't "fix" the tests.
- Module-level `vi.mock` fns accumulate call counts across tests in a file. The moment more than one test asserts on counts, add `beforeEach(() => vi.clearAllMocks())` (implementations set per-test survive; those set at module scope don't — set them in the render helper).
- Keep accessible names unique within any one screen: a dialog whose ✕ shared its label with a text button ("Keep editing") broke `getByRole`; multiple filter rows each having an "All" chip requires `within(group)` scoping in tests.
- React state updates flush **asynchronously** relative to a programmatic `element.click()` from devtools/console — query the DOM in a later tick, not synchronously, before concluding "nothing happened" (cost us a false alarm on the leave-guard).

**Windows / repo environment**
- Repo lives in OneDrive — occasional slow file ops, otherwise fine. LF→CRLF git warnings are noise.
- PowerShell mangles multi-line/quoted `git commit -m` — use Git Bash for commits. PowerShell 5.1 has no `&&`, no heredocs.
- Killing a backgrounded dev server needs `Get-NetTCPConnection`/`netstat` + `Stop-Process -Force`, then verify the port.

## 4. The process that worked (repeat it)

Every feature followed this loop; total elapsed for a mid-size feature (Near me, review-detail) was roughly a day including the owner's phone testing:

1. **Brainstorm with the owner** — one question at a time, multiple-choice, honest constraints up front. Output: a short plain-language design she approves section by section.
2. **Spec** → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, committed. She reviews it (it's written for her). Amendments get committed with reasons.
3. **Plan** → `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`: bite-size tasks with exact file paths, exact code, exact test code, exact commands and commit messages. TDD for logic/components.
4. **Execute task-by-task**: fresh implementer per task; then a **spec-compliance review** (verify against plan, don't trust the report, run the tests yourself); then a **code-quality review**. Fixes loop back to the same implementer; re-review after. This caught every important bug of the project — including ones no on-device test would find.
5. **Push back on wrong review findings.** Reviews proposed two "fixes" that would have introduced bugs (prop-sync effect; double-tap useCallback). Verify a suggestion is actually correct before applying; document rejections with reasoning.
6. **Final whole-feature review** across the full diff before any deploy.
7. **Deploy** (owner-approved) → verify live bundle → **owner runs an on-device acceptance checklist on her actual iPhone**. Her acceptance is the definition of done. Real usage immediately surfaced the best next features (tap-to-open, delete, clipboard confirmation).
8. **Record everything**: HANDOFF.md updated with status + quirks learned; deviations become spec/plan amendments; schema changes land in `schema.sql` even when applied via dashboard.

Roles split that worked: assistant does all code/terminal/browser-driving; owner does accounts, sign-ins, security SQL (with exact text), phone testing, and all product decisions.

## 5. Infrastructure reference (accounts all owned by Justina)

| Thing | Where |
|---|---|
| Live app | https://matcha-muse.pages.dev (Cloudflare Pages, project `matcha-muse`, production branch `main`) |
| Code | `C:\Users\justi\OneDrive - LightSpeed Consulting\APPS\MatchaMuse` (moved 2026-07-17, was OneDrive\Documents; app in `app/`); private backup https://github.com/JG260180/matcha-muse |
| Database/auth/storage | Supabase project `matcha-muse`, ref `sodkpgrdoufcicajqoks`, Sydney. Schema+policies: `app/supabase/schema.sql` |
| Google | Cloud project `matcha-muse-501713`; one referrer-restricted Maps Platform key |
| Secrets | `app/.env.local` (gitignored, never commit): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_PLACES_KEY` |
| Stack | Vite + React 19 + TypeScript + Tailwind 3 + Vitest (globals) + react-router 7 + Supabase JS + vite-plugin-pwa |
| Checks | from `app/`: `npx vitest run --no-file-parallelism` (178 passing as of 2026-07-17; the flag is REQUIRED on this machine — see §3) · `npx tsc -b --noEmit` · `npm run build` |

## 6. Starting a new feature — the short version

1. Read `docs/superpowers/HANDOFF.md` (state) and this file (how/why).
2. Branch from `main`. Brainstorm → spec → plan → task loop with two-stage reviews → final review.
3. Deploy with the exact command in §3, verify the live bundle hash, have Justina close-and-reopen the PWA and run the acceptance list on her phone.
4. Merge to `main`, push to GitHub, update HANDOFF (and this playbook, if you learned something durable).
