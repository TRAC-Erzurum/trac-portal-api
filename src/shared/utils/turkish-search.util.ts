/**
 * Turkish character mapping for case-insensitive and Turkish-character-compatible search
 * Handles special characters like ş, ç, ğ, ı, ö, ü
 */

// Character normalization map for Turkish support
const TURKISH_CHAR_MAP: Record<string, string> = {
  // Uppercase to lowercase
  Ş: 's',
  ş: 's',
  Ç: 'c',
  ç: 'c',
  Ğ: 'g',
  ğ: 'g',
  Ü: 'u',
  ü: 'u',
  Ö: 'o',
  ö: 'o',
  İ: 'i',
  ı: 'i',
  I: 'i',
};

/**
 * Normalizes Turkish text for search by:
 * 1. Converting to lowercase
 * 2. Replacing Turkish characters with their ASCII equivalents
 * This makes search case-insensitive and Turkish-character-compatible
 *
 * Examples:
 * - "Şahin" -> "sahin"
 * - "İstanbul" -> "istanbul"
 * - "ÇANKIRI" -> "cankiri"
 * - "ş" and "s" both normalize to "s"
 * - "İ" and "i" both normalize to "i"
 */
export function normalizeTurkishText(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()
    .split('')
    .map((char) => TURKISH_CHAR_MAP[char] || char)
    .join('');
}

/**
 * Creates a pattern for LIKE queries that works with Turkish characters
 * Normalizes the search term for database LIKE operations
 *
 * @param searchTerm - The search term to normalize
 * @returns PostgreSQL LIKE pattern with % wildcards
 */
export function normalizeTurkishSearchTerm(searchTerm: string): string {
  const normalized = normalizeTurkishText(searchTerm.trim());
  return `%${normalized}%`;
}

/**
 * Checks if a string matches a search term with Turkish character support
 * Useful for client-side filtering
 *
 * @param text - The text to search in
 * @param searchTerm - The term to search for
 * @returns true if the normalized text includes the normalized search term
 */
export function matchesTurkishSearch(
  text: string,
  searchTerm: string,
): boolean {
  const normalizedText = normalizeTurkishText(text);
  const normalizedTerm = normalizeTurkishText(searchTerm);
  return normalizedText.includes(normalizedTerm);
}

/**
 * Creates a regex pattern for Turkish-compatible search
 * Useful for advanced filtering scenarios
 */
export function createTurkishSearchRegex(
  searchTerm: string,
  flags = 'gi',
): RegExp {
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, flags);
}
