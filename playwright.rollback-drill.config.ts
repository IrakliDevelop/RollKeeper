import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-rollback-drill',
  outputDir: 'test-results/rollback-drill',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ['github'],
        [
          'html',
          { open: 'never', outputFolder: 'playwright-report/rollback-drill' },
        ],
      ]
    : [
        ['list'],
        [
          'html',
          { open: 'never', outputFolder: 'playwright-report/rollback-drill' },
        ],
      ],
  use: {
    baseURL: 'http://localhost:3111',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-rollback-drill', use: { browserName: 'chromium' } },
  ],
});
