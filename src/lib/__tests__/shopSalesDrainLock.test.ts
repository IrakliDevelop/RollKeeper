import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShopSalesDrainLock } from '@/lib/shopSalesDrainLock';

interface Waiter {
  run: () => void;
  abort: () => void;
}

function installLocksFake() {
  const held = new Set<string>();
  const queues = new Map<string, Waiter[]>();

  const request = (
    name: string,
    options: { mode: string; signal?: AbortSignal },
    callback: () => Promise<void>
  ): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const start = () => {
        held.add(name);
        void callback().then(() => {
          held.delete(name);
          const next = queues.get(name)?.shift();
          resolve();
          next?.run();
        });
      };
      if (!held.has(name)) {
        start();
        return;
      }
      const waiter: Waiter = {
        run: start,
        abort: () => reject(new DOMException('aborted', 'AbortError')),
      };
      const queue = queues.get(name) ?? [];
      queue.push(waiter);
      queues.set(name, queue);
      options.signal?.addEventListener('abort', () => {
        queues.set(
          name,
          (queues.get(name) ?? []).filter(entry => entry !== waiter)
        );
        waiter.abort();
      });
    });

  const original = (navigator as { locks?: unknown }).locks;
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request },
  });
  return () => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: original,
    });
  };
}

describe('ShopSalesDrainLock', () => {
  let restore: () => void;

  beforeEach(() => {
    restore = installLocksFake();
  });

  afterEach(() => {
    restore();
    vi.restoreAllMocks();
  });

  const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  it('promotes exactly one of two instances competing for the same campaign', async () => {
    const first = new ShopSalesDrainLock();
    const second = new ShopSalesDrainLock();
    const firstPromoted = vi.fn<(code: string) => void>(() => {});
    const secondPromoted = vi.fn<(code: string) => void>(() => {});

    first.switchTo('ABC123', { onPromoted: firstPromoted });
    second.switchTo('ABC123', { onPromoted: secondPromoted });
    await flush();

    expect(first.isLeader('ABC123')).toBe(true);
    expect(second.isLeader('ABC123')).toBe(false);
    expect(firstPromoted).toHaveBeenCalledWith('ABC123');
    expect(secondPromoted).not.toHaveBeenCalled();
  });

  it('promotes the waiting instance when the leader releases', async () => {
    const first = new ShopSalesDrainLock();
    const second = new ShopSalesDrainLock();
    const secondPromoted = vi.fn<(code: string) => void>(() => {});

    first.switchTo('ABC123', { onPromoted: () => {} });
    second.switchTo('ABC123', { onPromoted: secondPromoted });
    await flush();

    first.switchTo('', { onPromoted: () => {} }); // release, e.g. unmount
    await flush();

    expect(second.isLeader('ABC123')).toBe(true);
    expect(secondPromoted).toHaveBeenCalledWith('ABC123');
  });

  it('does not hold two campaigns at once', async () => {
    const lock = new ShopSalesDrainLock();
    lock.switchTo('ABC123', { onPromoted: () => {} });
    await flush();
    lock.switchTo('XYZ789', { onPromoted: () => {} });
    await flush();

    expect(lock.isLeader('ABC123')).toBe(false);
    expect(lock.isLeader('XYZ789')).toBe(true);
  });

  it('reports leader in every tab when Web Locks are unavailable', () => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
    const lock = new ShopSalesDrainLock();
    expect(lock.isLeader('ABC123')).toBe(true);
  });

  it('keeps leading and logs when onPromoted throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const lock = new ShopSalesDrainLock();
    lock.switchTo('ABC123', {
      onPromoted: () => {
        throw new Error('boom');
      },
    });
    await flush();

    expect(lock.isLeader('ABC123')).toBe(false);
    expect(error).toHaveBeenCalled();
  });
});
