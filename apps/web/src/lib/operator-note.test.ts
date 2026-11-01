import { describe, expect, it } from 'vitest';

import { operatorNoteSchema } from './operator-note';

describe('operatorNoteSchema', () => {
  it('accepts a short operational note', () => {
    expect(operatorNoteSchema.parse({ note: 'Ledger stays simulated.' }).note).toBe(
      'Ledger stays simulated.',
    );
  });

  it('rejects an empty note', () => {
    expect(operatorNoteSchema.safeParse({ note: '   ' }).success).toBe(false);
  });
});
