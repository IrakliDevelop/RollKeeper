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
import { PlayerBackupLockUnavailableError } from '../playerBackupRunFence';
import { PlayerBackupRunReplacedError } from '../playerBackupRunRepository';
import type { PlayerBackupRunV1 } from '../playerBackupRunRepository';
import {
  archivePlayerBackupOnlineCopy,
  backupPlayerBackupCharacterNow,
  pausePlayerBackupCharacter,
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
    const row = { id: 'cloud-a', legacy_client_id: 'hero-a' };
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
  });

  it('reuses one mutation identity across rapid repeats', async () => {
    const backup = vi.fn().mockResolvedValue({
      status: 'verified',
      row: { id: 'cloud-a' },
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
  });
});
