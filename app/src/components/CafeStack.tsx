import type { CafeGroup } from '../lib/nearMe';
import { formatDistance } from '../lib/nearMe';
import { directionsUrl, writeReviewUrl } from '../lib/googleLinks';
import type { Review } from '../lib/types';
import SignedImage from './SignedImage';

interface Props {
  group: CafeGroup;
  expanded: boolean;
  onToggle: () => void;
}

function detailLine(r: Review): string {
  return [r.milk ?? 'milk n/a', r.temperature ?? 'serve n/a'].join(' · ');
}

export default function CafeStack({ group, expanded, onToggle }: Props) {
  const { cafe, reviews, distanceM, avg } = group;
  const multi = reviews.length > 1;
  const latest = reviews[0];

  async function copyNote() {
    if (!latest.note) return;
    try {
      await navigator.clipboard.writeText(latest.note);
    } catch {
      // Clipboard can fail (permissions); the link still opens — non-fatal.
    }
  }

  const headerBody = (
    <>
      <SignedImage path={latest.photo_path} alt={cafe.name} className="h-36 w-full object-cover" />
      <div className="p-3 text-left">
        <p className="truncate font-display">{cafe.name}</p>
        <p className="text-sm text-ink/60">
          {distanceM != null ? `${formatDistance(distanceM)} · ` : ''}
          {avg.toFixed(1)} ★
          {multi ? '' : ` · ${detailLine(latest)}`}
          {cafe.latitude == null ? ' · added manually' : ''}
        </p>
        {multi && (
          <span className="mt-1 inline-block rounded-full bg-matcha-mist px-2 py-0.5 text-xs text-matcha-deep">
            {reviews.length} matchas
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className="relative">
      {/* playing-card backing layers */}
      {multi && !expanded && (
        <>
          <div aria-hidden className="absolute inset-x-2 -bottom-2 h-full rounded-2xl border border-sand bg-white" />
          <div aria-hidden className="absolute inset-x-1 -bottom-1 h-full rounded-2xl border border-sand bg-white" />
        </>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-sand bg-white">
        {multi ? (
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="block w-full">
            {headerBody}
          </button>
        ) : (
          headerBody
        )}

        {cafe.google_place_id && (
          <div className="flex gap-4 border-t border-sand px-3 py-2 text-sm">
            {cafe.latitude != null && cafe.longitude != null && (
              <a
                href={directionsUrl(cafe.latitude, cafe.longitude, cafe.google_place_id)}
                target="_blank" rel="noreferrer" className="text-matcha-deep underline"
              >
                Open in Google Maps
              </a>
            )}
            <a
              href={writeReviewUrl(cafe.google_place_id)}
              target="_blank" rel="noreferrer" onClick={copyNote}
              className="text-matcha-deep underline"
            >
              Review on Google
            </a>
          </div>
        )}
      </div>

      {/* fanned-out reviews */}
      {multi && expanded && (
        <div className="mt-2 space-y-2 pl-3">
          {reviews.map((r) => (
            <div key={r.id} className="flex gap-3 overflow-hidden rounded-xl border border-sand bg-white">
              <SignedImage path={r.photo_path} alt={cafe.name} className="h-20 w-20 shrink-0 object-cover" />
              <div className="py-2 pr-3">
                <p className="text-sm">
                  {Number(r.overall).toFixed(1)} ★ · {detailLine(r)}
                </p>
                {r.note && <p className="mt-1 line-clamp-2 text-sm text-ink/60">{r.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
