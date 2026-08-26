import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/auth',
  outputDir: 'test-results/auth',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/auth' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/start-auth-e2e-server.mjs',
    url: 'http://localhost:3000/account',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium-auth', use: { browserName: 'chromium' } }],
});
