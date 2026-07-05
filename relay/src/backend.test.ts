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

  it('a failed flush re-marks entries and retries next interval without losing interim writes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { redis, calls } = fakeRedis();
    let fail = true;
    const origHSet = redis.hSet;
    redis.hSet = async (key, fv) => {
      await origHSet(key, fv);
      if (fail) throw new Error('boom');
    };
    const b = new BufferedRedisBackend(redis, { flushIntervalMs: 1000 });
    await b.apply('r1', up('a'));
    await vi.advanceTimersByTimeAsync(1000); // flush fails
    expect(calls.filter(c => c.method === 'hSet')).toHaveLength(1);
    fail = false;
    await b.apply('r1', up('b')); // interim write between failure and retry
    await vi.advanceTimersByTimeAsync(1000); // retry succeeds
    const hsets = calls.filter(c => c.method === 'hSet');
    expect(hsets).toHaveLength(2);
    // re-marked 'a' AND the interim 'b' are both in the retried payload
    expect(
      Object.keys(hsets[1].args[1] as Record<string, string>).sort()
    ).toEqual(['a', 'b']);
  });

  it('a failed clear sets pendingClear and retries del before writing new upserts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { redis, calls } = fakeRedis();
    let failDel = true;
    const origDel = redis.del;
    redis.del = async key => {
      await origDel(key);
      if (failDel) throw new Error('down');
    };
    const b = new BufferedRedisBackend(redis, { flushIntervalMs: 1000 });
    await b.apply('r1', up('a'));
    await b.apply('r1', { kind: 'clear' } as SyncOp); // del fails, swallowed
    expect(await b.snapshot('r1')).toEqual([]); // memory still cleared
    failDel = false;
    await b.apply('r1', up('b')); // element created after the clear
    await vi.advanceTimersByTimeAsync(1000);
    // retried del lands BEFORE the hSet of the post-clear element
    const order = calls
      .filter(c => c.method === 'del' || c.method === 'hSet')
      .map(c => c.method);
    expect(order).toEqual(['del', 'del', 'hSet']);
    const hsets = calls.filter(c => c.method === 'hSet');
    expect(Object.keys(hsets[0].args[1] as Record<string, string>)).toEqual([
      'b',
    ]);
  });

  it('keeps a failed clear pending: no hSet until del succeeds', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { redis, calls } = fakeRedis();
    let failDel = true;
    const origDel = redis.del;
    redis.del = async key => {
      await origDel(key);
      if (failDel) throw new Error('down');
    };
    const b = new BufferedRedisBackend(redis, { flushIntervalMs: 1000 });
    await b.apply('r1', up('a'));
    await b.apply('r1', { kind: 'clear' } as SyncOp); // del fails
    await b.apply('r1', up('b'));
    await vi.advanceTimersByTimeAsync(1000); // del fails again -> room skipped
    expect(calls.filter(c => c.method === 'hSet')).toHaveLength(0);
    failDel = false;
    await vi.advanceTimersByTimeAsync(1000); // rescheduled retry: del then hSet
    expect(calls.filter(c => c.method === 'hSet')).toHaveLength(1);
  });

  it('evicts idle rooms after idleEvictMs and re-hydrates from redis on next access', async () => {
    const { redis, calls } = fakeRedis();
    const b = new BufferedRedisBackend(redis, {
      flushIntervalMs: 1000,
      idleEvictMs: 5000,
    });
    await b.apply('r1', up('a'));
    await vi.advanceTimersByTimeAsync(1000); // flush r1; too fresh to evict
    const hGetAllsR1 = () =>
      calls.filter(
        c => c.method === 'hGetAll' && (c.args[0] as string).endsWith(':r1')
      );
    expect(hGetAllsR1()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5000); // r1 goes idle (no flush scheduled)
    await b.apply('r2', up('x')); // activity elsewhere schedules a flush
    await vi.advanceTimersByTimeAsync(1000); // that flush opportunistically evicts r1
    await b.snapshot('r1'); // next access re-hydrates from redis
    expect(hGetAllsR1()).toHaveLength(2);
  });

  it('does not start a second flush while one is still in-flight', async () => {
    const { redis, calls } = fakeRedis();
    let release!: () => void;
    const gate = new Promise<void>(res => {
      release = res;
    });
    const origHSet = redis.hSet;
    let gated = true;
    redis.hSet = async (key, fv) => {
      await origHSet(key, fv);
      if (gated) await gate;
    };
    const b = new BufferedRedisBackend(redis, { flushIntervalMs: 1000 });
    await b.apply('r1', up('a'));
    await vi.advanceTimersByTimeAsync(1000); // flush 1 starts, hSet hangs
    expect(calls.filter(c => c.method === 'hSet')).toHaveLength(1);
    await b.apply('r1', up('b')); // schedules the next interval
    await vi.advanceTimersByTimeAsync(1000); // timer fires but flush 1 is in-flight
    expect(calls.filter(c => c.method === 'hSet')).toHaveLength(1); // still one
    gated = false;
    release();
    await vi.advanceTimersByTimeAsync(0); // let flush 1 finish
    await vi.advanceTimersByTimeAsync(1000); // rescheduled flush writes 'b'
    const hsets = calls.filter(c => c.method === 'hSet');
    expect(hsets).toHaveLength(2);
    expect(Object.keys(hsets[1].args[1] as Record<string, string>)).toEqual([
      'b',
    ]);
  });
});
