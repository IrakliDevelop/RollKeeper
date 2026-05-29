import { vi } from 'vitest';

const store = new Map<string, string>();
const sets = new Map<string, Set<string>>();
const lists = new Map<string, string[]>();
const hashes = new Map<string, Map<string, string>>();

export function resetRedis() {
  store.clear();
  sets.clear();
  lists.clear();
  hashes.clear();
}

export function seedRedis(key: string, value: unknown) {
  store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
}

export function seedRedisSet(key: string, members: string[]) {
  sets.set(key, new Set(members));
}

export function getRedisStore() {
  return store;
}

export function getRedisSet(key: string): Set<string> {
  return sets.get(key) ?? new Set();
}

export function getRedisLists() {
  return lists;
}

interface MockPipeline {
  get(key: string): MockPipeline;
  set(key: string, value: string): MockPipeline;
  exec(): Promise<unknown[]>;
}

const makePipeline = (): MockPipeline => {
  const commands: Array<() => unknown> = [];
  const pipeline: MockPipeline = {
    get: (key: string) => {
      commands.push(() => store.get(key) ?? null);
      return pipeline;
    },
    set: (key: string, value: string) => {
      commands.push(() => {
        store.set(
          key,
          typeof value === 'string' ? value : JSON.stringify(value)
        );
        return 'OK';
      });
      return pipeline;
    },
    exec: async () => commands.map(fn => fn()),
  };
  return pipeline;
};

export const mockRedis = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),

  set: vi.fn(async (key: string, value: string) => {
    store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    return 'OK';
  }),

  del: vi.fn(async (...keys: string[]) => {
    let count = 0;
    for (const key of keys) {
      if (store.delete(key)) count++;
      if (sets.delete(key)) count++;
      if (lists.delete(key)) count++;
      if (hashes.delete(key)) count++;
    }
    return count;
  }),

  exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),

  sadd: vi.fn(async (key: string, ...members: string[]) => {
    if (!sets.has(key)) sets.set(key, new Set());
    const s = sets.get(key)!;
    let added = 0;
    for (const m of members) {
      if (!s.has(m)) {
        s.add(m);
        added++;
      }
    }
    return added;
  }),

  smembers: vi.fn(async (key: string) => [...(sets.get(key) ?? [])]),

  srem: vi.fn(async (key: string, ...members: string[]) => {
    const s = sets.get(key);
    if (!s) return 0;
    let removed = 0;
    for (const m of members) {
      if (s.delete(m)) removed++;
    }
    return removed;
  }),

  sismember: vi.fn(async (key: string, member: string) => {
    return sets.get(key)?.has(member) ? 1 : 0;
  }),

  lpush: vi.fn(async (key: string, ...values: string[]) => {
    if (!lists.has(key)) lists.set(key, []);
    const list = lists.get(key)!;
    list.unshift(...[...values].reverse());
    return list.length;
  }),

  lrange: vi.fn(async (key: string, start: number, stop: number) => {
    const list = lists.get(key) ?? [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }),

  ltrim: vi.fn(async (key: string, start: number, stop: number) => {
    const list = lists.get(key);
    if (!list) return 'OK';
    const end = stop === -1 ? list.length : stop + 1;
    lists.set(key, list.slice(start, end));
    return 'OK';
  }),

  hset: vi.fn(async (key: string, field: string, value: string) => {
    if (!hashes.has(key)) hashes.set(key, new Map());
    const h = hashes.get(key)!;
    const isNew = !h.has(field);
    h.set(field, typeof value === 'string' ? value : JSON.stringify(value));
    return isNew ? 1 : 0;
  }),

  hget: vi.fn(async (key: string, field: string) => {
    return hashes.get(key)?.get(field) ?? null;
  }),

  hdel: vi.fn(async (key: string, ...fields: string[]) => {
    const h = hashes.get(key);
    if (!h) return 0;
    let removed = 0;
    for (const f of fields) {
      if (h.delete(f)) removed++;
    }
    return removed;
  }),

  hgetall: vi.fn(async (key: string) => {
    const h = hashes.get(key);
    if (!h || h.size === 0) return null;
    return Object.fromEntries(h.entries());
  }),

  expire: vi.fn(async () => 1),

  pipeline: vi.fn(() => makePipeline()),
};

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
  campaignKey: (code: string) => `campaign:${code}`,
  campaignPlayersKey: (code: string) => `campaign:${code}:players`,
  campaignPlayerKey: (code: string, playerId: string) =>
    `campaign:${code}:player:${playerId}`,
  campaignSharedKey: (code: string, feature: string) =>
    `campaign:${code}:shared:${feature}`,
  campaignMessagesKey: (code: string, playerId: string) =>
    `campaign:${code}:messages:${playerId}`,
  campaignEffectsKey: (code: string, playerId: string) =>
    `campaign:${code}:effects:${playerId}`,
  campaignTransfersKey: (code: string, playerId: string) =>
    `campaign:${code}:transfers:${playerId}`,
  campaignLocationsKey: (code: string) => `campaign:${code}:locations`,
  campaignLocationKey: (code: string, locationId: string) =>
    `campaign:${code}:location:${locationId}`,
  campaignBattleMapsKey: (code: string) => `campaign:${code}:battlemaps`,
  campaignBattleMapKey: (code: string, battleMapId: string) =>
    `campaign:${code}:battlemap:${battleMapId}`,
  characterShareKey: (characterId: string) => `character:share:${characterId}`,
  refreshCampaignTTL: vi.fn(async () => {}),
  SLIDING_TTL_SECONDS: 60 * 24 * 60 * 60,
  CHARACTER_SHARE_TTL_SECONDS: 24 * 60 * 60,
}));
