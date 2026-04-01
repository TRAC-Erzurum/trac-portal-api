export type FeedbackCategory =
  | 'bug'
  | 'enhancement'
  | 'improvement'
  | 'question'
  | 'security';

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  'bug',
  'enhancement',
  'improvement',
  'question',
  'security',
];

export function isFeedbackCategory(v: string): v is FeedbackCategory {
  return FEEDBACK_CATEGORIES.includes(v as FeedbackCategory);
}
