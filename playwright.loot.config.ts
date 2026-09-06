import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * The relay (`relay/`) and the Next app must mint/verify tokens with the
 * SAME `BATTLEMAP_RELAY_SECRET`. The app reads it from `.env.local`
 * (gitignored, not present in a fresh checkout); the relay reads no such
 * file, so it must be handed the value explicitly. Rather than hardcoding
 * this worktree's current `.env.local` value into a committed config, read
 * it at config-eval time and fall back to the README's own documented local
 * default when `.env.local` doesn't define one (fresh checkout).
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
 * The app's dev server command, overridable per-environment.
 *
 * Defaults to the repo's own `npm run dev` — the same command
 * `playwright.fog.config.ts` and every other spec's webServer runs. In some
 * environments a symlinked (or otherwise non-standard) `node_modules` can
 * trip Turbopack's project-root/filesystem-boundary check and prevent `next
 * dev` from starting at all (`TurbopackInternalError: Symlink
 * [project]/node_modules is invalid, it points out of the filesystem
 * root`). Where that happens, set `ROLLKEEPER_E2E_DEV_COMMAND` to a command
 * that avoids Turbopack (e.g. `npx next dev --webpack`) without editing
 * this committed file. This has not been observed against a normal
 * checkout — see task-9-report.md for exactly what was and wasn't verified.
 */
const DEV_COMMAND = process.env.ROLLKEEPER_E2E_DEV_COMMAND ?? 'npm run dev';

// Dedicated config for the VTT loot-completion e2e coverage, mirroring the
// existing `playwright.fog.config.ts` pattern (its own test file, its own
// webServer wiring) rather than the shared default `playwright.config.ts`.
//
// This spec is genuinely cross-party: the DM's marker pin only reaches the
// player's canvas over the live battle-map relay (`relay/`), never over a
// REST snapshot (see `src/lib/battlemapSync.ts`). So, unlike every other
// e2e spec in this repo, it needs a second local service besides Redis.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['marker-loot-locked-claim.spec.ts'],
  outputDir: 'test-results/loot',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/loot' }],
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
