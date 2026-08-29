import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-indexeddb',
  outputDir: 'test-results/player-backup-recovery',
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
            outputFolder: 'playwright-report/player-backup-recovery',
          },
        ],
      ]
    : [
        ['list'],
        [
          'html',
          {
            open: 'never',
            outputFolder: 'playwright-report/player-backup-recovery',
          },
        ],
      ],
  use: {
    baseURL: 'http://localhost:3109',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command:
      'env NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE=true NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=false NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED=false NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED=true NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED=true npm run dev -- --port 3109',
    url: 'http://localhost:3109/player',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-player-backup-recovery',
      use: { browserName: 'chromium' },
      testMatch: /player-backup-current-character-recovery/,
    },
  ],
});
