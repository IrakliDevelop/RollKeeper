import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * Same secret-resolution trick as `playwright.loot.config.ts` — the relay
 * and the Next app must mint/verify tokens with the SAME
 * `BATTLEMAP_RELAY_SECRET`. The app reads it from `.env.local` (gitignored,
 * not present in a fresh checkout); the relay reads no such file, so it
 * must be handed the value explicitly. Read at config-eval time and fall
 * back to the README's own documented local default when `.env.local`
 * doesn't define one (fresh checkout).
 */
function resolveRelaySecret(): string {
  try {
    const envLocal = readFileSync('.env.local', 'utf8');
    const match = envLocal.match(/^BATTLEMAP_RELAY_SECRET=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // .env.local absent — fall through to the documented local default.
  }
  return 'dev-secret-change-me';
}

const RELAY_SECRET = process.env.BATTLEMAP_RELAY_SECRET ?? resolveRelaySecret();

/**
 * The app's dev server command, overridable per-environment — identical
 * escape hatch to `playwright.loot.config.ts`: this worktree's `node_modules`
 * is an intentional symlink, and Turbopack refuses to start against it
 * ("Symlink [project]/node_modules is invalid, it points out of the
 * filesystem root"). Set `ROLLKEEPER_E2E_DEV_COMMAND` to a webpack-based
 * command (e.g. `npx next dev --webpack`) to run this locally in such a
 * worktree without editing this committed file.
 */
const DEV_COMMAND = process.env.ROLLKEEPER_E2E_DEV_COMMAND ?? 'npm run dev';

// Dedicated config for the VTT merchants shop e2e coverage (Slice 3, Task
// 14), mirroring `playwright.loot.config.ts`'s pattern exactly: its own
// test file, its own webServer wiring. Like the loot flow, a merchant
// token's canvas element only ever reaches a second client over the live
// battle-map relay (`relay/`) — `PlayerBattleMapCanvas` never falls back to
// a REST snapshot for canvas elements (see `src/lib/battlemapSync.ts`) — so
// this needs the relay dev server alongside Redis, which the default
// `playwright.config.ts` deliberately does not start.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['shop-purchase-reconciliation.spec.ts'],
  outputDir: 'test-results/shop',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/shop' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    // Playwright's per-action timeout otherwise defaults to none, so a
    // selector that matches nothing (e.g. the wrong ARIA role) silently
    // retries for the entire test-level timeout instead of failing fast.
    actionTimeout: 15_000,
  },
  webServer: [
    {
      // Prerequisite (Slice 3 final review, Minor finding): this needs
      // `relay/node_modules` to already exist (`npm install` inside
      // `relay/`, once) — when it's missing, this webServer entry never
      // reaches `/healthz` and Playwright times out opaquely after 60s with
      // no indication the relay's own dependencies were the problem.
      command: `env BATTLEMAP_RELAY_SECRET=${RELAY_SECRET} REDIS_URL=redis://localhost:6379 npm run dev`,
      cwd: './relay',
      url: 'http://localhost:8787/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `env NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=false UPSTASH_REDIS_REST_URL=http://localhost:8079 UPSTASH_REDIS_REST_TOKEN=local_dev_token BATTLEMAP_RELAY_SECRET=${RELAY_SECRET} NEXT_PUBLIC_BATTLEMAP_RELAY_URL=ws://localhost:8787 ${DEV_COMMAND}`,
      url: 'http://localhost:3000/player',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
