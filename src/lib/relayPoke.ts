import { signBattleMapToken } from '@/lib/battlemapToken';
import { campaignSharedKey } from '@/lib/redis';

import type { SharedBattleMapState } from '@/types/sharedState';

const POKE_TOKEN_TTL_MS = 30_000;
const POKE_TIMEOUT_MS = 2_000;

export function relayHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

interface RedisReader {
  get<T = unknown>(key: string): Promise<T | null>;
}

/**
 * Best-effort WS poke after an initiative write: tells clients in the active
 * battle-map room to refetch /shared immediately. Never throws — the 5s poll
 * is the source-of-truth fallback; this only shaves latency.
 */
export async function sendInitiativePoke(
  code: string,
  redis: RedisReader,
  deps: { fetchFn?: typeof fetch; now?: number } = {}
): Promise<void> {
  const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  const secret = process.env.BATTLEMAP_RELAY_SECRET;
  if (!relayUrl || !secret) return;
  try {
    const raw = await redis.get<string | SharedBattleMapState>(
      campaignSharedKey(code, 'battlemap')
    );
    if (!raw) return;
    const battleMap: SharedBattleMapState =
      typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!battleMap?.activeBattleMapId) return;

    const room = `${code}:${battleMap.activeBattleMapId}`;
    const token = signBattleMapToken(
      {
        userId: '@server',
        role: 'dm',
        room,
        exp: (deps.now ?? Date.now()) + POKE_TOKEN_TTL_MS,
      },
      secret
    );
    const fetchFn = deps.fetchFn ?? fetch;
    await fetchFn(`${relayHttpUrl(relayUrl)}/poke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room, feature: 'initiative', token }),
      signal: AbortSignal.timeout(POKE_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn('[relayPoke] poke failed (poll remains fallback):', err);
  }
}
