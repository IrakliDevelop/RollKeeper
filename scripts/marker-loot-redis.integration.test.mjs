import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

const CONTAINER = 'rollkeeper-marker-loot-redis';

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
  throw new Error('Isolated marker-loot Redis did not start');
}

const LEDGER = 'campaign:ABC123:marker-loot:map-1';
const TRANSFERS = 'campaign:ABC123:transfers:player-1';

function entry(overrides = {}) {
  return {
    markerId: 'ref-1',
    id: 'loot-1',
    itemKind: 'inventory',
    item: { id: 'item-1', name: 'Arrow', quantity: 1 },
    quantity: 3,
    claimedQuantity: 0,
    locked: false,
    ...overrides,
  };
}

test('real Redis enforces locked, clamped and idempotent loot claims', async t => {
  const server = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      CONTAINER,
      '-p',
      '127.0.0.1:6385:6379',
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
    new URL('../src/lib/markerLootClaims.ts', import.meta.url),
    'utf8'
  );
  const seedScript = source.match(
    /export const SEED_SCRIPT = `([\s\S]*?)`;/u
  )?.[1];
  const claimScript = source.match(
    /export const CLAIM_SCRIPT = `([\s\S]*?)`;/u
  )?.[1];
  assert.ok(seedScript, 'SEED_SCRIPT must be exported for this harness');
  assert.ok(claimScript, 'CLAIM_SCRIPT must be exported for this harness');

  const seed = entries =>
    redis('EVAL', seedScript, '1', LEDGER, JSON.stringify(entries), '300');

  const claim = ({
    requestId,
    quantity,
    markerId = 'ref-1',
    entryId = 'loot-1',
  }) =>
    JSON.parse(
      redis(
        'EVAL',
        claimScript,
        '3',
        LEDGER,
        TRANSFERS,
        `campaign:ABC123:marker-claim:map-1:player-1:${requestId}`,
        markerId,
        entryId,
        requestId,
        `transfer-loot-${requestId}`,
        '2026-09-06T00:00:00.000Z',
        '300',
        String(quantity)
      ).join('\n')
    );

  // A locked container rejects, and nothing is queued.
  seed([entry({ locked: true })]);
  assert.deepEqual(claim({ requestId: 'r1', quantity: 1 }), {
    error: 'locked',
  });
  assert.deepEqual(redis('EXISTS', TRANSFERS), ['0']);

  // Unlocking is a reseed; a partial grant is clamped to what is available.
  seed([entry({ locked: false })]);
  const first = claim({ requestId: 'r2', quantity: 2 });
  assert.equal(first.grantedQuantity, 2);
  assert.equal(first.remainingQuantity, 1);
  const clamped = claim({ requestId: 'r3', quantity: 5 });
  assert.equal(clamped.grantedQuantity, 1);
  assert.equal(clamped.remainingQuantity, 0);
  assert.deepEqual(claim({ requestId: 'r4', quantity: 1 }), {
    error: 'depleted',
  });

  // An inventory claim collapses into one transfer carrying the granted count.
  const queue = JSON.parse(redis('GET', TRANSFERS).join('\n'));
  assert.equal(queue.length, 2);
  assert.equal(queue[0].item.quantity, 2);
  assert.equal(queue[1].item.quantity, 1);

  // Replaying a requestId returns the original result and queues nothing new.
  const replay = claim({ requestId: 'r2', quantity: 2 });
  assert.equal(replay.grantedQuantity, 2);
  assert.equal(JSON.parse(redis('GET', TRANSFERS).join('\n')).length, 2);

  // A magic-item claim of N enqueues N distinct transfers.
  redis('DEL', TRANSFERS);
  seed([
    entry({
      id: 'loot-2',
      itemKind: 'magic',
      item: { id: 'magic-1', name: 'Wand', rarity: 'rare' },
      quantity: 2,
    }),
  ]);
  const magic = claim({ requestId: 'r5', quantity: 2, entryId: 'loot-2' });
  assert.equal(magic.grantedQuantity, 2);
  const magicQueue = JSON.parse(redis('GET', TRANSFERS).join('\n'));
  assert.equal(magicQueue.length, 2);
  assert.equal(new Set(magicQueue.map(t => t.id)).size, 2);
  assert.ok(magicQueue.every(t => t.itemKind === 'magic'));

  // The seed script never resurrects already-claimed units.
  seed([
    entry({ id: 'loot-2', itemKind: 'magic', quantity: 2, claimedQuantity: 0 }),
  ]);
  const reseeded = JSON.parse(redis('GET', LEDGER).join('\n'));
  assert.equal(reseeded[0].claimedQuantity, 2);
});
