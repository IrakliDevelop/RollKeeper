import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import type { MagicItemPayload } from '@/lib/durableDm/magicItemFamily';

import {
  commitMagicItemLocalCutover,
  enrollMagicItemCloudDevice,
  markMagicItemCloudAuthority,
  readMagicItemAuthority,
  rollbackMagicItemLocalAuthority,
} from '../magicItemAuthority';
import type { MagicItemDocument } from '../magicItemRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

const NAMESPACE = 'user:account-a' as const;
const CAMPAIGN = 'campaign-a';
const GENERATION = 'magic-item-generation';
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

function document(
  overrides: Partial<MagicItemDocument> = {}
): MagicItemDocument {
  return {
    namespace: NAMESPACE,
    campaignId: CAMPAIGN,
    legacyId: 'item-a',
    family: 'magic_item',
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
    key: `migration-state:${NAMESPACE}:magic_item:${CAMPAIGN}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-dm-magic-item-library',
    presence: true,
    rawValue: '{"state":{"itemsByCampaign":{}},"version":1}',
  });
  await transactionComplete(transaction);
}

describe('magic item local authority', () => {
  afterEach(() => deleteRollkeeperDatabaseForTests(indexedDB));

  it('requires every safety gate and explicit confirmation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    for (const field of Object.keys(gates) as Array<keyof typeof gates>) {
      await expect(
        commitMagicItemLocalCutover(database, {
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
      commitMagicItemLocalCutover(database, {
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
    const authority = await commitMagicItemLocalCutover(database, {
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
      family: 'magic_item',
      generation: GENERATION,
      committedAt: 'now',
    });
    expect(await readMagicItemAuthority(database, NAMESPACE, CAMPAIGN)).toEqual(
      authority
    );
    expect(await readMagicItemAuthority(database, NAMESPACE, 'other')).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    const meta = database.transaction('meta', 'readonly');
    expect(
      await requestResult(
        meta
          .objectStore('meta')
          .get(`migration-state:${NAMESPACE}:magic_item:${CAMPAIGN}`)
      )
    ).toMatchObject({ state: 'IDB_PRIMARY', checkpointAt: 'now' });
    await transactionComplete(meta);
    database.close();
  });

  it('writes every initial document inside the cutover transaction', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitMagicItemLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'now',
      initialDocuments: [
        document({ legacyId: 'item-a' }),
        document({
          legacyId: 'item-b',
          payload: payload({ name: 'Plain Cloak' }),
          contentFingerprint: 'b'.repeat(64),
        }),
      ],
    });
    const read = database.transaction('documents', 'readonly');
    const stored = (await requestResult(
      read.objectStore('documents').getAll()
    )) as MagicItemDocument[];
    await transactionComplete(read);
    expect(stored.map(row => row.legacyId).sort()).toEqual([
      'item-a',
      'item-b',
    ]);
    expect(stored.every(row => row.family === 'magic_item')).toBe(true);
    database.close();
  });

  it('rolls back through a new epoch only from a verified current generation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitMagicItemLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'cutover',
    });
    await expect(
      rollbackMagicItemLocalAuthority(database, {
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
      rollbackMagicItemLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: true,
        currentGenerationVerified: false,
        now: () => 'rollback',
      })
    ).rejects.toThrow(/verified current generation/i);
    const rolledBack = await rollbackMagicItemLocalAuthority(database, {
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
      family: 'magic_item',
      rollbackGeneration: GENERATION,
      committedAt: 'rollback',
    });
    await expect(
      rollbackMagicItemLocalAuthority(database, {
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
      commitMagicItemLocalCutover(database, {
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
      key: `migration-state:${NAMESPACE}:magic_item:${CAMPAIGN}`,
      state: 'CUTOVER_READY',
      runId: GENERATION,
    });
    await transactionComplete(stateOnly);
    await expect(
      commitMagicItemLocalCutover(database, {
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
      family: 'magic_item',
    });
    await transactionComplete(transaction);
    await expect(
      commitMagicItemLocalCutover(database, {
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
      commitMagicItemLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
        initialDocuments: [
          document({ legacyId: 'item-a' }),
          document({ legacyId: 'item-b', campaignId: 'wrong' }),
        ],
      })
    ).rejects.toThrow(/scope/i);
    await expect(
      commitMagicItemLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
        testHooks: { abortPointerTransaction: true },
      })
    ).rejects.toThrow(/atomic/i);
    expect(await readMagicItemAuthority(database, NAMESPACE, CAMPAIGN)).toEqual(
      {
        authority: 'localStorage',
        epoch: 0,
      }
    );
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
    const local = await commitMagicItemLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
    });
    await expect(
      commitMagicItemLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'later',
      })
    ).resolves.toEqual(local);
    await expect(
      markMagicItemCloudAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedLocalEpoch: 2,
        cloudEpoch: 2,
        now: () => 'cloud',
      })
    ).rejects.toThrow(/not ready/i);
    await expect(
      markMagicItemCloudAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedLocalEpoch: 1,
        cloudEpoch: 0,
        now: () => 'cloud',
      })
    ).rejects.toThrow(/not ready/i);
    const cloud = await markMagicItemCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 1,
      now: () => 'cloud',
    });
    expect(cloud).toMatchObject({
      authority: 'postgres',
      epoch: 1,
      family: 'magic_item',
      committedAt: 'cloud',
    });
    expect(await readMagicItemAuthority(database, NAMESPACE, CAMPAIGN)).toEqual(
      cloud
    );
    database.close();
  });

  it('supersedes matching accepted versions and rebases divergent ones per item', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitMagicItemLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
      initialDocuments: [
        document({ legacyId: 'item-a', contentFingerprint: 'a'.repeat(64) }),
        document({ legacyId: 'item-b', contentFingerprint: 'b'.repeat(64) }),
        document({ legacyId: 'item-c', contentFingerprint: 'c'.repeat(64) }),
      ],
    });
    const localChange = database.transaction(
      ['documents', 'outbox'],
      'readwrite'
    );
    const outbox = localChange.objectStore('outbox');
    // item-a: outbox entry matches the accepted server fingerprint -> superseded
    outbox.put({
      ...document({ legacyId: 'item-a', contentFingerprint: 'a'.repeat(64) }),
      mutationId: 'accepted-a',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: '2026-08-20T00:00:00.000Z',
      lastError: 'boom',
    });
    // item-b: local edit diverged from the accepted version -> rebased + un-paused
    localChange.objectStore('documents').put(
      document({
        legacyId: 'item-b',
        localRevision: 2,
        operation: 'replace',
        contentFingerprint: 'd'.repeat(64),
        updatedAt: 'changed',
      })
    );
    outbox.put({
      ...document({
        legacyId: 'item-b',
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
    // item-c: not part of the accepted batch -> base version untouched
    outbox.put({
      ...document({
        legacyId: 'item-c',
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
      ...document({ legacyId: 'item-a', contentFingerprint: 'a'.repeat(64) }),
      mutationId: 'done-a',
      state: 'acknowledged',
      attemptCount: 1,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    // another campaign is untouched
    outbox.put({
      ...document({ legacyId: 'item-z', campaignId: 'campaign-z' }),
      mutationId: 'other-campaign',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(localChange);

    await markMagicItemCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 3,
      now: () => 'cloud',
      acceptedVersions: [
        {
          legacyId: 'item-a',
          serverVersion: 1,
          payloadFingerprint: 'a'.repeat(64),
        },
        {
          legacyId: 'item-b',
          serverVersion: 2,
          payloadFingerprint: 'b'.repeat(64),
        },
        {
          legacyId: 'item-missing',
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
      await requestResult(documents.get([NAMESPACE, 'magic_item', 'item-a']))
    ).toMatchObject({ baseServerVersion: 1, cutoverEpoch: 3 });
    expect(
      await requestResult(documents.get([NAMESPACE, 'magic_item', 'item-b']))
    ).toMatchObject({
      baseServerVersion: 2,
      cutoverEpoch: 3,
      localRevision: 2,
      contentFingerprint: 'd'.repeat(64),
    });
    expect(
      await requestResult(documents.get([NAMESPACE, 'magic_item', 'item-c']))
    ).toMatchObject({ baseServerVersion: 0, cutoverEpoch: 1 });
    expect(
      await requestResult(
        documents.get([NAMESPACE, 'magic_item', 'item-missing'])
      )
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

  it('un-pauses a paused entry without a recorded prior state', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitMagicItemLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
    });
    const seed = database.transaction('outbox', 'readwrite');
    seed.objectStore('outbox').put({
      ...document({ legacyId: 'item-a' }),
      mutationId: 'paused-a',
      state: 'paused',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(seed);
    await markMagicItemCloudAuthority(database, {
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
        legacyId: 'item-a',
        payload: payload(),
        payloadFingerprint: 'b'.repeat(64),
        tombstoned: false,
        schemaVersion: 1,
        serverVersion: 7,
      },
      {
        legacyId: 'item-b',
        payload: null,
        payloadFingerprint: 'd'.repeat(64),
        tombstoned: true,
        schemaVersion: 1,
        serverVersion: 3,
      },
    ];
    await expect(
      enrollMagicItemCloudDevice(database, {
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
    const authority = await enrollMagicItemCloudDevice(database, {
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
      family: 'magic_item',
      generation: 'cloud-enrollment:device-a',
    });
    const transaction = database.transaction(
      ['documents', 'conflicts', 'tombstones', 'meta'],
      'readonly'
    );
    expect(
      await requestResult(
        transaction
          .objectStore('documents')
          .get([NAMESPACE, 'magic_item', 'item-a'])
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
        transaction
          .objectStore('documents')
          .get([NAMESPACE, 'magic_item', 'item-b'])
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
        legacyId: 'item-b',
        family: 'magic_item',
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
        conflictId: `magic-item-enrollment:${NAMESPACE}:${CAMPAIGN}:device-a`,
        legacyId: 'ABC123',
        family: 'magic_item',
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
          .get(`device-enrollment:${NAMESPACE}:magic_item:${CAMPAIGN}:device-a`)
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
          legacyId: 'item-a',
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
      enrollMagicItemCloudDevice(database, { ...base, epoch: 0 })
    ).rejects.toThrow(/durable cloud/i);
    await expect(
      enrollMagicItemCloudDevice(database, {
        ...base,
        documents: [{ ...base.documents[0], serverVersion: 0 }],
      })
    ).rejects.toThrow(/durable cloud/i);
    await expect(
      enrollMagicItemCloudDevice(database, {
        ...base,
        localCandidate: { rawValue: 'raw', fingerprint: 'c'.repeat(64) },
      })
    ).rejects.toThrow(/preserved/i);
    await expect(
      enrollMagicItemCloudDevice(database, base)
    ).resolves.toMatchObject({ authority: 'postgres' });
    await expect(enrollMagicItemCloudDevice(database, base)).rejects.toThrow(
      /already/i
    );
    database.close();
  });

  it('enrolls after a rollback left a localStorage pointer behind', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitMagicItemLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'cutover',
    });
    await rollbackMagicItemLocalAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedEpoch: 1,
      generation: GENERATION,
      confirmed: true,
      currentGenerationVerified: true,
      now: () => 'rollback',
    });
    await expect(
      enrollMagicItemCloudDevice(database, {
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
