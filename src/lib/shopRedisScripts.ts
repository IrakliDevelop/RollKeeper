/**
 * Redis Lua scripts of the shop routes (repair 11, FR4-1). They live here,
 * not in the route modules: a Next.js route module may export only its
 * handlers and segment config, and the generated route type check
 * (`.next/dev/types`) fails on any other export.
 */

/**
 * Compare-and-set of the published projection, keyed on the exact stored
 * text: KEYS[1] projection, KEYS[2] ledger, ARGV[1] the projection text the
 * caller read, ARGV[2] its replacement. Returns -1 when the shop is not
 * live (projection or ledger gone), 0 when the projection changed since it
 * was read, 1 when written. The ledger is only checked, never written, and
 * the projection keeps its TTL.
 */
export const SHOP_ENTITY_IDS_CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then return -1 end
if redis.call('EXISTS', KEYS[2]) == 0 then return -1 end
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
return 1
`;

/**
 * KEYS: for each ARGV[i] its projection key then ledger key, and last the
 * shops index. Removes an npcId from the index only when both of its keys
 * are gone (unpublished or expired), never while a publish is in progress.
 */
export const SHOP_INDEX_PRUNE_SCRIPT = `
local index = KEYS[#KEYS]
local removed = 0
for i, npcId in ipairs(ARGV) do
  if redis.call('EXISTS', KEYS[2 * i - 1]) == 0
    and redis.call('EXISTS', KEYS[2 * i]) == 0 then
    removed = removed + redis.call('SREM', index, npcId)
  end
end
return removed
`;
