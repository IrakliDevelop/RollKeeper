import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-nightly',
  outputDir: 'test-results/nightly-checkpoint',
  testMatch: /checkpoint-interruption/,
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
            outputFolder: 'playwright-report/checkpoint-matrix',
          },
        ],
      ]
    : [
        ['list'],
        [
          'html',
          {
            open: 'never',
            outputFolder: 'playwright-report/checkpoint-matrix',
          },
        ],
      ],
  use: {
    baseURL: 'http://localhost:3110',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command:
      'env NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=false NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED=false NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED=true npm run dev -- --port 3110',
    url: 'http://localhost:3110/player',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-indexeddb',
      use: { browserName: 'chromium' },
    },
  ],
});
