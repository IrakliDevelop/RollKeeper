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
});
