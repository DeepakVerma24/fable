import { Ledger } from '../ledger/ledger';
import type { JournalLine, PostedJournal } from '../ledger/types';

/** Demo currency. Three letters so it passes the ledger check. It is not withdrawable money. */
export const DEMO_CURRENCY = 'FBU';
export const DEMO_GRANT_MINOR = 100_000n;
export const DEMO_STAKE_MIN_MINOR = 100n;
export const DEMO_STAKE_MAX_MINOR = 50_000n;
export const HOUSE_DEMO = 'house.demo';
export const HOUSE_SPORTSBOOK = 'house.sportsbook';

export function walletAccount(userId: string): string {
  return `wallet.${userId.toLowerCase()}`;
}

export function holdAccount(userId: string): string {
  return `wallet.${userId.toLowerCase()}.hold`;
}

export function grantKey(userId: string): string {
  return `demo-grant-${userId.toLowerCase()}`;
}

export function grantLines(userId: string): readonly JournalLine[] {
  return [
    {
      accountCode: walletAccount(userId),
      direction: 'CREDIT',
      amountMinor: DEMO_GRANT_MINOR,
      currency: DEMO_CURRENCY,
    },
    {
      accountCode: HOUSE_DEMO,
      direction: 'DEBIT',
      amountMinor: DEMO_GRANT_MINOR,
      currency: DEMO_CURRENCY,
    },
  ];
}

/**
 * Opening demo balance.
 * Posts one simulated adjustment through the ledger. There is no balance column.
 */
export class DemoWallet {
  constructor(private readonly ledger: Ledger) {}

  grant(userId: string): Promise<PostedJournal> {
    return this.ledger.post({
      idempotencyKey: grantKey(userId),
      kind: 'SIMULATED_ADJUSTMENT',
      lines: grantLines(userId),
      simulated: true,
      actorId: userId,
    });
  }
}
