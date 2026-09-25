import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * Same secret-resolution trick as `loot.config.ts` — the relay
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
 * escape hatch to `loot.config.ts`: this worktree's `node_modules`
 * is an intentional symlink, and Turbopack refuses to start against it
 * ("Symlink [project]/node_modules is invalid, it points out of the
 * filesystem root"). Set `ROLLKEEPER_E2E_DEV_COMMAND` to a webpack-based
 * command (e.g. `npx next dev --webpack`) to run this locally in such a
 * worktree without editing this committed file.
 */
const DEV_COMMAND = process.env.ROLLKEEPER_E2E_DEV_COMMAND ?? 'npm run dev';

// Dedicated config for the player battle-map sheet drawer e2e coverage
// (battlemap sheet drawer PR1, Task 11) — a copy of `shop.config.ts` with
// its own test file and output folders. The player's own placed token only
// comes back after a reload through the live battle-map relay (`relay/`), so
// this needs the relay dev server alongside Redis, which the root
// `playwright.config.ts` deliberately does not start.
export default defineConfig({
  testDir: '../../e2e',
  testMatch: ['map-sheet-drawer.spec.ts', 'dm-creature-drawer.spec.ts'],
  outputDir: '../../test-results/sheet-drawer',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    [
      'html',
      { open: 'never', outputFolder: '../../playwright-report/sheet-drawer' },
    ],
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
      cwd: '../../relay',
      url: 'http://localhost:8787/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `env NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=false UPSTASH_REDIS_REST_URL=http://localhost:8079 UPSTASH_REDIS_REST_TOKEN=local_dev_token BATTLEMAP_RELAY_SECRET=${RELAY_SECRET} NEXT_PUBLIC_BATTLEMAP_RELAY_URL=ws://localhost:8787 ${DEV_COMMAND}`,
      cwd: '../..',
      url: 'http://localhost:3000/player',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
