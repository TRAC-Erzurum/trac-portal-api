import { join } from 'path';

/** Static hinted TTF (not variable); variable fonts break pdf-lib subset/glyph layout for Turkish. */
export const CERTIFICATE_EMBEDDED_FONT_FILE = 'NotoSans-Regular.ttf';

export function getCertificateFontsDir(): string {
  return join(__dirname, '..', 'assets', 'fonts');
}
