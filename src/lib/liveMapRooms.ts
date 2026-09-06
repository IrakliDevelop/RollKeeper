import { campaignLiveMapRoomsKey, SLIDING_TTL_SECONDS } from '@/lib/redis';

/**
 * A room is considered live this long after its last token mint.
 *
 * Must stay comfortably above `PROACTIVE_REFRESH_MS` (4 minutes, see
 * `src/lib/battlemapPokeListener.ts`) — that's how often a connected client
 * re-mints its token, so a continuously connected client must never be
 * pruned between refreshes. It also needs to be short enough that a closed
 * tab stops receiving fan-out promptly. If either value changes, check the
 * other still leaves enough headroom.
 */
export const LIVE_MAP_ROOM_WINDOW_MS = 10 * 60 * 1000;

/** Hard ceiling on fan-out, so one write cannot spray unbounded pokes. */
export const MAX_LIVE_MAP_ROOMS = 25;

/**
 * Structural subset of the redis client needed to read the live-room
 * registry. Narrow and exported (rather than the concrete `@upstash/redis`
 * `Redis` type) so callers — including a later task's poke fan-out — and
 * tests can pass a small fake instead of a real client.
 */
export interface LiveMapRoomsReader {
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zrange(
    key: string,
    min: number,
    max: number,
    opts?: { rev?: boolean }
  ): Promise<unknown[]>;
}

/**
 * Structural subset of the redis client needed to record a live room at
 * token-mint time.
 */
export interface LiveMapRoomsWriter {
  zadd(
    key: string,
    scoreMember: { score: number; member: string }
  ): Promise<number | null>;
  expire(key: string, seconds: number): Promise<number>;
}

/**
 * Best-effort record that `battleMapId` has a live client in `code`'s
 * campaign, keyed by mint time. Called at token-mint time (a later task).
 * Never throws — a failed write here should not fail token minting.
 */
export async function recordLiveMapRoom(
  redis: LiveMapRoomsWriter,
  code: string,
  battleMapId: string,
  deps: { now?: number } = {}
): Promise<void> {
  const now = deps.now ?? Date.now();
  const key = campaignLiveMapRoomsKey(code);
  try {
    await redis.zadd(key, { score: now, member: battleMapId });
    await redis.expire(key, SLIDING_TTL_SECONDS);
  } catch (err) {
    console.warn('[liveMapRooms] recordLiveMapRoom failed:', err);
  }
}

/**
 * Best-effort read of the battle-map ids currently considered live for
 * `code`'s campaign — i.e. minted within the last `LIVE_MAP_ROOM_WINDOW_MS`.
 * Prunes stale entries first, then returns at most `MAX_LIVE_MAP_ROOMS`,
 * favoring the most recently minted rooms. Never throws — returns `[]` on
 * any error, so a poke fan-out (a later task) degrades to no-op rather than
 * failing the caller.
 */
export async function listLiveMapRooms(
  redis: LiveMapRoomsReader,
  code: string,
  deps: { now?: number } = {}
): Promise<string[]> {
  const now = deps.now ?? Date.now();
  const key = campaignLiveMapRoomsKey(code);
  try {
    await redis.zremrangebyscore(key, 0, now - LIVE_MAP_ROOM_WINDOW_MS);
    // rev: true makes rank 0 the highest score, so this rank range is the
    // MAX_LIVE_MAP_ROOMS most recently minted rooms, most recent first.
    const members = await redis.zrange(key, 0, MAX_LIVE_MAP_ROOMS - 1, {
      rev: true,
    });
    // With automaticDeserialization on, members can come back non-string.
    return members.filter(
      (member): member is string => typeof member === 'string'
    );
  } catch (err) {
    console.warn('[liveMapRooms] listLiveMapRooms failed:', err);
    return [];
  }
}
