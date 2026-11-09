import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

test('homepage states the simulated boundary and reaches the lobbies', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FABLE' })).toBeVisible();
  await expect(page.getByText(/No real-money transactions/i)).toBeVisible();
  await expect(page.getByText(/Demo odds are not live prices/i)).toBeVisible();
  await page.getByRole('link', { name: 'Casino' }).first().click();
  await expect(page.getByRole('heading', { name: 'Casino lobby' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Northline Reels' }).first()).toBeVisible();
});

test('sportsbook slip rejects a signed-out submit and accepts a demo bet', async ({ page }) => {
  await page.goto('/sports/event/fbl-north-harbor');
  await expect(page.getByText(/not a live feed|demo decimals/i).first()).toBeVisible();
  const awayPrice = page.getByRole('button', { name: /West Signal/i }).first();
  if ((await awayPrice.getAttribute('aria-pressed')) !== 'true') await awayPrice.click();
  await expect(page.getByLabel('Stake (FBU)').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to submit' }).first()).toBeDisabled();

  const email = `player-${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Display name').fill('Phase Two');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('a-long-password');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'FABLE' })).toBeVisible();

  await page.goto('/wallet');
  await expect(page.getByText('1,000.00 FBU').first()).toBeVisible();
  await expect(page.getByText(/cannot be withdrawn/i)).toBeVisible();

  await page.goto('/sports/event/fbl-north-harbor');
  const savedAwayPrice = page.getByRole('button', { name: /West Signal/i }).first();
  if ((await savedAwayPrice.getAttribute('aria-pressed')) !== 'true') await savedAwayPrice.click();
  const stake = page.getByLabel('Stake (FBU)').first();
  await stake.fill('10.00');
  await page.getByRole('button', { name: 'Submit demo bet' }).first().click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText(/Demo win/i).first()).toBeVisible();
  await expect(page.getByText(/not a sports result/i).first()).toBeVisible();

  await page.goto('/wallet');
  await expect(page.getByText('1,032.00 FBU').first()).toBeVisible();
});

test('protected wallet redirects when signed out', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});

test('mobile navigation opens the casino lobby', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Mobile' })
    .getByRole('link', { name: 'Casino' })
    .click();
  await expect(page.getByRole('heading', { name: 'Casino lobby' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
});

test('records navigation timing and screenshots', async ({ page }) => {
  const timings = await measure(page, '/', 1440, 900);
  await expect(page.getByRole('link', { name: 'North Harbor vs West Signal' })).toBeVisible();
  await page.screenshot({
    path: '../../docs/phase-2/screenshots/home-1440.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: '../../docs/phase-2/screenshots/home-375.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: '../../docs/phase-2/screenshots/home-768.png',
    fullPage: false,
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/casino');
  await expect(page.getByRole('link', { name: 'Northline Reels' }).first()).toBeVisible();
  await page.screenshot({
    path: '../../docs/phase-2/screenshots/casino-1280.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: '../../docs/phase-2/screenshots/casino-375.png',
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sports');
  await expect(page.getByRole('link', { name: 'North Harbor vs West Signal' })).toBeVisible();
  await page.screenshot({
    path: '../../docs/phase-2/screenshots/sports-1440.png',
    fullPage: false,
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({
    path: '../../docs/phase-2/screenshots/sports-1920.png',
    fullPage: false,
  });
  test.info().annotations.push({
    type: 'navigation',
    description: JSON.stringify(timings),
  });
  writeFileSync(
    resolve(process.cwd(), '../../docs/phase-2/navigation-timing.json'),
    `${JSON.stringify({ path: '/', viewport: '1440x900', ...timings }, null, 2)}\n`,
  );
  expect(timings.domContentLoaded).toBeGreaterThan(0);
});

async function measure(page: Page, path: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(path, { waitUntil: 'load' });
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    return {
      ttfb: nav ? Math.round(nav.responseStart) : 0,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
      load: nav ? Math.round(nav.loadEventEnd) : 0,
    };
  });
}

test('lost committed bet response retries the same operation without a second debit', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel('Display name').fill('Retry test');
  await page.getByLabel('Email').fill(`retry-${Date.now()}@example.invalid`);
  await page.getByLabel('Password').fill('a-long-password');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'FABLE' })).toBeVisible();
  await page.goto('/sports/event/fbl-north-harbor');
  await page
    .getByRole('button', { name: /West Signal/i })
    .first()
    .click();
  await page.getByLabel('Stake (FBU)').first().fill('10.00');
  const keys: string[] = [];
  await page.route('**/backend/demo/bets', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push((route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey);
    if (keys.length === 1) {
      const committed = await route.fetch();
      expect(committed.status()).toBe(201);
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Submit demo bet' }).first().click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText(/Response uncertain/).first()).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Retry saved request' }).first().click();
  await expect(page.getByText(/Demo win/i).first()).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  await page.goto('/wallet');
  await expect(page.getByText('1,032.00 FBU').first()).toBeVisible();
});
