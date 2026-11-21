import {
  normalizeImportCallSign,
  normalizeSignal,
  resolveCityDistrict,
} from './attendee-import.util';

// Justification (testing policy: non-trivial pure logic). The import row
// normalization has several fallback and matching rules that are easy to
// get subtly wrong and would silently store bad data.
describe('attendee import normalization', () => {
  const cities = [
    { name: 'Erzurum', districts: [{ name: 'Yakutiye' }, { name: 'Merkez' }] },
    { name: 'Ankara', districts: [{ name: 'Çankaya' }, { name: 'Merkez' }] },
    { name: 'Iğdır', districts: [{ name: 'Tuzluca' }] },
    { name: 'İzmir', districts: [{ name: 'Bornova' }] },
  ];

  it.each([
    [undefined, undefined, { readability: 5, signalStrength: 9 }],
    [null, null, { readability: 5, signalStrength: 9 }],
    [4, 7, { readability: 4, signalStrength: 7 }],
    [0, 10, { readability: 5, signalStrength: 9 }],
    [5.5, 3.2, { readability: 5, signalStrength: 9 }],
    [6, 0, { readability: 5, signalStrength: 9 }],
  ])('signal(%s, %s) -> %o', (r, s, expected) => {
    expect(normalizeSignal(r, s)).toEqual(expected);
  });

  it.each([
    [' ta9a ', 'TA9A'],
    ['dl/ta9a/2', 'DL/TA9A/2'],
    ['', ''],
  ])('callSign(%j) -> %j', (input, expected) => {
    expect(normalizeImportCallSign(input)).toBe(expected);
  });

  it.each([
    [
      { city: 'erzurum', district: 'yakutiye' },
      { city: 'Erzurum', district: 'Yakutiye' },
    ],
    [
      { city: 'Erzurum', district: 'Çankaya' },
      { city: 'Erzurum', district: null },
    ],
    [
      { city: 'Bilinmeyen', district: 'Merkez' },
      { city: null, district: null },
    ],
    [
      { city: 'IĞDIR', district: 'TUZLUCA' },
      { city: 'Iğdır', district: 'Tuzluca' },
    ],
    [{ city: 'izmir' }, { city: 'İzmir', district: null }],
    [{ district: 'tuzluca' }, { city: 'Iğdır', district: 'Tuzluca' }],
    [{ district: 'Merkez' }, { city: null, district: null }],
    [
      { district: 'Bornova', city: '' },
      { city: 'İzmir', district: 'Bornova' },
    ],
    [{}, { city: null, district: null }],
  ])('resolve(%o) -> %o', (input, expected) => {
    expect(resolveCityDistrict(input, cities)).toEqual(expected);
  });
});
