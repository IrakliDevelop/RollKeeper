import type { Redis } from '@upstash/redis';

import type { ItemTransfer } from '@/types/sharedState';

/**
 * Atomic operations on a player's item-transfer queue
 * (`campaignTransfersKey`) — VTT merchants Slice 3 final review, Important
 * finding.
 *
 * `shared/route.ts`'s `item_transfer` feature (a DM gift/loot grant) used to
 * enqueue as a plain `GET` -> push in JS -> `SET`, and its sibling `DELETE`
 * (`type: 'transfers'`, batch form) used to acknowledge as a plain
 * `GET` -> filter -> `SET`/`DEL` — both non-atomic against EACH OTHER, and
 * against `PURCHASE_SCRIPT`'s (`shopPurchases.ts`) own atomic append to this
 * SAME key for a shop sale. Interleaved, the ack and the enqueue race:
 *
 *   ack GET [T] -> enqueue GET [T] -> ack DEL key -> enqueue SET [T, gift]
 *
 * `T` (already applied, and already acknowledged by the client calling
 * `clearAppliedTransfer(T)`) is resurrected by the enqueue's stale snapshot
 * overwriting the ack's write. The next poll sees `T` again with no local
 * "already applied" record left to skip it — a duplicate item AND a second
 * debit of its `costCopper`. Moving BOTH operations into a Lua `EVAL`
 * closes the window the same way `SALES_ACK_SCRIPT`
 * (`shopPurchases.ts`)/`ackXpAward` (`xpAwardQueue.ts`) already close the
 * identical class of race on their own queues.
 *
 * Both scripts are plain backtick literals with NO interpolation —
 * `scripts/shop-redis.integration.test.mjs` (and any sibling harness)
 * regexes Lua scripts out of source by matching
 * `` export const NAME = `...`; `` verbatim; string-building a script would
 * break that extraction.
 */
export const ENQUEUE_ITEM_TRANSFER_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local queue = raw and cjson.decode(raw) or {}
table.insert(queue, cjson.decode(ARGV[1]))
local encoded = cjson.encode(queue)
redis.call('SET', KEYS[1], encoded, 'EX', ARGV[2])
return encoded
`;

/**
 * Appends one `ItemTransfer` to `key` atomically. `redis` MUST be
 * `getRawRedis()` (`automaticDeserialization: false`) — this needs the
 * literal JSON string the `EVAL` reply returns, exactly like
 * `seedShopLedger`/`purchaseFromShop` require in `shopPurchases.ts`; the
 * default client would JSON-parse the reply into an object first, and
 * `JSON.parse(String(raw))` below would then choke on `"[object Object]"`.
 */
export async function enqueueItemTransfer(
  redis: Redis,
  key: string,
  transfer: ItemTransfer,
  ttlSeconds: number
): Promise<ItemTransfer[]> {
  const raw = await redis.eval(
    ENQUEUE_ITEM_TRANSFER_SCRIPT,
    [key],
    [JSON.stringify(transfer), ttlSeconds]
  );
  return JSON.parse(String(raw)) as ItemTransfer[];
}

/**
 * Atomically removes acknowledged transfers from `key` — see the module doc
 * comment above for the race this closes. Mirrors `SALES_ACK_SCRIPT`
 * exactly: a missing key returns `'[]'`; an empty result after filtering
 * `DEL`s the key rather than persisting an empty array.
 *
 * `transferIds` is expected non-empty — the "empty batch is a no-op, never
 * clear-the-queue" guarantee is enforced by the caller (the route handler)
 * BEFORE this is called, deliberately, exactly like
 * `acknowledgeShopSales`/`SALES_ACK_SCRIPT`'s identical contract.
 */
export const ACK_ITEM_TRANSFER_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return '[]' end
local transfers = cjson.decode(raw)
local acked = cjson.decode(ARGV[1])
local ackedById = {}
for _, id in ipairs(acked) do
  ackedById[id] = true
end
local remaining = {}
for _, transfer in ipairs(transfers) do
  if not ackedById[transfer.id] then
    table.insert(remaining, transfer)
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
 * Acknowledges (removes) `transferIds` from `key` in one atomic round trip.
 * `redis` MUST be `getRawRedis()` — same requirement, and the same failure
 * mode, as `enqueueItemTransfer` above.
 */
export async function acknowledgeItemTransfers(
  redis: Redis,
  key: string,
  transferIds: string[],
  ttlSeconds: number
): Promise<ItemTransfer[]> {
  const raw = await redis.eval(
    ACK_ITEM_TRANSFER_SCRIPT,
    [key],
    [JSON.stringify(transferIds), ttlSeconds]
  );
  return JSON.parse(String(raw)) as ItemTransfer[];
}
