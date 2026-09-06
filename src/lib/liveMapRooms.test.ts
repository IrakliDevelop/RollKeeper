import { describe, it, expect, vi } from 'vitest';

import {
  recordLiveMapRoom,
  listLiveMapRooms,
  LIVE_MAP_ROOM_WINDOW_MS,
  MAX_LIVE_MAP_ROOMS,
  type LiveMapRoomsReader,
  type LiveMapRoomsWriter,
} from '@/lib/liveMapRooms';
import { campaignLiveMapRoomsKey, SLIDING_TTL_SECONDS } from '@/lib/redis';

const CODE = 'CAMP1';
const NOW = 1_700_000_000_000;
const KEY = campaignLiveMapRoomsKey(CODE);

/**
 * Small in-memory sorted-set fake, behaviorally faithful to the Redis
 * commands this module uses (score-inclusive range pruning, rank-based
 * zrange with `rev`) so the boundary and top-N tests exercise real
 * behavior rather than a canned mock return.
 */
function createFakeRedis(): LiveMapRoomsReader &
  LiveMapRoomsWriter & {
    zadd: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    zremrangebyscore: ReturnType<typeof vi.fn>;
    zrange: ReturnType<typeof vi.fn>;
    ttls: Map<string, number>;
  } {
  const zset = new Map<string, Map<string, number>>();
  const ttls = new Map<string, number>();

  return {
    ttls,
    zadd: vi.fn(
      async (
        key: string,
        { score, member }: { score: number; member: string }
      ) => {
        let members = zset.get(key);
        if (!members) {
          members = new Map();
          zset.set(key, members);
        }
        members.set(member, score);
        return 1;
      }
    ),
    expire: vi.fn(async (key: string, seconds: number) => {
      ttls.set(key, seconds);
      return 1;
    }),
    zremrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      const members = zset.get(key);
      if (!members) return 0;
      let removed = 0;
      for (const [member, score] of members) {
        if (score >= min && score <= max) {
          members.delete(member);
          removed += 1;
        }
      }
      return removed;
    }),
    zrange: vi.fn(
      async (
        key: string,
        min: number,
        max: number,
        opts?: { rev?: boolean }
      ) => {
        const members = zset.get(key);
        if (!members) return [];
        const entries = Array.from(members.entries()).sort((a, b) =>
          opts?.rev ? b[1] - a[1] : a[1] - b[1]
        );
        const end = max === -1 ? entries.length - 1 : max;
        return entries.slice(min, end + 1).map(([member]) => member);
      }
    ),
  };
}

describe('recordLiveMapRoom', () => {
  it('adds the id with now as its score and refreshes the key TTL', async () => {
    const redis = createFakeRedis();
    await recordLiveMapRoom(redis, CODE, 'map-1', { now: NOW });

    expect(redis.zadd).toHaveBeenCalledWith(KEY, {
      score: NOW,
      member: 'map-1',
    });
    expect(redis.expire).toHaveBeenCalledWith(KEY, SLIDING_TTL_SECONDS);
    expect(redis.ttls.get(KEY)).toBe(SLIDING_TTL_SECONDS);
  });

  it('defaults now to Date.now() when not provided', async () => {
    const redis = createFakeRedis();
    const before = Date.now();
    await recordLiveMapRoom(redis, CODE, 'map-1');
    const after = Date.now();

    const call = redis.zadd.mock.calls[0] as unknown as [
      string,
      { score: number; member: string },
    ];
    expect(call[1].score).toBeGreaterThanOrEqual(before);
    expect(call[1].score).toBeLessThanOrEqual(after);
  });

  it('swallows a rejecting zadd and never throws', async () => {
    const redis: LiveMapRoomsWriter = {
      zadd: vi.fn(async () => {
        throw new Error('redis down');
      }),
      expire: vi.fn(async () => 1),
    };
    await expect(
      recordLiveMapRoom(redis, CODE, 'map-1', { now: NOW })
    ).resolves.toBeUndefined();
  });

  it('swallows a rejecting expire and never throws', async () => {
    const redis: LiveMapRoomsWriter = {
      zadd: vi.fn(async () => 1),
      expire: vi.fn(async () => {
        throw new Error('redis down');
      }),
    };
    await expect(
      recordLiveMapRoom(redis, CODE, 'map-1', { now: NOW })
    ).resolves.toBeUndefined();
  });
});

describe('listLiveMapRooms', () => {
  it('returns [] when zremrangebyscore rejects, without throwing', async () => {
    const redis: LiveMapRoomsReader = {
      zremrangebyscore: vi.fn(async () => {
        throw new Error('redis down');
      }),
      zrange: vi.fn(async () => ['map-1']),
    };
    await expect(listLiveMapRooms(redis, CODE, { now: NOW })).resolves.toEqual(
      []
    );
  });

  it('returns [] when zrange rejects, without throwing', async () => {
    const redis: LiveMapRoomsReader = {
      zremrangebyscore: vi.fn(async () => 0),
      zrange: vi.fn(async () => {
        throw new Error('redis down');
      }),
    };
    await expect(listLiveMapRooms(redis, CODE, { now: NOW })).resolves.toEqual(
      []
    );
  });

  it('prunes with the exact score boundary: a room at exactly the window edge is stale, one just inside survives', async () => {
    const redis = createFakeRedis();
    await redis.zadd(KEY, {
      score: NOW - LIVE_MAP_ROOM_WINDOW_MS,
      member: 'map-stale',
    });
    await redis.zadd(KEY, {
      score: NOW - LIVE_MAP_ROOM_WINDOW_MS + 1,
      member: 'map-live',
    });

    const result = await listLiveMapRooms(redis, CODE, { now: NOW });

    expect(redis.zremrangebyscore).toHaveBeenCalledWith(
      KEY,
      0,
      NOW - LIVE_MAP_ROOM_WINDOW_MS
    );
    expect(result).toEqual(['map-live']);
  });

  it('returns exactly MAX_LIVE_MAP_ROOMS entries, the most recently minted ones, when more are live', async () => {
    const redis = createFakeRedis();
    const total = MAX_LIVE_MAP_ROOMS + 10;
    for (let i = 0; i < total; i += 1) {
      // Ascending scores: higher i = more recently minted.
      await redis.zadd(KEY, { score: NOW - total + i, member: `map-${i}` });
    }

    const result = await listLiveMapRooms(redis, CODE, { now: NOW });

    expect(result).toHaveLength(MAX_LIVE_MAP_ROOMS);
    const expectedMostRecentFirst = Array.from(
      { length: MAX_LIVE_MAP_ROOMS },
      (_, i) => `map-${total - 1 - i}`
    );
    expect(result).toEqual(expectedMostRecentFirst);
  });

  it('filters out non-string members', async () => {
    const redis: LiveMapRoomsReader = {
      zremrangebyscore: vi.fn(async () => 0),
      zrange: vi.fn(async () => ['map-1', 42, null, { id: 'map-2' }, 'map-3']),
    };

    const result = await listLiveMapRooms(redis, CODE, { now: NOW });
    expect(result).toEqual(['map-1', 'map-3']);
  });
});
