import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  IndexedDbCalendarRepository,
  type CalendarMutation,
} from '../calendarRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

const NAMESPACE = 'user:account-a' as const;

function mutation(overrides: Partial<CalendarMutation> = {}): CalendarMutation {
  return {
    namespace: NAMESPACE,
    campaignId: 'campaign-a',
    legacyId: 'AAA111',
    cutoverEpoch: 1,
    operation: 'replace',
    payload: { config: {} as never, currentTime: 0, startTime: 0, events: [] },
    schemaVersion: 1,
    localRevision: 1,
    baseServerVersion: 1,
    contentFingerprint: 'a'.repeat(64),
    updatedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('IndexedDbCalendarRepository', () => {
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
    new IndexedDbCalendarRepository(database, {
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
          .get([NAMESPACE, 'calendar', 'AAA111'])
      )
    ).toMatchObject({ localRevision: 1, campaignId: 'campaign-a' });
    expect(
      await requestResult(transaction.objectStore('outbox').get('mutation-1'))
    ).toMatchObject({
      family: 'calendar',
      state: 'queued',
    });
    await transactionComplete(transaction);
  });

  it('supersedes retryable work when a newer local revision replaces it', async () => {
    const repo = repository();
    const first = await repo.commit(mutation());
    if (!first.saved) throw new Error('expected first local save');
    await repo.updateWork(first.mutationId, {
      state: 'retry',
      lastError: 'cloud-unavailable',
    });

    const replacement = await repo.commit(
      mutation({ localRevision: 2, contentFingerprint: 'b'.repeat(64) })
    );
    if (!replacement.saved) throw new Error('expected replacement save');

    await expect(repo.listOutbox(NAMESPACE, 'campaign-a')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mutationId: first.mutationId,
          state: 'superseded',
          lastError: null,
        }),
        expect.objectContaining({
          mutationId: replacement.mutationId,
          state: 'queued',
        }),
      ])
    );
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
    await expect(repo.getTombstone(NAMESPACE, 'AAA111')).resolves.toMatchObject(
      {
        beforeImage: expect.objectContaining({
          payload: {
            config: {} as never,
            currentTime: 0,
            startTime: 0,
            events: [],
          },
        }),
        localRevision: 2,
      }
    );
    await expect(repo.commit(mutation({ localRevision: 3 }))).resolves.toEqual({
      saved: false,
      reason: 'tombstoned',
    });
  });

  it('isolates account and campaign outboxes and durably pauses without falling back', async () => {
    const repo = repository();
    await repo.commit(mutation());
    await repo.commit(
      mutation({
        namespace: 'user:account-b',
        campaignId: 'campaign-b',
        legacyId: 'BBB222',
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

  it('hides an exact removed account namespace while preserving every durable row', async () => {
    const repo = repository();
    await repo.commit(mutation());
    await expect(
      repo.removeAccountFromDevice(NAMESPACE, {
        confirmed: false,
        lossConfirmed: false,
      })
    ).rejects.toThrow(/confirmation/i);
    await expect(
      repo.removeAccountFromDevice(NAMESPACE, {
        confirmed: true,
        lossConfirmed: false,
      })
    ).rejects.toThrow(/browser-only work/i);
    await repo.removeAccountFromDevice(NAMESPACE, {
      confirmed: true,
      lossConfirmed: true,
    });
    await expect(repo.getDocument(NAMESPACE, 'AAA111')).resolves.toBeNull();
    const transaction = database.transaction(
      ['documents', 'outbox'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('documents').getAll())
    ).toHaveLength(1);
    expect(
      await requestResult(transaction.objectStore('outbox').getAll())
    ).toHaveLength(1);
    await transactionComplete(transaction);
  });

  it('hydrates an explicitly accepted cloud version only when local work is resolved', async () => {
    const repo = repository();
    await repo.commit(mutation());
    await expect(
      repo.applyAcceptedCloudVersion({
        namespace: NAMESPACE,
        campaignId: 'campaign-a',
        legacyId: 'AAA111',
        cutoverEpoch: 1,
        serverVersion: 2,
        schemaVersion: 1,
        payload: {
          config: {} as never,
          currentTime: 1,
          startTime: 0,
          events: [],
        },
        payloadFingerprint: 'b'.repeat(64),
        tombstoned: false,
        acceptedAt: 'later',
      })
    ).rejects.toThrow(/unresolved/i);
    const pending = await repo.listOutbox(NAMESPACE, 'campaign-a');
    await repo.updateWork(pending[0].mutationId, { state: 'acknowledged' });
    await repo.applyAcceptedCloudVersion({
      namespace: NAMESPACE,
      campaignId: 'campaign-a',
      legacyId: 'AAA111',
      cutoverEpoch: 1,
      serverVersion: 2,
      schemaVersion: 1,
      payload: {
        config: {} as never,
        currentTime: 1,
        startTime: 0,
        events: [],
      },
      payloadFingerprint: 'b'.repeat(64),
      tombstoned: false,
      acceptedAt: 'later',
    });
    await expect(repo.getDocument(NAMESPACE, 'AAA111')).resolves.toMatchObject({
      baseServerVersion: 2,
      payload: {
        config: {} as never,
        currentTime: 1,
        startTime: 0,
        events: [],
      },
    });
  });

  it('retains cloud tombstones until an explicit accepted restore clears them', async () => {
    const repo = repository();
    await repo.applyAcceptedCloudVersion({
      namespace: NAMESPACE,
      campaignId: 'campaign-a',
      legacyId: 'AAA111',
      cutoverEpoch: 1,
      serverVersion: 2,
      schemaVersion: 1,
      payload: null,
      payloadFingerprint: 'b'.repeat(64),
      tombstoned: true,
      acceptedAt: 'deleted',
    });
    await expect(repo.getTombstone(NAMESPACE, 'AAA111')).resolves.toMatchObject(
      { mutationId: 'cloud:2' }
    );
    await expect(repo.commit(mutation())).resolves.toEqual({
      saved: false,
      reason: 'tombstoned',
    });

    await repo.applyAcceptedCloudVersion({
      namespace: NAMESPACE,
      campaignId: 'campaign-a',
      legacyId: 'AAA111',
      cutoverEpoch: 1,
      serverVersion: 3,
      schemaVersion: 1,
      payload: mutation().payload,
      payloadFingerprint: 'c'.repeat(64),
      tombstoned: false,
      acceptedAt: 'restored',
    });
    await expect(repo.getTombstone(NAMESPACE, 'AAA111')).resolves.toBeNull();
  });

  it('covers runnable ordering, acknowledgements, conflicts, and guest denial directly', async () => {
    const repo = repository();
    await expect(
      repo.commit(mutation({ namespace: 'guest' }))
    ).resolves.toEqual({ saved: false, reason: 'guest' });
    const first = await repo.commit(mutation());
    const second = await repo.commit(
      mutation({ legacyId: 'BBB222', contentFingerprint: 'b'.repeat(64) })
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
    await repo.updateWork('missing', { state: 'retry' });
    await expect(
      repo.nextRunnable(NAMESPACE, 'campaign-a', 20)
    ).resolves.toMatchObject({ mutationId: second.mutationId });

    await repo.acknowledge('missing', {
      serverVersion: 2,
      cutoverEpoch: 1,
      payloadFingerprint: 'c'.repeat(64),
    });
    await repo.acknowledge(second.mutationId, {
      serverVersion: 2,
      cutoverEpoch: 1,
      payloadFingerprint: 'c'.repeat(64),
    });
    await expect(repo.getDocument(NAMESPACE, 'BBB222')).resolves.toMatchObject({
      baseServerVersion: 2,
      contentFingerprint: 'c'.repeat(64),
    });

    const removedDocument = await repo.commit(
      mutation({ legacyId: 'CCC333', contentFingerprint: 'd'.repeat(64) })
    );
    if (!removedDocument.saved) throw new Error('expected local save');
    const remove = database.transaction('documents', 'readwrite');
    remove.objectStore('documents').delete([NAMESPACE, 'calendar', 'CCC333']);
    await transactionComplete(remove);
    await expect(
      repo.acknowledge(removedDocument.mutationId, {
        serverVersion: 2,
        cutoverEpoch: 1,
        payloadFingerprint: 'd'.repeat(64),
      })
    ).resolves.toBeUndefined();

    const [conflicting] = (
      await repo.listOutbox(NAMESPACE, 'campaign-a')
    ).filter(entry => entry.mutationId === first.mutationId);
    await repo.preserveCloudConflict(conflicting, { serverVersion: 3 });
    expect(
      await requestResult(
        database
          .transaction('conflicts', 'readonly')
          .objectStore('conflicts')
          .getAll()
      )
    ).toHaveLength(1);
    await expect(
      repo.listOutbox(NAMESPACE, 'campaign-a')
    ).resolves.toContainEqual(
      expect.objectContaining({
        mutationId: first.mutationId,
        state: 'conflict',
      })
    );
  });
});
