import type { Profile } from '../lib/types';
import ProfileForm from '../components/ProfileForm';

// First-sign-in gate target: rendered instead of the app until a profile
// row exists (required setup — spec 2026-07-12).
export default function Welcome({ onSaved }: { onSaved: (p: Profile) => void }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="px-6 pt-8 pb-2">
        <h1 className="font-display text-2xl">Matcha Muse</h1>
      </header>
      <div className="px-6 pb-4">
        <h2 className="font-display text-xl">Welcome — tell us your taste</h2>
        <p className="pt-1 text-sm text-ink/60">
          A one-off setup so your reviews carry your name. Takes a minute.
        </p>
      </div>
      <ProfileForm initial={null} onSaved={onSaved} />
    </div>
  );
}
