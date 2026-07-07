import { parsePlaces } from './places';

const sample = [
  {
    id: 'ChIJabc123',
    displayName: { text: 'Kōya Coffee' },
    formattedAddress: '12 O’Connell St, North Adelaide SA 5006',
    location: { latitude: -34.906, longitude: 138.594 },
  },
  { id: 'ChIJnoloc', displayName: { text: 'Mystery Cafe' } },
];

test('maps a Places response into cafe candidates', () => {
  const result = parsePlaces(sample);
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    name: 'Kōya Coffee',
    address: '12 O’Connell St, North Adelaide SA 5006',
    placeId: 'ChIJabc123',
    latitude: -34.906,
    longitude: 138.594,
  });
});

test('returns empty list for missing input', () => {
  expect(parsePlaces(undefined)).toEqual([]);
});
