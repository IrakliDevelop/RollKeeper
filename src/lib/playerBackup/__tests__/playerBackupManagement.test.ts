import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import type { PlayerBackupExclusiveLockProvider } from '../playerBackupRunFence';
import {
  PlayerBackupLockUnavailableError,
  playerBackupAccountLockName,
} from '../playerBackupRunFence';
import {
  PlayerBackupActiveRunPointerCorruptError,
  PlayerBackupRunReplacedError,
} from '../playerBackupRunRepository';
import type { PlayerBackupRunV1 } from '../playerBackupRunRepository';
import { playerBackupActiveRunKey } from '../playerBackupRunRepository';
import {
  archivePlayerBackupOnlineCopy,
  backupPlayerBackupCharacterNow,
  pausePlayerBackupCharacter,
  restorePlayerBackupCharacter,
  restorePlayerBackupCharacterWithoutRun,
  resumePlayerBackupCharacter,
  setPlayerBackupFutureDefault,
} from '../playerBackupManagement';

const ACCOUNT = 'account-a';
const NAMESPACE = `user:${ACCOUNT}` as const;
const RUN_ID = 'run-a';
const HERO = {
  id: 'hero-a',
  name: 'Hero A',
  characterData: { id: 'hero-a', revision: 5 },
};

class QueuedLocks implements PlayerBackupExclusiveLockProvider {
  private tails = new Map<string, Promise<void>>();

  async request<T>(
    name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> {
    const previous = this.tails.get(name) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    this.tails.set(
      name,
      previous.then(() => current)
    );
    await previous;
    try {
      return await callback();
    } finally {
      release();
      if (this.tails.get(name) === current) this.tails.delete(name);
    }
  }
}

function buildRun(): PlayerBackupRunV1 {
  return {
    version: 1,
    runId: RUN_ID,
    accountId: ACCOUNT,
    namespace: NAMESPACE,
    mode: 'ongoing',
    eligibleCharacterIds: ['hero-a', 'hero-b'],
    selectedCharacterIds: ['hero-a', 'hero-b'],
    clearedCharacterIds: [],
    futureDefault: 'on',
    broadSafetyReceipt: {
      runId: 'safety-a',
      manifestHash: 'manifest-a',
      createdAt: '2026-08-26T09:00:00.000Z',
      protectedEntryDigest: 'protected-a',
    },
    authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
    confirmedAt: '2026-08-26T10:00:00.000Z',
    stage: 'confirmed',
    characterCheckpoints: {
      'hero-a': { localPreparation: 'ready' },
      'hero-b': { localPreparation: 'ready' },
    },
  };
}

async function seedRun() {
  const database = await openRollkeeperDatabase({ factory: indexedDB });
  const preferences = new AutomaticCharacterSyncPreferences(database);
  await preferences.applyConfirmedSelection({
    expectedActiveRunId: null,
    run: buildRun(),
    confirmed: true,
  });
  database.close();
}

describe('player backup management', () => {
  beforeEach(async () => {
    await seedRun();
  });

  afterEach(async () => {
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('fails closed without an exclusive lock', async () => {
    const backup = vi.fn();
    await expect(
      backupPlayerBackupCharacterNow({
        factory: indexedDB,
        locks: undefined,
        accountId: ACCOUNT,
        expectedActiveRunId: RUN_ID,
        character: HERO,
        service: { backup },
      })
    ).rejects.toBeInstanceOf(PlayerBackupLockUnavailableError);
    expect(backup).not.toHaveBeenCalled();
  });

  it('makes no mutation when the active run was replaced', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const transaction = database.transaction('meta', 'readwrite');
    transaction.objectStore('meta').put({
      key: `player-backup-active-run:${ACCOUNT}`,
      runId: 'run-new',
      accountId: ACCOUNT,
    });
    await transactionComplete(transaction);
    database.close();

    const backup = vi.fn();
    await expect(
      backupPlayerBackupCharacterNow({
        factory: indexedDB,
        locks: new QueuedLocks(),
        accountId: ACCOUNT,
        expectedActiveRunId: RUN_ID,
        character: HERO,
        service: { backup },
      })
    ).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);
    expect(backup).not.toHaveBeenCalled();
  });

  it('backs up one character through the fenced manual service', async () => {
    const row = {
      id: 'cloud-a',
      legacy_client_id: 'hero-a',
      server_version: 2,
    };
    const backup = vi.fn().mockResolvedValue({
      status: 'verified',
      row,
      fingerprint: 'fp',
    });
    const result = await backupPlayerBackupCharacterNow({
      factory: indexedDB,
      locks: new QueuedLocks(),
      accountId: ACCOUNT,
      expectedActiveRunId: RUN_ID,
      character: HERO,
      service: { backup },
      now: () => '2026-08-26T12:00:00.000Z',
    });
    expect(backup).toHaveBeenCalledOnce();
    expect(backup.mock.calls[0][0]).toBe(HERO);
    expect(backup.mock.calls[0][1]).toEqual({ id: ACCOUNT });
    expect(backup.mock.calls[0][2]).toEqual({
      guestSelected: true,
      confirmedTargetAccountId: ACCOUNT,
    });
    expect(backup.mock.calls[0][3]).toEqual({
      originPlayerBackupRunId: RUN_ID,
    });
    expect(result).toEqual({ status: 'verified', row, fingerprint: 'fp' });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const stored = (await new Promise(resolve => {
      const request = database
        .transaction('meta', 'readonly')
        .objectStore('meta')
        .get(`player-backup-run:${RUN_ID}`);
      request.onsuccess = () => resolve(request.result);
    })) as PlayerBackupRunV1;
    database.close();
    expect(stored.characterCheckpoints['hero-a'].online).toMatchObject({
      state: 'protected',
      cloudId: 'cloud-a',
      serverVersion: 2,
      contentFingerprint: 'fp',
      verifiedAt: '2026-08-26T12:00:00.000Z',
    });
  });

  it('serializes rapid repeats through the account lock', async () => {
    const backup = vi.fn().mockResolvedValue({
      status: 'verified',
      row: {
        id: 'cloud-a',
        legacy_client_id: 'hero-a',
        server_version: 2,
      },
      fingerprint: 'fp',
    });
    const service = { backup, archive: vi.fn(), prepareRestore: vi.fn() };
    const options = {
      factory: indexedDB,
      locks: new QueuedLocks(),
      accountId: ACCOUNT,
      expectedActiveRunId: RUN_ID,
      character: HERO,
      service,
    };
    await Promise.all([
      backupPlayerBackupCharacterNow(options),
      backupPlayerBackupCharacterNow(options),
    ]);
    expect(backup).toHaveBeenCalledTimes(2);
  });

  it('pauses without deleting local data, online documents, or work identity', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const repository = new IndexedDbAutomaticCharacterSyncRepository(database);
    await repository.commit({
      namespace: NAMESPACE,
      legacyId: 'hero-a',
      operation: 'replace',
      payload: { id: 'hero-a' },
      schemaVersion: 1,
      localRevision: 1,
      baseServerVersion: 1,
      contentFingerprint: 'fp-1',
      syncPolicy: 'on',
      updatedAt: '2026-08-26T11:00:00.000Z',
      cloudId: 'cloud-a',
    });
    const before = await repository.getDocument(NAMESPACE, 'hero-a');
    const queued = await repository.listOutbox(NAMESPACE);
    database.close();

    const archive = vi.fn();
    await pausePlayerBackupCharacter({
      factory: indexedDB,
      locks: new QueuedLocks(),
      accountId: ACCOUNT,
      expectedActiveRunId: RUN_ID,
      legacyId: 'hero-a',
      service: { archive },
    });
    expect(archive).not.toHaveBeenCalled();

    const afterDb = await openRollkeeperDatabase({ factory: indexedDB });
    const afterRepo = new IndexedDbAutomaticCharacterSyncRepository(afterDb);
    const afterDoc = await afterRepo.getDocument(NAMESPACE, 'hero-a');
    const paused = (await afterRepo.listOutbox(NAMESPACE)).filter(
      entry => entry.legacyId === 'hero-a' && entry.state !== 'paused'
    );
    const policy =
      await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
        afterDb.transaction('meta', 'readonly').objectStore('meta'),
        NAMESPACE,
        'hero-a'
      );
    afterDb.close();
    expect(afterDoc).toEqual(before);
    expect(queued.length).toBeGreaterThan(0);
    expect(paused).toEqual([]);
    expect(policy).toBe('off');
  });

  it('resumes retained work without changing its identity and wakes the worker', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const repository = new IndexedDbAutomaticCharacterSyncRepository(database);
    const committed = await repository.commit({
      namespace: NAMESPACE,
      legacyId: 'hero-a',
      operation: 'replace',
      payload: { id: 'hero-a' },
      schemaVersion: 1,
      localRevision: 2,
      baseServerVersion: 1,
      contentFingerprint: 'fp-2',
      syncPolicy: 'on',
      updatedAt: '2026-08-26T11:00:00.000Z',
      cloudId: 'cloud-a',
    });
    await repository.pauseAggregate(NAMESPACE, 'hero-a');
    database.close();

    const wake = vi.fn().mockResolvedValue(undefined);
    await resumePlayerBackupCharacter({
      factory: indexedDB,
      locks: new QueuedLocks(),
      accountId: ACCOUNT,
      expectedActiveRunId: RUN_ID,
      legacyId: 'hero-a',
      wake,
    });
    expect(wake).toHaveBeenCalledOnce();

    const afterDb = await openRollkeeperDatabase({ factory: indexedDB });
    const afterRepo = new IndexedDbAutomaticCharacterSyncRepository(afterDb);
    const due = (await afterRepo.listOutbox(NAMESPACE)).filter(
      entry => entry.legacyId === 'hero-a'
    );
    const otherPolicy =
      await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
        afterDb.transaction('meta', 'readonly').objectStore('meta'),
        NAMESPACE,
        'hero-b'
      );
    afterDb.close();
    expect(due).toHaveLength(1);
    expect(due[0]?.mutationId).toBe(committed.mutationId);
    expect(otherPolicy).toBe('on');
  });

  it('changes only the account future default', async () => {
    await setPlayerBackupFutureDefault({
      factory: indexedDB,
      locks: new QueuedLocks(),
      accountId: ACCOUNT,
      expectedActiveRunId: RUN_ID,
      futureDefault: 'off',
      at: '2026-08-27T00:00:00.000Z',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const meta = database.transaction('meta', 'readonly').objectStore('meta');
    const account =
      await AutomaticCharacterSyncPreferences.readAccountDefaultInTransaction(
        meta,
        NAMESPACE
      );
    const heroA =
      await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
        meta,
        NAMESPACE,
        'hero-a'
      );
    const heroB =
      await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
        meta,
        NAMESPACE,
        'hero-b'
      );
    database.close();
    expect(account?.futureDefault).toBe('off');
    expect(heroA).toBe('on');
    expect(heroB).toBe('on');
  });

  it('soft-archives through the fenced manual service', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const transaction = database.transaction('documents', 'readwrite');
    transaction.objectStore('documents').put({
      namespace: NAMESPACE,
      family: 'character',
      legacyId: 'hero-a',
      cloudId: 'cloud-a',
      operation: 'replace',
      payload: HERO,
      schemaVersion: 1,
      localRevision: 5,
      baseServerVersion: 3,
      contentFingerprint: 'fp',
      deletedAt: null,
      syncPolicy: 'on',
      updatedAt: '2026-08-26T12:00:00.000Z',
    });
    await transactionComplete(transaction);
    database.close();
    const archive = vi.fn().mockResolvedValue({
      serverVersion: 4,
      deletedAt: '2026-08-27T00:00:00.000Z',
    });
    await archivePlayerBackupOnlineCopy({
      factory: indexedDB,
      locks: new QueuedLocks(),
      accountId: ACCOUNT,
      expectedActiveRunId: RUN_ID,
      cloudId: 'cloud-a',
      expectedServerVersion: 3,
      service: { archive },
    });
    expect(archive).toHaveBeenCalledWith('cloud-a', { id: ACCOUNT }, 3);
    const afterDatabase = await openRollkeeperDatabase({ factory: indexedDB });
    const repository = new IndexedDbAutomaticCharacterSyncRepository(
      afterDatabase
    );
    expect(await repository.getDocument(NAMESPACE, 'hero-a')).toMatchObject({
      baseServerVersion: 4,
      deletedAt: '2026-08-27T00:00:00.000Z',
      payload: HERO,
    });
    afterDatabase.close();
  });

  it('commits restore inside the fence and honors attachCloudLink', async () => {
    const add = vi.fn().mockReturnValue(true);
    const replace = vi.fn().mockReturnValue(true);
    const has = vi.fn().mockReturnValue(false);
    const persistRoster = vi.fn().mockResolvedValue({ saved: true });
    const attachLink = vi.fn();
    const link = {
      accountId: ACCOUNT,
      legacyId: 'hero-a',
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: 'fp',
      pendingMutation: null,
    };
    const prepareRestore = vi
      .fn()
      .mockResolvedValueOnce({
        plan: {
          kind: 'restore-original',
          character: { id: 'hero-a', name: 'Hero A' },
          attachCloudLink: true,
          reason: null,
        },
        link,
      })
      .mockResolvedValueOnce({
        plan: {
          kind: 'restore-copy',
          character: { id: 'hero-copy', name: 'Hero A (Cloud Copy)' },
          attachCloudLink: false,
          reason: null,
        },
        link,
      })
      .mockResolvedValueOnce({
        plan: {
          kind: 'attach-link',
          character: null,
          attachCloudLink: true,
          reason: null,
        },
        link,
      })
      .mockResolvedValueOnce({
        plan: {
          kind: 'quarantined',
          character: null,
          attachCloudLink: false,
          reason: 'unsupported',
        },
        link,
      });

    const base = {
      factory: indexedDB,
      locks: new QueuedLocks(),
      accountId: ACCOUNT,
      expectedActiveRunId: RUN_ID,
      cloudId: 'cloud-a',
      service: { prepareRestore },
      assertCurrent: vi.fn(),
      has,
      add,
      replace,
      persistRoster,
      attachLink,
    };

    await restorePlayerBackupCharacter({
      ...base,
      localCharacters: [],
      mode: 'original',
    });
    expect(add).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(persistRoster).toHaveBeenCalledOnce();
    expect(attachLink).toHaveBeenCalledWith(link);

    add.mockClear();
    persistRoster.mockClear();
    attachLink.mockClear();
    await restorePlayerBackupCharacter({
      ...base,
      localCharacters: [HERO],
      mode: 'copy',
    });
    expect(add).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(persistRoster).toHaveBeenCalledOnce();
    expect(attachLink).not.toHaveBeenCalled();

    add.mockClear();
    persistRoster.mockClear();
    attachLink.mockClear();
    await restorePlayerBackupCharacter({
      ...base,
      localCharacters: [HERO],
      mode: 'original',
    });
    expect(add).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(persistRoster).not.toHaveBeenCalled();
    expect(attachLink).toHaveBeenCalledWith(link);

    await expect(
      restorePlayerBackupCharacter({
        ...base,
        localCharacters: [HERO],
        mode: 'original',
      })
    ).rejects.toThrow('unsupported');
    expect(attachLink).toHaveBeenCalledTimes(1);
  });

  it('rejects a restore when the account changes before the local commit', async () => {
    let finishRestore!: (value: {
      plan: {
        kind: 'restore-original';
        character: { id: string; name: string; characterData: { id: string } };
        attachCloudLink: true;
        reason: null;
      };
      link: {
        accountId: string;
        legacyId: string;
        cloudId: string;
        serverVersion: number;
        contentFingerprint: string;
        pendingMutation: null;
      };
      recovery: never;
    }) => void;
    const prepareRestore = vi.fn(
      () =>
        new Promise<Parameters<typeof finishRestore>[0]>(resolve => {
          finishRestore = resolve;
        })
    );
    let current = true;
    const add = vi.fn().mockReturnValue(true);
    const restore = restorePlayerBackupCharacter({
      factory: indexedDB,
      locks: new QueuedLocks(),
      accountId: ACCOUNT,
      expectedActiveRunId: RUN_ID,
      cloudId: 'cloud-a',
      localCharacters: [],
      mode: 'original',
      service: { prepareRestore },
      assertCurrent: () => {
        if (!current) throw new PlayerBackupRunReplacedError();
      },
      has: () => false,
      add,
      replace: vi.fn().mockReturnValue(true),
      persistRoster: vi.fn().mockResolvedValue({ saved: true }),
      attachLink: vi.fn(),
    });
    await vi.waitFor(() => expect(prepareRestore).toHaveBeenCalledOnce());
    current = false;
    finishRestore({
      plan: {
        kind: 'restore-original',
        character: {
          id: 'hero-a',
          name: 'Hero A',
          characterData: { id: 'hero-a' },
        },
        attachCloudLink: true,
        reason: null,
      },
      link: {
        accountId: ACCOUNT,
        legacyId: 'hero-a',
        cloudId: 'cloud-a',
        serverVersion: 1,
        contentFingerprint: 'fp',
        pendingMutation: null,
      },
      recovery: {} as never,
    });
    await expect(restore).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);
    expect(add).not.toHaveBeenCalled();
  });

  it('fails closed when the roster or local persist refuses the restored character', async () => {
    const link = {
      accountId: ACCOUNT,
      legacyId: 'hero-a',
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: 'fp',
      pendingMutation: null,
    };
    const restored = {
      plan: {
        kind: 'restore-original' as const,
        character: { id: 'hero-a', name: 'Hero A' },
        attachCloudLink: true,
        reason: null,
      },
      link,
    };
    const prepareRestore = vi.fn().mockResolvedValue(restored);
    const base = {
      factory: indexedDB,
      locks: new QueuedLocks(),
      accountId: ACCOUNT,
      expectedActiveRunId: RUN_ID,
      cloudId: 'cloud-a',
      localCharacters: [HERO],
      mode: 'original' as const,
      service: { prepareRestore },
      assertCurrent: vi.fn(),
      attachLink: vi.fn(),
    };

    await expect(
      restorePlayerBackupCharacter({
        ...base,
        has: () => true,
        add: vi.fn(),
        replace: vi.fn().mockReturnValue(false),
        persistRoster: vi.fn(),
      })
    ).rejects.toThrow('Roster write was not accepted');
    expect(base.attachLink).not.toHaveBeenCalled();

    await expect(
      restorePlayerBackupCharacter({
        ...base,
        has: () => false,
        add: vi.fn().mockReturnValue(true),
        replace: vi.fn(),
        persistRoster: vi.fn().mockResolvedValue({ saved: false }),
      })
    ).rejects.toThrow('Restored character was not saved in this browser');
    expect(base.attachLink).not.toHaveBeenCalled();
  });

  it('fails closed for a quarantined restore without a reason', async () => {
    await expect(
      restorePlayerBackupCharacter({
        factory: indexedDB,
        locks: new QueuedLocks(),
        accountId: ACCOUNT,
        expectedActiveRunId: RUN_ID,
        cloudId: 'cloud-a',
        localCharacters: [HERO],
        mode: 'original',
        service: {
          prepareRestore: vi.fn().mockResolvedValue({
            plan: {
              kind: 'quarantined',
              character: null,
              attachCloudLink: false,
              reason: null,
            },
            link: {
              accountId: ACCOUNT,
              legacyId: 'hero-a',
              cloudId: 'cloud-a',
              serverVersion: 1,
              contentFingerprint: 'fp',
              pendingMutation: null,
            },
          }),
        },
        assertCurrent: vi.fn(),
        has: () => false,
        add: vi.fn(),
        replace: vi.fn(),
        persistRoster: vi.fn(),
        attachLink: vi.fn(),
      })
    ).rejects.toThrow('Cloud restore is not supported');
  });

  describe('restore without an active run', () => {
    const LINK = {
      accountId: ACCOUNT,
      legacyId: 'hero-a',
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: 'fp',
      pendingMutation: null,
    };

    beforeEach(async () => {
      await deleteRollkeeperDatabaseForTests(indexedDB);
    });

    function originalPlan(characterId = 'hero-a') {
      return {
        plan: {
          kind: 'restore-original' as const,
          character: {
            id: characterId,
            name: 'Hero A',
            characterData: { id: characterId },
          },
          attachCloudLink: true,
          reason: null,
        },
        link: { ...LINK, legacyId: characterId },
        recovery: {} as never,
      };
    }

    it('restores the original ID when no local run exists', async () => {
      const add = vi.fn().mockReturnValue(true);
      const replace = vi.fn();
      const persistRoster = vi.fn().mockResolvedValue({ saved: true });
      const attachLink = vi.fn();
      await restorePlayerBackupCharacterWithoutRun({
        factory: indexedDB,
        locks: new QueuedLocks(),
        accountId: ACCOUNT,
        cloudId: 'cloud-a',
        localCharacters: [],
        mode: 'original',
        service: { prepareRestore: vi.fn().mockResolvedValue(originalPlan()) },
        assertCurrent: vi.fn(),
        has: () => false,
        add,
        replace,
        persistRoster,
        attachLink,
      });
      expect(add).toHaveBeenCalledOnce();
      expect(add.mock.calls[0][0]).toMatchObject({ id: 'hero-a' });
      expect(replace).not.toHaveBeenCalled();
      expect(persistRoster).toHaveBeenCalledOnce();
      expect(attachLink).toHaveBeenCalledOnce();
    });

    it('throws replaced when a valid run already exists', async () => {
      await seedRun();
      const prepareRestore = vi.fn();
      const add = vi.fn();
      await expect(
        restorePlayerBackupCharacterWithoutRun({
          factory: indexedDB,
          locks: new QueuedLocks(),
          accountId: ACCOUNT,
          cloudId: 'cloud-a',
          localCharacters: [],
          mode: 'original',
          service: { prepareRestore },
          assertCurrent: vi.fn(),
          has: () => false,
          add,
          replace: vi.fn(),
          persistRoster: vi.fn(),
          attachLink: vi.fn(),
        })
      ).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);
      expect(prepareRestore).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });

    it('adds a colliding restore as a distinct unsynced copy', async () => {
      const copy = {
        plan: {
          kind: 'restore-copy' as const,
          character: {
            id: 'hero-a-copy',
            name: 'Hero A',
            characterData: { id: 'hero-a-copy' },
          },
          attachCloudLink: false,
          reason: null,
        },
        link: LINK,
        recovery: {} as never,
      };
      const add = vi.fn().mockReturnValue(true);
      const replace = vi.fn();
      await restorePlayerBackupCharacterWithoutRun({
        factory: indexedDB,
        locks: new QueuedLocks(),
        accountId: ACCOUNT,
        cloudId: 'cloud-a',
        localCharacters: [HERO],
        mode: 'original',
        service: { prepareRestore: vi.fn().mockResolvedValue(copy) },
        assertCurrent: vi.fn(),
        has: id => id === 'hero-a',
        add,
        replace,
        persistRoster: vi.fn().mockResolvedValue({ saved: true }),
        attachLink: vi.fn(),
      });
      expect(add).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hero-a-copy' })
      );
      expect(replace).not.toHaveBeenCalled();
    });

    it('sees a run created by a queued lock holder and does not write unfenced', async () => {
      const locks = new QueuedLocks();
      let releaseHolder!: () => void;
      let holderReady!: () => void;
      const holderStarted = new Promise<void>(resolve => {
        holderReady = resolve;
      });
      const holder = locks.request(
        playerBackupAccountLockName(ACCOUNT),
        { mode: 'exclusive' },
        async () => {
          await seedRun();
          holderReady();
          await new Promise<void>(resolve => {
            releaseHolder = resolve;
          });
        }
      );
      await holderStarted;
      const prepareRestore = vi.fn().mockResolvedValue(originalPlan());
      const add = vi.fn();
      const restore = restorePlayerBackupCharacterWithoutRun({
        factory: indexedDB,
        locks,
        accountId: ACCOUNT,
        cloudId: 'cloud-a',
        localCharacters: [],
        mode: 'original',
        service: { prepareRestore },
        assertCurrent: vi.fn(),
        has: () => false,
        add,
        replace: vi.fn(),
        persistRoster: vi.fn(),
        attachLink: vi.fn(),
      });
      await Promise.resolve();
      expect(prepareRestore).not.toHaveBeenCalled();
      releaseHolder();
      await expect(restore).rejects.toBeInstanceOf(
        PlayerBackupRunReplacedError
      );
      expect(prepareRestore).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
      await holder;
    });

    it('fails closed into recovery for a dangling pointer', async () => {
      const database = await openRollkeeperDatabase({ factory: indexedDB });
      const transaction = database.transaction('meta', 'readwrite');
      transaction.objectStore('meta').put({
        key: playerBackupActiveRunKey(ACCOUNT),
        runId: 'run-missing',
        accountId: ACCOUNT,
      });
      await transactionComplete(transaction);
      database.close();
      const prepareRestore = vi.fn();
      const add = vi.fn();
      await expect(
        restorePlayerBackupCharacterWithoutRun({
          factory: indexedDB,
          locks: new QueuedLocks(),
          accountId: ACCOUNT,
          cloudId: 'cloud-a',
          localCharacters: [],
          mode: 'original',
          service: { prepareRestore },
          assertCurrent: vi.fn(),
          has: () => false,
          add,
          replace: vi.fn(),
          persistRoster: vi.fn(),
          attachLink: vi.fn(),
        })
      ).rejects.toBeInstanceOf(PlayerBackupActiveRunPointerCorruptError);
      expect(prepareRestore).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });

    it('fails closed into recovery for a malformed pointer', async () => {
      const database = await openRollkeeperDatabase({ factory: indexedDB });
      const transaction = database.transaction('meta', 'readwrite');
      transaction.objectStore('meta').put({
        key: playerBackupActiveRunKey(ACCOUNT),
        runId: 12,
        accountId: ACCOUNT,
      });
      await transactionComplete(transaction);
      database.close();
      const add = vi.fn();
      await expect(
        restorePlayerBackupCharacterWithoutRun({
          factory: indexedDB,
          locks: new QueuedLocks(),
          accountId: ACCOUNT,
          cloudId: 'cloud-a',
          localCharacters: [],
          mode: 'original',
          service: { prepareRestore: vi.fn() },
          assertCurrent: vi.fn(),
          has: () => false,
          add,
          replace: vi.fn(),
          persistRoster: vi.fn(),
          attachLink: vi.fn(),
        })
      ).rejects.toBeInstanceOf(PlayerBackupActiveRunPointerCorruptError);
      expect(add).not.toHaveBeenCalled();
    });

    it('fails closed into recovery for a wrong-account pointer', async () => {
      const database = await openRollkeeperDatabase({ factory: indexedDB });
      const transaction = database.transaction('meta', 'readwrite');
      transaction.objectStore('meta').put({
        key: playerBackupActiveRunKey(ACCOUNT),
        runId: 'run-a',
        accountId: 'account-b',
      });
      await transactionComplete(transaction);
      database.close();
      const add = vi.fn();
      await expect(
        restorePlayerBackupCharacterWithoutRun({
          factory: indexedDB,
          locks: new QueuedLocks(),
          accountId: ACCOUNT,
          cloudId: 'cloud-a',
          localCharacters: [],
          mode: 'original',
          service: { prepareRestore: vi.fn() },
          assertCurrent: vi.fn(),
          has: () => false,
          add,
          replace: vi.fn(),
          persistRoster: vi.fn(),
          attachLink: vi.fn(),
        })
      ).rejects.toBeInstanceOf(PlayerBackupActiveRunPointerCorruptError);
      expect(add).not.toHaveBeenCalled();
    });

    it('rejects a no-run restore when the account changes before the local commit', async () => {
      let finishRestore!: (value: ReturnType<typeof originalPlan>) => void;
      const prepareRestore = vi.fn(
        () =>
          new Promise<ReturnType<typeof originalPlan>>(resolve => {
            finishRestore = resolve;
          })
      );
      let current = true;
      const add = vi.fn().mockReturnValue(true);
      const persistRoster = vi.fn().mockResolvedValue({ saved: true });
      const attachLink = vi.fn();
      const restore = restorePlayerBackupCharacterWithoutRun({
        factory: indexedDB,
        locks: new QueuedLocks(),
        accountId: ACCOUNT,
        cloudId: 'cloud-a',
        localCharacters: [],
        mode: 'original',
        service: { prepareRestore },
        assertCurrent: () => {
          if (!current) throw new PlayerBackupRunReplacedError();
        },
        has: () => false,
        add,
        replace: vi.fn().mockReturnValue(true),
        persistRoster,
        attachLink,
      });
      await vi.waitFor(() => expect(prepareRestore).toHaveBeenCalledOnce());
      current = false;
      finishRestore(originalPlan());
      await expect(restore).rejects.toBeInstanceOf(
        PlayerBackupRunReplacedError
      );
      expect(add).not.toHaveBeenCalled();
      expect(persistRoster).not.toHaveBeenCalled();
      expect(attachLink).not.toHaveBeenCalled();
    });

    it('leaves storage unchanged when prepareRestore fails', async () => {
      const add = vi.fn();
      const persistRoster = vi.fn();
      const attachLink = vi.fn();
      await expect(
        restorePlayerBackupCharacterWithoutRun({
          factory: indexedDB,
          locks: new QueuedLocks(),
          accountId: ACCOUNT,
          cloudId: 'cloud-a',
          localCharacters: [],
          mode: 'original',
          service: {
            prepareRestore: vi.fn().mockRejectedValue(new Error('auth')),
          },
          assertCurrent: vi.fn(),
          has: () => false,
          add,
          replace: vi.fn(),
          persistRoster,
          attachLink,
        })
      ).rejects.toThrow('auth');
      expect(add).not.toHaveBeenCalled();
      expect(persistRoster).not.toHaveBeenCalled();
      expect(attachLink).not.toHaveBeenCalled();
    });
  });
});
