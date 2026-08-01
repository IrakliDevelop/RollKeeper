import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CharacterWriterLock } from '@/lib/characterWriterLock';

interface HeldLock {
  name: string;
  release: () => void;
  aborted: boolean;
}

/** Minimal fake of navigator.locks: exclusive queue per name. */
function installFakeLocks() {
  const queues = new Map<
    string,
    Array<{
      cb: () => Promise<unknown>;
      signal?: AbortSignal;
      grant: () => void;
    }>
  >();
  const held = new Map<string, HeldLock>();

  const request = vi.fn(
    (
      name: string,
      options: { mode: string; signal?: AbortSignal },
      cb: () => Promise<unknown>
    ) =>
      new Promise<void>(resolveRequest => {
        const grant = () => {
          void cb().then(() => {
            held.delete(name);
            resolveRequest();
            const queue = queues.get(name) ?? [];
            const next = queue.shift();
            if (next && !next.signal?.aborted) next.grant();
          });
        };
        const queue = queues.get(name) ?? [];
        queues.set(name, queue);
        if (!held.has(name)) {
          held.set(name, { name, release: () => {}, aborted: false });
          grant();
        } else {
          queue.push({ cb, signal: options.signal, grant });
          options.signal?.addEventListener('abort', () => {
            const i = queue.findIndex(q => q.cb === cb);
            if (i >= 0) queue.splice(i, 1);
            resolveRequest();
          });
        }
      })
  );
  vi.stubGlobal('navigator', { locks: { request } });
  return { request };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('CharacterWriterLock', () => {
  it('without navigator.locks every tab reports leader (fallback)', () => {
    vi.stubGlobal('navigator', {});
    const lock = new CharacterWriterLock();
    expect(lock.isLeader('a')).toBe(true);
  });

  it('acquires leadership and fires onPromoted exactly once', async () => {
    installFakeLocks();
    const lock = new CharacterWriterLock();
    const onPromoted = vi.fn();
    lock.switchTo('a', { onPromoted });
    await vi.waitFor(() => expect(lock.isLeader('a')).toBe(true));
    expect(onPromoted).toHaveBeenCalledWith('a');
    expect(onPromoted).toHaveBeenCalledTimes(1);
  });

  it('switching characters releases the old lock before leading the new one', async () => {
    installFakeLocks();
    const lockA = new CharacterWriterLock();
    const lockB = new CharacterWriterLock();
    const noop = { onPromoted: vi.fn() };

    lockA.switchTo('a', noop);
    await vi.waitFor(() => expect(lockA.isLeader('a')).toBe(true));

    lockB.switchTo('a', noop); // queued behind lockA
    expect(lockB.isLeader('a')).toBe(false);

    lockA.switchTo('b', noop); // releases 'a'
    await vi.waitFor(() => expect(lockB.isLeader('a')).toBe(true));
    await vi.waitFor(() => expect(lockA.isLeader('b')).toBe(true));
    expect(lockA.isLeader('a')).toBe(false);
  });
});
