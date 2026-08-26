import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  captureActiveCharacterRecoveryBundleFromRows,
  exportCurrentCharacterData,
} from '@/lib/indexeddb/characterRecoveryExport';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

describe('blocked-state character exports', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('exports active data, compatibility mirrors, journal and recovery artifacts without unrelated families', async () => {
    localStorage.setItem('rollkeeper-player-data', 'mirror');
    localStorage.setItem('rollkeeper-character:hero', 'hero-mirror');
    localStorage.setItem('rollkeeper-dm-data', 'dm');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction(
      [
        'meta',
        'kvGenerations',
        'journal',
        'conflicts',
        'quarantine',
        'tombstones',
      ],
      'readwrite'
    );
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
    setup.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-dm-data',
      presence: true,
      rawValue: 'dm-row',
    });
    setup.objectStore('journal').put({
      journalId: 'j',
      namespace: 'guest',
      family: 'character',
      key: 'rollkeeper-player-data',
    });
    setup.objectStore('conflicts').put({
      conflictId: 'c',
      namespace: 'guest',
      family: 'character',
      key: 'rollkeeper-player-data',
    });
    setup.objectStore('quarantine').put({
      quarantineId: 'q',
      namespace: 'user:other',
      key: 'rollkeeper-player-data',
    });
    setup.objectStore('tombstones').put({
      namespace: 'guest',
      family: 'character',
      legacyId: 'hero',
      key: 'rollkeeper-character:hero',
    });
    await transactionComplete(setup);

    const serialized = await exportCurrentCharacterData(
      database,
      localStorage,
      'guest',
      () => 'exported'
    );
    const bundle = JSON.parse(serialized);
    expect(bundle).toMatchObject({
      format: 'rollkeeper-current-character-export',
      namespace: 'guest',
      exportedAt: 'exported',
      authority: { generation: 'active', epoch: 2 },
      compatibilityMirrors: [
        { key: 'rollkeeper-character:hero', rawValue: 'hero-mirror' },
        { key: 'rollkeeper-player-data', rawValue: 'mirror' },
      ],
      journal: [{ journalId: 'j' }],
      conflicts: [{ conflictId: 'c' }],
      quarantine: [],
      tombstones: [expect.objectContaining({ legacyId: 'hero' })],
      bundleHash: expect.any(String),
    });
    expect(bundle.generations).toEqual([
      expect.objectContaining({
        key: 'rollkeeper-player-data',
        rawValue: 'active',
      }),
    ]);
    expect(serialized).not.toContain('rollkeeper-dm-data');
    database.close();
  });

  it('exports a local-authority empty profile with null and unrelated storage slots safely', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const storage = {
      length: 3,
      key: (index: number) =>
        [null, 'rollkeeper-player-data', 'rollkeeper-dm-data'][index] ?? null,
      getItem: () => null,
    };
    const bundle = JSON.parse(
      await exportCurrentCharacterData(database, storage, 'guest')
    );
    expect(bundle.authority).toEqual({ authority: 'localStorage', epoch: 0 });
    expect(bundle.compatibilityMirrors).toEqual([]);
    database.close();
  });

  it('rejects empty, duplicate, malformed, and mixed active-row sources before serialization', async () => {
    const authority = {
      authority: 'indexedDB' as const,
      namespace: 'guest' as const,
      family: 'character' as const,
      generation: 'active',
      epoch: 1,
      committedAt: 'now',
    };
    const base = {
      authority,
      appVersion: 'test',
      runId: 'recovery',
      timestamp: 'created',
    };
    await expect(
      captureActiveCharacterRecoveryBundleFromRows({ ...base, rows: [] })
    ).rejects.toThrow(/empty/i);
    const valid = {
      namespace: 'guest' as const,
      generation: 'active',
      key: 'rollkeeper-player-data',
      presence: true,
      rawValue: '{"version":1}',
    };
    await expect(
      captureActiveCharacterRecoveryBundleFromRows({
        ...base,
        rows: [valid, valid],
      })
    ).rejects.toThrow(/malformed|mixed/i);
    await expect(
      captureActiveCharacterRecoveryBundleFromRows({
        ...base,
        rows: [{ ...valid, presence: false, rawValue: 'not-null' }],
      })
    ).rejects.toThrow(/malformed|mixed/i);
    await expect(
      captureActiveCharacterRecoveryBundleFromRows({
        ...base,
        rows: [{ ...valid, generation: 'other' }],
      })
    ).rejects.toThrow(/malformed|mixed/i);
  });
});
