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

  const cooldownActive = cooldown > 0;
  useEffect(() => {
    if (!cooldownActive) return;
    // One interval for the whole cooldown window, rather than an effect that
    // re-schedules itself on every tick — the latter needs a React re-render
    // to flush between each fake-timer advance, which doesn't happen inside
    // a single vi.advanceTimersByTime() call and left the timer stalled.
    const id = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownActive]);

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
    <button type="button" onClick={onBack} className="mt-4 self-start text-sm text-ink/60 underline">
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
