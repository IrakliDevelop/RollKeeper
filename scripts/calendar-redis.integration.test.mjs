import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

const CONTAINER = 'rollkeeper-slice11b-redis';

function redis(...args) {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'redis-cli', '--raw', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
    .trim()
    .split('\n');
}

async function waitForRedis() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      if (redis('PING')[0] === 'PONG') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Isolated calendar Redis did not start');
}

test('real Redis enforces calendar-only epoch/version CAS and tombstones', async t => {
  const server = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      CONTAINER,
      '-p',
      '127.0.0.1:6384:6379',
      'redis:8.10.0',
      'redis-server',
      '--save',
      '',
      '--appendonly',
      'no',
    ],
    { stdio: 'ignore' }
  );
  t.after(() => {
    try {
      execFileSync('docker', ['stop', CONTAINER], { stdio: 'pipe' });
    } catch {}
    server.kill('SIGTERM');
  });
  await waitForRedis();

  const source = fs.readFileSync(
    new URL('../src/lib/durableDm/calendarProjection.ts', import.meta.url),
    'utf8'
  );
  const script = source.match(
    /export const CALENDAR_PROJECTION_CAS_SCRIPT = `([\s\S]*?)`;/u
  )?.[1];
  assert.ok(script);
  const keys = [
    'campaign:ABC123:projection:calendar:meta',
    'campaign:ABC123:shared:calendar',
  ];
  const evaluate = ({ epoch, version, fingerprint, tombstone = false }) =>
    redis(
      'EVAL',
      script,
      '2',
      ...keys,
      String(epoch),
      String(version),
      fingerprint,
      JSON.stringify({ codecVersion: 1, events: [] }),
      tombstone ? '1' : '0',
      '300'
    );

  assert.equal(
    evaluate({ epoch: 1, version: 1, fingerprint: 'a'.repeat(64) })[0],
    'written'
  );
  assert.equal(
    evaluate({ epoch: 1, version: 1, fingerprint: 'a'.repeat(64) })[0],
    'identical'
  );
  assert.equal(
    evaluate({ epoch: 1, version: 1, fingerprint: 'b'.repeat(64) })[0],
    'divergent'
  );
  assert.equal(
    evaluate({ epoch: 1, version: 2, fingerprint: 'c'.repeat(64) })[0],
    'written'
  );
  assert.equal(
    evaluate({ epoch: 1, version: 1, fingerprint: 'a'.repeat(64) })[0],
    'stale-version'
  );
  assert.equal(
    evaluate({ epoch: 0, version: 99, fingerprint: 'd'.repeat(64) })[0],
    'stale-epoch'
  );
  assert.ok(Number(redis('TTL', keys[0])[0]) > 0);
  assert.equal(
    evaluate({
      epoch: 2,
      version: 1,
      fingerprint: 'e'.repeat(64),
      tombstone: true,
    })[0],
    'written'
  );
  assert.deepEqual(redis('EXISTS', keys[1]), ['0']);
  assert.deepEqual(redis('EXISTS', 'campaign:ABC123:shared:settings'), ['0']);
  redis('SET', keys[0], 'not-json');
  assert.equal(
    evaluate({ epoch: 3, version: 1, fingerprint: 'f'.repeat(64) })[0],
    'poison'
  );
});
