import { FeedbackCategory } from './feedback.types';

export const MAX_FEEDBACK_SUMMARY_LENGTH = 120;
export const MAX_FEEDBACK_BODY_LENGTH = 20000;

export const FEEDBACK_LABEL_PRODUCT = 'trac-portal-feedback';

export const FEEDBACK_LABEL_BY_CATEGORY: Record<FeedbackCategory, string> = {
  bug: 'bug',
  enhancement: 'enhancement',
  improvement: 'improvement',
  question: 'question',
  security: 'security',
};

const TITLE_UNKNOWN_CALLSIGN = 'Bilinmeyen çağrı işareti';

export function buildFeedbackIssueTitle(
  category: FeedbackCategory,
  callSign: string | undefined,
  summary: string,
): string {
  const cs = callSign?.trim() || TITLE_UNKNOWN_CALLSIGN;
  const s = summary.trim();
  const templates: Record<FeedbackCategory, string> = {
    bug: `${cs} tarafından bildirilen hata: ${s}`,
    enhancement: `${cs} tarafından bildirilen özellik isteği: ${s}`,
    improvement: `${cs} tarafından bildirilen iyileştirme: ${s}`,
    question: `${cs} tarafından bildirilen soru: ${s}`,
    security: `${cs} tarafından bildirilen güvenlik bildirimi: ${s}`,
  };
  let title = templates[category];
  if (title.length > 250) {
    title = `${title.slice(0, 247)}…`;
  }
  return title;
}

export const ALLOWED_FEEDBACK_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mime] ?? 'bin';
}
