# Forgot Password (6-digit code) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-serve "Forgot password?" on the login screen using an emailed 6-digit code (scanner-proof — no reset link), ending with the user signed in with a new password.

**Architecture:** A thin `lib/passwordReset.ts` wraps two Supabase auth calls (`resetPasswordForEmail` to send the code; `verifyOtp(type:'recovery')` + `updateUser` to redeem it). A self-contained `ForgotPassword` component owns the two-step UI (request → code+new-password) with a 60 s resend cooldown and neutral no-account-oracle messaging. `Login.tsx` gains one boolean state to swap it in. No routing, schema, or RLS changes.

**Tech Stack:** Vite + React 19 + TS + Tailwind 3, Supabase JS auth, Vitest + Testing Library (jsdom). Repo root `C:\Users\justi\OneDrive\Documents\MatchaMuse`; app in `app/`; commands run from `app/`.

**Spec:** `docs/superpowers/specs/2026-07-15-forgot-password-design.md` — read its "constraint" section; the email template MUST contain `{{ .Token }}` and MUST NOT contain `{{ .ConfirmationURL }}` (a scanner-clicked link consumes the same token as the code).

**Branch:** `feature/forgot-password`, forked from `feature/cafe-menu`. Merge train: shared-journal → cafe-menu → forgot-password → main.

## File structure

- Create: `app/src/lib/passwordReset.ts` — the two auth calls + rate-limit detection helper. Nothing else.
- Create: `app/src/lib/passwordReset.test.ts`
- Create: `app/src/components/ForgotPassword.tsx` — the whole two-step reset UI incl. its own full-screen wrapper (Login early-returns to it).
- Create: `app/src/components/ForgotPassword.test.tsx`
- Modify: `app/src/pages/Login.tsx` — `forgot` state, link button, early return.
- Create: `app/src/pages/Login.test.tsx` — Login had no test file; this adds one (forgot-flow wiring only).

---

### Task 0: HUMAN PREREQUISITE — reset-email template (Justina + controller, in the Supabase dashboard)

No code. **Gate scope amended 2026-07-15:** this task gates the LIVE acceptance
(Task 5 Step 2), not the code tasks — the app code is template-agnostic
(`resetPasswordForEmail` sends whatever template is configured; `verifyOtp` redeems
the code regardless), so Tasks 1–4 may run in parallel with this setup. Second
amendment same day: owner chose **Gmail SMTP** (app password) over Brevo to avoid
another email provider; same Supabase SMTP screen, host `smtp.gmail.com`, port 587,
username = her Gmail address, password = a Google app password (requires 2-Step
Verification on her Google account). Dashboard driving confirmed there is NO
admin "update password" action in the current Supabase Users panel — recovery
email is the only path, which is why this feature (not a dashboard recipe) is the fix;
her own first use of the shipped flow doubles as setting her password.

> **Amendment 2026-07-15:** the original Step 2 check ran live and template editing
> IS blocked on the free plan ("Set up custom SMTP to edit templates"). Owner chose
> the free-SMTP unlock (Brevo). Steps below are the amended sequence. All steps are
> owner-driven in the browser with the controller guiding; the assistant never
> handles the SMTP key or any password.

- [ ] **Step 1 (Brevo):** Owner creates a free Brevo account (brevo.com), confirms her email, and verifies `justina@lightspeedconsulting.com.au` as a sender (Senders & Domains → Senders).
- [ ] **Step 2 (Brevo):** Profile → SMTP & API → SMTP tab → generate an SMTP key. Note the host `smtp-relay.brevo.com`, port `587`, and the login shown there.
- [ ] **Step 2b (Supabase):** Authentication → Emails → **SMTP Settings** tab → enable custom SMTP: Sender email `justina@lightspeedconsulting.com.au`, Sender name `Matcha Muse`, Host `smtp-relay.brevo.com`, Port `587`, Username = the Brevo SMTP login, Password = the Brevo SMTP key (owner pastes it herself). Save.
- [ ] **Step 3:** Authentication → Emails → Templates → **Reset Password** (now editable). Set Subject to `Your Matcha Muse reset code` and replace the ENTIRE message body with:

```html
<h2>Reset your Matcha Muse password</h2>
<p>Your 6-digit code:</p>
<p style="font-size: 28px; letter-spacing: 6px;"><strong>{{ .Token }}</strong></p>
<p>Go back to Matcha Muse and type this code in with your new password. The code expires in an hour.</p>
<p>If you didn't ask to reset your password, you can safely ignore this email.</p>
```

- [ ] **Step 4:** Verify NO `{{ .ConfirmationURL }}` remains anywhere in the body. Save.
- [ ] **Step 5 (live template test, no app code needed):** Authentication → Users → Justina's user → ⋯ menu → **Send password recovery**. Check her inbox (and Junk — first Brevo sends may land there; mark as safe): the email must show a 6-digit code and contain no link/button. This proves the SMTP relay, the template, AND that her M365 scanner has nothing to consume.

Acceptance: code-only email received. Record the outcome in the HANDOFF doc.

---

### Task 1: Branch setup

- [ ] **Step 1:**

```bash
cd "C:/Users/justi/OneDrive/Documents/MatchaMuse"
git checkout -b feature/forgot-password feature/cafe-menu
```

Expected: `Switched to a new branch 'feature/forgot-password'`.

- [ ] **Step 2:** Green baseline:

```bash
cd app
npx vitest run
```

Expected: 18 files, 113 tests pass. If not, STOP.

---

### Task 2: `lib/passwordReset.ts` (TDD)

**Files:**
- Create: `app/src/lib/passwordReset.test.ts`
- Create: `app/src/lib/passwordReset.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/lib/passwordReset.test.ts` (lazy-closure `vi.mock` style — factories are hoisted, so they must call the `vi.fn()` consts at runtime, never at factory-definition time):

```ts
import { requestReset, confirmReset, isRateLimit } from './passwordReset';

const resetPasswordForEmail = vi.fn();
const verifyOtp = vi.fn();
const updateUser = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requestReset', () => {
  it('asks Supabase to email a recovery code', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    await requestReset('justi@example.com');
    expect(resetPasswordForEmail).toHaveBeenCalledWith('justi@example.com');
  });

  it('throws when Supabase reports an error', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: new Error('rate limited') });
    await expect(requestReset('justi@example.com')).rejects.toThrow('rate limited');
  });
});

describe('confirmReset', () => {
  it('verifies the code as a recovery OTP, then sets the new password', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });
    await confirmReset('justi@example.com', '123456', 'new-password-1');
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'justi@example.com', token: '123456', type: 'recovery' });
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-password-1' });
  });

  it('surfaces a bad code and never touches the password', async () => {
    verifyOtp.mockResolvedValue({ error: new Error('otp_expired') });
    await expect(confirmReset('justi@example.com', '000000', 'new-password-1')).rejects.toThrow('otp_expired');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('surfaces an updateUser failure', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: new Error('weak password') });
    await expect(confirmReset('justi@example.com', '123456', 'short')).rejects.toThrow('weak password');
  });
});

describe('isRateLimit', () => {
  it('recognises HTTP 429', () => {
    expect(isRateLimit({ status: 429 })).toBe(true);
  });
  it('recognises the Supabase rate-limit code', () => {
    expect(isRateLimit({ code: 'over_email_send_rate_limit' })).toBe(true);
  });
  it('rejects other errors and non-objects', () => {
    expect(isRateLimit(new Error('boom'))).toBe(false);
    expect(isRateLimit(null)).toBe(false);
    expect(isRateLimit('429')).toBe(false);
  });
});
```

- [ ] **Step 2: Verify they fail**

Run: `npx vitest run src/lib/passwordReset.test.ts`
Expected: FAIL — cannot resolve `./passwordReset`.

- [ ] **Step 3: Implement**

Create `app/src/lib/passwordReset.ts`:

```ts
import { supabase } from './supabase';

// Sends the 6-digit recovery code email. The template contains ONLY the code
// ({{ .Token }}) — never a link, which the owner's mail scanner would consume
// (v1's otp_expired lesson; see the spec).
export async function requestReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// Redeems the code, then sets the new password. verifyOtp success signs the
// user in; if updateUser then fails the caller surfaces it, but the session
// already exists (accepted trade-off — recorded in the spec).
export async function confirmReset(email: string, code: string, newPassword: string): Promise<void> {
  const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (verifyError) throw verifyError;
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// Supabase rate-limit errors carry status 429 and/or this code; the UI shows
// them distinctly instead of the neutral "code is on its way" message.
export function isRateLimit(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const err = e as { status?: number; code?: string };
  return err.status === 429 || err.code === 'over_email_send_rate_limit';
}
```

- [ ] **Step 4: Verify they pass**

Run: `npx vitest run src/lib/passwordReset.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc -b --noEmit
cd .. && git add app/src/lib/passwordReset.ts app/src/lib/passwordReset.test.ts && git commit -m "feat: password reset data access (request code, confirm with recovery OTP)" && cd app
```

---

### Task 3: `ForgotPassword` component (TDD)

**Files:**
- Create: `app/src/components/ForgotPassword.test.tsx`
- Create: `app/src/components/ForgotPassword.tsx`

Behaviour (spec): two steps in one component. Request step: email field (pre-filled from props) + "Email me a code". On submit, success AND unknown-email-style failures BOTH advance to the code step with the neutral line "If that email has an account, a code is on its way." (no account-existence oracle). Rate-limit errors show "Too many attempts — wait a bit and try again." and stay on the request step; network errors (TypeError or offline) show the connection message and stay. Code step: 6-digit code field, new-password field (min 8, show/hide toggle), "Set new password"; "Send again" disabled for 60 s after each send; bad code → "That code didn't work — check it or send a new one."; success → session appears and App swaps the screen away (nothing for the component to do). "Back to sign in" on both steps. Full-screen wrapper copied from Login (`flex min-h-screen flex-col justify-center bg-cream px-8 text-ink`).

- [ ] **Step 1: Write the failing tests**

Create `app/src/components/ForgotPassword.test.tsx`:

```tsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import ForgotPassword from './ForgotPassword';

const requestReset = vi.fn();
const confirmReset = vi.fn();
vi.mock('../lib/passwordReset', async () => {
  const real = await vi.importActual<typeof import('../lib/passwordReset')>('../lib/passwordReset');
  return {
    requestReset: (...a: unknown[]) => requestReset(...a),
    confirmReset: (...a: unknown[]) => confirmReset(...a),
    isRateLimit: real.isRateLimit,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function sendCode() {
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
  await screen.findByText(/a code is on its way/);
}

describe('ForgotPassword', () => {
  it('pre-fills the email from props on the request step', () => {
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('justi@example.com');
    expect(screen.getByRole('button', { name: 'Email me a code' })).toBeDefined();
  });

  it('advances to the code step with the neutral message on success', async () => {
    requestReset.mockResolvedValue(undefined);
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    await sendCode();
    expect(requestReset).toHaveBeenCalledWith('justi@example.com');
    expect(screen.getByLabelText('6-digit code')).toBeDefined();
    expect(screen.getByLabelText('New password')).toBeDefined();
  });

  it('shows the same neutral message when the email is unknown (no account oracle)', async () => {
    requestReset.mockRejectedValue(new Error('user not found'));
    render(<ForgotPassword initialEmail="stranger@example.com" onBack={() => {}} />);
    await sendCode();
    expect(screen.getByLabelText('6-digit code')).toBeDefined();
  });

  it('stays on the request step with a distinct message when rate-limited', async () => {
    requestReset.mockRejectedValue({ status: 429 });
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(await screen.findByText(/Too many attempts/)).toBeDefined();
    expect(screen.queryByLabelText('6-digit code')).toBeNull();
  });

  it('shows the connection message on a network failure', async () => {
    requestReset.mockRejectedValue(new TypeError('fetch failed'));
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(await screen.findByText(/check your connection/)).toBeDefined();
    expect(screen.queryByLabelText('6-digit code')).toBeNull();
  });

  it('submits the code and new password together', async () => {
    requestReset.mockResolvedValue(undefined);
    confirmReset.mockResolvedValue(undefined);
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    await sendCode();
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'brand-new-pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    await act(async () => {});
    expect(confirmReset).toHaveBeenCalledWith('justi@example.com', '123456', 'brand-new-pw');
  });

  it('shows the friendly message for a wrong or expired code', async () => {
    requestReset.mockResolvedValue(undefined);
    confirmReset.mockRejectedValue(new Error('otp_expired'));
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    await sendCode();
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'brand-new-pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByText(/That code didn't work/)).toBeDefined();
    expect(screen.getByLabelText('6-digit code')).toBeDefined(); // still on the code step
  });

  it('disables Send again for 60 seconds after sending', async () => {
    vi.useFakeTimers();
    try {
      requestReset.mockResolvedValue(undefined);
      render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
      await act(async () => {}); // let the send promise settle
      const again = screen.getByRole('button', { name: /Send again/ }) as HTMLButtonElement;
      expect(again.disabled).toBe(true);
      await act(async () => { vi.advanceTimersByTime(60_000); });
      expect((screen.getByRole('button', { name: /Send again/ }) as HTMLButtonElement).disabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('toggles the new-password field between hidden and shown', async () => {
    requestReset.mockResolvedValue(undefined);
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    await sendCode();
    const pw = screen.getByLabelText('New password') as HTMLInputElement;
    expect(pw.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect((screen.getByLabelText('New password') as HTMLInputElement).type).toBe('text');
  });

  it('offers Back to sign in on both steps', async () => {
    requestReset.mockResolvedValue(undefined);
    const onBack = vi.fn();
    render(<ForgotPassword initialEmail="justi@example.com" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    await sendCode();
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Verify they fail**

Run: `npx vitest run src/components/ForgotPassword.test.tsx`
Expected: FAIL — cannot resolve `./ForgotPassword`.

- [ ] **Step 3: Implement**

Create `app/src/components/ForgotPassword.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { requestReset, confirmReset, isRateLimit } from '../lib/passwordReset';

interface Props {
  initialEmail: string;
  onBack: () => void;
}

// Two-step password reset: request a 6-digit emailed code, then redeem it with
// a new password. The neutral "on its way" message shows for success AND
// unknown-email failures alike — the request step must never reveal whether an
// account exists. On confirm success a session appears and App swaps this
// screen out; there is deliberately nothing to do here.
export default function ForgotPassword({ initialEmail, onBack }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<'request' | 'code'>('request');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestReset(email);
    } catch (err) {
      if (isRateLimit(err)) {
        setError('Too many attempts — wait a bit and try again.');
        setBusy(false);
        return;
      }
      if (err instanceof TypeError || !navigator.onLine) {
        setError("Couldn't send the code — check your connection and try again.");
        setBusy(false);
        return;
      }
      // Any other failure (e.g. unknown email) falls through on purpose:
      // the neutral message below must not reveal whether an account exists.
    }
    setBusy(false);
    setStep('code');
    setCooldown(60);
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await confirmReset(email, code.trim(), password);
      // Success: verifyOtp created a session; App unmounts this screen.
    } catch (err) {
      if (isRateLimit(err)) setError('Too many attempts — wait a bit and try again.');
      else if (err instanceof TypeError || !navigator.onLine)
        setError("Couldn't reach the kitchen — check your connection and try again.");
      else setError("That code didn't work — check it or send a new one.");
      setBusy(false);
    }
  }

  const backLink = (
    <button type="button" onClick={onBack} className="mt-4 text-sm text-ink/60 underline">
      Back to sign in
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col justify-center bg-cream px-8 text-ink">
      <h1 className="font-display text-3xl">Matcha Muse</h1>

      {step === 'request' ? (
        <form onSubmit={send} className="mt-6 space-y-3">
          <p className="text-sm text-ink/60">
            Enter your email and we'll send you a 6-digit code to set a new password.
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            autoComplete="email"
            className="w-full rounded-xl border border-sand bg-white p-4"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </form>
      ) : (
        <form onSubmit={submitReset} className="mt-6 space-y-3">
          <p role="status" className="text-sm text-ink/60">
            If that email has an account, a code is on its way.
          </p>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            aria-label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="w-full rounded-xl border border-sand bg-white p-4 tracking-widest"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (8+ characters)"
              aria-label="New password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-sand bg-white p-4 pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Show password"
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-3 text-sm text-ink/60 underline"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream disabled:opacity-40"
          >
            {busy ? 'Setting…' : 'Set new password'}
          </button>
          <button
            type="button"
            onClick={() => send()}
            disabled={busy || cooldown > 0}
            className="w-full rounded-xl border border-sand p-3 text-sm text-sand-ink disabled:opacity-40"
          >
            {cooldown > 0 ? `Send again (${cooldown}s)` : 'Send again'}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </form>
      )}

      {backLink}
    </div>
  );
}
```

- [ ] **Step 4: Verify they pass**

Run: `npx vitest run src/components/ForgotPassword.test.tsx`
Expected: PASS — 10 tests.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc -b --noEmit
cd .. && git add app/src/components/ForgotPassword.tsx app/src/components/ForgotPassword.test.tsx && git commit -m "feat: ForgotPassword two-step reset - emailed 6-digit code, new password" && cd app
```

---

### Task 4: Wire into Login (TDD)

**Files:**
- Create: `app/src/pages/Login.test.tsx`
- Modify: `app/src/pages/Login.tsx`

- [ ] **Step 1: Write the failing tests**

Create `app/src/pages/Login.test.tsx` (Login has no existing test file — this covers the forgot-flow wiring only):

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Login from './Login';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
}));
vi.mock('../components/ForgotPassword', () => ({
  default: ({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) => (
    <div data-testid="forgot" data-email={initialEmail}>
      <button type="button" onClick={onBack}>mock-back</button>
    </div>
  ),
}));

describe('Login', () => {
  it('swaps to the forgot-password screen, carrying the typed email', () => {
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'justi@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByTestId('forgot').getAttribute('data-email')).toBe('justi@example.com');
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('returns to the sign-in form from the forgot screen', () => {
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
    expect(screen.queryByTestId('forgot')).toBeNull();
  });

  it('shows the sign-in form by default with the forgot link', () => {
    render(<Login />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeDefined();
  });
});
```

- [ ] **Step 2: Verify they fail**

Run: `npx vitest run src/pages/Login.test.tsx`
Expected: FAIL — no "Forgot password?" button found.

- [ ] **Step 3: Implement**

In `app/src/pages/Login.tsx`, add the import (after the supabase import):

```tsx
import ForgotPassword from '../components/ForgotPassword';
```

Add state (below the existing `error` state):

```tsx
const [forgot, setForgot] = useState(false);
```

Add the early return (directly above the existing `return (`):

```tsx
if (forgot) return <ForgotPassword initialEmail={email} onBack={() => setForgot(false)} />;
```

Add the link button between `</form>` and the closing `</div>`:

```tsx
      <button
        type="button"
        onClick={() => setForgot(true)}
        className="mt-4 self-start text-sm text-ink/60 underline"
      >
        Forgot password?
      </button>
```

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS — 21 files, 134 tests (113 + 8 + 10 + 3).

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc -b --noEmit
cd .. && git add app/src/pages/Login.tsx app/src/pages/Login.test.tsx && git commit -m "feat: forgot-password entry on the login screen" && cd app
```

---

### Task 5: Whole-feature verification

- [ ] **Step 1:** `npx vitest run` + `npx tsc -b --noEmit` + `npm run build` — all clean.
- [ ] **Step 2 (live, with Justina — the definitive scanner-proof test):** dev server, real mailbox:
  1. Login screen → "Forgot password?" → her email → "Email me a code".
  2. She opens the email (should be code-only), types the code + a new password **herself** (the assistant never sees or types her password).
  3. Confirm she lands signed-in; sign out is not built (v1 decision) so verify by reloading — session persists.
  4. Wrong-code path: request a fresh code, type a wrong one, confirm the friendly error.
  5. Confirm the old password no longer works (she signs out via clearing site data OR just confirms the new one works on her iPhone later).
- [ ] **Step 3:** Final whole-feature code review (controller dispatches), then update `docs/superpowers/HANDOFF.md` (feature status, Task 0 template outcome, any new gotchas) and tick this plan's checkboxes. Commit: `docs: forgot-password shipped - handoff updated`.
- [ ] **Step 4 (later, on-device):** iPhone check during the next acceptance session: reset flow end-to-end in standalone PWA mode.

## Out of scope (per spec)

In-app change password, email change, OTP login, custom SMTP.
