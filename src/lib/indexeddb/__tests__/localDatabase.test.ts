import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DATABASE_NAME,
  DATABASE_VERSION,
  OBJECT_STORE_NAMES,
  deleteRollkeeperDatabaseForTests,
  openExistingRollkeeperDatabase,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

describe('rollkeeper-local schema', () => {
  afterEach(async () => {
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('creates the exact version 1 object-store layout', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    expect(database.name).toBe(DATABASE_NAME);
    expect(database.version).toBe(DATABASE_VERSION);
    expect([...database.objectStoreNames]).toEqual([...OBJECT_STORE_NAMES]);
    database.close();
  });

  it('probes an absent database without creating it', async () => {
    await expect(
      openExistingRollkeeperDatabase({ factory: indexedDB })
    ).resolves.toBeNull();
    await new Promise(resolve => setTimeout(resolve, 0));
    await expect(indexedDB.databases()).resolves.not.toContainEqual(
      expect.objectContaining({ name: DATABASE_NAME })
    );
  });

  it('opens an existing compatible database without upgrading it', async () => {
    const created = await openRollkeeperDatabase({ factory: indexedDB });
    created.close();
    const existing = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    expect(existing?.version).toBe(DATABASE_VERSION);
    expect([...(existing?.objectStoreNames ?? [])]).toEqual([
      ...OBJECT_STORE_NAMES,
    ]);
    existing?.close();
  });

  it('closes and rejects a present incompatible database without changing it', async () => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION + 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onupgradeneeded = () =>
        request.result.createObjectStore('future-only');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    await expect(
      openExistingRollkeeperDatabase({ factory: indexedDB })
    ).rejects.toThrow(/incompatible/i);
    const unchanged = await new Promise<IDBDatabase>((resolve, reject) => {
      const reopen = indexedDB.open(DATABASE_NAME);
      reopen.onsuccess = () => resolve(reopen.result);
      reopen.onerror = () => reject(reopen.error);
    });
    expect(unchanged.version).toBe(DATABASE_VERSION + 1);
    expect([...unchanged.objectStoreNames]).toEqual(['future-only']);
    unchanged.close();
  });

  it('closes on versionchange so a later schema can reopen safely', async () => {
    const onVersionChange = vi.fn();
    await openRollkeeperDatabase({
      factory: indexedDB,
      onVersionChange,
    });

    const upgrade = indexedDB.open(DATABASE_NAME, DATABASE_VERSION + 1);
    await new Promise<void>((resolve, reject) => {
      upgrade.onupgradeneeded = () => undefined;
      upgrade.onsuccess = () => {
        upgrade.result.close();
        resolve();
      };
      upgrade.onerror = () => reject(upgrade.error);
    });

    expect(onVersionChange).toHaveBeenCalledOnce();
  });

  it('rejects unavailable, failed, blocked, aborted, and errored IDB operations', async () => {
    await expect(openRollkeeperDatabase({ factory: null })).rejects.toThrow(
      'unavailable'
    );

    const failedRequest: Partial<IDBRequest> = { error: null };
    const failedResult = requestResult(failedRequest as IDBRequest);
    failedRequest.onerror?.call(
      failedRequest as IDBRequest,
      new Event('error')
    );
    await expect(failedResult).rejects.toThrow('request failed');

    const aborted: Partial<IDBTransaction> = { error: null };
    const abortedResult = transactionComplete(aborted as IDBTransaction);
    aborted.onabort?.call(aborted as IDBTransaction, new Event('abort'));
    await expect(abortedResult).rejects.toThrow('aborted');

    const errored: Partial<IDBTransaction> = { error: null };
    const erroredResult = transactionComplete(errored as IDBTransaction);
    errored.onerror?.call(errored as IDBTransaction, new Event('error'));
    await expect(erroredResult).rejects.toThrow('transaction failed');

    const blocked = vi.fn();
    const openRequest: Partial<IDBOpenDBRequest> = { error: null };
    const factory = { open: () => openRequest } as unknown as IDBFactory;
    const opening = openRollkeeperDatabase({ factory, onBlocked: blocked });
    openRequest.onblocked?.call(
      openRequest as IDBOpenDBRequest,
      new Event('blocked') as IDBVersionChangeEvent
    );
    await expect(opening).rejects.toThrow('blocked');
    expect(blocked).toHaveBeenCalledOnce();

    const errorRequest: Partial<IDBOpenDBRequest> = { error: null };
    const errorFactory = { open: () => errorRequest } as unknown as IDBFactory;
    const failedOpen = openRollkeeperDatabase({ factory: errorFactory });
    errorRequest.onerror?.call(
      errorRequest as IDBOpenDBRequest,
      new Event('error')
    );
    await expect(failedOpen).rejects.toThrow('open failed');
  });
});
