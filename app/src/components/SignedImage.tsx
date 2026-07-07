import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props { path: string | null; alt: string; className?: string }

export default function SignedImage({ path, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    supabase.storage.from('photos').createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!path || !url) return <div className={`bg-matcha-mist ${className ?? ''}`} aria-label={alt} />;
  return <img src={url} alt={alt} className={className} />;
}
