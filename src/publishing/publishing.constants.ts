/** Injection token for the clock the publishing module reads the time from. */
export const PUBLISHING_CLOCK = 'PUBLISHING_CLOCK';
export type PublishingClock = () => Date;

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

/**
 * A new observation waits this long before its first attempt: its photos are
 * uploaded in a request of their own right after it, and a record is a
 * snapshot at the target, so they must be in place when it is sent.
 */
export const PUBLISHING_PHOTO_GRACE_MS = 'PUBLISHING_PHOTO_GRACE_MS';
export const DEFAULT_PHOTO_GRACE_MS = 30 * 1000;
/** The target takes at most this many photos per record. */
export const MAX_PHOTOS_PER_RECORD = 5;
