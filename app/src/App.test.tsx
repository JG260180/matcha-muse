import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import type { Profile } from './lib/types';

const fetchOwnProfile = vi.fn();
let authCallback: ((event: string, s: unknown) => void) | undefined;
vi.mock('./lib/profile', () => ({ fetchOwnProfile: () => fetchOwnProfile() }));
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: vi.fn((cb: (event: string, s: unknown) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));
vi.mock('./lib/offlineQueue', () => ({ flush: vi.fn() }));
vi.mock('./lib/api', () => ({ submitQueued: vi.fn() }));
vi.mock('./pages/Dashboard', () => ({ default: () => <div>JOURNAL-PAGE</div> }));
vi.mock('./pages/Welcome', () => ({ default: () => <div>WELCOME-PAGE</div> }));

describe('first-sign-in profile gate', () => {
  it('shows the Welcome setup when the user has no profile yet', async () => {
    fetchOwnProfile.mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByText('WELCOME-PAGE')).toBeDefined();
    expect(screen.queryByText('JOURNAL-PAGE')).toBeNull();
  });

  it('shows the app when a profile exists', async () => {
    const p: Profile = { id: 'u1', display_name: 'Justina', about_me: null, avatar_path: null, quiz: {} };
    fetchOwnProfile.mockResolvedValue(p);
    render(<App />);
    expect(await screen.findByText('JOURNAL-PAGE')).toBeDefined();
  });

  it('shows a retry message when the profile lookup fails', async () => {
    fetchOwnProfile.mockRejectedValue(new Error('network'));
    render(<App />);
    expect(await screen.findByRole('button', { name: /try again/i })).toBeDefined();
  });

  it('retries the lookup and shows the app when Try again succeeds', async () => {
    const p: Profile = { id: 'u1', display_name: 'Justina', about_me: null, avatar_path: null, quiz: {} };
    fetchOwnProfile.mockReset();
    fetchOwnProfile.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(p);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('JOURNAL-PAGE')).toBeDefined();
  });

  it('keeps the app mounted when a token refresh delivers a new session object', async () => {
    const p: Profile = { id: 'u1', display_name: 'Justina', about_me: null, avatar_path: null, quiz: {} };
    fetchOwnProfile.mockReset();
    fetchOwnProfile.mockResolvedValue(p);
    render(<App />);
    expect(await screen.findByText('JOURNAL-PAGE')).toBeDefined();
    const callsBefore = fetchOwnProfile.mock.calls.length;
    // Supabase fires TOKEN_REFRESHED with a NEW session object for the SAME user.
    act(() => authCallback?.('TOKEN_REFRESHED', { user: { id: 'u1' } }));
    expect(screen.getByText('JOURNAL-PAGE')).toBeDefined();
    expect(fetchOwnProfile.mock.calls.length).toBe(callsBefore);
  });
});
