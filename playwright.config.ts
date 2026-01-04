import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright pour tests E2E
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173/',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 5000,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173/',
    timeout: 120_000,
    reuseExistingServer: process.env.CI ? false : true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], viewport: devices['Pixel 5'].viewport },
    },
  ],
});
