import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileForm from './ProfileForm';
import type { Profile } from '../lib/types';

const saveProfile = vi.fn();
vi.mock('../lib/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/profile')>()),
  saveProfile: (...args: unknown[]) => saveProfile(...args),
  uploadAvatar: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ remove: vi.fn().mockResolvedValue({ error: null }), createSignedUrl: vi.fn().mockResolvedValue({ data: null }) }) } },
}));

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Justina Gardiner' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lightly sweet' }));
  fireEvent.click(screen.getByRole('button', { name: 'Oat' }));
  fireEvent.click(screen.getByRole('button', { name: "I'll branch out sometimes" }));
  fireEvent.click(screen.getByRole('button', { name: 'Weekly treat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Taste' }));
}

describe('ProfileForm', () => {
  it('disables save until name and all five taste answers are given', () => {
    render(<ProfileForm initial={null} onSaved={() => {}} />);
    const save = screen.getByRole('button', { name: /save/i });
    expect(save.hasAttribute('disabled')).toBe(true);
    fillRequired();
    expect(save.hasAttribute('disabled')).toBe(false);
  });

  it('saves the profile and reports it back', async () => {
    const saved: Profile = {
      id: 'u1', display_name: 'Justina Gardiner', about_me: null, avatar_path: null,
      quiz: { sweetness: 'lightly_sweet', milk: 'oat', adventurousness: 'sometimes', frequency: 'weekly', priority: 'taste' },
    };
    saveProfile.mockResolvedValue(saved);
    const onSaved = vi.fn();
    render(<ProfileForm initial={null} onSaved={onSaved} />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: 'Justina Gardiner',
        quiz: { sweetness: 'lightly_sweet', milk: 'oat', adventurousness: 'sometimes', frequency: 'weekly', priority: 'taste' },
      })
    );
  });
});
