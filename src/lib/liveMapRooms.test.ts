import { describe, it, expect, vi } from 'vitest';

import {
  recordLiveMapRoom,
  listLiveMapRooms,
  LIVE_MAP_ROOM_WINDOW_MS,
  LIVE_MAP_ROOM_TTL_SECONDS,
  MAX_LIVE_MAP_ROOMS,
  type LiveMapRoomsPipeline,
  type LiveMapRoomsReader,
  type LiveMapRoomsWriter,
} from '@/lib/liveMapRooms';
import { campaignLiveMapRoomsKey } from '@/lib/redis';

const CODE = 'CAMP1';
const NOW = 1_700_000_000_000;
const KEY = campaignLiveMapRoomsKey(CODE);

/**
 * Small in-memory sorted-set fake, behaviorally faithful to the Redis
 * commands this module uses (score-inclusive range pruning, rank-based
 * zrange with `rev`, and a pipeline that batches zadd + expire into one
 * `exec()`) so the boundary and top-N tests exercise real behavior rather
 * than a canned mock return.
 */
function createFakeRedis() {
  const zset = new Map<string, Map<string, number>>();
  const ttls = new Map<string, number>();

  const zadd = vi.fn(
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
  );
  const expire = vi.fn(async (key: string, seconds: number) => {
    ttls.set(key, seconds);
    return 1;
  });
  const zremrangebyscore = vi.fn(
    async (key: string, min: number, max: number) => {
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
    }
  );
  const zrange = vi.fn(
    async (key: string, min: number, max: number, opts?: { rev?: boolean }) => {
      const members = zset.get(key);
      if (!members) return [];
      const entries = Array.from(members.entries()).sort((a, b) =>
        opts?.rev ? b[1] - a[1] : a[1] - b[1]
      );
      const end = max === -1 ? entries.length - 1 : max;
      return entries.slice(min, end + 1).map(([member]) => member);
    }
  );

  const pipeline = vi.fn(() => {
    const queued: Array<() => Promise<unknown>> = [];
    const pipe: LiveMapRoomsPipeline = {
      zadd: (key, scoreMember) => {
        queued.push(() => zadd(key, scoreMember));
        return pipe;
      },
      expire: (key, seconds) => {
        queued.push(() => expire(key, seconds));
        return pipe;
      },
      exec: async () => {
        const results: unknown[] = [];
        for (const run of queued) {
          results.push(await run());
        }
        return results;
      },
    };
    return pipe;
  });

  return { zadd, expire, zremrangebyscore, zrange, pipeline, ttls };
}

describe('recordLiveMapRoom', () => {
  it('adds the id with now as its score and refreshes the key TTL, in one pipeline round trip', async () => {
    const redis = createFakeRedis();
    await recordLiveMapRoom(redis, CODE, 'map-1', { now: NOW });

    expect(redis.pipeline).toHaveBeenCalledTimes(1);
    expect(redis.zadd).toHaveBeenCalledWith(KEY, {
      score: NOW,
      member: 'map-1',
    });
    expect(redis.expire).toHaveBeenCalledWith(KEY, LIVE_MAP_ROOM_TTL_SECONDS);
    expect(redis.ttls.get(KEY)).toBe(LIVE_MAP_ROOM_TTL_SECONDS);
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

  it('swallows a pipeline whose exec rejects (e.g. zadd failed) and never throws', async () => {
    const redis: LiveMapRoomsWriter = {
      pipeline: () => ({
        zadd: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn(async () => {
          throw new Error('redis down');
        }),
      }),
    };
    await expect(
      recordLiveMapRoom(redis, CODE, 'map-1', { now: NOW })
    ).resolves.toBeUndefined();
  });

  it('swallows a throwing pipeline() call and never throws', async () => {
    const redis: LiveMapRoomsWriter = {
      pipeline: () => {
        throw new Error('redis down');
      },
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
