# Owner improvements — plan (2026-07-17)

Spec: `docs/superpowers/specs/2026-07-17-owner-improvements-design.md`.
Branch: `feature/owner-improvements` off `main`. Implemented inline (single
autonomous session), TDD on new logic, full suite + tsc + build gate each task.

## Task 1 — price nullable + schema migration (foundation)

- `app/supabase/migrations/2026-07-17-draft-price-null.sql` (new) + append the
  same to `schema.sql` with a dated comment. **NOT applied to the live DB in
  this session — Justina (or an assisted session) must run it in the Supabase
  SQL editor.**
- `types.ts`: `price: number | null`.
- `api.ts`: `saveReview`/`updateReview` send `price: draft.price.trim() === '' ? null : Number(draft.price)`.
- Guard displays: Dashboard card, ReviewDetail view price line.
- Commit: `feat: price optional for drafts (schema migration + null-safe displays)`

## Task 2 — draft save without price (ReviewForm) (TDD)

- Tests: draft button enabled with overall set + empty price; submits with
  `price: ''`; draft button disabled when price is nonsense; complete save
  gating unchanged.
- `canSave` (complete) unchanged; new `canDraft = overall != null && (price empty || priceOk)`.
- Commit: `feat: drafts no longer require a price`

## Task 3 — editable date (TDD)

- `lib/drankAt.ts` + tests (`localDateString`, `applyDrankAtDate`: same-date
  keeps base ISO; new date → local noon ISO; missing/blank keeps base).
- `ReviewDraft.drankAtDate?`, date input in ReviewForm (label "Date",
  max=today, default today), `toDraft` pre-fills, `saveReview`/`updateReview`
  persist, ReviewDetail state update + queued-review back-compat.
- Commit: `feat: adjustable date on review create/edit`

## Task 4 — draft delete + menu photos while editing (ReviewDetail)

- Render `CafeMenu` in edit mode too (below form, when cafe exists).
- Render `ConfirmDelete` in edit mode when `isDraft && isOwner` (+ busy/failed
  states shared with the existing delete path).
- Tests: draft opens in edit and shows both; delete from draft navigates home.
- Commit: `feat: drafts can add menu photos and be deleted without publishing`

## Task 5 — journal filters (Dashboard) (TDD)

- Serve + Milk chip rows (reuse `MILK_BUCKETS`/`milkBucket`), composing with
  reviewer chips + drafts toggle; stats follow.
- Commit: `feat: journal serve/milk filters matching Near Me`

## Task 6 — photo crop/position (TDD on math)

- `lib/crop.ts` + tests (cover clamp, zoom bounds, offset clamp, source-rect).
- `PhotoAdjust.tsx` dialog (CafeMenu dialog pattern), canvas render 4:3 JPEG.
- Wire into NewReview + ReviewDetail (new photo & existing via storage
  download).
- Commit: `feat: crop/position photos before saving`

## Task 7 — verify + record

- Full suite, `tsc -b --noEmit`, `npm run build`; update HANDOFF.md (incl.
  repo-move note + migration TODO), memory; merge decision left to Justina
  (deploy NOT run this session — see handoff).

## Amendments

- **Vitest parallel flakiness on this machine:** with 24 test files, the
  default parallel run intermittently times out across unrelated suites
  (jsdom worker overload + OneDrive). `npx vitest run --no-file-parallelism`
  is reliable (170 passing). Not a code problem — do not "fix" tests for it.
- **Review round (inline, medium):** two findings fixed — (1) drafts-only
  toggle now resets when serve/milk filters change (same reassert bug the
  reviewer chips already guarded); (2) PhotoAdjust ignores a crop render that
  finishes after Cancel/Escape unmounted it. Deferred minor on record:
  Dashboard/NearMe filter-chip markup duplication (extract a FilterChips
  component if touched again).
- **Preview browser launch config** for this session's harness lives at
  `APPS/.claude/launch.json` (session cwd is the APPS folder); the repo's own
  `.claude/launch.json` still works when a session starts inside MatchaMuse.
- Tasks executed inline (not via subagents) in a single autonomous session;
  TDD kept for all new logic.
- **Round 2 (owner feedback, same day):** milk All-chip model (shared
  `MilkChips`, both views; empty set = all in `NearMeFilters`), leave-guard
  dialog (`lib/leaveGuard.tsx` + `SaveBeforeLeaving` + `ReviewFormHandle`),
  cafe-optional drafts (`CafeChoice kind:'none'`, publish gates, edit-time
  CafePicker, `updateReview` cafeChoice param), photo "(optional)" copy.
  177 tests. Live-verified in the signed-in preview: filters narrow/widen with
  stats, skip-cafe form shows Date field, guard dialog blocks header nav with
  correct disabled states, "Don't save" leaves cleanly.
- **Test gotcha:** ReviewDetail.test now clears mocks per test (call counts
  accumulated across tests once several tests asserted on them). Dialog ✕ is
  labelled "Close" (not "Keep editing") to keep accessible names unique.
- **Browser-pane gotcha:** simulated ref-clicks sometimes miss React handlers
  on small text buttons; element.click() via javascript_tool lands, and state
  updates flush async — query the DOM in a follow-up call, not synchronously.
