import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'fog-of-war.spec.ts',
  outputDir: 'test-results/fog',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/fog' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command:
      'env NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=false NEXT_PUBLIC_FOG_OF_WAR_ENABLED=true NEXT_PUBLIC_BATTLEMAP_RELAY_URL= npm run dev',
    url: 'http://localhost:3000/player',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    {
      name: 'ipad',
      use: { ...devices['iPad Pro 11'], browserName: 'chromium' },
    },
  ],
});
