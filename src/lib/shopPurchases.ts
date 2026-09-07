import type { Redis } from '@upstash/redis';

import type { ShopLedgerEntry } from '@/types/shop';

const MAX_LEDGER_ENTRIES = 500;

/**
 * Upper bound on a ledger row's `priceCopper`. `cjson` (Redis's Lua JSON
 * codec) encodes numbers with `%.14g`, so an integer at/beyond roughly 1e15
 * prints in scientific notation (`1e+15`) — still valid JSON, but silently
 * lossy the moment it round-trips through a receipt or sale row that then
 * gets replayed or re-parsed. `100_000_000` (one million gold pieces) keeps
 * `price * MAX_MAGIC_PURCHASE_UNITS` (2.5e9) far inside both `Number`'s safe
 * integer range and `cjson`'s 14 significant digits, with a wide margin.
 */
const MAX_PRICE_COPPER = 100_000_000;

/** Cumulative sold-units counter, mirrored on every ledger row; see the cap
 *  rationale on `ShopLedgerEntry.soldQuantity`. Generous but bounded so a
 *  pathological row can't grow the ledger's numeric fields without limit. */
const MAX_SOLD_QUANTITY = 1_000_000;

/**
 * Seeds/reseeds a shop's authoritative ledger (VTT merchants Slice 3, Task 3).
 * Modelled directly on `markerLootClaims.ts`'s `SEED_SCRIPT`, but using the
 * two-field model marker loot uses (`quantity`/`claimedQuantity`) rather than
 * a bare non-increasing counter: incoming rows (`ARGV[1]`) carry the DM's
 * freshly-authored *total* stock in `remainingQuantity` (Task 2's
 * `buildShopLedger` always emits `soldQuantity: 0`, since a fresh build from
 * the NPC's inventory has no notion of sales). This script:
 *
 *   1. inherits the OLD row's `soldQuantity` (0 if the row is new), and
 *   2. recomputes `remainingQuantity = max(0, freshlyAuthoredStock - soldQuantity)`.
 *
 * This is deliberately NOT a `min(old, incoming)` comparison — an earlier
 * version of this script used that, which satisfies "never resurrect sold
 * units" but ALSO makes `remainingQuantity` permanently non-increasing,
 * so a DM adding stock to an existing row (Task 5 republishes the whole
 * shop on every edit) would watch it silently disappear forever. The
 * two-field model distinguishes "republished unchanged" from "restocked":
 * new stock 10 with 2 sold -> 8 remaining; new stock 1 with 2 sold -> 0
 * remaining (still clamped, still never resurrected).
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
  local sold = 0
  if old and old.soldQuantity then sold = old.soldQuantity end
  local seeded = entry.remainingQuantity
  local remaining = seeded - sold
  if remaining < 0 then remaining = 0 end
  entry.soldQuantity = sold
  entry.remainingQuantity = remaining
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
 *   6. decrement remaining by the granted quantity (and increment
 *      `soldQuantity` by the same amount — see `SHOP_SEED_SCRIPT`'s doc
 *      comment for why the two counters are tracked separately)
 *   7. enqueue transfers onto the player's transfer queue
 *   8. append a sale row for DM-side reconciliation, trimming the log to the
 *      most recent `MAX_SALES_LOG_ENTRIES` (500, matching `MAX_LEDGER_ENTRIES`)
 *      — this is the same fan-out-protection concern as the transfer/magic
 *      caps below, applied to a key this script append-rewrites on every
 *      purchase. A shop that racks up more than 500 un-reconciled sales
 *      while the DM is disconnected loses its oldest entries; Task 12's
 *      drain-on-reconnect should poll often enough that this is generous
 *      headroom, not a real ceiling — noted here for whoever owns that trade-off
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
-- Bounds the sales log this script append-rewrites on every purchase (see
-- MAX_SALES_LOG_ENTRIES in shopPurchases.ts for the size rationale).
local MAX_SALES_LOG_ENTRIES = 500

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

-- ARGV[4] is client-controlled. A fractional or non-integer quantity here
-- would otherwise multiply through into a fractional price, a fractional
-- remainingQuantity/soldQuantity persisted to the ledger, and — because
-- validateShopLedgerSeed/isShopLedgerEntry require an integer —
-- permanently break every future read of this ledger (parseStoredShopLedger
-- throws), with the bad receipt then replaying forever. Floor immediately
-- after the minimum-1 clamp so both bounds are enforced on the same value.
local requested = tonumber(ARGV[4]) or 1
if requested < 1 then requested = 1 end
requested = math.floor(requested)
if selected.remainingQuantity < requested then
  return cjson.encode({ error = 'insufficient-stock' })
end

local granted = requested
if selected.itemKind == 'magic' and granted > MAX_MAGIC_PURCHASE_UNITS then
  granted = MAX_MAGIC_PURCHASE_UNITS
end

local price = selected.priceCopper * granted
selected.remainingQuantity = selected.remainingQuantity - granted
local soldSoFar = selected.soldQuantity
if not soldSoFar then soldSoFar = 0 end
selected.soldQuantity = soldSoFar + granted

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
while #sales > MAX_SALES_LOG_ENTRIES do
  table.remove(sales, 1)
end
local salesEncoded = #sales == 0 and '[]' or cjson.encode(sales)
redis.call('SET', KEYS[3], salesEncoded, 'EX', ARGV[6])

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
    entry.priceCopper! > MAX_PRICE_COPPER ||
    !Number.isInteger(entry.remainingQuantity) ||
    entry.remainingQuantity! < 0 ||
    entry.remainingQuantity! > 999 ||
    (entry.soldQuantity !== undefined &&
      (!Number.isInteger(entry.soldQuantity) ||
        entry.soldQuantity < 0 ||
        entry.soldQuantity > MAX_SOLD_QUANTITY)) ||
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
 * (length caps, per-entry validity, duplicate-id rejection). `soldQuantity`
 * defaults to `0` when absent — the same tolerance
 * `validateMarkerLootSeed` gives a missing `locked` flag — so a ledger
 * written before this field existed keeps validating.
 */
export function validateShopLedgerSeed(
  value: unknown
): ShopLedgerEntry[] | null {
  if (!Array.isArray(value) || value.length > MAX_LEDGER_ENTRIES) return null;
  if (!value.every(isShopLedgerEntry)) return null;
  const ids = new Set(value.map(entry => entry.id));
  if (ids.size !== value.length) return null;
  return value.map(entry => ({
    ...entry,
    soldQuantity: entry.soldQuantity ?? 0,
  }));
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
