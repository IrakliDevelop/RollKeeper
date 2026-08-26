import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-automatic-sync',
  outputDir: 'test-results/automatic-sync',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ['github'],
        [
          'html',
          { open: 'never', outputFolder: 'playwright-report/automatic-sync' },
        ],
      ]
    : [
        ['list'],
        [
          'html',
          { open: 'never', outputFolder: 'playwright-report/automatic-sync' },
        ],
      ],
  use: {
    baseURL: 'http://slice9-control.localhost:3108',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command:
      'env NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=false NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED=false NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED=true NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED=false NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED=true npm run dev -- --port 3108',
    url: 'http://127.0.0.1:3108/player',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium-automatic-sync', use: { browserName: 'chromium' } },
  ],
});
