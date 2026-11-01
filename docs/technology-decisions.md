# Technology decisions

Each dependency below is a direct dependency of a workspace package. Transitive packages are not re-listed. Versions are pinned in `package.json` and the lockfile. TypeScript is catalog entry `6.0.3`, forced again with a pnpm override so a dependency cannot pull TypeScript 7 in under the name `typescript`.

Internal packages are dependencies too. They exist so the API and the worker do not copy the same rules.

## Toolchain

### `typescript` 6.0.3

Purpose: typecheck and emit the API, worker, and shared packages.
Compatibility: NestJS 12's CLI calls the TypeScript compiler API (`createProgram`). TypeScript 7.0.2 ships the `tsc` binary only and Nest refuses to build on it. `typescript-eslint` 8.72 accepts `>=4.8.4 <6.1.0`, so 6.0.3 is the newest compiler that line allows. Next.js 16 typechecks with this compiler. A pnpm override pins every workspace package to 6.0.3.
Maintenance and security: TypeScript 7 is current, and we are not on it. Staying on 6 is a compatibility hold, not a preference. Move to 7 when Nest CLI and typescript-eslint both accept its compiler API. The override blocks a silent jump. The `@typescript/typescript6` wrapper only exposes a `tsc6` binary, so the dependency is the `typescript@6.0.3` package itself, which still provides `tsc` and `createProgram`.
Why it is needed: the repo is strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`). There is no JavaScript application code. Node packages keep `moduleResolution: node` because Nest emits extensionless CommonJS imports. TypeScript 6 deprecates that name, so `ignoreDeprecations` is `6.0` until the compiler move above.

### `pnpm` 10.33.4

Purpose: install the workspace.
Compatibility: `packageManager` matches the pnpm available in this environment. Workspaces cover `apps/*` and `packages/*`. The catalog keeps every package on the same TypeScript.
Maintenance and security: one lockfile, frozen in CI. Build scripts are allow-listed in `pnpm-workspace.yaml`.
Why it is needed: npm workspaces would also work. pnpm is here because the workspace is multiple apps and the catalog plus the override are how we stop a second TypeScript from appearing. Turborepo is not added. `pnpm -r` already runs builds in dependency order, and a task runner would duplicate that at this size.

### `prettier` 3.9.10

Purpose: format TypeScript, JSON, and Markdown.
Compatibility: ESLint uses `eslint-config-prettier` so the two tools do not fight.
Maintenance and security: formatting-only. It does not execute application code.
Why it is needed: CI runs `prettier --check` so review is not a whitespace argument.

### `concurrently` 10.0.6

Purpose: run the API, worker, and web from `pnpm dev`.
Compatibility: Node 22.
Maintenance and security: a dev-only process supervisor. It is not in the production image command.
Why it is needed: three processes, one command. A shell background pile is harder to stop cleanly.

### `eslint` 9.39.5

Purpose: lint every package.
Compatibility: `typescript-eslint` 8.72 supports ESLint 8, 9, and 10. `eslint-config-next` 16.4.3 pulls `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, and `eslint-plugin-react`, whose peer ranges stop at ESLint 9. ESLint 10.14 installs, then those plugins are unmet peers. ESLint marks 9.39.5 as unsupported upstream.
Maintenance and security: this is the uncomfortable pin. ESLint 10 is the supported major, and we are not on it because the Next preset's plugins have not declared it. Revisit when those plugins publish an ESLint 10 peer. Do not "fix" it by turning lint off.
Why it is needed: one linter for the monorepo. The web uses `eslint-config-next` only. Node packages use `@fable/config`. Stacking both presets on the web would duplicate TypeScript rules.

### `typescript-eslint` 8.72.1

Purpose: TypeScript syntax rules for Node packages.
Compatibility: ESLint 9 and TypeScript 6.0.2, inside its stated peer range. The shared preset uses `recommended`, not the type-checked preset. `tsc --noEmit` is the type gate, and a second type-aware lint program would reimplement it.
Maintenance and security: official typescript-eslint project.
Why it is needed: ESLint's base rules do not parse TypeScript.

### `eslint-config-prettier` 10.1.8

Purpose: turn off ESLint rules that contradict Prettier.
Compatibility: ESLint 7 and newer.
Maintenance and security: config only.
Why it is needed: without it, format and lint disagree on the same lines.

### `eslint-config-next` 16.4.3

Purpose: Next.js Core Web Vitals and TypeScript lint rules for `apps/web`.
Compatibility: matches Next 16.4.3. Its nested plugins peer-depend on ESLint 9, which is why the workspace stays on ESLint 9. See `eslint`.
Maintenance and security: published with Next. We do not copy those rules into `@fable/config`.
Why it is needed: the web app has JSX, hooks, and Next file conventions the Node preset does not know.

### `@types/node` 22.20.5

Purpose: types for Node 22 built-ins.
Compatibility: matches the runtime major. We do not use `@types/node` 26, which tracks a newer Node than we run.
Maintenance and security: DefinitelyTyped, dev-only.
Why it is needed: `tsc` cannot see `process`, `fs`, or `crypto` without it.

### `@types/react` 19.3.0 and `@types/react-dom` 19.3.0

Purpose: types for React 19.
Compatibility: aligned with React 19.3.
Maintenance and security: DefinitelyTyped, dev-only.
Why it is needed: the web components are TypeScript.

### `@types/pg` 8.23.1

Purpose: types for the `pg` driver.
Compatibility: matches `pg` 8.23.1.
Maintenance and security: DefinitelyTyped, dev-only.
Why it is needed: the Prisma driver adapter is constructed with a connection string, and the driver is a direct dependency.

### `vitest` 5.0.5

Purpose: unit tests and the API health test.
Compatibility: Vite 6 through 8. The web package also depends on Vite 8 for Storybook, which satisfies the peer. Node tests do not need jsdom.
Maintenance and security: the test runner. It is not shipped in the API image command.
Why it is needed: one runner for domain rules, the Zod pipe, the worker processor, and Supertest. Jest is not installed.

### `supertest` 7.3.1 and `@types/supertest` 7.2.1

Purpose: HTTP assertions against the Nest Fastify server.
Compatibility: Nest's testing module and Fastify's request listener. Supertest 7.3 does not ship its own types, so the DefinitelyTyped package is direct.
Maintenance and security: test-only.
Why it is needed: `GET /health` is exercised as HTTP, not as a function call.

### `@playwright/test` 1.64.1

Purpose: one browser smoke of the foundation page.
Compatibility: Next 16's peer range includes Playwright 1.51 and newer.
Maintenance and security: downloads a browser when `test:e2e` runs. CI installs Chromium with OS dependencies. It is not part of `pnpm test`.
Why it is needed: Vitest does not open the page. The smoke checks the heading, the simulated-money sentence, and the note button.

## Shared runtime

### `@fable/domain`

Purpose: module boundaries, ledger rules, and the in-memory store.
Compatibility: plain TypeScript, no Nest and no Prisma, so tests do not boot a framework.
Maintenance and security: first-party. Casino and sportsbook cannot import the database package without failing the source boundary test if they start writing.
Why it is needed: the API and the worker must share one definition of a simulated journal. Copying it would let the copies drift.

### `@fable/database`

Purpose: Prisma client, the Postgres ledger store, and Redis connection factories.
Compatibility: imported by the API and the worker. Node packages use TypeScript's `node` module resolution, which does not read package `exports`, so Redis helpers are on the package entry alongside the Prisma store. The worker only calls the Redis factory.
Maintenance and security: first-party. The generated client is gitignored and rebuilt.
Why it is needed: one place owns SQL and Redis. The domain package stays free of drivers.

### `@fable/observability`

Purpose: JSON logs, optional Sentry, optional OpenTelemetry, Prometheus registry, dotenv loading.
Compatibility: imported by the API and the worker.
Maintenance and security: first-party wrapper. The vendors are listed below. Nothing starts unless configured.
Why it is needed: two processes should not each invent a logger and a metrics registry.

### `@fable/config`

Purpose: shared `tsconfig` and the Node ESLint preset.
Compatibility: JSON and ESM, no build step.
Maintenance and security: first-party.
Why it is needed: strict compiler flags live in one file. Next keeps its own tsconfig plugin and extends the shared Next base so JSX settings are not copied by hand into Nest.

### `zod` 4.6.7

Purpose: validate environment variables, the HTTP validation pipe, the operator note, and API responses in the web app.
Compatibility: Zod 4. `@hookform/resolvers` 7 reads Zod 4 schemas. The note form does not pass an explicit `useForm` generic, because `.trim()` makes input and output types differ.
Maintenance and security: the schema library. We do not also depend on `class-validator`.
Why it is needed: one schema language for the boundary of the process and the boundary of the form.

### `pino` 10.4.0

Purpose: structured JSON logs.
Compatibility: `nestjs-pino` 5 requires pino 10. The worker calls `createLogger` from the observability package, which is the same library.
Maintenance and security: JSON to stdout. No pretty transport is installed, so production logs stay machine-readable. Authorization and cookie headers are redacted in the API logger.
Why it is needed: Nest's default logger is not JSON. A second logging library is not added.

### `dotenv` 18.0.9

Purpose: load the repo-root `.env` for the API and the worker.
Compatibility: Node 22. `override` is used only for a package-local file.
Maintenance and security: reads a local file. It does not fetch secrets.
Why it is needed: `nest start` does not pass Node's `--env-file` flag. The web app uses Next's own env loading and does not take this dependency.

## HTTP API

### `@nestjs/common` and `@nestjs/core` 12.3.2

Purpose: the API framework.
Compatibility: Nest 12 on Node 22. Controllers use explicit `@Inject` tokens so tests do not depend on `emitDecoratorMetadata` from esbuild.
Maintenance and security: the current Nest major. We do not add `@nestjs/platform-express`.
Why it is needed: modules, filters, and the testing harness. A raw Fastify app would reimplement that for one service.

### `@nestjs/platform-fastify` 12.3.2

Purpose: run Nest on Fastify.
Compatibility: depends on Fastify 5. The Fastify package is not a direct dependency because the application imports Nest's adapter, not Fastify itself.
Maintenance and security: official Nest adapter.
Why it is needed: the API is specified as Fastify. Express is not installed.

### `@nestjs/cli` 12.0.11

Purpose: `nest build` and `nest start --watch`.
Compatibility: requires the TypeScript 6 compiler API. See `typescript`.
Maintenance and security: dev-only. The image runs `node dist/main.js`.
Why it is needed: the official compiler path emits decorator metadata. `tsx` does not, so it is not the API dev server.

### `@nestjs/testing` 12.3.2

Purpose: boot the module in Vitest.
Compatibility: same Nest 12 line as the runtime.
Maintenance and security: test-only.
Why it is needed: Supertest needs a listening application, not a hand-built Fastify instance that skips the module graph.

### `@nestjs/swagger` 12.0.5 and `@fastify/static` 10.1.8

Purpose: OpenAPI at `/docs`.
Compatibility: Nest 12. Swagger's UI is static files, and on Fastify that requires `@fastify/static` 10, which is also the peer of `@nestjs/platform-fastify`. Helmet's content security policy is disabled so the UI can load. The document is the foundation contract.
Maintenance and security: official packages. They do not publish the API to the internet by themselves.
Why it is needed: a written contract without a Pact broker. `@fastify/static` is direct because Swagger calls `process.exit` when it is missing.

### `@nestjs/websockets` 12.3.2, `@nestjs/platform-socket.io` 12.3.2, and `socket.io` 4.8.4

Purpose: the ping gateway stub on the same HTTP server.
Compatibility: Nest 12's Socket.IO platform. `socket.io` is direct because the gateway runs that server.
Maintenance and security: official adapter. The handler returns `pong` and does not accept a wager payload as a command.
Why it is needed: the foundation includes a WebSocket gateway. It is a stub, not a product channel.

### `@fastify/helmet` 13.2.0

Purpose: security headers on the Fastify adapter.
Compatibility: Fastify 5, which is what Nest's adapter uses.
Maintenance and security: Helmet's header set. CSP is off for the OpenAPI UI only.
Why it is needed: default Nest does not set those headers.

### `nestjs-pino` 5.3.1

Purpose: Nest logger backed by pino.
Compatibility: Nest 11 or 12, pino 10, which we have. Request auto-logging is off so health probes do not flood stdout. Startup is logged once.
Maintenance and security: maintained Nest integration. Redaction is configured next to it.
Why it is needed: `app.useLogger` should be pino, not a second logger wrapped by hand.

### `reflect-metadata` 0.2.2

Purpose: the metadata API Nest decorators call.
Compatibility: Nest 12's peer is `^0.1.12 || ^0.2.0`.
Maintenance and security: small runtime. Imported first in `main.ts` and in the Vitest setup.
Why it is needed: Nest reads decorator metadata. It is a peer, so it has to be direct.

### `rxjs` 7.8.2

Purpose: Nest's peer runtime.
Compatibility: Nest 12 requires `rxjs` 7.
Maintenance and security: the application code does not build streams. The dependency is here because Nest will not boot without it under pnpm's isolation.
Why it is needed: it is a required peer of `@nestjs/core`, not a second reactive framework we chose for product code.

## Data

### `prisma` 7.10.1 and `@prisma/client` 7.10.1

Purpose: schema, migrations, and the typed client.
Compatibility: Prisma 7. The client generator is `prisma-client` with a custom output, configured in `prisma7.config.ts`. The URL lives in that config, not in `schema.prisma`. Prisma 8.0.0-rc.29 is what `npm latest` currently points at. It is a release candidate, so we pin the stable 7.10 line. The CLI prints an upgrade notice. Ignore it until 8 is stable.
Maintenance and security: Prisma 7 is the maintained stable major. Generate does not need a live database. The fallback URL in the config exists so generate works with no `.env`.
Why it is needed: the ledger tables, the user stub, and the audit log are one schema. A query builder would not give us migrations.

### `@prisma/adapter-pg` 7.10.1 and `pg` 8.23.1

Purpose: connect the Prisma 7 client through node-postgres.
Compatibility: Prisma 7 requires a driver adapter unless Accelerate is used. We are not using Accelerate.
Maintenance and security: official adapter plus the node-postgres driver. Connection strings come from the environment.
Why it is needed: Prisma 7 no longer embeds the old Rust connection path for this setup. PgBouncer sits in front of the same Postgres. See [environments](environments.md).

### `ioredis` 6.0.0

Purpose: Redis client.
Compatibility: BullMQ 6 accepts `ioredis` 5 or newer. Two factories exist on purpose. `createBullConnection` sets `maxRetriesPerRequest: null`, which BullMQ requires. `createRedisClient` keeps a small retry cap for the readiness ping.
Maintenance and security: the client. No Redis password is committed beyond the local Compose URL with no auth.
Why it is needed: the worker and the readiness check. The `redis` npm package is not added beside it.

### `bullmq` 6.5.3

Purpose: the stub queue in the worker.
Compatibility: Redis via `ioredis`. The worker is a separate process from the API.
Maintenance and security: jobs run in-process. The processor refuses balance-changing job names.
Why it is needed: a queue that is not inside the API process. Kafka is not added. See [architecture](architecture.md).

### `tsx` 4.23.15

Purpose: watch the worker during development.
Compatibility: Node 22. The worker has no Nest decorators, so the missing `emitDecoratorMetadata` does not matter. The API does not use tsx.
Maintenance and security: dev-only. The image runs compiled JavaScript.
Why it is needed: a fast watch loop for a plain Node process.

## Web

### `next` 16.4.3, `react` 19.3.1, and `react-dom` 19.3.1

Purpose: the foundation UI.
Compatibility: Next 16's React peer includes 19. The App Router scaffold is the official `create-next-app` output, then edited. `output: "standalone"` is for the Docker image.
Maintenance and security: current Next and React. The page is a dev shell. It does not render odds or a cashier.
Why it is needed: the specified web app. A static HTML file would not be this stack.

### `tailwindcss` 4.3.3, `@tailwindcss/turbopack` 4.3.3, and `@tailwindcss/vite` 4.3.3

Purpose: styling.
Compatibility: Tailwind 4. Next's scaffold compiles CSS with the Turbopack loader. Storybook uses the Vite plugin. They are the same major, two bundlers.
Maintenance and security: styling only.
Why it is needed: the specified styling system. Two entry points exist because Next and Storybook do not share a bundler. The theme tokens are not duplicated into a second CSS framework.

### `shadcn` 4.23.0

Purpose: the component registry and `shadcn/tailwind.css`, which `globals.css` imports.
Compatibility: initialized with the `radix-nova` preset on Next 16 and Tailwind 4.
Maintenance and security: the CLI is also the CSS package this preset imports. Components were added with the CLI (`button`, `card`, `input`, `badge`, `label`, `textarea`) and then left as source in `src/components/ui`.
Why it is needed: accessible primitives without hand-rolling focus rings and labels. A second component library is not installed.

### `radix-ui` 1.8.1

Purpose: the accessible primitives the shadcn radix-nova components import.
Compatibility: imported as the unified `radix-ui` package (`Slot`, `Label`). Individual `@radix-ui/react-*` packages are not direct dependencies, because this registry version does not import them.
Maintenance and security: Radix primitives. We use them through the generated components.
Why it is needed: shadcn's button, badge, and label delegate behavior to Radix. Removing it breaks those components.

### `class-variance-authority` 0.7.1

Purpose: variant classes for button and badge.
Compatibility: the code the shadcn CLI generated.
Maintenance and security: a class-name helper, no runtime network.
Why it is needed: those components call `cva`. Rewriting them would fork the registry output.

### `cn` 0.5.1

Purpose: class name joining for the generated components.
Compatibility: the package shadcn 4 now imports instead of a local `clsx` plus `tailwind-merge` helper. `src/lib/utils.ts` re-exports it.
Maintenance and security: a small helper.
Why it is needed: every generated component imports it. `clsx` and `tailwind-merge` are not direct dependencies, because this package owns that job.

### `tw-animate-css` 1.4.0

Purpose: animation utilities the shadcn Tailwind layer imports.
Compatibility: Tailwind 4. `globals.css` imports it because the CLI added that import.
Maintenance and security: CSS only.
Why it is needed: removing it breaks the stylesheet the preset generated. Framer Motion is separate and is used for the wordmark, not for these utility classes.

### `lucide-react` 1.66.0

Purpose: the icon set the shadcn preset selected.
Compatibility: React 19.
Maintenance and security: icons, no data access.
Why it is needed: the preset is configured with `iconLibrary: lucide`. The foundation page itself does not need a second icon set.

### `@tanstack/react-query` 5.105.1

Purpose: load `/health` and `/modules`, including pending and error states.
Compatibility: React 19.
Maintenance and security: client cache only. Queries retry once.
Why it is needed: the specified data library. The page does not fetch inside an effect by hand.

### `zustand` 5.0.16

Purpose: the operator note in the browser session.
Compatibility: React 19. The store is not persisted, so the server render and the first client render agree.
Maintenance and security: memory only. The note is not sent to the API and is not a balance.
Why it is needed: the specified client store. It is not used for money.

### `react-hook-form` 7.91.0 and `@hookform/resolvers` 7.0.1

Purpose: the operator note form.
Compatibility: Resolvers 7 accepts Zod 4. See `zod` for the generic constraint.
Maintenance and security: client-side validation before the note reaches Zustand.
Why it is needed: the specified form stack. The Zod schema is the same one the unit test parses.

### `framer-motion` 14.9.0

Purpose: the short entrance on the wordmark.
Compatibility: React 19. Imported from `framer-motion`, which still publishes that entry in 14.9.
Maintenance and security: animation only.
Why it is needed: the specified motion library. It is not used to hide or reveal a balance.

### `storybook` 10.6.5 and `@storybook/react-vite` 10.6.5

Purpose: a story for the safety banner.
Compatibility: Storybook 10 with the React Vite framework and Vite 8.
Maintenance and security: dev and CI build (`build-storybook` is a package script). Stories do not ship in the Next standalone server.
Why it is needed: the specified component workshop. Phase 2 adds stories for the odds button, wallet summary, empty and error states, promotion card, and game card, beside the foundation safety banner.

### `vite` 8.3.5 and `@vitejs/plugin-react` 6.1.2

Purpose: Storybook's bundler, and the peer Vitest accepts.
Compatibility: Vite 8 is in Vitest 5's peer range. Next does not use Vite to build the app.
Maintenance and security: dev tooling.
Why it is needed: `@storybook/react-vite` needs Vite. We do not also run the app on Vite.

## Observability libraries

### `@opentelemetry/sdk-node` 0.300.0, `@opentelemetry/exporter-trace-otlp-http` 0.300.0, and `@opentelemetry/api` 1.10.0

Purpose: a process-wide tracer that can export OTLP HTTP.
Compatibility: the SDK's peer is `@opentelemetry/api` `>=1.10.0 <1.11.0`, so the API package is pinned to 1.10.0. `NodeSDK` accepts `serviceName` and `traceExporter`.
Maintenance and security: the SDK starts only when `OTEL_ENABLED=true` or `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Auto-instrumentation is not installed. It pulls a wide patch set and is not required to prove the bootstrap.
Why it is needed: the specified SDK bootstrap, with a local no-op when nothing is configured. A collector is not in Compose.

### `@sentry/node` 11.10.0

Purpose: capture exceptions when a DSN exists.
Compatibility: `@sentry/nestjs` 11 supports Nest 12, and we still call `@sentry/node` directly so an empty DSN does not install a Nest error integration we would then have to disable. The API filter calls `captureException`, which no-ops without a DSN.
Maintenance and security: no DSN is committed. `tracesSampleRate` is 0.
Why it is needed: the specified optional error reporting. The process must boot in CI without a secret.

### `@prometheus-io/client` 0.16.1

Purpose: the metrics registry and `fable_http_requests_total`.
Compatibility: this is the package that replaced `prom-client`. `prom-client` 15.1.3 is deprecated, so it is not a dependency. The registry API (`Registry`, `Counter`, `collectDefaultMetrics`, `metrics()`) is the one the handler uses.
Maintenance and security: official Prometheus client. `/metrics` is the scrape surface. Grafana is optional and external.
Why it is needed: a real exposition format, not a fake JSON metrics route.

## Phase 2 choices that are not new packages

Password hashes use `node:crypto` `scrypt` (N=16384, r=8, p=1, 32-byte key). Argon2 is the usual alternative and was not added: it needs a native addon, and scrypt is already in the Node 22 runtime this repo pins. The stored form is `scrypt$N$r$p$salt$hash`. Raw passwords are not stored. Login of an unknown email still runs scrypt against a placeholder so the failure is not an obvious timing oracle, and the client receives one generic message.

Sessions are random 32-byte ids in an HttpOnly `SameSite=Lax` cookie, with a separate readable CSRF cookie. Nothing auth-related is written to `localStorage`. No cookie or session library was added.

The Next TypeScript target moved from ES2017 to ES2022 in `packages/config/tsconfig/next.json` so `bigint` literals in the bet-slip helpers typecheck. The lib set stays `dom`, `dom.iterable`, and `esnext`. Node packages were already on a newer target.

No npm dependency was added for Phase 2.

## Explicitly not dependencies

- `class-validator` and `@nestjs/config`: Zod already validates bodies and environment. A second validator would duplicate the schemas.
- `@nestjs/terminus`: three routes do not need a health-check framework.
- `prom-client`: deprecated in favor of `@prometheus-io/client`.
- Prisma 8 release candidate: not a stable major.
- TypeScript 7 as the package named `typescript`: Nest CLI and typescript-eslint cannot build or lint against it yet.
- Jest, Kafka clients, ClickHouse clients, Kubernetes clients, Express, Turborepo: see [architecture](architecture.md) and [CI](ci.md).
