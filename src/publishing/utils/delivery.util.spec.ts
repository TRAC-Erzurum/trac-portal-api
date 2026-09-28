import { classifyResponse, retryDelayMs, signDelivery } from './delivery.util';

describe('signDelivery', () => {
  it('is HMAC-SHA256 over `${timestamp}.${rawBody}` in the sha256=<hex> form', () => {
    // Expected value computed independently:
    //   printf '1790000000.{"a":1}' | openssl dgst -sha256 -hmac secret
    expect(signDelivery('secret', 1790000000, '{"a":1}')).toBe(
      'sha256=da8fe498621aaab99d5b11c51346b13d1a2bf2914b865b8d3edd3531cab25a3e',
    );
  });
});

describe('classifyResponse', () => {
  it.each([
    [201, 'delivered'],
    [200, 'delivered'],
    [409, 'retry'],
    [429, 'retry'],
    [500, 'retry'],
    [503, 'retry'],
    [null, 'retry'],
    [401, 'authentication-failed'],
    [400, 'failed'],
    [422, 'failed'],
    [302, 'failed'],
    [403, 'failed'],
    [404, 'failed'],
  ])('%s -> %s', (status, expected) => {
    expect(classifyResponse(status)).toBe(expected);
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
