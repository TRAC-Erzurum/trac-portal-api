/** What a response (or its absence) means for the row. One attempt, one verdict. */
export type DeliveryOutcome = 'delivered' | 'failed';

/** `null` status means a network failure or timeout. */
export function classifyResponse(status: number | null): DeliveryOutcome {
  return status === 200 || status === 201 ? 'delivered' : 'failed';
}
