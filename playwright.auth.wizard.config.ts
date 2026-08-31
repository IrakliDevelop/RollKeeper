import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/auth-wizard',
  outputDir: 'test-results/auth-wizard',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/auth-wizard' }],
  ],
  use: {
    baseURL: 'http://localhost:3111',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/start-auth-wizard-e2e-server.mjs',
    url: 'http://localhost:3111/account',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium-auth-wizard', use: { browserName: 'chromium' } },
  ],
});
