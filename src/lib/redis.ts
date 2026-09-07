import { Redis } from '@upstash/redis';

const SLIDING_TTL_SECONDS = 60 * 24 * 60 * 60; // 60 days

function createRedisClient(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables'
    );
  }

  return new Redis({ url, token });
}

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
}

let rawRedis: Redis | null = null;

/**
 * Client with automaticDeserialization disabled. The XP award queue needs the
 * EXACT stored list strings back (they double as ack receipts); the default
 * client would JSON.parse LRANGE results and the receipt would no longer be
 * the stored string.
 */
export function getRawRedis(): Redis {
  if (!rawRedis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables'
      );
    }
    rawRedis = new Redis({ url, token, automaticDeserialization: false });
  }
  return rawRedis;
}

export function campaignKey(code: string): string {
  return `campaign:${code}`;
}

export function campaignPlayersKey(code: string): string {
  return `campaign:${code}:players`;
}

export function campaignPlayerKey(code: string, playerId: string): string {
  return `campaign:${code}:player:${playerId}`;
}

export function campaignSharedKey(code: string, feature: string): string {
  return `campaign:${code}:shared:${feature}`;
}

export function campaignMessagesKey(code: string, playerId: string): string {
  return `campaign:${code}:messages:${playerId}`;
}

export function campaignEffectsKey(code: string, playerId: string): string {
  return `campaign:${code}:effects:${playerId}`;
}

export function campaignTransfersKey(code: string, playerId: string): string {
  return `campaign:${code}:transfers:${playerId}`;
}

export function campaignXpKey(code: string, playerId: string): string {
  return `campaign:${code}:xp:${playerId}`;
}

export function campaignRemovedKey(code: string, playerId: string): string {
  return `campaign:${code}:removed:${playerId}`;
}

export function campaignLocationsKey(code: string): string {
  return `campaign:${code}:locations`;
}

export function campaignLocationKey(code: string, locationId: string): string {
  return `campaign:${code}:location:${locationId}`;
}

export function campaignBattleMapsKey(code: string): string {
  return `campaign:${code}:battlemaps`;
}

export function campaignBattleMapKey(
  code: string,
  battleMapId: string
): string {
  return `campaign:${code}:battlemap:${battleMapId}`;
}

export function campaignMarkerLootKey(code: string, mapId: string): string {
  return `campaign:${code}:marker-loot:${mapId}`;
}

export function campaignMarkerClaimKey(
  code: string,
  mapId: string,
  playerId: string,
  requestId: string
): string {
  return `campaign:${code}:marker-claim:${mapId}:${playerId}:${requestId}`;
}

export function campaignDisplayKeyKey(code: string): string {
  return `campaign:${code}:displaykey`;
}

export function campaignFogAppearanceKey(
  code: string,
  battleMapId: string
): string {
  return `campaign:${code}:fog-appearance:${battleMapId}`;
}

// Merchant shop keys (VTT merchants Slice 3). Per-NPC, not campaign-wide, so
// each is written with its own `{ ex: SLIDING_TTL_SECONDS }` at write time —
// matching campaignTransfersKey/campaignXpKey/campaignMarkerLootKey — rather
// than being added to refreshCampaignTTL, which is reserved for the four
// campaign-wide structures.
export function campaignShopKey(code: string, npcId: string): string {
  return `campaign:${code}:shop:${npcId}`;
}

export function campaignShopLedgerKey(code: string, npcId: string): string {
  return `campaign:${code}:shop-ledger:${npcId}`;
}

// Campaign-wide (not per-NPC) SET of npcIds with a currently-open shop —
// the player-readable index (controller ruling R16, Task 11) that lets a
// token tap resolve `entityId -> npcId` without the token itself carrying
// that mapping. Maintained by the publish `PUT` (sadd + refreshed TTL on
// open, srem on close) and read by `GET /api/campaign/[code]/shops`. Its own
// sliding TTL, refreshed alongside — like every other shop key, deliberately
// NOT part of `refreshCampaignTTL`. A LOOKUP only: a listed npcId whose own
// `campaignShopKey` has since expired or gone invalid is dropped (and
// lazily self-healed out of this set) by the list route, never trusted on
// its own.
export function campaignShopsIndexKey(code: string): string {
  return `campaign:${code}:shops-index`;
}

export function campaignShopSalesKey(code: string, npcId: string): string {
  return `campaign:${code}:shop-sales:${npcId}`;
}

export function campaignShopReceiptKey(
  code: string,
  npcId: string,
  requestId: string
): string {
  return `campaign:${code}:shop-receipt:${npcId}:${requestId}`;
}

export function campaignLiveMapRoomsKey(code: string): string {
  return `campaign:${code}:live-maps`;
}

export function characterShareKey(characterId: string): string {
  return `character:share:${characterId}`;
}

const CHARACTER_SHARE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export async function refreshCampaignTTL(
  redis: Redis,
  code: string
): Promise<void> {
  await Promise.all([
    redis.expire(campaignKey(code), SLIDING_TTL_SECONDS),
    redis.expire(campaignPlayersKey(code), SLIDING_TTL_SECONDS),
    redis.expire(campaignLocationsKey(code), SLIDING_TTL_SECONDS),
    redis.expire(campaignBattleMapsKey(code), SLIDING_TTL_SECONDS),
  ]);
}

export { SLIDING_TTL_SECONDS, CHARACTER_SHARE_TTL_SECONDS };
