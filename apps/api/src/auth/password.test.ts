import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the same password and rejects a different one', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored).not.toContain('correct horse');
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('wrong horse battery', stored)).toBe(false);
    expect(await verifyPassword('correct horse battery', 'not-a-hash')).toBe(false);
    const again = await hashPassword('correct horse battery');
    expect(again).not.toBe(stored);
  });
});
