import { describe, expect, it } from 'vitest';

import { clearRateLimits, hitRateLimit } from './rate-limit';

describe('rate limit', () => {
  it('blocks the call that crosses the window', () => {
    clearRateLimits();
    expect(hitRateLimit('login:a', 2, 1_000, 0)).toBe(true);
    expect(hitRateLimit('login:a', 2, 1_000, 10)).toBe(true);
    expect(hitRateLimit('login:a', 2, 1_000, 20)).toBe(false);
    expect(hitRateLimit('login:a', 2, 1_000, 1_001)).toBe(true);
  });
});
