export enum PublicationStatus {
  /** Waiting for its next attempt (never tried, retrying, or held). */
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  /** Refused permanently by the target (400 or 422); never retried. */
  FAILED = 'FAILED',
}
