# Forgot password — design (approved 2026-07-15, Option A: 6-digit code)

Owner: Justina Gardiner. Trigger: she forgot her password and was locked out (unblocked
same day via a dashboard reset). Feature: self-serve "Forgot password?" on the login
screen. Scope decision (owner-confirmed): **login-screen reset only** — no in-app
change-password option (YAGNI; a signed-out reset covers that need).

## The constraint that shapes everything

Her Microsoft 365 mailbox pre-scans links in emails and *consumes one-time tokens by
clicking them* — this killed magic-link login in v1 (`otp_expired`; HANDOFF decision #1).
A standard reset-link email would fail identically. Therefore:

- The reset email must contain a **6-digit code** (`{{ .Token }}`) and **no
  confirmation link at all** — the link and the code are the same underlying one-time
  token, so a scanner-clicked link would invalidate the code too. The default
  Supabase "Reset Password" template's `{{ .ConfirmationURL }}` must be REMOVED.
- This template edit is a **human prerequisite step** (Justina in the Supabase
  dashboard, assistant guiding): Authentication → Emails/Templates → Reset Password.
  v1 notes recorded that template editing might be restricted on the free plan
  (recorded in the context of custom SMTP for magic links) — **verify live before
  building**. If editing is genuinely blocked, STOP and redesign; do not fall back
  to the link flow silently.

## User flow

1. Login screen gains a small "Forgot password?" link under the Sign in button.
2. **Request step:** email field (pre-filled with whatever she typed on the login
   form) + "Email me a code" button. On submit — success or failure alike — show
   "If that email has an account, a code is on its way." (never reveals whether an
   account exists). A "Send again" control appears, disabled for 60 s after each send.
3. **Code step (same screen, shown after request):** 6-digit code field
   (`inputMode="numeric"`, `autoComplete="one-time-code"`), new-password field
   (min 8 chars, single field with show/hide toggle — no confirm field on a phone),
   "Set new password" button. Success = signed in; the app takes over.
4. Errors: wrong/expired code → "That code didn't work — check it or send a new one."
   Rate-limited (HTTP 429 / Supabase over_email_send_rate_limit) → "Too many attempts —
   wait a bit and try again." Other failures → the app's standard "check your
   connection" tone.
5. "Back to sign in" link on both steps.

## Components and data flow

### `app/src/lib/passwordReset.ts` (new, TDD)

- `requestReset(email): Promise<void>` — `supabase.auth.resetPasswordForEmail(email)`;
  throws on error (caller decides what to reveal; the UI shows the neutral message
  for BOTH success and "user not found"-shaped errors, but must still surface
  rate-limit errors distinctly).
- `confirmReset(email, code, newPassword): Promise<void>` —
  `supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })` (throws on bad
  code), then `supabase.auth.updateUser({ password: newPassword })` (throws on failure).

### `app/src/components/ForgotPassword.tsx` (new, TDD)

Props: `{ initialEmail: string; onBack: () => void }`. Owns the two-step state
('request' → 'code'), the 60 s resend timer, busy/error states. Uses the login
screen's visual language (cream background inherited, sand-bordered inputs,
matcha-deep primary button).

### `app/src/pages/Login.tsx` (edit)

Adds a `forgot` boolean state: `false` → existing form + new "Forgot password?"
link; `true` → `<ForgotPassword initialEmail={email} onBack={() => setForgot(false)} />`.
No routing changes (Login is the signed-out gate, not a route).

## Accepted trade-off (recorded deliberately)

`verifyOtp` success creates a session, which makes `App.tsx` swap Login out
immediately — possibly before `updateUser` finishes. If `updateUser` then fails
(rare: network just worked for verifyOtp), the user IS signed in but the password
was NOT changed, with no visible error (console.warn only). Accepted because: the
user's immediate goal (getting in) is met; the fix path is running Forgot password
again; avoiding it would couple App's session gate to reset-flow internals. Revisit
only if it ever actually bites.

## Security notes

- Neutral messaging on the request step (no account-existence oracle).
- The assistant never handles Justina's password: live testing = she types her own
  new password; automated tests use fixture values.
- No password logging anywhere; password state stays in component memory.

## Testing

- `passwordReset.test.ts`: requestReset happy/error; confirmReset calls verifyOtp
  with type 'recovery' then updateUser; bad-code error surfaces and updateUser is
  NOT called; updateUser failure surfaces.
- `ForgotPassword.test.tsx`: request step renders + neutral message after submit
  (both success and failure); resend disabled for 60 s (fake timers); code step
  fields + submit path; wrong-code and rate-limit messages; back link calls onBack.
- `Login` tests: forgot link swaps in the component; back returns to the form;
  email carries over.
- Live acceptance (with Justina): full reset round-trip against her real M365
  mailbox — the definitive scanner-proof test — on desktop preview first, then
  iPhone.

## Out of scope (YAGNI, parked)

In-app change-password; email-change flow; OTP login revisit (still parked from v1);
custom SMTP.

## Process notes

- Branch `feature/forgot-password`, forked from `feature/cafe-menu` (Login.tsx is
  identical on main and all live branches; stacking keeps the merge train linear:
  shared-journal → cafe-menu → forgot-password → main).
- **Plan Task 0 must be the human dashboard step** (template edit + live send test
  to confirm the code arrives and no link is present) BEFORE any code tasks.
- Execution: superpowers:subagent-driven-development, TDD, two-stage reviews.
