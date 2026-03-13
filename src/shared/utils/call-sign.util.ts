/**
 * Call sign validation and normalization (ITU-style amateur radio).
 * - Call signs use only uppercase letters and digits (A-Z, 0-9).
 * - Optional prefix/suffix with "/" (e.g. DL/TA9A, TA9A/3, DL/TA9A/2).
 * - At most 2 slashes (max 3 segments).
 */

const SEGMENT_REGEX = /^[A-Z0-9]+$/;
const MAX_SLASHES = 2;

function normalizeSegment(s: string): string {
  return (s ?? '').trim().toUpperCase();
}

/**
 * Checks that a single segment contains only letters and digits (after uppercase).
 */
export function isValidCallSignSegment(segment: string): boolean {
  const n = normalizeSegment(segment);
  return n.length > 0 && SEGMENT_REGEX.test(n);
}

/**
 * A segment is considered a "full" call sign if it contains both at least one
 * letter and at least one digit (typical base call sign pattern).
 */
function segmentLooksLikeBaseCallSign(segment: string): boolean {
  const n = normalizeSegment(segment);
  if (n.length === 0) return false;
  return /[A-Z]/.test(n) && /[0-9]/.test(n);
}

export interface CallSignFormatOptions {
  /** If false, only a single segment (no slashes) is allowed. */
  allowSlashes: boolean;
}

/**
 * Validates call sign format.
 * - Trimmed value must be non-empty.
 * - Only A-Z and 0-9 (case-insensitive input).
 * - If allowSlashes is false: no "/" allowed, single segment.
 * - If allowSlashes is true: at most 2 slashes; each segment non-empty and A-Z0-9 only.
 */
export function isValidCallSignFormat(
  value: string,
  options: CallSignFormatOptions,
): boolean {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) return false;

  const parts = trimmed.split('/').map((p) => (p ?? '').trim());
  const slashCount = parts.length - 1;

  if (!options.allowSlashes) {
    if (slashCount > 0) return false;
    return isValidCallSignSegment(parts[0] ?? '');
  }

  if (slashCount > MAX_SLASHES) return false;
  return parts.every((p) => isValidCallSignSegment(p));
}

/**
 * Extracts the "plain" (base) call sign used for operator matching.
 * - If no slash: returns trimmed uppercase.
 * - If slashes: among segments that look like a base call sign (contain both
 *   letter and digit), returns the last such segment (e.g. "şube/çağrı" → use latter).
 * - If no such segment (e.g. only prefix/suffix), returns the last segment uppercased.
 */
export function extractPlainCallSign(value: string): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) return '';

  const parts = trimmed.split('/').map((p) => normalizeSegment((p ?? '').trim())).filter(Boolean);
  if (parts.length === 0) return '';

  if (parts.length === 1) return parts[0] ?? '';

  const withDigitAndLetter = parts.filter((s) => /[A-Z]/.test(s) && /[0-9]/.test(s));
  if (withDigitAndLetter.length > 0) {
    return withDigitAndLetter[withDigitAndLetter.length - 1] ?? '';
  }

  return parts[parts.length - 1] ?? '';
}

/**
 * Normalizes a plain call sign for storage (trim + uppercase).
 * Use for operator/branch call signs that must be plain.
 */
export function normalizePlainCallSign(value: string): string {
  return normalizeSegment((value ?? '').trim());
}

/**
 * Converts legacy call sign formats (e.g. "-", ".", or spaces as separators)
 * to the canonical "/" form, then extracts the plain call sign.
 * Use in migrations to normalize existing data.
 * - Replaces "-" and "." with "/".
 * - Removes all whitespace (e.g. "TB7 ABT" → "TB7ABT").
 */
export function legacyCallSignToPlain(value: string): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) return '';
  const noSpaces = trimmed.replace(/\s+/g, '');
  const withSlash = noSpaces
    .replace(/-/g, '/')
    .replace(/\./g, '/')
    .trim();
  return extractPlainCallSign(withSlash) || normalizeSegment(noSpaces);
}
