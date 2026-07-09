export function directionsUrl(lat: number, lng: number, placeId: string): string {
  const query = encodeURIComponent(`${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(placeId)}`;
}

export function writeReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

// Static Maps auto-fits the viewport around all markers when no center/zoom is
// given, which handles both the "user + cafes" and "cafes only" cases.
export function staticMapUrl(
  pins: { latitude: number; longitude: number }[],
  user: { latitude: number; longitude: number } | null,
  key: string
): string {
  const params: string[] = ['size=640x320', 'scale=2', `key=${encodeURIComponent(key)}`];
  if (pins.length > 0) {
    const points = pins.map((p) => `${p.latitude},${p.longitude}`).join('|');
    params.push(`markers=${encodeURIComponent(`color:0x2f5233|${points}`)}`);
  }
  if (user) {
    params.push(
      `markers=${encodeURIComponent(`color:blue|size:small|${user.latitude},${user.longitude}`)}`
    );
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${params.join('&')}`;
}
