/**
 * Pure row normalization for the attendee Excel import.
 * No I/O and no Nest dependencies, so it can be unit-tested without mocks.
 */

export const DEFAULT_READABILITY = 5;
export const DEFAULT_SIGNAL_STRENGTH = 9;

export interface SignalValues {
  readability: number;
  signalStrength: number;
}

export interface LocationCity {
  name: string;
  districts: ReadonlyArray<{ name: string }>;
}

export interface ResolvedLocation {
  city: string | null;
  district: string | null;
}

function isIntInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

/** Falls back to readability 5 and signal strength 9 when a value is missing or out of range. */
export function normalizeSignal(
  readability?: number | null,
  signalStrength?: number | null,
): SignalValues {
  return {
    readability: isIntInRange(readability, 1, 5)
      ? readability
      : DEFAULT_READABILITY,
    signalStrength: isIntInRange(signalStrength, 1, 9)
      ? signalStrength
      : DEFAULT_SIGNAL_STRENGTH,
  };
}

/** Trims and upper-cases a call sign from the spreadsheet. */
export function normalizeImportCallSign(value: string): string {
  return (value ?? '').trim().toUpperCase();
}

/** Key for case-insensitive place name matching (Turkish casing rules). */
export function normalizeLocationKey(value: string): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
}

/**
 * Resolves city and district to canonical names from the known city list.
 * - City given and unknown: no city and no district.
 * - City known: district kept only if it belongs to that city.
 * - No city, district given: both are filled only when exactly one city has
 *   a district with that name; otherwise neither.
 */
export function resolveCityDistrict(
  input: { city?: string | null; district?: string | null },
  cities: ReadonlyArray<LocationCity>,
): ResolvedLocation {
  const cityKey = normalizeLocationKey(input.city ?? '');
  const districtKey = normalizeLocationKey(input.district ?? '');
  const empty: ResolvedLocation = { city: null, district: null };

  if (cityKey) {
    const city = cities.find((c) => normalizeLocationKey(c.name) === cityKey);
    if (!city) return empty;
    if (!districtKey) return { city: city.name, district: null };
    const district = city.districts.find(
      (d) => normalizeLocationKey(d.name) === districtKey,
    );
    return { city: city.name, district: district?.name ?? null };
  }

  if (!districtKey) return empty;

  const matches = cities.flatMap((c) =>
    c.districts
      .filter((d) => normalizeLocationKey(d.name) === districtKey)
      .map((d) => ({ city: c.name, district: d.name })),
  );
  const distinctCities = new Set(matches.map((m) => m.city));
  if (distinctCities.size === 1) {
    return matches[0];
  }
  return empty;
}
