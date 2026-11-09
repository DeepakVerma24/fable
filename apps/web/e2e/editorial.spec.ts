import { expect, test } from '@playwright/test';

for (const width of [375, 768, 1024, 1440]) {
  test(`editorial layout and slip at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Featured Casino Games' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Northline Reels/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /West Signal/ }).first()).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        ['/art/fable-sports-hero.png', '/art/fable-casino-art.png'].map(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();
        }),
      );
    });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({
      path: `../../docs/design-review/home-${width}.png`,
      fullPage: width === 375,
    });
    await page
      .getByRole('button', { name: /West Signal/ })
      .first()
      .click();
    const slip = width < 1280 ? page.getByRole('dialog') : page.locator('.slip-panel');
    await expect(slip.getByLabel('Stake (FBU)')).toBeVisible();
    await slip.getByLabel('Stake (FBU)').fill('25.00');
    await expect(slip.getByRole('button', { name: 'Sign in to submit' })).toBeDisabled();
    await page.screenshot({ path: `../../docs/design-review/slip-${width}.png` });
    await slip.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(slip.getByText('Slip is empty')).toBeVisible();
    if (width < 1280) await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.goto('/wallet');
    await expect(page).toHaveURL(/login\?next=/);
  });
}
