import { signBattleMapToken } from '@/lib/battlemapToken';
import { listLiveMapRooms, MAX_LIVE_MAP_ROOMS } from '@/lib/liveMapRooms';
import { campaignSharedKey } from '@/lib/redis';

import type { LiveMapRoomsReader } from '@/lib/liveMapRooms';
import type { SharedBattleMapState } from '@/types/sharedState';

const POKE_TOKEN_TTL_MS = 30_000;
const POKE_TIMEOUT_MS = 2_000;

export function relayHttpUrl(wsUrl: string): string {
  return wsUrl
    .replace(/^wss:/, 'https:')
    .replace(/^ws:/, 'http:')
    .replace(/\/$/, '');
}

interface RedisReader {
  get<T = unknown>(key: string): Promise<T | null>;
}

export type BattleMapPokeFeature =
  | 'initiative'
  | 'players'
  | 'markers'
  | 'fog-appearance';

/**
 * Shared body behind every battle-map poke: env-var guard, token signing,
 * fetch with timeout, and a catch-all so a poke never throws. Never
 * exported — callers go through one of the wrappers below, each of which
 * decides which room(s) to target.
 *
 * `pokeKind` only shapes the warning log on failure — it never affects
 * whether or where a poke is sent. It has no default and every call site
 * must pass it explicitly: a defaulted label would let a future call site
 * silently inherit the wrong one (worse, a *plausible-looking* wrong one —
 * e.g. an active-map failure silently logged as "room poke failed", a
 * false-specific label that misleads on-call triage) with no compiler or
 * test signal. Requiring it turns that failure mode into a compile error.
 */
async function pokeRoom(
  code: string,
  battleMapId: string,
  feature: BattleMapPokeFeature,
  deps: { fetchFn?: typeof fetch; now?: number },
  pokeKind: 'room' | 'active-map'
): Promise<void> {
  const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  const secret = process.env.BATTLEMAP_RELAY_SECRET;
  if (!relayUrl || !secret) return;
  try {
    const room = `${code}:${battleMapId}`;
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
      body: JSON.stringify({ room, feature, token }),
      signal: AbortSignal.timeout(POKE_TIMEOUT_MS),
    });
  } catch (err) {
    const label = pokeKind === 'room' ? 'room ' : '';
    console.warn(
      `[relayPoke] ${label}poke failed (poll remains fallback):`,
      err
    );
  }
}

/**
 * Reads the campaign's `activeBattleMapId`, or `null` if there is none or the
 * read/parse fails. Shared by `sendBattleMapPoke` (the only room it targets)
 * and `sendBattleMapPokeToLiveRooms` (one room among the union it targets).
 * Never throws.
 */
async function readActiveBattleMapId(
  code: string,
  redis: RedisReader
): Promise<string | null> {
  try {
    const raw = await redis.get<string | SharedBattleMapState>(
      campaignSharedKey(code, 'battlemap')
    );
    if (!raw) return null;
    const battleMap: SharedBattleMapState =
      typeof raw === 'string' ? JSON.parse(raw) : raw;
    return battleMap?.activeBattleMapId ?? null;
  } catch (err) {
    console.warn(
      '[relayPoke] active-map lookup failed (poll remains fallback):',
      err
    );
    return null;
  }
}

/**
 * Best-effort WS poke after a write: tells clients in the active battle-map
 * room to refetch /shared immediately for the given feature. Never throws —
 * the 5s poll is the source-of-truth fallback; this only shaves latency.
 */
export async function sendBattleMapPoke(
  code: string,
  redis: RedisReader,
  feature: BattleMapPokeFeature,
  deps: { fetchFn?: typeof fetch; now?: number } = {}
): Promise<void> {
  const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  const secret = process.env.BATTLEMAP_RELAY_SECRET;
  if (!relayUrl || !secret) return;
  const activeBattleMapId = await readActiveBattleMapId(code, redis);
  if (!activeBattleMapId) return;
  await pokeRoom(code, activeBattleMapId, feature, deps, 'active-map');
}

/**
 * Poke a specific battle-map room directly, without looking up the active map.
 * Used for per-map metadata (fog appearance) that must reach a TV display
 * opened on an inactive map.
 */
export async function sendBattleMapPokeToRoom(
  code: string,
  battleMapId: string,
  feature: BattleMapPokeFeature,
  deps: { fetchFn?: typeof fetch; now?: number } = {}
): Promise<void> {
  await pokeRoom(code, battleMapId, feature, deps, 'room');
}

/**
 * Poke every battle-map room the campaign currently has connected clients
 * in — the union of the live-room registry and `activeBattleMapId` — rather
 * than only the single `activeBattleMapId` room, and rather than either/or
 * between the two. A registry that happens not to contain
 * `activeBattleMapId` (e.g. its entry aged out of `LIVE_MAP_ROOM_WINDOW_MS`
 * while the room stayed live, or the DM has a second map open elsewhere)
 * must never cause a poke that pre-registry code would have sent to go
 * unsent — this union makes that true by construction, not by case
 * analysis on whether the registry happens to be empty.
 *
 * The result is capped at `MAX_LIVE_MAP_ROOMS`, with `activeBattleMapId`
 * (when present) always kept — it's the one entry a poke must never drop —
 * and the oldest registry entries trimmed first if the union would
 * otherwise exceed the cap.
 *
 * Runs the fan-out concurrently with `Promise.allSettled` so one slow or
 * failing room cannot starve or fail the others. Never throws.
 *
 * Bails out before touching Redis when the relay isn't configured — the
 * registry read can't lead to a send in that case, so there's nothing to
 * gain from it (mirrors the same guard inside `pokeRoom`/`sendBattleMapPoke`).
 */
export async function sendBattleMapPokeToLiveRooms(
  code: string,
  redis: RedisReader & LiveMapRoomsReader,
  feature: BattleMapPokeFeature,
  deps: { fetchFn?: typeof fetch; now?: number } = {}
): Promise<void> {
  const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  const secret = process.env.BATTLEMAP_RELAY_SECRET;
  if (!relayUrl || !secret) return;

  const [liveRooms, activeBattleMapId] = await Promise.all([
    listLiveMapRooms(redis, code, { now: deps.now }),
    readActiveBattleMapId(code, redis),
  ]);

  // activeBattleMapId goes in first and always keeps its slot; liveRooms
  // (already most-recent-first, and already capped to MAX_LIVE_MAP_ROOMS by
  // listLiveMapRooms) fills the remainder, oldest entries dropped first if
  // the union doesn't fit.
  const rooms: string[] = [];
  const seen = new Set<string>();
  if (activeBattleMapId) {
    rooms.push(activeBattleMapId);
    seen.add(activeBattleMapId);
  }
  for (const battleMapId of liveRooms) {
    if (rooms.length >= MAX_LIVE_MAP_ROOMS) break;
    if (seen.has(battleMapId)) continue;
    seen.add(battleMapId);
    rooms.push(battleMapId);
  }

  if (rooms.length === 0) return;

  await Promise.allSettled(
    rooms.map(battleMapId => pokeRoom(code, battleMapId, feature, deps, 'room'))
  );
}

/**
 * Back-compat wrapper — the shared route's call site keeps this name and
 * signature. Fans out to every live room rather than only the active map,
 * same as `sendBattleMapPokeToLiveRooms` generally.
 */
export async function sendInitiativePoke(
  code: string,
  redis: RedisReader & LiveMapRoomsReader,
  deps: { fetchFn?: typeof fetch; now?: number } = {}
): Promise<void> {
  return sendBattleMapPokeToLiveRooms(code, redis, 'initiative', deps);
}
