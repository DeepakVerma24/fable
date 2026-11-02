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

`loadEnv` returns `realMoney: false` even if the process environment contains `REAL_MONEY=true`. `GET /health` returns the same flag.

## Simulated balances and mock providers

Local and CI runs may omit Postgres. The in-memory store is still double-entry and still simulated. `MockGameProvider` returns a round id and `simulated: true`. It does not call a remote casino or sportsbook.

Account codes are namespaced (`wallet.`, `house.`, `provider.`, otherwise system). The Postgres store upserts those accounts inside the ledger transaction. Casino does not insert account rows.

## Demo units

The player wallet uses currency `FBU` (Fable demo units). A new directory entry receives one grant of `100000` minor units (1,000.00 FBU) from `house.demo` to `wallet.{userId}`. The idempotency key is `demo-grant-{userId}`, so login can call grant again without a second credit. The wallet response sets `withdrawable` and `realMoney` to false. The UI says the units cannot be withdrawn, deposited, or converted.

A demo bet is two journals, both `SIMULATED_SPORTSBOOK_SETTLEMENT` and `simulated: true`:

1. Reserve: debit the available wallet, credit `wallet.{userId}.hold` for the stake. Available falls and reserved rises. Net liability does not change.
2. Settle immediately in the same request. A win debits the hold and `house.sportsbook` and credits the available wallet for the full payout. A loss debits the hold and credits the house for the stake.

After that request, reserved is back to zero. The summary still derives reserved from the hold account. There is no open-bet balance left on the screen.

Stake is 100 to 50,000 minor units. Odds are two-decimal strings from 1.01 to 100.00. The server ignores the price the browser sent and quotes the fixture. Payout is `(stake * oddsScaled + 50) / 100`, half up. Win or loss is the parity of the selection id's character codes. That rule is written on the slip. It is not a sports result.

Client idempotency keys are 8 to 80 safe characters. The journals are `bet-rsv-{userId}-{key}` and `bet-stl-{userId}-{key}`. PostgreSQL uses serializable transactions and database transaction locks around funds checks and posting, including separate API instances. An immutable placement response and payload fingerprint provide durable replay. The process-memory fallback is only a local demo. See [Phase 7](phase-7-financial-integrity.md) for journal sealing, SQL nonnegative-wallet checks, atomic state transitions, recovery, and tested failure boundaries.

The API composition root is the only caller of `DemoWallet` and `DemoSportsbook`. Casino tiles are `playable: false`. Nothing in the web app assigns a balance.

Audit metadata is scalars only: strings, numbers, booleans, and null. Do not put tokens, passwords, or payment instruments in it.
