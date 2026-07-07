import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError("Couldn't send the link. Check the email address and try again.");
    else setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-cream px-8 text-ink">
      <h1 className="font-display text-3xl">Matcha Muse</h1>
      {sent ? (
        <p className="mt-4">Check your email — tap the sign-in link on this phone.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            className="w-full rounded-xl border border-sand bg-white p-4"
          />
          <button type="submit" className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream">
            Email me a sign-in link
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </form>
      )}
    </div>
  );
}
