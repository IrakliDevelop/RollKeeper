import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  IndexedDbCampaignSettingsRepository,
  type CampaignSettingsMutation,
} from '../campaignSettingsRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

const NAMESPACE = 'user:account-a' as const;

function mutation(
  overrides: Partial<CampaignSettingsMutation> = {}
): CampaignSettingsMutation {
  return {
    namespace: NAMESPACE,
    campaignId: 'campaign-a',
    legacyId: 'AAA111',
    cutoverEpoch: 1,
    operation: 'replace',
    payload: { stackableInspiration: true },
    schemaVersion: 1,
    localRevision: 1,
    baseServerVersion: 1,
    contentFingerprint: 'a'.repeat(64),
    updatedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('IndexedDbCampaignSettingsRepository', () => {
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
    new IndexedDbCampaignSettingsRepository(database, {
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
          .get([NAMESPACE, 'campaign_settings', 'AAA111'])
      )
    ).toMatchObject({ localRevision: 1, campaignId: 'campaign-a' });
    expect(
      await requestResult(transaction.objectStore('outbox').get('mutation-1'))
    ).toMatchObject({
      family: 'campaign_settings',
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
          payload: { stackableInspiration: true },
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
    ).rejects.toThrow(/device-only work/i);
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
        payload: { stackableInspiration: false },
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
      payload: { stackableInspiration: false },
      payloadFingerprint: 'b'.repeat(64),
      tombstoned: false,
      acceptedAt: 'later',
    });
    await expect(repo.getDocument(NAMESPACE, 'AAA111')).resolves.toMatchObject({
      baseServerVersion: 2,
      payload: { stackableInspiration: false },
    });
  });
});
