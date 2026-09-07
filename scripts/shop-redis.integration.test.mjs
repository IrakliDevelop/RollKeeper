import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import test, { after, before } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const CONTAINER = 'rollkeeper-shop-redis';

function redisSync(...args) {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'redis-cli', '--raw', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
    .trim()
    .split('\n');
}

async function redis(...args) {
  const { stdout } = await execFileAsync('docker', [
    'exec',
    CONTAINER,
    'redis-cli',
    '--raw',
    ...args,
  ]);
  return stdout.trim().split('\n');
}

async function waitForRedis() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      if (redisSync('PING')[0] === 'PONG') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Isolated shop Redis did not start');
}

let seedScript;
let purchaseScript;
let ackScript;
let enqueueTransferScript;
let ackTransferScript;
let server;

before(async () => {
  server = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      CONTAINER,
      '-p',
      '127.0.0.1:6386:6379',
      'redis:8.10.0',
      'redis-server',
      '--save',
      '',
      '--appendonly',
      'no',
    ],
    { stdio: 'ignore' }
  );
  await waitForRedis();

  const source = fs.readFileSync(
    new URL('../src/lib/shopPurchases.ts', import.meta.url),
    'utf8'
  );
  seedScript = source.match(
    /export const SHOP_SEED_SCRIPT = `([\s\S]*?)`;/u
  )?.[1];
  purchaseScript = source.match(
    /export const PURCHASE_SCRIPT = `([\s\S]*?)`;/u
  )?.[1];
  ackScript = source.match(
    /export const SALES_ACK_SCRIPT = `([\s\S]*?)`;/u
  )?.[1];
  assert.ok(seedScript, 'SHOP_SEED_SCRIPT must be exported for this harness');
  assert.ok(
    purchaseScript,
    'PURCHASE_SCRIPT must be exported for this harness'
  );
  assert.ok(ackScript, 'SALES_ACK_SCRIPT must be exported for this harness');

  // Slice 3 final review, Important finding: the item-transfer queue's own
  // atomic enqueue/ack scripts (`itemTransferQueue.ts`) share this exact
  // Redis instance and `campaignTransfersKey` shape with PURCHASE_SCRIPT's
  // own transfer append above, so the race between them is exercised here
  // rather than standing up a second Docker harness for it.
  const transferQueueSource = fs.readFileSync(
    new URL('../src/lib/itemTransferQueue.ts', import.meta.url),
    'utf8'
  );
  enqueueTransferScript = transferQueueSource.match(
    /export const ENQUEUE_ITEM_TRANSFER_SCRIPT = `([\s\S]*?)`;/u
  )?.[1];
  ackTransferScript = transferQueueSource.match(
    /export const ACK_ITEM_TRANSFER_SCRIPT = `([\s\S]*?)`;/u
  )?.[1];
  assert.ok(
    enqueueTransferScript,
    'ENQUEUE_ITEM_TRANSFER_SCRIPT must be exported for this harness'
  );
  assert.ok(
    ackTransferScript,
    'ACK_ITEM_TRANSFER_SCRIPT must be exported for this harness'
  );
});

after(() => {
  try {
    execFileSync('docker', ['stop', CONTAINER], { stdio: 'pipe' });
  } catch {}
  server?.kill('SIGTERM');
});

// Builds a SEED-shaped entry (`ShopLedgerSeed`) — the only shape
// SHOP_SEED_SCRIPT accepts as input (ARGV[1]). `seededQuantity` is the
// DM-authored TOTAL stock, never a live remaining count, and there is no
// `soldQuantity` field here at all — see the type doc on `ShopLedgerSeed`
// in src/types/shop.ts for why the two shapes are deliberately distinct.
function shopEntry(overrides = {}) {
  return {
    id: 'entry-1',
    name: 'Rope, 50ft',
    itemKind: 'inventory',
    priceCopper: 100,
    seededQuantity: 3,
    item: {
      id: 'item-1',
      name: 'Rope, 50ft',
      category: 'tool',
      quantity: 1,
      location: 'Backpack',
      tags: [],
      createdAt: '2026-08-12T00:00:00Z',
      updatedAt: '2026-08-12T00:00:00Z',
    },
    ...overrides,
  };
}

function ledgerKey(npcId) {
  return `campaign:ABC123:shop:${npcId}`;
}
function salesKey(npcId) {
  return `campaign:ABC123:shop:sales:${npcId}`;
}
function transfersKey(playerId) {
  return `campaign:ABC123:transfers:${playerId}`;
}
function receiptKey(npcId, requestId) {
  return `campaign:ABC123:shop:receipt:${npcId}:${requestId}`;
}

async function seedLedger(npcId, entries, ttl = '300') {
  return redis(
    'EVAL',
    seedScript,
    '1',
    ledgerKey(npcId),
    JSON.stringify(entries),
    ttl
  );
}

/**
 * Runs PURCHASE_SCRIPT with the documented KEYS/ARGV order (matching
 * `purchaseFromShop`'s call in shopPurchases.ts exactly). `extraArgv` lets a
 * test append arguments beyond the documented seven to prove the script
 * ignores anything extra (used for the forged-price case).
 */
async function purchase({
  npcId,
  entryId,
  requestId,
  playerId = 'player-1',
  quantity,
  now = '2026-09-06T00:00:00.000Z',
  ttl = '300',
  merchantName = 'Old Tam',
  extraArgv = [],
}) {
  const out = await redis(
    'EVAL',
    purchaseScript,
    '4',
    ledgerKey(npcId),
    transfersKey(playerId),
    salesKey(npcId),
    receiptKey(npcId, requestId),
    entryId,
    requestId,
    playerId,
    String(quantity),
    now,
    ttl,
    merchantName,
    ...extraArgv.map(String)
  );
  return JSON.parse(out.join('\n'));
}

/**
 * Runs SALES_ACK_SCRIPT with the documented KEYS/ARGV order (matching
 * `acknowledgeShopSales`'s call in shopPurchases.ts exactly).
 */
async function ackSales({ npcId, saleIds, ttl = '300' }) {
  const out = await redis(
    'EVAL',
    ackScript,
    '1',
    salesKey(npcId),
    JSON.stringify(saleIds),
    ttl
  );
  const text = out.join('\n');
  return text === '' ? [] : JSON.parse(text);
}

/**
 * Runs ENQUEUE_ITEM_TRANSFER_SCRIPT with the documented KEYS/ARGV order
 * (matching `enqueueItemTransfer`'s call in itemTransferQueue.ts exactly).
 */
async function enqueueTransfer({ playerId, transfer, ttl = '300' }) {
  const out = await redis(
    'EVAL',
    enqueueTransferScript,
    '1',
    transfersKey(playerId),
    JSON.stringify(transfer),
    ttl
  );
  return JSON.parse(out.join('\n'));
}

/**
 * Runs ACK_ITEM_TRANSFER_SCRIPT with the documented KEYS/ARGV order
 * (matching `acknowledgeItemTransfers`'s call in itemTransferQueue.ts
 * exactly).
 */
async function ackTransfers({ playerId, transferIds, ttl = '300' }) {
  const out = await redis(
    'EVAL',
    ackTransferScript,
    '1',
    transfersKey(playerId),
    JSON.stringify(transferIds),
    ttl
  );
  const text = out.join('\n');
  return text === '' ? [] : JSON.parse(text);
}

async function getJson(key) {
  const out = await redis('GET', key);
  if (out.length === 1 && out[0] === '') return null;
  return JSON.parse(out.join('\n'));
}

async function getRaw(key) {
  const out = await redis('GET', key);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// 1. Concurrent-buy race: two buyers, one unit left. Exactly one succeeds.
// ---------------------------------------------------------------------------
test('concurrent purchases for the last unit: exactly one succeeds', async () => {
  await seedLedger('npc-race', [
    shopEntry({ id: 'entry-1', seededQuantity: 1, priceCopper: 50 }),
  ]);

  const [a, b] = await Promise.all([
    purchase({
      npcId: 'npc-race',
      entryId: 'entry-1',
      requestId: 'race-a',
      playerId: 'player-race-a',
      quantity: 1,
    }),
    purchase({
      npcId: 'npc-race',
      entryId: 'entry-1',
      requestId: 'race-b',
      playerId: 'player-race-b',
      quantity: 1,
    }),
  ]);

  const results = [a, b];
  const successes = results.filter(r => !('error' in r));
  const failures = results.filter(r => 'error' in r);
  assert.equal(successes.length, 1, 'exactly one buyer should succeed');
  assert.equal(failures.length, 1, 'exactly one buyer should be rejected');
  assert.equal(failures[0].error, 'insufficient-stock');
  assert.equal(successes[0].grantedQuantity, 1);
  assert.equal(successes[0].costCopper, 50);
  assert.equal(successes[0].remainingQuantity, 0);

  const ledger = await getJson(ledgerKey('npc-race'));
  assert.equal(ledger[0].remainingQuantity, 0);
  assert.equal(ledger[0].soldQuantity, 1);
});

// ---------------------------------------------------------------------------
// 2. Receipt replay: retried requestId returns the original result and does
//    not double-decrement stock, re-enqueue, re-append a sale, or re-charge.
// ---------------------------------------------------------------------------
test('replaying a requestId returns the original receipt and mutates nothing again', async () => {
  await seedLedger('npc-replay', [
    shopEntry({ id: 'entry-1', seededQuantity: 5, priceCopper: 100 }),
  ]);

  const first = await purchase({
    npcId: 'npc-replay',
    entryId: 'entry-1',
    requestId: 'replay-1',
    playerId: 'player-replay',
    quantity: 2,
  });
  assert.equal(first.grantedQuantity, 2);
  assert.equal(first.costCopper, 200);
  assert.equal(first.remainingQuantity, 3);

  const replay = await purchase({
    npcId: 'npc-replay',
    entryId: 'entry-1',
    requestId: 'replay-1',
    playerId: 'player-replay',
    quantity: 2,
  });
  assert.deepEqual(
    replay,
    first,
    'replay must return the byte-identical result'
  );

  const ledger = await getJson(ledgerKey('npc-replay'));
  assert.equal(
    ledger[0].remainingQuantity,
    3,
    'stock must not decrement again'
  );
  assert.equal(
    ledger[0].soldQuantity,
    2,
    'soldQuantity must not increment again'
  );

  const transfers = await getJson(transfersKey('player-replay'));
  assert.equal(transfers.length, 1, 'no second transfer enqueued');

  const sales = await getJson(salesKey('npc-replay'));
  assert.equal(sales.length, 1, 'no second sale row appended');
});

// ---------------------------------------------------------------------------
// 3. Stock exhaustion and the shop-closed / entry-not-found error taxonomy.
// ---------------------------------------------------------------------------
test('stock exhaustion returns insufficient-stock without going negative', async () => {
  await seedLedger('npc-exhaust', [
    shopEntry({ id: 'entry-1', seededQuantity: 2, priceCopper: 10 }),
  ]);

  const buyAll = await purchase({
    npcId: 'npc-exhaust',
    entryId: 'entry-1',
    requestId: 'exhaust-1',
    playerId: 'player-exhaust',
    quantity: 2,
  });
  assert.equal(buyAll.remainingQuantity, 0);

  const depleted = await purchase({
    npcId: 'npc-exhaust',
    entryId: 'entry-1',
    requestId: 'exhaust-2',
    playerId: 'player-exhaust',
    quantity: 1,
  });
  assert.deepEqual(depleted, { error: 'insufficient-stock' });

  const ledger = await getJson(ledgerKey('npc-exhaust'));
  assert.equal(
    ledger[0].remainingQuantity,
    0,
    'must clamp at zero, never negative'
  );
});

test('shop-closed and entry-not-found are returned verbatim by the real script', async () => {
  const closed = await purchase({
    npcId: 'npc-never-seeded',
    entryId: 'entry-1',
    requestId: 'closed-1',
    playerId: 'player-closed',
    quantity: 1,
  });
  assert.deepEqual(closed, { error: 'shop-closed' });

  await seedLedger('npc-missing-entry', [shopEntry({ id: 'entry-1' })]);
  const missing = await purchase({
    npcId: 'npc-missing-entry',
    entryId: 'does-not-exist',
    requestId: 'missing-1',
    playerId: 'player-missing',
    quantity: 1,
  });
  assert.deepEqual(missing, { error: 'entry-not-found' });
});

// ---------------------------------------------------------------------------
// 4. First-transfer-carries-the-whole-cost for a magic-item purchase of N>1.
// ---------------------------------------------------------------------------
test('a magic-item purchase of N stamps costCopper on transfer 0 only', async () => {
  await seedLedger('npc-magic', [
    shopEntry({
      id: 'wand-1',
      itemKind: 'magic',
      priceCopper: 40,
      seededQuantity: 10,
      item: {
        id: 'item-wand',
        name: 'Wand of Magic Missiles',
        rarity: 'uncommon',
      },
    }),
  ]);

  const receipt = await purchase({
    npcId: 'npc-magic',
    entryId: 'wand-1',
    requestId: 'magic-1',
    playerId: 'player-magic',
    quantity: 3,
  });
  assert.equal(receipt.grantedQuantity, 3);
  assert.equal(receipt.costCopper, 120);
  assert.equal(receipt.transferIds.length, 3);

  const transfers = await getJson(transfersKey('player-magic'));
  assert.equal(transfers.length, 3);
  assert.equal(transfers[0].costCopper, 120);
  assert.equal(transfers[1].costCopper, 0);
  assert.equal(transfers[2].costCopper, 0);
  assert.equal(
    new Set(transfers.map(t => t.id)).size,
    3,
    'transfer ids must be distinct'
  );
  assert.ok(transfers.every(t => t.itemKind === 'magic'));
});

// ---------------------------------------------------------------------------
// 5. The client's asserted price is ignored — the charge comes from the
//    ledger's priceCopper, never from anything the caller sends.
// ---------------------------------------------------------------------------
test('a forged price argument is ignored; cost always derives from the ledger', async () => {
  await seedLedger('npc-forged', [
    shopEntry({ id: 'entry-1', priceCopper: 75, seededQuantity: 5 }),
  ]);

  // The documented ARGV list has exactly 7 entries; the script never reads
  // an 8th. Append a forged "price" far larger than the real one and prove
  // it has zero effect on the computed charge.
  const receipt = await purchase({
    npcId: 'npc-forged',
    entryId: 'entry-1',
    requestId: 'forged-1',
    playerId: 'player-forged',
    quantity: 2,
    extraArgv: [999_999_999],
  });
  assert.equal(
    receipt.costCopper,
    150,
    'cost must be priceCopper(75) * granted(2)'
  );
  assert.equal(receipt.grantedQuantity, 2);
});

// ---------------------------------------------------------------------------
// 6. Fractional quantity floors to an integer; the ledger stays parseable.
// ---------------------------------------------------------------------------
test('a fractional quantity floors and leaves the ledger integer-clean', async () => {
  await seedLedger('npc-fraction', [
    shopEntry({ id: 'entry-1', priceCopper: 10, seededQuantity: 5 }),
  ]);

  const receipt = await purchase({
    npcId: 'npc-fraction',
    entryId: 'entry-1',
    requestId: 'fraction-1',
    playerId: 'player-fraction',
    quantity: '2.5',
  });
  assert.equal(receipt.grantedQuantity, 2, '2.5 must floor to 2');
  assert.equal(receipt.costCopper, 20);
  assert.equal(receipt.remainingQuantity, 3);
  assert.ok(Number.isInteger(receipt.grantedQuantity));
  assert.ok(Number.isInteger(receipt.costCopper));
  assert.ok(Number.isInteger(receipt.remainingQuantity));

  const raw = await getRaw(ledgerKey('npc-fraction'));
  const ledger = JSON.parse(raw); // must not throw
  assert.equal(ledger[0].remainingQuantity, 3);
  assert.equal(ledger[0].soldQuantity, 2);
  assert.ok(Number.isInteger(ledger[0].remainingQuantity));
  assert.ok(Number.isInteger(ledger[0].soldQuantity));
});

// ---------------------------------------------------------------------------
// 7. Large price formatting: MAX_PRICE_COPPER * a large granted quantity
//    must persist as a plain integer everywhere, never scientific notation.
// ---------------------------------------------------------------------------
test('MAX_PRICE_COPPER times a large granted quantity never renders in scientific notation', async () => {
  const MAX_PRICE_COPPER = 100_000_000;
  await seedLedger('npc-bigprice', [
    shopEntry({
      id: 'artifact-1',
      itemKind: 'magic',
      priceCopper: MAX_PRICE_COPPER,
      seededQuantity: 999,
      item: { id: 'item-artifact', name: 'Artifact', rarity: 'legendary' },
    }),
  ]);

  // itemKind 'magic' clamps granted to MAX_MAGIC_PURCHASE_UNITS (25), so the
  // charge is 100,000,000 * 25 = 2,500,000,000 — comfortably inside
  // Number's safe integer range but well past float32 and worth pinning.
  const receiptRaw = await redis(
    'EVAL',
    purchaseScript,
    '4',
    ledgerKey('npc-bigprice'),
    transfersKey('player-bigprice'),
    salesKey('npc-bigprice'),
    receiptKey('npc-bigprice', 'bigprice-1'),
    'artifact-1',
    'bigprice-1',
    'player-bigprice',
    '100',
    '2026-09-06T00:00:00.000Z',
    '300',
    'Old Tam'
  );
  const receiptText = receiptRaw.join('\n');
  assert.doesNotMatch(
    receiptText,
    /\d[eE][+-]?\d/u,
    'receipt must not contain scientific notation'
  );
  const receipt = JSON.parse(receiptText);
  assert.equal(receipt.grantedQuantity, 25);
  assert.equal(receipt.costCopper, 2_500_000_000);
  assert.ok(Number.isInteger(receipt.costCopper));

  const salesRaw = await getRaw(salesKey('npc-bigprice'));
  assert.doesNotMatch(
    salesRaw,
    /\d[eE][+-]?\d/u,
    'sales log must not contain scientific notation'
  );
  const sales = JSON.parse(salesRaw);
  assert.equal(sales[0].copper, 2_500_000_000);

  const ledgerRaw = await getRaw(ledgerKey('npc-bigprice'));
  assert.doesNotMatch(
    ledgerRaw,
    /\d[eE][+-]?\d/u,
    'ledger must not contain scientific notation'
  );
  const ledger = JSON.parse(ledgerRaw);
  assert.equal(ledger[0].remainingQuantity, 999 - 25);
  assert.equal(ledger[0].priceCopper, MAX_PRICE_COPPER);
});

// ---------------------------------------------------------------------------
// 8. The stock model, CORRECTED (Slice 3 final review, Critical finding —
//    controller ruling R5 superseded). R5's model hand-fed
//    `seededQuantity: 10` back into the seed script after a sale of 2 and
//    asserted the result was 8 (`10 - 2`) — but that is NOT what the real
//    client sends: `buildShopLedger` reads `NPCInventoryItem.quantity`,
//    which `useDmShopSalesSync`'s drain has ALREADY decremented by the sold
//    amount, so the client's next republish sends `seededQuantity: 8`, not
//    10. Feeding the old test's `10` a second time double-subtracted every
//    sale (see `SHOP_SEED_SCRIPT`'s doc comment in shopPurchases.ts for the
//    full arithmetic). This test models what the client actually sends —
//    the current live count, already net of sales — at every republish, and
//    proves stock is neither eroded nor silently restocked by a
//    change-nothing reseed.
// ---------------------------------------------------------------------------
test('stock model: republish carries the client-authored live count and never re-subtracts a sale', async () => {
  const seeded = await seedLedger('npc-restock', [
    shopEntry({ id: 'entry-1', seededQuantity: 10 }),
  ]);
  const initial = JSON.parse(seeded.join('\n'));
  assert.equal(initial[0].remainingQuantity, 10);
  assert.equal(initial[0].soldQuantity, 0);

  const sale = await purchase({
    npcId: 'npc-restock',
    entryId: 'entry-1',
    requestId: 'restock-1',
    playerId: 'player-restock',
    quantity: 2,
  });
  assert.equal(sale.remainingQuantity, 8);

  // The real client sends 8 here (its own NPCInventoryItem.quantity, already
  // decremented by the drain) — never the original 10.
  const republishUnchanged = await seedLedger('npc-restock', [
    shopEntry({ id: 'entry-1', seededQuantity: 8 }),
  ]);
  const afterRepublish = JSON.parse(republishUnchanged.join('\n'));
  assert.equal(
    afterRepublish[0].remainingQuantity,
    8,
    'republishing the client-authored live count must leave stock exactly ' +
      'unchanged, never re-subtract the sale a second time (the bug: this ' +
      'used to compute 8 - 2 = 6)'
  );
  assert.equal(
    afterRepublish[0].soldQuantity,
    0,
    'soldQuantity is a since-last-publish counter now, reset on every reseed'
  );

  // Reseed-after-sale (the case the critical finding calls out explicitly):
  // sell again, then republish with the new live count unchanged from what
  // the sale left. Stock must stay exactly there, not erode further.
  const secondSale = await purchase({
    npcId: 'npc-restock',
    entryId: 'entry-1',
    requestId: 'restock-2',
    playerId: 'player-restock',
    quantity: 1,
  });
  assert.equal(secondSale.remainingQuantity, 7);

  const reseedAfterSecondSale = await seedLedger('npc-restock', [
    shopEntry({ id: 'entry-1', seededQuantity: 7 }),
  ]);
  const afterSecondRepublish = JSON.parse(reseedAfterSecondSale.join('\n'));
  assert.equal(
    afterSecondRepublish[0].remainingQuantity,
    7,
    'reseeding after a second sale must leave stock at exactly the live ' +
      'count sent, not erode it toward zero across repeated edits'
  );

  // Genuine restocking (the DM adding inventory) still takes effect
  // immediately — the live count is written straight through, no clamp
  // against anything previously stored.
  const restocked = await seedLedger('npc-restock', [
    shopEntry({ id: 'entry-1', seededQuantity: 20 }),
  ]);
  const afterRestock = JSON.parse(restocked.join('\n'));
  assert.equal(afterRestock[0].remainingQuantity, 20);
  assert.equal(afterRestock[0].soldQuantity, 0);
});

// ---------------------------------------------------------------------------
// 9. The seed round-trip hazard, FIXED (ruling R6, Task 5 review of Task 3):
//    the script used to read incoming.remainingQuantity as freshly-authored
//    stock, which meant feeding the stored/parsed ledger straight back into
//    the seed script silently eroded stock (8 -> 6 -> 4). SHOP_SEED_SCRIPT
//    now reads incoming.seededQuantity instead — a field the stored shape
//    never carries — so that exact round-trip is no longer silent data
//    corruption; it is a hard script failure that leaves the ledger
//    untouched. (The TypeScript half of this guarantee — that
//    `ShopLedgerEntry` no longer type-checks as `seedShopLedger`'s input at
//    all — is asserted separately in shopPurchases.test.ts and
//    types/__tests__/shop.test.ts; this script has no type system to
//    exercise, so it pins the runtime consequence instead.)
// ---------------------------------------------------------------------------
test('the former round-trip hazard is now a hard script failure, not a silent erosion', async () => {
  await seedLedger('npc-hazard', [
    shopEntry({ id: 'entry-1', seededQuantity: 10 }),
  ]);
  const afterSale = await purchase({
    npcId: 'npc-hazard',
    entryId: 'entry-1',
    requestId: 'hazard-1',
    playerId: 'player-hazard',
    quantity: 2,
  });
  assert.equal(afterSale.remainingQuantity, 8);

  // Read back the authoritative stored ledger (remainingQuantity/
  // soldQuantity, no seededQuantity) and feed it straight into the seed
  // script, exactly as a naive "republish" implementation might have done
  // before this fix. `entry.seededQuantity` is now nil in Lua, so
  // `seeded - sold` throws instead of silently computing 8 - 2 = 6.
  const stored = await getJson(ledgerKey('npc-hazard'));
  assert.equal(
    'seededQuantity' in stored[0],
    false,
    'sanity check: the stored shape must not carry seededQuantity'
  );
  const rejected = await seedLedger('npc-hazard', stored);
  const rejectedText = rejected.join('\n');
  assert.match(
    rejectedText,
    /nil value/i,
    'feeding the stored ledger back into seed must fail loudly (Lua arithmetic-on-nil), not silently erode stock'
  );

  // Confirm the rejected attempt mutated nothing: stock is exactly what it
  // was before the bad reseed was attempted.
  const ledgerAfter = await getJson(ledgerKey('npc-hazard'));
  assert.equal(
    ledgerAfter[0].remainingQuantity,
    8,
    'a rejected reseed must leave the ledger untouched'
  );
  assert.equal(ledgerAfter[0].soldQuantity, 2);
});

// ---------------------------------------------------------------------------
// 10. Nested empty arrays: cjson turns {} tags into an empty OBJECT on
//     round-trip, not an empty array. No consumer reads .tags today; this
//     pins the behaviour rather than asserting it is "correct".
// ---------------------------------------------------------------------------
test('CHARACTERIZATION: an empty tags array round-trips through cjson as {} (an object, not an array)', async () => {
  await seedLedger('npc-tags', [
    shopEntry({
      id: 'entry-1',
      seededQuantity: 5,
      item: { ...shopEntry().item, tags: [] },
    }),
  ]);

  const receipt = await purchase({
    npcId: 'npc-tags',
    entryId: 'entry-1',
    requestId: 'tags-1',
    playerId: 'player-tags',
    quantity: 1,
  });
  assert.equal(receipt.grantedQuantity, 1);

  const transfers = await getJson(transfersKey('player-tags'));
  const { tags } = transfers[0].item;
  assert.equal(
    Array.isArray(tags),
    false,
    'cjson collapses an empty array to a table, not a JSON array'
  );
  assert.deepEqual(
    tags,
    {},
    'the empty tags array lands as an empty object after the cjson round-trip'
  );
});

// ---------------------------------------------------------------------------
// 11. Task 12a review fix (Critical): the sales-log acknowledge must be
//     atomic against a concurrent PURCHASE_SCRIPT append. A first version of
//     the DELETE route did `GET` -> filter in JS -> `SET`/`DEL` from the
//     route handler itself; a purchase landing in the gap between that GET
//     and SET would be silently erased by a write computed from the stale
//     snapshot. SALES_ACK_SCRIPT closes that window by doing the whole
//     read-filter-write inside one EVAL, exactly like PURCHASE_SCRIPT's own
//     append. Regardless of which of the two concurrent EVALs Redis happens
//     to run first (Redis serializes both, but the ORDER is not controlled
//     by this test), the final log must contain the newly-appended sale and
//     must NOT contain the acknowledged ids — there is no interleaving that
//     loses either.
// ---------------------------------------------------------------------------
test('acknowledging sales is atomic against a concurrent purchase append: the new sale always survives', async () => {
  await seedLedger('npc-ack-race', [
    shopEntry({ id: 'entry-1', seededQuantity: 5, priceCopper: 20 }),
  ]);

  // Two sales already sitting in the log, as if from earlier purchases the
  // DM has already applied client-side and is now acknowledging.
  const preExisting = [
    {
      id: 'sale-old-1',
      entryId: 'entry-1',
      quantity: 1,
      copper: 20,
      playerId: 'player-old',
      at: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'sale-old-2',
      entryId: 'entry-1',
      quantity: 1,
      copper: 20,
      playerId: 'player-old',
      at: '2026-09-01T00:00:01.000Z',
    },
  ];
  await redis('SET', salesKey('npc-ack-race'), JSON.stringify(preExisting));

  const [, purchaseResult] = await Promise.all([
    ackSales({ npcId: 'npc-ack-race', saleIds: ['sale-old-1', 'sale-old-2'] }),
    purchase({
      npcId: 'npc-ack-race',
      entryId: 'entry-1',
      requestId: 'ack-race-1',
      playerId: 'player-new',
      quantity: 1,
    }),
  ]);
  assert.equal(purchaseResult.grantedQuantity, 1);

  const finalSales = await getJson(salesKey('npc-ack-race'));
  const finalIds = finalSales.map(s => s.id);
  assert.deepEqual(
    finalIds,
    ['sale-ack-race-1'],
    'the concurrently-appended sale must survive, and both acknowledged ' +
      'ids must be gone, regardless of EVAL execution order'
  );
});

// ---------------------------------------------------------------------------
// 12. The acknowledge script's own basic correctness: a subset ack leaves
//     the rest of the log intact, in one write; acking everything deletes
//     the key rather than leaving an empty array (matching PURCHASE_SCRIPT's
//     own "empty array or DEL" convention for zero-length collections).
// ---------------------------------------------------------------------------
test('SALES_ACK_SCRIPT removes only the acknowledged ids and deletes the key when nothing remains', async () => {
  await redis(
    'SET',
    salesKey('npc-ack-basic'),
    JSON.stringify([
      {
        id: 'sale-a',
        entryId: 'entry-1',
        quantity: 1,
        copper: 10,
        playerId: 'player-a',
        at: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'sale-b',
        entryId: 'entry-1',
        quantity: 1,
        copper: 10,
        playerId: 'player-b',
        at: '2026-09-01T00:00:01.000Z',
      },
      {
        id: 'sale-c',
        entryId: 'entry-1',
        quantity: 1,
        copper: 10,
        playerId: 'player-c',
        at: '2026-09-01T00:00:02.000Z',
      },
    ])
  );

  const afterSubset = await ackSales({
    npcId: 'npc-ack-basic',
    saleIds: ['sale-b'],
  });
  assert.deepEqual(
    afterSubset.map(s => s.id),
    ['sale-a', 'sale-c']
  );

  const stillThere = await getJson(salesKey('npc-ack-basic'));
  assert.deepEqual(
    stillThere.map(s => s.id),
    ['sale-a', 'sale-c']
  );

  const afterRest = await ackSales({
    npcId: 'npc-ack-basic',
    saleIds: ['sale-a', 'sale-c'],
  });
  assert.deepEqual(afterRest, []);

  const raw = await redis('EXISTS', salesKey('npc-ack-basic'));
  assert.equal(raw[0], '0', 'the key must be deleted, not left as "[]"');
});

// ---------------------------------------------------------------------------
// 13. Final review, Important finding: the item-transfer queue's enqueue and
//     batch-ack used to be a plain GET -> push -> SET and a plain
//     GET -> filter -> SET/DEL, non-atomic against EACH OTHER on the same
//     `campaignTransfersKey`. Interleaved, an ack's stale snapshot (read
//     BEFORE a concurrent enqueue's write landed) could resurrect an
//     already-acknowledged transfer: `ack GET [T]` -> `enqueue GET [T]` ->
//     `ack DEL key` -> `enqueue SET [T, gift]`. Moving both into their own
//     Lua EVALs (ENQUEUE_ITEM_TRANSFER_SCRIPT / ACK_ITEM_TRANSFER_SCRIPT)
//     closes the window the same way SALES_ACK_SCRIPT already closes the
//     identical class of race against PURCHASE_SCRIPT's append (test 11
//     above). Regardless of which of the two concurrent EVALs Redis happens
//     to run first, the final queue must contain the newly-enqueued gift and
//     must NOT contain the acknowledged transfer — there is no interleaving
//     that resurrects it.
// ---------------------------------------------------------------------------
test('acknowledging a transfer is atomic against a concurrent enqueue: the acknowledged transfer never resurrects', async () => {
  const alreadyApplied = {
    id: 'transfer-shop-already-applied',
    item: { id: 'item-1', name: 'Rope, 50ft', quantity: 1 },
    itemKind: 'inventory',
    fromPlayerName: 'Shop',
    fromCharacterName: 'Old Tam',
    fromType: 'npc',
    sentAt: '2026-09-01T00:00:00.000Z',
    costCopper: 100,
  };
  await redis(
    'SET',
    transfersKey('player-transfer-race'),
    JSON.stringify([alreadyApplied])
  );

  const gift = {
    id: 'transfer-gift-1',
    item: { id: 'item-2', name: 'Potion of Healing', quantity: 1 },
    itemKind: 'inventory',
    fromPlayerName: 'Dungeon Master',
    fromCharacterName: 'The DM',
    fromType: 'dm',
    sentAt: '2026-09-01T00:00:01.000Z',
    costCopper: 0,
  };

  await Promise.all([
    ackTransfers({
      playerId: 'player-transfer-race',
      transferIds: ['transfer-shop-already-applied'],
    }),
    enqueueTransfer({ playerId: 'player-transfer-race', transfer: gift }),
  ]);

  const finalQueue = await getJson(transfersKey('player-transfer-race'));
  const finalIds = finalQueue.map(t => t.id);
  assert.deepEqual(
    finalIds,
    ['transfer-gift-1'],
    'the concurrently-enqueued gift must survive, and the acknowledged ' +
      'transfer must stay gone, regardless of EVAL execution order'
  );
});
