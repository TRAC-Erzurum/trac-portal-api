import { classifyResponse } from './delivery.util';

describe('classifyResponse', () => {
  it.each([
    [201, 'delivered'],
    [200, 'delivered'],
    [409, 'failed'],
    [429, 'failed'],
    [500, 'failed'],
    [503, 'failed'],
    [null, 'failed'],
    [401, 'failed'],
    [400, 'failed'],
    [422, 'failed'],
    [302, 'failed'],
    [403, 'failed'],
    [404, 'failed'],
  ])('%s -> %s', (status, expected) => {
    expect(classifyResponse(status)).toBe(expected);
  });
});
