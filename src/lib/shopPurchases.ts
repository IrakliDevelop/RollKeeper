import type { Redis } from '@upstash/redis';

import type { ShopLedgerEntry } from '@/types/shop';

const MAX_LEDGER_ENTRIES = 500;

/**
 * Seeds/reseeds a shop's authoritative ledger (VTT merchants Slice 3, Task 3).
 * Modelled directly on `markerLootClaims.ts`'s `SEED_SCRIPT`: the DM's
 * freshly-authored rows (`ARGV[1]`) always win on every field EXCEPT
 * `remainingQuantity`, which must never increase past what is already
 * persisted — a lower persisted value means units were already sold, and a
 * reseed (price edit, new item added, etc.) must not resurrect them. Unlike
 * marker loot, a shop row has no separate quantity/claimed pair — a single
 * `remainingQuantity` counter serves both roles — so the two-step
 * (inherit-then-clamp) dance collapses into one min() comparison:
 *
 *   if the OLD remaining is lower than the incoming one, keep the OLD
 *   (lower) value — this is what "preserves already-sold quantities" means.
 *   Otherwise the incoming (lower or equal) value is already the more
 *   depleted one — e.g. the DM reducing stock — so it is kept as-is; this is
 *   what "clamps a reduced stock" means.
 *
 * Rows are matched by `id` alone (a shop ledger is already scoped to one
 * NPC via the Redis key, unlike marker loot's ledger which spans every
 * marker on a map and needs the `markerId:id` composite).
 */
export const SHOP_SEED_SCRIPT = `
local oldRaw = redis.call('GET', KEYS[1])
local oldById = {}
if oldRaw then
  local old = cjson.decode(oldRaw)
  for _, entry in ipairs(old) do
    oldById[entry.id] = entry
  end
end
local incoming = cjson.decode(ARGV[1])
for _, entry in ipairs(incoming) do
  local old = oldById[entry.id]
  if old and old.remainingQuantity < entry.remainingQuantity then
    entry.remainingQuantity = old.remainingQuantity
  end
  if entry.remainingQuantity < 0 then
    entry.remainingQuantity = 0
  end
end
local encoded = #incoming == 0 and '[]' or cjson.encode(incoming)
redis.call('SET', KEYS[1], encoded, 'EX', ARGV[2])
return encoded
`;

/**
 * Executes one purchase atomically (VTT merchants Slice 3, Task 3). One
 * round trip, in the spec's order:
 *
 *   1. receipt already exists (a replayed `requestId`)  -> replay it verbatim
 *   2. ledger missing (shop closed / never published)   -> 'shop-closed'
 *   3. entry missing from the ledger                    -> 'entry-not-found'
 *   4. remaining stock < the raw requested quantity      -> 'insufficient-stock'
 *   5. price = entry.priceCopper * the GRANTED quantity  -- server's price;
 *      the client never supplies one, and none is read from ARGV
 *   6. decrement remaining by the granted quantity
 *   7. enqueue transfers onto the player's transfer queue
 *   8. append a sale row for DM-side reconciliation
 *   9. write the receipt (so a retry short-circuits at step 1)
 *
 * `MAX_MAGIC_PURCHASE_UNITS` mirrors `markerLootClaims.ts`'s
 * `MAX_MAGIC_CLAIM_UNITS`: an uncapped magic-item purchase would clone the
 * full item definition into the transfer queue once per unit, so a request
 * for hundreds of units (still passing the stock check, if the shop happens
 * to be stocked that deep) could blow the queue's JSON blob up unboundedly.
 * Note this is a CLAMP on the granted amount, not a rejection — the stock
 * gate at step 4 already used the raw requested quantity, so a request that
 * clears step 4 but exceeds the cap is still fulfilled, just for fewer units
 * than asked, exactly like marker loot's claim. `grantedQuantity` in the
 * result is how the route/client learn that happened; the taxonomy of
 * *rejected* purchases stays exactly the three errors above.
 *
 * The first-transfer-carries-the-whole-cost rule: a magic-item purchase of N
 * units enqueues N individual transfers (each needs its own id/clone so it
 * can be applied independently), but the coin debit must happen exactly
 * once per purchase. `costCopper` is therefore stamped on transfer index 0
 * only; every other transfer in the same purchase carries `costCopper = 0`.
 * An inventory (stackable) row only ever produces one transfer (quantity
 * folded into that single item, as marker loot's claim script already does
 * for its `inventory` branch), so for that branch the "first" transfer is
 * trivially the only one.
 */
export const PURCHASE_SCRIPT = `
-- See MAX_MAGIC_CLAIM_UNITS in markerLootClaims.ts for the identical
-- fan-out concern; shop purchases have their own cap because the queue
-- being protected (a player's transfer queue) is a different key.
local MAX_MAGIC_PURCHASE_UNITS = 25

local receiptKey = KEYS[4]
local previous = redis.call('GET', receiptKey)
if previous then return previous end

local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({ error = 'shop-closed' }) end
local ledger = cjson.decode(raw)
local selected = nil
for _, entry in ipairs(ledger) do
  if entry.id == ARGV[1] then
    selected = entry
    break
  end
end
if not selected then return cjson.encode({ error = 'entry-not-found' }) end

local requested = tonumber(ARGV[4]) or 1
if requested < 1 then requested = 1 end
if selected.remainingQuantity < requested then
  return cjson.encode({ error = 'insufficient-stock' })
end

local granted = requested
if selected.itemKind == 'magic' and granted > MAX_MAGIC_PURCHASE_UNITS then
  granted = MAX_MAGIC_PURCHASE_UNITS
end

local price = selected.priceCopper * granted
selected.remainingQuantity = selected.remainingQuantity - granted

local transferIdPrefix = 'transfer-shop-' .. ARGV[2]
local transferIds = {}
local queueRaw = redis.call('GET', KEYS[2])
local queue = queueRaw and cjson.decode(queueRaw) or {}

if selected.itemKind == 'inventory' then
  local item = cjson.decode(cjson.encode(selected.item))
  item.quantity = granted
  local id = transferIdPrefix .. '-0'
  table.insert(queue, {
    id = id, item = item, itemKind = 'inventory',
    fromPlayerName = 'Shop', fromCharacterName = ARGV[7],
    fromType = 'npc', sentAt = ARGV[5], costCopper = price
  })
  table.insert(transferIds, id)
else
  for index = 0, granted - 1 do
    local item = cjson.decode(cjson.encode(selected.item))
    local id = transferIdPrefix .. '-' .. index
    local costCopper = 0
    if index == 0 then costCopper = price end
    table.insert(queue, {
      id = id, item = item, itemKind = 'magic',
      fromPlayerName = 'Shop', fromCharacterName = ARGV[7],
      fromType = 'npc', sentAt = ARGV[5], costCopper = costCopper
    })
    table.insert(transferIds, id)
  end
end

redis.call('SET', KEYS[1], cjson.encode(ledger), 'EX', ARGV[6])
redis.call('SET', KEYS[2], cjson.encode(queue), 'EX', ARGV[6])

local salesRaw = redis.call('GET', KEYS[3])
local sales = salesRaw and cjson.decode(salesRaw) or {}
table.insert(sales, {
  id = 'sale-' .. ARGV[2], entryId = ARGV[1], quantity = granted,
  copper = price, playerId = ARGV[3], at = ARGV[5]
})
redis.call('SET', KEYS[3], cjson.encode(sales), 'EX', ARGV[6])

local result = {
  requestId = ARGV[2], entryId = ARGV[1], playerId = ARGV[3],
  grantedQuantity = granted, costCopper = price,
  remainingQuantity = selected.remainingQuantity,
  transferIds = transferIds
}
local resultRaw = cjson.encode(result)
redis.call('SET', receiptKey, resultRaw, 'EX', ARGV[6])
return resultRaw
`;

function isShopLedgerEntry(value: unknown): value is ShopLedgerEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ShopLedgerEntry> & { item?: unknown };
  if (
    typeof entry.id !== 'string' ||
    entry.id.length === 0 ||
    entry.id.length > 200 ||
    typeof entry.name !== 'string' ||
    entry.name.length === 0 ||
    entry.name.length > 300 ||
    (entry.itemKind !== 'inventory' && entry.itemKind !== 'magic') ||
    !Number.isInteger(entry.priceCopper) ||
    entry.priceCopper! < 0 ||
    !Number.isInteger(entry.remainingQuantity) ||
    entry.remainingQuantity! < 0 ||
    entry.remainingQuantity! > 999 ||
    (entry.description !== undefined &&
      typeof entry.description !== 'string') ||
    (entry.rarity !== undefined && typeof entry.rarity !== 'string')
  ) {
    return false;
  }
  if (!entry.item || typeof entry.item !== 'object') return false;
  const { name } = entry.item;
  return typeof name === 'string' && name.length > 0 && name.length <= 300;
}

/**
 * Validates a DM-authored shop seed before it is written through
 * `SHOP_SEED_SCRIPT`. Mirrors `validateMarkerLootSeed`'s bounds discipline
 * (length caps, per-entry validity, duplicate-id rejection); unlike that
 * function there is no `locked` flag to default, so a valid entry is
 * returned as-is.
 */
export function validateShopLedgerSeed(
  value: unknown
): ShopLedgerEntry[] | null {
  if (!Array.isArray(value) || value.length > MAX_LEDGER_ENTRIES) return null;
  if (!value.every(isShopLedgerEntry)) return null;
  const ids = new Set(value.map(entry => entry.id));
  if (ids.size !== value.length) return null;
  return value.map(entry => ({ ...entry }));
}

/**
 * Redis Lua's `cjson` encodes an empty table as `{}` unless the script
 * writes the JSON array literal explicitly — `SHOP_SEED_SCRIPT` does that,
 * but a ledger written before this guard existed (or by any other path)
 * could still be stored as `{}`. Accept that legacy representation, exactly
 * as `parseStoredMarkerLootLedger` does, while rejecting any other
 * malformed ledger shape.
 */
export function parseStoredShopLedger(raw: string | null): ShopLedgerEntry[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Object.keys(parsed).length === 0
  ) {
    return [];
  }
  const ledger = validateShopLedgerSeed(parsed);
  if (!ledger) throw new Error('Invalid shop ledger');
  return ledger;
}

export async function seedShopLedger(
  redis: Redis,
  key: string,
  entries: ShopLedgerEntry[],
  ttlSeconds: number
): Promise<ShopLedgerEntry[]> {
  const raw = await redis.eval(
    SHOP_SEED_SCRIPT,
    [key],
    [JSON.stringify(entries), ttlSeconds]
  );
  return parseStoredShopLedger(String(raw));
}

/** The idempotent result of one purchase, as written to the receipt key. */
export interface ShopPurchaseReceipt {
  requestId: string;
  npcId: string;
  entryId: string;
  playerId: string;
  /** May be less than the requested quantity when the magic-item fan-out
   *  cap applied — never because of partial stock (that path is rejected
   *  outright as 'insufficient-stock' instead). */
  grantedQuantity: number;
  /** Integer copper actually charged: `priceCopper * grantedQuantity`,
   *  computed server-side. Never derived from anything the client sent. */
  costCopper: number;
  remainingQuantity: number;
  /** One id per enqueued transfer, in the order they were enqueued; index 0
   *  is the transfer that carries `costCopper`. */
  transferIds: string[];
}

export type PurchaseFromShopResult =
  | { ok: true; receipt: ShopPurchaseReceipt }
  | {
      ok: false;
      error: 'shop-closed' | 'entry-not-found' | 'insufficient-stock';
    };

export async function purchaseFromShop(
  redis: Redis,
  keys: { ledger: string; transfers: string; sales: string; receipt: string },
  input: {
    npcId: string;
    entryId: string;
    playerId: string;
    requestId: string;
    /** Stamped onto every enqueued transfer's `fromCharacterName`. */
    merchantName: string;
    /** The quantity the player asked for. Never a price — the server always
     *  computes `costCopper` itself from the ledger's `priceCopper`. */
    quantity: number;
    now: string;
  },
  ttlSeconds: number
): Promise<PurchaseFromShopResult> {
  const raw = await redis.eval(
    PURCHASE_SCRIPT,
    [keys.ledger, keys.transfers, keys.sales, keys.receipt],
    [
      input.entryId,
      input.requestId,
      input.playerId,
      input.quantity,
      input.now,
      ttlSeconds,
      input.merchantName,
    ]
  );
  const parsed = JSON.parse(String(raw)) as
    | Omit<ShopPurchaseReceipt, 'npcId'>
    | { error: 'shop-closed' | 'entry-not-found' | 'insufficient-stock' };
  if ('error' in parsed) return { ok: false, error: parsed.error };
  return { ok: true, receipt: { npcId: input.npcId, ...parsed } };
}
