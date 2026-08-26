import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CombatLogArchivePayload } from '@/lib/durableDm/combatLogArchiveFamily';

import {
  IndexedDbCombatLogArchiveRepository,
  type CombatLogArchiveMutation,
} from '../combatLogArchiveRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

const NAMESPACE = 'user:account-a' as const;

function payload(
  overrides: Partial<CombatLogArchivePayload> = {}
): CombatLogArchivePayload {
  return {
    encounterId: 'encounter-aaa111',
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T01:00:00.000Z',
    ...overrides,
  };
}

function mutation(
  overrides: Partial<CombatLogArchiveMutation> = {}
): CombatLogArchiveMutation {
  return {
    namespace: NAMESPACE,
    campaignId: 'campaign-a',
    legacyId: 'archive-aaa111',
    cutoverEpoch: 1,
    operation: 'replace',
    payload: payload(),
    schemaVersion: 2,
    localRevision: 1,
    baseServerVersion: 1,
    contentFingerprint: 'a'.repeat(64),
    updatedAt: '2026-08-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('IndexedDbCombatLogArchiveRepository', () => {
  let database: IDBDatabase;
  let counter: number;

  beforeEach(async () => {
    database = await openRollkeeperDatabase();
    counter = 0;
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  const repository = () =>
    new IndexedDbCombatLogArchiveRepository(database, {
      randomId: () => `mutation-${++counter}`,
    });

  it('atomically commits working document and durable outbox', async () => {
    await expect(repository().commit(mutation())).resolves.toEqual({
      saved: true,
      mutationId: 'mutation-1',
    });
    const transaction = database.transaction(
      ['documents', 'outbox'],
      'readonly'
    );
    expect(
      await requestResult(
        transaction
          .objectStore('documents')
          .get([NAMESPACE, 'combat_log_archive', 'archive-aaa111'])
      )
    ).toMatchObject({ localRevision: 1, campaignId: 'campaign-a' });
    expect(
      await requestResult(transaction.objectStore('outbox').get('mutation-1'))
    ).toMatchObject({
      family: 'combat_log_archive',
      state: 'queued',
    });
    await transactionComplete(transaction);
  });

  it('round trips create, replace and delete for one archive', async () => {
    const repo = repository();
    const created = await repo.commit(
      mutation({
        operation: 'create',
        payload: payload({ endedAt: undefined }),
      })
    );
    if (!created.saved) throw new Error('expected local save');
    await expect(
      repo.getDocument(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({
      operation: 'create',
      localRevision: 1,
      deletedAt: null,
      payload: { endedAt: undefined, events: [] },
    });

    const replaced = await repo.commit(
      mutation({
        operation: 'replace',
        localRevision: 2,
        contentFingerprint: 'b'.repeat(64),
        payload: payload({ endedAt: '2026-01-01T02:00:00.000Z' }),
      })
    );
    if (!replaced.saved) throw new Error('expected local save');
    await expect(
      repo.getDocument(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({
      operation: 'replace',
      localRevision: 2,
      deletedAt: null,
      payload: { endedAt: '2026-01-01T02:00:00.000Z' },
    });

    const deleted = await repo.commit(
      mutation({
        operation: 'delete',
        payload: null,
        localRevision: 3,
        contentFingerprint: 'c'.repeat(64),
        updatedAt: '2026-08-25T03:00:00.000Z',
      })
    );
    if (!deleted.saved) throw new Error('expected local save');
    // A delete keeps the row addressable but strips the payload, and the
    // matching tombstone is what makes the archive tombstoned.
    await expect(
      repo.getDocument(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({
      operation: 'delete',
      payload: null,
      deletedAt: '2026-08-25T03:00:00.000Z',
    });
    await expect(
      repo.getTombstone(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({
      family: 'combat_log_archive',
      localRevision: 3,
      deletedAt: '2026-08-25T03:00:00.000Z',
      mutationId: deleted.mutationId,
      beforeImage: expect.objectContaining({
        payload: payload({ endedAt: '2026-01-01T02:00:00.000Z' }),
      }),
    });
  });

  it('returns unsaved and leaves no partial row after an aborted transaction', async () => {
    await expect(
      repository().commit(mutation(), { abortTransaction: true })
    ).resolves.toEqual({
      saved: false,
      reason: 'failed',
    });
    await expect(
      repository().listOutbox(NAMESPACE, 'campaign-a')
    ).resolves.toEqual([]);
    await expect(
      repository().listDocuments(NAMESPACE, 'campaign-a')
    ).resolves.toEqual([]);
  });

  it('reports failure when the beforeCommit hook throws', async () => {
    const repo = new IndexedDbCombatLogArchiveRepository(database, {
      randomId: () => 'mutation-boom',
      beforeCommit: () => {
        throw new Error('boom');
      },
    });
    await expect(repo.commit(mutation())).resolves.toEqual({
      saved: false,
      reason: 'failed',
    });
    await expect(repo.listDocuments(NAMESPACE, 'campaign-a')).resolves.toEqual(
      []
    );
  });

  it('creates a recoverable tombstone and refuses ordinary resurrection', async () => {
    const repo = repository();
    await repo.commit(mutation());
    await repo.commit(
      mutation({
        operation: 'delete',
        payload: null,
        localRevision: 2,
        contentFingerprint: 'b'.repeat(64),
      })
    );
    await expect(
      repo.getTombstone(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({
      beforeImage: expect.objectContaining({ payload: payload() }),
      localRevision: 2,
    });
    await expect(repo.commit(mutation({ localRevision: 3 }))).resolves.toEqual({
      saved: false,
      reason: 'tombstoned',
    });
    await expect(
      repo.getTombstone(NAMESPACE, 'archive-bbb222')
    ).resolves.toBeNull();
  });

  it('isolates account and campaign outboxes and durably pauses without falling back', async () => {
    const repo = repository();
    await repo.commit(mutation());
    await repo.commit(
      mutation({
        namespace: 'user:account-b',
        campaignId: 'campaign-b',
        legacyId: 'archive-bbb222',
      })
    );
    await repo.pause(NAMESPACE, 'campaign-a');
    expect(await repo.listOutbox(NAMESPACE, 'campaign-a')).toEqual([
      expect.objectContaining({ state: 'paused', pausedFromState: 'queued' }),
    ]);
    expect(await repo.listOutbox('user:account-b', 'campaign-b')).toEqual([
      expect.objectContaining({ state: 'queued' }),
    ]);
    await repo.resume(NAMESPACE, 'campaign-a');
    expect(await repo.nextRunnable(NAMESPACE, 'campaign-a', 0)).toMatchObject({
      state: 'queued',
    });
  });

  it('lists only the campaign roster sorted by legacy id', async () => {
    const repo = repository();
    await repo.commit(mutation({ legacyId: 'archive-ccc333' }));
    await repo.commit(
      mutation({
        legacyId: 'archive-aaa111',
        contentFingerprint: 'b'.repeat(64),
      })
    );
    await repo.commit(
      mutation({
        legacyId: 'archive-bbb222',
        contentFingerprint: 'c'.repeat(64),
      })
    );
    await repo.commit(
      mutation({ campaignId: 'campaign-b', legacyId: 'archive-ddd444' })
    );
    await repo.commit(
      mutation({ namespace: 'user:account-b', legacyId: 'archive-eee555' })
    );

    const foreignFamily = database.transaction('documents', 'readwrite');
    foreignFamily.objectStore('documents').put({
      ...mutation({ legacyId: 'archive-zzz999' }),
      family: 'encounter_definition',
      deletedAt: null,
    });
    await transactionComplete(foreignFamily);

    await expect(
      repo.listDocuments(NAMESPACE, 'campaign-a')
    ).resolves.toMatchObject([
      { legacyId: 'archive-aaa111', family: 'combat_log_archive' },
      { legacyId: 'archive-bbb222', family: 'combat_log_archive' },
      { legacyId: 'archive-ccc333', family: 'combat_log_archive' },
    ]);
    await expect(
      repo.listDocuments(NAMESPACE, 'campaign-b')
    ).resolves.toMatchObject([{ legacyId: 'archive-ddd444' }]);
    await expect(
      repo.listDocuments('user:account-b', 'campaign-a')
    ).resolves.toMatchObject([{ legacyId: 'archive-eee555' }]);
  });

  it('supersedes queued work per legacy id without disturbing siblings', async () => {
    const repo = repository();
    const first = await repo.commit(mutation({ legacyId: 'archive-aaa111' }));
    const sibling = await repo.commit(
      mutation({
        legacyId: 'archive-bbb222',
        contentFingerprint: 'b'.repeat(64),
      })
    );
    const replacement = await repo.commit(
      mutation({
        legacyId: 'archive-aaa111',
        localRevision: 2,
        contentFingerprint: 'c'.repeat(64),
        payload: payload({ endedAt: '2026-01-01T02:00:00.000Z' }),
      })
    );
    if (!first.saved || !sibling.saved || !replacement.saved)
      throw new Error('expected local saves');

    const outbox = await repo.listOutbox(NAMESPACE, 'campaign-a');
    expect(outbox.map(entry => [entry.mutationId, entry.state]).sort()).toEqual(
      [
        [first.mutationId, 'superseded'],
        [sibling.mutationId, 'queued'],
        [replacement.mutationId, 'queued'],
      ]
    );
    await expect(
      repo.listDocuments(NAMESPACE, 'campaign-a')
    ).resolves.toMatchObject([
      {
        legacyId: 'archive-aaa111',
        localRevision: 2,
        payload: { endedAt: '2026-01-01T02:00:00.000Z' },
      },
      {
        legacyId: 'archive-bbb222',
        localRevision: 1,
        payload: { endedAt: '2026-01-01T01:00:00.000Z' },
      },
    ]);
  });

  it('supersedes a paused entry when the same archive is committed again', async () => {
    const repo = repository();
    const first = await repo.commit(mutation({ legacyId: 'archive-aaa111' }));
    const sibling = await repo.commit(
      mutation({
        legacyId: 'archive-bbb222',
        contentFingerprint: 'b'.repeat(64),
      })
    );
    if (!first.saved || !sibling.saved) throw new Error('expected local saves');
    // Every IndexedDB-authority commit pauses the outbox until cloud
    // activation, so the next edit of the same archive must still supersede it.
    await repo.pause(NAMESPACE, 'campaign-a');
    const replacement = await repo.commit(
      mutation({
        legacyId: 'archive-aaa111',
        localRevision: 2,
        contentFingerprint: 'c'.repeat(64),
        payload: payload({ endedAt: '2026-01-01T02:00:00.000Z' }),
      })
    );
    if (!replacement.saved) throw new Error('expected local save');

    const outbox = await repo.listOutbox(NAMESPACE, 'campaign-a');
    expect(outbox.map(entry => [entry.mutationId, entry.state]).sort()).toEqual(
      [
        [first.mutationId, 'superseded'],
        [sibling.mutationId, 'paused'],
        [replacement.mutationId, 'queued'],
      ]
    );
    expect(
      outbox.find(entry => entry.mutationId === first.mutationId)
        ?.pausedFromState
    ).toBeUndefined();
  });

  it('pause leaves superseded and acknowledged entries terminal', async () => {
    const repo = repository();
    const first = await repo.commit(mutation({ legacyId: 'archive-aaa111' }));
    const settled = await repo.commit(
      mutation({
        legacyId: 'archive-bbb222',
        contentFingerprint: 'b'.repeat(64),
      })
    );
    if (!first.saved || !settled.saved) throw new Error('expected local saves');
    await repo.acknowledge(settled.mutationId, {
      serverVersion: 2,
      cutoverEpoch: 1,
      payloadFingerprint: 'd'.repeat(64),
    });
    await repo.pause(NAMESPACE, 'campaign-a');
    const replacement = await repo.commit(
      mutation({
        legacyId: 'archive-aaa111',
        localRevision: 2,
        contentFingerprint: 'c'.repeat(64),
        payload: payload({ endedAt: '2026-01-01T02:00:00.000Z' }),
      })
    );
    if (!replacement.saved) throw new Error('expected local save');

    const byId = async () =>
      Object.fromEntries(
        (await repo.listOutbox(NAMESPACE, 'campaign-a')).map(entry => [
          entry.mutationId,
          entry,
        ])
      );
    expect(await byId()).toMatchObject({
      [first.mutationId]: { state: 'superseded' },
      [settled.mutationId]: { state: 'acknowledged' },
      [replacement.mutationId]: { state: 'queued' },
    });

    // Pausing again must never resurrect terminal work as pending.
    await repo.pause(NAMESPACE, 'campaign-a');
    const paused = await byId();
    expect(paused[first.mutationId]).toMatchObject({ state: 'superseded' });
    expect(paused[first.mutationId].pausedFromState).toBeUndefined();
    expect(paused[settled.mutationId]).toMatchObject({
      state: 'acknowledged',
    });
    expect(paused[settled.mutationId].pausedFromState).toBeUndefined();
    expect(paused[replacement.mutationId]).toMatchObject({
      state: 'paused',
      pausedFromState: 'queued',
    });

    await repo.resume(NAMESPACE, 'campaign-a');
    const resumed = await byId();
    expect(resumed[first.mutationId]).toMatchObject({ state: 'superseded' });
    expect(resumed[settled.mutationId]).toMatchObject({
      state: 'acknowledged',
    });
    expect(resumed[replacement.mutationId]).toMatchObject({ state: 'queued' });
    expect(resumed[replacement.mutationId].pausedFromState).toBeUndefined();
  });

  it('restores a legacy paused row to the state it was paused from', async () => {
    const repo = repository();
    const entry = await repo.commit(mutation());
    if (!entry.saved) throw new Error('expected local save');
    const seed = database.transaction('outbox', 'readwrite');
    const store = seed.objectStore('outbox');
    const stored = (await requestResult(store.get(entry.mutationId))) as Record<
      string,
      unknown
    >;
    store.put({ ...stored, state: 'paused' });
    await transactionComplete(seed);

    await repo.resume(NAMESPACE, 'campaign-a');
    expect(await repo.listOutbox(NAMESPACE, 'campaign-a')).toEqual([
      expect.objectContaining({ state: 'queued' }),
    ]);
  });

  it('never rewinds a newer document when an older acknowledgement arrives', async () => {
    const repo = repository();
    const older = await repo.commit(mutation({ legacyId: 'archive-aaa111' }));
    const newer = await repo.commit(
      mutation({
        legacyId: 'archive-aaa111',
        localRevision: 2,
        contentFingerprint: 'c'.repeat(64),
        payload: payload({ endedAt: '2026-01-01T02:00:00.000Z' }),
      })
    );
    if (!older.saved || !newer.saved) throw new Error('expected local saves');

    await repo.acknowledge(older.mutationId, {
      serverVersion: 7,
      cutoverEpoch: 9,
      payloadFingerprint: 'b'.repeat(64),
    });

    await expect(
      repo.getDocument(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({
      contentFingerprint: 'c'.repeat(64),
      baseServerVersion: 1,
      cutoverEpoch: 1,
      localRevision: 2,
    });
    expect(
      (await repo.listOutbox(NAMESPACE, 'campaign-a')).find(
        entry => entry.mutationId === older.mutationId
      )
    ).toMatchObject({ state: 'acknowledged', lastError: null });

    await repo.acknowledge(newer.mutationId, {
      serverVersion: 8,
      cutoverEpoch: 9,
      payloadFingerprint: 'f'.repeat(64),
    });
    await expect(
      repo.getDocument(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({
      contentFingerprint: 'f'.repeat(64),
      baseServerVersion: 8,
      cutoverEpoch: 9,
    });
  });

  it('hides an exact removed account namespace while preserving every durable row', async () => {
    const repo = repository();
    await repo.commit(mutation());
    const neighbour = await repo.commit(
      mutation({ namespace: 'user:account-b', legacyId: 'archive-bbb222' })
    );
    if (!neighbour.saved) throw new Error('expected local save');
    await expect(
      repo.removeAccountFromDevice(NAMESPACE, {
        confirmed: false,
        lossConfirmed: false,
      })
    ).rejects.toThrow('Browser removal requires confirmation');
    await expect(
      repo.removeAccountFromDevice(NAMESPACE, {
        confirmed: true,
        lossConfirmed: false,
      })
    ).rejects.toThrow(
      'Unresolved browser-only work requires explicit loss confirmation'
    );
    await expect(
      repo.removeAccountFromDevice('guest', {
        confirmed: true,
        lossConfirmed: true,
      })
    ).rejects.toThrow('Account namespace is required');
    await repo.removeAccountFromDevice(NAMESPACE, {
      confirmed: true,
      lossConfirmed: true,
    });
    await expect(
      repo.getDocument(NAMESPACE, 'archive-aaa111')
    ).resolves.toBeNull();
    await expect(repo.listDocuments(NAMESPACE, 'campaign-a')).resolves.toEqual(
      []
    );
    // Only the exact namespace is hidden: the neighbouring account still reads.
    await expect(
      repo.getDocument('user:account-b', 'archive-bbb222')
    ).resolves.toMatchObject({ legacyId: 'archive-bbb222' });
    await expect(
      repo.listDocuments('user:account-b', 'campaign-a')
    ).resolves.toMatchObject([{ legacyId: 'archive-bbb222' }]);
    const transaction = database.transaction(
      ['documents', 'outbox'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('documents').getAll())
    ).toHaveLength(2);
    expect(
      await requestResult(transaction.objectStore('outbox').getAll())
    ).toHaveLength(2);
    await transactionComplete(transaction);
  });

  it('removes a fully settled account namespace without loss confirmation', async () => {
    const repo = repository();
    const entry = await repo.commit(mutation());
    if (!entry.saved) throw new Error('expected local save');
    await repo.updateWork(entry.mutationId, { state: 'acknowledged' });
    // Another account's unresolved work, and another family's unresolved work
    // in this account, are both outside this removal's scope.
    const neighbour = await repo.commit(
      mutation({ namespace: 'user:account-b', legacyId: 'archive-bbb222' })
    );
    if (!neighbour.saved) throw new Error('expected local save');
    const foreignFamily = database.transaction('outbox', 'readwrite');
    foreignFamily.objectStore('outbox').put({
      ...mutation({ legacyId: 'archive-ccc333' }),
      family: 'encounter_definition',
      mutationId: 'mutation-foreign',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(foreignFamily);

    await repo.removeAccountFromDevice(NAMESPACE, {
      confirmed: true,
      lossConfirmed: false,
    });
    await expect(repo.listDocuments(NAMESPACE, 'campaign-a')).resolves.toEqual(
      []
    );
    await expect(
      repo.listDocuments('user:account-b', 'campaign-a')
    ).resolves.toMatchObject([{ legacyId: 'archive-bbb222' }]);
  });

  it('hydrates an explicitly accepted cloud version only when local work is resolved', async () => {
    const repo = repository();
    await repo.commit(mutation());
    const cloudVersion = {
      namespace: NAMESPACE,
      campaignId: 'campaign-a',
      legacyId: 'archive-aaa111',
      cutoverEpoch: 1,
      serverVersion: 2,
      schemaVersion: 2,
      payload: payload({ endedAt: '2026-01-01T09:00:00.000Z' }),
      payloadFingerprint: 'b'.repeat(64),
      tombstoned: false,
      acceptedAt: 'later',
    } as const;
    await expect(repo.applyAcceptedCloudVersion(cloudVersion)).rejects.toThrow(
      'Unresolved local combat log archive work blocks cloud hydration'
    );
    const pending = await repo.listOutbox(NAMESPACE, 'campaign-a');
    await repo.updateWork(pending[0].mutationId, { state: 'acknowledged' });
    await repo.applyAcceptedCloudVersion(cloudVersion);
    await expect(
      repo.getDocument(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({
      operation: 'replace',
      baseServerVersion: 2,
      contentFingerprint: 'b'.repeat(64),
      localRevision: 2,
      deletedAt: null,
      payload: { endedAt: '2026-01-01T09:00:00.000Z' },
    });
  });

  it('retains cloud tombstones until an explicit accepted restore clears them', async () => {
    const repo = repository();
    await repo.applyAcceptedCloudVersion({
      namespace: NAMESPACE,
      campaignId: 'campaign-a',
      legacyId: 'archive-aaa111',
      cutoverEpoch: 1,
      serverVersion: 2,
      schemaVersion: 2,
      payload: null,
      payloadFingerprint: 'b'.repeat(64),
      tombstoned: true,
      acceptedAt: 'deleted',
    });
    await expect(
      repo.getTombstone(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({ mutationId: 'cloud:2' });
    await expect(
      repo.getDocument(NAMESPACE, 'archive-aaa111')
    ).resolves.toMatchObject({
      operation: 'delete',
      payload: null,
      deletedAt: 'deleted',
    });
    await expect(repo.commit(mutation())).resolves.toEqual({
      saved: false,
      reason: 'tombstoned',
    });

    await repo.applyAcceptedCloudVersion({
      namespace: NAMESPACE,
      campaignId: 'campaign-a',
      legacyId: 'archive-aaa111',
      cutoverEpoch: 1,
      serverVersion: 3,
      schemaVersion: 2,
      payload: payload(),
      payloadFingerprint: 'c'.repeat(64),
      tombstoned: false,
      acceptedAt: 'restored',
    });
    await expect(
      repo.getTombstone(NAMESPACE, 'archive-aaa111')
    ).resolves.toBeNull();
  });

  it('runs queued work only once its next attempt time has arrived', async () => {
    const repo = repository();
    const first = await repo.commit(mutation());
    const second = await repo.commit(
      mutation({
        legacyId: 'archive-bbb222',
        contentFingerprint: 'b'.repeat(64),
      })
    );
    if (!first.saved || !second.saved) throw new Error('expected local saves');

    await repo.updateWork(first.mutationId, {
      state: 'retry',
      nextAttemptAt: 20,
    });
    await repo.updateWork(second.mutationId, {
      state: 'retry',
      nextAttemptAt: 10,
    });
    // Boundary: runnable exactly at nextAttemptAt, not one millisecond before.
    await expect(
      repo.nextRunnable(NAMESPACE, 'campaign-a', 9)
    ).resolves.toBeNull();
    await expect(
      repo.nextRunnable(NAMESPACE, 'campaign-a', 10)
    ).resolves.toMatchObject({ mutationId: second.mutationId });
    await expect(
      repo.nextRunnable(NAMESPACE, 'campaign-a', 19)
    ).resolves.toMatchObject({ mutationId: second.mutationId });
    // The earliest due entry wins even when both are runnable.
    await expect(
      repo.nextRunnable(NAMESPACE, 'campaign-a', 20)
    ).resolves.toMatchObject({ mutationId: second.mutationId });
    await repo.updateWork(second.mutationId, { state: 'conflict' });
    await expect(
      repo.nextRunnable(NAMESPACE, 'campaign-a', 20)
    ).resolves.toMatchObject({ mutationId: first.mutationId });
  });

  it('covers acknowledgements, conflicts, and guest denial directly', async () => {
    const repo = repository();
    await expect(
      repo.commit(mutation({ namespace: 'guest' }))
    ).resolves.toEqual({ saved: false, reason: 'guest' });
    const first = await repo.commit(mutation());
    const second = await repo.commit(
      mutation({
        legacyId: 'archive-bbb222',
        contentFingerprint: 'b'.repeat(64),
      })
    );
    if (!first.saved || !second.saved) throw new Error('expected local saves');

    // An unknown mutation id is a no-op on both work paths.
    await repo.updateWork('missing', { state: 'retry' });
    await repo.acknowledge('missing', {
      serverVersion: 2,
      cutoverEpoch: 1,
      payloadFingerprint: 'c'.repeat(64),
    });
    await expect(
      repo.listOutbox(NAMESPACE, 'campaign-a')
    ).resolves.toHaveLength(2);

    await repo.acknowledge(second.mutationId, {
      serverVersion: 2,
      cutoverEpoch: 1,
      payloadFingerprint: 'c'.repeat(64),
    });
    await expect(
      repo.getDocument(NAMESPACE, 'archive-bbb222')
    ).resolves.toMatchObject({
      baseServerVersion: 2,
      contentFingerprint: 'c'.repeat(64),
    });

    const removedDocument = await repo.commit(
      mutation({
        legacyId: 'archive-ccc333',
        contentFingerprint: 'd'.repeat(64),
      })
    );
    if (!removedDocument.saved) throw new Error('expected local save');
    const remove = database.transaction('documents', 'readwrite');
    remove
      .objectStore('documents')
      .delete([NAMESPACE, 'combat_log_archive', 'archive-ccc333']);
    await transactionComplete(remove);
    await expect(
      repo.acknowledge(removedDocument.mutationId, {
        serverVersion: 2,
        cutoverEpoch: 1,
        payloadFingerprint: 'd'.repeat(64),
      })
    ).resolves.toBeUndefined();
    await expect(
      repo.getDocument(NAMESPACE, 'archive-ccc333')
    ).resolves.toBeNull();

    const [conflicting] = (
      await repo.listOutbox(NAMESPACE, 'campaign-a')
    ).filter(entry => entry.mutationId === first.mutationId);
    await repo.preserveCloudConflict(conflicting, {
      category: 'stale-base-version',
    });
    expect(
      await requestResult(
        database
          .transaction('conflicts', 'readonly')
          .objectStore('conflicts')
          .getAll()
      )
    ).toMatchObject([
      {
        conflictId: `combat_log_archive:${NAMESPACE}:campaign-a:archive-aaa111:${first.mutationId}`,
        namespace: NAMESPACE,
        campaignId: 'campaign-a',
        family: 'combat_log_archive',
        legacyId: 'archive-aaa111',
        mutationId: first.mutationId,
        localCandidate: { contentFingerprint: 'a'.repeat(64) },
        cloudCandidate: { category: 'stale-base-version' },
        resolutionState: 'unresolved',
      },
    ]);
    await expect(
      repo.listOutbox(NAMESPACE, 'campaign-a')
    ).resolves.toContainEqual(
      expect.objectContaining({
        mutationId: first.mutationId,
        state: 'conflict',
        lastError: 'cloud-conflict',
      })
    );
  });
});
