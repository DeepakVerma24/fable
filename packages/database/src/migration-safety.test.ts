import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('ledger migration', () => {
  const sql = readFileSync(
    path.join(process.cwd(), 'prisma/migrations/20261101120000_init/migration.sql'),
    'utf8',
  );

  it('does not store a mutable balance column', () => {
    expect(sql).not.toMatch(/"balance"/i);
    expect(sql).not.toMatch(/\bbalance\s+(bigint|numeric|integer|int|decimal|text)/i);
  });

  it('locks journals to simulated, positive, balanced, append-only rows', () => {
    expect(sql).toContain('ledger_transactions_simulated_only');
    expect(sql).toContain('CHECK ("simulated" = true)');
    expect(sql).toContain('ledger_entries_amount_positive');
    expect(sql).toContain('ledger_entries_append_only');
    expect(sql).toContain('ledger_transactions_must_balance');
    expect(sql).toContain('audit_log_append_only');
    expect(sql).toContain('idempotency_key');
  });
});
