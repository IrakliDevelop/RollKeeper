import type { Redis } from '@upstash/redis';

import type { ShopLedgerEntry, ShopLedgerSeed, ShopSale } from '@/types/shop';

const MAX_LEDGER_ENTRIES = 500;

/** Mirrors `MAX_SALES_LOG_ENTRIES` inside `PURCHASE_SCRIPT` below — the Lua
 *  trims the stored sales log to this many rows on every purchase, so a
 *  well-formed sales log read back here should never exceed it either. Kept
 *  as its own exported TS constant (the Lua-local one isn't reachable from
 *  outside the script string) for `parseStoredShopSales`'s defensive cap and
 *  for Task 12's drain hook to size its own idempotency ledger against. */
export const MAX_SALES_LOG_ENTRIES = 500;

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
 * freshly-authored *total* stock in `seededQuantity` (Task 2's
 * `buildShopLedger` produces this `ShopLedgerSeed` shape — never
 * `ShopLedgerEntry` — since a fresh build from the NPC's inventory has no
 * notion of sales; see the type doc on `ShopLedgerSeed` in `types/shop.ts`
 * for why the field is deliberately NOT named `remainingQuantity`). This
 * script:
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
  local seeded = entry.seededQuantity
  local remaining = seeded - sold
  if remaining < 0 then remaining = 0 end
  entry.soldQuantity = sold
  entry.remainingQuantity = remaining
  entry.seededQuantity = nil
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

/** Shared bounds check for the `id`/`name`/`itemKind`/`priceCopper`/
 *  `description`/`rarity`/`item` fields common to both the stored ledger
 *  shape (`ShopLedgerEntry`) and the seed shape (`ShopLedgerSeed`). The
 *  stock field (`remainingQuantity`+`soldQuantity` vs. `seededQuantity`) is
 *  deliberately NOT checked here — each shape validates that part itself,
 *  which is the whole point of the two shapes being distinct (ruling R6). */
function hasValidShopEntryCommonFields(
  entry: Record<string, unknown> & { item?: unknown }
): boolean {
  if (
    typeof entry.id !== 'string' ||
    entry.id.length === 0 ||
    entry.id.length > 200 ||
    typeof entry.name !== 'string' ||
    entry.name.length === 0 ||
    entry.name.length > 300 ||
    (entry.itemKind !== 'inventory' && entry.itemKind !== 'magic') ||
    !Number.isInteger(entry.priceCopper) ||
    (entry.priceCopper as number) < 0 ||
    (entry.priceCopper as number) > MAX_PRICE_COPPER ||
    (entry.description !== undefined &&
      typeof entry.description !== 'string') ||
    (entry.rarity !== undefined && typeof entry.rarity !== 'string')
  ) {
    return false;
  }
  if (!entry.item || typeof entry.item !== 'object') return false;
  const { name } = entry.item as { name?: unknown };
  return typeof name === 'string' && name.length > 0 && name.length <= 300;
}

function isStoredShopLedgerEntry(value: unknown): value is ShopLedgerEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ShopLedgerEntry> &
    Record<string, unknown> & { item?: unknown };
  if (
    !hasValidShopEntryCommonFields(entry) ||
    !Number.isInteger(entry.remainingQuantity) ||
    (entry.remainingQuantity as number) < 0 ||
    (entry.remainingQuantity as number) > 999 ||
    (entry.soldQuantity !== undefined &&
      (!Number.isInteger(entry.soldQuantity) ||
        (entry.soldQuantity as number) < 0 ||
        (entry.soldQuantity as number) > MAX_SOLD_QUANTITY))
  ) {
    return false;
  }
  return true;
}

/**
 * Validates the STORED ledger shape (`ShopLedgerEntry[]`) — a value read
 * back from Redis, either via `parseStoredShopLedger` or as the return of
 * `SHOP_SEED_SCRIPT`/`PURCHASE_SCRIPT`. Mirrors `validateMarkerLootSeed`'s
 * bounds discipline (length caps, per-entry validity, duplicate-id
 * rejection). `soldQuantity` defaults to `0` when absent — the same
 * tolerance `validateMarkerLootSeed` gives a missing `locked` flag — so a
 * ledger written before this field existed keeps validating.
 *
 * NOT the seed-input validator — see `validateShopLedgerSeed` for that.
 * This function must never be used to validate input on the way INTO
 * `seedShopLedger`; its return shape (`remainingQuantity`/`soldQuantity`)
 * is exactly the shape `ShopLedgerSeed` was introduced to keep out of that
 * path (ruling R6).
 */
export function validateStoredShopLedger(
  value: unknown
): ShopLedgerEntry[] | null {
  if (!Array.isArray(value) || value.length > MAX_LEDGER_ENTRIES) return null;
  if (!value.every(isStoredShopLedgerEntry)) return null;
  const ids = new Set(value.map(entry => entry.id));
  if (ids.size !== value.length) return null;
  return value.map(entry => ({
    ...entry,
    soldQuantity: entry.soldQuantity ?? 0,
  }));
}

function isShopLedgerSeedEntry(value: unknown): value is ShopLedgerSeed {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ShopLedgerSeed> &
    Record<string, unknown> & { item?: unknown };
  if (
    !hasValidShopEntryCommonFields(entry) ||
    !Number.isInteger(entry.seededQuantity) ||
    (entry.seededQuantity as number) < 0 ||
    (entry.seededQuantity as number) > 999 ||
    // The seed shape never carries a stock-reconciliation field — an input
    // asserting one is exactly the round-trip hazard this type exists to
    // catch (ruling R6), so reject it outright rather than ignoring it.
    'remainingQuantity' in entry ||
    'soldQuantity' in entry
  ) {
    return false;
  }
  return true;
}

/**
 * Validates a DM-authored shop ledger SEED (`ShopLedgerSeed[]`) — the ONLY
 * value `seedShopLedger` accepts as input, and always BEFORE the write
 * (Task 5 review of Task 3, Critical): an out-of-bounds entry (e.g. a
 * `priceCopper` above `MAX_PRICE_COPPER`) must never reach `SHOP_SEED_SCRIPT`
 * in the first place, or it would be persisted to Redis and only rejected on
 * the way back — a bricked, unreadable ledger. Mirrors
 * `validateStoredShopLedger`'s bounds discipline for every field the two
 * shapes share, but checks `seededQuantity` (not `remainingQuantity`) and
 * rejects an entry carrying either stored-only field
 * (`remainingQuantity`/`soldQuantity`) outright — see `isShopLedgerSeedEntry`.
 */
export function validateShopLedgerSeed(
  value: unknown
): ShopLedgerSeed[] | null {
  if (!Array.isArray(value) || value.length > MAX_LEDGER_ENTRIES) return null;
  if (!value.every(isShopLedgerSeedEntry)) return null;
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
  const ledger = validateStoredShopLedger(parsed);
  if (!ledger) throw new Error('Invalid shop ledger');
  return ledger;
}

/** Thrown by `seedShopLedger` when `entries` is well-formed but exceeds
 *  `MAX_LEDGER_ENTRIES` — kept distinguishable from `INVALID_SHOP_LEDGER_SEED_ERROR`
 *  so a route can report "too many rows" separately from "a row is malformed"
 *  instead of collapsing both into one opaque 400. */
export const SHOP_LEDGER_SEED_TOO_LARGE_ERROR = `Shop ledger seed exceeds the maximum of ${MAX_LEDGER_ENTRIES} entries`;

/** Thrown by `seedShopLedger` when `entries` fails `validateShopLedgerSeed`
 *  for any reason other than exceeding the length cap (see
 *  `SHOP_LEDGER_SEED_TOO_LARGE_ERROR`). */
export const INVALID_SHOP_LEDGER_SEED_ERROR = 'Invalid shop ledger seed';

/**
 * Seeds/reseeds a shop's ledger atomically. Validates `entries` as a
 * well-formed `ShopLedgerSeed[]` BEFORE calling `EVAL` — an out-of-bounds
 * entry is rejected here, before anything is written to Redis, rather than
 * being persisted first and only caught on the way back out (the bricked-
 * shop failure mode Task 3's review flagged as Critical).
 *
 * `redis` MUST be the raw, non-auto-deserializing client (`getRawRedis()`),
 * exactly as `seedMarkerLoot`/`claimMarkerLoot` require in
 * `markerLootClaims.ts`: `parseStoredShopLedger(String(raw))` needs the
 * `EVAL` reply as the literal JSON string `SHOP_SEED_SCRIPT` returned. The
 * default client (`getRedis()`) has `automaticDeserialization` on, so it
 * JSON-parses the bulk string into an array FIRST — `String([{...}])`
 * becomes the literal text `"[object Object]"`, which then fails to parse
 * as JSON on any non-empty ledger (an empty ledger stringifies to `''`,
 * which happens to parse back to `[]`, so this mistake is invisible on a
 * zero-item shop and breaks every other one).
 */
export async function seedShopLedger(
  redis: Redis,
  key: string,
  entries: ShopLedgerSeed[],
  ttlSeconds: number
): Promise<ShopLedgerEntry[]> {
  if (entries.length > MAX_LEDGER_ENTRIES) {
    throw new Error(SHOP_LEDGER_SEED_TOO_LARGE_ERROR);
  }
  const validated = validateShopLedgerSeed(entries);
  if (!validated) throw new Error(INVALID_SHOP_LEDGER_SEED_ERROR);
  const raw = await redis.eval(
    SHOP_SEED_SCRIPT,
    [key],
    [JSON.stringify(validated), ttlSeconds]
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

const MAX_SALE_ID_LENGTH = 200;

/** One row's own shape — the same fields `PURCHASE_SCRIPT` writes at the
 *  `table.insert(sales, ...)` step above. */
export function isValidShopSale(value: unknown): value is ShopSale {
  if (!value || typeof value !== 'object') return false;
  const sale = value as Record<string, unknown>;
  return (
    typeof sale.id === 'string' &&
    sale.id.length > 0 &&
    sale.id.length <= MAX_SALE_ID_LENGTH &&
    typeof sale.entryId === 'string' &&
    sale.entryId.length > 0 &&
    sale.entryId.length <= MAX_SALE_ID_LENGTH &&
    Number.isInteger(sale.quantity) &&
    (sale.quantity as number) > 0 &&
    Number.isInteger(sale.copper) &&
    (sale.copper as number) >= 0 &&
    typeof sale.playerId === 'string' &&
    sale.playerId.length > 0 &&
    sale.playerId.length <= MAX_SALE_ID_LENGTH &&
    typeof sale.at === 'string' &&
    sale.at.length > 0
  );
}

/**
 * Parses a stored shop sales log (`campaignShopSalesKey`) for DM-side
 * reconciliation (Task 12, `useDmShopSalesSync`).
 *
 * Deliberately LENIENT, unlike `parseStoredShopLedger`: a sale that already
 * happened (the server already decremented stock and enqueued the player's
 * transfer) is a fact the DM's drain must not lose track of just because one
 * OTHER row in the same log is malformed — this function drops only the
 * individual rows that fail `isValidShopSale`, rather than throwing and
 * discarding the whole log the way an invalid ledger entry does. The caller
 * is expected to log/warn about anything dropped, since a dropped row here
 * is a coin credit that will never happen (indistinguishable, from this
 * function's return value alone, from a row that was never there).
 *
 * Same `{}`-for-empty-array tolerance as `parseStoredShopLedger` (`cjson`
 * encodes an empty Lua table as `{}` unless the script writes the literal
 * array), and the same defensive length cap as `MAX_SALES_LOG_ENTRIES`
 * (`PURCHASE_SCRIPT` already trims to this size, so a well-formed log is
 * never longer — an oversized log is treated as corrupt and truncated to the
 * most recent entries rather than rejected outright, since sales are
 * append-ordered and the newest rows are the ones a DM drain most needs).
 */
export function parseStoredShopSales(raw: string | null): ShopSale[] {
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
  if (!Array.isArray(parsed)) return [];
  const bounded =
    parsed.length > MAX_SALES_LOG_ENTRIES
      ? parsed.slice(parsed.length - MAX_SALES_LOG_ENTRIES)
      : parsed;
  return bounded.filter(isValidShopSale);
}

/**
 * Atomically removes acknowledged rows from a shop's sales log (VTT
 * merchants Slice 3, Task 12a — the DM-side acknowledgement that keeps
 * `campaign:{code}:shop-sales:{npcId}` short in normal operation instead of
 * relying on `PURCHASE_SCRIPT`'s 500-entry FIFO cap above never being hit).
 *
 * A first version of the acknowledge route did this as a plain
 * `GET` -> filter in JS -> `SET`/`DEL` from the route handler, exactly like
 * `shared/route.ts`'s batch transfer ack. That is safe against concurrent
 * ACKS of the same key (the task's whole point), but NOT against a
 * `PURCHASE_SCRIPT` append landing in the gap between this route's own
 * `GET` and its `SET`: `PURCHASE_SCRIPT` appends inside a single atomic
 * `EVAL`, so a purchase that completes mid-ack is invisible to the route's
 * stale in-JS snapshot, and the route's `SET` of `filtered` (computed from
 * that stale snapshot) silently erases the newly-appended sale — the exact
 * silent, irrecoverable loss this task exists to close, just with a
 * one-round-trip window instead of a DM's whole absence. Moving the
 * read-filter-write into this script closes that window the same way
 * `SHOP_SEED_SCRIPT`/`PURCHASE_SCRIPT` already make their own
 * read-modify-write atomic against each other.
 */
export const SALES_ACK_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return '[]' end
local sales = cjson.decode(raw)
local acked = cjson.decode(ARGV[1])
local ackedById = {}
for _, id in ipairs(acked) do
  ackedById[id] = true
end
local remaining = {}
for _, sale in ipairs(sales) do
  if not ackedById[sale.id] then
    table.insert(remaining, sale)
  end
end
if #remaining == 0 then
  redis.call('DEL', KEYS[1])
  return '[]'
end
local encoded = cjson.encode(remaining)
redis.call('SET', KEYS[1], encoded, 'EX', ARGV[2])
return encoded
`;

/**
 * Acknowledges (removes) `saleIds` from a shop's sales log in one atomic
 * Redis round trip — see `SALES_ACK_SCRIPT`'s doc comment for why this must
 * never be a separate `get`/`set` from the caller.
 *
 * `saleIds` is expected non-empty — the "empty batch is a no-op, never
 * clear-the-log" guarantee is enforced by the caller (the route handler)
 * BEFORE this is called, deliberately: that guarantee must hold regardless
 * of what this Lua script does with an empty array, not depend on it.
 *
 * `redis` MUST be `getRawRedis()`, exactly like `seedShopLedger` — this
 * reads and re-persists the same `cjson`-encoded literal string
 * `PURCHASE_SCRIPT` writes, and the default client's auto-deserialization
 * would corrupt both the read (`String(raw)` on an already-parsed object)
 * and any diagnostic use of this function's return value.
 */
export async function acknowledgeShopSales(
  redis: Redis,
  key: string,
  saleIds: string[],
  ttlSeconds: number
): Promise<ShopSale[]> {
  const raw = await redis.eval(
    SALES_ACK_SCRIPT,
    [key],
    [JSON.stringify(saleIds), ttlSeconds]
  );
  return parseStoredShopSales(String(raw));
}
