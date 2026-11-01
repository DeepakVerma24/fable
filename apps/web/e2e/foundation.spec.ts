import { expect, test } from '@playwright/test';

test('foundation shell shows the simulated-money boundary', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FABLE' })).toBeVisible();
  await expect(page.getByText(/No real-money transactions/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save note' })).toBeVisible();
});
