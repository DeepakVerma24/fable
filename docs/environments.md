# Environments

`FABLE_ENV` is `dev`, `test`, or `prod`. It names the deployment. It does not enable real money. Every environment in this repo is simulated.

|               | dev                                                                      | test                                  | prod                                                             |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------- |
| Where         | A laptop, with or without Compose                                        | GitHub Actions                        | Not applied. Terraform names the shape only                      |
| Ledger        | In memory, or Postgres when `DATABASE_URL` is set                        | In memory. CI does not start Postgres | Would be Postgres through PgBouncer. Still simulated             |
| Redis         | Optional. The worker idles without it                                    | Not started                           | Would back BullMQ                                                |
| Sentry        | Off unless `SENTRY_DSN` is set                                           | Off                                   | Off unless a DSN is injected at deploy time. No DSN is committed |
| OpenTelemetry | Off unless `OTEL_ENABLED=true` or an OTLP endpoint is set                | Off                                   | Same opt-in. No collector is required to boot                    |
| Secrets       | `.env` is local and gitignored. Compose passwords are the string `fable` | None                                  | Must come from the host, not from this repo                      |

## Dev

`pnpm dev` is the default. Compose is optional and published on uncommon host ports: Postgres `54329`, PgBouncer `6432`, Redis `63799`, API `4307`, web `3847`.

Inside Compose, the API's `DATABASE_URL` points at `pgbouncer`. `DIRECT_DATABASE_URL` points at `postgres` and is the URL for migrations. PgBouncer runs in transaction mode with `MAX_PREPARED_STATEMENTS=100` so Prisma's prepared statements have a pool that understands them. `AUTH_TYPE=plain` is a local convenience for the image's generated user list. It is not a production authentication design.

## Test

CI runs lint, typecheck, unit tests, the API health Supertest suite, the production build, and one Playwright smoke. It does not start Docker services. Testcontainers stays skipped unless `FABLE_TESTCONTAINERS=1`, and the package is not installed because this environment has no Docker daemon.

## Prod

`infra/terraform/envs/prod` instantiates the same module as dev and test. The module has no cloud provider and no resources. `terraform validate` checks the shape. Nothing is applied, and this foundation has no real-money program to turn on after apply.

Grafana is optional. Point it at the API's `/metrics` text endpoint if you want a dashboard. It is not part of Compose, because a dashboard is not required to boot or to prove the registry works.
