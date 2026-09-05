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
