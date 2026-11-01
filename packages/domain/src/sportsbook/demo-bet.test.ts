import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { derivedBalanceMinor } from '../ledger/balance';
import { InMemoryAuditSink } from '../audit/audit';
import { Ledger } from '../ledger/ledger';
import { InMemoryLedgerStore } from '../ledger/memory-store';
import { DemoWallet, holdAccount, walletAccount } from '../wallet/demo-wallet';
import {
  DemoBetError,
  DemoSportsbook,
  deterministicDemoOutcome,
  potentialPayoutMinor,
  reservationLines,
  settlementLines,
} from './demo-bet';
import { SportsbookBoundary } from './sportsbook';

const userId = '11111111-1111-4111-8111-111111111111';

function sportsbook(): { book: DemoSportsbook; ledger: Ledger } {
  const ledger = new Ledger(new InMemoryLedgerStore(new InMemoryAuditSink()));
  return { book: new DemoSportsbook(new SportsbookBoundary(ledger)), ledger };
}

describe('demo odds', () => {
  it('rounds half up', () => {
    expect(potentialPayoutMinor(1_000n, '1.91')).toBe(1_910n);
    expect(potentialPayoutMinor(1_000n, '2.00')).toBe(2_000n);
    expect(potentialPayoutMinor(101n, '1.50')).toBe(152n);
  });

  it('rejects odds and stakes outside the demo range', () => {
    expect(() => potentialPayoutMinor(100n, '1.00')).toThrow(DemoBetError);
    expect(() => potentialPayoutMinor(50n, '2.00')).toThrow(DemoBetError);
    expect(() => potentialPayoutMinor(50_001n, '2.00')).toThrow(DemoBetError);
  });
});

describe('demo bet journals', () => {
  it('reserves available units and settles a deterministic win without a balance column', async () => {
    const { book, ledger } = sportsbook();
    const wallet = new DemoWallet(ledger);
    await wallet.grant(userId);
    const stake = 1_000n;
    const selectionId = 'demo-win';
    expect(deterministicDemoOutcome(selectionId)).toBe('win');
    const payout = potentialPayoutMinor(stake, '2.00');
    await book.reserve({
      idempotencyKey: 'slip-win-01',
      userId,
      stakeMinor: stake,
      decimalOdds: '2.00',
      selectionId,
    });
    const held = await ledger.list();
    const lines = held.flatMap((journal) => journal.lines);
    expect(derivedBalanceMinor(lines, walletAccount(userId))).toBe(99_000n);
    expect(derivedBalanceMinor(lines, holdAccount(userId))).toBe(1_000n);

    await book.settle({
      idempotencyKey: 'slip-win-01',
      userId,
      stakeMinor: stake,
      decimalOdds: '2.00',
      selectionId,
      payoutMinor: payout,
    });
    const settled = (await ledger.list()).flatMap((journal) => journal.lines);
    expect(derivedBalanceMinor(settled, walletAccount(userId))).toBe(101_000n);
    expect(derivedBalanceMinor(settled, holdAccount(userId))).toBe(0n);
    expect(reservationLines(userId, stake)[0]?.direction).toBe('DEBIT');
    expect(settlementLines(userId, stake, payout)).toHaveLength(3);
  });

  it('keeps a loss in the house account and replays the same keys', async () => {
    const { book, ledger } = sportsbook();
    await new DemoWallet(ledger).grant(userId);
    const selectionId = 'demo-loss';
    expect(deterministicDemoOutcome(selectionId)).toBe('loss');
    const draft = {
      idempotencyKey: 'slip-loss-01',
      userId,
      stakeMinor: 2_000n,
      decimalOdds: '1.50',
      selectionId,
    };
    await book.reserve(draft);
    await book.settle({ ...draft, payoutMinor: 0n });
    await book.reserve(draft);
    await book.settle({ ...draft, payoutMinor: 0n });
    const lines = (await ledger.list()).flatMap((journal) => journal.lines);
    expect(derivedBalanceMinor(lines, walletAccount(userId))).toBe(98_000n);
    expect(derivedBalanceMinor(lines, holdAccount(userId))).toBe(0n);
    expect((await ledger.list()).length).toBe(3);
  });

  it('does not reach past the sportsbook boundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/sportsbook/demo-bet.ts'), 'utf8');
    const wallet = readFileSync(path.join(process.cwd(), 'src/wallet/demo-wallet.ts'), 'utf8');
    for (const file of [source, wallet]) {
      expect(file).not.toMatch(/prisma/i);
      expect(file).not.toMatch(/postAtomic/);
      expect(file).not.toMatch(/updateBalance/);
      expect(file).not.toMatch(/setBalance/);
      expect(file).not.toMatch(/simulated\s*:\s*false/);
    }
    expect(source).toContain('requestSimulatedSettlement');
    expect(wallet).toContain('this.ledger.post');
    expect(wallet).toContain('simulated: true');
  });
});
