import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { flush } from './lib/offlineQueue';
import { submitQueued } from './lib/api';
import { fetchOwnProfile } from './lib/profile';
import type { Profile } from './lib/types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewReview from './pages/NewReview';
import NearMe from './pages/NearMe';
import ReviewDetail from './pages/ReviewDetail';
import Welcome from './pages/Welcome';
import Reviewers from './pages/Reviewers';
import ReviewerProfile from './pages/ReviewerProfile';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // undefined = loading, null = no profile yet (gate), Profile = ready
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [profileError, setProfileError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setProfile(undefined);
    setProfileError(false);
    fetchOwnProfile()
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setProfileError(true); });
    return () => { cancelled = true; };
  }, [session, attempt]);

  useEffect(() => {
    if (!session) return;
    const sync = () => { void flush(submitQueued); };
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (profileError) {
    return (
      <div className="min-h-screen bg-cream px-6 py-16 text-center text-ink">
        <p className="text-ink/60">Couldn't load your profile — check your connection.</p>
        <button
          type="button"
          onClick={() => { setProfile(undefined); setAttempt((a) => a + 1); }}
          className="mt-4 rounded-xl bg-matcha-deep px-5 py-2.5 text-cream"
        >
          Try again
        </button>
      </div>
    );
  }
  if (profile === undefined) return null;
  if (profile === null) return <Welcome onSaved={setProfile} />;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-cream text-ink">
        <header className="px-6 pt-8 pb-2">
          <h1 className="font-display text-2xl">
            <Link to="/">Matcha Muse</Link>
          </h1>
          <nav className="mt-2 flex gap-2" aria-label="View">
            {[{ to: '/', label: 'Journal' }, { to: '/near', label: 'Near me' }].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `rounded-full px-4 py-1.5 text-sm ${isActive ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewReview />} />
          <Route path="/near" element={<NearMe />} />
          <Route path="/review/:id" element={<ReviewDetail />} />
          <Route path="/reviewers" element={<Reviewers />} />
          <Route path="/reviewer/:id" element={<ReviewerProfile />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
