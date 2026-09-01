import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  commitCampaignSettingsLocalCutover,
  enrollCampaignSettingsCloudDevice,
  markCampaignSettingsCloudAuthority,
  readCampaignSettingsAuthority,
  rollbackCampaignSettingsLocalAuthority,
} from '../campaignSettingsAuthority';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

const NAMESPACE = 'user:account-a' as const;
const CAMPAIGN = 'campaign-a';
const GENERATION = 'settings-generation';
const gates = {
  recoveryReceipt: true,
  sourceManifestUnchanged: true,
  captureVerifiedAfterReopen: true,
  manifestConfirmed: true,
  noConflicts: true,
  noQuarantine: true,
  parity: true,
  journalEmpty: true,
};

async function seedReady(database: IDBDatabase) {
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:campaign_settings:${CAMPAIGN}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-dm-data',
    presence: true,
    rawValue: '{"state":{"campaigns":[]},"version":1}',
  });
  await transactionComplete(transaction);
}

describe('campaign_settings local authority', () => {
  afterEach(() => deleteRollkeeperDatabaseForTests(indexedDB));

  it('requires every safety gate and explicit confirmation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    for (const field of Object.keys(gates) as Array<keyof typeof gates>) {
      await expect(
        commitCampaignSettingsLocalCutover(database, {
          namespace: NAMESPACE,
          campaignId: CAMPAIGN,
          generation: GENERATION,
          confirmed: true,
          gates: { ...gates, [field]: false },
          now: () => 'now',
        })
      ).rejects.toThrow(/gate/i);
    }
    await expect(
      commitCampaignSettingsLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: false,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow(/confirmation/i);
    database.close();
  });

  it('atomically advances only the scoped family epoch', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    const authority = await commitCampaignSettingsLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'now',
    });
    expect(authority).toMatchObject({
      authority: 'indexedDB',
      epoch: 1,
      family: 'campaign_settings',
    });
    expect(
      await readCampaignSettingsAuthority(database, NAMESPACE, CAMPAIGN)
    ).toEqual(authority);
    expect(
      await readCampaignSettingsAuthority(database, NAMESPACE, 'other')
    ).toEqual({ authority: 'localStorage', epoch: 0 });
    database.close();
  });

  it('rolls back through a new epoch only from a verified current generation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitCampaignSettingsLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'cutover',
    });
    await expect(
      rollbackCampaignSettingsLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: true,
        currentGenerationVerified: false,
        projectionJournalReconciled: true,
        now: () => 'rollback',
      })
    ).rejects.toThrow(/verified current generation/i);
    const rolledBack = await rollbackCampaignSettingsLocalAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedEpoch: 1,
      generation: GENERATION,
      confirmed: true,
      currentGenerationVerified: true,
      projectionJournalReconciled: true,
      now: () => 'rollback',
    });
    expect(rolledBack).toMatchObject({
      authority: 'localStorage',
      epoch: 2,
      rollbackGeneration: GENERATION,
    });
    await expect(
      rollbackCampaignSettingsLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: true,
        currentGenerationVerified: true,
        projectionJournalReconciled: true,
        now: () => 'stale',
      })
    ).rejects.toThrow(/stale/i);
    database.close();
  });

  it('hydrates a new device only after explicit preview and preserves a divergent local candidate', async () => {
    const database = await openRollkeeperDatabase();
    await expect(
      enrollCampaignSettingsCloudDevice(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        campaignCode: 'ABC123',
        deviceId: 'device-a',
        epoch: 4,
        confirmed: false,
        previewFingerprint: 'a'.repeat(64),
        payloadFingerprint: 'b'.repeat(64),
        payload: { stackableInspiration: true },
        schemaVersion: 1,
        serverVersion: 7,
        localCandidate: {
          rawValue: 'legacy-bytes',
          fingerprint: 'c'.repeat(64),
        },
        preserveDivergentCandidate: true,
        now: () => 'now',
      })
    ).rejects.toThrow(/confirmation/i);
    const authority = await enrollCampaignSettingsCloudDevice(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      campaignCode: 'ABC123',
      deviceId: 'device-a',
      epoch: 4,
      confirmed: true,
      previewFingerprint: 'a'.repeat(64),
      payloadFingerprint: 'b'.repeat(64),
      payload: { stackableInspiration: true },
      schemaVersion: 1,
      serverVersion: 7,
      localCandidate: { rawValue: 'legacy-bytes', fingerprint: 'c'.repeat(64) },
      preserveDivergentCandidate: true,
      now: () => 'now',
    });
    expect(authority).toMatchObject({ authority: 'postgres', epoch: 4 });
    const transaction = database.transaction(
      ['documents', 'conflicts'],
      'readonly'
    );
    expect(
      await requestResult(
        transaction
          .objectStore('documents')
          .get([NAMESPACE, 'campaign_settings', 'ABC123'])
      )
    ).toBeTruthy();
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toHaveLength(1);
    await transactionComplete(transaction);
    database.close();
  });

  it('rejects missing, journaled, mismatched, and atomically aborted local generations', async () => {
    const database = await openRollkeeperDatabase();
    await expect(
      commitCampaignSettingsLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow(/CUTOVER_READY/i);
    await seedReady(database);
    const transaction = database.transaction('journal', 'readwrite');
    transaction.objectStore('journal').put({
      journalId: 'pending',
      namespace: NAMESPACE,
      generation: GENERATION,
      family: 'campaign_settings',
    });
    await transactionComplete(transaction);
    await expect(
      commitCampaignSettingsLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow(/journal/i);
    const clear = database.transaction('journal', 'readwrite');
    clear.objectStore('journal').clear();
    await transactionComplete(clear);
    await expect(
      commitCampaignSettingsLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
        initialDocument: {
          namespace: NAMESPACE,
          campaignId: 'wrong',
          legacyId: 'ABC',
          family: 'campaign_settings',
          cutoverEpoch: 1,
          operation: 'create',
          payload: {},
          schemaVersion: 1,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: 'a'.repeat(64),
          updatedAt: 'now',
          deletedAt: null,
        },
      })
    ).rejects.toThrow(/scope/i);
    await expect(
      commitCampaignSettingsLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
        testHooks: { abortPointerTransaction: true },
      })
    ).rejects.toThrow(/atomic/i);
    expect(
      await readCampaignSettingsAuthority(database, NAMESPACE, CAMPAIGN)
    ).toEqual({ authority: 'localStorage', epoch: 0 });
    database.close();
  });

  it('marks cloud authority with epoch CAS and makes local cutover replay idempotent', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    const local = await commitCampaignSettingsLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
    });
    await expect(
      commitCampaignSettingsLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'later',
      })
    ).resolves.toEqual(local);
    await expect(
      markCampaignSettingsCloudAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedLocalEpoch: 2,
        cloudEpoch: 2,
        now: () => 'cloud',
      })
    ).rejects.toThrow(/not ready/i);
    const cloud = await markCampaignSettingsCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 1,
      now: () => 'cloud',
    });
    expect(cloud).toMatchObject({ authority: 'postgres', epoch: 1 });
    await expect(
      rollbackCampaignSettingsLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: true,
        currentGenerationVerified: true,
        projectionJournalReconciled: false,
        now: () => 'rollback',
      })
    ).rejects.toThrow(/projection/i);
    database.close();
  });

  it('preserves a newer local working copy and outbox when cloud activation accepts the staged version', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitCampaignSettingsLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
      initialDocument: {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        legacyId: 'ABC123',
        family: 'campaign_settings',
        cutoverEpoch: 1,
        operation: 'create',
        payload: { stackableInspiration: true },
        schemaVersion: 1,
        localRevision: 1,
        baseServerVersion: 0,
        contentFingerprint: 'a'.repeat(64),
        updatedAt: 'local',
        deletedAt: null,
      },
    });
    const localChange = database.transaction(
      ['documents', 'outbox'],
      'readwrite'
    );
    localChange.objectStore('documents').put({
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      legacyId: 'ABC123',
      family: 'campaign_settings',
      cutoverEpoch: 1,
      operation: 'replace',
      payload: { stackableInspiration: false },
      schemaVersion: 1,
      localRevision: 2,
      baseServerVersion: 0,
      contentFingerprint: 'b'.repeat(64),
      updatedAt: 'changed',
      deletedAt: null,
    });
    localChange.objectStore('outbox').put({
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      legacyId: 'ABC123',
      family: 'campaign_settings',
      cutoverEpoch: 1,
      operation: 'replace',
      payload: { stackableInspiration: false },
      schemaVersion: 1,
      localRevision: 2,
      baseServerVersion: 0,
      contentFingerprint: 'b'.repeat(64),
      updatedAt: 'changed',
      mutationId: 'newer-local-change',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(localChange);

    await markCampaignSettingsCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 1,
      now: () => 'cloud',
      acceptedVersion: {
        legacyId: 'ABC123',
        serverVersion: 1,
        payloadFingerprint: 'a'.repeat(64),
      },
    });

    const verification = database.transaction(
      ['documents', 'outbox'],
      'readonly'
    );
    expect(
      await requestResult(
        verification
          .objectStore('documents')
          .get([NAMESPACE, 'campaign_settings', 'ABC123'])
      )
    ).toMatchObject({
      contentFingerprint: 'b'.repeat(64),
      baseServerVersion: 1,
      cutoverEpoch: 1,
      localRevision: 2,
    });
    expect(
      await requestResult(
        verification.objectStore('outbox').get('newer-local-change')
      )
    ).toMatchObject({
      contentFingerprint: 'b'.repeat(64),
      baseServerVersion: 1,
      cutoverEpoch: 1,
      state: 'queued',
    });
    await transactionComplete(verification);
    database.close();
  });

  it('supersedes stale intermediates when the accepted version matches the current working copy', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitCampaignSettingsLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
      initialDocument: {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        legacyId: 'ABC123',
        family: 'campaign_settings',
        cutoverEpoch: 1,
        operation: 'replace',
        payload: { stackableInspiration: true },
        schemaVersion: 1,
        localRevision: 3,
        baseServerVersion: 0,
        contentFingerprint: 'a'.repeat(64),
        updatedAt: 'current',
        deletedAt: null,
      },
    });
    const pending = database.transaction('outbox', 'readwrite');
    const outbox = pending.objectStore('outbox');
    for (const [mutationId, fingerprint, localRevision] of [
      ['intermediate', 'b'.repeat(64), 2],
      ['accepted', 'a'.repeat(64), 3],
    ] as const) {
      outbox.put({
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        legacyId: 'ABC123',
        family: 'campaign_settings',
        cutoverEpoch: 1,
        operation: 'replace',
        payload: { stackableInspiration: fingerprint.startsWith('a') },
        schemaVersion: 1,
        localRevision,
        baseServerVersion: 0,
        contentFingerprint: fingerprint,
        updatedAt: mutationId,
        mutationId,
        state: 'queued',
        attemptCount: 0,
        nextAttemptAt: 0,
        inflightAt: null,
        lastError: null,
      });
    }
    await transactionComplete(pending);

    await markCampaignSettingsCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 1,
      now: () => 'cloud',
      acceptedVersion: {
        legacyId: 'ABC123',
        serverVersion: 1,
        payloadFingerprint: 'a'.repeat(64),
      },
    });

    const verification = database.transaction('outbox', 'readonly');
    const entries = await requestResult(
      verification.objectStore('outbox').getAll()
    );
    expect(entries).toEqual([
      expect.objectContaining({ mutationId: 'accepted', state: 'superseded' }),
      expect.objectContaining({
        mutationId: 'intermediate',
        state: 'superseded',
      }),
    ]);
    await transactionComplete(verification);
    database.close();
  });

  it('rejects unsafe enrollment states and supports an exact tombstone hydration', async () => {
    const database = await openRollkeeperDatabase();
    const base = {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      campaignCode: 'ABC',
      deviceId: 'device',
      epoch: 1,
      confirmed: true,
      previewFingerprint: 'a'.repeat(64),
      payloadFingerprint: 'b'.repeat(64),
      payload: null,
      tombstoned: true,
      schemaVersion: 1,
      serverVersion: 1,
      localCandidate: null,
      preserveDivergentCandidate: false,
      now: () => 'now',
    } as const;
    await expect(
      enrollCampaignSettingsCloudDevice(database, { ...base, epoch: 0 })
    ).rejects.toThrow(/durable cloud/i);
    await expect(
      enrollCampaignSettingsCloudDevice(database, {
        ...base,
        localCandidate: { rawValue: 'raw', fingerprint: 'c'.repeat(64) },
      })
    ).rejects.toThrow(/preserved/i);
    await expect(
      enrollCampaignSettingsCloudDevice(database, base)
    ).resolves.toMatchObject({ authority: 'postgres' });
    await expect(
      enrollCampaignSettingsCloudDevice(database, base)
    ).rejects.toThrow(/already/i);
    database.close();
  });
});
