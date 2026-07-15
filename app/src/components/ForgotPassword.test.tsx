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

  it('stays on the code step with the rate-limit message when confirm is rate-limited', async () => {
    requestReset.mockResolvedValue(undefined);
    confirmReset.mockRejectedValue({ status: 429 });
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    await sendCode();
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'brand-new-pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByText(/Too many attempts/)).toBeDefined();
    expect(screen.getByLabelText('6-digit code')).toBeDefined(); // still on the code step
  });

  it('shows the connection message when confirm hits a network failure', async () => {
    requestReset.mockResolvedValue(undefined);
    confirmReset.mockRejectedValue(new TypeError('fetch failed'));
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    await sendCode();
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'brand-new-pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByText(/Couldn't reset your password/)).toBeDefined();
    expect(screen.getByLabelText('6-digit code')).toBeDefined(); // still on the code step
  });

  it('disables Back to sign in while a confirm is in flight', async () => {
    requestReset.mockResolvedValue(undefined);
    confirmReset.mockImplementation(() => new Promise(() => {}));
    render(<ForgotPassword initialEmail="justi@example.com" onBack={() => {}} />);
    await sendCode();
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'brand-new-pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    await act(async () => {});
    expect(
      (screen.getByRole('button', { name: 'Back to sign in' }) as HTMLButtonElement).disabled,
    ).toBe(true);
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
