import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useShopSalesDrainLeader } from '@/hooks/useShopSalesDrainLeader';
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

function Probe({
  campaignCode,
  lock,
  onRender,
}: {
  campaignCode: string;
  lock: ShopSalesDrainLock;
  onRender: (isLeader: boolean) => void;
}) {
  onRender(useShopSalesDrainLeader(campaignCode, lock));
  return null;
}

describe('useShopSalesDrainLeader', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installLocksFake();
  });
  afterEach(() => restore());

  it('reports leader once the lock is acquired', async () => {
    const seen: boolean[] = [];
    render(
      <Probe
        campaignCode="ABC123"
        lock={new ShopSalesDrainLock()}
        onRender={v => seen.push(v)}
      />
    );
    await waitFor(() => expect(seen.at(-1)).toBe(true));
    // Never claims leadership before the lock is actually held.
    expect(seen[0]).toBe(false);
  });

  it('gives leadership to a second mount only after the first unmounts', async () => {
    const first: boolean[] = [];
    const second: boolean[] = [];
    const firstTree = render(
      <Probe
        campaignCode="ABC123"
        lock={new ShopSalesDrainLock()}
        onRender={v => first.push(v)}
      />
    );
    await waitFor(() => expect(first.at(-1)).toBe(true));

    const secondTree = render(
      <Probe
        campaignCode="ABC123"
        lock={new ShopSalesDrainLock()}
        onRender={v => second.push(v)}
      />
    );
    await waitFor(() => expect(second.at(-1)).toBe(false));

    firstTree.unmount();
    await waitFor(() => expect(second.at(-1)).toBe(true));
    secondTree.unmount();
  });
});
