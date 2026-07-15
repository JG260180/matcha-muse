import { useState } from 'react';
import { supabase } from '../lib/supabase';
import ForgotPassword from '../components/ForgotPassword';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError("That didn't work — check the email and password and try again.");
  }

  if (forgot) return <ForgotPassword initialEmail={email} onBack={() => setForgot(false)} />;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-cream px-8 text-ink">
      <h1 className="font-display text-3xl">Matcha Muse</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
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
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          autoComplete="current-password"
          className="w-full rounded-xl border border-sand bg-white p-4"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream disabled:opacity-40"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
      <button
        type="button"
        onClick={() => { setError(null); setForgot(true); }}
        className="mt-4 self-start text-sm text-ink/60 underline"
      >
        Forgot password?
      </button>
    </div>
  );
}
