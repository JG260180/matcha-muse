import { render, screen, fireEvent } from '@testing-library/react';
import Login from './Login';
import { supabase } from '../lib/supabase';

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

  it('clears a stale sign-in error when visiting Forgot password and returning', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ error: new Error('bad') } as never);
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'j@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/That didn't work/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.queryByText(/That didn't work/)).toBeNull();
  });
});
