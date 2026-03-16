import { Redis } from '@upstash/redis';

const SLIDING_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

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

export async function refreshCampaignTTL(
  redis: Redis,
  code: string
): Promise<void> {
  await Promise.all([
    redis.expire(campaignKey(code), SLIDING_TTL_SECONDS),
    redis.expire(campaignPlayersKey(code), SLIDING_TTL_SECONDS),
  ]);
}

export { SLIDING_TTL_SECONDS };
