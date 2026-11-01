import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { InMemoryAuditSink } from '../audit/audit';
import { CasinoBoundary } from '../casino/casino';
import { derivedBalanceMinor } from './balance';
import { Ledger } from './ledger';
import { InMemoryLedgerStore } from './memory-store';
import { LedgerError, type JournalDraft } from './types';
import { SportsbookBoundary } from '../sportsbook/sportsbook';
import { MockGameProvider } from '../providers/provider';

const balanced: JournalDraft = {
  idempotencyKey: 'casino-round-1001',
  kind: 'SIMULATED_ADJUSTMENT',
  simulated: true,
  actorId: 'operator-1',
  lines: [
    { accountCode: 'wallet.player_1', direction: 'CREDIT', amountMinor: 250n, currency: 'USD' },
    { accountCode: 'house.simulated', direction: 'DEBIT', amountMinor: 250n, currency: 'USD' },
  ],
};

function ledgerWithAudit(): { ledger: Ledger; audit: InMemoryAuditSink } {
  const audit = new InMemoryAuditSink();
  return { ledger: new Ledger(new InMemoryLedgerStore(audit)), audit };
}

describe('ledger', () => {
  it('posts a balanced simulated journal and one audit record', async () => {
    const { ledger, audit } = ledgerWithAudit();
    const posted = await ledger.post(balanced);
    expect(posted.simulated).toBe(true);
    expect(posted.lines).toHaveLength(2);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe('ledger.journal_posted');
    expect(derivedBalanceMinor(posted.lines, 'wallet.player_1')).toBe(250n);
    expect(derivedBalanceMinor(posted.lines, 'house.simulated')).toBe(250n);
  });

  it('replays the same idempotency key without a second audit record', async () => {
    const { ledger, audit } = ledgerWithAudit();
    const first = await ledger.post(balanced);
    const second = await ledger.post(balanced);
    expect(second.id).toBe(first.id);
    expect(audit.events).toHaveLength(1);
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    const { ledger } = ledgerWithAudit();
    await ledger.post(balanced);
    const other: JournalDraft = {
      ...balanced,
      lines: [
        { accountCode: 'wallet.player_1', direction: 'CREDIT', amountMinor: 100n, currency: 'USD' },
        { accountCode: 'house.simulated', direction: 'DEBIT', amountMinor: 100n, currency: 'USD' },
      ],
    };
    await expect(ledger.post(other)).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('serializes concurrent posts of the same key', async () => {
    const { ledger, audit } = ledgerWithAudit();
    const [first, second] = await Promise.all([ledger.post(balanced), ledger.post(balanced)]);
    expect(first.id).toBe(second.id);
    expect(audit.events).toHaveLength(1);
  });

  it('rolls the journal back when the audit record fails', async () => {
    let fail = true;
    const audit = new InMemoryAuditSink();
    const sink = {
      async record(event: Parameters<InMemoryAuditSink['record']>[0]) {
        if (fail) throw new Error('audit unavailable');
        await audit.record(event);
      },
    };
    const ledger = new Ledger(new InMemoryLedgerStore(sink));
    await expect(ledger.post(balanced)).rejects.toThrow('audit unavailable');
    fail = false;
    const posted = await ledger.post(balanced);
    expect(posted.simulated).toBe(true);
    expect(audit.events).toHaveLength(1);
  });

  it('rejects real-money, unbalanced, and non-bigint amounts', async () => {
    const { ledger } = ledgerWithAudit();
    await expect(ledger.post({ ...balanced, simulated: false })).rejects.toMatchObject({
      code: 'real_money_disabled',
    });
    await expect(
      ledger.post({
        ...balanced,
        idempotencyKey: 'unbalanced-key',
        lines: [
          {
            accountCode: 'wallet.player_1',
            direction: 'CREDIT',
            amountMinor: 10n,
            currency: 'USD',
          },
          { accountCode: 'house.simulated', direction: 'DEBIT', amountMinor: 9n, currency: 'USD' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'unbalanced' });
    await expect(
      ledger.post({
        ...balanced,
        idempotencyKey: 'bad-amount-key',
        lines: [
          {
            accountCode: 'wallet.player_1',
            direction: 'CREDIT',
            amountMinor: 10 as unknown as bigint,
            currency: 'USD',
          },
          { accountCode: 'house.simulated', direction: 'DEBIT', amountMinor: 10n, currency: 'USD' },
        ],
      }),
    ).rejects.toBeInstanceOf(LedgerError);
  });

  it('lets casino and sportsbook submit only simulated journals', async () => {
    const { ledger, audit } = ledgerWithAudit();
    const casino = new CasinoBoundary(ledger);
    const posted = await casino.requestSimulatedSettlement({
      idempotencyKey: 'casino-settle-01',
      lines: balanced.lines,
    });
    expect(posted.kind).toBe('SIMULATED_CASINO_SETTLEMENT');
    const sportsbook = new SportsbookBoundary(ledger);
    const ticket = await sportsbook.requestSimulatedSettlement({
      idempotencyKey: 'sports-settle-01',
      lines: balanced.lines,
      actorId: 'operator-2',
    });
    expect(ticket.kind).toBe('SIMULATED_SPORTSBOOK_SETTLEMENT');
    expect(audit.events).toHaveLength(2);
  });
});

describe('module source boundaries', () => {
  const forbidden = [
    /prisma/i,
    /InMemoryLedgerStore/,
    /postAtomic/,
    /updateBalance/,
    /setBalance/,
    /simulated\s*:\s*false/,
  ];

  it('keeps casino and sportsbook away from balance writes', () => {
    for (const relative of ['src/casino/casino.ts', 'src/sportsbook/sportsbook.ts']) {
      const source = readFileSync(path.join(process.cwd(), relative), 'utf8');
      for (const pattern of forbidden) {
        expect(source, `${relative} matches ${pattern}`).not.toMatch(pattern);
      }
      expect(source).toContain('simulated: true');
      expect(source).toContain('this.ledger.post');
    }
  });

  it('serves provider data only from the mock adapter', async () => {
    const provider = new MockGameProvider('mock-games');
    await expect(provider.fetchRound('round-1')).resolves.toEqual({
      id: 'round-1',
      provider: 'mock-games',
      simulated: true,
    });
    expect(provider.mode).toBe('mock');
  });
});
