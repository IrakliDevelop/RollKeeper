import type { Redis } from '@upstash/redis';

import type {
  MarkerLootClaimResult,
  MarkerLootLedgerEntry,
} from '@/types/battlemap';

const MAX_LEDGER_ENTRIES = 500;

const SEED_SCRIPT = `
local oldRaw = redis.call('GET', KEYS[1])
local oldById = {}
if oldRaw then
  local old = cjson.decode(oldRaw)
  for _, entry in ipairs(old) do
    oldById[entry.markerId .. ':' .. entry.id] = entry
  end
end
local incoming = cjson.decode(ARGV[1])
for _, entry in ipairs(incoming) do
  local old = oldById[entry.markerId .. ':' .. entry.id]
  if old and old.claimedQuantity > entry.claimedQuantity then
    entry.claimedQuantity = old.claimedQuantity
  end
  if entry.claimedQuantity > entry.quantity then
    entry.claimedQuantity = entry.quantity
  end
end
local encoded = #incoming == 0 and '[]' or cjson.encode(incoming)
redis.call('SET', KEYS[1], encoded, 'EX', ARGV[2])
return encoded
`;

const CLAIM_SCRIPT = `
local previous = redis.call('GET', KEYS[3])
if previous then return previous end

local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({ error = 'container-not-found' }) end
local ledger = cjson.decode(raw)
local selected = nil
for _, entry in ipairs(ledger) do
  if entry.markerId == ARGV[1] and entry.id == ARGV[2] then
    selected = entry
    break
  end
end
if not selected then return cjson.encode({ error = 'entry-not-found' }) end
if selected.claimedQuantity >= selected.quantity then
  return cjson.encode({ error = 'depleted' })
end

selected.claimedQuantity = selected.claimedQuantity + 1
local item = cjson.decode(cjson.encode(selected.item))
if selected.itemKind == 'inventory' then item.quantity = 1 end
local result = {
  requestId = ARGV[3], markerId = ARGV[1], entryId = ARGV[2],
  remainingQuantity = selected.quantity - selected.claimedQuantity,
  transferId = ARGV[4]
}
local transfer = {
  id = ARGV[4], item = item, itemKind = selected.itemKind,
  fromPlayerName = 'DM', fromCharacterName = 'Map loot',
  fromType = 'dm', sentAt = ARGV[5]
}
local queueRaw = redis.call('GET', KEYS[2])
local queue = queueRaw and cjson.decode(queueRaw) or {}
table.insert(queue, transfer)
redis.call('SET', KEYS[1], cjson.encode(ledger), 'EX', ARGV[6])
redis.call('SET', KEYS[2], cjson.encode(queue), 'EX', ARGV[6])
local resultRaw = cjson.encode(result)
redis.call('SET', KEYS[3], resultRaw, 'EX', ARGV[6])
return resultRaw
`;

function isMarkerLootLedgerEntry(
  value: unknown
): value is MarkerLootLedgerEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<MarkerLootLedgerEntry>;
  return (
    typeof entry.markerId === 'string' &&
    entry.markerId.length > 0 &&
    entry.markerId.length <= 200 &&
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    entry.id.length <= 200 &&
    (entry.itemKind === 'inventory' || entry.itemKind === 'magic') &&
    !!entry.item &&
    typeof entry.item === 'object' &&
    typeof entry.item.name === 'string' &&
    entry.item.name.length > 0 &&
    entry.item.name.length <= 300 &&
    Number.isInteger(entry.quantity) &&
    entry.quantity! >= 1 &&
    entry.quantity! <= 999 &&
    Number.isInteger(entry.claimedQuantity) &&
    entry.claimedQuantity! >= 0 &&
    entry.claimedQuantity! <= entry.quantity!
  );
}

export function validateMarkerLootSeed(
  value: unknown
): MarkerLootLedgerEntry[] | null {
  if (!Array.isArray(value) || value.length > MAX_LEDGER_ENTRIES) return null;
  if (!value.every(isMarkerLootLedgerEntry)) return null;
  const keys = new Set(value.map(entry => `${entry.markerId}:${entry.id}`));
  return keys.size === value.length ? value : null;
}

/**
 * Redis Lua cjson encodes an empty table as `{}` unless the script writes the
 * JSON array literal explicitly. Accept that legacy representation so maps
 * published before the fix keep working, while rejecting any other malformed
 * ledger shape.
 */
export function parseStoredMarkerLootLedger(
  raw: string | null
): MarkerLootLedgerEntry[] {
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
  const ledger = validateMarkerLootSeed(parsed);
  if (!ledger) throw new Error('Invalid marker loot ledger');
  return ledger;
}

export async function seedMarkerLoot(
  redis: Redis,
  key: string,
  entries: MarkerLootLedgerEntry[],
  ttlSeconds: number
): Promise<MarkerLootLedgerEntry[]> {
  const raw = await redis.eval(
    SEED_SCRIPT,
    [key],
    [JSON.stringify(entries), ttlSeconds]
  );
  return parseStoredMarkerLootLedger(String(raw));
}

export type ClaimMarkerLootResult =
  | { ok: true; claim: MarkerLootClaimResult }
  | {
      ok: false;
      error: 'container-not-found' | 'entry-not-found' | 'depleted';
    };

export async function claimMarkerLoot(
  redis: Redis,
  keys: { ledger: string; transfers: string; receipt: string },
  input: {
    markerId: string;
    entryId: string;
    requestId: string;
    transferId: string;
    now: string;
  },
  ttlSeconds: number
): Promise<ClaimMarkerLootResult> {
  const raw = await redis.eval(
    CLAIM_SCRIPT,
    [keys.ledger, keys.transfers, keys.receipt],
    [
      input.markerId,
      input.entryId,
      input.requestId,
      input.transferId,
      input.now,
      ttlSeconds,
    ]
  );
  const parsed = JSON.parse(String(raw)) as
    | MarkerLootClaimResult
    | { error: 'container-not-found' | 'entry-not-found' | 'depleted' };
  if ('error' in parsed) return { ok: false, error: parsed.error };
  return { ok: true, claim: parsed };
}
