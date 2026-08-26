import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';
import {
  MigrationLockUnavailableError,
  withMigrationLock,
} from '@/lib/indexeddb/migrationLock';

describe('migration lock', () => {
  afterEach(async () => {
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('prefers an exclusive Web Lock when available', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const request = vi.fn(async (_name, options, callback) => {
      expect(options).toEqual({ mode: 'exclusive' });
      return callback();
    });

    await expect(
      withMigrationLock(database, async () => 'done', {
        ownerId: 'tab-a',
        now: () => 1,
        locks: { request },
      })
    ).resolves.toBe('done');
    expect(request).toHaveBeenCalledWith(
      'rollkeeper:indexeddb-migration',
      { mode: 'exclusive' },
      expect.any(Function)
    );
    database.close();
  });

  it('uses a durable lease without Web Locks and excludes a second tab', async () => {
    const first = await openRollkeeperDatabase({ factory: indexedDB });
    const second = await openRollkeeperDatabase({ factory: indexedDB });
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const firstRun = withMigrationLock(
      first,
      async () => {
        entered();
        return held;
      },
      { ownerId: 'tab-a', now: () => 100, leaseDurationMs: 1_000 }
    );
    await started;

    await expect(
      withMigrationLock(second, async () => undefined, {
        ownerId: 'tab-b',
        now: () => 101,
        leaseDurationMs: 1_000,
      })
    ).rejects.toBeInstanceOf(MigrationLockUnavailableError);

    release();
    await firstRun;
    await expect(
      withMigrationLock(second, async () => 'next', {
        ownerId: 'tab-b',
        now: () => 102,
        leaseDurationMs: 1_000,
      })
    ).resolves.toBe('next');
    first.close();
    second.close();
  });

  it('takes over a stale durable lease', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const tx = database.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({
      key: 'migration-lease',
      ownerId: 'dead-tab',
      expiresAt: 99,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await expect(
      withMigrationLock(database, async () => 'recovered', {
        ownerId: 'new-tab',
        now: () => 100,
        leaseDurationMs: 1_000,
      })
    ).resolves.toBe('recovered');
    database.close();
  });
});
