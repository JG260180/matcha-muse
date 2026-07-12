import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { saveProfile, uploadAvatar } from '../lib/profile';
import {
  MILK_OPTIONS, SWEETNESS_PREFS, ADVENTUROUSNESS, FREQUENCY, PRIORITIES,
  type Profile, type TasteQuiz,
} from '../lib/types';
import SignedImage from './SignedImage';

interface Props {
  initial: Profile | null; // null = first-time setup; Profile = editing
  onSaved: (p: Profile) => void;
  onCancel?: () => void;
}

function ChoiceGroup({ label, options, value, onChange }: {
  label: string;
  options: readonly { key: string; label: string }[];
  value: string | undefined;
  onChange: (key: string) => void;
}) {
  return (
    <div>
      <p className="pb-2 text-sm text-sand-ink">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key} type="button" aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${value === o.key ? 'bg-matcha-deep text-cream' : 'bg-sand/60 text-sand-ink'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProfileForm({ initial, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.display_name ?? '');
  const [aboutMe, setAboutMe] = useState(initial?.about_me ?? '');
  const [quiz, setQuiz] = useState<Partial<TasteQuiz>>(initial?.quiz ?? {});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<'photo' | 'save' | null>(null);

  useEffect(() => {
    return () => { if (photoUrl) URL.revokeObjectURL(photoUrl); };
  }, [photoUrl]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    e.target.value = '';
  }

  const setAnswer = (k: keyof TasteQuiz) => (v: string) => setQuiz({ ...quiz, [k]: v });
  const quizComplete = (['sweetness', 'milk', 'adventurousness', 'frequency', 'priority'] as const)
    .every((k) => quiz[k]);
  const canSave = name.trim().length > 0 && quizComplete && !busy;

  async function onSave() {
    setBusy(true);
    setFailed(null);
    let avatarPath = initial?.avatar_path ?? null;
    if (photo) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        avatarPath = await uploadAvatar(photo, userData.user?.id ?? 'me');
      } catch {
        setFailed('photo');
        setBusy(false);
        return;
      }
    }
    try {
      const saved = await saveProfile({
        display_name: name.trim(),
        about_me: aboutMe.trim() || null,
        avatar_path: avatarPath,
        quiz: quiz as TasteQuiz,
      });
      // Best-effort cleanup of a replaced avatar (same stance as review photos).
      if (photo && initial?.avatar_path && initial.avatar_path !== avatarPath) {
        const { error } = await supabase.storage.from('photos').remove([initial.avatar_path]);
        if (error) console.warn('avatar cleanup failed:', error.message);
      }
      onSaved(saved);
    } catch {
      setFailed('save');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 px-6 pb-10">
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt="Your profile photo" className="h-20 w-20 rounded-full object-cover" />
        ) : initial?.avatar_path ? (
          <SignedImage path={initial.avatar_path} alt="Your profile photo" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-matcha-mist text-sm text-matcha-deep">Photo</div>
        )}
        <div className="space-y-1">
          <label className="block cursor-pointer text-sm text-matcha-deep underline">
            {photoUrl || initial?.avatar_path ? 'Change photo' : 'Add a photo (optional)'}
            <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
          </label>
          {photo && (
            <button type="button" className="block text-sm text-ink/60 underline"
              onClick={() => { setPhoto(null); setPhotoUrl(null); setFailed(null); }}>
              Remove new photo
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="profile-name" className="block pb-2 text-sm text-sand-ink">Name</label>
        <input
          id="profile-name" type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-sand bg-white p-3"
        />
      </div>

      <div>
        <label htmlFor="profile-about" className="block pb-2 text-sm text-sand-ink">About me (optional)</label>
        <textarea
          id="profile-about" value={aboutMe ?? ''} rows={3}
          onChange={(e) => setAboutMe(e.target.value)}
          className="w-full rounded-xl border border-sand bg-white p-3"
          placeholder="A sentence or two about your matcha journey…"
        />
      </div>

      <ChoiceGroup label="How sweet do you like it?" options={SWEETNESS_PREFS} value={quiz.sweetness} onChange={setAnswer('sweetness')} />
      <ChoiceGroup label="Go-to milk" options={MILK_OPTIONS} value={quiz.milk} onChange={setAnswer('milk')} />
      <ChoiceGroup label="How adventurous are you?" options={ADVENTUROUSNESS} value={quiz.adventurousness} onChange={setAnswer('adventurousness')} />
      <ChoiceGroup label="How often do you drink matcha?" options={FREQUENCY} value={quiz.frequency} onChange={setAnswer('frequency')} />
      <ChoiceGroup label="What matters most?" options={PRIORITIES} value={quiz.priority} onChange={setAnswer('priority')} />

      <button
        type="button" disabled={!canSave} onClick={onSave}
        className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream disabled:opacity-40"
      >
        {busy ? 'Saving…' : 'Save profile'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="w-full p-2 text-sm text-ink/60 underline">
          Cancel
        </button>
      )}
      {failed === 'photo' && (
        <p className="text-sm text-red-700">Your photo didn't upload — try again, or remove it and save without a photo for now.</p>
      )}
      {failed === 'save' && (
        <p className="text-sm text-red-700">Couldn't save. Check your connection and try again.</p>
      )}
    </div>
  );
}
