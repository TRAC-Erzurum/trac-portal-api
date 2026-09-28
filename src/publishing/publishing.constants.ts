/** Injection token for the clock the publishing module reads the time from. */
export const PUBLISHING_CLOCK = 'PUBLISHING_CLOCK';
export type PublishingClock = () => Date;

/** First retry delay; doubles per failed attempt. */
export const RETRY_BASE_MS = 60 * 1000;
/** Retry delay never grows past this. */
export const RETRY_CAP_MS = 60 * 60 * 1000;
/** How often the worker looks for due rows. */
export const DELIVERY_INTERVAL_MS = 15 * 1000;
/** Rows claimed per run. */
export const DELIVERY_BATCH_SIZE = 20;
/** Per-request timeout. */
export const DELIVERY_TIMEOUT_MS = 10 * 1000;
/**
 * A claimed row is pushed this far into the future so no other instance
 * picks it up while it is being sent. Longer than a full batch of timeouts.
 */
export const CLAIM_LEASE_MS = 10 * 60 * 1000;
