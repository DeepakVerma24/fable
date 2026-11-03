# Phase 7: financial integrity and durable simulated operations

Baseline: main `8d393f9`. Branch: `codex/phase-7-financial-integrity`.

## Root causes and changes

The original deferred balance trigger ran only when a journal header was inserted. Existing journals accepted additional entries. The new migration seals historical headers and requires new entries to share the header's full PostgreSQL transaction ID. Entries lock their account row and must match its immutable currency. Deferred wallet checks reject negative liabilities; update/delete/truncate guards protect history. No balance column or direct balance update was added.

PostgreSQL bet operations use serializable transactions, a per-player transaction advisory lock, and ordered account advisory locks. The player lock serializes distinct requests and keys across API instances; account locks cover ledger writers outside the bet service too. Serialization failures, deadlocks, and unique creation races retry the entire aborted transaction with bounded backoff. Other failures and retry exhaustion propagate. Transactions contain no external provider effects.

`DemoBetOperations` is shared domain orchestration. `PrismaBetStore` commits the bet record, reservations, settlements, and audit events together. `BetService` translates domain errors into HTTP errors. Accepted bets persist immutable terms and deterministic demo outcome. Internal transitions implement accepted -> settled/cancelled and settled -> refunded. Duplicate terminal transitions replay; incompatible transitions fail. Refunds reverse the original two journals through the ledger. A refund that would overdraw spent winnings fails and rolls back; no silent forced debit is permitted.

The existing HTTP placement remains immediate simulated settlement. Internal accepted holds can be recovered after restart with the stored user/key and `transition`; repeat settlement/cancellation is idempotent. No new wagering product, game, payment provider, operator mutation endpoint, or UI redesign was added.

Bet keys are durable and unique on `(user_id, idempotency_key)`. The fingerprint includes selection and integer stake. Matching requests return the committed original record, including original timestamp and odds. A separate immutable placement snapshot preserves that response even after the current lifecycle state changes. Changed payloads return conflict. Ledger keys include the player, eliminating cross-player collisions. Journal payload comparison treats lines as a multiset, so historical SQL row order cannot break retries. Existing pre-Phase-7 bet metadata was never persisted and cannot be reconstructed reliably; do not automatically synthesize or replay old bet operations during cutover. Existing journal rows remain sealed and balances are preserved.

## Database migration

`packages/database/prisma/migrations/20261103020000_financial_integrity/migration.sql` adds journal sealing, entry positions, currency/funds enforcement, immutable accounts, truncate guards, durable bet records, and SQL lifecycle validation. Prisma represents the transaction ID as `Unsupported("xid8")` with a database default. SQL-only triggers and the partial position index must be preserved in future migrations.

The migration is atomic and refuses pre-existing unbalanced journals, account-currency mismatches, or negative wallets. The regression suite corrupts an old journal using the original weakness, verifies migration refusal without partial schema changes, appends a balancing correction, and then applies the migration.

Take and restore-test a backup before any production migration. This phase did not deploy or apply changes to an external database. The test suite verifies a populated historical journal before the new migration and verifies that it is sealed afterward. Roll forward with corrective migrations rather than dropping ledger guards.

## Verification commands

Use Node 22 and pnpm 10.33.4:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

For actual PostgreSQL checks, provide an **empty dedicated disposable database** using `FABLE_POSTGRES_TEST_URL`. Tests refuse a database with an existing users table, apply the committed migrations themselves, and leave evidence in that database. Never point this variable at production. Do not pass it to the ordinary API runtime as a production connection string.

```sh
pnpm build:packages
pnpm --filter @fable/database test
pnpm --filter @fable/api build
pnpm test:financial:api
```

The first database command runs journal, concurrency, lifecycle, actual deadlock, and injected-failure tests. The last command starts two separate compiled API processes against that migrated database, checks simultaneous spending and request replay across them, and shuts them down. Ordinary unit runs skip the PostgreSQL suite when no test URL is provided; that skip is never a financial verification pass.

CI adds a PostgreSQL 17 service job and a Windows job. Existing Linux verification remains. Test scripts no longer use Unix-only environment assignments. Git attributes establish LF checkouts and Prettier tolerates already-existing CRLF files. Browser tests have a 60-second test budget and a 15-second cold-route assertion budget, based on the audited betting case taking 40.5 seconds; this is a test budget adjustment, not a product performance guarantee. Test web servers opt out of persistent compiler caches using `FABLE_DISABLE_COMPILER_CACHE=1`; normal cache defaults remain enabled. Do not rebuild shared packages while browser test servers are running.

## Remaining boundaries

- The memory fallback is a local demo convenience and does not provide transactional durability. Production startup requires PostgreSQL. Financial acceptance is based on the real database and two-process tests, not that fallback.
- Existing large ledger reads remain unbounded; account-scoped reads/indexing are still necessary for production-scale throughput.
- Recovery transitions are internal operations, not a scheduled worker or exposed operator endpoint. A future operational policy must decide when an accepted hold is settled or cancelled. Phase 8 has not started.
- Database owner/superuser access can disable triggers; production needs a separate least-privilege runtime role and controlled migration credentials.
- Dependency review found the latest `@fastify/static` still depending on glob 13 and the latest deepmerge still at 4.3.1. Glob/minimatch advisory remediation requires major-version compatibility validation, and deepmerge has no published fixed release. No speculative global overrides were applied. Record current scan results in the verification delivery; these advisories remain a release risk.
- Local PostgreSQL verification uses PostgreSQL 18.6 on Windows. PostgreSQL 17/Linux and Windows CI jobs are configured but their remote outcomes must be checked after push. No Linux execution is claimed from this Windows host.
- Real-money rejection remains in domain validation, SQL checks, API configuration, and UI. No deployment or automatic merge is authorized by this implementation.

## Changed files and review map

- Ledger database enforcement: `packages/database/prisma/migrations/20261103020000_financial_integrity/migration.sql`, `packages/database/prisma/schema.prisma`, `packages/database/src/prisma-ledger-store.ts`.
- Durable operation boundary: `packages/database/src/prisma-bet-store.ts`, `packages/domain/src/sportsbook/bet-store.ts`, `packages/domain/src/sportsbook/bet-operations.ts`, and the domain/database export indexes.
- API composition: `apps/api/src/player/player.module.ts`, `apps/api/src/sports/bet.service.ts`, `apps/api/src/sports/bet.controller.ts`, `apps/api/src/sports/memory-bet-store.ts`.
- Scoped financial keys and order-independent replay: `packages/domain/src/sportsbook/demo-bet.ts`, `packages/domain/src/ledger/validate.ts`, `packages/domain/src/ledger/ledger.test.ts`.
- Real PostgreSQL and multi-process regressions: `packages/database/src/financial.postgres.test.ts`, `scripts/financial-api-integration.mjs`.
- Pending client operation identity: `apps/web/src/lib/bet-slip.ts`, `apps/web/src/lib/bet-slip.test.ts`, `apps/web/src/components/bet-slip.tsx`, `apps/web/e2e/foundation.spec.ts`. The slip retains one shared in-memory operation key for unchanged pending terms across request failures and responsive component changes. Success/removal clears it; changed terms generate a new key. Full browser reload still clears local slip state; the durable server bet history remains authoritative.
- Check portability and bounded test resources: `.gitattributes`, `.prettierrc.json`, `.gitignore`, `.prettierignore`, root and application/package test scripts, `.github/workflows/ci.yml`, `apps/web/playwright.config.ts`, `apps/web/next.config.ts`.
- Handover: `docs/architecture.md`, `docs/financial-safety.md`, this document, and the Phase 7 verification report.

No dependency version or lockfile change was made. Local tool binaries, test databases, logs, and earlier audit evidence are ignored and excluded from the proposed change. Browser-generated historical screenshots/timing are restored after verification.

## Pull request summary

Suggested title: **Seal ledger journals and make simulated bet operations durable**.

Seal committed journals at the database boundary and make wallet spending safe across API instances. Commit simulated bet state, journal entries, and audit events in one serializable transaction with bounded deadlock/conflict retries. Persist player-scoped payload-checked idempotency and immutable placement responses, and retain client request IDs across uncertain responses. Add internal settlement/cancellation/refund transitions, real PostgreSQL rollback/concurrency tests, a two-process API regression, and Linux/PostgreSQL plus Windows CI jobs.

Validation outcomes and remaining release risks are recorded in `docs/phase-7-verification.md`. Real-money operations remain disabled. No deployment, merge, or Phase 8 work was performed. The implementation is prepared on the local feature branch; this summary does not claim that a remote pull request or remote CI run exists.
