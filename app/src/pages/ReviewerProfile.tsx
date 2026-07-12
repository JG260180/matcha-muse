import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { computeStats } from '../lib/reviewerStats';
import { initialsFrom } from '../lib/profile';
import {
  SWEETNESS_PREFS, ADVENTUROUSNESS, FREQUENCY, PRIORITIES, MILK_OPTIONS,
  type Profile, type Review,
} from '../lib/types';
import SignedImage from '../components/SignedImage';
import BackToJournal from '../components/BackToJournal';
import ProfileForm from '../components/ProfileForm';

function quizLabel(
  options: readonly { key: string; label: string }[],
  key: string | undefined
): string | null {
  return options.find((o) => o.key === key)?.label ?? null;
}

function StatRow({ label, value }: { label: string; value: string | null }) {
  if (value == null) return null;
  return (
    <p className="text-sm">
      <span className="text-ink/60">{label}: </span>{value}
    </p>
  );
}

export default function ReviewerProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ownId, setOwnId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setProfile(undefined);
    setEditing(false);
    setLoadFailed(false);
    if (!id) return;
    Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('reviews').select('*, cafe:cafes(*)').eq('user_id', id).eq('status', 'complete'),
      supabase.auth.getUser(),
    ]).then(([p, r, u]) => {
      if (p.error || r.error) { setLoadFailed(true); return; }
      setProfile((p.data as Profile | null) ?? null);
      setReviews((r.data as Review[] | null) ?? []);
      setOwnId(u.data.user?.id ?? null);
    });
  }, [id]);

  if (loadFailed) {
    return <p className="px-6 py-10 text-center text-ink/60">Couldn't load this profile — check your connection and try again.</p>;
  }
  if (profile === undefined) return <p className="px-6 text-ink/60">Brewing…</p>;
  if (profile === null) {
    return (
      <div className="pt-2">
        <BackToJournal />
        <p className="px-6 py-10 text-center text-ink/60">This reviewer hasn't set up their profile yet.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="pt-2">
        <BackToJournal />
        <h2 className="px-6 pb-4 font-display text-xl">Edit profile</h2>
        <ProfileForm
          initial={profile}
          onSaved={(p) => { setProfile(p); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const stats = computeStats(reviews);
  const quizRows = [
    { label: 'Sweetness', value: quizLabel(SWEETNESS_PREFS, profile.quiz.sweetness) },
    { label: 'Go-to milk', value: quizLabel(MILK_OPTIONS, profile.quiz.milk) },
    { label: 'Adventurousness', value: quizLabel(ADVENTUROUSNESS, profile.quiz.adventurousness) },
    { label: 'Matcha habit', value: quizLabel(FREQUENCY, profile.quiz.frequency) },
    { label: 'What matters most', value: quizLabel(PRIORITIES, profile.quiz.priority) },
  ].filter((q) => q.value != null);

  return (
    <div className="pb-10 pt-2">
      <BackToJournal />
      <div className="flex items-center gap-4 px-6 py-4">
        {profile.avatar_path ? (
          <SignedImage path={profile.avatar_path} alt={`${profile.display_name}'s photo`} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-matcha-deep font-display text-xl text-cream">
            {initialsFrom(profile.display_name)}
          </div>
        )}
        <div>
          <h2 className="font-display text-xl">{profile.display_name}</h2>
          {profile.about_me && <p className="text-sm text-ink/70">{profile.about_me}</p>}
        </div>
      </div>

      {quizRows.length > 0 && (
        <div className="mx-6 mb-4 space-y-1 rounded-2xl bg-sand/50 p-4">
          <h3 className="pb-1 font-display">Taste profile</h3>
          {quizRows.map((q) => (
            <p key={q.label} className="text-sm">
              <span className="text-ink/60">{q.label}: </span>{q.value}
            </p>
          ))}
        </div>
      )}

      <div className="mx-6 space-y-1 rounded-2xl bg-sand/50 p-4">
        <h3 className="pb-1 font-display">From the journal</h3>
        {stats.matchaCount === 0 ? (
          <p className="text-sm text-ink/60">No matchas logged yet.</p>
        ) : (
          <>
            <StatRow label="Matchas logged" value={String(stats.matchaCount)} />
            <StatRow label="Cafes visited" value={String(stats.cafeCount)} />
            <StatRow label="Favourite cafe" value={stats.favouriteCafe} />
            <StatRow
              label="Usual order"
              value={[stats.usualMilk, stats.serveLean].filter(Boolean).join(', ') || null}
            />
            <StatRow label="Average score" value={stats.avgOverall ? `${stats.avgOverall} ★` : null} />
            <StatRow
              label="Priciest matcha"
              value={stats.priciest ? `$${stats.priciest.price.toFixed(2)} at ${stats.priciest.cafeName}` : null}
            />
          </>
        )}
      </div>

      {ownId === profile.id && (
        <div className="px-6 pt-4">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream"
          >
            Edit profile
          </button>
        </div>
      )}
    </div>
  );
}
