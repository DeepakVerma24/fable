# Phase 7.1 — financial integrity remediation

Scope: PR #1, branch `codex/phase-7-financial-integrity`, baseline `4469875`. The [final review](phase-7-final-review.md) records the baseline NO-GO; this document records its remediation. Real-money operations remain disabled. No deployment, merge, new wagering feature, or Phase 8 work is included.

## Before evidence

Before editing source, all four review probes were rerun on PostgreSQL 18.6 against the unchanged baseline:

- Early header constraint validation followed by another credit committed a journal with net 25.
- Two REPEATABLE READ writers each spent 80 from 100 and committed a wallet balance of -60.
- A legacy write after preflight escaped the original migration and left a sealed journal with net 25.
- Retrying a legacy losing bet after upgrade created a new pair and changed the wallet from 90000 to 80000.

Local raw evidence: `phase7-1-before.log`. The probe exits zero when these unsafe outcomes are reproduced; it is not a passing safety test.

## Fixes and design decisions

**P1-01:** add a deferred constraint trigger on every inserted entry, while retaining the header constraint for empty-journal rejection. Flushing the header or all constraints early no longer eliminates subsequent entry validation. The existing transaction-ID seal rejects entries after commit. Currency/positive-amount/simulated-only checks remain. Trigger search paths are pinned so temporary tables cannot redirect the existing wallet or journal checks.

**P1-02:** add `ledger_account_fences(account_id, revision)`. Every entry insertion advances its account's revision inside the same transaction through a narrowly scoped SECURITY DEFINER trigger. This is MVCC concurrency metadata: it contains no amount, balance, or materialized wallet projection. Under REPEATABLE READ and SERIALIZABLE, a stale competing writer receives SQLSTATE 40001 because a row version actually changed. Under READ COMMITTED, the writer waits and the deferred balance check sees the committed predecessor's entries. Conflicts are retried only as complete transactions using the existing bounded policy; overdrafts fail. Failed postings roll back their fence changes too. Balances remain exclusively derived from immutable ledger entries.

**P1-03:** add the final corrective migration `20261103140000_financial_hardening`. It takes ACCESS EXCLUSIVE locks on transactions, entries, accounts, bets, and audit before repeating all historical checks and installing enforcement. Locks last through commit. Lock acquisition is bounded at 10 seconds and the migration statement at 120 seconds. Timeout/corruption aborts the migration without partial installation or financial correction. Previously applied migration files and checksums are unchanged. If the earlier Phase 7 migration missed a race, the final migration detects it and refuses to activate. Both PostgreSQL financial stores call a function installed only by the final migration, so the new release cannot write through a partially migrated database.

**P1-04:** before a new bet can reserve funds, look for the original globally unique `bet-rsv-{key}` and `bet-stl-{key}` journal identities. Any match returns HTTP 409 through the existing idempotency-conflict mapping. No new journal, bet record, or financial audit event is produced. Completed pairs, either partial pair, missing actors, mismatched actors, changed payloads, different players sharing a legacy identity, and ambiguous collisions are rejected conservatively. Exact legacy responses cannot be reconstructed because selection/odds/response metadata was never durable. We do not invent it or reinterpret an old key as a new operation. Current durable records still replay their immutable original response before this legacy check. Legacy history is the durable rejection record; no mutable tombstone copy is required.

## Financial writer role contract

Supported runtime financial writers are non-owner, NOSUPERUSER, NOCREATEROLE, NOCREATEDB, NOREPLICATION principals with no schema CREATE permission or membership in an owner/admin role. Tests exercise two independent principals inheriting the same grant profile (API and worker), plus the migration owner for invariant checks. A deployment must map every financial writer to this profile; this repository does not contain or certify live production role assignments.

The financial grant profile is SELECT/INSERT on ledger accounts, transactions, entries, and audit; UPDATE on accounts only to permit the existing SELECT FOR UPDATE (account mutation itself is rejected by trigger); and SELECT/INSERT/UPDATE on demo bets. Directory/session grants are separate application concerns. Do not grant runtime roles DELETE/TRUNCATE/DDL, unrestricted default privileges on new tables, or direct access to `ledger_account_fences`. The migration revokes PUBLIC privileges on that table, PUBLIC execution of its SECURITY DEFINER trigger function, and PUBLIC CREATE on schema `public`. The trigger can perform its narrow internal update without granting callers that capability. Its fixed search path and explicitly qualified relations prevent name substitution.

Full stored-procedure-only posting was evaluated but is unnecessary for these fixes: entry/header triggers enforce the financial invariants for ordinary SQL and Prisma writes, while the private trigger performs only the concurrency-metadata update. Moving the entire bet workflow into procedures would duplicate domain orchestration. Owners/superusers can always disable or replace enforcement and remain trusted migration/administration principals, never runtime credentials.

## Migration and deployment ordering

1. Inventory database writers and runtime role memberships. Take a backup and verify restoration independently; no backup/production restoration was performed by this task.
2. Stop/drain old API and worker writers for the **whole migration chain**. Do not perform a mixed-version rolling cutover: old application code does not enforce legacy-key compatibility or the new readiness gate.
3. Run `pnpm db:migrate` against the direct PostgreSQL endpoint with migration credentials. Earlier migration files are intentionally unchanged. The last migration supplies the synchronized validation/enforcement boundary for both fresh installs and populated Phase 7 databases.
4. On timeout/deadlock, verify rollback, resolve writer/lock contention, and retry. Prisma may record a failed migration; only after verifying the transaction rolled back, use the normal Prisma failed-migration resolution procedure before rerunning deploy. Never mark the migration applied to bypass validation.
5. On corrupt history, keep writers stopped. No rows are deleted or automatically balanced. A sealed, internally unbalanced historical journal cannot be fixed by an ordinary compensating journal; restore verified history or use a separately approved, auditable reconciliation procedure. Pre-existing duplicate charges that are individually balanced require operational reconciliation and are not detected as journal imbalance.
6. Start only the new application revision with restricted runtime credentials after every migration succeeds. Test financial readiness before reopening writes. Do not roll the application back to the vulnerable baseline; use a forward correction or keep financial writes stopped.

The additive schema is backward-readable. The fences and triggers must not be dropped for rollback. Large datasets may exceed the bounded migration window; rehearse on a restored production-sized copy and schedule an appropriate maintenance window. This phase did not perform that production rehearsal.

## Regression coverage

`packages/database/src/hardening.postgres.test.ts` adds 28 real-PostgreSQL cases:

- Early header-only checks, ALL IMMEDIATE, and immediate/deferred toggling under owner and both restricted writer principals.
- Committed sealing, currency rejection, denied fence updates, denied trigger disabling, denied replication-role bypass, and denied journal deletion for both runtime principals.
- Deterministic competing-spend tests under READ COMMITTED, REPEATABLE READ, and SERIALIZABLE using observed database lock waits; fresh retries cannot overdraw.
- Fence rollback; temporary-table shadowing rejection; actual Prisma posting/replay under both restricted principals.
- Final migration waits before validation, corruption refusal and repeated refusal without mutation, safe completion after an old writer aborts, lock timeout and successful retry, and rejection of the exact race missed by the earlier migration.
- Financial writes fail closed before the final migration.
- Populated pre-Phase-7 schema upgrade preserves 90000 and rejects the original retry; completed, partial, missing/mismatched actor identities reject simultaneous requests, changed payloads, cross-player collisions, and retries after uncertain rejection responses.

The existing nine PostgreSQL financial cases remain, including actual deadlock recovery, rollback after audit failure, concurrent spending, lifecycle idempotency, and historical sealing. The two-process API script now also verifies legacy retry conflicts and unchanged balance/journal count across separate processes. Existing browser lost-response and other UI regressions remain unchanged.

## Files changed

- New migration: `packages/database/prisma/migrations/20261103140000_financial_hardening/migration.sql`.
- Schema: `packages/database/prisma/schema.prisma` (fence metadata model/relation).
- Stores: `packages/database/src/prisma-ledger-store.ts`, `packages/database/src/prisma-bet-store.ts` (readiness and legacy identity fence).
- Tests: `packages/database/src/hardening.postgres.test.ts`, `packages/database/src/financial.postgres.test.ts`, `scripts/financial-api-integration.mjs`.
- Documentation: this document and the preserved baseline `docs/phase-7-final-review.md`.

No dependency or lockfile changes. No existing migration is edited. No balance column, direct balance update, credential change, or new public lifecycle endpoint is introduced.

## Verification and remaining risks

Verification results and merge recommendation are recorded below after the required local and remote checks complete. Passing a simulated financial gate does not authorize real-money operations or deployment. Remaining concerns from the baseline review include unbounded ledger scans, contention on common accounts, browser pending intent lost on reload, operational handling of accepted holds/refunds, and dependency advisories without a currently identified request-path exploit. No claim is made that production privileges, throughput, backups, or regulatory readiness have been certified.
