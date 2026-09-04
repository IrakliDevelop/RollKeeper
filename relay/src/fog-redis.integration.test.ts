import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from 'redis';
import { createShape } from '@fieldnotes/core';
import type { FogMetaRecord, FogTileRecord } from '@fieldnotes/sync';
import { BufferedRedisBackend, type BackendRedis } from './backend.js';

const redisUrl = process.env.REDIS_TEST_URL;
const run = redisUrl ? describe : describe.skip;
const prefix = `rollkeeper:fog-it:${process.pid}:${Date.now()}:`;

function definition(generation: string) {
  return {
    version: 1 as const,
    base: 'covered' as const,
    bounds: { x: 0, y: 0, w: 17 * 128, h: 16 * 128 },
    cellSize: 1,
    tileCells: 128 as const,
    generation,
  };
}

function meta(version: number, generation?: string): FogMetaRecord {
  return {
    version,
    editor: 'dm-redis',
    ...(generation ? { definition: definition(generation) } : {}),
  };
}

function tile(generation: string, index: number): FogTileRecord {
  return {
    generation,
    x: index % 17,
    y: Math.floor(index / 17),
    version: 1,
    editor: 'dm-redis',
  };
}

run('fog persistence against real Redis', () => {
  const client = createClient({ url: redisUrl });
  const rooms = new Set<string>();
  const room = (suffix: string) => {
    const value = suffix;
    rooms.add(value);
    return value;
  };

  beforeAll(async () => {
    await client.connect();
    await client.ping();
  });

  afterAll(async () => {
    const keys = [...rooms].flatMap(value => [
      `${prefix}${value}`,
      `${prefix}${value}:fog:meta`,
      `${prefix}${value}:fog:tiles`,
    ]);
    if (keys.length) await client.del(keys);
    await client.quit();
  });

  it('survives backend restart and enforces the exact 256-tile boundary atomically', async () => {
    const roomId = room('restart-cap');
    const first = new BufferedRedisBackend(client as unknown as BackendRedis, {
      keyPrefix: prefix,
    });
    expect((await first.applyFogMeta(roomId, meta(1, 'gen-a'))).accepted).toBe(
      true
    );
    const records = Array.from({ length: 256 }, (_, index) =>
      tile('gen-a', index)
    );
    const accepted = await first.applyFogPatch(roomId, records);
    expect(accepted.accepted).toHaveLength(256);

    const overflow = await first.applyFogTile(roomId, tile('gen-a', 256));
    expect(overflow.accepted).toBe(false);
    await first.stopAndFlush();

    const restarted = new BufferedRedisBackend(
      client as unknown as BackendRedis,
      { keyPrefix: prefix }
    );
    expect((await restarted.fogSnapshot(roomId))?.tiles).toHaveLength(256);
    await restarted.stopAndFlush();
  });

  it('atomically clears old-generation tiles on shrink/reset and on disable', async () => {
    const roomId = room('generation');
    const backend = new BufferedRedisBackend(client as unknown as BackendRedis, {
      keyPrefix: prefix,
    });
    await backend.applyFogMeta(roomId, meta(1, 'gen-old'));
    await backend.applyFogPatch(roomId, [tile('gen-old', 0), tile('gen-old', 1)]);
    await backend.applyFogMeta(roomId, meta(2, 'gen-new'));
    const reset = await backend.fogSnapshot(roomId);
    expect(reset?.meta.definition?.generation).toBe('gen-new');
    expect(reset?.tiles).toEqual([]);

    await backend.applyFogMeta(roomId, meta(3));
    const disabled = await backend.fogSnapshot(roomId);
    expect(disabled?.meta.definition).toBeUndefined();
    expect(disabled?.tiles).toEqual([]);
    await backend.stopAndFlush();
  });

  it('cleans corrupt records and recovers after a transient Lua failure', async () => {
    const corruptRoom = room('corrupt');
    await client.hSet(`${prefix}${corruptRoom}:fog:meta`, 'current', '{bad-json');
    const backend = new BufferedRedisBackend(client as unknown as BackendRedis, {
      keyPrefix: prefix,
    });
    expect(await backend.fogSnapshot(corruptRoom)).toBeUndefined();
    expect((await backend.applyFogMeta(corruptRoom, meta(1, 'gen-clean'))).accepted).toBe(
      true
    );
    expect((await backend.fogSnapshot(corruptRoom))?.meta.definition?.generation).toBe(
      'gen-clean'
    );

    const recoveryRoom = room('eval-recovery');
    let fail = true;
    const redis = {
      hGetAll: client.hGetAll.bind(client),
      hGet: client.hGet.bind(client),
      hSet: client.hSet.bind(client),
      hDel: client.hDel.bind(client),
      del: client.del.bind(client),
      expire: client.expire.bind(client),
      eval: async (
        script: string,
        options: { keys: string[]; arguments: string[] }
      ) => {
        if (fail) {
          fail = false;
          throw new Error('simulated connection reset during EVAL');
        }
        return client.eval(script, options);
      },
    } satisfies BackendRedis;
    const recovering = new BufferedRedisBackend(redis, { keyPrefix: prefix });
    await expect(recovering.applyFogMeta(recoveryRoom, meta(1, 'gen-r'))).rejects.toThrow(
      /connection reset/i
    );
    expect(
      (await recovering.applyFogMeta(recoveryRoom, meta(1, 'gen-r'))).accepted
    ).toBe(true);
    await recovering.stopAndFlush();
  });

  it('element activity refreshes element, fog-meta, and fog-tile TTLs', async () => {
    const roomId = room('ttl');
    const backend = new BufferedRedisBackend(client as unknown as BackendRedis, {
      keyPrefix: prefix,
      roomTtlSeconds: 60,
    });
    await backend.applyFogMeta(roomId, meta(1, 'gen-ttl'));
    await backend.applyFogTile(roomId, tile('gen-ttl', 0));
    await backend.stopAndFlush();
    await Promise.all([
      client.expire(`${prefix}${roomId}:fog:meta`, 5),
      client.expire(`${prefix}${roomId}:fog:tiles`, 5),
    ]);

    const active = new BufferedRedisBackend(client as unknown as BackendRedis, {
      keyPrefix: prefix,
      roomTtlSeconds: 60,
    });
    await active.apply(roomId, {
      kind: 'upsert',
      element: createShape({
        position: { x: 0, y: 0 },
        size: { w: 10, h: 10 },
      }),
    });
    await active.stopAndFlush();
    expect(await client.ttl(`${prefix}${roomId}`)).toBeGreaterThan(50);
    expect(await client.ttl(`${prefix}${roomId}:fog:meta`)).toBeGreaterThan(50);
    expect(await client.ttl(`${prefix}${roomId}:fog:tiles`)).toBeGreaterThan(50);
  });
});
