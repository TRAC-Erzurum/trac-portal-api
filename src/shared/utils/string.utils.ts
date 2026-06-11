/**
 * Turkish-aware title case conversion.
 *
 * Lodash `startCase` internally calls `deburr()` which strips diacritical
 * marks, destroying Turkish special characters (ö→o, ş→s, ğ→g, ı→i, ü→u,
 * ç→c, İ→I). This function uses locale-aware methods instead.
 *
 * Examples:
 *   "PALANDÖKEN" → "Palandöken"
 *   "ŞUHUT"     → "Şuhut"
 *   "GÖLBAŞI"   → "Gölbaşı"
 */
export function toTitleCase(str: string): string {
  return str
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
    .join(' ');
}
