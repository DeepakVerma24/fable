# FABLE

FABLE is a premium casino and sportsbook platform. This repository is the player application on the modular monolith: simulated ledger, demo casino previews, demo sports fixtures, and a demo bet slip. It does not launch games, take live prices, or move real money.

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 10.33.4 (`corepack enable`)
- Docker, only if you want Postgres, PgBouncer, and Redis

## Run locally

```bash
pnpm install
pnpm dev
```

| Process      | URL                           |
| ------------ | ----------------------------- |
| Web          | http://127.0.0.1:3847         |
| API liveness | http://127.0.0.1:4307/health  |
| OpenAPI      | http://127.0.0.1:4307/docs    |
| Metrics      | http://127.0.0.1:4307/metrics |

`pnpm dev` builds the shared packages, then starts the API, the worker, and the web app. Without `REDIS_URL` the worker stays idle. Without `DATABASE_URL` the API keeps the ledger and the player directory in memory. Both are valid locally. Sessions, favorites, and the bet book are then lost on restart. Journals are durable only when Postgres is configured and migrations have been applied.

Sign in from the web app. The browser talks to the API through `/backend` on port 3847. Demo balances are labeled Fable demo units and are not withdrawable.

```bash
pnpm health
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @fable/web test:e2e
```

Storybook:

```bash
pnpm --filter @fable/web storybook
```

## Data stores

Copy `.env.example` to `.env` when you want Postgres and Redis. Apply the schema only against a direct Postgres connection:

```bash
docker compose up -d postgres pgbouncer redis
DIRECT_DATABASE_URL=postgresql://fable:fable@127.0.0.1:54329/fable?schema=public pnpm db:migrate
```

PgBouncer (host port 6432) pools connections to that same Postgres. It is not a second database. Migrations use `DIRECT_DATABASE_URL`. The API uses `DATABASE_URL` through PgBouncer.

`docker compose up --build` also builds the API, worker, and web images. The compose passwords are local defaults.

## Read next

- [Architecture](docs/architecture.md)
- [Technology decisions](docs/technology-decisions.md)
- [Financial safety](docs/financial-safety.md)
- [Environments](docs/environments.md)
- [Local development](docs/local-development.md)
- [Health checks](docs/health-checks.md)
- [CI](docs/ci.md)
- [Phase 2 report](docs/phase-2-implementation-report.md)
