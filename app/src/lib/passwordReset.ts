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
