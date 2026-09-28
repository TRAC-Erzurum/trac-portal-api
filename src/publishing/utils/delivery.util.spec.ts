import { retryDelayMs, signDelivery } from './delivery.util';

describe('signDelivery', () => {
  it('is HMAC-SHA256 over `${timestamp}.${rawBody}` in the sha256=<hex> form', () => {
    // Expected value computed independently:
    //   printf '1790000000.{"a":1}' | openssl dgst -sha256 -hmac secret
    expect(signDelivery('secret', 1790000000, '{"a":1}')).toBe(
      'sha256=da8fe498621aaab99d5b11c51346b13d1a2bf2914b865b8d3edd3531cab25a3e',
    );
  });
});

describe('retryDelayMs', () => {
  it.each([
    [1, 60_000],
    [2, 120_000],
    [3, 240_000],
    [6, 1_920_000],
    [7, 3_600_000],
    [50, 3_600_000],
  ])('after %i failed attempts waits %i ms', (attempts, expected) => {
    expect(retryDelayMs(attempts)).toBe(expected);
  });
});
