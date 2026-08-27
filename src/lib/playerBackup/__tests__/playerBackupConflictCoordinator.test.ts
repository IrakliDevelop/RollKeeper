import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AutomaticCharacterConflict,
  AutomaticCharacterDocument,
  AutomaticCharacterOutboxEntry,
  AutomaticSyncQuarantineRecord,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import type { ObjectStoreName } from '@/lib/indexeddb/localDatabase';
import {
  deleteRollkeeperDatabaseForTests,
  openExistingRollkeeperDatabase,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import {
  encodeCharacterCloudPayload,
  fingerprintCharacterPayload,
} from '@/lib/supabase/characterCloudCodec';
import type { CharacterCloudLink } from '@/lib/supabase/characterCloudLinks';

import type { PlayerBackupConflictComparison } from '../playerBackupConflictCoordinator';
import {
  holdPlayerBackupCandidateAsideInLock,
  listPlayerBackupConflicts,
  seedPlayerBackupConflict,
} from '../playerBackupConflictCoordinator';
import type { PlayerBackupExclusiveLockProvider } from '../playerBackupRunFence';
import { PlayerBackupLockUnavailableError } from '../playerBackupRunFence';
import type {
  PlayerBackupExecutionPath,
  PlayerBackupRunV1,
} from '../playerBackupRunRepository';
import {
  PlayerBackupRunReplacedError,
  advancePlayerBackupRunToLocalReady,
  readActivePlayerBackupRun,
} from '../playerBackupRunRepository';

const ACCOUNT_A = 'a';
const ACCOUNT_B = 'b';
const NAMESPACE_A = `user:${ACCOUNT_A}` as const;
const CONFIRMED_AT = '2026-08-27T10:00:00.000Z';
const NOW = '2026-08-27T11:00:00.000Z';

const HERO_A = {
  id: 'hero-a',
  name: 'Hero A',
  characterData: { id: 'hero-a', revision: 5 },
};
const HERO_B = {
  id: 'hero-b',
  name: 'Hero B',
  characterData: { id: 'hero-b', revision: 2 },
};
const ROSTER: Record<string, unknown> = { 'hero-a': HERO_A, 'hero-b': HERO_B };

function fingerprint(character: unknown): Promise<string> {
  return fingerprintCharacterPayload(encodeCharacterCloudPayload(character));
}

/** A cloud row for `hero-a` shaped exactly as `characterCloudCodec` expects. */
function cloudRow(
  overrides: Partial<CharacterCloudRow> = {}
): CharacterCloudRow {
  return {
    id: 'cloud-1',
    legacy_client_id: 'hero-a',
    name: 'Hero A',
    payload: encodeCharacterCloudPayload(ROSTER['hero-a']),
    schema_version: 1,
    client_revision: 4,
    server_version: 2,
    deleted_at: null,
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T09:00:00.000Z',
    ...overrides,
  };
}

class ImmediateLocks implements PlayerBackupExclusiveLockProvider {
  async request<T>(
    _name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> {
    return callback();
  }
}

function buildRun(
  accountId: string,
  overrides: Partial<PlayerBackupRunV1>
): PlayerBackupRunV1 {
  const selected = overrides.selectedCharacterIds ?? ['hero-a'];
  const cleared = overrides.clearedCharacterIds ?? [];
  return {
    version: 1,
    runId: 'run-a',
    accountId,
    namespace: `user:${accountId}`,
    mode: 'one-time',
    eligibleCharacterIds: [...selected, ...cleared],
    selectedCharacterIds: selected,
    clearedCharacterIds: cleared,
    futureDefault: 'off',
    broadSafetyReceipt: {
      runId: 'safety-a',
      manifestHash: 'manifest-a',
      createdAt: '2026-08-27T09:00:00.000Z',
      protectedEntryDigest: 'protected-a',
    },
    authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
    confirmedAt: CONFIRMED_AT,
    stage: 'confirmed',
    characterCheckpoints: Object.fromEntries(
      selected.map(id => [id, { localPreparation: 'pending' as const }])
    ),
    ...overrides,
  };
}

async function seedRun(
  options: {
    accountId?: string;
    runId?: string;
    mode?: 'one-time' | 'ongoing';
    executionPath?: PlayerBackupExecutionPath;
    stage?: 'confirmed' | 'local-ready';
    selected?: string[];
    cleared?: string[];
    expectedActiveRunId?: string | null;
  } = {}
): Promise<PlayerBackupRunV1> {
  const accountId = options.accountId ?? ACCOUNT_A;
  const stage = options.stage ?? 'local-ready';
  const mode = options.mode ?? 'one-time';
  const database = await openRollkeeperDatabase({ factory: indexedDB });
  try {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    const run = buildRun(accountId, {
      runId: options.runId ?? 'run-a',
      mode,
      futureDefault: mode === 'ongoing' ? 'on' : 'off',
      selectedCharacterIds: options.selected ?? ['hero-a'],
      clearedCharacterIds: options.cleared ?? ['hero-b'],
      ...(options.executionPath
        ? { executionPath: options.executionPath }
        : {}),
    });
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: options.expectedActiveRunId ?? null,
      run,
      confirmed: true,
    });
    if (stage !== 'local-ready') return run;
    return await advancePlayerBackupRunToLocalReady(database, {
      accountId,
      expectedActiveRunId: run.runId,
      authority: {
        kind: 'indexedDB',
        namespace: 'guest',
        family: 'character',
        generation: 'generation-a',
        epoch: 1,
      },
      selectionAuthorizedAt: CONFIRMED_AT,
      verifiedAt: '2026-08-27T10:30:00.000Z',
    });
  } finally {
    database.close();
  }
}

/** Mutation ids are primary keys, so each account mints its own series. */
function createIdentities(prefix = 'mutation') {
  let mutation = 0;
  return { generateMutationId: vi.fn(() => `${prefix}-${++mutation}`) };
}

interface SeedCall {
  row: CharacterCloudRow;
  legacyId?: string;
  character?: unknown;
  comparison?: PlayerBackupConflictComparison;
  runId?: string;
  existingLink?: CharacterCloudLink | null;
}

function createHarness(
  options: { accountId?: string; mutationPrefix?: string } = {}
) {
  const accountId = options.accountId ?? ACCOUNT_A;
  const identities = createIdentities(options.mutationPrefix);
  const locks = new ImmediateLocks();
  const seed = (call: SeedCall) => {
    const legacyId = call.legacyId ?? 'hero-a';
    return seedPlayerBackupConflict({
      factory: indexedDB,
      locks,
      accountId,
      expectedActiveRunId: call.runId ?? 'run-a',
      legacyId,
      character: call.character ?? ROSTER[legacyId],
      row: call.row,
      comparison: call.comparison ?? 'newer',
      existingLink: call.existingLink ?? null,
      generateMutationId: identities.generateMutationId,
      now: () => NOW,
    });
  };
  return { accountId, identities, locks, seed };
}

async function holdAside(options: {
  accountId?: string;
  runId?: string;
  legacyId?: string;
  row: CharacterCloudRow | null;
  reason: 'future' | 'unavailable';
  detail?: string | null;
  checkpointKind?: 'manual' | 'automatic';
}): Promise<void> {
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    await holdPlayerBackupCandidateAsideInLock({
      database,
      accountId: options.accountId ?? ACCOUNT_A,
      expectedActiveRunId: options.runId ?? 'run-a',
      legacyId: options.legacyId ?? 'hero-a',
      row: options.row,
      reason: options.reason,
      ...(options.detail === undefined ? {} : { detail: options.detail }),
      checkpointKind: options.checkpointKind ?? 'automatic',
      now: () => NOW,
    });
  } finally {
    database.close();
  }
}

async function readStore(name: ObjectStoreName): Promise<unknown[]> {
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    const transaction = database.transaction(name, 'readonly');
    const records = await requestResult(transaction.objectStore(name).getAll());
    await transactionComplete(transaction);
    return records as unknown[];
  } finally {
    database.close();
  }
}

async function writeRecords(
  name: ObjectStoreName,
  records: unknown[]
): Promise<void> {
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    const transaction = database.transaction(name, 'readwrite');
    for (const record of records) transaction.objectStore(name).put(record);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

/** A conflict record shaped like ordinary automatic sync leaves behind. */
function conflictRecord(
  overrides: Partial<AutomaticCharacterConflict> = {}
): AutomaticCharacterConflict {
  return {
    conflictId: 'automatic-sync:worker-1',
    namespace: NAMESPACE_A,
    family: 'character',
    legacyId: 'hero-a',
    mutationId: 'worker-1',
    localCandidate: null,
    cloudCandidate: cloudRow(),
    detectedAt: NOW,
    resolutionState: 'unresolved',
    ...overrides,
  };
}

/**
 * Drives the real worker path — commit, then `preserveConflict` — so the
 * adopted conflict has genuine work behind it, then optionally stamps a
 * superseded run's origin on it.
 */
async function seedWorkerConflict(options: {
  row: CharacterCloudRow;
  legacyId?: string;
  mutationId?: string;
  originPlayerBackupRunId?: string;
}): Promise<string> {
  const legacyId = options.legacyId ?? 'hero-a';
  const mutationId = options.mutationId ?? 'worker-1';
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    const repository = new IndexedDbAutomaticCharacterSyncRepository(database, {
      randomId: () => mutationId,
    });
    const saved = await repository.commit({
      namespace: NAMESPACE_A,
      legacyId,
      operation: 'create',
      payload: encodeCharacterCloudPayload(ROSTER[legacyId]),
      schemaVersion: 1,
      localRevision: 5,
      baseServerVersion: 0,
      contentFingerprint: await fingerprint(ROSTER[legacyId]),
      syncPolicy: 'off',
      updatedAt: '2026-08-27T10:45:00.000Z',
    });
    expect(saved.saved).toBe(true);
    const [entry] = await repository.listOutbox(NAMESPACE_A);
    await repository.preserveConflict(
      entry,
      options.row,
      '2026-08-27T10:50:00.000Z'
    );
  } finally {
    database.close();
  }
  if (options.originPlayerBackupRunId) {
    const [conflict] = (await readStore(
      'conflicts'
    )) as AutomaticCharacterConflict[];
    await writeRecords('conflicts', [
      {
        ...conflict,
        originPlayerBackupRunId: options.originPlayerBackupRunId,
      },
    ]);
  }
  return `automatic-sync:${mutationId}`;
}

async function readCheckpoints(accountId = ACCOUNT_A, runId = 'run-a') {
  const run = await readActivePlayerBackupRun({
    accountId,
    factory: indexedDB,
  });
  expect(run?.runId).toBe(runId);
  return run!.characterCheckpoints;
}

async function databaseVersion(): Promise<number> {
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    return database.version;
  } finally {
    database.close();
  }
}

const SNAPSHOT_STORES: ObjectStoreName[] = [
  'meta',
  'documents',
  'outbox',
  'conflicts',
  'quarantine',
  'tombstones',
];

async function snapshotStores(): Promise<Record<string, unknown[]>> {
  const snapshot: Record<string, unknown[]> = {};
  for (const name of SNAPSHOT_STORES) snapshot[name] = await readStore(name);
  return snapshot;
}

async function expectNoDurableWrites(): Promise<void> {
  expect(await readStore('conflicts')).toEqual([]);
  expect(await readStore('outbox')).toEqual([]);
  expect(await readStore('documents')).toEqual([]);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  localStorage.clear();
  await deleteRollkeeperDatabaseForTests(indexedDB);
});

describe('seedPlayerBackupConflict', () => {
  it('creates exactly one durable conflict with exact candidates, work and run origin', async () => {
    await seedRun();
    const harness = createHarness();
    const row = cloudRow();

    const result = await harness.seed({ row, comparison: 'newer' });

    expect(result).toEqual({
      conflictId: 'automatic-sync:mutation-1',
      mutationId: 'mutation-1',
      created: true,
      refreshed: false,
    });

    const conflicts = (await readStore(
      'conflicts'
    )) as AutomaticCharacterConflict[];
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].namespace).toBe(NAMESPACE_A);
    expect(conflicts[0].legacyId).toBe('hero-a');
    expect(conflicts[0].originPlayerBackupRunId).toBe('run-a');
    expect(conflicts[0].resolutionState).toBe('unresolved');
    expect(conflicts[0].detectedAt).toBe(NOW);
    expect(conflicts[0].cloudCandidate).toEqual(row);
    expect(conflicts[0].localCandidate?.contentFingerprint).toBe(
      await fingerprint(HERO_A)
    );
    expect(conflicts[0].localCandidate?.cloudId).toBe(row.id);

    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0].state).toBe('conflict');
    expect(outbox[0].mutationId).toBe('mutation-1');
    expect(outbox[0].originPlayerBackupRunId).toBe('run-a');

    expect(await readStore('documents')).toHaveLength(1);

    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'needs-attention',
      reason: 'conflict:newer',
      cloudId: row.id,
      mutationId: 'mutation-1',
    });
  });

  it('is idempotent for the same candidates', async () => {
    await seedRun();
    const harness = createHarness();
    const row = cloudRow();
    await harness.seed({ row });
    const before = await snapshotStores();

    const second = await harness.seed({ row });

    expect(second).toEqual({
      conflictId: 'automatic-sync:mutation-1',
      mutationId: 'mutation-1',
      created: false,
      refreshed: false,
    });
    expect(harness.identities.generateMutationId).toHaveBeenCalledTimes(1);
    expect(await snapshotStores()).toEqual(before);
    const conflicts = (await readStore(
      'conflicts'
    )) as AutomaticCharacterConflict[];
    expect(conflicts[0].originPlayerBackupRunId).toBe('run-a');
  });

  it('adopts an unclaimed worker conflict into the active run', async () => {
    await seedRun();
    const row = cloudRow();
    const conflictId = await seedWorkerConflict({ row });
    const harness = createHarness();

    const result = await harness.seed({ row, comparison: 'newer' });

    expect(result).toEqual({
      conflictId,
      mutationId: 'worker-1',
      created: false,
      refreshed: true,
    });
    expect(harness.identities.generateMutationId).not.toHaveBeenCalled();
    const conflicts = (await readStore(
      'conflicts'
    )) as AutomaticCharacterConflict[];
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].originPlayerBackupRunId).toBe('run-a');
    expect(conflicts[0].detectedAt).toBe(NOW);
    expect(await readStore('outbox')).toHaveLength(1);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      mutationId: 'worker-1',
      reason: 'conflict:newer',
      state: 'needs-attention',
    });
  });

  it('adopts a conflict stamped by a superseded run', async () => {
    await seedRun();
    const row = cloudRow();
    const conflictId = await seedWorkerConflict({
      row,
      originPlayerBackupRunId: 'run-old',
    });
    const harness = createHarness();

    const result = await harness.seed({ row });

    expect(result).toEqual({
      conflictId,
      mutationId: 'worker-1',
      created: false,
      refreshed: true,
    });
    const conflicts = (await readStore(
      'conflicts'
    )) as AutomaticCharacterConflict[];
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].originPlayerBackupRunId).toBe('run-a');
    expect((await readCheckpoints())['hero-a'].online?.mutationId).toBe(
      'worker-1'
    );
  });

  it('replaces the linked cloud copy instead of creating a second one', async () => {
    await seedRun();
    const harness = createHarness();
    const row = cloudRow();

    await harness.seed({
      row,
      existingLink: {
        accountId: ACCOUNT_A,
        legacyId: 'hero-a',
        cloudId: row.id,
        serverVersion: 1,
        contentFingerprint: 'stale-fingerprint',
      },
    });

    const documents = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      operation: 'replace',
      baseServerVersion: 1,
      cloudId: row.id,
    });
    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox[0]).toMatchObject({
      operation: 'replace',
      baseServerVersion: 1,
    });
    // `preserveConflictInTransaction` only patches a base-0 candidate, so the
    // cloud identity here comes straight from the written document.
    const conflicts = (await readStore(
      'conflicts'
    )) as AutomaticCharacterConflict[];
    expect(conflicts[0].localCandidate?.cloudId).toBe(row.id);
    expect(conflicts[0].localCandidate?.baseServerVersion).toBe(1);
  });

  it('prefers the acknowledged document server version over the link', async () => {
    await seedRun();
    const row = cloudRow();
    await writeRecords('documents', [
      {
        namespace: NAMESPACE_A,
        family: 'character',
        legacyId: 'hero-a',
        operation: 'replace',
        payload: encodeCharacterCloudPayload(HERO_A),
        schemaVersion: 1,
        localRevision: 4,
        baseServerVersion: 2,
        contentFingerprint: 'older-fingerprint',
        syncPolicy: 'off',
        updatedAt: '2026-08-27T09:30:00.000Z',
        cloudId: row.id,
        deletedAt: null,
      } satisfies AutomaticCharacterDocument,
    ]);
    const harness = createHarness();

    await harness.seed({
      row,
      existingLink: {
        accountId: ACCOUNT_A,
        legacyId: 'hero-a',
        cloudId: row.id,
        serverVersion: 1,
        contentFingerprint: null,
      },
    });

    const documents = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      operation: 'replace',
      baseServerVersion: 2,
    });
    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox[0].baseServerVersion).toBe(2);
  });

  it('refreshes the online candidate when the server version moved', async () => {
    await seedRun();
    const harness = createHarness();
    await harness.seed({ row: cloudRow(), comparison: 'newer' });

    const moved = cloudRow({ server_version: 3 });
    const second = await harness.seed({ row: moved, comparison: 'different' });

    expect(second).toEqual({
      conflictId: 'automatic-sync:mutation-1',
      mutationId: 'mutation-1',
      created: false,
      refreshed: true,
    });
    const conflicts = (await readStore(
      'conflicts'
    )) as AutomaticCharacterConflict[];
    expect(conflicts).toHaveLength(1);
    expect(
      (conflicts[0].cloudCandidate as CharacterCloudRow).server_version
    ).toBe(3);
    expect(await readStore('outbox')).toHaveLength(1);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online?.reason).toBe('conflict:different');
    expect(checkpoints['hero-a'].online?.mutationId).toBe('mutation-1');
  });

  it('refuses before local-ready with no writes', async () => {
    await seedRun({ stage: 'confirmed' });
    const harness = createHarness();

    await expect(harness.seed({ row: cloudRow() })).rejects.toThrow(
      'Player backup run has not reached local-ready'
    );
    await expectNoDurableWrites();
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toBeUndefined();
  });

  it('refuses an unselected character', async () => {
    await seedRun({ selected: ['hero-a'], cleared: ['hero-b'] });
    const harness = createHarness();

    await expect(
      harness.seed({
        legacyId: 'hero-b',
        row: cloudRow({ legacy_client_id: 'hero-b' }),
      })
    ).rejects.toThrow('Character is not selected in this player backup run');
    await expectNoDurableWrites();
  });

  it('refuses a degraded-manual run', async () => {
    await seedRun({ stage: 'confirmed', executionPath: 'degraded-manual' });
    const harness = createHarness();

    await expect(harness.seed({ row: cloudRow() })).rejects.toThrow(
      'Degraded manual backup never seeds a conflict'
    );
    await expectNoDurableWrites();
  });

  it('refuses an unsafe row identity', async () => {
    await seedRun();
    const harness = createHarness();

    await expect(
      harness.seed({ row: cloudRow({ legacy_client_id: 'hero-z' }) })
    ).rejects.toThrow('Cloud conflict candidate identity is unsafe');
    await expect(
      harness.seed({ row: cloudRow(), comparison: 'removed' })
    ).rejects.toThrow('Cloud conflict candidate identity is unsafe');
    await expect(
      harness.seed({
        row: cloudRow({ deleted_at: '2026-08-27T08:00:00.000Z' }),
        comparison: 'newer',
      })
    ).rejects.toThrow('Cloud conflict candidate identity is unsafe');
    await expectNoDurableWrites();
  });

  it('writes nothing after the active run is replaced', async () => {
    await seedRun({ runId: 'run-a' });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    try {
      await new AutomaticCharacterSyncPreferences(
        database
      ).applyConfirmedSelection({
        expectedActiveRunId: 'run-a',
        run: buildRun(ACCOUNT_A, {
          runId: 'run-b',
          selectedCharacterIds: ['hero-a'],
          clearedCharacterIds: ['hero-b'],
        }),
        confirmed: true,
      });
    } finally {
      database.close();
    }
    const harness = createHarness();

    await expect(
      harness.seed({ row: cloudRow(), runId: 'run-a' })
    ).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);
    await expectNoDurableWrites();
  });

  it('fails closed without lock capability', async () => {
    await seedRun();
    const factory = { open: vi.fn() } as unknown as IDBFactory;

    await expect(
      seedPlayerBackupConflict({
        factory,
        locks: null,
        accountId: ACCOUNT_A,
        expectedActiveRunId: 'run-a',
        legacyId: 'hero-a',
        character: HERO_A,
        row: cloudRow(),
        comparison: 'newer',
        existingLink: null,
        generateMutationId: () => 'mutation-1',
        now: () => NOW,
      })
    ).rejects.toBeInstanceOf(PlayerBackupLockUnavailableError);
    expect(factory.open).not.toHaveBeenCalled();
    await expectNoDurableWrites();
  });

  it('seeds an archived row as an explicit recovery decision', async () => {
    await seedRun();
    const harness = createHarness();
    const row = cloudRow({ deleted_at: '2026-08-27T08:00:00.000Z' });

    const result = await harness.seed({ row, comparison: 'removed' });

    expect(result.created).toBe(true);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online?.reason).toBe('conflict:removed');

    const listing = await listPlayerBackupConflicts({
      factory: indexedDB,
      accountId: ACCOUNT_A,
      expectedActiveRunId: 'run-a',
    });
    expect(listing.conflicts).toHaveLength(1);
    expect(listing.conflicts[0]).toMatchObject({
      legacyId: 'hero-a',
      comparison: 'removed',
      archived: true,
      originPlayerBackupRunId: 'run-a',
      resolutionState: 'unresolved',
      allowedResolutions: ['restore-online', 'keep-both'],
    });
    expect(listing.conflicts[0].cloudCandidate).toEqual(row);
  });

  it('keeps account namespaces isolated', async () => {
    await seedRun({ accountId: ACCOUNT_A, runId: 'run-a' });
    await seedRun({ accountId: ACCOUNT_B, runId: 'run-b' });
    const runBBefore = await readActivePlayerBackupRun({
      accountId: ACCOUNT_B,
      factory: indexedDB,
    });

    await createHarness({ accountId: ACCOUNT_A }).seed({ row: cloudRow() });

    expect(
      await readActivePlayerBackupRun({
        accountId: ACCOUNT_B,
        factory: indexedDB,
      })
    ).toEqual(runBBefore);
    const listB = await listPlayerBackupConflicts({
      factory: indexedDB,
      accountId: ACCOUNT_B,
      expectedActiveRunId: 'run-b',
    });
    expect(listB.conflicts).toEqual([]);

    await createHarness({
      accountId: ACCOUNT_B,
      mutationPrefix: 'mutation-b',
    }).seed({ row: cloudRow({ id: 'cloud-b' }), runId: 'run-b' });

    const listA = await listPlayerBackupConflicts({
      factory: indexedDB,
      accountId: ACCOUNT_A,
      expectedActiveRunId: 'run-a',
    });
    expect(listA.conflicts).toHaveLength(1);
    expect(listA.conflicts[0].originPlayerBackupRunId).toBe('run-a');
    expect((listA.conflicts[0].cloudCandidate as CharacterCloudRow).id).toBe(
      'cloud-1'
    );

    const listBAfter = await listPlayerBackupConflicts({
      factory: indexedDB,
      accountId: ACCOUNT_B,
      expectedActiveRunId: 'run-b',
    });
    expect(listBAfter.conflicts).toHaveLength(1);
    expect(listBAfter.conflicts[0].originPlayerBackupRunId).toBe('run-b');
  });
});

describe('holdPlayerBackupCandidateAsideInLock', () => {
  it('quarantines a future row with exact bytes and records held-aside', async () => {
    await seedRun();
    const row = cloudRow({ schema_version: 99 });

    await holdAside({
      row,
      reason: 'future',
      detail: 'Cloud character uses future schema version 99',
    });

    const quarantine = (await readStore(
      'quarantine'
    )) as AutomaticSyncQuarantineRecord[];
    expect(quarantine).toHaveLength(1);
    expect(quarantine[0]).toMatchObject({
      quarantineId: `automatic-sync-pull:${NAMESPACE_A}:hero-a`,
      namespace: NAMESPACE_A,
      legacyId: 'hero-a',
      reason: 'Cloud character uses future schema version 99',
      detectedAt: NOW,
    });
    expect(quarantine[0].rawValue).toBe(JSON.stringify(row));

    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'held-aside',
      reason: 'future',
      cloudId: row.id,
      mutationId: null,
    });

    await holdAside({
      row,
      reason: 'future',
      detail: 'Cloud character uses future schema version 99',
    });
    expect(await readStore('quarantine')).toHaveLength(1);
    await expectNoDurableWrites();
  });

  it('records unavailable without a row and no quarantine record', async () => {
    await seedRun();

    await holdAside({
      row: null,
      reason: 'unavailable',
      checkpointKind: 'manual',
    });

    expect(await readStore('quarantine')).toEqual([]);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      kind: 'manual',
      state: 'held-aside',
      reason: 'unavailable',
      cloudId: 'none',
      mutationId: null,
    });
  });

  it('refuses before local-ready and for degraded runs', async () => {
    await seedRun({ stage: 'confirmed' });
    await expect(
      holdAside({ row: cloudRow(), reason: 'future' })
    ).rejects.toThrow('Player backup run has not reached local-ready');
    expect(await readStore('quarantine')).toEqual([]);

    await deleteRollkeeperDatabaseForTests(indexedDB);
    await seedRun({ stage: 'confirmed', executionPath: 'degraded-manual' });
    await expect(
      holdAside({ row: cloudRow(), reason: 'future' })
    ).rejects.toThrow('Degraded manual backup never seeds a conflict');
    expect(await readStore('quarantine')).toEqual([]);
  });
});

describe('listPlayerBackupConflicts', () => {
  it('reads only the active run selected characters and never writes', async () => {
    await seedRun({ selected: ['hero-a'], cleared: ['hero-b'] });
    const harness = createHarness();
    const row = cloudRow();
    await harness.seed({ row, comparison: 'newer' });

    const conflicts = (await readStore(
      'conflicts'
    )) as AutomaticCharacterConflict[];
    await writeRecords('conflicts', [
      { ...conflicts[0], resolutionState: 'resolved' },
      {
        conflictId: 'automatic-sync:other',
        namespace: NAMESPACE_A,
        family: 'character',
        legacyId: 'hero-b',
        mutationId: 'mutation-other',
        localCandidate: null,
        cloudCandidate: cloudRow({ legacy_client_id: 'hero-b' }),
        detectedAt: NOW,
        resolutionState: 'unresolved',
      },
    ]);
    await writeRecords('quarantine', [
      {
        quarantineId: `automatic-sync-pull:${NAMESPACE_A}:hero-a`,
        namespace: NAMESPACE_A,
        family: 'character',
        legacyId: 'hero-a',
        rawValue: JSON.stringify(row),
        reason: 'future',
        detectedAt: NOW,
      },
      {
        quarantineId: `automatic-sync-pull:${NAMESPACE_A}:hero-b`,
        namespace: NAMESPACE_A,
        family: 'character',
        legacyId: 'hero-b',
        rawValue: '{}',
        reason: 'future',
        detectedAt: NOW,
      },
    ]);

    const versionBefore = await databaseVersion();
    const before = await snapshotStores();

    const listing = await listPlayerBackupConflicts({
      factory: indexedDB,
      accountId: ACCOUNT_A,
      expectedActiveRunId: 'run-a',
    });

    expect(listing.accountId).toBe(ACCOUNT_A);
    expect(listing.runId).toBe('run-a');
    expect(listing.conflicts).toHaveLength(1);
    expect(listing.conflicts[0]).toMatchObject({
      conflictId: 'automatic-sync:mutation-1',
      legacyId: 'hero-a',
      mutationId: 'mutation-1',
      comparison: 'newer',
      archived: false,
      resolutionState: 'resolved',
      allowedResolutions: [],
      detectedAt: NOW,
    });
    expect(listing.heldAside).toEqual([
      {
        legacyId: 'hero-a',
        reason: 'future',
        detectedAt: NOW,
        recoveryAvailable: true,
      },
    ]);

    expect(await databaseVersion()).toBe(versionBefore);
    expect(await snapshotStores()).toEqual(before);
  });

  it('never offers resolutions for a conflict a superseded run stamped', async () => {
    await seedRun();
    await writeRecords('conflicts', [
      conflictRecord({
        conflictId: 'automatic-sync:stale',
        mutationId: 'stale',
        originPlayerBackupRunId: 'run-old',
      }),
      conflictRecord({
        conflictId: 'automatic-sync:unclaimed',
        mutationId: 'unclaimed',
      }),
    ]);

    const listing = await listPlayerBackupConflicts({
      factory: indexedDB,
      accountId: ACCOUNT_A,
      expectedActiveRunId: 'run-a',
    });

    const byId = Object.fromEntries(
      listing.conflicts.map(conflict => [conflict.conflictId, conflict])
    );
    expect(byId['automatic-sync:stale']).toMatchObject({
      originPlayerBackupRunId: 'run-old',
      allowedResolutions: [],
    });
    expect(byId['automatic-sync:unclaimed']).toMatchObject({
      originPlayerBackupRunId: null,
      allowedResolutions: ['keep-mine', 'use-cloud', 'keep-both'],
    });
  });

  it('lists nothing for a degraded manual run', async () => {
    await seedRun({ stage: 'confirmed', executionPath: 'degraded-manual' });
    await writeRecords('conflicts', [conflictRecord()]);
    await writeRecords('quarantine', [
      {
        quarantineId: `automatic-sync-pull:${NAMESPACE_A}:hero-a`,
        namespace: NAMESPACE_A,
        family: 'character',
        legacyId: 'hero-a',
        rawValue: JSON.stringify(cloudRow()),
        reason: 'future',
        detectedAt: NOW,
      },
    ]);

    const listing = await listPlayerBackupConflicts({
      factory: indexedDB,
      accountId: ACCOUNT_A,
      expectedActiveRunId: 'run-a',
    });

    expect(listing).toEqual({
      accountId: ACCOUNT_A,
      runId: 'run-a',
      conflicts: [],
      heldAside: [],
    });
    // The records are still there; the empty listing is a gate, not an absence.
    expect(await readStore('conflicts')).toHaveLength(1);
    expect(await readStore('quarantine')).toHaveLength(1);
  });

  it('throws when the run is missing', async () => {
    await seedRun({ runId: 'run-a' });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    try {
      await new AutomaticCharacterSyncPreferences(
        database
      ).applyConfirmedSelection({
        expectedActiveRunId: 'run-a',
        run: buildRun(ACCOUNT_A, {
          runId: 'run-b',
          selectedCharacterIds: ['hero-a'],
          clearedCharacterIds: ['hero-b'],
        }),
        confirmed: true,
      });
    } finally {
      database.close();
    }

    await expect(
      listPlayerBackupConflicts({
        factory: indexedDB,
        accountId: ACCOUNT_A,
        expectedActiveRunId: 'run-a',
      })
    ).rejects.toThrow('Committed player backup run is missing');
  });
});
