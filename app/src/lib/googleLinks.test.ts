import { directionsUrl, writeReviewUrl, staticMapUrl } from './googleLinks';

describe('directionsUrl', () => {
  it('builds a maps search link pinned to the place', () => {
    expect(directionsUrl(-34.9285, 138.6007, 'ChIJabc')).toBe(
      'https://www.google.com/maps/search/?api=1&query=-34.9285%2C138.6007&query_place_id=ChIJabc'
    );
  });
});

describe('writeReviewUrl', () => {
  it('builds the write-review link', () => {
    expect(writeReviewUrl('ChIJabc')).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJabc'
    );
  });
});

describe('staticMapUrl', () => {
  it('includes size, key, one markers param for cafes and one for the user', () => {
    const url = staticMapUrl(
      [{ latitude: -34.9, longitude: 138.6 }, { latitude: -34.8, longitude: 138.7 }],
      { latitude: -34.95, longitude: 138.65 },
      'KEY123'
    );
    expect(url.startsWith('https://maps.googleapis.com/maps/api/staticmap?')).toBe(true);
    expect(url).toContain('size=640x320');
    expect(url).toContain('key=KEY123');
    const markers = url.match(/markers=/g) ?? [];
    expect(markers).toHaveLength(2);
    expect(url).toContain(encodeURIComponent('-34.9,138.6|-34.8,138.7'));
  });

  it('omits the user marker without a position', () => {
    const url = staticMapUrl([{ latitude: -34.9, longitude: 138.6 }], null, 'KEY123');
    expect(url.match(/markers=/g) ?? []).toHaveLength(1);
  });
});
