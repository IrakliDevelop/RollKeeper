import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';

import { AutomaticCharacterSyncPreferences } from './automaticCharacterSyncPreferences';
import {
  AutomaticCharacterSyncService,
  hasAutomaticCharacterSyncLocalPrerequisite,
  isAutomaticCharacterSyncEnabled,
} from './automaticCharacterSyncService';

const ACCOUNT = { id: 'account-a' };
const NAMESPACE = 'user:account-a' as const;
const character = {
  id: 'character-a',
  name: 'Aster',
  createdAt: '2026-01-01T00:00:00.000Z',
  characterData: { id: 'character-a', name: 'Aster', revision: 3 },
};

describe('automatic character sync feature flag', () => {
  const original =
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED =
        original;
    }
  });

  it('is disabled by default and independent from manual backup and IndexedDB flags', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED;
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED = 'true';
    process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED = 'true';
    expect(isAutomaticCharacterSyncEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
    expect(isAutomaticCharacterSyncEnabled()).toBe(true);
  });

  it('does not start the automatic repository for an unselected local profile', () => {
    const storage = {
      getItem: vi.fn(() => null),
    };
    expect(hasAutomaticCharacterSyncLocalPrerequisite(storage)).toBe(false);
    expect(storage.getItem).toHaveBeenCalledOnce();
  });

  it('accepts only a fully activated guest character cutover selection', () => {
    const prerequisite = {
      version: 1,
      namespace: 'guest',
      family: 'character',
      activatedEpoch: 3,
      activatedGeneration: 'generation-a',
    };
    expect(
      hasAutomaticCharacterSyncLocalPrerequisite({
        getItem: () => JSON.stringify(prerequisite),
      })
    ).toBe(true);
    expect(
      hasAutomaticCharacterSyncLocalPrerequisite({
        getItem: () => '{malformed',
      })
    ).toBe(false);
    for (const invalid of [
      { ...prerequisite, version: 2 },
      { ...prerequisite, namespace: 'user:account-a' },
      { ...prerequisite, family: 'campaign' },
      { ...prerequisite, activatedEpoch: '3' },
      { ...prerequisite, activatedGeneration: 3 },
    ]) {
      expect(
        hasAutomaticCharacterSyncLocalPrerequisite({
          getItem: () => JSON.stringify(invalid),
        })
      ).toBe(false);
    }
  });

  it('accepts a fully activated account-scoped cutover selection for that account', () => {
    const prerequisite = {
      version: 1,
      namespace: NAMESPACE,
      family: 'character',
      activatedEpoch: 3,
      activatedGeneration: 'generation-account',
    };
    expect(
      hasAutomaticCharacterSyncLocalPrerequisite(
        { getItem: () => JSON.stringify(prerequisite) },
        NAMESPACE
      )
    ).toBe(true);
    expect(
      hasAutomaticCharacterSyncLocalPrerequisite(
        { getItem: () => JSON.stringify(prerequisite) },
        'user:account-b'
      )
    ).toBe(false);
  });
});

describe('AutomaticCharacterSyncService', () => {
  let database: IDBDatabase;
  let repository: IndexedDbAutomaticCharacterSyncRepository;
  let preferences: AutomaticCharacterSyncPreferences;
  let service: AutomaticCharacterSyncService;
  let sequence: number;

  beforeEach(async () => {
    database = await openRollkeeperDatabase();
    sequence = 0;
    repository = new IndexedDbAutomaticCharacterSyncRepository(database, {
      randomId: () => `mutation-${++sequence}`,
    });
    preferences = new AutomaticCharacterSyncPreferences(database, {
      now: () => '2026-02-01T00:00:00.000Z',
      randomId: () => 'preview-1',
    });
    service = new AutomaticCharacterSyncService({
      featureEnabled: true,
      account: ACCOUNT,
      repository,
      preferences,
      indexedDbPrimary: true,
      generateCloudId: () => 'cloud-a',
      fingerprint: async () => 'fingerprint-a',
      now: () => '2026-02-01T00:00:00.000Z',
    });
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('does nothing until explicit per-character selection confirms the target account', async () => {
    await expect(service.recordEdit(character)).resolves.toBe('local-only');
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([]);

    await expect(
      service.enableCharacter(character, {
        confirmed: false,
        targetAccountId: ACCOUNT.id,
      })
    ).rejects.toThrow(/confirm/i);
    await service.enableCharacter(character, {
      confirmed: true,
      targetAccountId: ACCOUNT.id,
    });
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ legacyId: character.id, state: 'queued' }),
    ]);
  });

  it('refuses guest namespace and missing IndexedDB prerequisites', async () => {
    const blocked = new AutomaticCharacterSyncService({
      featureEnabled: true,
      account: ACCOUNT,
      repository,
      preferences,
      indexedDbPrimary: false,
    });
    await expect(
      blocked.enableCharacter(character, {
        confirmed: true,
        targetAccountId: ACCOUNT.id,
      })
    ).rejects.toThrow(/IndexedDB/i);
    await expect(repository.listOutbox('guest')).resolves.toEqual([]);
  });

  it('keeps every operation local-only when the deployment flag is disabled', async () => {
    const disabled = new AutomaticCharacterSyncService({
      featureEnabled: false,
      account: ACCOUNT,
      repository,
      preferences,
      indexedDbPrimary: true,
    });
    await expect(disabled.recordEdit(character)).resolves.toBe('local-only');
    await expect(disabled.recordDelete(character)).resolves.toBe('local-only');
    await expect(disabled.disableCharacter(character.id)).rejects.toThrow(
      /disabled/i
    );
    expect(() => disabled.previewAccountEnable([character])).toThrow(
      /disabled/i
    );
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([]);
  });

  it('opt-out stops new mutations while retaining documents, cloud links, and complete outbox', async () => {
    await service.enableCharacter(character, {
      confirmed: true,
      targetAccountId: ACCOUNT.id,
    });
    const before = await repository.listOutbox(NAMESPACE);
    await service.disableCharacter(character.id);
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        mutationId: before[0].mutationId,
        state: 'paused',
        cloudId: 'cloud-a',
      }),
    ]);
    await expect(
      service.recordEdit({
        ...character,
        characterData: { ...character.characterData, revision: 4 },
      })
    ).resolves.toBe('local-only');
    await expect(
      repository.getDocument(NAMESPACE, character.id)
    ).resolves.not.toBeNull();
  });

  it('account-wide preview is read-only and confirmation enables current plus future eligible characters', async () => {
    const second = {
      ...character,
      id: 'character-b',
      name: 'Bram',
      characterData: { ...character.characterData, id: 'character-b' },
    };
    const preview = await service.previewAccountEnable([character, second]);
    expect(preview.eligible).toHaveLength(2);
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([]);

    await service.confirmAccountEnable(preview, [character, second], true);
    await expect(repository.listOutbox(NAMESPACE)).resolves.toHaveLength(2);
    await expect(
      preferences.resolve(NAMESPACE, {
        id: 'future',
        name: 'Future',
        createdAt: '2026-02-02T00:00:00.000Z',
      })
    ).resolves.toMatchObject({ enabled: true, source: 'future-default' });
  });

  it('atomically creates automatic work for a newly persisted future-default character', async () => {
    const preview = await service.previewAccountEnable([character]);
    await service.confirmAccountEnable(preview, [character], true);
    const future = {
      ...character,
      id: 'character-future',
      name: 'Future',
      createdAt: '2026-02-02T00:00:00.000Z',
      characterData: {
        ...character.characterData,
        id: 'character-future',
        name: 'Future',
      },
    };

    await expect(service.recordEdit(future)).resolves.toBe('queued');
    await expect(
      repository.getDocument(NAMESPACE, future.id)
    ).resolves.toMatchObject({
      operation: 'create',
      syncPolicy: 'inherit',
      baseServerVersion: 0,
    });
  });

  it('rejects a stale account preview without partially selecting a missing character', async () => {
    const preview = await service.previewAccountEnable([character]);
    await expect(
      service.confirmAccountEnable(preview, [], true)
    ).rejects.toThrow(/eligibility changed/i);
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([]);
    await expect(
      preferences.resolve(NAMESPACE, {
        id: character.id,
        name: character.name,
        createdAt: character.createdAt,
      })
    ).resolves.toMatchObject({
      enabled: false,
      source: 'existing-default-off',
    });
  });

  it('queues later edits with the existing cloud identity and reports worker pause state', async () => {
    expect(service.isWorkerPaused()).toBe(false);
    await service.enableCharacter(
      { ...character, createdAt: new Date(character.createdAt) },
      { confirmed: true, targetAccountId: ACCOUNT.id }
    );
    await expect(
      service.recordEdit({
        ...character,
        characterData: { ...character.characterData, revision: 4 },
      })
    ).resolves.toBe('queued');
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        cloudId: 'cloud-a',
        localRevision: 4,
        operation: 'replace',
      }),
    ]);
    await service.pauseWorker();
    expect(service.isWorkerPaused()).toBe(true);
  });

  it('does not queue edits or deletes when an enabled preference has no local sync document', async () => {
    await preferences.setCharacter(NAMESPACE, character.id, true);
    await expect(service.recordEdit(character)).resolves.toBe('local-only');
    await expect(service.recordDelete(character)).resolves.toBe('local-only');
  });

  it('never reports local success when the atomic repository commit fails', async () => {
    const commit = vi.spyOn(repository, 'commit').mockResolvedValue({
      saved: false,
      reason: 'failed',
    });
    await expect(
      service.enableCharacter(character, {
        confirmed: true,
        targetAccountId: ACCOUNT.id,
      })
    ).rejects.toThrow(/could not be saved/i);
    commit.mockRestore();

    await service.enableCharacter(character, {
      confirmed: true,
      targetAccountId: ACCOUNT.id,
    });
    vi.spyOn(repository, 'commit').mockResolvedValue({
      saved: false,
      reason: 'failed',
    });
    await expect(service.recordEdit(character)).rejects.toThrow(
      /transaction failed/i
    );
    await expect(service.recordDelete(character)).rejects.toThrow(
      /were not saved/i
    );
  });

  it('uses safe default identity, digest, and timestamp factories', async () => {
    const defaults = new AutomaticCharacterSyncService({
      featureEnabled: true,
      account: ACCOUNT,
      repository,
      preferences,
      indexedDbPrimary: true,
    });
    await defaults.enableCharacter(character, {
      confirmed: true,
      targetAccountId: ACCOUNT.id,
    });
    await expect(
      repository.getDocument(NAMESPACE, character.id)
    ).resolves.toMatchObject({
      cloudId: expect.any(String),
      contentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      updatedAt: expect.any(String),
    });
  });

  it('isolates a switched account and worker-pause rollback leaves the complete outbox intact', async () => {
    await service.enableCharacter(character, {
      confirmed: true,
      targetAccountId: ACCOUNT.id,
    });
    const before = await repository.listOutbox(NAMESPACE);
    await service.pauseWorker();
    expect(await repository.listOutbox(NAMESPACE)).toEqual(before);
    await expect(repository.listOutbox('user:account-b')).resolves.toEqual([]);
  });

  it('atomically queues an opted-in local delete with its recoverable before-image', async () => {
    await service.enableCharacter(character, {
      confirmed: true,
      targetAccountId: ACCOUNT.id,
    });
    await service.recordDelete(character);

    await expect(
      repository.getTombstone(NAMESPACE, character.id)
    ).resolves.toMatchObject({
      beforeImage: expect.objectContaining({
        payload: expect.objectContaining({ name: 'Aster' }),
      }),
    });
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ operation: 'delete', state: 'queued' }),
    ]);
  });
});
