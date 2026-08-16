import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { bootstrapCharacterPersistence } from '@/lib/indexeddb/characterPersistenceBootstrap';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

function options(runId: string) {
  return {
    factory: indexedDB,
    storage: localStorage,
    namespace: 'guest' as const,
    runId,
    ownerId: 'tab',
    now: () => 'now',
    nowMs: () => 1,
    recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
  };
}

describe('character persistence bootstrap routing', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('prepares a selected legacy profile and coalesces concurrent Strict Mode bootstraps', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const firstOptions = {
      ...options('prepared'),
      locks: {
        request: async <T>(
          _name: string,
          _settings: { mode: 'exclusive' },
          callback: () => Promise<T> | T
        ): Promise<T> => {
          await held;
          return callback();
        },
      },
    };
    const first = bootstrapCharacterPersistence(firstOptions);
    const second = bootstrapCharacterPersistence({
      ...firstOptions,
      ownerId: 'other',
    });
    expect(first).toBe(second);
    release();
    await expect(first).resolves.toMatchObject({
      state: 'CUTOVER_READY',
      authority: 'localStorage',
    });
  });

  it('verifies an active generation, retries mirrors, and preserves a stale reload mirror', async () => {
    localStorage.setItem('rollkeeper-player-data', 'stale');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction(['meta', 'kvGenerations'], 'readwrite');
    setup.objectStore('meta').put({
      key: 'active-generation:guest:character',
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'active',
      epoch: 2,
      committedAt: 'before',
    });
    setup.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-player-data',
      presence: true,
      rawValue: '{"state":{"characters":[]},"version":1}',
    });
    await transactionComplete(setup);
    database.close();
    await expect(
      bootstrapCharacterPersistence(options('unused'))
    ).resolves.toMatchObject({
      state: 'IDB_PRIMARY',
      authority: 'indexedDB',
      epoch: 2,
    });
    expect(localStorage.getItem('rollkeeper-player-data')).toBe(
      '{"state":{"characters":[]},"version":1}'
    );
    const reopened = await openRollkeeperDatabase({ factory: indexedDB });
    const tx = reopened.transaction('conflicts', 'readonly');
    expect(await requestResult(tx.objectStore('conflicts').getAll())).toEqual([
      expect.objectContaining({
        kind: 'stale-localstorage-after-cutover',
        staleRawValue: 'stale',
      }),
    ]);
    await transactionComplete(tx);
    reopened.close();
  });

  it('preserves absent rows and skips mirrors that already match the active generation', async () => {
    localStorage.setItem(
      'rollkeeper-character:hero',
      '{"state":{"character":{"id":"hero"}},"version":0}'
    );
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction(['meta', 'kvGenerations'], 'readwrite');
    setup.objectStore('meta').put({
      key: 'active-generation:guest:character',
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'active',
      epoch: 2,
      committedAt: 'before',
    });
    setup.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-player-data',
      presence: false,
      rawValue: null,
    });
    setup.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-character:hero',
      presence: true,
      rawValue: '{"state":{"character":{"id":"hero"}},"version":0}',
    });
    await transactionComplete(setup);
    database.close();

    await expect(
      bootstrapCharacterPersistence(options('unused'))
    ).resolves.toMatchObject({ state: 'IDB_PRIMARY' });
    const reopened = await openRollkeeperDatabase({ factory: indexedDB });
    const read = reopened.transaction('conflicts', 'readonly');
    expect(await requestResult(read.objectStore('conflicts').count())).toBe(0);
    await transactionComplete(read);
    reopened.close();
  });

  it('enters recovery required instead of falling back when the active generation is corrupt', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction(['meta', 'kvGenerations'], 'readwrite');
    setup.objectStore('meta').put({
      key: 'active-generation:guest:character',
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'corrupt',
      epoch: 1,
      committedAt: 'before',
    });
    setup.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'corrupt',
      key: 'rollkeeper-player-data',
      presence: true,
      rawValue: '{broken',
    });
    await transactionComplete(setup);
    database.close();
    await expect(
      bootstrapCharacterPersistence(options('unused'))
    ).resolves.toMatchObject({
      state: 'RECOVERY_REQUIRED',
      authority: 'indexedDB',
      error: expect.stringMatching(/corrupt/i),
    });
  });

  it('honors a completed rollback without starting another migration', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction('meta', 'readwrite');
    setup.objectStore('meta').put({
      key: 'active-generation:guest:character',
      authority: 'localStorage',
      namespace: 'guest',
      family: 'character',
      generation: 'old',
      epoch: 3,
      committedAt: 'rollback',
    });
    await transactionComplete(setup);
    database.close();
    await expect(
      bootstrapCharacterPersistence(options('new'))
    ).resolves.toMatchObject({
      state: 'ROLLED_BACK',
      authority: 'localStorage',
      epoch: 3,
      rollbackGeneration: 'old',
    });
  });

  it('never falls back to legacy hydration when a known-activated profile cannot open IndexedDB', async () => {
    const unavailableFactory = {
      open: vi.fn(() => {
        throw new DOMException('unavailable', 'InvalidStateError');
      }),
    } as unknown as IDBFactory;
    await expect(
      bootstrapCharacterPersistence({
        ...options('unused'),
        factory: unavailableFactory,
        activatedEpoch: 7,
      })
    ).resolves.toMatchObject({
      state: 'RECOVERY_REQUIRED',
      authority: 'indexedDB',
      epoch: 7,
    });
  });
});
