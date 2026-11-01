# CI

`.github/workflows/ci.yml` runs on push and pull request, on Node 22 and pnpm 10.33.4:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint` (ESLint in each package, then Prettier)
3. `pnpm typecheck` (builds shared packages, then `tsc --noEmit`)
4. `pnpm test` (Vitest, including Supertest against `GET /health`)
5. `pnpm build` (API, worker, Next.js, and the Storybook static build)
6. Playwright Chromium install and `pnpm test:e2e` (one smoke against the web shell)
7. `terraform init -backend=false` and `terraform validate` for `dev`, `test`, and `prod`

Terraform has no providers and no remote state. Validate does not apply infrastructure and needs no cloud credentials.

## Not in CI, and why

| Tool                          | Why it is not a required check                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jest                          | Vitest runs the unit tests and the API health test. A second runner would duplicate the suite.                                                                                   |
| Pact broker                   | One web app and one API live in this repo. A broker is a separate service. `pact/pact.config.json` records the names for a later contract test. `/docs` is the current contract. |
| k6                            | `load/k6/health.js` is a stub. Load is not a correctness gate, and the binary is not installed in CI.                                                                            |
| Testcontainers                | Requires a Docker daemon. The suite is skipped unless `FABLE_TESTCONTAINERS=1`, and the client package is not installed.                                                         |
| Kafka, ClickHouse, Kubernetes | Not part of the runtime. See [architecture](architecture.md).                                                                                                                    |
