import { accountTypeForCode, normalSideForAccount } from './accounts';
import type { LedgerDirection } from './types';

export interface BalanceLine {
  accountCode: string;
  direction: LedgerDirection;
  amountMinor: bigint;
}

/**
 * Derive a balance from journal lines. Nothing persists this number.
 * There is no balance column to update.
 */
export function derivedBalanceMinor(lines: readonly BalanceLine[], accountCode: string): bigint {
  const normal = normalSideForAccount(accountTypeForCode(accountCode));
  let debit = 0n;
  let credit = 0n;
  for (const line of lines) {
    if (line.accountCode !== accountCode) continue;
    if (line.direction === 'DEBIT') debit += line.amountMinor;
    else credit += line.amountMinor;
  }
  return normal === 'debit' ? debit - credit : credit - debit;
}
