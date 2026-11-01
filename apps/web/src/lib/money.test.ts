import { describe, expect, it } from 'vitest';

import { formatFbu, majorToMinor } from './money';

describe('demo money formatting', () => {
  it('formats signed minor units', () => {
    expect(formatFbu(100000n)).toBe('1,000.00 FBU');
    expect(formatFbu('-1000')).toBe('-10.00 FBU');
    expect(formatFbu(5n)).toBe('0.05 FBU');
  });

  it('parses a stake field', () => {
    expect(majorToMinor('10')).toBe(1000n);
    expect(majorToMinor('10.5')).toBe(1050n);
    expect(majorToMinor('10.50')).toBe(1050n);
    expect(majorToMinor('10.501')).toBeNull();
    expect(majorToMinor('')).toBeNull();
  });
});
