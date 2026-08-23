import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import type { NpcPayload } from '@/lib/durableDm/npcFamily';

import {
  commitNpcLocalCutover,
  enrollNpcCloudDevice,
  markNpcCloudAuthority,
  readNpcAuthority,
  rollbackNpcLocalAuthority,
} from '../npcAuthority';
import type { NpcDocument } from '../npcRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

const NAMESPACE = 'user:account-a' as const;
const CAMPAIGN = 'campaign-a';
const GENERATION = 'npc-generation';
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

function payload(overrides: Partial<NpcPayload> = {}): NpcPayload {
  return {
    name: 'Watch Captain',
    armorClass: '13',
    maxHp: 10,
    speed: '30 ft.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function document(overrides: Partial<NpcDocument> = {}): NpcDocument {
  return {
    namespace: NAMESPACE,
    campaignId: CAMPAIGN,
    legacyId: 'npc-a',
    family: 'npc',
    cutoverEpoch: 1,
    operation: 'create',
    payload: payload(),
    schemaVersion: 1,
    localRevision: 1,
    baseServerVersion: 0,
    contentFingerprint: 'a'.repeat(64),
    updatedAt: 'local',
    deletedAt: null,
    ...overrides,
  };
}

async function seedReady(database: IDBDatabase) {
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:npc:${CAMPAIGN}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-npc-data',
    presence: true,
    rawValue: '{"state":{"npcsByCampaign":{}},"version":4}',
  });
  await transactionComplete(transaction);
}

describe('npc local authority', () => {
  afterEach(() => deleteRollkeeperDatabaseForTests(indexedDB));

  it('requires every safety gate and explicit confirmation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    for (const field of Object.keys(gates) as Array<keyof typeof gates>) {
      await expect(
        commitNpcLocalCutover(database, {
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
      commitNpcLocalCutover(database, {
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
    const authority = await commitNpcLocalCutover(database, {
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
      family: 'npc',
      generation: GENERATION,
      committedAt: 'now',
    });
    expect(await readNpcAuthority(database, NAMESPACE, CAMPAIGN)).toEqual(
      authority
    );
    expect(await readNpcAuthority(database, NAMESPACE, 'other')).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    const meta = database.transaction('meta', 'readonly');
    expect(
      await requestResult(
        meta
          .objectStore('meta')
          .get(`migration-state:${NAMESPACE}:npc:${CAMPAIGN}`)
      )
    ).toMatchObject({ state: 'IDB_PRIMARY', checkpointAt: 'now' });
    await transactionComplete(meta);
    database.close();
  });

  it('writes every initial document inside the cutover transaction', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitNpcLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'now',
      initialDocuments: [
        document({ legacyId: 'npc-a' }),
        document({
          legacyId: 'npc-b',
          payload: payload({ name: 'Stable Hand' }),
          contentFingerprint: 'b'.repeat(64),
        }),
      ],
    });
    const read = database.transaction('documents', 'readonly');
    const stored = (await requestResult(
      read.objectStore('documents').getAll()
    )) as NpcDocument[];
    await transactionComplete(read);
    expect(stored.map(row => row.legacyId).sort()).toEqual(['npc-a', 'npc-b']);
    expect(stored.every(row => row.family === 'npc')).toBe(true);
    database.close();
  });

  it('rolls back through a new epoch only from a verified current generation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitNpcLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'cutover',
    });
    await expect(
      rollbackNpcLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: false,
        currentGenerationVerified: true,
        now: () => 'rollback',
      })
    ).rejects.toThrow(/confirmation/i);
    await expect(
      rollbackNpcLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: true,
        currentGenerationVerified: false,
        now: () => 'rollback',
      })
    ).rejects.toThrow(/verified current generation/i);
    const rolledBack = await rollbackNpcLocalAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedEpoch: 1,
      generation: GENERATION,
      confirmed: true,
      currentGenerationVerified: true,
      now: () => 'rollback',
    });
    expect(rolledBack).toMatchObject({
      authority: 'localStorage',
      epoch: 2,
      family: 'npc',
      rollbackGeneration: GENERATION,
      committedAt: 'rollback',
    });
    await expect(
      rollbackNpcLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: true,
        currentGenerationVerified: true,
        now: () => 'stale',
      })
    ).rejects.toThrow(/stale/i);
    database.close();
  });

  it('rejects missing, journaled, mismatched, and atomically aborted local generations', async () => {
    const database = await openRollkeeperDatabase();
    await expect(
      commitNpcLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow(/CUTOVER_READY/i);
    const stateOnly = database.transaction('meta', 'readwrite');
    stateOnly.objectStore('meta').put({
      key: `migration-state:${NAMESPACE}:npc:${CAMPAIGN}`,
      state: 'CUTOVER_READY',
      runId: GENERATION,
    });
    await transactionComplete(stateOnly);
    await expect(
      commitNpcLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow(/generation is missing/i);
    await seedReady(database);
    const transaction = database.transaction('journal', 'readwrite');
    transaction.objectStore('journal').put({
      journalId: 'pending',
      namespace: NAMESPACE,
      generation: GENERATION,
      family: 'npc',
    });
    await transactionComplete(transaction);
    await expect(
      commitNpcLocalCutover(database, {
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
      commitNpcLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
        initialDocuments: [
          document({ legacyId: 'npc-a' }),
          document({ legacyId: 'npc-b', campaignId: 'wrong' }),
        ],
      })
    ).rejects.toThrow(/scope/i);
    await expect(
      commitNpcLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
        testHooks: { abortPointerTransaction: true },
      })
    ).rejects.toThrow(/atomic/i);
    expect(await readNpcAuthority(database, NAMESPACE, CAMPAIGN)).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    const read = database.transaction('documents', 'readonly');
    expect(
      await requestResult(read.objectStore('documents').getAll())
    ).toHaveLength(0);
    await transactionComplete(read);
    database.close();
  });

  it('marks cloud authority with epoch CAS and makes local cutover replay idempotent', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    const local = await commitNpcLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
    });
    await expect(
      commitNpcLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'later',
      })
    ).resolves.toEqual(local);
    await expect(
      markNpcCloudAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedLocalEpoch: 2,
        cloudEpoch: 2,
        now: () => 'cloud',
      })
    ).rejects.toThrow(/not ready/i);
    await expect(
      markNpcCloudAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedLocalEpoch: 1,
        cloudEpoch: 0,
        now: () => 'cloud',
      })
    ).rejects.toThrow(/not ready/i);
    const cloud = await markNpcCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 1,
      now: () => 'cloud',
    });
    expect(cloud).toMatchObject({
      authority: 'postgres',
      epoch: 1,
      family: 'npc',
      committedAt: 'cloud',
    });
    expect(await readNpcAuthority(database, NAMESPACE, CAMPAIGN)).toEqual(
      cloud
    );
    database.close();
  });

  it('supersedes matching accepted versions and rebases divergent ones per npc', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitNpcLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
      initialDocuments: [
        document({ legacyId: 'npc-a', contentFingerprint: 'a'.repeat(64) }),
        document({ legacyId: 'npc-b', contentFingerprint: 'b'.repeat(64) }),
        document({ legacyId: 'npc-c', contentFingerprint: 'c'.repeat(64) }),
      ],
    });
    const localChange = database.transaction(
      ['documents', 'outbox'],
      'readwrite'
    );
    const outbox = localChange.objectStore('outbox');
    // npc-a: outbox entry matches the accepted server fingerprint -> superseded
    outbox.put({
      ...document({ legacyId: 'npc-a', contentFingerprint: 'a'.repeat(64) }),
      mutationId: 'accepted-a',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: '2026-08-20T00:00:00.000Z',
      lastError: 'boom',
    });
    // npc-b: local edit diverged from the accepted version -> rebased + un-paused
    localChange.objectStore('documents').put(
      document({
        legacyId: 'npc-b',
        localRevision: 2,
        operation: 'replace',
        contentFingerprint: 'd'.repeat(64),
        updatedAt: 'changed',
      })
    );
    outbox.put({
      ...document({
        legacyId: 'npc-b',
        localRevision: 2,
        operation: 'replace',
        contentFingerprint: 'd'.repeat(64),
        updatedAt: 'changed',
      }),
      mutationId: 'divergent-b',
      state: 'paused',
      pausedFromState: 'retry',
      attemptCount: 3,
      nextAttemptAt: 99,
      inflightAt: '2026-08-20T00:00:00.000Z',
      lastError: 'paused for cutover',
    });
    // npc-c: not part of the accepted batch -> base version untouched
    outbox.put({
      ...document({
        legacyId: 'npc-c',
        baseServerVersion: 4,
        contentFingerprint: 'c'.repeat(64),
      }),
      mutationId: 'untouched-c',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    // already resolved entries are never rewritten
    outbox.put({
      ...document({ legacyId: 'npc-a', contentFingerprint: 'a'.repeat(64) }),
      mutationId: 'done-a',
      state: 'acknowledged',
      attemptCount: 1,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    // another campaign is untouched
    outbox.put({
      ...document({ legacyId: 'npc-z', campaignId: 'campaign-z' }),
      mutationId: 'other-campaign',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(localChange);

    await markNpcCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 3,
      now: () => 'cloud',
      acceptedVersions: [
        {
          legacyId: 'npc-a',
          serverVersion: 1,
          payloadFingerprint: 'a'.repeat(64),
        },
        {
          legacyId: 'npc-b',
          serverVersion: 2,
          payloadFingerprint: 'b'.repeat(64),
        },
        {
          legacyId: 'npc-missing',
          serverVersion: 9,
          payloadFingerprint: 'e'.repeat(64),
        },
      ],
    });

    const verification = database.transaction(
      ['documents', 'outbox'],
      'readonly'
    );
    const documents = verification.objectStore('documents');
    const entries = verification.objectStore('outbox');
    expect(
      await requestResult(documents.get([NAMESPACE, 'npc', 'npc-a']))
    ).toMatchObject({ baseServerVersion: 1, cutoverEpoch: 3 });
    expect(
      await requestResult(documents.get([NAMESPACE, 'npc', 'npc-b']))
    ).toMatchObject({
      baseServerVersion: 2,
      cutoverEpoch: 3,
      localRevision: 2,
      contentFingerprint: 'd'.repeat(64),
    });
    expect(
      await requestResult(documents.get([NAMESPACE, 'npc', 'npc-c']))
    ).toMatchObject({ baseServerVersion: 0, cutoverEpoch: 1 });
    expect(
      await requestResult(documents.get([NAMESPACE, 'npc', 'npc-missing']))
    ).toBeUndefined();
    expect(await requestResult(entries.get('accepted-a'))).toMatchObject({
      state: 'superseded',
      inflightAt: null,
      lastError: null,
    });
    expect(await requestResult(entries.get('divergent-b'))).toMatchObject({
      state: 'retry',
      baseServerVersion: 2,
      cutoverEpoch: 3,
      inflightAt: null,
      lastError: null,
    });
    expect(await requestResult(entries.get('untouched-c'))).toMatchObject({
      state: 'queued',
      baseServerVersion: 4,
      cutoverEpoch: 3,
    });
    expect(await requestResult(entries.get('done-a'))).toMatchObject({
      state: 'acknowledged',
      cutoverEpoch: 1,
    });
    expect(await requestResult(entries.get('other-campaign'))).toMatchObject({
      state: 'queued',
      cutoverEpoch: 1,
    });
    await transactionComplete(verification);
    database.close();
  });

  it('keeps only the newest unresolved entry per npc at cloud activation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitNpcLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
      initialDocuments: [
        document({ legacyId: 'npc-a', contentFingerprint: 'a'.repeat(64) }),
        document({ legacyId: 'npc-b', contentFingerprint: 'b'.repeat(64) }),
      ],
    });
    const seed = database.transaction('outbox', 'readwrite');
    const outbox = seed.objectStore('outbox');
    // Three paused edits of npc-a: only the highest local revision survives.
    outbox.put({
      ...document({
        legacyId: 'npc-a',
        localRevision: 2,
        contentFingerprint: 'c'.repeat(64),
        updatedAt: '2026-08-20T00:00:00.000Z',
      }),
      mutationId: 'stale-a',
      state: 'paused',
      pausedFromState: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    outbox.put({
      ...document({
        legacyId: 'npc-a',
        localRevision: 3,
        contentFingerprint: 'd'.repeat(64),
        updatedAt: '2026-08-20T00:00:00.000Z',
      }),
      mutationId: 'older-tie-a',
      state: 'paused',
      pausedFromState: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    outbox.put({
      ...document({
        legacyId: 'npc-a',
        localRevision: 3,
        contentFingerprint: 'e'.repeat(64),
        updatedAt: '2026-08-21T00:00:00.000Z',
      }),
      mutationId: 'newest-a',
      state: 'paused',
      pausedFromState: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    // npc-b: the newest of two paused edits already matches the cloud
    // fingerprint, so it is superseded rather than rebased.
    outbox.put({
      ...document({
        legacyId: 'npc-b',
        localRevision: 2,
        contentFingerprint: 'f'.repeat(64),
        updatedAt: '2026-08-20T00:00:00.000Z',
      }),
      mutationId: 'stale-b',
      state: 'paused',
      pausedFromState: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    outbox.put({
      ...document({
        legacyId: 'npc-b',
        localRevision: 3,
        contentFingerprint: 'b'.repeat(64),
        updatedAt: '2026-08-21T00:00:00.000Z',
      }),
      mutationId: 'newest-b',
      state: 'paused',
      pausedFromState: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(seed);

    await markNpcCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 2,
      now: () => 'cloud',
      acceptedVersions: [
        {
          legacyId: 'npc-a',
          serverVersion: 1,
          payloadFingerprint: 'a'.repeat(64),
        },
        {
          legacyId: 'npc-b',
          serverVersion: 1,
          payloadFingerprint: 'b'.repeat(64),
        },
      ],
    });

    const read = database.transaction('outbox', 'readonly');
    const entries = read.objectStore('outbox');
    expect(await requestResult(entries.get('stale-a'))).toMatchObject({
      state: 'superseded',
      inflightAt: null,
      lastError: null,
    });
    expect(await requestResult(entries.get('older-tie-a'))).toMatchObject({
      state: 'superseded',
    });
    expect(await requestResult(entries.get('newest-a'))).toMatchObject({
      state: 'queued',
      baseServerVersion: 1,
      cutoverEpoch: 2,
      contentFingerprint: 'e'.repeat(64),
    });
    expect(await requestResult(entries.get('stale-b'))).toMatchObject({
      state: 'superseded',
    });
    expect(await requestResult(entries.get('newest-b'))).toMatchObject({
      state: 'superseded',
    });
    await transactionComplete(read);
    database.close();
  });

  it('un-pauses a paused entry without a recorded prior state', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitNpcLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
    });
    const seed = database.transaction('outbox', 'readwrite');
    seed.objectStore('outbox').put({
      ...document({ legacyId: 'npc-a' }),
      mutationId: 'paused-a',
      state: 'paused',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(seed);
    await markNpcCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 2,
      now: () => 'cloud',
      acceptedVersions: [],
    });
    const read = database.transaction('outbox', 'readonly');
    expect(
      await requestResult(read.objectStore('outbox').get('paused-a'))
    ).toMatchObject({ state: 'queued', cutoverEpoch: 2, baseServerVersion: 0 });
    await transactionComplete(read);
    database.close();
  });

  it('hydrates a new device from the cloud document set and preserves a divergent local candidate', async () => {
    const database = await openRollkeeperDatabase();
    const documents = [
      {
        legacyId: 'npc-a',
        payload: payload(),
        payloadFingerprint: 'b'.repeat(64),
        tombstoned: false,
        schemaVersion: 1,
        serverVersion: 7,
      },
      {
        legacyId: 'npc-b',
        payload: null,
        payloadFingerprint: 'd'.repeat(64),
        tombstoned: true,
        schemaVersion: 1,
        serverVersion: 3,
      },
    ];
    await expect(
      enrollNpcCloudDevice(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        campaignCode: 'ABC123',
        deviceId: 'device-a',
        epoch: 4,
        confirmed: false,
        previewFingerprint: 'a'.repeat(64),
        documents,
        localCandidate: {
          rawValue: 'legacy-bytes',
          fingerprint: 'c'.repeat(64),
        },
        preserveDivergentCandidate: true,
        now: () => 'now',
      })
    ).rejects.toThrow(/confirmation/i);
    const authority = await enrollNpcCloudDevice(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      campaignCode: 'ABC123',
      deviceId: 'device-a',
      epoch: 4,
      confirmed: true,
      previewFingerprint: 'a'.repeat(64),
      documents,
      localCandidate: { rawValue: 'legacy-bytes', fingerprint: 'c'.repeat(64) },
      preserveDivergentCandidate: true,
      now: () => 'now',
    });
    expect(authority).toMatchObject({
      authority: 'postgres',
      epoch: 4,
      family: 'npc',
      generation: 'cloud-enrollment:device-a',
    });
    const transaction = database.transaction(
      ['documents', 'conflicts', 'tombstones', 'meta'],
      'readonly'
    );
    expect(
      await requestResult(
        transaction.objectStore('documents').get([NAMESPACE, 'npc', 'npc-a'])
      )
    ).toMatchObject({
      operation: 'replace',
      localRevision: 1,
      baseServerVersion: 7,
      cutoverEpoch: 4,
      contentFingerprint: 'b'.repeat(64),
      deletedAt: null,
    });
    expect(
      await requestResult(
        transaction.objectStore('documents').get([NAMESPACE, 'npc', 'npc-b'])
      )
    ).toMatchObject({
      operation: 'delete',
      payload: null,
      baseServerVersion: 3,
      deletedAt: 'now',
    });
    const tombstones = await requestResult(
      transaction.objectStore('tombstones').getAll()
    );
    expect(tombstones).toHaveLength(1);
    expect(tombstones).toMatchObject([
      {
        legacyId: 'npc-b',
        family: 'npc',
        localRevision: 1,
        deletedAt: 'now',
        mutationId: 'cloud:3',
        beforeImage: null,
      },
    ]);
    const conflicts = await requestResult(
      transaction.objectStore('conflicts').getAll()
    );
    expect(conflicts).toMatchObject([
      {
        conflictId: `npc-enrollment:${NAMESPACE}:${CAMPAIGN}:device-a`,
        legacyId: 'ABC123',
        family: 'npc',
        kind: 'preserved-device-legacy-candidate',
        rawValue: 'legacy-bytes',
        rawFingerprint: 'c'.repeat(64),
        cloudPreviewFingerprint: 'a'.repeat(64),
        resolutionState: 'preserved',
      },
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get(`device-enrollment:${NAMESPACE}:npc:${CAMPAIGN}:device-a`)
      )
    ).toMatchObject({
      previewFingerprint: 'a'.repeat(64),
      epoch: 4,
      state: 'enrolled',
      committedAt: 'now',
    });
    await transactionComplete(transaction);
    database.close();
  });

  it('rejects unsafe enrollment states', async () => {
    const database = await openRollkeeperDatabase();
    const base = {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      campaignCode: 'ABC',
      deviceId: 'device',
      epoch: 1,
      confirmed: true,
      previewFingerprint: 'a'.repeat(64),
      documents: [
        {
          legacyId: 'npc-a',
          payload: null,
          payloadFingerprint: 'b'.repeat(64),
          tombstoned: true,
          schemaVersion: 1,
          serverVersion: 1,
        },
      ],
      localCandidate: null,
      preserveDivergentCandidate: false,
      now: () => 'now',
    } as const;
    await expect(
      enrollNpcCloudDevice(database, { ...base, epoch: 0 })
    ).rejects.toThrow(/durable cloud/i);
    await expect(
      enrollNpcCloudDevice(database, {
        ...base,
        documents: [{ ...base.documents[0], serverVersion: 0 }],
      })
    ).rejects.toThrow(/durable cloud/i);
    await expect(
      enrollNpcCloudDevice(database, {
        ...base,
        localCandidate: { rawValue: 'raw', fingerprint: 'c'.repeat(64) },
      })
    ).rejects.toThrow(/preserved/i);
    await expect(enrollNpcCloudDevice(database, base)).resolves.toMatchObject({
      authority: 'postgres',
    });
    await expect(enrollNpcCloudDevice(database, base)).rejects.toThrow(
      /already/i
    );
    database.close();
  });

  it('enrolls after a rollback left a localStorage pointer behind', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitNpcLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'cutover',
    });
    await rollbackNpcLocalAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedEpoch: 1,
      generation: GENERATION,
      confirmed: true,
      currentGenerationVerified: true,
      now: () => 'rollback',
    });
    await expect(
      enrollNpcCloudDevice(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        campaignCode: 'ABC',
        deviceId: 'device',
        epoch: 5,
        confirmed: true,
        previewFingerprint: 'a'.repeat(64),
        documents: [],
        localCandidate: null,
        preserveDivergentCandidate: false,
        now: () => 'now',
      })
    ).resolves.toMatchObject({ authority: 'postgres', epoch: 5 });
    const read = database.transaction(['documents', 'conflicts'], 'readonly');
    expect(
      await requestResult(read.objectStore('documents').getAll())
    ).toHaveLength(0);
    expect(
      await requestResult(read.objectStore('conflicts').getAll())
    ).toHaveLength(0);
    await transactionComplete(read);
    database.close();
  });
});
