import type { JournalLine, PostedJournal } from '../ledger/types';
import { SportsbookBoundary } from './sportsbook';
import {
  DEMO_CURRENCY,
  DEMO_STAKE_MAX_MINOR,
  DEMO_STAKE_MIN_MINOR,
  HOUSE_SPORTSBOOK,
  holdAccount,
  walletAccount,
} from '../wallet/demo-wallet';

export class DemoBetError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DemoBetError';
    this.code = code;
  }
}

const ODDS_PATTERN = /^([1-9]\d{0,2})\.(\d{2})$/;

/** Decimal odds scaled by 100. 1.91 becomes 191. */
export function oddsScaled(decimalOdds: string): bigint {
  const match = ODDS_PATTERN.exec(decimalOdds);
  if (!match?.[1] || !match[2]) {
    throw new DemoBetError('odds', 'Decimal odds must look like 1.91.');
  }
  const scaled = BigInt(match[1]) * 100n + BigInt(match[2]);
  if (scaled <= 100n || scaled > 10_000n) {
    throw new DemoBetError('odds', 'Decimal odds must be greater than 1.00 and at most 100.00.');
  }
  return scaled;
}

/** Potential return including stake, rounded half up to minor units. */
export function potentialPayoutMinor(stakeMinor: bigint, decimalOdds: string): bigint {
  assertStake(stakeMinor);
  const scaled = oddsScaled(decimalOdds);
  return (stakeMinor * scaled + 50n) / 100n;
}

export function assertStake(stakeMinor: bigint): void {
  if (typeof stakeMinor !== 'bigint' || stakeMinor <= 0n) {
    throw new DemoBetError('stake', 'Stake must be a positive whole number of minor units.');
  }
  if (stakeMinor < DEMO_STAKE_MIN_MINOR || stakeMinor > DEMO_STAKE_MAX_MINOR) {
    throw new DemoBetError('stake', 'Demo stake must be between 1.00 and 500.00 FBU.');
  }
}

/**
 * Even character-code sum wins. The rule is fixed so tests and replays agree.
 * It is not a sports result and not a random draw.
 */
export function deterministicDemoOutcome(selectionId: string): 'win' | 'loss' {
  let sum = 0;
  for (const char of selectionId) sum += char.charCodeAt(0);
  return sum % 2 === 0 ? 'win' : 'loss';
}

export function reservationLines(userId: string, stakeMinor: bigint): readonly JournalLine[] {
  assertStake(stakeMinor);
  return [
    {
      accountCode: walletAccount(userId),
      direction: 'DEBIT',
      amountMinor: stakeMinor,
      currency: DEMO_CURRENCY,
    },
    {
      accountCode: holdAccount(userId),
      direction: 'CREDIT',
      amountMinor: stakeMinor,
      currency: DEMO_CURRENCY,
    },
  ];
}

/**
 * Release a reservation.
 * A win credits the full payout (stake plus profit) and debits the house for the profit.
 * A loss moves the held stake to the house. The player's available wallet is not credited.
 */
export function settlementLines(
  userId: string,
  stakeMinor: bigint,
  payoutMinor: bigint,
): readonly JournalLine[] {
  assertStake(stakeMinor);
  if (payoutMinor < 0n) {
    throw new DemoBetError('payout', 'Payout cannot be negative.');
  }
  if (payoutMinor === 0n) {
    return [
      {
        accountCode: holdAccount(userId),
        direction: 'DEBIT',
        amountMinor: stakeMinor,
        currency: DEMO_CURRENCY,
      },
      {
        accountCode: HOUSE_SPORTSBOOK,
        direction: 'CREDIT',
        amountMinor: stakeMinor,
        currency: DEMO_CURRENCY,
      },
    ];
  }
  if (payoutMinor === stakeMinor) {
    return [
      {
        accountCode: holdAccount(userId),
        direction: 'DEBIT',
        amountMinor: stakeMinor,
        currency: DEMO_CURRENCY,
      },
      {
        accountCode: walletAccount(userId),
        direction: 'CREDIT',
        amountMinor: stakeMinor,
        currency: DEMO_CURRENCY,
      },
    ];
  }
  if (payoutMinor > stakeMinor) {
    const profit = payoutMinor - stakeMinor;
    return [
      {
        accountCode: holdAccount(userId),
        direction: 'DEBIT',
        amountMinor: stakeMinor,
        currency: DEMO_CURRENCY,
      },
      {
        accountCode: HOUSE_SPORTSBOOK,
        direction: 'DEBIT',
        amountMinor: profit,
        currency: DEMO_CURRENCY,
      },
      {
        accountCode: walletAccount(userId),
        direction: 'CREDIT',
        amountMinor: payoutMinor,
        currency: DEMO_CURRENCY,
      },
    ];
  }
  const kept = stakeMinor - payoutMinor;
  return [
    {
      accountCode: holdAccount(userId),
      direction: 'DEBIT',
      amountMinor: stakeMinor,
      currency: DEMO_CURRENCY,
    },
    {
      accountCode: walletAccount(userId),
      direction: 'CREDIT',
      amountMinor: payoutMinor,
      currency: DEMO_CURRENCY,
    },
    {
      accountCode: HOUSE_SPORTSBOOK,
      direction: 'CREDIT',
      amountMinor: kept,
      currency: DEMO_CURRENCY,
    },
  ];
}

export interface DemoBetDraft {
  idempotencyKey: string;
  userId: string;
  stakeMinor: bigint;
  decimalOdds: string;
  selectionId: string;
}

/**
 * Sportsbook demo service.
 * Reservation and settlement are journals handed to SportsbookBoundary.
 * This class does not touch a database and does not set a balance.
 */
export class DemoSportsbook {
  constructor(private readonly sportsbook: SportsbookBoundary) {}

  reserve(input: DemoBetDraft): Promise<PostedJournal> {
    return this.sportsbook.requestSimulatedSettlement({
      idempotencyKey: `bet-rsv-${input.userId}-${input.idempotencyKey}`,
      actorId: input.userId,
      lines: reservationLines(input.userId, input.stakeMinor),
    });
  }

  settle(input: DemoBetDraft & { payoutMinor: bigint }): Promise<PostedJournal> {
    return this.sportsbook.requestSimulatedSettlement({
      idempotencyKey: `bet-stl-${input.userId}-${input.idempotencyKey}`,
      actorId: input.userId,
      lines: settlementLines(input.userId, input.stakeMinor, input.payoutMinor),
    });
  }
}
