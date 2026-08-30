import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { stopNextDev } from './spawn-next-dev.mjs';

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(predicate, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

test('stopNextDev signals the process group so grandchildren exit', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rk-next-dev-'));
  const pidFile = join(dir, 'grandchild.pid');
  const child = spawn(
    process.execPath,
    [
      '-e',
      `const { spawn } = require('node:child_process');
spawn(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.env.PIDFILE, String(process.pid)); setInterval(() => {}, 1000)'], {
  stdio: 'ignore',
  env: process.env,
});
setInterval(() => {}, 1000);`,
    ],
    {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PIDFILE: pidFile },
    }
  );

  try {
    await waitFor(
      () => {
        try {
          return Number(readFileSync(pidFile, 'utf8').trim()) > 0;
        } catch {
          return false;
        }
      },
      5_000,
      'grandchild did not write its pid'
    );
    const grandchildPid = Number(readFileSync(pidFile, 'utf8').trim());
    assert.ok(grandchildPid > 0);
    assert.notEqual(grandchildPid, child.pid);
    assert.equal(processAlive(grandchildPid), true);

    await stopNextDev({ child });

    await waitFor(
      () => !processAlive(child.pid) && !processAlive(grandchildPid),
      5_000,
      'process group still alive after stopNextDev'
    );
  } finally {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // already gone
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
