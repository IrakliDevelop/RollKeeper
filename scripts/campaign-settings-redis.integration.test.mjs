import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

const CONTAINER = 'rollkeeper-slice11a-redis';

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
  throw new Error('Isolated campaign settings Redis did not start');
}

test('real Redis enforces campaign_settings projection epoch/version CAS and tombstones', async t => {
  const server = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      CONTAINER,
      '-p',
      '127.0.0.1:6383:6379',
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
    new URL(
      '../src/lib/durableDm/campaignSettingsProjection.ts',
      import.meta.url
    ),
    'utf8'
  );
  const script = source.match(
    /export const CAMPAIGN_SETTINGS_PROJECTION_CAS_SCRIPT = `([\s\S]*?)`;/u
  )?.[1];
  assert.ok(script);
  const keys = [
    'campaign:ABC123:projection:campaign_settings:meta',
    'campaign:ABC123:shared:settings',
    'campaign:ABC123:shared:counters',
  ];
  const evaluate = ({ epoch, version, fingerprint, tombstone = false }) =>
    redis(
      'EVAL',
      script,
      '3',
      ...keys,
      String(epoch),
      String(version),
      fingerprint,
      JSON.stringify({ stackableInspiration: true }),
      JSON.stringify({ label: 'Momentum', counters: { synthetic: 1 } }),
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
  assert.equal(
    evaluate({ epoch: 2, version: 1, fingerprint: 'e'.repeat(64) })[0],
    'written'
  );
  assert.ok(Number(redis('TTL', keys[0])[0]) > 0);
  assert.equal(
    evaluate({
      epoch: 2,
      version: 2,
      fingerprint: 'f'.repeat(64),
      tombstone: true,
    })[0],
    'written'
  );
  assert.deepEqual(redis('EXISTS', keys[1], keys[2]), ['0']);
  redis('SET', keys[0], 'not-json');
  assert.equal(
    evaluate({ epoch: 3, version: 1, fingerprint: '1'.repeat(64) })[0],
    'poison'
  );
});
