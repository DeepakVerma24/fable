# Financial safety

This repository does not move real money. There is no cashier, no payment provider, and no flag that turns real-money posting on.

## The ledger is the only writer

Balance changes are journal lines. `Ledger.post` validates the draft and asks a `LedgerStore` to commit it. Casino and sportsbook construct a draft with `simulated: true` and hand it over. They do not receive a database client.

A journal is accepted only when all of the following hold:

- `simulated` is `true`. `false` raises `real_money_disabled`.
- The idempotency key is 8 to 128 safe characters.
- There are 2 to 32 lines, one currency, and positive `bigint` minor units.
- Debits equal credits.
- The kind is one of `SIMULATED_ADJUSTMENT`, `SIMULATED_CASINO_SETTLEMENT`, or `SIMULATED_SPORTSBOOK_SETTLEMENT`.

Customer wallets are credit-normal liabilities. A credit increases what the house owes the customer. House accounts are debit-normal. `derivedBalanceMinor` computes that from lines. Nothing stores the result.

## Idempotency and atomicity

The idempotency key is unique. Replaying the same key and the same lines returns the original journal and does not write a second audit record. The same key with different lines raises `idempotency_conflict`.

The in-memory store serializes commits. It writes the journal and the audit event, and deletes the journal if the audit throws. `PrismaLedgerStore` does both inserts in one `prisma.$transaction`. A unique-key race re-reads the winning row. The audit row is part of that transaction, so a journal is not durable without its audit record.

## The database refuses a second path

`ledger_accounts` has no balance column. The init migration also:

- checks `simulated = true` on every journal
- checks `amount_minor > 0`
- rejects `UPDATE` and `DELETE` on journals, lines, and the audit log
- defers a constraint trigger until commit and rejects a transaction whose lines are missing, mixed-currency, or unbalanced

Those statements live in SQL because Prisma's schema cannot express triggers. Do not regenerate the init migration in a way that drops them.

`loadEnv` returns `realMoney: false` even if the process environment contains `REAL_MONEY=true`. The web health panel shows the same flag from `GET /health`.

## Simulated balances and mock providers

Local and CI runs may omit Postgres. The in-memory store is still double-entry and still simulated. `MockGameProvider` returns a round id and `simulated: true`. It does not call a remote casino or sportsbook.

Account codes are namespaced (`wallet.`, `house.`, `provider.`, otherwise system). The Postgres store upserts those accounts inside the ledger transaction. Casino does not insert account rows.

Audit metadata is scalars only: strings, numbers, booleans, and null. Do not put tokens, passwords, or payment instruments in it.
