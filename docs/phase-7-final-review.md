# Phase 7 final review — NO-GO

Reviewed 2026-11-03: PR [#1](https://github.com/DeepakVerma24/fable/pull/1), `codex/phase-7-financial-integrity`, commit `4469875af626cb30ef877c042654bea16c1439a7`, against main `8d393f991531d97a113198a17449457535bd5ecb`. GitHub comparison confirms one commit ahead, zero behind, 39 changed files. This is a fresh adversarial review of the implementation, not an independent external reviewer certification.

**Merge decision: NO-GO. Four P1 findings block the Phase 7 financial-integrity acceptance gate.** All four were reproduced on real PostgreSQL 18.6. Existing green CI does not cover them. No application code, migration, dependency version, or lockfile was changed during review. No merge, deployment, or Phase 8 work was performed. Real-money operations remain disabled.

## Blocking findings

### R1 — P1: an early constraint check permits a permanently unbalanced journal

Location: [migration entry guard, lines 24–38](C:/Users/hp/Documents/ChatGPT/fable/packages/database/prisma/migrations/20261103020000_financial_integrity/migration.sql:24). The original `ledger_transactions_must_balance` constraint trigger is still attached only to header insertion.

Reproduction: begin a transaction; insert a header and balanced pair; run `SET CONSTRAINTS ledger_transactions_must_balance IMMEDIATE`; append another wallet credit of 25; commit. The header check has already fired, and the new entry only checks the creating transaction ID and account currency. No balance check is scheduled for that entry. Commit succeeds with journal credits exceeding debits by 25.

This used an ordinary role granted table SELECT/INSERT/UPDATE permissions, without ownership, superuser privileges, trigger disabling, or schema mutation. The invariant failure is real; no current HTTP endpoint allows a player to issue this SQL. Cross-transaction sealing works, but same-transaction late insertion after early validation remains unsafe.

Required fix: make every entry insertion schedule validation of its journal, or otherwise enforce a posting protocol that cannot accept entries after its last balance check. Preserve both empty-header rejection and committed-journal sealing. Add a real PostgreSQL regression that validates early and then attempts another entry, including toggling constraint modes.

### R2 — P1: row locks do not enforce nonnegative wallets at REPEATABLE READ

Location: [account row lock](C:/Users/hp/Documents/ChatGPT/fable/packages/database/prisma/migrations/20261103020000_financial_integrity/migration.sql:31) and [deferred balance check](C:/Users/hp/Documents/ChatGPT/fable/packages/database/prisma/migrations/20261103020000_financial_integrity/migration.sql:41).

Reproduction: fund a wallet with 100. Open two REPEATABLE READ transactions and establish both snapshots. Each writes a balanced journal spending 80. The second waits for the first's account row lock. After the first commits, the second acquires that lock, but its snapshot still excludes the first's entries. Each deferred check sees a nonnegative balance in its own snapshot. Both commit; the actual wallet is **−60**.

Control tests using the same competing-spend pattern: READ COMMITTED rejects one transaction with SQLSTATE `P0001`; SERIALIZABLE rejects one with `40001`; both leave the wallet at 20. The new `PrismaBetStore.execute` and `PrismaLedgerStore.postAtomic` explicitly use SERIALIZABLE, and their concurrent API tests passed. This finding concerns the claimed database-enforced guarantee and any alternate/raw writer or caller of the newly public transaction-scoped `write` method. It is not a demonstrated overdraft through the current bet API.

Required fix: enforce the supported isolation contract at the database write boundary, or implement concurrency control that remains safe under every permitted isolation level. A default isolation setting alone does not prevent clients selecting REPEATABLE READ. Do not introduce a mutable balance authority. Add direct-SQL isolation regressions alongside API tests.

### R3 — P1: migration preflight can miss concurrent historical corruption

Location: [migration preflight and first ALTER](C:/Users/hp/Documents/ChatGPT/fable/packages/database/prisma/migrations/20261103020000_financial_integrity/migration.sql:1).

The historical validation queries run before the DDL locks that prevent writes. An explicit transaction makes the migration atomic, but does not make these separate statements examine one protected historical state.

Reproduction against the first two migrations: create a balanced historical journal; hold an ACCESS SHARE lock on `ledger_transactions` in another connection; start Phase 7 migration. After preflight, the migration waits at its ALTER. In the other connection, append a credit of 25 to that historical journal using the old schema, then commit. The migration resumes and succeeds, sealing a journal whose net is 25. No trigger was disabled and the migration SQL was unmodified.

Required fix: acquire appropriate table locks in a consistent order **before** all preflight checks and retain them through installation, or provide an enforced equivalent write-quiescence mechanism. Document the maintenance/lock-time budget and verify concurrent writers cannot commit between validation and enforcement. Retain the existing rollback-on-preflight-failure test.

### R4 — P1: legacy idempotency keys are treated as new bets after upgrade

Locations: [new journal keys](C:/Users/hp/Documents/ChatGPT/fable/packages/domain/src/sportsbook/demo-bet.ts:191), [new-record lookup and creation](C:/Users/hp/Documents/ChatGPT/fable/packages/database/src/prisma-bet-store.ts:28), and the migration's initially empty `demo_bets` table.

Pre-Phase-7 journals use `bet-rsv-{key}` / `bet-stl-{key}`. The new code looks only in `demo_bets` and posts `bet-rsv-{userId}-{key}` / `bet-stl-{userId}-{key}`. Existing durable ledger history therefore does not prevent a second operation under the same player/client key after cutover.

Reproduction: on the old schema, seed a player grant of 100000 and a completed losing bet of 10000 using the old journal format and actor. Apply the actual Phase 7 migration. Retry that player's same key, selection, and stake through the new `DemoBetOperations` / `PrismaBetStore`. It returns settled and writes another journal pair: wallet **90000 → 80000**. This reaches the same service path used by authenticated HTTP placement; it does not require a client to execute SQL after deployment.

The handover acknowledges missing historical bet metadata and advises against replaying old operations. That instruction cannot stop an old browser or delayed request from retrying across an upgrade. Exact historical responses may be unrecoverable, but charging again is avoidable.

Required fix: detect and fence existing legacy operation identities before allowing a new placement. Safely reject ambiguous legacy retries or migrate verifiable operation tombstones; do not invent unavailable response metadata. Include outstanding legacy reservations in a cutover reconciliation policy. Test completed, reservation-only, changed-payload, and concurrent legacy retries.

## Verified strengths and scope limits

- The new PostgreSQL service boundary commits reservation, settlement, current bet record, original placement response, and financial audit inserts in one transaction. No direct balance mutation was introduced.
- PostgreSQL-backed player-scoped duplicate handling passed across independent clients and two API OS processes. Matching requests replay; changed payloads conflict; an original placement response survives later lifecycle changes.
- Real deadlock recovery passed in the committed suite. Supplemental checks confirmed exactly five attempts on persistent serialization conflict and one attempt for a nonretryable audit failure, with the failure propagated.
- Additional tests passed for winning refunds, simultaneous duplicate refunds, cancellation versus settlement, cancellation/refund audit-insert failure, and refund rejection after winnings have been spent. Assertions compare balances, bet state, journal counts, and audit counts.
- Terminating the PostgreSQL backend after settlement journal/audit writes but before bet-state commit rolled the operation back. Another client then settled the still-accepted bet once. This establishes transaction rollback/recovery for that crash point; it is not a full machine power-loss or backup-restore test.
- Additional real-database HTTP checks passed for missing authentication (401), missing CSRF (403), identical keys belonging to different players, scoped list results, ignored forged player/real-money fields, maximum-length client keys, and absence of a public refund endpoint. These verify player isolation. There is no tenant model to certify as multi-tenant isolation.
- Historical sealing, immutable account metadata, positive amounts, currency checks, immutable journal/audit rows, and the simulated-only ledger check remain useful defenses. Current SQL bet-state validation is not a complete relational proof tying each JSON record to journals and audit events; arbitrary authorized SQL writers remain a separate trust boundary.

## Nonblocking risks

1. **Uncertain browser responses:** the pending key survives retry in the current store, but a reload or removing/changing the selection discards it. Network failure copy says “The demo bet was not accepted” even when the server committed. Show an unknown/pending outcome and reconcile durable history before treating it as failed. The existing lost-response browser regression passes; durable browser intent across reload is not implemented.
2. **Recovery operations:** accepted holds can be recovered through internal transitions, but no scheduler, operator workflow, or recovery SLA exists. Refunds correctly refuse overdraft after winnings are spent; a product/operations policy must handle that case. No new recovery API is implied by this review.
3. **Throughput and availability:** balance reads load the whole ledger; common house-account locks and SERIALIZABLE predicates can cause contention and retries across unrelated players. Locks are ordered within each journal, not necessarily across an entire multi-journal operation, so bounded deadlock recovery remains necessary. No load-capacity claim is supported by these tests.
4. **Database privileges:** production runtime roles must not own tables or be able to disable triggers. Tests of ordinary DML do not certify production credentials or role grants. No production access was used.
5. **Local fallback and documentation:** memory mode remains nondurable and not fully transactional. Production enforcement depends on the documented `FABLE_ENV=prod`. Bet list Swagger text still says “this API process”; the earlier handover also contains stale pre-push CI wording. These are not reasons to waive the four blockers.

## Dependency advisory exploitability

Fresh `pnpm audit --prod --json` exited **1**, reporting **1 low, 3 moderate, 0 high, 0 critical**, across three advisory IDs. The moderate total includes two minimatch dependency instances. Versions/lockfile are unchanged by this PR.

- **deepmerge 4.3.1**, [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4): prototype poisoning when attacker-controlled objects are merged; no published fixed version in the advisory. The scanned path is `apps/web > shadcn > deepmerge`. Repository source imports `shadcn/tailwind.css`, not shadcn's JavaScript merge/CLI functionality. I found no HTTP request path into this merge operation. Untrusted registry/tooling inputs remain a development-time concern. This is a reachability assessment, not proof the vulnerable package is harmless in all future use.
- **minimatch 10.2.6 and 3.1.5**, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): pattern amplification at optimization level 2 or above; fixed advisory version 11.0.1. Paths are Fastify static → glob and config → ESLint. FABLE exposes no user-supplied glob pattern. Swagger registers Fastify static with wildcard behavior left at its default; the installed static plugin's glob branch only runs for `wildcard: false`. ESLint is tooling, not a player request handler. The advisory's demonstrated mechanism is in minimatch 10; the scanner's broad range also flags the legacy 3.x copy, so equivalent exploitability of that implementation is not established here.
- **glob 13.0.6**, [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): aborted walks can continue filesystem work; fixed advisory version 14.0.2. FABLE's current Swagger static configuration does not enter the glob branch. That branch itself uses a fixed `**/**` pattern and no AbortSignal. I found no attacker-controlled directory tree or request-supplied traversal budget reaching it.

These advisories are **nonblocking for this specific simulated Phase 7 diff** based on current reachability, with residual tooling/supply-chain risk. Track supported upstream updates and validate major-version compatibility rather than applying blanket overrides. The audit remains failing; it is not a clean security scan or a production/real-money approval.

## Exact verification record

Fresh local execution used Node 22.23.4 and PostgreSQL 18.6 on Windows. PostgreSQL was downloaded from the cached embedded distribution, initialized in a disposable workspace directory, and bound to `127.0.0.1:55437`. Only newly created local test databases were modified.

- `pnpm build:packages`: exit 0.
- `pnpm test` without the PostgreSQL test URL: exit 0; **43 passed, 10 skipped**. Nine skips are the real-PostgreSQL suite and one is the existing placeholder integration test. No financial claim is based on those skips.
- `pnpm --filter @fable/database test` with a fresh dedicated database: exit 0; **11 passed**, comprising **9 real-PostgreSQL cases and 2 static migration checks**.
- `pnpm --filter @fable/api build`: exit 0.
- `node scripts/financial-api-integration.mjs`: exit 0; two-process spending, replay, and conflict checks passed.
- Supplemental lifecycle script: exit 0; six scenarios passed, including actual backend termination and two audit-failure paths.
- Supplemental HTTP authorization/isolation script: exit 0; the checks described above passed against PostgreSQL-backed API processes.
- Supplemental isolation controls: exit 0; READ COMMITTED and SERIALIZABLE each allowed one spender and rejected the other. The first version of this temporary probe had a UUID/text SQL-parameter type error before running its scenarios; that probe error was corrected before the reported successful run.
- Adversarial reproduction script: exit 0 because it deliberately asserts the **four unsafe outcomes occurred**. This is evidence of four financial/migration acceptance failures, not four passing safety tests. Its two retry-policy assertions passed.
- Dependency audit: exit 1, counts above.
- GitHub CI run [41522976843](https://github.com/DeepakVerma24/fable/actions/runs/41522976843), rechecked for the exact reviewed commit: `verify`, `financial-postgres`, and `windows-portability` all succeeded. Its Linux job includes lint, typecheck, production build, browser tests, and Terraform validation; its database job uses PostgreSQL 17. These existing remote results were inspected, not rerun during this review. Full local production build and browser tests were not rerun because no source changes were made; the fresh local builds were shared packages and API.

## Evidence and merge requirements

Retained review scripts: [four defect reproductions and retry checks](C:/Users/hp/Documents/ChatGPT/fable/.phase7-tools/review-probes.cjs), [lifecycle/crash tests](C:/Users/hp/Documents/ChatGPT/fable/.phase7-tools/review-lifecycle.cjs), [isolation controls](C:/Users/hp/Documents/ChatGPT/fable/.phase7-tools/review-isolation.cjs), [HTTP authorization tests](C:/Users/hp/Documents/ChatGPT/fable/.phase7-tools/review-api.mjs). These temporary scripts require fresh disposable databases with the names in the scripts and the local connection configuration; they are not CI regressions and must never target a shared database.

Raw logs: [defects](C:/Users/hp/Documents/ChatGPT/fable/phase7-review-probes.log), [lifecycle](C:/Users/hp/Documents/ChatGPT/fable/phase7-review-lifecycle.log), [isolation](C:/Users/hp/Documents/ChatGPT/fable/phase7-review-isolation.log), [HTTP](C:/Users/hp/Documents/ChatGPT/fable/phase7-review-api-auth.log), [PostgreSQL suite](C:/Users/hp/Documents/ChatGPT/fable/phase7-review-postgres.log), [unit/API suite](C:/Users/hp/Documents/ChatGPT/fable/phase7-review-tests.log), [advisory scan](C:/Users/hp/Documents/ChatGPT/fable/phase7-review-audit.json). Evidence files are local and ignored by Git; this report is an uncommitted review artifact. The disposable PostgreSQL server was cleanly stopped after verification, and its test databases and downloaded binaries were removed; reproduction scripts and logs were retained.

Before reconsidering GO: fix R1–R4, turn each reproduction into a committed failing-before/passing-after PostgreSQL regression, verify the populated-database cutover and legacy retry policy, then rerun the financial suite, two-process API checks, and complete CI. The present commit must not be merged on the basis of its green CI alone.
