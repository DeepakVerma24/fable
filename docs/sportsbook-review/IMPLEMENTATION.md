# FABLE — Sportsbook Functional Completion Sprint

Completed locally on 2026-11-04. Branch: `codex/phase-7-financial-integrity`.

## Delivered behavior

- Dedicated Cricket, Football, Tennis and Basketball pages, plus existing Baseball and Hockey support.
- Sports tabs, desktop sidebar links and mobile navigation. Competition pages use the same browser component as sport and all-sports pages.
- Event search, competition/status/format filters, name/time/featured sorting, pagination and URL-persisted filters. Upcoming, simulated in-play and completed sections use actual API catalog data.
- Loading skeletons, retryable API errors, empty results and unavailable-event states.
- Structured, expandable market groups. Open, suspended, closed and unsupported states are distinct. Selected odds remain synchronized with saved drafts.
- Up to 20 persistent draft selections; select one for a single bet. Duplicate prices toggle off rather than creating duplicate entries. Remove, clear-all, stake validation and estimated single returns are available.
- Accumulator UI is explicitly preview-only, with placement disabled. No accumulator request is submitted.
- Persistent pending requests preserve player ID, selection, stake and idempotency key. A separate recovery record cannot be overwritten by ordinary draft edits. Browser Web Locks serialize submissions between tabs; storage failures block submission.
- Fresh availability checks and explicit acceptance of changed odds precede new submissions. Uncertain responses lock editing and expose a retry of the exact saved request, including after reload. Recovery never automatically creates a replacement bet.
- Confirmed placement refreshes wallet, transactions and bet history. Account-scoped history includes search/status/outcome filters, sorting, refresh, empty/error states and bet details.
- Original ivory/emerald styling, artwork and casino functionality retained. A desktop grid regression found during screenshot review was corrected and covered by a bet-rail position assertion.

## Cricket

Four fictional fixtures are supplied by the existing domain catalog and served through the existing API:

- Fable T20 Showcase: frozen simulated second-innings snapshot with runs/wickets, legal balls, target, current/required rates and partial batting/bowling scorecards.
- Fable ODI Series: simulated upcoming fixture with venue and illustrative scheduled time.
- Fable Test Series: completed simulated fixture with four innings and result; placement closed.
- Fable T10 Showcase: simulated fixture with suspended match-winner pricing.

The match centre shows team initials as neutral badges, competition, format, venue/time when supplied, status, available innings and scorecards. Missing information is explicitly unavailable. Scorecards are labeled partial; they do not claim to account for the full innings.

Overs are derived from integer legal-ball counts. For example, 119 balls display as 19.5 overs; current and required rates use six-ball overs, not decimal arithmetic on the display value. Test matches without an innings ball limit do not invent a required rate.

The configurable competition catalog also includes IPL, ICC Men's T20 World Cup, ICC Cricket World Cup, ICC Champions Trophy, The Ashes, BBL, PSL, SA20, CPL, international bilateral series and domestic T20/ODI/Test categories. These named categories have **no fixtures or live coverage implied**. Filtering IPL correctly returns no fixtures.

## Football, tennis and basketball

Existing selections and prices remain in the server catalog. The shared browser, competition routes, expandable markets and match centre now serve these sports. Selected in-play fixtures include explicitly frozen demo goal/point/set snapshots. Events without score data say so; no real clocks or provider feeds are fabricated. Existing football result/totals, basketball moneyline/totals and tennis match-winner selections remain available under the original fixed demo settlement rule.

## Enabled and unavailable markets

Enabled cricket placement: open **Match Winner** selections on the T20 and ODI demo fixtures. Settlement is the existing deterministic selection-ID rule, not cricket-result grading. Suspended T10 and completed Test selections are rejected by the catalog quote boundary as well as disabled in the UI.

UI-only cricket market definitions, with no offered prices or placeable selections: Toss Winner; Total Match Runs Over/Under; Team Total Runs; First Innings Total; Most Sixes; Most Fours; Powerplay Runs; First Over Runs; Top Team Run Scorer; Top Team Wicket Taker; Highest Opening Partnership; Fall of First Wicket; Player Performance Markets.

Accumulator mode remains unavailable for submission. It does not show a fabricated combined price or success state.

## Components and APIs

New shared components: `SportsBrowser`, `MatchCentre`, `BetHistory`.

Reused/extended: `AppShell`, `SportsEventCard`, `MarketGroup`, `OddsButton`, `BetSlip`, `ConfirmDialog`, `WalletSummary`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, existing buttons and inputs.

API integration stays within the existing authenticated API and CSRF client:

- `GET /sports`, `/sports/events`, `/sports/:sport/events`, `/sports/events/:id` for catalog and current availability.
- `GET /auth/me` for account identity, including a pre-submission check.
- `POST /demo/bets` for one server-priced simulated single, with the saved idempotency key.
- `GET /demo/bets` for the current account's history. Details are selected from that authenticated response because no dedicated read endpoint exists.
- Existing wallet/transaction queries are invalidated after confirmed placement.

The sports controller's phase filter now accepts `completed`. Shared catalog metadata adds cricket formats, innings, market status/group and optional sport scores. No ledger, reservation, settlement, cancellation, refund transaction code or database schema was changed.

## Files changed for this sprint

Routes and navigation:

- `apps/web/src/app/(player)/sports/[sport]/page.tsx`
- `apps/web/src/app/(player)/sports/[sport]/competition/[competition]/page.tsx` (new)
- `apps/web/src/app/(player)/sports/event/[id]/page.tsx`
- `apps/web/src/app/(player)/bets/page.tsx` and `bets/[id]/page.tsx` (new)
- `apps/web/src/app/(player)/wallet/page.tsx`
- `apps/web/src/components/shell/app-shell.tsx`, `shell/nav.ts`, `apps/web/src/proxy.ts`

Components and models:

- `apps/web/src/components/sports/sports-browser.tsx`, `match-centre.tsx`, `bet-history.tsx` (new), and `sports-home.tsx`
- `apps/web/src/components/bet-slip.tsx`, `market-group.tsx`, `sports-event-card.tsx`, `odds-button.tsx`
- `apps/web/src/lib/bet-placement.ts`, `sports.ts` (new), `bet-slip.ts`, `types.ts`
- `apps/web/src/app/globals.css` (sports controls and desktop rail correction, preserving the prior theme)
- `packages/domain/src/catalog/cricket.ts` (new), `catalog/sports.ts`
- `apps/api/src/sports/sports.controller.ts`

Tests and evidence:

- `apps/web/src/lib/bet-slip.test.ts`, `sports.test.ts` (new)
- `packages/domain/src/catalog/sports.test.ts` (new)
- `apps/api/test/player.e2e.test.ts`
- `apps/web/e2e/foundation.spec.ts` (updated for persisted selections and honest uncertain-response messaging)
- `apps/web/e2e/sportsbook.spec.ts` (new)
- `docs/sportsbook-review/` (this report and 12 screenshots)

Earlier uncommitted frontend redesign changes, including its original artwork and editorial tests, remain in the working tree. The overall Git diff therefore includes that prior work as well as this sprint.

## Exact verification results

- `pnpm --filter @fable/web --filter @fable/api --filter @fable/domain lint`: passed for all three packages, exit 0.
- `pnpm --filter @fable/web --filter @fable/api --filter @fable/domain typecheck`: passed for all three packages, exit 0.
- `pnpm --filter @fable/web test`: **24 passed**, 5 files, exit 0.
- `pnpm --filter @fable/domain test`: **18 passed**, 3 files, exit 0.
- `pnpm --filter @fable/api test`: **12 passed, 1 skipped**, 6 passing files and 1 skipped file, exit 0. The skipped test is the existing opt-in Testcontainers gate, which is not a PostgreSQL verification.
- Domain TypeScript build and Nest API build: passed, exit 0.
- `FABLE_DISABLE_COMPILER_CACHE=1 pnpm --filter @fable/web build`: **Next.js and Storybook both passed**, exit 0.
- `pnpm --filter @fable/web test:e2e --workers=2`, using the final production frontend build and the local simulated API: **21 passed (1.3 minutes)**, exit 0. Includes all existing editorial/foundation tests and 11 new sportsbook tests.
- Responsive overflow checks: passed at **375, 768, 1024 and 1440px**. Desktop rail position is also asserted.

Browser coverage includes competition filtering and pages, cricket details/overs, existing sport details, disabled suspended/completed markets, draft persistence and duplicate prevention, accumulator rejection in the UI, actual API single placement/history, odds-change acceptance, known rejection, lost committed response followed by reload/retry, two-tab submission coordination, loading, retryable errors, keyboard focus and mobile menu/slip interactions. Unit tests also exercise storage failures, corrupt recovery data and player-scoped replay.

Initial browser attempts failed during host sleep/network changes and then exposed encoded competition names and selectors matching cached hidden Next.js pages. Those issues were resolved; the final full production run passed. Vite's existing config-loader warning and Storybook build-size/timing advisories remained nonblocking. The existing local `next start` script emits a standalone-output advisory; this run verifies local behavior, not deployment packaging.

## Screenshots

Captured from the final production build and visually reviewed. `cricket-375.png` and all match-centre captures are full-page images; fixed mobile navigation remains at the viewport edge within a full-page capture.

- Desktop: [Cricket browser](cricket-1440.png), [match centre](match-1440.png), [draft slip](slip-1440.png).
- Mobile: [Cricket browser](cricket-375.png), [match centre](match-375.png), [expanded slip](slip-375.png).
- Tablet: matching `cricket`, `match` and `slip` captures at 768 and 1024px.

## Known limitations and next sprint

- Simulated singles only. There are no live providers, actual competition schedules, real result grading, player-market settlement or accumulator placement.
- The backend still has no versioned quote/expected-odds contract. The UI refreshes quotes and checks again immediately before posting, while the server remains the price authority. The current catalog is static; a future changing feed needs an atomic quote-acceptance contract before it can guarantee an accepted price across the request boundary.
- Recovery identifiers are browser-local. Clearing site data or switching devices cannot recover an unresolved request through this UI; account history remains the available source of confirmed results. A server operation-status endpoint is recommended before more complex workflows.
- Web Locks and working browser storage are required for placement. Unsupported browsers fail closed. Chromium was verified; Safari, Firefox and physical devices were not tested.
- API/browser integration ran against the existing in-memory simulated test configuration. This sprint does **not** claim new PostgreSQL financial verification. Existing ledger/transaction implementation was preserved.
- Catalog filtering and history details are client-side over the existing read APIs. Larger provider-backed catalogs would need server search/sort, bounded pagination and richer score contracts.

Recommended next sprint: define and verify server quote/version and operation-status contracts, then expand read-only sport data with provider contract tests. Add cricket settlement types or accumulator placement only after their server validation, lifecycle, idempotency, recovery and PostgreSQL concurrency checks are independently verified.

No dependencies added. No database migrations, credential changes, commits, pushes, PRs, merges, deployments or real-money activation.
