import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-indexeddb',
  outputDir: 'test-results/indexeddb',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ['github'],
        [
          'html',
          { open: 'never', outputFolder: 'playwright-report/indexeddb' },
        ],
      ]
    : [
        ['list'],
        [
          'html',
          { open: 'never', outputFolder: 'playwright-report/indexeddb' },
        ],
      ],
  use: {
    baseURL: 'http://localhost:3107',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command:
      'env NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=false NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED=false NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED=true npm run dev -- --port 3107',
    url: 'http://localhost:3107/player',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-indexeddb',
      use: { browserName: 'chromium' },
      testIgnore: /player-backup-current-character-recovery/,
    },
  ],
});
