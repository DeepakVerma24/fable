import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:3847',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --dir ../.. --filter @fable/api dev',
      url: 'http://127.0.0.1:4307/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev',
      env: { FABLE_DISABLE_COMPILER_CACHE: '1' },
      url: 'http://127.0.0.1:3847',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
