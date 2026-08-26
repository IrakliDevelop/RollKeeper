import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MagicItemPayload } from '@/lib/durableDm/magicItemFamily';

import {
  IndexedDbMagicItemRepository,
  type MagicItemMutation,
} from '../magicItemRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

const NAMESPACE = 'user:account-a' as const;

function payload(overrides: Partial<MagicItemPayload> = {}): MagicItemPayload {
  return {
    name: 'Plain Ring',
    category: 'ring',
    rarity: 'common',
    description: '',
    properties: [],
    requiresAttunement: false,
    isAttuned: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tags: [],
    ...overrides,
  };
}

function mutation(
  overrides: Partial<MagicItemMutation> = {}
): MagicItemMutation {
  return {
    namespace: NAMESPACE,
    campaignId: 'campaign-a',
    legacyId: 'AAA111',
    cutoverEpoch: 1,
    operation: 'replace',
    payload: payload(),
    schemaVersion: 1,
    localRevision: 1,
    baseServerVersion: 1,
    contentFingerprint: 'a'.repeat(64),
    updatedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('IndexedDbMagicItemRepository', () => {
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
    new IndexedDbMagicItemRepository(database, {
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
          .get([NAMESPACE, 'magic_item', 'AAA111'])
      )
    ).toMatchObject({ localRevision: 1, campaignId: 'campaign-a' });
    expect(
      await requestResult(transaction.objectStore('outbox').get('mutation-1'))
    ).toMatchObject({
      family: 'magic_item',
      state: 'queued',
    });
    await transactionComplete(transaction);
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
        beforeImage: expect.objectContaining({ payload: payload() }),
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

  it('lists only the campaign library sorted by legacy id', async () => {
    const repo = repository();
    await repo.commit(mutation({ legacyId: 'CCC333' }));
    await repo.commit(
      mutation({ legacyId: 'AAA111', contentFingerprint: 'b'.repeat(64) })
    );
    await repo.commit(
      mutation({ legacyId: 'BBB222', contentFingerprint: 'c'.repeat(64) })
    );
    await repo.commit(
      mutation({ campaignId: 'campaign-b', legacyId: 'DDD444' })
    );
    await repo.commit(
      mutation({ namespace: 'user:account-b', legacyId: 'EEE555' })
    );

    const foreignFamily = database.transaction('documents', 'readwrite');
    foreignFamily.objectStore('documents').put({
      ...mutation({ legacyId: 'ZZZ999' }),
      family: 'calendar',
      deletedAt: null,
    });
    await transactionComplete(foreignFamily);

    await expect(
      repo.listDocuments(NAMESPACE, 'campaign-a')
    ).resolves.toMatchObject([
      { legacyId: 'AAA111', family: 'magic_item' },
      { legacyId: 'BBB222', family: 'magic_item' },
      { legacyId: 'CCC333', family: 'magic_item' },
    ]);
    await expect(
      repo.listDocuments(NAMESPACE, 'campaign-b')
    ).resolves.toMatchObject([{ legacyId: 'DDD444' }]);
  });

  it('supersedes queued work per legacy id without disturbing siblings', async () => {
    const repo = repository();
    const first = await repo.commit(mutation({ legacyId: 'AAA111' }));
    const sibling = await repo.commit(
      mutation({ legacyId: 'BBB222', contentFingerprint: 'b'.repeat(64) })
    );
    const replacement = await repo.commit(
      mutation({
        legacyId: 'AAA111',
        localRevision: 2,
        contentFingerprint: 'c'.repeat(64),
        payload: payload({ name: 'Ring of Warmth' }),
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
        legacyId: 'AAA111',
        localRevision: 2,
        payload: { name: 'Ring of Warmth' },
      },
      { legacyId: 'BBB222', localRevision: 1, payload: { name: 'Plain Ring' } },
    ]);
  });

  it('supersedes a paused entry when the same item is committed again', async () => {
    const repo = repository();
    const first = await repo.commit(mutation({ legacyId: 'AAA111' }));
    const sibling = await repo.commit(
      mutation({ legacyId: 'BBB222', contentFingerprint: 'b'.repeat(64) })
    );
    if (!first.saved || !sibling.saved) throw new Error('expected local saves');
    // Every IndexedDB-authority commit pauses the outbox until cloud
    // activation, so the next edit of the same item must still supersede it.
    await repo.pause(NAMESPACE, 'campaign-a');
    const replacement = await repo.commit(
      mutation({
        legacyId: 'AAA111',
        localRevision: 2,
        contentFingerprint: 'c'.repeat(64),
        payload: payload({ name: 'Ring of Warmth' }),
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
  });

  it('pause leaves superseded and acknowledged entries terminal', async () => {
    const repo = repository();
    const first = await repo.commit(mutation({ legacyId: 'AAA111' }));
    const settled = await repo.commit(
      mutation({ legacyId: 'BBB222', contentFingerprint: 'b'.repeat(64) })
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
        legacyId: 'AAA111',
        localRevision: 2,
        contentFingerprint: 'c'.repeat(64),
        payload: payload({ name: 'Ring of Warmth' }),
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

  it('never rewinds a newer document when an older acknowledgement arrives', async () => {
    const repo = repository();
    const older = await repo.commit(mutation({ legacyId: 'AAA111' }));
    const newer = await repo.commit(
      mutation({
        legacyId: 'AAA111',
        localRevision: 2,
        contentFingerprint: 'c'.repeat(64),
        payload: payload({ name: 'Ring of Warmth' }),
      })
    );
    if (!older.saved || !newer.saved) throw new Error('expected local saves');

    await repo.acknowledge(older.mutationId, {
      serverVersion: 7,
      cutoverEpoch: 9,
      payloadFingerprint: 'b'.repeat(64),
    });

    await expect(repo.getDocument(NAMESPACE, 'AAA111')).resolves.toMatchObject({
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
    await expect(repo.getDocument(NAMESPACE, 'AAA111')).resolves.toMatchObject({
      contentFingerprint: 'f'.repeat(64),
      baseServerVersion: 8,
      cutoverEpoch: 9,
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
    await expect(
      repo.removeAccountFromDevice('guest', {
        confirmed: true,
        lossConfirmed: true,
      })
    ).rejects.toThrow(/account namespace/i);
    await repo.removeAccountFromDevice(NAMESPACE, {
      confirmed: true,
      lossConfirmed: true,
    });
    await expect(repo.getDocument(NAMESPACE, 'AAA111')).resolves.toBeNull();
    await expect(repo.listDocuments(NAMESPACE, 'campaign-a')).resolves.toEqual(
      []
    );
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
        payload: payload({ name: 'Ring of Cloud' }),
        payloadFingerprint: 'b'.repeat(64),
        tombstoned: false,
        acceptedAt: 'later',
      })
    ).rejects.toThrow(/unresolved local magic item work/i);
    const pending = await repo.listOutbox(NAMESPACE, 'campaign-a');
    await repo.updateWork(pending[0].mutationId, { state: 'acknowledged' });
    await repo.applyAcceptedCloudVersion({
      namespace: NAMESPACE,
      campaignId: 'campaign-a',
      legacyId: 'AAA111',
      cutoverEpoch: 1,
      serverVersion: 2,
      schemaVersion: 1,
      payload: payload({ name: 'Ring of Cloud' }),
      payloadFingerprint: 'b'.repeat(64),
      tombstoned: false,
      acceptedAt: 'later',
    });
    await expect(repo.getDocument(NAMESPACE, 'AAA111')).resolves.toMatchObject({
      baseServerVersion: 2,
      localRevision: 2,
      payload: { name: 'Ring of Cloud' },
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
      payload: payload(),
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
    remove.objectStore('documents').delete([NAMESPACE, 'magic_item', 'CCC333']);
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
    ).toMatchObject([
      {
        conflictId: `magic_item:${NAMESPACE}:campaign-a:AAA111:${first.mutationId}`,
        family: 'magic_item',
        resolutionState: 'unresolved',
      },
    ]);
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
