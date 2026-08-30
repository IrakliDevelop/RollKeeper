import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-nightly',
  testIgnore: '**/auth/**',
  testMatch: /reconnect-stress/,
  outputDir: 'test-results/nightly-reconnect',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ['github'],
        [
          'html',
          {
            open: 'never',
            outputFolder: 'playwright-report/reconnect-nightly',
          },
        ],
      ]
    : [
        ['list'],
        [
          'html',
          {
            open: 'never',
            outputFolder: 'playwright-report/reconnect-nightly',
          },
        ],
      ],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'env NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=false npm run dev',
    url: 'http://localhost:3000/player',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
