import { campaignLiveMapRoomsKey } from '@/lib/redis';

/**
 * How far back a battle-map room stays a fan-out candidate: a room is "live"
 * if it was minted (or re-minted) within this many ms of now.
 *
 * This is a bound on fan-out width, not a liveness proof. Most clients only
 * register once, at connect — there is no periodic re-mint on the managed
 * WebSocket connection path (`src/lib/battlemapSync.ts`), which is what most
 * battle-map canvases use; only the polling-fallback listener
 * (`src/lib/battlemapPokeListener.ts`, `PROACTIVE_REFRESH_MS` = 4 minutes)
 * re-mints periodically, and it isn't used by the canvas clients this
 * registry primarily exists to help. So the window has to comfortably exceed
 * a realistic session length rather than a refresh interval — 12 hours — so a
 * client that registered once near the start of a long session is still
 * fan-out-eligible near the end of it. A poke to a room that has since gone
 * quiet is a harmless no-op at the relay (`relay/src/poke.ts` returns
 * `sent: 0`), and `MAX_LIVE_MAP_ROOMS` bounds the blast radius, so erring long
 * here is cheap.
 */
export const LIVE_MAP_ROOM_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Hard ceiling on fan-out, so one write cannot spray unbounded pokes. */
export const MAX_LIVE_MAP_ROOMS = 25;

/**
 * TTL for the live-room registry key itself. Independent from the campaign's
 * general `SLIDING_TTL_SECONDS` (60 days, in `src/lib/redis.ts`) — that value
 * is sized for durable campaign data, not this registry, whose entries are
 * all pruned as stale well before it. Kept comfortably above
 * `LIVE_MAP_ROOM_WINDOW_MS` purely so the key doesn't vanish out from under a
 * still-live room; the pruning in `listLiveMapRooms` is what actually keeps
 * the registry's contents honest.
 */
export const LIVE_MAP_ROOM_TTL_SECONDS = 24 * 60 * 60;

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
 * Structural subset of the pipeline object needed to record a live room in
 * one round trip. Narrow, so a small fake pipeline works in tests without
 * pulling in the real `@upstash/redis` `Pipeline` type.
 */
export interface LiveMapRoomsPipeline {
  zadd(key: string, scoreMember: { score: number; member: string }): unknown;
  expire(key: string, seconds: number): unknown;
  exec(): Promise<unknown[]>;
}

/**
 * Structural subset of the redis client needed to record a live room at
 * token-mint time. `zadd` + `expire` are issued through a pipeline so the
 * connect critical path pays one Redis round trip instead of two, and so a
 * throwing `expire` cannot leave a brand-new key without a TTL (they either
 * both land or, on any error, neither is trusted to have landed and the whole
 * write is treated as failed).
 */
export interface LiveMapRoomsWriter {
  pipeline(): LiveMapRoomsPipeline;
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
    const pipeline = redis.pipeline();
    pipeline.zadd(key, { score: now, member: battleMapId });
    pipeline.expire(key, LIVE_MAP_ROOM_TTL_SECONDS);
    await pipeline.exec();
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
