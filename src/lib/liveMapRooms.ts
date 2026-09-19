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
 * token-mint time. `zadd` + `expire` are issued through a pipeline (not a
 * transaction) so the connect critical path pays one Redis round trip
 * instead of two. This is best-effort, not atomic: a server-side `expire`
 * error after a successful `zadd` can still leave the key without a TTL,
 * and any rejection here is treated as "the write is not trusted to have
 * landed" by the caller, not as a guarantee that neither command applied.
 */
export interface LiveMapRoomsWriter {
  pipeline(): LiveMapRoomsPipeline;
}

/**
 * What a live room is. Absent tag means `battlemap`, so every member written
 * before this tag existed keeps its meaning.
 */
export type LiveMapRoomKind = 'battlemap' | 'location';

/** `:` cannot occur in a map id (`BATTLE_MAP_RELAY_ROOM_PATTERN`), so a
 *  prefixed member can never collide with a bare battle-map id. */
const LOCATION_MEMBER_PREFIX = 'location:';

export function liveMapRoomMember(
  kind: LiveMapRoomKind,
  mapId: string
): string {
  return kind === 'location' ? `${LOCATION_MEMBER_PREFIX}${mapId}` : mapId;
}

export function parseLiveMapRoomMember(member: string): {
  kind: LiveMapRoomKind;
  mapId: string;
} {
  return member.startsWith(LOCATION_MEMBER_PREFIX)
    ? { kind: 'location', mapId: member.slice(LOCATION_MEMBER_PREFIX.length) }
    : { kind: 'battlemap', mapId: member };
}

/**
 * Best-effort record that `battleMapId` has a live client in `code`'s
 * campaign, keyed by mint time and tagged with its `kind`. Called at
 * token-mint time (a later task). Never throws — a failed write here should
 * not fail token minting.
 */
export async function recordLiveMapRoom(
  redis: LiveMapRoomsWriter,
  code: string,
  battleMapId: string,
  deps: { now?: number; kind?: LiveMapRoomKind } = {}
): Promise<void> {
  const now = deps.now ?? Date.now();
  const key = campaignLiveMapRoomsKey(code);
  try {
    const pipeline = redis.pipeline();
    pipeline.zadd(key, {
      score: now,
      member: liveMapRoomMember(deps.kind ?? 'battlemap', battleMapId),
    });
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
 * favoring the most recently minted rooms. Returns map ids of ONE kind
 * (default `battlemap`); location rooms are therefore never part of the
 * initiative/players/shop poke fan-out in `relayPoke.ts`. Never throws —
 * returns `[]` on any error, so a poke fan-out (a later task) degrades to
 * no-op rather than failing the caller.
 */
export async function listLiveMapRooms(
  redis: LiveMapRoomsReader,
  code: string,
  deps: { now?: number; kind?: LiveMapRoomKind } = {}
): Promise<string[]> {
  const now = deps.now ?? Date.now();
  const kind = deps.kind ?? 'battlemap';
  const key = campaignLiveMapRoomsKey(code);
  try {
    await redis.zremrangebyscore(key, 0, now - LIVE_MAP_ROOM_WINDOW_MS);
    // rev: true makes rank 0 the highest score (most recently minted first).
    // The whole (already pruned, so bounded by the window) set is read and
    // the cap applied AFTER the kind filter: capping first would let rooms of
    // the other kind consume fan-out slots.
    const members = await redis.zrange(key, 0, -1, { rev: true });
    const ids: string[] = [];
    for (const member of members) {
      // With automaticDeserialization on, members can come back non-string.
      if (typeof member !== 'string') continue;
      const parsed = parseLiveMapRoomMember(member);
      if (parsed.kind !== kind) continue;
      ids.push(parsed.mapId);
      if (ids.length >= MAX_LIVE_MAP_ROOMS) break;
    }
    return ids;
  } catch (err) {
    console.warn('[liveMapRooms] listLiveMapRooms failed:', err);
    return [];
  }
}
