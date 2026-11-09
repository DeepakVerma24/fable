import { expect, test, type Page } from '@playwright/test';

async function register(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Display name').fill('Casino player');
  const email = `casino-${Date.now()}-${Math.random().toString(16).slice(2)}@example.invalid`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('a-long-password');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'FABLE', exact: true })).toBeVisible();
  return email;
}
async function launch(page: Page, id: string) {
  await page.goto(`/casino/game/${id}`);
  await page.getByRole('button', { name: 'Play nonfinancial demo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Nonfinancial game' })).toBeVisible();
  return page.getByRole('region', { name: 'Nonfinancial game' });
}
async function noOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
}
async function walletState(page: Page) {
  const wallet = await page.request.get('/backend/wallet');
  const entries = await page.request.get('/backend/wallet/transactions');
  expect(wallet.ok()).toBe(true);
  expect(entries.ok()).toBe(true);
  return { wallet: await wallet.json(), entries: await entries.json() };
}

test('catalog presents an accessible loading state until the API responds', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/backend/casino/games?*', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/casino');
  const catalog = page.getByRole('region', { name: 'Game catalog', exact: true });
  await expect(catalog.locator('[aria-busy="true"]')).toBeVisible();
  release();
  await expect(catalog.getByRole('status')).toContainText('19 titles found');
  await expect(catalog.locator('[aria-busy="true"]')).toHaveCount(0);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`casino discovery and preview safeguards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.goto('/casino');
    const catalog = page.getByRole('region', { name: 'Game catalog', exact: true });
    await expect(catalog.getByRole('status')).toContainText('19 titles found');
    await expect(
      page.getByRole('region', { name: 'Featured games' }).getByRole('article'),
    ).toHaveCount(4);
    await expect(
      page.getByRole('region', { name: 'FABLE Originals', exact: true }).getByRole('article'),
    ).toHaveCount(4);
    await noOverflow(page);
    expect(
      await page
        .getByRole('region', { name: 'FABLE Originals', exact: true })
        .locator('.game-card')
        .evaluateAll((cards) =>
          cards.every((card) => {
            const mark = card.querySelector('.original-art small')!.getBoundingClientRect();
            const title = card.querySelector('h3')!.getBoundingClientRect();
            return mark.bottom <= title.top;
          }),
        ),
    ).toBe(true);
    await page.screenshot({
      path: `../../docs/casino-review/lobby-${width}.png`,
      fullPage: false,
    });
    await page
      .getByRole('region', { name: 'FABLE Originals', exact: true })
      .evaluate((element) =>
        window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 140),
      );
    await page.screenshot({ path: `../../docs/casino-review/originals-${width}.png` });
    await catalog.evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 140),
    );
    await page.screenshot({ path: `../../docs/casino-review/collection-${width}.png` });
    await catalog.getByRole('searchbox', { name: 'Search games' }).fill('paper dice');
    await expect(catalog.getByRole('status')).toContainText('1 titles found');
    await catalog.getByRole('link', { name: /Paper Dice/ }).click();
    await expect(page.getByRole('heading', { name: 'Paper Dice', exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Sign in to play demo', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rules & information' })).toBeVisible();
    await noOverflow(page);
    await page.goto('/casino/game/northline-reels');
    await expect(page.getByRole('button', { name: 'Play unavailable' })).toBeDisabled();
    await expect(
      page.getByText(
        'No playable provider client or live dealer is connected. This artwork is a discovery preview only.',
      ),
    ).toBeVisible();
    await page.getByRole('link', { name: '← Back to lobby' }).click();
    await expect(page.getByRole('heading', { name: 'Casino lobby' })).toBeVisible();
  });
}

test('category/provider filters, sorting, pagination, empty results and URL restoration', async ({
  page,
}) => {
  await page.goto('/casino');
  const catalog = page.getByRole('region', { name: 'Game catalog', exact: true });
  await catalog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(catalog.getByText('Page 2 of 2')).toBeVisible();
  await catalog.getByRole('button', { name: 'Previous', exact: true }).click();
  await catalog
    .getByRole('combobox', { name: 'Provider', exact: true })
    .selectOption('FABLE Originals');
  await catalog
    .getByRole('combobox', { name: 'Availability', exact: true })
    .selectOption('playable');
  await catalog.getByRole('combobox', { name: 'Sort games', exact: true }).selectOption('name');
  await expect(catalog.getByRole('article')).toHaveCount(4);
  expect(await catalog.getByRole('heading', { level: 3 }).allTextContents()).toEqual([
    'Fable Limbo',
    'Fable Mines',
    'Fable Plinko',
    'Paper Dice',
  ]);
  await page.reload();
  await expect(catalog.getByRole('combobox', { name: 'Provider', exact: true })).toHaveValue(
    'FABLE Originals',
  );
  await catalog.getByRole('searchbox', { name: 'Search games' }).fill('no-such-game');
  await expect(catalog.getByText('No games found', { exact: true })).toBeVisible();
  for (const category of [
    'Slots',
    'Live Casino',
    'Table Games',
    'Blackjack',
    'Roulette',
    'Baccarat',
    'Game Shows',
    'Originals',
  ]) {
    await page
      .getByRole('navigation', { name: 'Casino categories', exact: true })
      .getByRole('link', { name: category, exact: true })
      .click();
    await expect(catalog.getByRole('article').first()).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Casino categories', exact: true })
        .getByRole('link', { name: category, exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  }
});

test('catalog failures are visible and retry recovers; unknown games stay unavailable', async ({
  page,
}) => {
  await page.route('**/backend/casino/games?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"message":"Catalog unavailable"}',
    }),
  );
  await page.goto('/casino');
  const catalog = page.getByRole('region', { name: 'Game catalog', exact: true });
  await expect(catalog.getByText('The catalog did not load.')).toBeVisible();
  await page.unroute('**/backend/casino/games?*');
  await catalog.getByRole('button', { name: 'Try again' }).click();
  await expect(catalog.getByRole('status')).toContainText('19 titles found');
  await page.goto('/casino/game/not-a-real-game');
  await expect(page.getByRole('alert').filter({ hasText: 'Game unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Play/ })).toHaveCount(0);
});

test('favorites survive reload and API-session loss, with visible save failures and removal', async ({
  page,
}) => {
  await register(page);
  await page.goto('/casino/game/paper-dice');
  await page.route('**/backend/favorites/paper-dice', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"message":"Try again"}',
    }),
  );
  await page.getByRole('button', { name: 'Save to favorites', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not update favorites' }),
  ).toBeVisible();
  await page.unroute('**/backend/favorites/paper-dice');
  await page.getByRole('button', { name: 'Save to favorites', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  // Existing API favorites are process-local; valid browser favorites remain discoverable.
  await page.route('**/backend/favorites', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"items":[]}' }),
  );
  await page.goto('/favorites');
  await expect(page.getByRole('link', { name: /Paper Dice/ })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Paper Dice from favorites' }).click();
  await expect(page.getByText('No favorites', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('No favorites', { exact: true })).toBeVisible();
  await page.unroute('**/backend/favorites');
});

test('all four games run against the real API with keyboard controls and no financial changes', async ({
  page,
}) => {
  await register(page);
  const before = await walletState(page);
  for (const [id, width] of [
    ['paper-dice', 375],
    ['fable-mines', 768],
    ['fable-plinko', 1024],
    ['fable-limbo', 1440],
  ] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    const room = await launch(page, id);
    const start = room.getByRole('button', { name: 'Start demo round', exact: true });
    await start.focus();
    await expect(start).toBeFocused();
    await page.keyboard.press('Enter');
    if (id === 'fable-mines') {
      await expect(
        room.getByRole('group', { name: 'Mines board' }).getByRole('button'),
      ).toHaveCount(25);
      await expect(room.getByRole('button', { name: 'Finish demo round' })).toBeDisabled();
      await page.reload();
      await expect(room.getByText('Round in progress', { exact: true })).toBeVisible();
      const cell = room.getByRole('button', { name: 'Cell 25', exact: true });
      await cell.focus();
      await page.keyboard.press('Enter');
      await expect(cell).toHaveCount(0); // The revealed cell is renamed safe/mine.
      if (await room.getByRole('button', { name: 'Finish demo round' }).isVisible())
        await room.getByRole('button', { name: 'Finish demo round' }).click();
    }
    await expect(room.getByText('Recorded demo result', { exact: true })).toBeVisible();
    await expect(
      room.getByText('Not a settled wallet transaction.', { exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    const roomBox = await room.boundingBox();
    await page.setViewportSize({ width, height: Math.max(1000, Math.ceil(roomBox!.height + 210)) });
    await room.evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 140),
    );
    await page.screenshot({ path: `../../docs/casino-review/${id}-${width}.png` });
    if (id === 'fable-plinko' || id === 'fable-mines') {
      for (const testWidth of [375, 768, 1024, 1440]) {
        await page.setViewportSize({ width: testWidth, height: 1000 });
        await noOverflow(page);
        if (id === 'fable-mines') {
          const box = await room
            .getByRole('group', { name: 'Mines board' })
            .getByRole('button')
            .first()
            .boundingBox();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  }
  expect(await walletState(page)).toEqual(before);
  await page.goto('/casino');
  await expect(
    page.getByRole('region', { name: 'Recently played', exact: true }).getByRole('article'),
  ).toHaveCount(4);
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Recently played', exact: true }).getByRole('article'),
  ).toHaveCount(4);
});

test('lost committed response survives login expiry and reload, replaying one round with the same key', async ({
  page,
}) => {
  const email = await register(page);
  const before = await walletState(page);
  let room = await launch(page, 'paper-dice');
  const keys: string[] = [];
  const ids: string[] = [];
  await page.route('**/backend/casino/demo/rounds', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().postDataJSON().idempotencyKey);
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    ids.push((await response.json()).id);
    if (keys.length === 1) await route.abort('failed');
    else await route.fulfill({ response });
  });
  await room.getByRole('button', { name: 'Start demo round', exact: true }).click();
  await expect(room.getByRole('alert')).toContainText('Response uncertain');
  await expect(room.getByRole('button', { name: /Start.*demo round/ })).toBeDisabled();
  await page.context().clearCookies();
  await room.getByRole('button', { name: 'Retry saved demo action' }).click();
  await page.getByRole('link', { name: 'Sign in again', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('a-long-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/casino/game/paper-dice');
  await expect(
    page.getByRole('button', { name: 'Play nonfinancial demo', exact: true }),
  ).toBeVisible();
  await page.reload();
  room = page.getByRole('region', { name: 'Nonfinancial game' });
  await room.getByRole('button', { name: 'Retry saved demo action' }).click();
  await expect(
    room.getByRole('button', { name: 'Start another demo round', exact: true }),
  ).toBeEnabled();
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(1);
  expect(new Set(ids).size).toBe(1);
  expect(
    (await (await page.request.get('/backend/casino/demo/rounds?gameId=paper-dice')).json()).items,
  ).toHaveLength(1);
  expect(await walletState(page)).toEqual(before);
});

test('damaged recovery data and unavailable sessions fail closed and recover explicitly', async ({
  page,
}) => {
  await register(page);
  const me = await (await page.request.get('/backend/auth/me')).json();
  await page.evaluate(
    (id) => localStorage.setItem(`fable.original.pending.${id}.paper-dice`, '{broken'),
    me.player.id,
  );
  const room = await launch(page, 'paper-dice');
  await expect(room.getByRole('alert')).toContainText('could not be read');
  await expect(room.getByRole('button', { name: 'Start demo round', exact: true })).toBeDisabled();
  await room.getByRole('button', { name: 'Clear local demo recovery' }).click();
  await expect(room.getByRole('button', { name: 'Start demo round', exact: true })).toBeEnabled();
  await page.route('**/backend/casino/demo/session', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"message":"Temporarily unavailable"}',
    }),
  );
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Demo unavailable' })).toBeVisible();
  await page.unroute('**/backend/casino/demo/session');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Nonfinancial game' })).toBeVisible();
});

test('two tabs restore one Mines board and coordinate a pending action', async ({
  page,
  context,
}) => {
  await register(page);
  const first = await launch(page, 'fable-mines');
  await first.getByLabel('Number of mines').selectOption('1');
  const other = await context.newPage();
  await other.goto(page.url());
  const second = other.getByRole('region', { name: 'Nonfinancial game' });
  await expect(second.getByRole('button', { name: 'Start demo round' })).toBeEnabled();
  let starts = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/backend/casino/demo/rounds', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    starts++;
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await first.getByRole('button', { name: 'Start demo round' }).click();
    await expect(second.getByRole('button', { name: 'Start demo round' })).toBeDisabled();
    await second.getByRole('button', { name: 'Retry saved demo action' }).click();
    await expect(second.getByRole('button', { name: 'Working…' })).toBeVisible();
  } finally {
    release();
  }
  const board = (room: typeof first) => room.getByRole('group', { name: 'Mines board' });
  for (const room of [first, second]) {
    await expect(board(room).getByRole('button')).toHaveCount(25);
    await expect(room.getByLabel('Number of mines')).toHaveValue('1');
  }
  expect(starts).toBe(1);
  await other.reload();
  await expect(board(second).getByRole('button', { name: 'Cell 1', exact: true })).toBeEnabled();
  const saved = await page.request.get('/backend/casino/demo/rounds?gameId=fable-mines');
  const history = (await saved.json()).items;
  expect(history).toHaveLength(1);
  expect(history[0].mines.locations).toBeUndefined();
  await board(second).getByRole('button', { name: 'Cell 1', exact: true }).click();
  for (const room of [first, second])
    await expect(board(room).getByRole('button', { name: /^Cell 1, (safe|mine)$/ })).toBeDisabled();
  await page.reload();
  await expect(board(first).getByRole('button', { name: /^Cell 1, (safe|mine)$/ })).toBeDisabled();
  const latest = await (
    await page.request.get('/backend/casino/demo/rounds/' + history[0].id)
  ).json();
  expect(latest.version).toBe(1);
  expect(latest.mines.revealed).toEqual([0]);
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 940 : 1000 });
    await noOverflow(page);
    await first.evaluate((element) => {
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
      window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - header - 12);
    });
    if (width === 375 || width === 1440)
      await page.screenshot({ path: `../../docs/casino-recovery/mines-restored-${width}.png` });
  }
  await other.close();
});
