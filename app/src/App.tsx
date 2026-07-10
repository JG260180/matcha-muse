import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { flush } from './lib/offlineQueue';
import { submitQueued } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewReview from './pages/NewReview';
import NearMe from './pages/NearMe';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const sync = () => { void flush(submitQueued); };
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Login />;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-cream text-ink">
        <header className="px-6 pt-8 pb-2">
          <h1 className="font-display text-2xl">Matcha Muse</h1>
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
        </Routes>
      </div>
    </BrowserRouter>
  );
}
