import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import type { PlayerBackupRunV1 } from '@/lib/playerBackup/playerBackupRunRepository';

import {
  AutomaticCharacterSyncPreferences,
  type EligibleCharacter,
} from './automaticCharacterSyncPreferences';

const ACCOUNT = 'account-a';
const NAMESPACE = `user:${ACCOUNT}` as const;

const characters: EligibleCharacter[] = [
  { id: 'existing-a', name: 'Aster', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'existing-b', name: 'Bram', createdAt: '2026-01-02T00:00:00.000Z' },
];

function run(overrides: Partial<PlayerBackupRunV1> = {}): PlayerBackupRunV1 {
  return {
    version: 1,
    runId: 'run-a',
    accountId: ACCOUNT,
    namespace: NAMESPACE,
    mode: 'ongoing',
    eligibleCharacterIds: ['existing-a', 'existing-b'],
    selectedCharacterIds: ['existing-a'],
    clearedCharacterIds: ['existing-b'],
    futureDefault: 'on',
    broadSafetyReceipt: {
      runId: 'safety-a',
      manifestHash: 'manifest-a',
      createdAt: '2026-02-01T00:00:00.000Z',
      protectedEntryDigest: 'protected-a',
    },
    authority: {
      kind: 'legacy',
      namespace: 'guest',
      family: 'character',
    },
    confirmedAt: '2026-02-01T00:00:00.000Z',
    stage: 'confirmed',
    characterCheckpoints: {
      'existing-a': { localPreparation: 'pending' },
    },
    ...overrides,
  };
}

describe('AutomaticCharacterSyncPreferences', () => {
  let database: IDBDatabase;

  beforeEach(async () => {
    database = await openRollkeeperDatabase();
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('keeps existing records off until explicitly selected', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);

    await expect(
      preferences.resolve(NAMESPACE, characters[0])
    ).resolves.toMatchObject({
      enabled: false,
      source: 'existing-default-off',
    });

    await preferences.setCharacter(NAMESPACE, characters[0].id, true);
    await expect(
      preferences.resolve(NAMESPACE, characters[0])
    ).resolves.toMatchObject({ enabled: true, source: 'character-on' });

    await preferences.setCharacter(NAMESPACE, characters[0].id, false);
    await expect(
      preferences.resolve(NAMESPACE, characters[0])
    ).resolves.toMatchObject({ enabled: false, source: 'character-off' });
  });

  it('previews account-wide eligibility without changing policy and requires confirmation', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database, {
      now: () => '2026-02-01T00:00:00.000Z',
      randomId: () => 'preview-1',
    });

    const preview = await preferences.previewAccountEnable(
      NAMESPACE,
      characters
    );
    expect(preview).toMatchObject({
      previewId: 'preview-1',
      namespace: NAMESPACE,
      eligible: characters,
    });
    await expect(
      preferences.resolve(NAMESPACE, characters[0])
    ).resolves.toMatchObject({ enabled: false });

    await expect(
      preferences.confirmAccountEnable({ ...preview, confirmed: false })
    ).rejects.toThrow(/confirmation/i);
    await preferences.confirmAccountEnable({ ...preview, confirmed: true });

    await expect(
      preferences.resolve(NAMESPACE, characters[0])
    ).resolves.toMatchObject({ enabled: true, source: 'character-on' });
    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'future',
        name: 'Cora',
        createdAt: '2026-02-02T00:00:00.000Z',
      })
    ).resolves.toMatchObject({ enabled: true, source: 'future-default' });
  });

  it('preserves an explicit per-character off override over the future default', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database, {
      now: () => '2026-02-01T00:00:00.000Z',
    });
    await preferences.setCharacter(NAMESPACE, 'existing-b', false);
    const preview = await preferences.previewAccountEnable(
      NAMESPACE,
      characters
    );
    await preferences.confirmAccountEnable({ ...preview, confirmed: true });

    await expect(
      preferences.resolve(NAMESPACE, characters[1])
    ).resolves.toMatchObject({ enabled: false, source: 'character-off' });
  });

  it('isolates account namespaces and rejects the guest namespace', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await preferences.setCharacter(NAMESPACE, characters[0].id, true);

    await expect(
      preferences.resolve('user:account-b', characters[0])
    ).resolves.toMatchObject({ enabled: false });
    await expect(
      preferences.setCharacter('guest', characters[0].id, true)
    ).rejects.toThrow(/guest/i);
  });

  it('reads per-character policy and account default inside a caller transaction', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await preferences.setCharacter(NAMESPACE, 'existing-b', false);
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: run(),
      confirmed: true,
    });

    const transaction = database.transaction('meta', 'readonly');
    const meta = transaction.objectStore('meta');
    await expect(
      AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
        meta,
        NAMESPACE,
        'existing-a'
      )
    ).resolves.toBe('on');
    await expect(
      AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
        meta,
        NAMESPACE,
        'existing-b'
      )
    ).resolves.toBe('off');
    await expect(
      AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
        meta,
        NAMESPACE,
        'missing'
      )
    ).resolves.toBeNull();
    await expect(
      AutomaticCharacterSyncPreferences.readAccountDefaultInTransaction(
        meta,
        NAMESPACE
      )
    ).resolves.toEqual({
      futureDefault: 'on',
      enabledAt: '2026-02-01T00:00:00.000Z',
      confirmedAt: '2026-02-01T00:00:00.000Z',
    });
    await expect(
      AutomaticCharacterSyncPreferences.readAccountDefaultInTransaction(
        meta,
        'user:account-b'
      )
    ).resolves.toBeNull();
    await transactionComplete(transaction);
  });

  it('changes the future default without rewriting per-character choices', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    const T1 = '2026-02-01T00:00:00.000Z';
    const T2 = '2026-02-02T00:00:00.000Z';
    const T3 = '2026-02-03T00:00:00.000Z';

    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: run({ confirmedAt: T1 }),
      confirmed: true,
    });

    await preferences.setFutureDefault(NAMESPACE, 'off', T2);

    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'existing-a',
        name: 'Aster',
        createdAt: T1,
      })
    ).resolves.toMatchObject({ enabled: true, source: 'character-on' });
    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'existing-b',
        name: 'Bram',
        createdAt: T1,
      })
    ).resolves.toMatchObject({ enabled: false, source: 'character-off' });
    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'newcomer-1',
        name: 'Newcomer',
        createdAt: '2026-02-01T12:00:00.000Z',
      })
    ).resolves.toMatchObject({
      enabled: false,
      source: 'existing-default-off',
    });

    const afterOff = database.transaction('meta', 'readonly');
    await expect(
      AutomaticCharacterSyncPreferences.readAccountDefaultInTransaction(
        afterOff.objectStore('meta'),
        NAMESPACE
      )
    ).resolves.toEqual({
      futureDefault: 'off',
      enabledAt: T1,
      confirmedAt: T1,
    });
    await transactionComplete(afterOff);

    await preferences.setFutureDefault(NAMESPACE, 'on', T3);

    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'newcomer-2',
        name: 'Newcomer Two',
        createdAt: '2026-02-04T00:00:00.000Z',
      })
    ).resolves.toMatchObject({ enabled: true, source: 'future-default' });
    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'newcomer-3',
        name: 'Newcomer Three',
        createdAt: '2026-02-02T12:00:00.000Z',
      })
    ).resolves.toMatchObject({
      enabled: false,
      source: 'existing-default-off',
    });
    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'existing-a',
        name: 'Aster',
        createdAt: T1,
      })
    ).resolves.toMatchObject({ enabled: true, source: 'character-on' });
    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'existing-b',
        name: 'Bram',
        createdAt: T1,
      })
    ).resolves.toMatchObject({ enabled: false, source: 'character-off' });

    const afterOn = database.transaction('meta', 'readonly');
    await expect(
      AutomaticCharacterSyncPreferences.readAccountDefaultInTransaction(
        afterOn.objectStore('meta'),
        NAMESPACE
      )
    ).resolves.toEqual({ futureDefault: 'on', enabledAt: T3, confirmedAt: T1 });
    await transactionComplete(afterOn);
  });

  it('writes a per-character policy inside a caller transaction', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    const transaction = database.transaction('meta', 'readwrite');
    const meta = transaction.objectStore('meta');
    AutomaticCharacterSyncPreferences.writeCharacterPolicyInTransaction(
      meta,
      NAMESPACE,
      'hero',
      'off'
    );
    await expect(
      AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
        meta,
        NAMESPACE,
        'hero'
      )
    ).resolves.toBe('off');
    await transactionComplete(transaction);

    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'hero',
        name: 'Hero',
        createdAt: '2026-01-03T00:00:00.000Z',
      })
    ).resolves.toMatchObject({ enabled: false, source: 'character-off' });
  });
});
