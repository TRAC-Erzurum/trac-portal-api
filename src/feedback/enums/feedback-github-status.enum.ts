export enum FeedbackGithubStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  /** Security reports are never forwarded to GitHub. */
  SKIPPED = 'skipped',
}
