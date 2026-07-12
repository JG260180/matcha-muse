import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProfiles, initialsFrom } from '../lib/profile';
import type { Profile } from '../lib/types';
import SignedImage from '../components/SignedImage';
import BackToJournal from '../components/BackToJournal';

export default function Reviewers() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetchProfiles()
      .then(setProfiles)
      .catch(() => { setFetchError(true); setProfiles([]); });
  }, []);

  if (profiles === null) return <p className="px-6 text-ink/60">Brewing…</p>;
  if (fetchError) return <p className="px-6 py-10 text-center text-ink/60">Couldn't load reviewers — check your connection and try again.</p>;

  return (
    <div className="pb-10 pt-2">
      <BackToJournal />
      <h2 className="px-6 pb-4 font-display text-xl">Reviewers</h2>
      <div className="space-y-3 px-6">
        {profiles.map((p) => (
          <Link
            key={p.id}
            to={`/reviewer/${p.id}`}
            className="flex items-center gap-3 rounded-2xl border border-sand bg-white p-3"
          >
            {p.avatar_path ? (
              <SignedImage path={p.avatar_path} alt={`${p.display_name}'s photo`} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha-deep text-sm text-cream">
                {initialsFrom(p.display_name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display">{p.display_name}</p>
              {p.about_me && <p className="truncate text-sm text-ink/60">{p.about_me}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
