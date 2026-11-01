import { describe, expect, it } from 'vitest';

import { estimatedPayoutMinor } from './odds';

describe('estimated payout', () => {
  it('matches the ledger rounding', () => {
    expect(estimatedPayoutMinor(1_000n, '1.91')).toBe(1_910n);
    expect(estimatedPayoutMinor(1_000n, '2.00')).toBe(2_000n);
    expect(estimatedPayoutMinor(1_000n, '4.20')).toBe(4_200n);
    expect(estimatedPayoutMinor(101n, '1.50')).toBe(152n);
    expect(estimatedPayoutMinor(100n, '1.00')).toBeNull();
  });
});
