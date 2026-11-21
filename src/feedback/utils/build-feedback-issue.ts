import { FEEDBACK_CATEGORY_TITLE } from '../feedback.constants';
import { FeedbackCategory } from '../feedback.types';

/**
 * Issue body for GitHub. It holds only the category, the submitted text, a
 * link to the portal record and an attachment count. No user, operator,
 * branch, call sign, role or upload URL is included: the repository is public.
 */
export function buildFeedbackIssueBody(input: {
  category: FeedbackCategory;
  body: string;
  recordId: string;
  attachmentCount: number;
  origin: string;
}): string {
  const lines = [
    `Category: ${FEEDBACK_CATEGORY_TITLE[input.category]}`,
    '',
    input.body,
    '',
    `Portal record: ${input.origin}/admin/feedback/${input.recordId}`,
  ];
  if (input.attachmentCount > 0) {
    lines.push(`${input.attachmentCount} attachment(s) in the portal record`);
  }
  return lines.join('\n');
}
