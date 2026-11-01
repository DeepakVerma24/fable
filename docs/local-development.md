# Local development

## Install

```bash
corepack enable
corepack prepare pnpm@10.33.4 --activate
pnpm install
```

Node 22 is required (`engines` and `.nvmrc`). Shared packages compile to `dist` before the API and worker can import them. `pnpm dev` and `pnpm typecheck` build those packages first.

## Processes

```bash
pnpm dev
```

- API: Nest watch via the Nest CLI, port 4307. The CLI is used because it runs TypeScript 6, which emits decorator metadata.
- Worker: `tsx watch`. Idle, and still running, when `REDIS_URL` is missing.
- Web: Next.js on port 3847.

Open http://127.0.0.1:3847. The page reads `/health` and `/modules`. If the API is down, the page shows that error and still renders the simulated-money banner.

Storybook: `pnpm --filter @fable/web storybook` on port 6134.

## Environment files

`.env.example` is the template. The API and worker load the repo-root `.env` through dotenv, then a package-local `.env` if one exists. The web app does not read the root file. `NEXT_PUBLIC_API_URL` defaults to `http://127.0.0.1:4307` in code, which is enough for local dev.

No secret is required. Leave `SENTRY_DSN` empty.

## Database

```bash
docker compose up -d postgres pgbouncer redis
DIRECT_DATABASE_URL=postgresql://fable:fable@127.0.0.1:54329/fable?schema=public pnpm db:migrate
```

Set `DATABASE_URL` to the PgBouncer URL from `.env.example` before starting the API if you want journals in Postgres. Omit it to stay on the in-memory ledger.

`pnpm db:generate` rebuilds the Prisma client into `packages/database/generated`, which is gitignored. Generate runs as part of the database package build.

## Tests that need Docker

Testcontainers is not installed. `apps/api/test/testcontainers.gate.test.ts` is skipped unless `FABLE_TESTCONTAINERS=1`. Setting the flag fails the test with a pointer back here, because `@testcontainers/postgresql` is intentionally absent until a machine with a working Docker daemon needs it. The default suite does not need it: domain rules are pure, and the API health test boots Nest without Postgres.

k6 is also external:

```bash
k6 run load/k6/health.js
```

That script is one virtual user and one iteration. CI does not run it.

## Images

Docker is not required to hack. `docker compose up --build` builds `apps/api/Dockerfile`, `apps/worker/Dockerfile`, and `apps/web/Dockerfile` from the repo root. The web image expects `output: "standalone"` in Next. This sandbox does not have a Docker daemon, so the images were not built here. The Compose file is the local definition of Postgres, PgBouncer, Redis, and the three processes.
