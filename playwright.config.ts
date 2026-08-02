import { defineConfig, devices } from '@playwright/test';

const LIVE = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],

  use: {
    baseURL: LIVE ?? `http://localhost:${process.env.PORT ?? 3004}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } }],

  // When PLAYWRIGHT_BASE_URL is set we test the live deployment — no local server.
  ...(LIVE
    ? {}
    : {
        webServer: {
          command: './node_modules/.bin/next dev -p 3004',
          url: 'http://localhost:3004',
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }),
});
