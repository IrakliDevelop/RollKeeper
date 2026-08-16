import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { commitCharacterCutover } from '@/lib/indexeddb/characterAuthority';
import {
  installCharacterStaleMirrorMonitor,
  reconcileStaleCharacterMirrorWrite,
} from '@/lib/indexeddb/characterStaleMirror';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

describe('late localStorage-only character writes', () => {
  afterEach(async () => deleteRollkeeperDatabaseForTests(indexedDB));

  it('preserves a stale-tab value as a conflict and restores the active generation mirror', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction(['meta', 'kvGenerations'], 'readwrite');
    setup.objectStore('meta').put({
      key: 'migration-state:guest:character',
      state: 'CUTOVER_READY',
      runId: 'active',
      checkpointAt: 'before',
    });
    setup.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-player-data',
      presence: true,
      rawValue: 'active',
    });
    await transactionComplete(setup);
    await commitCharacterCutover(database, {
      namespace: 'guest',
      generation: 'active',
      confirmed: true,
      now: () => 'cutover',
      gates: {
        recoveryReceipt: true,
        sourceManifestUnchanged: true,
        captureVerifiedAfterReopen: true,
        noQuarantine: true,
        parity: true,
        journalEmpty: true,
      },
    });
    const storage = { getItem: vi.fn(() => 'stale'), setItem: vi.fn() };
    await reconcileStaleCharacterMirrorWrite(database, storage, {
      namespace: 'guest',
      key: 'rollkeeper-player-data',
      observedRawValue: 'stale',
      conflictId: 'stale-tab',
      now: () => 'later',
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      'rollkeeper-player-data',
      'active'
    );
    const tx = database.transaction('conflicts', 'readonly');
    expect(
      await requestResult(tx.objectStore('conflicts').get('stale-tab'))
    ).toMatchObject({
      kind: 'stale-localstorage-after-cutover',
      staleRawValue: 'stale',
      activeRawValue: 'active',
    });
    await transactionComplete(tx);
    database.close();
  });

  it('journals a failed mirror restoration and ignores unrelated families', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction(['meta', 'kvGenerations'], 'readwrite');
    setup.objectStore('meta').put({
      key: 'active-generation:guest:character',
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'active',
      epoch: 2,
      committedAt: 'now',
    });
    setup.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-player-data',
      presence: true,
      rawValue: 'active',
    });
    await transactionComplete(setup);
    const storage = {
      getItem: vi.fn(() => 'stale'),
      setItem: vi.fn(() => {
        throw new Error('quota');
      }),
    };
    await reconcileStaleCharacterMirrorWrite(database, storage, {
      namespace: 'guest',
      key: 'rollkeeper-player-data',
      observedRawValue: 'stale',
      conflictId: 'queued',
      now: () => 'later',
    });
    await reconcileStaleCharacterMirrorWrite(database, storage, {
      namespace: 'guest',
      key: 'rollkeeper-dm-data',
      observedRawValue: 'dm',
      conflictId: 'dm',
      now: () => 'later',
    });
    const tx = database.transaction(['journal', 'conflicts'], 'readonly');
    expect(
      await requestResult(tx.objectStore('journal').get('mirror-retry:queued'))
    ).toMatchObject({
      key: 'rollkeeper-player-data',
      rawValue: 'active',
      legacyAck: false,
      idbAck: true,
    });
    expect(
      await requestResult(tx.objectStore('conflicts').get('dm'))
    ).toBeUndefined();
    await transactionComplete(tx);
    database.close();
  });

  it('returns without mutation for legacy authority, identical values, and missing active rows', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const storage = { getItem: vi.fn(() => 'same'), setItem: vi.fn() };
    await reconcileStaleCharacterMirrorWrite(database, storage, {
      namespace: 'guest',
      key: 'rollkeeper-player-data',
      observedRawValue: 'same',
      conflictId: 'legacy',
      now: () => 'now',
    });
    const setup = database.transaction('meta', 'readwrite');
    setup.objectStore('meta').put({
      key: 'active-generation:guest:character',
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'missing',
      epoch: 1,
      committedAt: 'now',
    });
    await transactionComplete(setup);
    await reconcileStaleCharacterMirrorWrite(database, storage, {
      namespace: 'guest',
      key: 'rollkeeper-player-data',
      observedRawValue: 'same',
      conflictId: 'missing',
      now: () => 'now',
    });
    for (const [presence, rawValue, id] of [
      [false, 'ignored', 'absent'],
      [true, null, 'null'],
    ] as const) {
      const put = database.transaction('kvGenerations', 'readwrite');
      put.objectStore('kvGenerations').put({
        namespace: 'guest',
        generation: 'missing',
        key: 'rollkeeper-player-data',
        presence,
        rawValue,
      });
      await transactionComplete(put);
      await reconcileStaleCharacterMirrorWrite(database, storage, {
        namespace: 'guest',
        key: 'rollkeeper-player-data',
        observedRawValue: 'same',
        conflictId: id,
        now: () => 'now',
      });
    }
    expect(storage.setItem).not.toHaveBeenCalled();
    database.close();
  });

  it('installs and removes the storage-event monitor without BroadcastChannel', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const stop = installCharacterStaleMirrorMonitor(window, 'guest');
    expect(add).toHaveBeenCalledWith('storage', expect.any(Function));
    stop();
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  it('processes a real storage event and closes its database connection', async () => {
    localStorage.setItem('rollkeeper-player-data', 'stale-event');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction(['meta', 'kvGenerations'], 'readwrite');
    setup.objectStore('meta').put({
      key: 'active-generation:guest:character',
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'active',
      epoch: 1,
      committedAt: 'now',
    });
    setup.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-player-data',
      presence: true,
      rawValue: 'active-event',
    });
    await transactionComplete(setup);
    database.close();
    const stop = installCharacterStaleMirrorMonitor(window, 'guest');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'rollkeeper-player-data',
        newValue: 'stale-event',
      })
    );
    await vi.waitFor(() =>
      expect(localStorage.getItem('rollkeeper-player-data')).toBe(
        'active-event'
      )
    );
    stop();
    const reopened = await openRollkeeperDatabase({ factory: indexedDB });
    const tx = reopened.transaction('conflicts', 'readonly');
    expect(await requestResult(tx.objectStore('conflicts').count())).toBe(1);
    await transactionComplete(tx);
    reopened.close();
  });

  it('swallows monitor database failures and ignores empty storage keys', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('unavailable');
      },
    });
    const stop = installCharacterStaleMirrorMonitor(window);
    expect(() =>
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    ).not.toThrow();
    expect(() =>
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'rollkeeper-player-data',
          newValue: 'stale',
        })
      )
    ).not.toThrow();
    await Promise.resolve();
    stop();
    vi.unstubAllGlobals();
  });
});
