# Phase 7 verification and delivery

Date: 3 November 2026 (Asia/Calcutta). Baseline: `8d393f991531d97a113198a17449457535bd5ecb`. Feature branch: `codex/phase-7-financial-integrity`.

## Verified local results

Runtime: Node 22.23.4, pnpm 10.33.4, Windows. PostgreSQL reported `PostgreSQL 18.6 on x86_64-windows, compiled by msvc-19.44.35228, 64-bit`. It was an actual isolated server bound to loopback, not an in-memory database substitute. Its disposable binaries/databases were removed after clean shutdown; source and logs remain.

- `pnpm install --frozen-lockfile`: exit 0. No dependency or lockfile version changed.
- `pnpm lint`: exit 0; ESLint and full Prettier check passed. Log: `phase7-delivery-lint.log`.
- `pnpm typecheck`: exit 0 across all applications/packages, including generated Prisma Client. Log: `phase7-delivery-typecheck.log`.
- `pnpm test`: exit 0; **43 passed, 10 skipped**. Domain 15, web 10, observability 3, database static checks 2, worker 2, API 11 passed. Nine PostgreSQL cases are deliberately skipped without a dedicated test URL, plus the existing one-case Testcontainers placeholder. Those skips are not financial verification. Log: `phase7-delivery-test.log`.
- Real PostgreSQL package run with `FABLE_POSTGRES_TEST_URL` set: exit 0; **9 actual database cases and 2 existing static migration checks passed**, no skips. Log: `phase7-postgres-final.log`.
- `pnpm db:migrate` against a fresh dedicated database: exit 0; all three committed migrations applied, including the final Phase 7 migration. Log: `phase7-migration-acceptance.log`.
- `pnpm test:financial:api` against that migrated PostgreSQL instance: exit 0. **Two separate API OS processes** shared the database. Three concurrent 500.00-unit losing requests committed exactly two bets and rejected one, leaving the wallet at zero. Concurrent duplicates returned the same result; changed payload returned 409. Log: `phase7-two-api-acceptance.log`.
- `pnpm build`: exit 0; shared packages, Nest API, worker, Next.js production build, and Storybook completed. `FABLE_DISABLE_COMPILER_CACHE=1` was used to avoid unnecessary persistent-cache writes on the space-constrained host. This changes cache persistence, not application behavior or money mode. Log: `phase7-delivery-build.log`.
- `pnpm test:e2e`: exit 0; **6 passed in 2.1 minutes**. Existing discovery/auth/wallet/mobile/screenshot cases passed; the betting case took 35.1 seconds. The new case committed a bet through the real local API, deliberately dropped the response, retried with the same operation ID, and verified one economic result and a 1,032.00 FBU wallet. That case took 12.1 seconds. Log: `phase7-delivery-test-e2e.log`.
- `pnpm audit --prod --json`: exit 1; **1 low, 3 moderate, 0 high, 0 critical** reported across three advisory IDs. Evidence: `phase7-dependency-audit.json`. This remains a release risk, not a passed security gate.

## Financial regression coverage

The real PostgreSQL suite verifies:

1. A historical journal can be corrupted using the old append weakness; the new migration refuses it without partial schema changes. A balancing correction permits the migration, after which later inserts are rejected.
2. Committed journal sealing, account immutability, and unbalanced-journal rollback.
3. Balanced debit/credit journals cannot overdraw a player wallet at the database boundary.
4. Independent database clients cannot concurrently overspend the same wallet.
5. Concurrent identical placement keys replay durably; distinct players can use the same key; changed terms are rejected; a new service instance reads the persisted bet.
6. An immutable original placement response survives later lifecycle changes, including refund.
7. Duplicate settlement/refund transitions do not duplicate entries; cancellation releases a hold; invalid terminal transitions fail.
8. Injected ledger-audit and bet-state-audit failures roll back funds and metadata. Accepted holds survive failed settlement and can be retried successfully.
9. A real PostgreSQL deadlock aborts one transaction; bounded retry commits exactly the intended effects without duplicate audit rows.

The client adds three request-identity unit regressions and a lost-committed-response browser regression. The ledger adds a regression for equivalent line order on idempotent replay.

## Earlier failures and their resolution

Initial real-database runs exposed Prisma's inability to decode a `void` advisory-lock result and driver-wrapped serialization codes. Queries now return a supported scalar and retry classification inspects the SQL state. The suite was rerun successfully after correction.

Earlier browser attempts encountered insufficient disk space and API restarts while shared packages were being rebuilt. Owned generated caches were removed, test web servers disable persistent compiler caching, and verification runs builds before browsers sequentially. Test budgets are now 60 seconds per case and 15 seconds for cold-route assertions. Earlier failed logs are retained; they are not counted as passes. The final six-case run passed.

## Remaining risks and release gates

- Remote Linux/Windows/PostgreSQL 17 CI results must be checked separately; local Windows/PostgreSQL 18.6 results do not establish remote CI success.
- The three dependency advisory IDs remain: `GHSA-gcqx-w48m-w2h4`, `GHSA-g3hv-75wg-m249`, and `GHSA-3g3m-2fjr-6pw4`. Latest direct consumer `@fastify/static` still selects glob 13; deepmerge's latest release is still 4.3.1. No compatible published direct-consumer update or deepmerge fix was found. Forcing newer glob/minimatch major versions globally, particularly through legacy ESLint consumers, requires a separately validated compatibility change.
- Production needs least-privilege database roles, backup/restore and operational review. Database owners/superusers can disable database guards. No production credentials or infrastructure were changed.
- Unbounded ledger reads and common house-account locks can limit throughput and cause retries under high contention. No throughput or failover certification is claimed.
- The memory fallback is a local demo convenience; PostgreSQL is required for production and for the financial guarantees in this report.
- Recovery transitions are durable/internal but are not a scheduled settlement worker or operator UI. Recovery policy and an authorized operator surface remain future work. A refund cannot force a negative wallet after winnings have been spent; it fails atomically for operational handling.
- A full browser reload clears local pending-slip state. Durable server history remains available; clients must preserve operation identity when retrying uncertain requests rather than submit a new key for the same intent.
- Existing container deployment defects, provider integrations, regulatory controls, and real-money readiness remain outside this phase. Nothing was deployed or merged. Phase 8 has not started.

## Review summary

Root causes, implementation contracts, migration details, changed-file map, and the pull request summary are in [Phase 7 financial integrity](phase-7-financial-integrity.md). Financial balances remain derived solely from immutable ledger entries. Real-money posting remains disabled in code and SQL.
