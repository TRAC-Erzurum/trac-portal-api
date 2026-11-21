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

/** Category names used in GitHub issue titles and bodies. Issues never carry a call sign. */
export const FEEDBACK_CATEGORY_TITLE: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  enhancement: 'Feature request',
  improvement: 'Improvement',
  question: 'Question',
  security: 'Security',
};

export function buildFeedbackIssueTitle(
  category: FeedbackCategory,
  summary: string,
): string {
  let title = `[Feedback] ${FEEDBACK_CATEGORY_TITLE[category]}: ${summary.trim()}`;
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
