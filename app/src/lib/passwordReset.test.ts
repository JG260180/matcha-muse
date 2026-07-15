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
