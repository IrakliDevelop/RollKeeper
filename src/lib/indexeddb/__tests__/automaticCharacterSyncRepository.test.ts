import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';
import {
  IndexedDbAutomaticCharacterSyncRepository,
  type AutomaticCharacterMutation,
} from '../automaticCharacterSyncRepository';

const NAMESPACE = 'user:account-a' as const;

function mutation(
  overrides: Partial<AutomaticCharacterMutation> = {}
): AutomaticCharacterMutation {
  return {
    namespace: NAMESPACE,
    legacyId: 'character-a',
    operation: 'replace',
    payload: { id: 'character-a', name: 'Aster' },
    schemaVersion: 1,
    localRevision: 1,
    baseServerVersion: 0,
    contentFingerprint: 'fingerprint-1',
    syncPolicy: 'on',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('IndexedDbAutomaticCharacterSyncRepository', () => {
  let database: IDBDatabase;
  let mutationNumber: number;

  beforeEach(async () => {
    database = await openRollkeeperDatabase();
    mutationNumber = 0;
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  const repository = () =>
    new IndexedDbAutomaticCharacterSyncRepository(database, {
      randomId: () => `mutation-${++mutationNumber}`,
    });

  it('atomically commits the local document and outbox before acknowledging saved', async () => {
    const result = await repository().commit(mutation());
    expect(result).toMatchObject({ saved: true, mutationId: 'mutation-1' });

    const read = database.transaction(['documents', 'outbox'], 'readonly');
    const document = await requestResult(
      read.objectStore('documents').get([NAMESPACE, 'character', 'character-a'])
    );
    const outbox = await requestResult(
      read.objectStore('outbox').get('mutation-1')
    );
    await transactionComplete(read);
    expect(document).toMatchObject({
      localRevision: 1,
      payload: { name: 'Aster' },
    });
    expect(outbox).toMatchObject({ state: 'queued', localRevision: 1 });
  });

  it('acknowledges neither document nor outbox when the transaction aborts or quota fails', async () => {
    const aborted = await repository().commit(mutation(), {
      abortTransaction: true,
    });
    expect(aborted.saved).toBe(false);

    const failed = new IndexedDbAutomaticCharacterSyncRepository(database, {
      randomId: () => 'mutation-quota',
      beforeCommit: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    });
    await expect(failed.commit(mutation())).resolves.toMatchObject({
      saved: false,
    });
    await expect(repository().listOutbox(NAMESPACE)).resolves.toEqual([]);
  });

  it('coalesces only queued never-sent snapshots and preserves inflight work', async () => {
    const repo = repository();
    await repo.commit(mutation());
    await repo.commit(
      mutation({ localRevision: 2, contentFingerprint: 'fingerprint-2' })
    );
    expect(await repo.listOutbox(NAMESPACE)).toEqual([
      expect.objectContaining({ mutationId: 'mutation-2', localRevision: 2 }),
    ]);

    await repo.markInflight('mutation-2');
    await repo.commit(
      mutation({ localRevision: 3, contentFingerprint: 'fingerprint-3' })
    );
    expect(await repo.listOutbox(NAMESPACE)).toEqual([
      expect.objectContaining({ mutationId: 'mutation-2', state: 'inflight' }),
      expect.objectContaining({ mutationId: 'mutation-3', state: 'queued' }),
    ]);
  });

  it('reclaims a crashed writer inflight lease without replacing its mutation identity', async () => {
    const repo = repository();
    await repo.commit(mutation());
    await repo.markInflight('mutation-1');
    const [inflight] = await repo.listOutbox(NAMESPACE);
    const claimedAt = Date.parse(inflight.inflightAt!);

    await expect(
      repo.nextRunnable(NAMESPACE, claimedAt + 29_999)
    ).resolves.toBeNull();
    await expect(
      repo.nextRunnable(NAMESPACE, claimedAt, true)
    ).resolves.toMatchObject({ mutationId: 'mutation-1' });
    await expect(
      repo.nextRunnable(NAMESPACE, claimedAt + 30_000)
    ).resolves.toMatchObject({
      mutationId: 'mutation-1',
      state: 'inflight',
    });
  });

  it('commits a recoverable tombstone with delete work and rejects stale resurrection', async () => {
    const repo = repository();
    await repo.commit(mutation());
    await repo.commit(
      mutation({
        operation: 'delete',
        localRevision: 2,
        payload: null,
        contentFingerprint: 'deleted',
      })
    );

    await expect(
      repo.getTombstone(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      localRevision: 2,
      beforeImage: expect.objectContaining({
        payload: expect.objectContaining({ name: 'Aster' }),
      }),
    });
    await expect(
      repo.commit(
        mutation({
          localRevision: 3,
          payload: { id: 'character-a', name: 'stale' },
        })
      )
    ).resolves.toMatchObject({ saved: false, reason: 'tombstoned' });
  });

  it('keeps namespaces isolated and makes work resumable without BroadcastChannel', async () => {
    const repo = repository();
    await repo.commit(mutation());
    await repo.commit(
      mutation({ namespace: 'user:account-b', legacyId: 'character-b' })
    );

    await expect(repo.listOutbox(NAMESPACE)).resolves.toHaveLength(1);
    await expect(repo.listOutbox('user:account-b')).resolves.toHaveLength(1);
    await expect(
      repo.nextRunnable(NAMESPACE, Date.parse('2026-02-01T00:00:01Z'))
    ).resolves.toMatchObject({ legacyId: 'character-a' });
  });

  it('never commits guest work and safely handles absent records', async () => {
    const repo = new IndexedDbAutomaticCharacterSyncRepository(database);
    await expect(
      repo.commit(mutation({ namespace: 'guest' }))
    ).resolves.toEqual({
      saved: false,
      reason: 'guest',
    });
    await expect(repo.getDocument(NAMESPACE, 'missing')).resolves.toBeNull();
    await expect(repo.getTombstone(NAMESPACE, 'missing')).resolves.toBeNull();
    await expect(repo.nextRunnable(NAMESPACE, 0)).resolves.toBeNull();
    await expect(repo.markInflight('missing')).resolves.toBeUndefined();
    await expect(
      repo.updateWork('missing', { state: 'failed' })
    ).resolves.toBeUndefined();
    await expect(repo.hasParticipants(NAMESPACE)).resolves.toBe(false);
  });

  it('durably transitions retry, auth, pause, and resume states without touching other accounts', async () => {
    const repo = repository();
    const first = await repo.commit(mutation());
    const second = await repo.commit(
      mutation({ namespace: 'user:account-b', legacyId: 'character-b' })
    );
    await repo.updateWork(first.mutationId!, {
      state: 'retry',
      nextAttemptAt: 5_000,
      lastError: 'temporary',
    });
    await expect(repo.nextRunnable(NAMESPACE, 4_999)).resolves.toBeNull();
    await repo.retryNow(NAMESPACE, 'character-a');
    await expect(repo.nextRunnable(NAMESPACE, 0)).resolves.toMatchObject({
      state: 'queued',
      lastError: null,
    });

    await repo.updateWork(first.mutationId!, { state: 'auth-required' });
    await repo.updateWork(second.mutationId!, { state: 'auth-required' });
    await repo.resumeAfterAuthentication(NAMESPACE);
    await expect(repo.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ state: 'queued' }),
    ]);
    await expect(repo.listOutbox('user:account-b')).resolves.toEqual([
      expect.objectContaining({ state: 'auth-required' }),
    ]);

    await repo.updateWork(first.mutationId!, { state: 'offline' });
    await repo.pauseAggregate(NAMESPACE, 'character-a');
    await expect(repo.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ state: 'paused', pausedFromState: 'offline' }),
    ]);
    await repo.resumeAggregate(NAMESPACE, 'character-a');
    await expect(repo.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ state: 'offline' }),
    ]);
  });

  it('tracks participation, conflicts, quarantine, and cloud acknowledgement by namespace', async () => {
    const repo = repository();
    const committed = await repo.commit(mutation());
    expect(await repo.hasParticipants(NAMESPACE)).toBe(true);
    expect(await repo.listDocuments(NAMESPACE)).toHaveLength(1);

    const [entry] = await repo.listOutbox(NAMESPACE);
    await repo.preserveConflict(
      entry,
      { id: 'cloud-a' },
      '2026-02-02T00:00:00Z'
    );
    await expect(repo.listConflicts(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ legacyId: 'character-a' }),
    ]);
    await expect(repo.listConflicts('user:account-b')).resolves.toEqual([]);

    await repo.quarantineCloudCandidate(
      NAMESPACE,
      'character-a',
      { id: 'unsafe' },
      'unsafe candidate',
      '2026-02-02T00:00:00Z'
    );
    await expect(repo.listQuarantine(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ reason: 'unsafe candidate' }),
    ]);
    await expect(repo.listQuarantine('user:account-b')).resolves.toEqual([]);

    await repo.acknowledge(entry, 'cloud-a', 2);
    expect(committed.mutationId).toBe(entry.mutationId);
    await expect(repo.listOutbox(NAMESPACE)).resolves.toEqual([]);
    await expect(
      repo.getDocument(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      cloudId: 'cloud-a',
      baseServerVersion: 2,
    });
  });

  it('writes origin-aware initial work inside a caller transaction and preserves the origin through work transitions', async () => {
    const repo = repository();
    const transaction = database.transaction(
      ['documents', 'outbox', 'tombstones'],
      'readwrite'
    );
    const result = await repo.writeMutationInTransaction(
      transaction,
      mutation({ originPlayerBackupRunId: 'run-a' }),
      { mutationId: 'mutation-run-a' }
    );
    await transactionComplete(transaction);
    expect(result).toEqual({ saved: true, mutationId: 'mutation-run-a' });

    const read = database.transaction(['documents', 'outbox'], 'readonly');
    const document = await requestResult(
      read.objectStore('documents').get([NAMESPACE, 'character', 'character-a'])
    );
    const outbox = await requestResult(
      read.objectStore('outbox').get('mutation-run-a')
    );
    await transactionComplete(read);
    expect(document).toMatchObject({ originPlayerBackupRunId: 'run-a' });
    expect(outbox).toMatchObject({ originPlayerBackupRunId: 'run-a' });

    await repo.updateWork('mutation-run-a', {
      state: 'retry',
      nextAttemptAt: 1_000,
      lastError: 'temporary',
    });
    await expect(repo.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        originPlayerBackupRunId: 'run-a',
        state: 'retry',
      }),
    ]);

    await repo.markInflight('mutation-run-a');
    await expect(repo.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        originPlayerBackupRunId: 'run-a',
        state: 'inflight',
      }),
    ]);

    const [entry] = await repo.listOutbox(NAMESPACE);
    await repo.preserveConflict(
      entry,
      { id: 'cloud-a' },
      '2026-02-02T00:00:00Z'
    );
    await expect(repo.listConflicts(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        localCandidate: expect.objectContaining({
          originPlayerBackupRunId: 'run-a',
        }),
      }),
    ]);

    await repo.acknowledge(entry, 'cloud-a', 2);
    await expect(
      repo.getDocument(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      originPlayerBackupRunId: 'run-a',
      cloudId: 'cloud-a',
      baseServerVersion: 2,
    });
  });

  it('aborting the caller transaction leaves no document or outbox entry', async () => {
    const repo = repository();
    const transaction = database.transaction(
      ['documents', 'outbox', 'tombstones'],
      'readwrite'
    );
    const completion = transactionComplete(transaction);
    const result = await repo.writeMutationInTransaction(
      transaction,
      mutation(),
      { mutationId: 'mutation-abort' }
    );
    expect(result).toEqual({ saved: true, mutationId: 'mutation-abort' });
    transaction.abort();
    await expect(completion).rejects.toThrow();

    const read = database.transaction(['documents', 'outbox'], 'readonly');
    const document = await requestResult(
      read.objectStore('documents').get([NAMESPACE, 'character', 'character-a'])
    );
    const outbox = await requestResult(
      read.objectStore('outbox').get('mutation-abort')
    );
    await transactionComplete(read);
    expect(document).toBeUndefined();
    expect(outbox).toBeUndefined();
  });

  it('refuses guest and tombstoned aggregates inside a caller transaction without writing', async () => {
    const repo = repository();

    const guestTransaction = database.transaction(
      ['documents', 'outbox', 'tombstones'],
      'readwrite'
    );
    await expect(
      repo.writeMutationInTransaction(
        guestTransaction,
        mutation({ namespace: 'guest' }),
        { mutationId: 'mutation-guest' }
      )
    ).resolves.toEqual({ saved: false, reason: 'guest' });
    await transactionComplete(guestTransaction);

    await repo.commit(mutation());
    await repo.commit(
      mutation({
        operation: 'delete',
        localRevision: 2,
        payload: null,
        contentFingerprint: 'deleted',
      })
    );

    const tombstoneTransaction = database.transaction(
      ['documents', 'outbox', 'tombstones'],
      'readwrite'
    );
    await expect(
      repo.writeMutationInTransaction(
        tombstoneTransaction,
        mutation({
          localRevision: 3,
          payload: { id: 'character-a', name: 'stale' },
        }),
        { mutationId: 'mutation-stale' }
      )
    ).resolves.toEqual({ saved: false, reason: 'tombstoned' });
    await transactionComplete(tombstoneTransaction);

    const outbox = await repo.listOutbox(NAMESPACE);
    expect(
      outbox.find(entry => entry.mutationId === 'mutation-stale')
    ).toBeUndefined();
    expect(
      outbox.find(entry => entry.mutationId === 'mutation-guest')
    ).toBeUndefined();
  });

  describe('in-transaction conflict helpers', () => {
    it('preserves a conflict on the caller transaction and stamps the origin run', async () => {
      const repo = repository();
      await repo.commit(mutation());
      const [entry] = await repo.listOutbox(NAMESPACE);

      const transaction = database.transaction(
        ['documents', 'outbox', 'conflicts'],
        'readwrite'
      );
      const stored = await repo.preserveConflictInTransaction(
        transaction,
        entry,
        { id: 'cloud-a' },
        '2026-01-01T00:00:00.000Z',
        { originPlayerBackupRunId: 'run-a' }
      );
      await transactionComplete(transaction);

      expect(stored.originPlayerBackupRunId).toBe('run-a');
      const conflicts = await repo.listConflicts(NAMESPACE);
      expect(conflicts).toEqual([stored]);
      await expect(repo.listOutbox(NAMESPACE)).resolves.toEqual([
        expect.objectContaining({ state: 'conflict' }),
      ]);
    });

    it('writes no origin key and identical records through preserveConflict', async () => {
      const repo = repository();
      await repo.commit(mutation());
      const [entry] = await repo.listOutbox(NAMESPACE);
      await repo.preserveConflict(
        entry,
        { id: 'cloud-a' },
        '2026-02-02T00:00:00Z'
      );

      const [conflict] = await repo.listConflicts(NAMESPACE);
      expect(Object.keys(conflict)).not.toContain('originPlayerBackupRunId');
      expect(conflict).toEqual({
        conflictId: `automatic-sync:${entry.mutationId}`,
        namespace: NAMESPACE,
        family: 'character',
        legacyId: 'character-a',
        mutationId: entry.mutationId,
        localCandidate: expect.objectContaining({ legacyId: 'character-a' }),
        cloudCandidate: { id: 'cloud-a' },
        detectedAt: '2026-02-02T00:00:00Z',
        resolutionState: 'unresolved',
      });
    });

    it('leaves nothing behind when the caller aborts', async () => {
      const repo = repository();
      await repo.commit(mutation());
      const [entry] = await repo.listOutbox(NAMESPACE);

      const transaction = database.transaction(
        ['documents', 'outbox', 'conflicts'],
        'readwrite'
      );
      const completion = transactionComplete(transaction);
      await repo.preserveConflictInTransaction(
        transaction,
        entry,
        { id: 'cloud-a' },
        '2026-01-01T00:00:00.000Z'
      );
      transaction.abort();
      await expect(completion).rejects.toThrow();

      await expect(repo.listConflicts(NAMESPACE)).resolves.toEqual([]);
      await expect(repo.listOutbox(NAMESPACE)).resolves.toEqual([
        expect.objectContaining({ state: 'queued' }),
      ]);
    });

    it('lists conflicts by namespace inside a transaction', async () => {
      const repo = repository();
      await repo.commit(mutation());
      await repo.commit(
        mutation({ namespace: 'user:account-b', legacyId: 'character-b' })
      );
      for (const entry of [
        ...(await repo.listOutbox(NAMESPACE)),
        ...(await repo.listOutbox('user:account-b')),
      ]) {
        await repo.preserveConflict(
          entry,
          { id: 'cloud-a' },
          '2026-02-02T00:00:00Z'
        );
      }

      const transaction = database.transaction('conflicts', 'readonly');
      await expect(
        repo.listConflictsInTransaction(transaction, NAMESPACE)
      ).resolves.toEqual([
        expect.objectContaining({ legacyId: 'character-a' }),
      ]);
      await expect(
        repo.listConflictsInTransaction(transaction, 'user:account-b')
      ).resolves.toEqual([
        expect.objectContaining({ legacyId: 'character-b' }),
      ]);
      await transactionComplete(transaction);
    });

    it('refreshes only an unresolved conflict candidate', async () => {
      const repo = repository();
      await repo.commit(mutation());
      const [entry] = await repo.listOutbox(NAMESPACE);
      await repo.preserveConflict(
        entry,
        { id: 'cloud-a' },
        '2026-02-02T00:00:00Z'
      );
      const conflictId = `automatic-sync:${entry.mutationId}`;

      const refreshTransaction = database.transaction('conflicts', 'readwrite');
      const refreshed = await repo.refreshConflictCloudCandidateInTransaction(
        refreshTransaction,
        conflictId,
        { id: 'cloud-a', server_version: 4 },
        '2026-02-03T00:00:00.000Z'
      );
      await transactionComplete(refreshTransaction);
      expect(refreshed).toMatchObject({
        conflictId,
        cloudCandidate: { id: 'cloud-a', server_version: 4 },
        detectedAt: '2026-02-03T00:00:00.000Z',
        resolutionState: 'unresolved',
      });
      await expect(repo.listConflicts(NAMESPACE)).resolves.toEqual([refreshed]);

      const resolveTransaction = database.transaction('conflicts', 'readwrite');
      resolveTransaction
        .objectStore('conflicts')
        .put({ ...refreshed, resolutionState: 'resolved' });
      await transactionComplete(resolveTransaction);

      const rejected = database.transaction('conflicts', 'readwrite');
      await expect(
        repo.refreshConflictCloudCandidateInTransaction(
          rejected,
          conflictId,
          { id: 'cloud-a', server_version: 5 },
          '2026-02-04T00:00:00.000Z'
        )
      ).rejects.toThrow('Conflict is not unresolved');

      const missing = database.transaction('conflicts', 'readwrite');
      await expect(
        repo.refreshConflictCloudCandidateInTransaction(
          missing,
          'automatic-sync:missing',
          { id: 'cloud-a' },
          '2026-02-04T00:00:00.000Z'
        )
      ).rejects.toThrow('Conflict is not unresolved');
    });

    it('quarantines on the caller transaction with the same record as quarantineCloudCandidate', async () => {
      const repo = repository();
      const transaction = database.transaction('quarantine', 'readwrite');
      repo.quarantineCloudCandidateInTransaction(
        transaction,
        NAMESPACE,
        'character-a',
        { id: 'unsafe' },
        'unsafe candidate',
        '2026-02-02T00:00:00Z'
      );
      await transactionComplete(transaction);
      const fromTransaction = await repo.listQuarantine(NAMESPACE);

      await repo.quarantineCloudCandidate(
        NAMESPACE,
        'character-a',
        { id: 'unsafe' },
        'unsafe candidate',
        '2026-02-02T00:00:00Z'
      );
      await expect(repo.listQuarantine(NAMESPACE)).resolves.toEqual(
        fromTransaction
      );
      expect(fromTransaction).toEqual([
        expect.objectContaining({
          quarantineId: `automatic-sync-pull:${NAMESPACE}:character-a`,
          rawValue: JSON.stringify({ id: 'unsafe' }),
        }),
      ]);
    });

    it('writes an acknowledged document without outbox work', async () => {
      const repo = repository();
      const transaction = database.transaction('documents', 'readwrite');
      repo.writeAcknowledgedDocumentInTransaction(transaction, {
        ...mutation(),
        cloudId: 'cloud-1',
        baseServerVersion: 3,
      });
      await transactionComplete(transaction);

      await expect(
        repo.getDocument(NAMESPACE, 'character-a')
      ).resolves.toMatchObject({
        family: 'character',
        cloudId: 'cloud-1',
        baseServerVersion: 3,
        deletedAt: null,
      });
      await expect(repo.listOutbox(NAMESPACE)).resolves.toEqual([]);

      const rejected = database.transaction('documents', 'readwrite');
      expect(() =>
        repo.writeAcknowledgedDocumentInTransaction(rejected, {
          ...mutation(),
          cloudId: 'cloud-1',
          baseServerVersion: 0,
        })
      ).toThrow('Acknowledged document requires a server version');
      await transactionComplete(rejected);
    });
  });
});
