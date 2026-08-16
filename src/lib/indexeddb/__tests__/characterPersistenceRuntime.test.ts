import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  awaitCharacterPersistence,
  freezeCharacterPersistenceForCutover,
  createCharacterFamilyStateStorage,
  finishCharacterPersistenceBootstrap,
  resetCharacterPersistenceRuntimeForTests,
  setCharacterRuntimeAuthority,
} from '@/lib/indexeddb/characterPersistenceRuntime';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

describe('character persistence authority router', () => {
  beforeEach(() => resetCharacterPersistenceRuntimeForTests());
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('uses the exact synchronous legacy path without consulting runtime dependencies for non-participants', () => {
    const values = new Map<string, string>();
    const backing = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
      key: vi.fn(),
      clear: vi.fn(),
      get length() {
        return values.size;
      },
    } as unknown as Storage;
    const openDatabase = vi.fn();
    const storage = createCharacterFamilyStateStorage({
      backing,
      participant: false,
      openDatabase,
      randomId: () => 'unused',
      now: () => 'unused',
    });
    expect(storage.setItem('rollkeeper-player-data', 'raw')).toBeUndefined();
    expect(storage.getItem('rollkeeper-player-data')).toBe('raw');
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it('commits active writes before the tracked durability promise resolves', async () => {
    const backing = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const close = vi.fn();
    const commit = vi.fn().mockResolvedValue({
      saved: true,
      idbAck: true,
      mirrorAck: true,
      mirrorPending: false,
    });
    setCharacterRuntimeAuthority({
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'g',
      epoch: 3,
      committedAt: 'now',
    });
    const storage = createCharacterFamilyStateStorage({
      backing,
      participant: true,
      openDatabase: vi.fn().mockResolvedValue({ close }),
      commit,
      randomId: () => 'write-a',
      now: () => 'now',
    });
    const returned = storage.setItem('rollkeeper-player-data', 'raw');
    expect(returned).toBeInstanceOf(Promise);
    await expect(awaitCharacterPersistence()).resolves.toBe(true);
    expect(commit).toHaveBeenCalledWith(
      expect.anything(),
      backing,
      expect.objectContaining({ expectedEpoch: 3, rawValue: 'raw' })
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('hydrates an active profile from IndexedDB and never from a stale compatibility mirror', async () => {
    const backing = {
      getItem: vi.fn(() => 'stale-localstorage'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const readActive = vi.fn().mockResolvedValue('authoritative-indexeddb');
    setCharacterRuntimeAuthority({
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'g',
      epoch: 3,
      committedAt: 'now',
    });
    const storage = createCharacterFamilyStateStorage({
      backing,
      participant: true,
      readActive,
    });

    await expect(storage.getItem('rollkeeper-player-data')).resolves.toBe(
      'authoritative-indexeddb'
    );
    expect(readActive).toHaveBeenCalledWith(
      expect.objectContaining({ generation: 'g', epoch: 3 }),
      'rollkeeper-player-data'
    );
    expect(backing.getItem).not.toHaveBeenCalled();
  });

  it('suppresses pre-hydration writes for an already-activated reload', async () => {
    localStorage.setItem(
      'rollkeeper:indexeddb-selection:guest:character',
      JSON.stringify({
        version: 1,
        namespace: 'guest',
        family: 'character',
        selectedAt: 'selected',
        activatedEpoch: 5,
        activatedGeneration: 'active',
      })
    );
    const commit = vi.fn().mockResolvedValue({
      saved: true,
      idbAck: true,
      mirrorAck: true,
      mirrorPending: false,
    });
    const storage = createCharacterFamilyStateStorage({
      backing: localStorage,
      participant: true,
      openDatabase: vi.fn().mockResolvedValue({ close: vi.fn() }),
      commit,
    });
    await storage.setItem('rollkeeper-player-data', 'empty-initial-state');
    expect(commit).not.toHaveBeenCalled();
    expect(localStorage.getItem('rollkeeper-player-data')).toBeNull();

    finishCharacterPersistenceBootstrap();
    await storage.setItem('rollkeeper-player-data', 'user-edit');
    expect(commit).toHaveBeenCalledWith(
      expect.anything(),
      localStorage,
      expect.objectContaining({
        expectedEpoch: 5,
        rawValue: 'user-edit',
      })
    );
  });

  it('reports a rejected active transaction as unsaved and never routes unrelated keys', async () => {
    const backing = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const commit = vi.fn().mockResolvedValue({
      saved: false,
      idbAck: false,
      mirrorAck: false,
      mirrorPending: false,
    });
    setCharacterRuntimeAuthority({
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'g',
      epoch: 1,
      committedAt: 'now',
    });
    const storage = createCharacterFamilyStateStorage({
      backing,
      participant: true,
      openDatabase: vi.fn().mockResolvedValue({ close: vi.fn() }),
      commit,
      randomId: () => 'write',
      now: () => 'now',
    });
    await storage.setItem('rollkeeper-player-data', 'raw');
    await expect(awaitCharacterPersistence()).resolves.toBe(false);
    await storage.setItem('rollkeeper-dm-data', 'dm');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(backing.setItem).not.toHaveBeenCalledWith(
      'rollkeeper-dm-data',
      'dm'
    );
  });

  it('keeps selected pre-cutover writes localStorage-authoritative and tracks shadow completion/failure', async () => {
    const values = new Map<string, string>();
    const backing = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const shadow = vi.fn().mockResolvedValue(undefined);
    const storage = createCharacterFamilyStateStorage({
      backing,
      participant: true,
      shadowLegacyWrite: shadow,
      randomId: () => 'unused',
      now: () => 'now',
    });
    await storage.setItem('rollkeeper-player-data', 'legacy');
    expect(backing.setItem).toHaveBeenCalledWith(
      'rollkeeper-player-data',
      'legacy'
    );
    expect(shadow).toHaveBeenCalledWith('rollkeeper-player-data', 'legacy');
    await expect(awaitCharacterPersistence()).resolves.toBe(true);
    expect(storage.getItem('rollkeeper-player-data')).toBe('legacy');
    expect(storage.removeItem('rollkeeper-player-data')).toBeUndefined();

    shadow.mockRejectedValueOnce(new Error('shadow unavailable'));
    await storage.setItem('rollkeeper-player-data', 'newer');
    await expect(awaitCharacterPersistence()).resolves.toBe(true);
  });

  it('queues current-tab writes during cutover and routes them only after authority is decided', async () => {
    const backing = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const commit = vi.fn().mockResolvedValue({
      saved: true,
      idbAck: true,
      mirrorAck: true,
      mirrorPending: false,
    });
    const storage = createCharacterFamilyStateStorage({
      backing,
      participant: true,
      openDatabase: vi.fn().mockResolvedValue({ close: vi.fn() }),
      commit,
      randomId: () => 'queued-write',
      now: () => 'now',
    });
    const release = await freezeCharacterPersistenceForCutover();
    const queued = storage.setItem('rollkeeper-player-data', 'during-cutover');
    await Promise.resolve();
    expect(backing.setItem).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();

    setCharacterRuntimeAuthority({
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'active',
      epoch: 4,
      committedAt: 'now',
    });
    release();
    await queued;
    expect(commit).toHaveBeenCalledWith(
      expect.anything(),
      backing,
      expect.objectContaining({ expectedEpoch: 4, rawValue: 'during-cutover' })
    );
    release();
  });

  it('rejects nested freezes and reset releases queued work safely', async () => {
    const release = await freezeCharacterPersistenceForCutover();
    await expect(freezeCharacterPersistenceForCutover()).rejects.toThrow(
      /already frozen/i
    );
    release();
    release();
    const releaseAgain = await freezeCharacterPersistenceForCutover();
    resetCharacterPersistenceRuntimeForTests();
    releaseAgain();
  });

  it('normalizes active open/commit failures to unsaved', async () => {
    const backing = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage;
    setCharacterRuntimeAuthority({
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'g',
      epoch: 1,
      committedAt: 'now',
    });
    const storage = createCharacterFamilyStateStorage({
      backing,
      participant: true,
      openDatabase: vi.fn().mockRejectedValue(new Error('unavailable')),
      randomId: () => 'write',
      now: () => 'now',
    });
    await storage.setItem('rollkeeper-player-data', 'raw');
    await expect(awaitCharacterPersistence()).resolves.toBe(false);
  });

  it('covers the production default shadow and active commit dependencies', async () => {
    localStorage.clear();
    let database = await openRollkeeperDatabase({ factory: indexedDB });
    const shadowSetup = database.transaction('meta', 'readwrite');
    shadowSetup.objectStore('meta').put({
      key: 'migration-state:guest:character',
      state: 'SHADOWING',
      runId: 'shadow',
    });
    await transactionComplete(shadowSetup);
    database.close();
    const legacyStorage = createCharacterFamilyStateStorage({
      backing: localStorage,
      participant: true,
    });
    await legacyStorage.setItem('rollkeeper-player-data', 'shadow-raw');
    await expect(awaitCharacterPersistence()).resolves.toBe(true);

    database = await openRollkeeperDatabase({ factory: indexedDB });
    const activeSetup = database.transaction(
      ['meta', 'kvGenerations'],
      'readwrite'
    );
    activeSetup.objectStore('meta').put({
      key: 'active-generation:guest:character',
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'active',
      epoch: 1,
      committedAt: 'now',
    });
    activeSetup.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-player-data',
      presence: true,
      rawValue: 'shadow-raw',
    });
    await transactionComplete(activeSetup);
    database.close();
    setCharacterRuntimeAuthority({
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'active',
      epoch: 1,
      committedAt: 'now',
    });
    const activeStorage = createCharacterFamilyStateStorage({
      backing: localStorage,
      participant: true,
    });
    await activeStorage.setItem('rollkeeper-player-data', 'active-raw');
    await expect(awaitCharacterPersistence()).resolves.toBe(true);
    await expect(activeStorage.getItem('rollkeeper-player-data')).resolves.toBe(
      'active-raw'
    );
    await expect(
      activeStorage.getItem('rollkeeper-character:missing')
    ).resolves.toBeNull();
    expect(activeStorage.getItem('rollkeeper-dm-data')).toBeNull();

    setCharacterRuntimeAuthority({
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      generation: 'active',
      epoch: 99,
      committedAt: 'stale',
    });
    await expect(
      activeStorage.getItem('rollkeeper-player-data')
    ).rejects.toThrow(/authority changed/i);
  });
});
