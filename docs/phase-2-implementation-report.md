# Phase 2 implementation report

Verified on 1 November 2026, evening Asia/Calcutta. The player UI, API, and tests below were exercised in this workspace. Claims match those runs.

## Implemented features

- Black and white player theme. Dark is the default. Tokens follow the locked palette. The faintest meta color is `#8B949E` instead of `#747D89`, because `#747D89` is about 4.6:1 on `#0B0D10` and small labels needed a clearer AA contrast. Body secondary text stays `#A9B0BA`. Semantic green, red, and amber are limited to status.
- Geist for UI and numbers, with tabular figures.
- Application shell: top navigation, sidebar from the `lg` breakpoint, right slip rail on Discover and Sports from `xl`, search, demo balance, notifications, profile menu, mobile drawer, and a five-item bottom bar. The slip is a dialog below 1280px and the rail at 1280px and wider, so only one slip is in the accessibility tree.
- Routes: `/`, `/casino`, `/casino/slots`, `/casino/live`, `/casino/game/[id]`, `/sports`, `/sports/[sport]`, `/sports/event/[id]`, `/wallet`, `/transactions`, `/promotions`, `/promotions/[id]`, `/profile`, `/settings`, `/login`, `/register`, `/favorites`, `/search`. Loading, error, empty, and not-found states are real components.
- Homepage sections for fixtures, simulated in-play rows, featured and recommended previews, categories, promotions, and recently viewed items stored in this browser tab.
- Casino lobby with search, category chips, provider filter, and save for a signed-in player. Tiles use an original geometric mark. Every game is `playable: false` and labeled Preview. Nothing launches a provider client.
- Sportsbook with sport and competition filters, event pages, decimal prices, suspended markets, and a single-selection demo slip. Stake validation, estimated payout, and submit go through the API. The server quotes the fixture and ignores the price the browser displayed.
- Registration, login, logout, current user, and display-name update. Passwords are scrypt hashes. Sessions are HttpOnly cookies. Mutations require a CSRF header. Login and register are rate limited. Unknown email and wrong password share one message. Protected routes redirect when `fable_session` is missing.
- Demo wallet in FBU (Fable demo units): available, reserved, and a journal list with status, reference, and time in Asia/Calcutta. Copy states the units cannot be withdrawn. Opening credit and bet settlement go through the existing ledger. Controllers do not write balances.

## API endpoints

Existing health, readiness, metrics, and modules routes are unchanged.

| Method | Path                    | Auth                                                                    |
| ------ | ----------------------- | ----------------------------------------------------------------------- |
| GET    | `/auth/csrf`            | Public. Sets the CSRF cookie.                                           |
| POST   | `/auth/register`        | CSRF cookie plus rate limit.                                            |
| POST   | `/auth/login`           | CSRF cookie plus rate limit.                                            |
| POST   | `/auth/logout`          | Session and session CSRF.                                               |
| GET    | `/auth/me`              | Session.                                                                |
| PATCH  | `/auth/profile`         | Session and session CSRF.                                               |
| GET    | `/casino/categories`    | Public.                                                                 |
| GET    | `/casino/providers`     | Public.                                                                 |
| GET    | `/casino/games`         | Public. Query: `q`, `category`, `provider`, `sort`, `page`, `pageSize`. |
| GET    | `/casino/games/:id`     | Public.                                                                 |
| GET    | `/search`               | Public.                                                                 |
| GET    | `/sports`               | Public. `liveFeed` is false.                                            |
| GET    | `/sports/events`        | Public. Query: `phase`, `competition`, page.                            |
| GET    | `/sports/events/:id`    | Public.                                                                 |
| GET    | `/sports/:sport/events` | Public.                                                                 |
| GET    | `/demo/bets`            | Session.                                                                |
| POST   | `/demo/bets`            | Session and session CSRF.                                               |
| GET    | `/wallet`               | Session.                                                                |
| GET    | `/wallet/transactions`  | Session.                                                                |
| GET    | `/promotions`           | Public.                                                                 |
| GET    | `/promotions/:id`       | Public.                                                                 |
| GET    | `/favorites`            | Session.                                                                |
| PUT    | `/favorites/:gameId`    | Session and session CSRF.                                               |
| DELETE | `/favorites/:gameId`    | Session and session CSRF.                                               |

OpenAPI is the Nest Swagger document at `/docs`. The description now names the demo catalog, simulated wallet, and demo bets.

The browser calls these through Next's `/backend` rewrite so `Set-Cookie` stays on the web origin.

## Database changes

Migration `20261101183000_player_auth`:

- `users.display_name` and `users.password_hash` (scrypt string, not a raw password).
- `sessions` with id, user, CSRF token, expiry, and a cascade delete.

The init migration and its ledger triggers are unchanged. There is still no balance column.

`PrismaPlayerStore` is used when `DATABASE_URL` is set. Otherwise users and sessions are in memory. Favorites and the demo bet book are in memory in both modes. The money record is the journal.

## Ledger behavior for a demo bet

Currency `FBU`. Grant is 100,000 minor units (1,000.00) from `house.demo` to `wallet.{userId}`, idempotency key `demo-grant-{userId}`.

A slip posts two `SIMULATED_SPORTSBOOK_SETTLEMENT` journals, both with `simulated: true`:

1. Debit available, credit `wallet.{userId}.hold` (reserve).
2. Settle in the same request. A win returns the payout to available and debits `house.sportsbook` for the profit. A loss moves the hold to the house.

Reserved is derived and is zero again after a successful submit. Win or loss is the parity of the selection id. The slip says this is not a sports result.

## Changed files

Foundation files that moved, plus new player modules. Grouped:

- `apps/web` shell, routes, casino, sports, wallet, auth client, stories, proxy, Playwright.
- `apps/api` auth, catalog, sports, bets, wallet, promotions, favorites, cookies, rate limit, player module, `player.e2e.test.ts`.
- `packages/domain` catalog, `DemoWallet`, `DemoSportsbook`, player store interface, ledger `postedAt` and `listPosted`.
- `packages/database` user and session schema, auth migration, `PrismaPlayerStore`, ledger list.
- `packages/config/tsconfig/next.json` target ES2022 so `bigint` literals typecheck.
- `docs/architecture.md`, `docs/financial-safety.md`, `docs/local-development.md`, `docs/technology-decisions.md`, `README.md`, this report, and `docs/phase-2/`.

No new npm dependency. Password hashing is Node `scrypt`. Cookies are written by the API.

## Test results

| Command                             | Result                                                                                                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                         | Pass. ESLint on every package and `prettier --check`.                                                                                                                                                                                   |
| `pnpm typecheck`                    | Pass. Domain, observability, database, web, API, worker.                                                                                                                                                                                |
| `pnpm test`                         | Pass. Domain 14, web 7, observability 3, database 2, worker 2, API 11 passed and 1 skipped.                                                                                                                                             |
| `pnpm build`                        | Pass. API `nest build`, worker `tsc`, Next.js production build (21 routes) and Storybook. Vite `use client` notices from Radix are warnings, and the Storybook build completed.                                                         |
| `pnpm --filter @fable/web test:e2e` | Pass. 5 tests: home and lobbies, demo bet (signed-out control disabled, register, 1,000.00 FBU, West Signal at 10.00, demo win, wallet 1,032.00 FBU), protected redirect, mobile nav with no horizontal overflow at 375px, screenshots. |

The skipped API test is `apps/api/test/testcontainers.gate.test.ts`. It runs only when `FABLE_TESTCONTAINERS=1`. Docker is not available here, and `@testcontainers/postgresql` is not installed.

Not run, and not counted as passed:

- Testcontainers against Postgres.
- `docker compose` image builds.
- `terraform apply`.
- `k6 run load/k6/health.js` (k6 is not installed).
- A Pact broker. OpenAPI remains the contract.

`GET /health` during this verification returned `status: ok`, `simulated: true`, `realMoney: false`. The web app on port 3847 returned 200.

## Performance

Homepage `/` at 1440×900, `PerformanceNavigationTiming`, against the already running Next dev server (Playwright `reuseExistingServer`):

- response start: 37 ms
- DOM content loaded: 125 ms
- load event end: 400 ms

That is a warm dev navigation, not a cold production start. Recorded in `docs/phase-2/navigation-timing.json` by the screenshot test.

## Screenshots

Taken by Playwright after fixture and preview links were visible. The small Next mark in the corner is the dev tools indicator from `next dev`, not part of the product UI.

- `docs/phase-2/screenshots/home-1440.png`
- `docs/phase-2/screenshots/home-768.png`
- `docs/phase-2/screenshots/home-375.png`
- `docs/phase-2/screenshots/casino-1280.png`
- `docs/phase-2/screenshots/casino-375.png`
- `docs/phase-2/screenshots/sports-1440.png`
- `docs/phase-2/screenshots/sports-1920.png`

Wallet amounts were checked in the bet-slip test (1,000.00 FBU, then 1,032.00 FBU). There is no separate wallet screenshot.

## Known limitations

- Without `DATABASE_URL`, users, sessions, and journals live in the API process and vanish on restart. With Postgres, users, sessions, and journals persist after the auth migration. Favorites and the bet metadata book do not.
- Games are previews. No provider is connected, and no tile is playable.
- Odds and "demo in-play" rows are a fixed catalog. They are not a live feed and they are not labeled as one.
- A demo bet settles in the same request, so the reserved figure the player sees after submit is zero. The hold account still exists for the reserve journal.
- Outcome is a checksum of the selection id, documented on the slip. It is not a match result.
- There is no deposit, withdrawal, crypto transfer, password change, or real-money path. `REAL_MONEY` in the environment is ignored.
- Notifications are three static notices.
- ESLint stays on 9.39.5, TypeScript on 6.0.3, and Prisma on 7.10.1 for the reasons in `docs/technology-decisions.md`.
- This is not a production-ready casino or sportsbook.

## Deferred work

Kafka, Kubernetes, ClickHouse, a Pact broker, and k6 as a CI gate stay out. The foundation notes still describe when each would be justified. Durable favorites, a password change, and a reserved balance that remains open across requests are product work, not infrastructure work. They were not required to prove the ledger path.

## Next recommended phase

Keep simulated money. Add a durable favorite store and an explicit open-hold demo bet that settles on a later request, still only through `DemoSportsbook` and the ledger. Do not connect a live odds feed or a game provider until there is a license and a contract for that data.
