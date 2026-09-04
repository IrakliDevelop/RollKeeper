import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BufferedRedisBackend, type BackendRedis } from './backend.js';

function fakeRedis() {
  const hashes = new Map<string, Map<string, string>>();
  const calls: { method: string; args: unknown[] }[] = [];

  const redis: BackendRedis = {
    hGetAll: async key => {
      calls.push({ method: 'hGetAll', args: [key] });
      const h = hashes.get(key);
      if (!h) return {};
      return Object.fromEntries(h);
    },
    hGet: async (key, field) => {
      calls.push({ method: 'hGet', args: [key, field] });
      return hashes.get(key)?.get(field) ?? null;
    },
    hSet: async (
      key: string,
      fieldOrValues: string | Record<string, string>,
      value?: string
    ) => {
      calls.push({ method: 'hSet', args: [key, fieldOrValues, value] });
      if (!hashes.has(key)) hashes.set(key, new Map());
      const h = hashes.get(key)!;
      if (typeof fieldOrValues === 'string') {
        h.set(fieldOrValues, value!);
      } else {
        for (const [f, v] of Object.entries(fieldOrValues)) h.set(f, v);
      }
    },
    hDel: async (key: string, fieldOrFields: string | string[]) => {
      calls.push({ method: 'hDel', args: [key, fieldOrFields] });
      const h = hashes.get(key);
      if (!h) return;
      const fields =
        typeof fieldOrFields === 'string' ? [fieldOrFields] : fieldOrFields;
      for (const f of fields) h.delete(f);
    },
    del: async key => {
      calls.push({ method: 'del', args: [key] });
      hashes.delete(key);
    },
    expire: async (key, s) => {
      calls.push({ method: 'expire', args: [key, s] });
    },
    eval: async (_script, opts) => {
      calls.push({ method: 'eval', args: [opts] });
      const metaKey = opts.keys[0];
      const record = JSON.parse(opts.arguments[0]);

      if (Array.isArray(record)) {
        // fog-patch: record is an array of tiles
        if (!hashes.has(metaKey)) return [0, 0];
        const tilesKey = opts.keys[1];
        if (!hashes.has(tilesKey)) hashes.set(tilesKey, new Map());
        const th = hashes.get(tilesKey)!;
        const accepted: string[] = [];
        for (const tile of record) {
          const field = `${tile.x},${tile.y}`;
          th.set(field, JSON.stringify(tile));
          accepted.push(JSON.stringify(tile));
        }
        return [accepted.length, ...accepted, 0];
      }

      // fog-meta
      if (!hashes.has(metaKey)) hashes.set(metaKey, new Map());
      const h = hashes.get(metaKey)!;
      h.set('current', JSON.stringify(record));
      return [1];
    },
  };
  return { redis, calls, hashes };
}

describe('BufferedRedisBackend fog delegation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fogSnapshot returns undefined when no fog exists', async () => {
    const { redis } = fakeRedis();
    const b = new BufferedRedisBackend(redis);
    expect(await b.fogSnapshot('r1')).toBeUndefined();
  });

  it('fog methods exist and forward to the internal RedisHubBackend', async () => {
    const { redis } = fakeRedis();
    const b = new BufferedRedisBackend(redis);
    expect(typeof b.fogSnapshot).toBe('function');
    expect(typeof b.applyFogMeta).toBe('function');
    expect(typeof b.applyFogTile).toBe('function');
    expect(typeof b.applyFogPatch).toBe('function');
  });

  it('applyFogMeta writes through RedisHubBackend and returns accepted', async () => {
    const { redis } = fakeRedis();
    const b = new BufferedRedisBackend(redis);
    const result = await b.applyFogMeta('r1', {
      version: 1,
      editor: 'dm-1',
      definition: {
        version: 1,
        base: 'covered',
        bounds: { x: 0, y: 0, w: 1024, h: 1024 },
        cellSize: 64,
        tileCells: 128,
        generation: 'gen-1',
      } as never,
    });
    expect(result.accepted).toBe(true);
  });

  it('refreshes TTL on all room keys after a successful fog-meta write', async () => {
    const { redis, calls } = fakeRedis();
    const b = new BufferedRedisBackend(redis, { roomTtlSeconds: 99 });

    await b.applyFogMeta('r1', {
      version: 1,
      editor: 'dm-1',
      definition: {
        version: 1,
        base: 'covered',
        bounds: { x: 0, y: 0, w: 1024, h: 1024 },
        cellSize: 64,
        tileCells: 128,
        generation: 'gen-1',
      } as never,
    });

    await vi.advanceTimersByTimeAsync(600);

    const expires = calls.filter(c => c.method === 'expire');
    const expiredKeys = expires.map(c => c.args[0] as string);
    expect(expiredKeys).toContain('fieldnotes:room:r1');
    expect(expiredKeys).toContain('fieldnotes:room:r1:fog:meta');
    expect(expiredKeys).toContain('fieldnotes:room:r1:fog:tiles');
    for (const c of expires) {
      expect(c.args[1]).toBe(99);
    }
  });

  it('TTL retry on failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { redis, calls } = fakeRedis();
    let failExpire = true;
    const origExpire = redis.expire;
    redis.expire = async (key, s) => {
      if (failExpire && key.includes(':fog:')) throw new Error('redis down');
      return origExpire(key, s);
    };
    const b = new BufferedRedisBackend(redis, { roomTtlSeconds: 99 });

    await b.applyFogMeta('r1', {
      version: 1,
      editor: 'dm-1',
      definition: {
        version: 1,
        base: 'covered',
        bounds: { x: 0, y: 0, w: 512, h: 512 },
        cellSize: 64,
        tileCells: 128,
        generation: 'gen-ttl',
      } as never,
    });

    await vi.advanceTimersByTimeAsync(600);
    const firstExpires = calls.filter(c => c.method === 'expire');
    expect(firstExpires.length).toBeGreaterThan(0);

    failExpire = false;
    await vi.advanceTimersByTimeAsync(2500);
    const afterRetry = calls.filter(c => c.method === 'expire');
    expect(afterRetry.length).toBeGreaterThan(firstExpires.length);
  });

  it('stopAndFlush drains pending expiry maintenance', async () => {
    const { redis, calls } = fakeRedis();
    const b = new BufferedRedisBackend(redis, { roomTtlSeconds: 99 });

    await b.applyFogMeta('r1', {
      version: 1,
      editor: 'dm-1',
      definition: {
        version: 1,
        base: 'covered',
        bounds: { x: 0, y: 0, w: 512, h: 512 },
        cellSize: 64,
        tileCells: 128,
        generation: 'gen-stop',
      } as never,
    });

    await b.stopAndFlush();
    const expires = calls.filter(c => c.method === 'expire');
    const expiredKeys = expires.map(c => c.args[0] as string);
    expect(expiredKeys).toContain('fieldnotes:room:r1:fog:meta');
    expect(expiredKeys).toContain('fieldnotes:room:r1:fog:tiles');
  });

  it('stopAndFlush retries a transient expiry failure before returning', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { redis, calls } = fakeRedis();
    const originalExpire = redis.expire;
    let failuresRemaining = 1;
    redis.expire = async (key, seconds) => {
      if (key.endsWith(':fog:meta') && failuresRemaining > 0) {
        failuresRemaining -= 1;
        throw new Error('transient redis failure');
      }
      return originalExpire(key, seconds);
    };
    const b = new BufferedRedisBackend(redis, {
      roomTtlSeconds: 99,
      expiryRetryMs: 10,
    });

    await b.applyFogMeta('r1', {
      version: 1,
      editor: 'dm-1',
      definition: {
        version: 1,
        base: 'covered',
        bounds: { x: 0, y: 0, w: 512, h: 512 },
        cellSize: 64,
        tileCells: 128,
        generation: 'gen-stop-retry',
      } as never,
    });

    const stop = b.stopAndFlush();
    await vi.advanceTimersByTimeAsync(20);
    await stop;

    expect(failuresRemaining).toBe(0);
    expect(
      calls.filter(
        c => c.method === 'expire' && c.args[0] === 'fieldnotes:room:r1:fog:meta'
      )
    ).toHaveLength(1);
  });

  it('fogSnapshot retrieves stored fog state', async () => {
    const { redis } = fakeRedis();
    const b = new BufferedRedisBackend(redis);

    await b.applyFogMeta('r1', {
      version: 1,
      editor: 'dm-1',
      definition: {
        version: 1,
        base: 'covered',
        bounds: { x: 0, y: 0, w: 512, h: 512 },
        cellSize: 64,
        tileCells: 128,
        generation: 'gen-snap',
      } as never,
    });

    const snap = await b.fogSnapshot('r1');
    expect(snap).toBeTruthy();
    expect(snap!.meta.version).toBe(1);
  });
});
