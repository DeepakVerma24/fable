import { expect, test, type Page } from '@playwright/test';

async function register(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Display name').fill('Sports player');
  await page
    .getByLabel('Email')
    .fill(`sports-${Date.now()}-${Math.random().toString(16).slice(2)}@example.invalid`);
  await page.getByLabel('Password').fill('a-long-password');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'FABLE', exact: true })).toBeVisible();
}
async function openSlip(page: Page, width: number) {
  if (width < 1280 && !(await page.getByRole('dialog').isVisible()))
    await page.getByRole('button', { name: /^Slip \(/ }).click();
  return width < 1280 ? page.getByRole('dialog') : page.locator('.slip-panel');
}
async function noOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
}
for (const width of [375, 768, 1024, 1440]) {
  test(`cricket navigation, persistent drafts and accumulator safeguard at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.goto('/sports');
    await page
      .getByRole('navigation', { name: 'Sports', exact: true })
      .getByRole('link', { name: 'Cricket', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Cricket', exact: true })).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Competition', exact: true })
      .selectOption('Indian Premier League (IPL)');
    await expect(
      page.getByRole('status').filter({ hasText: '0 simulated fixtures found' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ivory XI vs Emerald XI' })).toHaveCount(0);
    await page
      .getByRole('combobox', { name: 'Competition', exact: true })
      .selectOption('Fable T20 Showcase');
    await page.getByRole('combobox', { name: 'Cricket format', exact: true }).selectOption('T20');
    await expect(
      page.getByRole('status').filter({ hasText: '1 simulated fixtures found' }),
    ).toBeVisible();
    await noOverflow(page);
    if (width >= 1280) {
      const rail = await page.locator('.bet-rail').boundingBox();
      const main = await page.locator('main').boundingBox();
      expect(rail!.x).toBeGreaterThanOrEqual(main!.x + main!.width - 1);
      expect(rail!.y).toBeLessThan(200);
    }
    await page.screenshot({
      path: `../../docs/sportsbook-review/cricket-${width}.png`,
      fullPage: width < 768,
    });
    await page.getByRole('link', { name: 'Ivory XI vs Emerald XI' }).click();
    await expect(page.getByRole('heading', { name: 'Cricket match centre' })).toBeVisible();
    await expect(page.getByText('170/5 (19.5 overs)')).toBeVisible();
    await expect(page.getByText('42.00', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Available simulated batting rows' }),
    ).toBeVisible();
    await page.getByText('Innings & match markets', { exact: true }).click();
    await page.getByText('Toss Winner · unavailable', { exact: true }).click();
    await expect(page.getByText(/Unavailable for placement: no validated/).first()).toBeVisible();
    await noOverflow(page);
    await page.getByText('Innings & match markets', { exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../../docs/sportsbook-review/match-${width}.png`,
      fullPage: true,
    });
    const price = page.getByRole('button', { name: 'Ivory XI 1.85', exact: true });
    await price.click();
    let slip = await openSlip(page, width);
    await expect(slip.getByText('1 draft selections · Fable demo units')).toBeVisible();
    await slip.getByLabel('Stake (FBU)').fill('25.00');
    await page.reload();
    slip = await openSlip(page, width);
    await expect(slip.getByLabel('Stake (FBU)')).toHaveValue('25.00');
    if (width < 1280) await slip.getByRole('button', { name: 'Close', exact: true }).click();
    await price.click();
    await price.click(); // Toggle off and back on must not create duplicates.
    slip = await openSlip(page, width);
    await expect(slip.getByText('1 draft selections · Fable demo units')).toBeVisible();
    await page.goto('/sports/event/crk-harbor-odi');
    await page.getByRole('button', { name: 'Harbor XI 1.85', exact: true }).click();
    slip = await openSlip(page, width);
    await expect(slip.getByText('2 draft selections · Fable demo units')).toBeVisible();
    let posts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/demo/bets')) posts++;
    });
    await slip.getByRole('button', { name: 'Accumulator', exact: true }).click();
    await expect(slip.getByRole('button', { name: 'Accumulator unavailable' })).toBeDisabled();
    expect(posts).toBe(0);
    await noOverflow(page);
    await page.screenshot({ path: `../../docs/sportsbook-review/slip-${width}.png` });
    await slip.getByRole('button', { name: 'Single bet', exact: true }).click();
    await expect(slip.getByRole('button', { name: 'Sign in to submit' })).toBeDisabled();
    await slip.getByRole('button', { name: 'Clear all selections' }).click();
    await expect(slip.getByText('Slip is empty')).toBeVisible();
    if (width < 1280) {
      await slip.getByRole('button', { name: 'Close', exact: true }).click();
      if (width < 1024) {
        await page.getByRole('button', { name: 'Open menu' }).click();
        await page.getByRole('dialog').getByRole('link', { name: 'Football', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Football', exact: true })).toBeVisible();
      }
    }
  });
}

test('competition pages, status/search filters and existing sport details', async ({ page }) => {
  await page.goto('/sports/cricket');
  await page.getByText('Competitions · 17', { exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Competitions', exact: true })
    .getByRole('link', { name: 'Fable Test Series', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Fable Test Series', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Event status', exact: true }).selectOption('completed');
  await page.getByRole('link', { name: 'Archive XI vs Pavilion XI' }).click();
  await expect(page.getByText('Archive XI won by 75 runs (simulated)')).toBeVisible();
  await expect(page.getByRole('button', { name: /Archive XI · Closed/ })).toBeDisabled();
  await page.goto('/sports/event/crk-coast-t10');
  await expect(page.getByRole('button', { name: /Coast XI · Suspended/ })).toBeDisabled();
  for (const [sport, id, detail] of [
    ['football', 'fbl-paper-city', 'Goals'],
    ['tennis', 'ten-glass', 'Sets'],
    ['basketball', 'bsk-archive', 'Points'],
  ]) {
    await page.goto(`/sports/${sport}`);
    await page
      .getByRole('searchbox', { name: 'Search events', exact: true })
      .fill('not-on-the-board');
    await expect(
      page.getByRole('status').filter({ hasText: '0 simulated fixtures found' }),
    ).toBeVisible();
    await page.goto(`/sports/event/${id}`);
    await expect(page.getByText(new RegExp(`${detail} · Simulated`))).toBeVisible();
  }
});

test('cricket single settles through the actual API and appears in account history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await register(page);
  await page.goto('/sports/event/crk-ivory-t20');
  await page.getByRole('button', { name: 'Ivory XI 1.85', exact: true }).click();
  const slip = page.locator('.slip-panel');
  await slip.getByLabel('Stake (FBU)').fill('10.00');
  await slip.getByRole('button', { name: 'Submit demo bet', exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(slip.getByRole('link', { name: 'View bet details' })).toBeVisible();
  await slip.getByRole('link', { name: 'View bet details' }).click();
  await expect(page.getByRole('heading', { name: 'Demo bet details' })).toBeVisible();
  await expect(page.getByText('deterministic-demo', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'All demo bets', exact: true }).click();
  await expect(page.getByRole('link', { name: /Ivory XI · Demo/ })).toBeVisible();
  await page.getByLabel('Search bets').fill('no-such-bet');
  await expect(page.getByText('No demo bets found')).toBeVisible();
});

test('odds changes require acceptance and completed events disable a saved draft', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await register(page);
  await page.goto('/sports/event/crk-ivory-t20');
  await page.getByRole('button', { name: 'Ivory XI 1.85', exact: true }).click();
  let closed = false;
  await page.route('**/backend/sports/events/crk-ivory-t20', async (route) => {
    const upstream = await route.fetch();
    const data = await upstream.json();
    data.markets[0].selections[0].decimalOdds = '2.10';
    if (closed) data.phase = 'completed';
    await route.fulfill({ response: upstream, json: data });
  });
  await page.reload();
  const slip = page.locator('.slip-panel');
  await expect(slip.getByText('Odds changed: 1.85 → 2.10')).toBeVisible();
  await expect(slip.getByRole('button', { name: 'Submit demo bet' })).toBeDisabled();
  await slip.getByRole('button', { name: 'Accept new odds 2.10' }).click();
  await expect(slip.getByRole('button', { name: 'Submit demo bet' })).toBeEnabled();
  closed = true;
  await page.reload();
  await expect(
    slip.getByText('Selection suspended, closed or unavailable. Placement is disabled.'),
  ).toBeVisible();
  await expect(slip.getByRole('button', { name: 'Submit demo bet' })).toBeDisabled();
});

test('definitive rejection preserves the draft and allows a corrected retry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await register(page);
  await page.goto('/sports/event/crk-harbor-odi');
  await page.getByRole('button', { name: 'Harbor XI 1.85', exact: true }).click();
  await page.route('**/backend/demo/bets', async (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 400, json: { message: 'Demo balance does not cover that stake.' } })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Submit demo bet' }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('Demo balance does not cover that stake.')).toBeVisible();
  await expect(page.getByLabel('Stake (FBU)')).toBeEnabled();
  await expect(page.getByRole('link', { name: 'View bet details' })).toHaveCount(0);
  await page.unroute('**/backend/demo/bets');
  await page.getByLabel('Stake (FBU)').fill('5.00');
  await page.getByRole('button', { name: 'Submit demo bet' }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('link', { name: 'View bet details' })).toBeVisible();
});

test('sports loading, API error recovery and keyboard focus', async ({ page }) => {
  let failed = true;
  await page.route('**/backend/sports/cricket/events?*', async (route) =>
    failed ? route.fulfill({ status: 503, json: { message: 'Test outage' } }) : route.continue(),
  );
  await page.goto('/sports/cricket');
  await expect(page.getByRole('alert').filter({ hasText: 'Fixtures did not load' })).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('link', { name: 'Ivory XI vs Emerald XI' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search events', exact: true }).focus();
  await expect(page.getByRole('searchbox', { name: 'Search events', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Competition', exact: true })).toBeFocused();
});

test('two tabs coordinate a single request without a second debit', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await register(page);
  await page.goto('/sports/event/fbl-north-harbor');
  await page.getByRole('button', { name: 'West Signal 4.20', exact: true }).click();
  const second = await context.newPage();
  await second.setViewportSize({ width: 1440, height: 1000 });
  await second.goto('/sports/event/fbl-north-harbor');
  const keys: string[] = [];
  await context.route('**/backend/demo/bets', async (route) => {
    if (route.request().method() === 'POST')
      keys.push(route.request().postDataJSON().idempotencyKey);
    await route.continue();
  });
  await page.getByRole('button', { name: 'Submit demo bet', exact: true }).click();
  await second.getByRole('button', { name: 'Submit demo bet', exact: true }).click();
  await Promise.all([
    page.getByRole('button', { name: 'Submit', exact: true }).click(),
    second.getByRole('button', { name: 'Submit', exact: true }).click(),
  ]);
  await expect.poll(() => keys.length).toBeGreaterThan(0);
  await expect
    .poll(async () => (await (await page.request.get('/backend/demo/bets')).json()).items.length)
    .toBe(1);
  const wallet = await (await page.request.get('/backend/wallet')).json();
  expect(wallet.availableMinor).toBe('103200');
  expect(new Set(keys).size).toBe(1);
  await second.close();
});

test('loading fixtures renders an accessible skeleton', async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/backend/sports/cricket/events?*', async (route) => {
    await ready;
    await route.continue();
  });
  await page.goto('/sports/cricket');
  await expect(page.locator('main [aria-busy="true"]')).toBeVisible();
  release();
  await expect(page.getByRole('link', { name: 'Ivory XI vs Emerald XI' })).toBeVisible();
});
