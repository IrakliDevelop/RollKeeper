import { vi } from 'vitest';

const store = new Map<string, string>();
const sets = new Map<string, Set<string>>();

export function resetRedis() {
  store.clear();
  sets.clear();
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

const mockPipeline = () => {
  const commands: Array<() => unknown> = [];
  return {
    get: (key: string) => {
      commands.push(() => store.get(key) ?? null);
      return mockPipeline();
    },
    exec: async () => commands.map(fn => fn()),
  };
};

export const mockRedis = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),

  set: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
    return 'OK';
  }),

  del: vi.fn(async (...keys: string[]) => {
    let count = 0;
    for (const key of keys) {
      if (store.delete(key)) count++;
      if (sets.delete(key)) count++;
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

  expire: vi.fn(async () => 1),

  pipeline: vi.fn(() => mockPipeline()),
};

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
  campaignKey: (code: string) => `campaign:${code}`,
  campaignPlayersKey: (code: string) => `campaign:${code}:players`,
  campaignPlayerKey: (code: string, playerId: string) =>
    `campaign:${code}:player:${playerId}`,
  refreshCampaignTTL: vi.fn(async () => {}),
  SLIDING_TTL_SECONDS: 30 * 24 * 60 * 60,
}));
