# Casino lobby and nonfinancial Originals

Implemented locally on `codex/phase-7-financial-integrity`, November 2026. Existing uncommitted design, sportsbook and cricket work was retained. No commit, push, pull request, migration, merge or deployment was performed.

## Delivered experience

- Ivory, emerald and champagne lobby with an editorial hero, featured and popular collections, Originals, favorites, and recently played titles.
- API-backed title/description search, category and provider filters, playable/preview filtering, editorial popularity/name/featured sorting, pagination and URL-restored filters.
- Dedicated game details with provider labels, category links, availability, rules, recovery help and authenticated launch controls.
- Favorites use the existing authenticated API and a validated cache scoped to the player in browser storage. Recently played titles are stored separately per player; viewing a detail page does not count as playing.
- Loading, empty, catalog failure, unknown-game, signed-out, session failure and recovery states. Failed favorite writes are visible.
- Native keyboard controls, visible focus indicators, 44px minimum Mines cell targets, responsive cards and no horizontal overflow in the tested layouts.
- Existing original artwork is reused. Its provenance is documented in `apps/web/public/art/README.md`; the four Originals use HTML/CSS and decorative symbols. Names, controls and disclosures remain HTML.

## Categories and actual capability

The catalog contains **19 titles: four playable nonfinancial Originals and 15 discovery previews**.

- Slots: preview discovery only.
- Live Casino: preview discovery only; no live dealers or external providers are connected.
- Table Games, Blackjack, Roulette and Baccarat: preview discovery only.
- Game Shows: preview discovery only.
- Originals: Paper Dice, Fable Mines, Fable Plinko and Fable Limbo are implemented.
- New Games and Popular Games: editorial collections, not live popularity statistics.

`FABLE Preview` and `FABLE Originals` are application-owned catalog labels. Play remains disabled for every unimplemented title.

## Game rules and safety boundary

All four games use **server-generated outcomes** and a **fixed reference of 100 practice points**. These points are calculation inputs, not an account balance or financial stake. No purchase, transfer, wallet debit, wallet credit or settlement occurs. No fairness certification is claimed.

- **Dice:** choose an integer chance from 5 to 95. Draw an integer from 0 through 9,999; a hit is strictly below `chance × 100`. Hit multiplier in basis points is `floor(990000 / chance)`. A miss returns zero.
- **Mines:** choose 1–10 mines on 25 cells. The server samples distinct mine positions, keeps active positions private, validates each reveal/version, and permits one active Mines round per player. After `k` safe cells, multiplier in basis points is `floor(9900 × C(25,k) / C(25−mines,k))`, calculated using BigInt. Finish requires at least one safe reveal; uncovering all safe cells finishes automatically. A mine ends the round with zero. Locations are disclosed only after completion.
- **Plinko:** eight independent binary draws determine an eight-step path and bucket 0–8. Bucket multipliers are 5, 2, 1, 0.5, 0.2, 0.5, 1, 2 and 5.
- **Limbo:** choose an integer target from 2 to 100. Draw `r` uniformly from 1 through 1,000,000. Display `max(1, min(100, floor(99000000 / r) / 100))`. Meeting the target returns `100 × target` practice points; otherwise zero.

Practice returns use `floor(100 × multiplier)`. The displayed multiplier retains up to four decimals so fractional Mines calculations are not misrepresented by rounding to two decimals.

Production code injects Node's `crypto.randomInt` and `randomUUID`. Tests inject controlled randomness. The game engine has no wallet or ledger dependencies. The previous casino financial boundary is not used by these demo endpoints, and no sportsbook transaction code was changed for this sprint.

## Lifecycle and recovery

- Every action is authenticated and protected by the existing session CSRF guard. Request schemas reject client outcomes and unknown fields.
- Idempotency keys are player-scoped and fingerprint the command. Identical retries return the recorded response; key reuse with another payload conflicts.
- Mines actions require the expected version and reject duplicate reveals, stale commands, premature finish and actions after completion.
- Browser Web Locks coordinate tabs. The exact request is saved before POST; uncertain responses keep that request for an explicit retry. Failed storage writes prevent new actions.
- Authentication expiry retains a pending request. The recovery sign-in link performs a full navigation to renew the anonymous CSRF form, after which the same command can be replayed.
- A process-specific session ID prevents an old pending request from silently becoming a new random result after restart or routing to a different process. Such requests receive HTTP 410.
- The demo store is bounded at 10,000 rounds and 100,000 commands per API process and fails closed when full.

## API surface

Added, all authenticated:

- `GET /casino/demo/session`: supported games, current session ID and explicit nonfinancial/process-session flags.
- `GET /casino/demo/rounds?gameId=...`: the current player's most recent 50 matching rounds.
- `GET /casino/demo/rounds/:id`: current player's round only.
- `POST /casino/demo/rounds`: start or replay a supported demo, CSRF protected.
- `POST /casino/demo/rounds/:id/actions`: reveal/finish or replay a Mines action, CSRF protected.

Reused:

- `/casino/games`, `/casino/games/:id`, `/casino/categories`, `/casino/providers`; added playable/preview and popularity filtering to the list API.
- `/favorites` and `/favorites/:gameId` for existing account favorites.
- Existing `/auth/*`, `/wallet` and `/wallet/transactions` contracts. Wallet endpoints were used to verify that Originals do not change balances or entries.

## Verification

Final verification completed on 5 November 2026 against the production frontend build. The local API runs with `FABLE_ENV=test`, `simulated=true`, `realMoney=false`, and no configured PostgreSQL or Redis connection.

- Domain unit tests: **26 passed**, including eight deterministic game-engine tests.
- Frontend unit tests: **29 passed**, including five new storage/replay/isolation tests.
- API tests: **14 passed, one skipped**, including two new actual Nest/Fastify HTTP integration scenarios. Concurrent starts/reveals, replay consistency, hidden Mines state, player isolation, input rejection and unchanged wallet/transaction responses are covered.
- Frontend/API/domain lint and typecheck: **passed** (exit 0).
- API production build: passed.
- Next.js and Storybook production builds: **passed** (exit 0).
- Chromium Playwright suite against production frontend: **32 passed in 1.2 minutes** (exit 0): 11 casino scenarios and 21 existing design, sportsbook, cricket, wallet and authentication scenarios.

**No PostgreSQL verification was performed in this sprint.** The optional Testcontainers gate remains skipped; it is not an executed database test. The integration tests use the application's in-memory test stores. They verify the demo HTTP behavior and absence of wallet effects, not database transaction isolation or durable financial correctness.

Existing toolchain warnings include Vite's CommonJS configuration-loader notice, Storybook dependency `use client` bundling notices, and an EventEmitter listener warning during API tests. These did not cause test/build failures. Only Chromium was exercised; a full screen-reader audit was not performed.

Executed commands (existing Node 22 / pnpm toolchain):

- `pnpm --filter @fable/web --filter @fable/domain test`
- `pnpm --filter @fable/api test`
- `pnpm --filter @fable/web --filter @fable/api --filter @fable/domain typecheck`
- `pnpm --filter @fable/web --filter @fable/api --filter @fable/domain lint`
- `pnpm --filter @fable/api build`
- `pnpm --filter @fable/web build` with `FABLE_DISABLE_COMPILER_CACHE=1`
- `pnpm --filter @fable/web exec playwright test --workers=2`

Final screenshots were visually inspected. The mobile Originals label overlap was corrected and checked by measuring the artwork label against the visible game heading. Lost-response recovery was verified through cookie expiry, sign-in, reload and replay of the same request and round IDs. API and browser assertions confirmed unchanged wallets and transaction histories during game play.

## Files changed for this sprint

Domain:

- `packages/domain/src/casino/originals.ts` — new game engine and rules.
- `packages/domain/src/casino/originals.test.ts` — new deterministic regressions.
- `packages/domain/src/catalog/games.ts` — categories, rules and actual availability.
- `packages/domain/src/index.ts` — public exports.

API:

- `apps/api/src/casino/originals.controller.ts` — new nonfinancial endpoints.
- `apps/api/src/player/player.module.ts` — controller/provider registration.
- `apps/api/src/catalog/catalog.controller.ts` — discovery filters and honest metadata.
- `apps/api/test/originals.e2e.test.ts` — new HTTP integration coverage.

Frontend:

- `apps/web/src/components/casino/casino-browser.tsx`
- `apps/web/src/components/casino/original-player.tsx`
- `apps/web/src/app/(player)/casino/game/[id]/page.tsx`
- `apps/web/src/app/(player)/favorites/page.tsx`
- `apps/web/src/components/game-card.tsx`
- `apps/web/src/components/preview-mark.tsx`
- `apps/web/src/components/shell/nav.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/lib/casino-types.ts`
- `apps/web/src/lib/casino-session.ts`
- `apps/web/src/lib/casino-session.test.ts`
- `apps/web/src/lib/favorites.ts`
- `apps/web/src/lib/favorites-storage.ts`
- `apps/web/src/lib/played.ts`
- `apps/web/src/lib/recent.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/e2e/casino.spec.ts`
- `apps/web/e2e/foundation.spec.ts` — scope existing card assertions to account for intentional repeated discovery sections.

Delivery evidence is in `docs/casino-review/`. The working tree also contains earlier uncommitted sportsbook, cricket and design work; those changes are not newly attributed to this casino sprint. The complete browser suite refreshed its existing design/sportsbook screenshots. Tracked Phase 2 baseline artifacts, which were clean when this sprint resumed, were restored after verification.

## Screenshots

Production-browser captures are stored here:

- `lobby-375.png`, `lobby-768.png`, `lobby-1024.png`, `lobby-1440.png`
- `collection-375.png`, `collection-768.png`, `collection-1024.png`, `collection-1440.png`
- `originals-375.png`, `originals-768.png`, `originals-1024.png`, `originals-1440.png`
- `paper-dice-375.png`, `fable-mines-768.png`, `fable-plinko-1024.png`, `fable-limbo-1440.png`

The four requested widths are checked for overflow. Mines and Plinko additionally run across all four widths, and Mines cells are checked for minimum touch dimensions. Game captures use taller viewports where needed to show the complete practice room.

## Known limitations and next sprint

- Rounds and command records are process-local nonfinancial state. Restart ends that demo session. They are not durable history or suitable for financial wagering, multi-instance continuity or production provider settlement.
- Favorites persist in the browser under the player's ID plus the existing API process. Cross-device changes and deletions are not durably synchronized. When using in-memory authentication, an API restart also loses those test accounts; the browser cache cannot recreate an account or its identity.
- Recently played history is browser-local, capped at 12 titles, and may be unavailable if browser storage is blocked. Safe action recovery requires working storage and Web Locks; unsupported environments fail closed.
- Preview categories have no playable casino integration, and no live dealers are connected. Popularity is editorial. There are no purchasable or transferable practice points.
- Plinko is a displayed server-generated path, not a physics simulation. Dice and Limbo display server results without a fabricated provider client.

Recommended next sprint: durable **nonfinancial** game-session and idempotency storage, persistent account preferences, cross-instance recovery and restart tests against real PostgreSQL, followed by broader browser and assistive-technology coverage. Preserve the separation from wallets and keep real money disabled.
