import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import type { CombatLogArchivePayload } from '@/lib/durableDm/combatLogArchiveFamily';

import {
  commitCombatLogArchiveLocalCutover,
  enrollCombatLogArchiveCloudDevice,
  markCombatLogArchiveCloudAuthority,
  readCombatLogArchiveAuthority,
  rollbackCombatLogArchiveLocalAuthority,
  type CombatLogArchiveEnrollmentDocument,
} from '../combatLogArchiveAuthority';
import type { CombatLogArchiveDocument } from '../combatLogArchiveRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

const NAMESPACE = 'user:account-a' as const;
const CAMPAIGN = 'campaign-a';
const GENERATION = 'combat-log-archive-generation';
const FAMILY = 'combat_log_archive';
/** The legacy key the family reads; pinned verbatim, not derived. */
const LEGACY_KEY = 'rollkeeper-combat-log';
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

function document(
  overrides: Partial<CombatLogArchiveDocument> = {}
): CombatLogArchiveDocument {
  return {
    namespace: NAMESPACE,
    campaignId: CAMPAIGN,
    legacyId: 'archive-a',
    family: FAMILY,
    cutoverEpoch: 1,
    operation: 'create',
    payload: payload(),
    schemaVersion: 2,
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
    key: `migration-state:${NAMESPACE}:${FAMILY}:${CAMPAIGN}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: LEGACY_KEY,
    presence: true,
    rawValue: '{"state":{"encounters":{}},"version":2}',
  });
  await transactionComplete(transaction);
}

describe('combat log archive local authority', () => {
  afterEach(() => deleteRollkeeperDatabaseForTests(indexedDB));

  it('requires every safety gate and explicit confirmation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    for (const field of Object.keys(gates) as Array<keyof typeof gates>) {
      await expect(
        commitCombatLogArchiveLocalCutover(database, {
          namespace: NAMESPACE,
          campaignId: CAMPAIGN,
          generation: GENERATION,
          confirmed: true,
          gates: { ...gates, [field]: false },
          now: () => 'now',
        })
      ).rejects.toThrow('Combat log archive cutover gate is not satisfied');
    }
    await expect(
      commitCombatLogArchiveLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: false,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow('Combat log archive cutover requires confirmation');
    // No gate rejection may leave a pointer behind.
    expect(
      await readCombatLogArchiveAuthority(database, NAMESPACE, CAMPAIGN)
    ).toEqual({ authority: 'localStorage', epoch: 0 });
    database.close();
  });

  it('atomically advances only the scoped family epoch', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    const authority = await commitCombatLogArchiveLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'now',
    });
    expect(authority).toEqual({
      authority: 'indexedDB',
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      family: FAMILY,
      generation: GENERATION,
      epoch: 1,
      committedAt: 'now',
    });
    expect(
      await readCombatLogArchiveAuthority(database, NAMESPACE, CAMPAIGN)
    ).toEqual(authority);
    expect(
      await readCombatLogArchiveAuthority(database, NAMESPACE, 'other')
    ).toEqual({ authority: 'localStorage', epoch: 0 });
    const meta = database.transaction('meta', 'readonly');
    expect(
      await requestResult(
        meta
          .objectStore('meta')
          .get(`migration-state:${NAMESPACE}:${FAMILY}:${CAMPAIGN}`)
      )
    ).toMatchObject({
      state: 'IDB_PRIMARY',
      checkpointAt: 'now',
      runId: GENERATION,
    });
    expect(
      await requestResult(
        meta
          .objectStore('meta')
          .get(`cutover-epoch:${NAMESPACE}:${FAMILY}:${CAMPAIGN}`)
      )
    ).toMatchObject({ value: 1 });
    await transactionComplete(meta);
    database.close();
  });

  it('writes every initial document inside the cutover transaction', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    const initialDocuments = [
      document({ legacyId: 'archive-a' }),
      document({
        legacyId: 'archive-b',
        payload: payload({
          encounterId: 'encounter-bbb222',
          endedAt: undefined,
        }),
        contentFingerprint: 'b'.repeat(64),
      }),
    ];
    await commitCombatLogArchiveLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'now',
      initialDocuments,
    });
    const read = database.transaction('documents', 'readonly');
    const stored = (await requestResult(
      read.objectStore('documents').getAll()
    )) as CombatLogArchiveDocument[];
    await transactionComplete(read);
    expect(
      [...stored].sort((left, right) =>
        left.legacyId.localeCompare(right.legacyId)
      )
    ).toEqual(initialDocuments);
    database.close();
  });

  it('rolls back through a new epoch only from a verified current generation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitCombatLogArchiveLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'cutover',
    });
    await expect(
      rollbackCombatLogArchiveLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: false,
        currentGenerationVerified: true,
        now: () => 'rollback',
      })
    ).rejects.toThrow('Combat log archive rollback requires confirmation');
    await expect(
      rollbackCombatLogArchiveLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: true,
        currentGenerationVerified: false,
        now: () => 'rollback',
      })
    ).rejects.toThrow('A verified current generation is required');
    // A generation that is not the committed one is refused at the boundary.
    await expect(
      rollbackCombatLogArchiveLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: `${GENERATION}-other`,
        confirmed: true,
        currentGenerationVerified: true,
        now: () => 'rollback',
      })
    ).rejects.toThrow('Stale combat log archive authority epoch');
    const rolledBack = await rollbackCombatLogArchiveLocalAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedEpoch: 1,
      generation: GENERATION,
      confirmed: true,
      currentGenerationVerified: true,
      now: () => 'rollback',
    });
    expect(rolledBack).toEqual({
      authority: 'localStorage',
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      family: FAMILY,
      rollbackGeneration: GENERATION,
      epoch: 2,
      committedAt: 'rollback',
    });
    expect(
      await readCombatLogArchiveAuthority(database, NAMESPACE, CAMPAIGN)
    ).toEqual(rolledBack);
    // The epoch has moved on; replaying the same rollback is refused.
    await expect(
      rollbackCombatLogArchiveLocalAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedEpoch: 1,
        generation: GENERATION,
        confirmed: true,
        currentGenerationVerified: true,
        now: () => 'stale',
      })
    ).rejects.toThrow('Stale combat log archive authority epoch');
    database.close();
  });

  it('rejects missing, journaled, mismatched, and atomically aborted local generations', async () => {
    const database = await openRollkeeperDatabase();
    await expect(
      commitCombatLogArchiveLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow('Combat log archive generation is not CUTOVER_READY');
    const stateOnly = database.transaction('meta', 'readwrite');
    stateOnly.objectStore('meta').put({
      key: `migration-state:${NAMESPACE}:${FAMILY}:${CAMPAIGN}`,
      state: 'CUTOVER_READY',
      runId: 'a-different-run',
    });
    await transactionComplete(stateOnly);
    // CUTOVER_READY, but for another run id.
    await expect(
      commitCombatLogArchiveLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow('Combat log archive generation is not CUTOVER_READY');
    const matchingRun = database.transaction('meta', 'readwrite');
    matchingRun.objectStore('meta').put({
      key: `migration-state:${NAMESPACE}:${FAMILY}:${CAMPAIGN}`,
      state: 'CUTOVER_READY',
      runId: GENERATION,
    });
    await transactionComplete(matchingRun);
    await expect(
      commitCombatLogArchiveLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow('Combat log archive generation is missing');
    // A captured generation for another legacy key is not this family's.
    const wrongKey = database.transaction('kvGenerations', 'readwrite');
    wrongKey.objectStore('kvGenerations').put({
      namespace: NAMESPACE,
      generation: GENERATION,
      key: 'rollkeeper-encounter-data',
      presence: true,
      rawValue: '{}',
    });
    await transactionComplete(wrongKey);
    await expect(
      commitCombatLogArchiveLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow('Combat log archive generation is missing');
    await seedReady(database);
    const transaction = database.transaction('journal', 'readwrite');
    transaction.objectStore('journal').put({
      journalId: 'pending',
      namespace: NAMESPACE,
      generation: GENERATION,
      family: FAMILY,
    });
    await transactionComplete(transaction);
    await expect(
      commitCombatLogArchiveLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow('Combat log archive journal is not empty');
    const clear = database.transaction('journal', 'readwrite');
    clear.objectStore('journal').clear();
    await transactionComplete(clear);
    await expect(
      commitCombatLogArchiveLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
        initialDocuments: [
          document({ legacyId: 'archive-a' }),
          document({ legacyId: 'archive-b', campaignId: 'wrong' }),
        ],
      })
    ).rejects.toThrow(
      'Initial combat log archive document scope does not match cutover'
    );
    await expect(
      commitCombatLogArchiveLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'now',
        testHooks: { abortPointerTransaction: true },
      })
    ).rejects.toThrow('Atomic combat log archive pointer transaction aborted');
    expect(
      await readCombatLogArchiveAuthority(database, NAMESPACE, CAMPAIGN)
    ).toEqual({ authority: 'localStorage', epoch: 0 });
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
    const local = await commitCombatLogArchiveLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
    });
    await expect(
      commitCombatLogArchiveLocalCutover(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'later',
      })
    ).resolves.toEqual(local);
    await expect(
      markCombatLogArchiveCloudAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedLocalEpoch: 2,
        cloudEpoch: 2,
        now: () => 'cloud',
      })
    ).rejects.toThrow(
      'Local combat log archive authority is not ready for cloud activation'
    );
    // cloudEpoch one below the local epoch is refused; equal is allowed.
    await expect(
      markCombatLogArchiveCloudAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedLocalEpoch: 1,
        cloudEpoch: 0,
        now: () => 'cloud',
      })
    ).rejects.toThrow(
      'Local combat log archive authority is not ready for cloud activation'
    );
    const cloud = await markCombatLogArchiveCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 1,
      now: () => 'cloud',
    });
    expect(cloud).toEqual({
      authority: 'postgres',
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      family: FAMILY,
      generation: GENERATION,
      epoch: 1,
      committedAt: 'cloud',
    });
    expect(
      await readCombatLogArchiveAuthority(database, NAMESPACE, CAMPAIGN)
    ).toEqual(cloud);
    // Cloud authority is not a local pointer, so it cannot be re-marked.
    await expect(
      markCombatLogArchiveCloudAuthority(database, {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        expectedLocalEpoch: 1,
        cloudEpoch: 2,
        now: () => 'again',
      })
    ).rejects.toThrow(
      'Local combat log archive authority is not ready for cloud activation'
    );
    database.close();
  });

  it('supersedes matching accepted versions and rebases divergent ones per archive', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitCombatLogArchiveLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
      initialDocuments: [
        document({ legacyId: 'archive-a', contentFingerprint: 'a'.repeat(64) }),
        document({ legacyId: 'archive-b', contentFingerprint: 'b'.repeat(64) }),
        document({ legacyId: 'archive-c', contentFingerprint: 'c'.repeat(64) }),
      ],
    });
    const localChange = database.transaction(
      ['documents', 'outbox'],
      'readwrite'
    );
    const outbox = localChange.objectStore('outbox');
    // archive-a: outbox entry matches the accepted server fingerprint -> superseded
    outbox.put({
      ...document({
        legacyId: 'archive-a',
        contentFingerprint: 'a'.repeat(64),
      }),
      mutationId: 'accepted-a',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: '2026-08-20T00:00:00.000Z',
      lastError: 'boom',
    });
    // archive-b: local edit diverged from the accepted version -> rebased + un-paused
    localChange.objectStore('documents').put(
      document({
        legacyId: 'archive-b',
        localRevision: 2,
        operation: 'replace',
        contentFingerprint: 'd'.repeat(64),
        updatedAt: 'changed',
      })
    );
    outbox.put({
      ...document({
        legacyId: 'archive-b',
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
    // archive-c: not part of the accepted batch -> base version untouched
    outbox.put({
      ...document({
        legacyId: 'archive-c',
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
      ...document({
        legacyId: 'archive-a',
        contentFingerprint: 'a'.repeat(64),
      }),
      mutationId: 'done-a',
      state: 'acknowledged',
      attemptCount: 1,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    // another campaign is untouched
    outbox.put({
      ...document({ legacyId: 'archive-z', campaignId: 'campaign-z' }),
      mutationId: 'other-campaign',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(localChange);

    await markCombatLogArchiveCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 3,
      now: () => 'cloud',
      acceptedVersions: [
        {
          legacyId: 'archive-a',
          serverVersion: 1,
          payloadFingerprint: 'a'.repeat(64),
        },
        {
          legacyId: 'archive-b',
          serverVersion: 2,
          payloadFingerprint: 'b'.repeat(64),
        },
        {
          legacyId: 'archive-missing',
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
      await requestResult(documents.get([NAMESPACE, FAMILY, 'archive-a']))
    ).toMatchObject({ baseServerVersion: 1, cutoverEpoch: 3 });
    expect(
      await requestResult(documents.get([NAMESPACE, FAMILY, 'archive-b']))
    ).toMatchObject({
      baseServerVersion: 2,
      cutoverEpoch: 3,
      localRevision: 2,
      contentFingerprint: 'd'.repeat(64),
    });
    expect(
      await requestResult(documents.get([NAMESPACE, FAMILY, 'archive-c']))
    ).toMatchObject({ baseServerVersion: 0, cutoverEpoch: 1 });
    expect(
      await requestResult(documents.get([NAMESPACE, FAMILY, 'archive-missing']))
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

  it('keeps only the newest unresolved entry per archive at cloud activation', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitCombatLogArchiveLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
      initialDocuments: [
        document({ legacyId: 'archive-a', contentFingerprint: 'a'.repeat(64) }),
        document({ legacyId: 'archive-b', contentFingerprint: 'b'.repeat(64) }),
      ],
    });
    const seed = database.transaction('outbox', 'readwrite');
    const outbox = seed.objectStore('outbox');
    // Three paused edits of archive-a: only the highest local revision survives.
    outbox.put({
      ...document({
        legacyId: 'archive-a',
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
        legacyId: 'archive-a',
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
        legacyId: 'archive-a',
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
    // archive-b: the newest of two paused edits already matches the cloud
    // fingerprint, so it is superseded rather than rebased.
    outbox.put({
      ...document({
        legacyId: 'archive-b',
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
        legacyId: 'archive-b',
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

    await markCombatLogArchiveCloudAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedLocalEpoch: 1,
      cloudEpoch: 2,
      now: () => 'cloud',
      acceptedVersions: [
        {
          legacyId: 'archive-a',
          serverVersion: 1,
          payloadFingerprint: 'a'.repeat(64),
        },
        {
          legacyId: 'archive-b',
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
    await commitCombatLogArchiveLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'local',
    });
    const seed = database.transaction('outbox', 'readwrite');
    seed.objectStore('outbox').put({
      ...document({ legacyId: 'archive-a' }),
      mutationId: 'paused-a',
      state: 'paused',
      attemptCount: 0,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(seed);
    await markCombatLogArchiveCloudAuthority(database, {
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
    const documents: CombatLogArchiveEnrollmentDocument[] = [
      {
        legacyId: 'archive-a',
        payload: payload(),
        payloadFingerprint: 'b'.repeat(64),
        tombstoned: false,
        schemaVersion: 2,
        serverVersion: 7,
      },
      {
        legacyId: 'archive-b',
        payload: null,
        payloadFingerprint: 'd'.repeat(64),
        tombstoned: true,
        schemaVersion: 2,
        serverVersion: 3,
      },
    ];
    await expect(
      enrollCombatLogArchiveCloudDevice(database, {
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
    ).rejects.toThrow('New browser enrollment requires confirmation');
    const authority = await enrollCombatLogArchiveCloudDevice(database, {
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
    expect(authority).toEqual({
      authority: 'postgres',
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      family: FAMILY,
      generation: 'cloud-enrollment:device-a',
      epoch: 4,
      committedAt: 'now',
    });
    expect(
      await readCombatLogArchiveAuthority(database, NAMESPACE, CAMPAIGN)
    ).toEqual(authority);
    const transaction = database.transaction(
      ['documents', 'conflicts', 'tombstones', 'meta'],
      'readonly'
    );
    expect(
      await requestResult(
        transaction
          .objectStore('documents')
          .get([NAMESPACE, FAMILY, 'archive-a'])
      )
    ).toEqual({
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      legacyId: 'archive-a',
      family: FAMILY,
      cutoverEpoch: 4,
      operation: 'replace',
      payload: payload(),
      schemaVersion: 2,
      localRevision: 1,
      baseServerVersion: 7,
      contentFingerprint: 'b'.repeat(64),
      updatedAt: 'now',
      deletedAt: null,
    });
    expect(
      await requestResult(
        transaction
          .objectStore('documents')
          .get([NAMESPACE, FAMILY, 'archive-b'])
      )
    ).toMatchObject({
      operation: 'delete',
      payload: null,
      baseServerVersion: 3,
      contentFingerprint: 'd'.repeat(64),
      deletedAt: 'now',
    });
    const tombstones = await requestResult(
      transaction.objectStore('tombstones').getAll()
    );
    expect(tombstones).toEqual([
      {
        namespace: NAMESPACE,
        family: FAMILY,
        campaignId: CAMPAIGN,
        legacyId: 'archive-b',
        localRevision: 1,
        deletedAt: 'now',
        mutationId: 'cloud:3',
        beforeImage: null,
      },
    ]);
    const conflicts = await requestResult(
      transaction.objectStore('conflicts').getAll()
    );
    expect(conflicts).toEqual([
      {
        conflictId: `combat-log-archive-enrollment:${NAMESPACE}:${CAMPAIGN}:device-a`,
        namespace: NAMESPACE,
        campaignId: CAMPAIGN,
        family: FAMILY,
        legacyId: 'ABC123',
        kind: 'preserved-device-legacy-candidate',
        rawValue: 'legacy-bytes',
        rawFingerprint: 'c'.repeat(64),
        cloudPreviewFingerprint: 'a'.repeat(64),
        resolutionState: 'preserved',
        detectedAt: 'now',
      },
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get(`device-enrollment:${NAMESPACE}:${FAMILY}:${CAMPAIGN}:device-a`)
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

  it('writes each enrolled document with exactly the preview server version and fingerprint', async () => {
    const database = await openRollkeeperDatabase();
    // Distinct, non-uniform versions and fingerprints: a document written with
    // any other document's values, with the epoch, or with a default would fail.
    const documents: CombatLogArchiveEnrollmentDocument[] = [
      {
        legacyId: 'archive-a',
        payload: payload({ encounterId: 'encounter-aaa111' }),
        payloadFingerprint: '1'.repeat(64),
        tombstoned: false,
        schemaVersion: 2,
        serverVersion: 12,
      },
      {
        legacyId: 'archive-b',
        payload: payload({ encounterId: 'encounter-bbb222' }),
        payloadFingerprint: '2'.repeat(64),
        tombstoned: false,
        schemaVersion: 2,
        serverVersion: 5,
      },
      {
        legacyId: 'archive-c',
        payload: null,
        payloadFingerprint: '3'.repeat(64),
        tombstoned: true,
        schemaVersion: 2,
        serverVersion: 9,
      },
    ];
    await enrollCombatLogArchiveCloudDevice(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      campaignCode: 'ABC123',
      deviceId: 'device-a',
      epoch: 6,
      confirmed: true,
      previewFingerprint: 'a'.repeat(64),
      documents,
      localCandidate: null,
      preserveDivergentCandidate: false,
      now: () => 'now',
    });
    const read = database.transaction(['documents', 'tombstones'], 'readonly');
    const store = read.objectStore('documents');
    for (const preview of documents) {
      const stored = (await requestResult(
        store.get([NAMESPACE, FAMILY, preview.legacyId])
      )) as CombatLogArchiveDocument | undefined;
      expect(stored).toBeDefined();
      // Field-by-field: Task 14's PR #267 regression rests on these two being
      // written exactly as the cloud preview reported them.
      expect(stored?.baseServerVersion).toBe(preview.serverVersion);
      expect(stored?.contentFingerprint).toBe(preview.payloadFingerprint);
      expect(stored?.schemaVersion).toBe(preview.schemaVersion);
    }
    // The tombstoned row's mutation id carries the same exact server version.
    expect(
      await requestResult(read.objectStore('tombstones').getAll())
    ).toMatchObject([{ legacyId: 'archive-c', mutationId: 'cloud:9' }]);
    await transactionComplete(read);
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
          legacyId: 'archive-a',
          payload: null,
          payloadFingerprint: 'b'.repeat(64),
          tombstoned: true,
          schemaVersion: 2,
          serverVersion: 1,
        },
      ],
      localCandidate: null,
      preserveDivergentCandidate: false,
      now: () => 'now',
    } as const;
    // Epoch 0 is one below the durable floor; epoch 1 is the floor itself.
    await expect(
      enrollCombatLogArchiveCloudDevice(database, { ...base, epoch: 0 })
    ).rejects.toThrow('A durable cloud generation is required');
    await expect(
      enrollCombatLogArchiveCloudDevice(database, {
        ...base,
        documents: [{ ...base.documents[0], serverVersion: 0 }],
      })
    ).rejects.toThrow('A durable cloud generation is required');
    await expect(
      enrollCombatLogArchiveCloudDevice(database, {
        ...base,
        localCandidate: { rawValue: 'raw', fingerprint: 'c'.repeat(64) },
      })
    ).rejects.toThrow(
      'The local candidate must be preserved before enrollment'
    );
    await expect(
      enrollCombatLogArchiveCloudDevice(database, base)
    ).resolves.toMatchObject({ authority: 'postgres', epoch: 1 });
    await expect(
      enrollCombatLogArchiveCloudDevice(database, base)
    ).rejects.toThrow('This browser already has combat log archive authority');
    database.close();
  });

  it('enrolls after a rollback left a localStorage pointer behind', async () => {
    const database = await openRollkeeperDatabase();
    await seedReady(database);
    await commitCombatLogArchiveLocalCutover(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'cutover',
    });
    await rollbackCombatLogArchiveLocalAuthority(database, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN,
      expectedEpoch: 1,
      generation: GENERATION,
      confirmed: true,
      currentGenerationVerified: true,
      now: () => 'rollback',
    });
    await expect(
      enrollCombatLogArchiveCloudDevice(database, {
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
