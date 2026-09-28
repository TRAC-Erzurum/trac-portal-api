import { createHmac } from 'crypto';
import { RETRY_BASE_MS, RETRY_CAP_MS } from '../publishing.constants';

/** `sha256=<hex>` HMAC-SHA256 over `${timestamp}.${rawBody}`, as the target verifies it. */
export function signDelivery(
  secret: string,
  timestampSeconds: number,
  rawBody: string,
): string {
  const hex = createHmac('sha256', secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest('hex');
  return `sha256=${hex}`;
}

/** Delay before the next attempt after `attempts` failed ones: 1 min, doubling, capped at 1 h. */
export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  if (exponent >= 30) return RETRY_CAP_MS;
  return Math.min(RETRY_BASE_MS * 2 ** exponent, RETRY_CAP_MS);
}

/** What a response (or its absence) means for the row, per the target contract. */
export type DeliveryOutcome =
  | 'delivered'
  | 'retry'
  | 'failed'
  | 'authentication-failed';

/** `null` status means a network failure or timeout. */
export function classifyResponse(status: number | null): DeliveryOutcome {
  if (status === null) return 'retry';
  if (status === 200 || status === 201) return 'delivered';
  if (status === 401) return 'authentication-failed';
  if (status === 409 || status >= 500) return 'retry';
  // 400, 422 and anything else the contract does not name as retryable.
  return 'failed';
}
