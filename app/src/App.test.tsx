import { render, screen } from '@testing-library/react';
import App from './App';
import type { Profile } from './lib/types';

const fetchOwnProfile = vi.fn();
vi.mock('./lib/profile', () => ({ fetchOwnProfile: () => fetchOwnProfile() }));
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
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
});
