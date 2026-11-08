# FABLE frontend design implementation

Implemented the approved ivory, emerald and champagne direction in the existing Next.js frontend. Existing API data, routes, authentication and simulated single-selection betting remain authoritative. Original generated artwork is documented in apps/web/public/art/README.md.

## Verification

- Frontend typecheck: passed.
- ESLint: passed.
- Vitest: 10 tests passed across 4 files.
- Production build: Next.js and Storybook both passed.
- Chromium browser suite against the production build: 10 tests passed (27.2 seconds).
- Final image-decoding-aware screenshot checks: 4 passed (13.2 seconds), covering 375, 768, 1024 and 1440px with no horizontal overflow.
- Browser coverage includes navigation, wallet authentication redirect, odds selection/removal, accessible stake input, disabled signed-out submission, authenticated demo submission, and retry after a lost committed response without a second debit.
- Screenshots visually inspected; tablet text contrast, mobile hero composition, desktop slip alignment and duplicate stake input IDs were corrected.

## Screenshots and differences

home-{width}.png and slip-{width}.png capture all four requested widths. Mobile homepage capture is full-page; mobile slip captures show the expanded dialog.

The artwork is original and deliberately differs from the reference. Game names, fixtures, odds and wallet controls come from existing application behavior. The slip supports the existing single-selection simulated workflow, without a new accumulator or deposit feature. Existing additional homepage sections remain available.

Browser coverage is Chromium, not physical-device or Safari verification. Initial automatic development-server startup timed out; checks subsequently passed using explicitly started local API and frontend servers. The built application was served locally with the existing start script (which emits Next's standalone-output advisory); this is not deployment validation. Vite emitted its existing config-loader compatibility warning, and Storybook emitted build-size/timing advisories. None prevented successful checks.

No backend financial changes, database migrations, new dependencies, real-money activation, push, merge or deployment.
