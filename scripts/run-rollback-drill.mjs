import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

const PORT = 3111;
const ORIGIN = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 120_000;
const SHUTDOWN_TIMEOUT_MS = 15_000;

const config = getLocalSupabaseTestConfig();

const profileDir = mkdtempSync(join(tmpdir(), 'rollkeeper-rollback-drill-'));
process.env.ROLLBACK_PROFILE_DIR = profileDir;

const BASE_ENV = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_AUTH_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_URL: config.apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
};

const PHASE_A_ENV = {
  ...BASE_ENV,
  NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE: 'true',
  NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED: 'true',
  NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED: 'true',
};

const PHASE_B_ENV = {
  ...BASE_ENV,
  NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE: 'false',
  NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED: 'false',
  NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED: 'false',
  NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED: 'false',
};

let serverChild = null;
let playwrightChild = null;

function log(message) {
  process.stdout.write(`[rollback-drill] ${message}\n`);
}

/** Terminates `child` (SIGTERM, then SIGKILL after SHUTDOWN_TIMEOUT_MS if it
 * hasn't exited) and resolves once it has. No-op if already exited. */
function killChild(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // already gone
      }
    }, SHUTDOWN_TIMEOUT_MS);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/player`);
      if (response.status < 500) return;
    } catch {
      // server not up yet
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(
    `Server on port ${PORT} did not become ready within ${READY_TIMEOUT_MS}ms`
  );
}

async function stopServer() {
  const child = serverChild;
  serverChild = null;
  await killChild(child);
}

async function stopPlaywright() {
  const child = playwrightChild;
  playwrightChild = null;
  await killChild(child);
}

async function startServer(env) {
  serverChild = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], {
    env,
    stdio: 'inherit',
  });
  await waitForServer();
}

/** Runs the Playwright phase with async `spawn` (not `spawnSync`): a
 * blocking spawnSync freezes Node's event loop for the whole phase, so a
 * SIGTERM/SIGINT arriving mid-run (most of the drill's wall time) would
 * never reach the process.on() handlers below until the child exits on its
 * own — leaking the dev server and profile dir on CI cancellation. Async
 * spawn keeps the event loop free so signals are handled promptly. */
function runPlaywrightPhase(grep) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      [
        'playwright',
        'test',
        '--config',
        'playwright.rollback-drill.config.ts',
        '--grep',
        grep,
      ],
      { env: process.env, stdio: 'inherit' }
    );
    playwrightChild = child;
    child.once('error', error => {
      playwrightChild = null;
      reject(error);
    });
    child.once('exit', (code, signal) => {
      playwrightChild = null;
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

async function runPhase(name, env, grep) {
  log(`starting phase ${name} server on port ${PORT}`);
  await startServer(env);
  log(`server ready; running "${grep}"`);
  const status = await runPlaywrightPhase(grep);
  await stopServer();
  return status;
}

async function main() {
  const phaseAStatus = await runPhase('A', PHASE_A_ENV, 'phase A');
  if (phaseAStatus !== 0) {
    log(`phase A failed with exit code ${phaseAStatus}`);
    process.exitCode = phaseAStatus;
    return;
  }

  const phaseBStatus = await runPhase('B', PHASE_B_ENV, 'phase B');
  if (phaseBStatus !== 0) {
    log(`phase B failed with exit code ${phaseBStatus}`);
    process.exitCode = phaseBStatus;
    return;
  }

  log('rollback drill passed both phases');
  process.exitCode = 0;
}

async function cleanup() {
  await stopPlaywright();
  await stopServer();
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    cleanup().finally(() => process.exit(1));
  });
}

try {
  await main();
} catch (error) {
  process.exitCode = 1;
  console.error(error);
} finally {
  await cleanup();
}
