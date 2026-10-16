import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import test, { after, before } from 'node:test';

/**
 * Repair 09 (NN2): `SHOP_ENTITY_IDS_CAS_SCRIPT` (the ids-only shop token
 * update behind `PATCH /api/campaign/[code]/shops/[npcId]`) against a real,
 * disposable Redis: a write keeps the projection TTL and never touches the
 * ledger; changed text and a missing projection or ledger write nothing.
 */

const CONTAINER = `rollkeeper-shop-tokens-${randomUUID().slice(0, 8)}`;
const SHOP = 'campaign:SYNTH:shop:npc-1';
const LEDGER = 'campaign:SYNTH:shop-ledger:npc-1';

const source = fs.readFileSync(
  new URL(
    '../src/app/api/campaign/[code]/shops/[npcId]/route.ts',
    import.meta.url
  ),
  'utf8'
);
const script = source.match(
  /export const SHOP_ENTITY_IDS_CAS_SCRIPT = `([\s\S]*?)`;/u
)?.[1];
assert.ok(script, 'SHOP_ENTITY_IDS_CAS_SCRIPT must be exported');

function redis(...args) {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'redis-cli', '--raw', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
}

function cas(expected, next) {
  return Number(redis('EVAL', script, '2', SHOP, LEDGER, expected, next));
}

let server;
before(async () => {
  server = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      CONTAINER,
      'redis:7-alpine',
      'redis-server',
      '--save',
      '',
      '--appendonly',
      'no',
    ],
    { stdio: 'ignore' }
  );
  const deadline = Date.now() + 15_000;
  for (;;) {
    try {
      if (redis('PING') === 'PONG') break;
    } catch {}
    if (Date.now() > deadline) throw new Error('Redis did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
});

after(() => {
  try {
    execFileSync('docker', ['stop', CONTAINER], { stdio: 'ignore' });
  } catch {}
  server?.kill('SIGTERM');
});

const projection = entityIds =>
  JSON.stringify({
    npcId: 'npc-1',
    merchantName: 'Maren',
    entityIds,
    items: [
      {
        id: 'item-1',
        name: 'Lantern Oil',
        itemKind: 'inventory',
        priceCopper: 3000,
        remainingQuantity: 1,
      },
    ],
  });
const ledger = JSON.stringify([
  { id: 'item-1', remainingQuantity: 1, soldQuantity: 1 },
]);

function seed() {
  redis('DEL', SHOP, LEDGER);
  redis('SET', SHOP, projection([]), 'EX', '1000');
  redis('SET', LEDGER, ledger, 'EX', '800');
}

test('writes the new ids, keeps the projection TTL and leaves the ledger alone', () => {
  seed();
  assert.equal(cas(projection([]), projection(['member-1'])), 1);
  assert.equal(redis('GET', SHOP), projection(['member-1']));
  const shopTtl = Number(redis('TTL', SHOP));
  assert.ok(shopTtl > 990 && shopTtl <= 1000, `shop TTL ${shopTtl}`);
  assert.equal(redis('GET', LEDGER), ledger);
  const ledgerTtl = Number(redis('TTL', LEDGER));
  assert.ok(ledgerTtl > 790 && ledgerTtl <= 800, `ledger TTL ${ledgerTtl}`);
});

test('a projection changed since it was read is not overwritten', () => {
  seed();
  redis('SET', SHOP, projection(['from-a-full-publish']), 'KEEPTTL');
  assert.equal(cas(projection([]), projection(['member-1'])), 0);
  assert.equal(redis('GET', SHOP), projection(['from-a-full-publish']));
});

test('a shop without its ledger or projection is not live', () => {
  seed();
  redis('DEL', LEDGER);
  assert.equal(cas(projection([]), projection(['member-1'])), -1);
  assert.equal(redis('GET', SHOP), projection([]));
  redis('DEL', SHOP);
  redis('SET', LEDGER, ledger);
  assert.equal(cas(projection([]), projection(['member-1'])), -1);
  assert.equal(redis('EXISTS', SHOP), '0');
});

// The shops index's lazy cleanup (`SHOP_INDEX_PRUNE_SCRIPT`): a publish seeds
// the ledger and adds the id before it writes the projection, so an id with
// a ledger but no projection yet must stay listed.
const indexSource = fs.readFileSync(
  new URL('../src/app/api/campaign/[code]/shops/route.ts', import.meta.url),
  'utf8'
);
const pruneScript = indexSource.match(
  /export const SHOP_INDEX_PRUNE_SCRIPT = `([\s\S]*?)`;/u
)?.[1];
assert.ok(pruneScript, 'SHOP_INDEX_PRUNE_SCRIPT must be exported');
const INDEX = 'campaign:SYNTH:shops-index';

function prune(...npcIds) {
  const keys = npcIds.flatMap(id => [
    `campaign:SYNTH:shop:${id}`,
    `campaign:SYNTH:shop-ledger:${id}`,
  ]);
  return Number(
    redis(
      'EVAL',
      pruneScript,
      String(keys.length + 1),
      ...keys,
      INDEX,
      ...npcIds
    )
  );
}

test('the index prune keeps a shop mid-publish and drops one that is gone', () => {
  redis('DEL', INDEX);
  redis('SADD', INDEX, 'publishing', 'gone', 'live');
  // Mid-publish: ledger seeded, projection not written yet.
  redis('SET', 'campaign:SYNTH:shop-ledger:publishing', '[]');
  redis('DEL', 'campaign:SYNTH:shop:publishing');
  // Gone: both keys expired or deleted.
  redis('DEL', 'campaign:SYNTH:shop:gone', 'campaign:SYNTH:shop-ledger:gone');
  // A projection without its ledger is not removed by the prune either.
  redis('SET', 'campaign:SYNTH:shop:live', '{}');
  redis('DEL', 'campaign:SYNTH:shop-ledger:live');
  assert.equal(prune('publishing', 'gone', 'live'), 1);
  assert.deepEqual(redis('SMEMBERS', INDEX).split('\n').sort(), [
    'live',
    'publishing',
  ]);
});
