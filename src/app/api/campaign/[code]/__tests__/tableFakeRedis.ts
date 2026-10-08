import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';

import {
  tableAuthorityRoomKeys,
  tableCompatibilityKey,
  tableControlKey,
  tableDisplaySessionKey,
  tableRegistryKey,
} from '@/lib/tableServer/keys';

/**
 * In-memory Redis for the PR04 privacy route tests. One store backs both the
 * deserializing client (`getRedis`, parses JSON on read) and the raw client
 * (`getRawRedis`, returns stored strings; HGETALL as the REST flat array, the
 * A1-class shape).
 */
export function createTableFakeRedis() {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const hashes = new Map<string, Map<string, string>>();
  const writes: string[] = [];
  const encode = (value: unknown) =>
    typeof value === 'string' ? value : JSON.stringify(value);
  const parse = (value: string | undefined) => {
    if (value === undefined) return null;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  };
  const common = {
    set: async (key: string, value: unknown) => {
      writes.push(key);
      strings.set(key, encode(value));
      return 'OK';
    },
    del: async (...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        writes.push(key);
        if (strings.delete(key)) removed += 1;
        if (hashes.delete(key)) removed += 1;
        if (sets.delete(key)) removed += 1;
      }
      return removed;
    },
    sismember: async (key: string, member: string) =>
      sets.get(key)?.has(member) ? 1 : 0,
    expire: async () => 1,
    hget: async (key: string, field: string) =>
      hashes.get(key)?.get(field) ?? null,
    hset: async (key: string, values: Record<string, unknown>) => {
      writes.push(key);
      const hash = hashes.get(key) ?? new Map<string, string>();
      for (const [field, value] of Object.entries(values))
        hash.set(field, encode(value));
      hashes.set(key, hash);
      return 1;
    },
    pipeline: () => {
      const queued: Array<() => unknown> = [];
      const pipe = {
        get: (key: string) => {
          queued.push(() => parse(strings.get(key)));
          return pipe;
        },
        set: (key: string, value: unknown) => {
          queued.push(() => {
            writes.push(key);
            strings.set(key, encode(value));
            return 'OK';
          });
          return pipe;
        },
        exec: async () => queued.map(run => run()),
      };
      return pipe;
    },
  };
  const redis = {
    ...common,
    get: async (key: string) => parse(strings.get(key)),
    hgetall: async (key: string) => {
      const hash = hashes.get(key);
      return hash ? Object.fromEntries(hash) : null;
    },
  };
  const rawRedis = {
    ...common,
    get: async (key: string) => strings.get(key) ?? null,
    hgetall: async (key: string) => {
      const hash = hashes.get(key);
      return hash ? [...hash.entries()].flat() : null;
    },
  };
  return {
    redis,
    rawRedis,
    strings,
    sets,
    hashes,
    writes,
    reset() {
      strings.clear();
      sets.clear();
      hashes.clear();
      writes.length = 0;
    },
  };
}

export type TableFakeRedis = ReturnType<typeof createTableFakeRedis>;

export const CODE = 'PRIV04';
export const DM_ID = 'dm-1';
export const PLAYER_ID = 'char-a';
export const DISPLAY_KEY = 'display-key-1';
/** PR05 v1 display capability (43 base64url chars) and session nonce (22). */
export const DISPLAY_CAPABILITY = 'Cap5Synthetic_display-capability_0123456789';
export const DISPLAY_NONCE = 'Nonce5Synthetic_012345';
export const DISPLAY_GENERATION = 4242;
export const EPOCH = '19a12345-1234-4123-8123-123456789abc';
export const ROOM_TAVERN = '123e4567-e89b-42d3-a456-426614174000';
export const ROOM_FOREST = '223e4567-e89b-42d3-a456-426614174000';
export const GENERATION = '323e4567-e89b-42d3-a456-426614174000';

export function registryEntry(
  sceneId: string,
  sourceMapId: string | null,
  safeLabel: string,
  roomId: string,
  extra: Record<string, unknown> = {}
) {
  return {
    v: 1,
    sceneId,
    workspaceInstanceId: 'workspace-a',
    sourceMapId,
    contentRevision: 1,
    safeLabel,
    registeredAt: 1,
    registryRevision: 1,
    deleted: false,
    roomId,
    ...extra,
  };
}

export function setPresentation(
  fake: TableFakeRedis,
  sceneId: string | null,
  blanked = false
) {
  // PR05: presentation changes keep any issued display capability.
  const previous = fake.strings.get(tableControlKey(CODE));
  const display = previous
    ? (JSON.parse(previous) as Record<string, unknown>)
    : { displayGeneration: 0, displayCapabilityHash: null };
  fake.strings.set(
    tableControlKey(CODE),
    JSON.stringify({
      v: 1,
      epoch: EPOCH,
      revision: 7,
      writerFence: 1,
      leaseUntil: Date.now() + 30_000,
      holderSessionId: 'table-page',
      holderPrincipal: `legacy:${DM_ID}`,
      presentation: { sceneId, revision: 3, blanked },
      publicRunId: null,
      displayGeneration: display.displayGeneration,
      displayCapabilityHash: display.displayCapabilityHash,
    })
  );
}

export const sha256Hex = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

/**
 * PR05: issues {@link DISPLAY_CAPABILITY} at {@link DISPLAY_GENERATION} on
 * the current control (as rotation does) and, unless `bound` is false,
 * binds {@link DISPLAY_NONCE} (as the first descriptor read does).
 */
export function issueDisplay(fake: TableFakeRedis, bound = true) {
  const key = tableControlKey(CODE);
  const control = JSON.parse(fake.strings.get(key)!) as Record<string, unknown>;
  control.displayGeneration = DISPLAY_GENERATION;
  control.displayCapabilityHash = sha256Hex(DISPLAY_CAPABILITY);
  fake.strings.set(key, JSON.stringify(control));
  if (bound)
    fake.strings.set(
      tableDisplaySessionKey(CODE),
      JSON.stringify({
        displayGeneration: DISPLAY_GENERATION,
        nonceHash: sha256Hex(DISPLAY_NONCE),
      })
    );
  else fake.strings.delete(tableDisplaySessionKey(CODE));
}

export function setRegistryEntry(
  fake: TableFakeRedis,
  entry: ReturnType<typeof registryEntry>
) {
  const hash =
    fake.hashes.get(tableRegistryKey(CODE)) ?? new Map<string, string>();
  hash.set(entry.sceneId, JSON.stringify(entry));
  fake.hashes.set(tableRegistryKey(CODE), hash);
}

/** Tavern (shown) and Private Forest (registered, unpresented). */
export function seedTavernAndForest(fake: TableFakeRedis) {
  fake.strings.set(`campaign:${CODE}`, JSON.stringify({ dmId: DM_ID }));
  fake.sets.set(`campaign:${CODE}:players`, new Set([PLAYER_ID]));
  fake.strings.set(`campaign:${CODE}:displaykey`, DISPLAY_KEY);
  setRegistryEntry(
    fake,
    registryEntry('scene-tavern', 'map-tavern', 'Tavern', ROOM_TAVERN)
  );
  setRegistryEntry(
    fake,
    registryEntry('scene-forest', 'map-forest', 'Private Forest', ROOM_FOREST)
  );
  setPresentation(fake, 'scene-tavern');
  for (const room of [ROOM_TAVERN, ROOM_FOREST]) {
    fake.strings.set(
      tableAuthorityRoomKeys(CODE, room).meta,
      JSON.stringify({ v: 1, generation: GENERATION })
    );
  }
  fake.strings.set(
    tableCompatibilityKey(CODE, 'battlemap'),
    JSON.stringify({ activeBattleMapId: 'map-tavern', name: 'Tavern' })
  );
  fake.strings.set(
    `campaign:${CODE}:battlemaps`,
    JSON.stringify([
      {
        id: 'map-tavern',
        name: 'Tavern original',
        mapImageUrl: 'https://cdn.test/tavern.png',
        updatedAt: '2026-10-07T00:00:00.000Z',
      },
      {
        id: 'map-forest',
        name: 'Private Forest original',
        mapImageUrl: 'https://cdn.test/forest-secret.png',
        updatedAt: '2026-10-07T00:00:00.000Z',
      },
    ])
  );
  for (const id of ['map-tavern', 'map-forest']) {
    fake.strings.set(
      `campaign:${CODE}:battlemap:${id}`,
      JSON.stringify({
        id,
        name: id === 'map-forest' ? 'Private Forest original' : 'Tavern',
        mapImageUrl: `https://cdn.test/${id}-secret.png`,
      })
    );
  }
  for (const [sceneId, title] of [
    ['scene-tavern', 'Tavern chest'],
    ['scene-forest', 'Forest secret cache'],
    ['map-forest', 'Legacy forest marker'],
  ]) {
    fake.strings.set(
      `campaign:${CODE}:shared:battlemap-markers:${sceneId}`,
      JSON.stringify([{ id: `marker-${sceneId}`, title, body: '' }])
    );
  }
  for (const [id, appearance] of [
    ['scene-tavern', 'cloudy'],
    ['scene-forest', 'cloudy'],
    ['map-tavern', 'solid'],
  ]) {
    fake.strings.set(
      `campaign:${CODE}:fog-appearance:${id}`,
      JSON.stringify({
        v: 1,
        appearance,
        updatedAt: '2026-10-07T00:00:00.000Z',
      })
    );
  }
}

export const params = (id = '') => ({
  params: Promise.resolve({ code: CODE, id }),
});

export type RouteHandler = (
  request: NextRequest,
  context: ReturnType<typeof params>
) => Promise<Response>;

/** Replays a client-built request (URL + init) as the browser would send it. */
export function clientRequest(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET')
    headers.set('origin', 'http://localhost');
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: init.method ?? 'GET',
    headers,
    body: init.body as BodyInit | undefined,
  });
}
