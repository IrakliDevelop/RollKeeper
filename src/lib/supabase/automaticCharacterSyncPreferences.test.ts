import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';

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
});
