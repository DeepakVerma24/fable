export type LedgerAccountTypeName = 'USER_WALLET' | 'HOUSE' | 'PROVIDER_CLEARING' | 'SYSTEM';

/**
 * Account codes are namespaced so the ledger can classify them.
 * Casino and sportsbook pass codes. They do not insert account rows.
 *
 * Customer wallets are credit-normal liabilities: a credit increases what
 * the house owes the customer. House accounts are debit-normal.
 */
export function accountTypeForCode(code: string): LedgerAccountTypeName {
  if (code.startsWith('wallet.')) return 'USER_WALLET';
  if (code.startsWith('house.')) return 'HOUSE';
  if (code.startsWith('provider.')) return 'PROVIDER_CLEARING';
  return 'SYSTEM';
}

export function normalSideForAccount(type: LedgerAccountTypeName): 'debit' | 'credit' {
  if (type === 'USER_WALLET' || type === 'PROVIDER_CLEARING') return 'credit';
  return 'debit';
}
