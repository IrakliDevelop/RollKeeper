import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SyncOp } from '@fieldnotes/sync';
import { BufferedRedisBackend, type BackendRedis } from './backend.js';

function fakeRedis(seed: Record<string, string> = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const redis: BackendRedis = {
    hGetAll: async key => {
      calls.push({ method: 'hGetAll', args: [key] });
      return seed;
    },
    hSet: async (key, fv) => calls.push({ method: 'hSet', args: [key, fv] }),
    hDel: async (key, fields) =>
      calls.push({ method: 'hDel', args: [key, fields] }),
    del: async key => calls.push({ method: 'del', args: [key] }),
    expire: async (key, s) => calls.push({ method: 'expire', args: [key, s] }),
  };
  return { redis, calls };
}
const elem = (id: string) =>
  ({
    id,
    type: 'shape',
    position: { x: 0, y: 0 },
    zIndex: 0,
    locked: false,
    layerId: 'l',
  }) as never;
const up = (id: string): SyncOp =>
  ({ kind: 'upsert', element: elem(id) }) as SyncOp;

describe('BufferedRedisBackend', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hydrates a room from redis once and serves reads from memory', async () => {
    const { redis, calls } = fakeRedis({ a: JSON.stringify(elem('a')) });
    const b = new BufferedRedisBackend(redis);
    expect((await b.snapshot('r1')).map(e => e.id)).toEqual(['a']);
    expect((await b.get('r1', 'a'))?.id).toBe('a');
    await b.snapshot('r1');
    expect(calls.filter(c => c.method === 'hGetAll')).toHaveLength(1);
  });

  it('buffers upserts and flushes them as one hSet + expire after the interval', async () => {
    const { redis, calls } = fakeRedis();
    const b = new BufferedRedisBackend(redis, {
      flushIntervalMs: 3000,
      roomTtlSeconds: 99,
    });
    await b.apply('r1', up('a'));
    await b.apply('r1', up('b'));
    expect(calls.filter(c => c.method === 'hSet')).toHaveLength(0); // not yet
    await vi.advanceTimersByTimeAsync(3000);
    const hsets = calls.filter(c => c.method === 'hSet');
    expect(hsets).toHaveLength(1);
    expect(
      Object.keys(hsets[0].args[1] as Record<string, string>).sort()
    ).toEqual(['a', 'b']);
    expect(calls.filter(c => c.method === 'expire')[0].args[1]).toBe(99);
  });

  it('flushes removals as hDel and drops them from memory immediately', async () => {
    const { redis, calls } = fakeRedis({ a: JSON.stringify(elem('a')) });
    const b = new BufferedRedisBackend(redis, { flushIntervalMs: 1000 });
    await b.apply('r1', { kind: 'remove', id: 'a' } as SyncOp);
    expect(await b.get('r1', 'a')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.filter(c => c.method === 'hDel')[0].args[1]).toEqual(['a']);
  });

  it('clear deletes the redis key immediately', async () => {
    const { redis, calls } = fakeRedis();
    const b = new BufferedRedisBackend(redis);
    await b.apply('r1', up('a'));
    await b.apply('r1', { kind: 'clear' } as SyncOp);
    expect(calls.filter(c => c.method === 'del')).toHaveLength(1);
    expect(await b.snapshot('r1')).toEqual([]);
  });

  it('an upsert after a remove of the same id wins (no stale hDel)', async () => {
    const { redis, calls } = fakeRedis();
    const b = new BufferedRedisBackend(redis, { flushIntervalMs: 1000 });
    await b.apply('r1', up('a'));
    await b.apply('r1', { kind: 'remove', id: 'a' } as SyncOp);
    await b.apply('r1', up('a'));
    await vi.advanceTimersByTimeAsync(1000);
    const hdel = calls.filter(c => c.method === 'hDel');
    expect(hdel).toHaveLength(0);
    expect((await b.get('r1', 'a'))?.id).toBe('a');
  });

  it('stopAndFlush flushes pending writes without waiting for the timer', async () => {
    const { redis, calls } = fakeRedis();
    const b = new BufferedRedisBackend(redis, { flushIntervalMs: 60_000 });
    await b.apply('r1', up('a'));
    await b.stopAndFlush();
    expect(calls.filter(c => c.method === 'hSet')).toHaveLength(1);
  });
});
