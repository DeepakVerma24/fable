# FABLE Originals recovery handover

Dice, Mines, Plinko and Limbo now use PostgreSQL for their practice rounds and command history. All four use server-generated outcomes. The before-and-after wallet and ledger-history assertions passed for casino play.

## What failed before

The previous game engine held rounds and idempotency responses in JavaScript maps. Its session identifier was generated when the engine started. A restart discarded the board and its replay record together. A second API instance had a different identifier and could neither read nor advance the first instance's board. An authenticated player could keep a pending request in their browser, but after an API restart the server had no record to reconcile it against.

## Data and transaction boundaries

The additive `20261105200000_casino_sessions` migration creates three tables.

- `casino_demo_namespace` holds one immutable database identifier. It survives API restarts. Authentication still uses the existing player session cookie and CSRF checks.
- `casino_demo_rounds` holds the round UUID, owner, game, start key, inputs, schema version, lifecycle status, revision, timestamps, public result and private Mines board. A partial unique index permits one active board per player. The transition trigger validates sampled cells, ordered reveals, mine hits, final safe cells, voluntary finishes and terminal immutability.
- `casino_demo_commands` holds the player-scoped request key, operation, payload fingerprint, round revision and that revision's public response. A foreign key binds the command to the round's owner. Unique constraints and paired triggers require a matching replay record for each committed revision. Command history is immutable.

The store acquires a transaction-scoped PostgreSQL advisory lock for the player at `READ COMMITTED`. Its subsequent replay lookup sees the preceding writer's commit. Advancement also locks the owned round row and updates it only at the expected active revision. The round, private state and replay response commit together.

An identical retry returns its original JSON result, including after a later move has changed the round. Reusing the key with another payload or sending a stale action returns HTTP 409. A key from another database namespace receives 410. The adapter retries confirmed deadlock, serialization or lock-timeout errors up to three total attempts with jitter. A lost commit acknowledgement goes back to the caller for recovery with the same key.

The stateless domain rules accept controlled randomness in tests. The running API uses Node's cryptographic random integer generator. Mines samples its board once. Authenticated reads project only the saved public result, and active responses omit mine locations.

## API and browser behavior

The existing HTTP routes keep their paths.

- `GET /casino/demo/session` returns the durable namespace, supported games and state schema version.
- `GET /casino/demo/rounds?gameId=…` returns up to 50 owned rounds, with an active Mines board first. `GET /casino/demo/rounds/:id` reads an owned round. A different player receives 404. These reads use private, no-store cache headers.
- `POST /casino/demo/rounds` starts or replays a round. `POST /casino/demo/rounds/:id/actions` reveals a cell or finishes Mines. Both require an authenticated player, CSRF and an idempotency key. Missing database configuration makes durable play unavailable.

Opening the practice room adds `?play=1`. Reload and reauthentication restore that room and fetch saved history without issuing a move. The pending action is saved before transmission. A timeout, dropped response or expired login preserves its key and payload for retry. Same-origin tabs coordinate through Web Locks and storage events. A waiting tab refreshes the round when another tab has resolved the request. The database independently enforces the same operation and revision boundaries across devices and API processes.

## Verification

Verification used Windows, Node 22.23.4, pnpm 10.33.4 and a native PostgreSQL 18.6 server on loopback. PostgreSQL reported `fsync`, `synchronous_commit` and `full_page_writes` enabled. All five repository migrations applied to a fresh casino test database. Prisma subsequently reported the database up to date.

- **Workspace tests.** 118 passed and one optional Docker Testcontainers gate was skipped. Domain passed 25, web 29, database 45, API 14, observability 3 and worker 2. The database package ran all 37 existing financial PostgreSQL regressions using a separate dedicated fixture. Five casino tests exercised real PostgreSQL, and a separate test verified missing-configuration handling.
- **Database failure coverage.** The tests competed for a start key, an active board and the same expected revision, forced command-insert failures, checked commit-time constraints and tested the bounded retry policy with injected SQLSTATEs. A retry after the rolled-back write succeeded.
- **Process recovery.** `pnpm test:casino:recovery` exited zero. Four compiled API processes ran over the course of five passing scenarios. A PostgreSQL lock probe confirmed the writer was inside a reveal transaction before the harness terminated it. A surviving API saw the prior revision and applied the saved request. The harness recovered a committed response that the client had discarded, raced reveals and finishes, checked historical replay, then stopped every fixture API and read all four completed games on a fresh process.
- **Builds and types.** Workspace typechecking and the workspace production build passed, including API, worker, Next.js and Storybook. The final web-only production build also passed.
- **Browser.** All 33 Chromium tests passed on the final standalone Next.js artifact in 2.1 minutes. They covered all four games, reload and login recovery, concurrent tabs, wallet safeguards, sportsbook and cricket flows, and responsive layouts at 375, 768, 1024 and 1440 pixels. The recovery captures show the same saved one-cell reveal at desktop and mobile widths. The prior sprint's 47 evidence files matched their original SHA-256 hashes after verification. [Desktop capture](mines-restored-1440.png) · [Mobile capture](mines-restored-375.png)
- **Lint.** Workspace ESLint and the Prettier check over this sprint's files passed. The aggregate `pnpm lint` exited 1 because its repository-wide Prettier check found pre-existing formatting differences in `docs/design-review/README.md` and `docs/sportsbook-review/IMPLEMENTATION.md`.
- **Earlier test run.** All 44 database assertions present during the first full run passed, but the existing financial hardening suite's teardown exceeded its 10-second hook timeout. The passing final workspace run used a fresh financial fixture and `pnpm -r --if-present run test --hookTimeout 60000 --maxWorkers=2`.

## Files changed in this sprint

- Domain rules and exports — `packages/domain/src/casino/originals.ts`, `packages/domain/src/casino/originals.test.ts`, `packages/domain/src/index.ts`.
- Storage and migration — `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20261105200000_casino_sessions/migration.sql`, `packages/database/src/postgres-original-sessions.ts`, `packages/database/src/originals.postgres.test.ts`, `packages/database/src/index.ts`.
- HTTP adapter and tests — `apps/api/src/casino/originals.controller.ts`, `apps/api/test/originals.e2e.test.ts`.
- Frontend and Chromium tests — `apps/web/src/lib/casino-types.ts`, `apps/web/src/app/(player)/casino/game/[id]/page.tsx`, `apps/web/src/components/casino/original-player.tsx`, `apps/web/e2e/casino.spec.ts`.
- Verification wiring and local setup — `scripts/casino-api-recovery.mjs`, root `package.json`, `.github/workflows/ci.yml`, `docs/local-development.md`.
- Delivery evidence — this report and the 375 px and 1440 px recovery captures in `docs/casino-recovery/`.

## Reproducing the recovery check

Use a disposable local PostgreSQL database named `fable_casino_*`. Set `DATABASE_URL` and `FABLE_CASINO_TEST_URL` to its connection string. Set `DIRECT_DATABASE_URL` to the direct connection for migration. Run `pnpm db:migrate`, `pnpm build`, then `pnpm test:casino:recovery`. The process harness uses short-lived test triggers on its own generated player's commands. The financial regression suite uses a separate, initially empty database supplied through `FABLE_POSTGRES_TEST_URL`.

The Linux verification workflow now provisions PostgreSQL 17, applies migrations, runs the recovery harness and points browser tests at the database-backed API. Hosted CI execution is pending publication of the local changes.

## Remaining risks and next sprint

- Previously lost process-memory rounds have no recoverable source. A saved command bearing an old process namespace receives 410. During cutover, retire old API writers together so players consistently reach the durable implementation.
- The 50-round read limit bounds a response. Stored rounds and replay records continue to grow. The player foreign key restricts deletion of owners with round history.
- The local crash tests exercised API loss with PostgreSQL available. Physical database loss, point-in-time restoration, replication failover and independently diverged database copies remain untested. A restored copy can share the original namespace even when its command history is older.
- Cross-tab coordination requires working browser storage and Web Locks. Database serialization still protects requests that reach the API from separate browser profiles or devices. Browser verification used Chromium.
- The local system drive fell below 10 MiB free after verification and cleanup of the disposable financial fixtures. Free disk space before another full local build or database test run.
- The next sprint should exercise backup restoration and replay after failover, define history retention and account erasure, and add metrics for lock waits, exhausted retries, stale actions and storage growth.
