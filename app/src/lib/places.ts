import type { CafeCandidate } from './types';

interface PlacesPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

export function parsePlaces(places: PlacesPlace[] | undefined): CafeCandidate[] {
  return (places ?? []).flatMap((p) => {
    if (!p.id || !p.displayName?.text || !p.location?.latitude || !p.location?.longitude) return [];
    return [{
      name: p.displayName.text,
      address: p.formattedAddress ?? '',
      placeId: p.id,
      latitude: p.location.latitude,
      longitude: p.location.longitude,
    }];
  });
}

const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location';

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': import.meta.env.VITE_GOOGLE_PLACES_KEY as string,
    'X-Goog-FieldMask': FIELD_MASK,
  };
}

export async function nearbyCafes(latitude: number, longitude: number): Promise<CafeCandidate[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      includedTypes: ['cafe', 'coffee_shop'],
      maxResultCount: 8,
      locationRestriction: { circle: { center: { latitude, longitude }, radius: 300 } },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Places nearby search failed: ${res.status}`);
  return parsePlaces((await res.json()).places);
}

export async function searchCafes(query: string): Promise<CafeCandidate[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ textQuery: query, regionCode: 'AU', maxResultCount: 8 }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Places text search failed: ${res.status}`);
  return parsePlaces((await res.json()).places);
}
