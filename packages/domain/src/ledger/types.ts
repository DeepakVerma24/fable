export const JOURNAL_KINDS = [
  'SIMULATED_ADJUSTMENT',
  'SIMULATED_CASINO_SETTLEMENT',
  'SIMULATED_SPORTSBOOK_SETTLEMENT',
] as const;

export type JournalKind = (typeof JOURNAL_KINDS)[number];
export type LedgerDirection = 'DEBIT' | 'CREDIT';

export interface JournalLine {
  accountCode: string;
  direction: LedgerDirection;
  amountMinor: bigint;
  currency: string;
}

/**
 * Input accepted by the ledger. `simulated` is a boolean on purpose:
 * a caller that passes false is rejected at runtime. This foundation has
 * no switch that turns real-money posting on.
 */
export interface JournalDraft {
  idempotencyKey: string;
  kind: JournalKind;
  lines: readonly JournalLine[];
  simulated: boolean;
  actorId?: string;
}

const validatedBrand: unique symbol = Symbol('ValidatedJournal');

export interface ValidatedJournal {
  readonly idempotencyKey: string;
  readonly kind: JournalKind;
  readonly lines: readonly JournalLine[];
  readonly simulated: true;
  readonly actorId: string | null;
  readonly [validatedBrand]: true;
}

export interface PostedJournal {
  id: string;
  idempotencyKey: string;
  kind: JournalKind;
  simulated: true;
  lines: readonly JournalLine[];
  actorId: string | null;
}

export class LedgerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }
}

export function markValidated(
  journal: Omit<ValidatedJournal, typeof validatedBrand>,
): ValidatedJournal {
  return { ...journal, [validatedBrand]: true };
}
