import { useEffect, useState } from 'react';
import { getSignedUrl, invalidateSignedUrl, thumbPath } from '../lib/signedUrls';

interface Props {
  path: string | null;
  alt: string;
  className?: string;
  /** Card-sized contexts ask for the small copy uploaded next to the photo;
   *  photos saved before thumbs existed fall back to the full image. */
  thumb?: boolean;
}

export default function SignedImage({ path, alt, className, thumb = false }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  // Bumped once when the <img> itself errors (an expired signed token): the
  // cached URL is dropped and one fresh mint is attempted.
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setRetry(0);
  }, [path]);

  useEffect(() => {
    setUrl(null);
    if (!path) return;
    let stale = false;
    (async () => {
      const u = (thumb ? await getSignedUrl(thumbPath(path)) : null) ?? (await getSignedUrl(path));
      if (!stale) setUrl(u);
    })();
    return () => {
      stale = true;
    };
  }, [path, thumb, retry]);

  if (!path || !url) return <div className={`bg-matcha-mist ${className ?? ''}`} aria-label={alt} />;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (retry > 0) return;
        invalidateSignedUrl(path);
        if (thumb) invalidateSignedUrl(thumbPath(path));
        setRetry(1);
      }}
    />
  );
}
