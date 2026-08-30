import { spawn } from 'node:child_process';

const SHUTDOWN_TIMEOUT_MS = 15_000;
const LOG_CHAR_LIMIT = 32_000;

/**
 * Starts `next dev` in its own process group so callers can kill the npm
 * wrapper and the next-server grandchild together. Next.js 16 refuses a
 * second `next dev` in the same directory while any instance is still
 * running; SIGTERM on the npm pid alone leaves that lock held.
 */
export function spawnNextDev({ port, env }) {
  const logs = [];
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const append = chunk => {
    logs.push(String(chunk));
    const joined = logs.join('');
    if (joined.length > LOG_CHAR_LIMIT) {
      logs.splice(0, logs.length, joined.slice(-LOG_CHAR_LIMIT));
    }
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return { child, logs };
}

export function collectedLogs(logs) {
  return Array.isArray(logs) ? logs.join('') : '';
}

/** Terminates `handle.child` (SIGTERM, then SIGKILL after SHUTDOWN_TIMEOUT_MS).
 * Signals the whole process group via the negative-pid form. */
export function stopNextDev(handle) {
  const child = handle?.child;
  if (!child || child.exitCode !== null || child.killed) {
    return Promise.resolve();
  }
  const signalGroup = sig => {
    try {
      process.kill(-child.pid, sig);
    } catch {
      try {
        child.kill(sig);
      } catch {
        // already gone
      }
    }
  };
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      signalGroup('SIGKILL');
    }, SHUTDOWN_TIMEOUT_MS);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    signalGroup('SIGTERM');
  });
}

export async function waitForNextReady(
  url,
  { timeoutMs = 60_000, logs, label }
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // not listening yet, or Next refused to bind
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const output = collectedLogs(logs).trim();
  throw new Error(
    `${label} did not become ready${output ? `\n${output}` : ''}`
  );
}
