import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileForm from './ProfileForm';
import type { Profile } from '../lib/types';

const saveProfile = vi.fn();
const uploadAvatar = vi.fn();
vi.mock('../lib/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/profile')>()),
  saveProfile: (...args: unknown[]) => saveProfile(...args),
  uploadAvatar: (...args: unknown[]) => uploadAvatar(...args),
}));
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => ({ remove: vi.fn().mockResolvedValue({ error: null }), createSignedUrl: vi.fn().mockResolvedValue({ data: null }) }) },
  },
}));

// jsdom has no object-URL support; ProfileForm's photo preview needs both.
// Stubbed file-wide (not per-test) so effect cleanup on unmount stays safe.
vi.stubGlobal('URL', Object.assign(
  class extends URL {},
  { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() },
));

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

  it('shows the save-failure message and re-enables save when saving fails', async () => {
    saveProfile.mockClear();
    saveProfile.mockRejectedValueOnce(new Error('network'));
    render(<ProfileForm initial={null} onSaved={vi.fn()} />);
    fillRequired();
    const save = screen.getByRole('button', { name: /save/i });
    fireEvent.click(save);
    expect(await screen.findByText("Couldn't save. Check your connection and try again.")).toBeDefined();
    expect(save.hasAttribute('disabled')).toBe(false);
  });

  it('shows the photo-failure message and does not save when the upload fails', async () => {
    saveProfile.mockClear();
    uploadAvatar.mockRejectedValueOnce(new Error('storage down'));
    render(<ProfileForm initial={null} onSaved={vi.fn()} />);
    fillRequired();
    const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText(/add a photo/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/Your photo didn't upload/)).toBeDefined();
    expect(saveProfile).not.toHaveBeenCalled();
  });
});
