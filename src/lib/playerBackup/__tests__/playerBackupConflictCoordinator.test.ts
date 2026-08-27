import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AutomaticCharacterConflict,
  AutomaticCharacterDocument,
  AutomaticCharacterOutboxEntry,
  AutomaticSyncQuarantineRecord,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { AutomaticCharacterConflictService } from '@/lib/indexeddb/automaticCharacterConflictService';
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
import { CharacterCloudGatewayError } from '@/lib/supabase/characterCloudGateway';
import type {
  CharacterCloudLink,
  CharacterCloudLinkRepository,
} from '@/lib/supabase/characterCloudLinks';
import { createMemoryCharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';
import type {
  CharacterCloudGateway,
  CharacterMutationRequest,
  PutCharacterRequest,
} from '@/lib/supabase/manualCharacterCloudService';

import type {
  PlayerBackupConflictComparison,
  PlayerBackupConflictResolution,
} from '../playerBackupConflictCoordinator';
import {
  acknowledgePlayerBackupApplication,
  drainPlayerBackupRunWork,
  holdPlayerBackupCandidateAsideInLock,
  listPlayerBackupConflicts,
  resolvePlayerBackupConflict,
  seedPlayerBackupConflict,
  settlePlayerBackupOneTimeConflicts,
} from '../playerBackupConflictCoordinator';
import { createPlayerBackupResolutionHook } from '../playerBackupConflictResolution';
import type { PlayerBackupLocalCharacterSource } from '../playerBackupOnlineExecution';
import { derivePlayerBackupRunResult } from '../playerBackupOnlineExecution';
import type { PlayerBackupExclusiveLockProvider } from '../playerBackupRunFence';
import {
  PlayerBackupLockUnavailableError,
  withPlayerBackupAccountLock,
} from '../playerBackupRunFence';
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
  /** Local character the worker committed, when it is not the current one. */
  character?: unknown;
  localRevision?: number;
}): Promise<string> {
  const legacyId = options.legacyId ?? 'hero-a';
  const mutationId = options.mutationId ?? 'worker-1';
  const character = options.character ?? ROSTER[legacyId];
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
      payload: encodeCharacterCloudPayload(character),
      schemaVersion: 1,
      localRevision: options.localRevision ?? 5,
      baseServerVersion: 0,
      contentFingerprint: await fingerprint(character),
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

const ARCHIVED_AT = '2026-08-27T08:00:00.000Z';

type RestoreFailure = 'lost' | 'conflict';

interface ConflictGatewayDouble extends CharacterCloudGateway {
  rows: Map<string, CharacterCloudRow>;
  restoreRequests: CharacterMutationRequest[];
  putRequests: PutCharacterRequest[];
  failNextRestore: RestoreFailure | null;
  /** Legacy ids whose `put` fails as an offline gateway error. */
  failPutFor: Set<string>;
}

/**
 * Records every request, applies compare-and-set on `expectedServerVersion`,
 * clears `deleted_at` on a successful restore and bumps the server version.
 */
function createConflictGateway(): ConflictGatewayDouble {
  const rows = new Map<string, CharacterCloudRow>();
  const gateway: ConflictGatewayDouble = {
    rows,
    restoreRequests: [],
    putRequests: [],
    failNextRestore: null,
    failPutFor: new Set<string>(),
    fetch: vi.fn(async (cloudId: string) => {
      const row = rows.get(cloudId);
      return row ? structuredClone(row) : null;
    }),
    restore: vi.fn(async (request: CharacterMutationRequest) => {
      gateway.restoreRequests.push(structuredClone(request));
      const mode = gateway.failNextRestore;
      gateway.failNextRestore = null;
      const current = rows.get(request.cloudId);
      if (!current) throw new Error('Cloud character is missing');
      if (mode === 'conflict') {
        current.server_version += 1;
        return {
          status: 'conflict' as const,
          characterId: request.cloudId,
          serverVersion: current.server_version,
        };
      }
      if (current.server_version !== request.expectedServerVersion) {
        return {
          status: 'conflict' as const,
          characterId: request.cloudId,
          serverVersion: current.server_version,
        };
      }
      current.deleted_at = null;
      current.server_version += 1;
      if (mode === 'lost') throw new Error('response lost');
      return {
        status: 'success' as const,
        characterId: request.cloudId,
        serverVersion: current.server_version,
      };
    }),
    put: vi.fn(async (request: PutCharacterRequest) => {
      gateway.putRequests.push(structuredClone(request));
      if (gateway.failPutFor.has(request.legacyId)) {
        throw new CharacterCloudGatewayError('Network unavailable', 'offline');
      }
      const current = rows.get(request.cloudId);
      if (current && current.server_version !== request.expectedServerVersion) {
        return {
          status: 'conflict' as const,
          characterId: request.cloudId,
          serverVersion: current.server_version,
        };
      }
      const serverVersion = current ? current.server_version + 1 : 1;
      rows.set(request.cloudId, {
        id: request.cloudId,
        legacy_client_id: request.legacyId,
        name: request.name,
        payload: request.payload,
        schema_version: request.schemaVersion,
        client_revision: request.clientRevision,
        server_version: serverVersion,
        deleted_at: null,
        created_at: current?.created_at ?? '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-27T12:00:00.000Z',
      });
      return {
        status: 'success' as const,
        characterId: request.cloudId,
        serverVersion,
      };
    }),
    list: vi.fn(async () =>
      [...rows.values()].map(row => structuredClone(row))
    ),
    archive: vi.fn(),
  };
  return gateway;
}

function roster(): PlayerBackupLocalCharacterSource {
  return { get: (legacyId: string) => ROSTER[legacyId] ?? null };
}

/** Seeds a run, a durable conflict and a gateway that already holds the row. */
async function seedConflictScenario(
  options: {
    row?: CharacterCloudRow;
    comparison?: PlayerBackupConflictComparison;
    mode?: 'one-time' | 'ongoing';
    selected?: string[];
    cleared?: string[];
  } = {}
) {
  await seedRun({
    mode: options.mode,
    ...(options.selected ? { selected: options.selected } : {}),
    ...(options.cleared ? { cleared: options.cleared } : {}),
  });
  const harness = createHarness();
  const row = options.row ?? cloudRow();
  const gateway = createConflictGateway();
  gateway.rows.set(row.id, structuredClone(row));
  const seeded = await harness.seed({
    row,
    comparison: options.comparison ?? 'newer',
  });
  return { harness, row, gateway, seeded };
}

/** Two selected characters, each with a keep-mine resolution queued. */
async function seedTwoCharacterScenario() {
  await seedRun({ selected: ['hero-a', 'hero-b'], cleared: [] });
  const harness = createHarness();
  const gateway = createConflictGateway();
  const rowA = cloudRow();
  const rowB = cloudRow({
    id: 'cloud-2',
    legacy_client_id: 'hero-b',
    name: 'Hero B',
    payload: encodeCharacterCloudPayload(HERO_B),
    client_revision: 1,
  });
  gateway.rows.set(rowA.id, structuredClone(rowA));
  gateway.rows.set(rowB.id, structuredClone(rowB));
  const seededA = await harness.seed({ row: rowA });
  const seededB = await harness.seed({ legacyId: 'hero-b', row: rowB });
  for (const conflictId of [seededA.conflictId, seededB.conflictId]) {
    await resolveConflict({
      conflictId,
      resolution: 'keep-mine',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });
  }
  return { harness, gateway, rowA, rowB };
}

function resolveConflict(options: {
  conflictId: string;
  resolution: PlayerBackupConflictResolution;
  gateway: Pick<CharacterCloudGateway, 'fetch' | 'restore'>;
  generateMutationId: () => string;
  locks?: PlayerBackupExclusiveLockProvider | null;
  accountId?: string;
  runId?: string;
  copyLegacyId?: string;
  characters?: PlayerBackupLocalCharacterSource;
  factory?: IDBFactory;
}) {
  return resolvePlayerBackupConflict({
    factory: options.factory ?? indexedDB,
    locks: options.locks === undefined ? new ImmediateLocks() : options.locks,
    accountId: options.accountId ?? ACCOUNT_A,
    expectedActiveRunId: options.runId ?? 'run-a',
    conflictId: options.conflictId,
    resolution: options.resolution,
    ...(options.copyLegacyId ? { copyLegacyId: options.copyLegacyId } : {}),
    characters: options.characters ?? roster(),
    gateway: options.gateway,
    generateMutationId: options.generateMutationId,
    now: () => NOW,
  });
}

/** The durable roster applications the active run still owes its caller. */
async function readApplicationRecords(
  runId = 'run-a'
): Promise<Record<string, unknown>[]> {
  const rows = (await readStore('meta')) as Record<string, unknown>[];
  return rows.filter(
    row =>
      typeof row.key === 'string' &&
      row.key.startsWith(`player-backup-application:${runId}:`)
  );
}

function acknowledgeApplication(options: {
  legacyId: string;
  runId?: string;
  locks?: PlayerBackupExclusiveLockProvider | null;
}): Promise<boolean> {
  return acknowledgePlayerBackupApplication({
    factory: indexedDB,
    locks: options.locks === undefined ? new ImmediateLocks() : options.locks,
    accountId: ACCOUNT_A,
    expectedActiveRunId: options.runId ?? 'run-a',
    legacyId: options.legacyId,
  });
}

function drainWork(
  gateway: ConflictGatewayDouble,
  options: { runId?: string } = {}
) {
  return drainPlayerBackupRunWork({
    factory: indexedDB,
    locks: new ImmediateLocks(),
    accountId: ACCOUNT_A,
    expectedActiveRunId: options.runId ?? 'run-a',
    gateway,
    now: () => 1_000,
    random: () => 0,
  });
}

function settleConflicts(
  gateway: ConflictGatewayDouble,
  links: CharacterCloudLinkRepository,
  options: { runId?: string } = {}
) {
  return settlePlayerBackupOneTimeConflicts({
    factory: indexedDB,
    locks: new ImmediateLocks(),
    accountId: ACCOUNT_A,
    expectedActiveRunId: options.runId ?? 'run-a',
    gateway,
    links,
    now: () => NOW,
  });
}

/**
 * Runs the real resolution transaction with only the fenced hook in play, so
 * the hook's own assertions are exercised rather than the pre-lock checks.
 */
async function resolveWithFencedHook(options: {
  conflictId: string;
  expectedActiveRunId: string;
  resolution: 'keep-mine' | 'use-cloud' | 'keep-both';
  copyLegacyId?: string;
}): Promise<'resolved' | 'quarantined'> {
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    return await new AutomaticCharacterConflictService(database, {
      randomId: () => 'mutation-hook',
      now: () => NOW,
    }).resolve(options.conflictId, options.resolution, {
      originPlayerBackupRunId: 'run-a',
      ...(options.copyLegacyId ? { copyLegacyId: options.copyLegacyId } : {}),
      transactionHook: createPlayerBackupResolutionHook({
        accountId: ACCOUNT_A,
        expectedActiveRunId: options.expectedActiveRunId,
        resolution: options.resolution,
        ...(options.copyLegacyId ? { copyLegacyId: options.copyLegacyId } : {}),
        now: () => NOW,
      }),
    });
  } finally {
    database.close();
  }
}

async function writeCharacterPreference(
  legacyId: string,
  enabled = false
): Promise<void> {
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    await new AutomaticCharacterSyncPreferences(database).setCharacter(
      NAMESPACE_A,
      legacyId,
      enabled
    );
  } finally {
    database.close();
  }
}

async function readCharacterPolicy(legacyId: string): Promise<string | null> {
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    const transaction = database.transaction('meta', 'readonly');
    const policy =
      await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
        transaction.objectStore('meta'),
        NAMESPACE_A,
        legacyId
      );
    await transactionComplete(transaction);
    return policy;
  } finally {
    database.close();
  }
}

/** Serialises every request so a queued caller waits for the holder. */
class QueuedLocks implements PlayerBackupExclusiveLockProvider {
  private chain: Promise<unknown> = Promise.resolve();

  async request<T>(
    _name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> {
    const queued = this.chain.then(() => callback());
    this.chain = queued.catch(() => undefined);
    return queued;
  }
}

/** Commits a replacement run for account A, superseding the active pointer. */
async function confirmRun(
  runId: string,
  expectedActiveRunId: string | null = 'run-a'
): Promise<void> {
  const database = await openRollkeeperDatabase({ factory: indexedDB });
  try {
    await new AutomaticCharacterSyncPreferences(
      database
    ).applyConfirmedSelection({
      expectedActiveRunId,
      run: buildRun(ACCOUNT_A, {
        runId,
        selectedCharacterIds: ['hero-a'],
        clearedCharacterIds: ['hero-b'],
      }),
      confirmed: true,
    });
  } finally {
    database.close();
  }
}

async function deriveResult(links: CharacterCloudLinkRepository) {
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    return await derivePlayerBackupRunResult({
      factory: indexedDB,
      accountId: ACCOUNT_A,
      expectedActiveRunId: 'run-a',
      links,
      repository: new IndexedDbAutomaticCharacterSyncRepository(database),
    });
  } finally {
    database.close();
  }
}

async function readConflict(
  conflictId: string
): Promise<AutomaticCharacterConflict & { resolution?: string }> {
  const conflicts = (await readStore(
    'conflicts'
  )) as (AutomaticCharacterConflict & {
    resolution?: string;
  })[];
  const found = conflicts.find(record => record.conflictId === conflictId);
  if (!found) throw new Error(`conflict ${conflictId} is missing`);
  return found;
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

  it('refreshes a stale local candidate before adopting a conflict', async () => {
    await seedRun();
    const row = cloudRow();
    const stale = {
      id: 'hero-a',
      name: 'Hero A',
      characterData: { id: 'hero-a', revision: 3 },
    };
    const conflictId = await seedWorkerConflict({
      row,
      character: stale,
      localRevision: 3,
    });
    const harness = createHarness();

    const result = await harness.seed({ row });

    expect(result).toEqual({
      conflictId,
      mutationId: 'worker-1',
      created: false,
      refreshed: true,
    });
    const fresh = await fingerprint(HERO_A);
    const [conflict] = (await readStore(
      'conflicts'
    )) as AutomaticCharacterConflict[];
    expect(conflict.localCandidate).toMatchObject({
      contentFingerprint: fresh,
      localRevision: 5,
      cloudId: row.id,
      originPlayerBackupRunId: 'run-a',
    });
    expect(conflict.originPlayerBackupRunId).toBe('run-a');
    const documents = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    expect(documents).toEqual([conflict.localCandidate]);
    const snapshots = (await readStore('legacySnapshots')) as {
      runId: string;
      key: string;
      captureNumber: number;
      rawValue: string;
    }[];
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      runId: conflictId,
      key: 'automatic-sync-superseded-local',
      captureNumber: 1,
    });
    expect(JSON.parse(snapshots[0].rawValue)).toMatchObject({
      payload: encodeCharacterCloudPayload(stale),
      localRevision: 3,
    });

    const before = await snapshotStores();
    const second = await harness.seed({ row });

    expect(second).toEqual({
      conflictId,
      mutationId: 'worker-1',
      created: false,
      refreshed: false,
    });
    expect(await snapshotStores()).toEqual(before);
    expect(await readStore('legacySnapshots')).toEqual(snapshots);
  });

  it('refuses to adopt a conflict whose local candidate points at another cloud copy', async () => {
    await seedRun();
    const harness = createHarness();
    await harness.seed({ row: cloudRow({ id: 'cloud-old' }) });
    const before = await snapshotStores();

    await expect(
      harness.seed({ row: cloudRow({ id: 'cloud-new' }) })
    ).rejects.toThrow('Cloud conflict candidate identity is unsafe');
    expect(await snapshotStores()).toEqual(before);
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
    ).rejects.toThrow('Degraded manual backup never holds a candidate aside');
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

describe('resolvePlayerBackupConflict', () => {
  it('keep-mine preserves the online candidate, queues run-origin work, and settles to protected after drain', async () => {
    const { harness, row, gateway, seeded } = await seedConflictScenario();

    const result = await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'keep-mine',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });

    expect(result).toEqual({
      status: 'resolved',
      resolution: 'keep-mine',
      apply: null,
      workQueued: true,
    });
    const snapshots = (await readStore('legacySnapshots')) as {
      runId: string;
      key: string;
      rawValue: string;
    }[];
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      runId: seeded.conflictId,
      key: 'automatic-sync-discarded-cloud',
    });
    expect(JSON.parse(snapshots[0].rawValue)).toEqual(row);

    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      mutationId: 'mutation-2',
      state: 'queued',
      originPlayerBackupRunId: 'run-a',
      baseServerVersion: row.server_version,
    });
    expect((await readCheckpoints())['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'queued',
      mutationId: 'mutation-2',
      reason: 'resolved:keep-mine',
      cloudId: row.id,
    });

    await expect(drainWork(gateway)).resolves.toEqual(['synced', 'idle']);
    expect(gateway.putRequests).toHaveLength(1);
    expect(gateway.putRequests[0]).toMatchObject({
      mutationId: 'mutation-2',
      expectedServerVersion: 2,
    });

    const links = createMemoryCharacterCloudLinkRepository();
    await expect(settleConflicts(gateway, links)).resolves.toEqual({
      settled: ['hero-a'],
      pending: [],
    });
    expect((await readCheckpoints())['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'protected',
      cloudId: row.id,
      serverVersion: 3,
      verifiedAt: NOW,
    });
    expect(links.get(ACCOUNT_A, 'hero-a')).toMatchObject({
      cloudId: row.id,
      serverVersion: 3,
      pendingMutation: null,
    });
    expect(await readCharacterPolicy('hero-a')).toBe('off');

    const derived = await deriveResult(links);
    expect(derived.protected).toEqual(['hero-a']);
    expect(derived.complete).toBe(true);
  });

  it('use-cloud preserves the local candidate and returns a replace application', async () => {
    const { harness, row, gateway, seeded } = await seedConflictScenario();
    const before = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];

    const result = await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'use-cloud',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });

    const snapshots = (await readStore('legacySnapshots')) as {
      key: string;
      rawValue: string;
    }[];
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].key).toBe('automatic-sync-discarded-local');
    expect(JSON.parse(snapshots[0].rawValue)).toEqual(before[0]);
    expect(await readStore('outbox')).toEqual([]);

    const documents = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    expect(documents).toHaveLength(1);
    expect(documents[0].payload).toEqual(row.payload);
    expect(documents[0].baseServerVersion).toBe(2);
    expect(result).toEqual({
      status: 'resolved',
      resolution: 'use-cloud',
      apply: {
        kind: 'replace',
        legacyId: 'hero-a',
        payload: documents[0].payload,
        contentFingerprint: documents[0].contentFingerprint,
      },
      workQueued: false,
    });
    expect((await readCheckpoints())['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'pending',
      mutationId: 'mutation-1',
      reason: 'resolved:use-cloud',
    });

    const links = createMemoryCharacterCloudLinkRepository();
    vi.mocked(gateway.fetch).mockClear();
    await expect(settleConflicts(gateway, links)).resolves.toEqual({
      settled: ['hero-a'],
      pending: [],
    });
    expect(gateway.fetch).toHaveBeenCalledTimes(1);
    expect(links.get(ACCOUNT_A, 'hero-a')).toMatchObject({
      cloudId: row.id,
      serverVersion: 2,
      contentFingerprint: documents[0].contentFingerprint,
      pendingMutation: null,
    });
  });

  it('keep-both requires an unused id, copies nested identity, starts off, and survives reload', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario({
      cleared: ['hero-b', 'hero-c'],
    });
    const before = await snapshotStores();

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'keep-both',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({ status: 'refused', reason: 'copy-id-required' });
    expect(await snapshotStores()).toEqual(before);

    for (const copyLegacyId of ['hero-a', 'hero-b', 'hero-c']) {
      await expect(
        resolveConflict({
          conflictId: seeded.conflictId,
          resolution: 'keep-both',
          copyLegacyId,
          gateway,
          generateMutationId: harness.identities.generateMutationId,
        })
      ).resolves.toEqual({ status: 'refused', reason: 'copy-id-collision' });
    }
    expect(await snapshotStores()).toEqual(before);
    expect(harness.identities.generateMutationId).toHaveBeenCalledTimes(1);

    const result = await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'keep-both',
      copyLegacyId: 'hero-copy',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });

    const documents = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    const copy = documents.find(document => document.legacyId === 'hero-copy');
    expect(copy).toMatchObject({
      syncPolicy: 'off',
      baseServerVersion: 0,
      operation: 'create',
    });
    expect(copy?.payload).toMatchObject({
      id: 'hero-copy',
      characterData: { id: 'hero-copy' },
    });
    expect(result).toEqual({
      status: 'resolved',
      resolution: 'keep-both',
      apply: {
        kind: 'add',
        legacyId: 'hero-copy',
        payload: copy?.payload,
        contentFingerprint: copy?.contentFingerprint,
      },
      workQueued: true,
    });
    if (result.status !== 'resolved' || !result.apply) {
      throw new Error('keep-both did not return an application');
    }
    // The copy's payload was rewritten with a new identity, so its
    // fingerprint must describe the copy and not the online row.
    await expect(
      fingerprintCharacterPayload(result.apply.payload)
    ).resolves.toBe(result.apply.contentFingerprint);

    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      legacyId: 'hero-a',
      mutationId: 'mutation-2',
      state: 'queued',
      originPlayerBackupRunId: 'run-a',
    });

    // `readStore` and `readCharacterPolicy` reopen the database, so both reads
    // are made against a freshly opened connection.
    const reloaded = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    expect(reloaded.some(document => document.legacyId === 'hero-copy')).toBe(
      true
    );
    expect(await readCharacterPolicy('hero-copy')).toBe('off');
  });

  it('repeating a completed resolution writes nothing', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario();
    await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'keep-mine',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });
    const before = await snapshotStores();
    const snapshotsBefore = await readStore('legacySnapshots');
    const mintedBefore =
      harness.identities.generateMutationId.mock.calls.length;

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'keep-mine',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({
      status: 'resolved',
      resolution: 'keep-mine',
      apply: null,
      workQueued: false,
    });

    expect(await snapshotStores()).toEqual(before);
    expect(await readStore('legacySnapshots')).toEqual(snapshotsBefore);
    expect(harness.identities.generateMutationId.mock.calls.length).toBe(
      mintedBefore
    );
  });

  it('replays the use-cloud application until it is acknowledged', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario();
    const resolve = () =>
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'use-cloud',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      });

    const first = await resolve();
    expect(await readApplicationRecords()).toEqual([
      {
        key: 'player-backup-application:run-a:hero-a',
        version: 1,
        runId: 'run-a',
        accountId: ACCOUNT_A,
        kind: 'replace',
        legacyId: 'hero-a',
        sourceLegacyId: 'hero-a',
        resolution: 'use-cloud',
        conflictId: seeded.conflictId,
        recordedAt: NOW,
      },
    ]);

    // A crash before the roster was written retries the whole call, so the
    // already-resolved answer must still carry the application.
    await expect(resolve()).resolves.toEqual({ ...first, workQueued: false });

    await expect(
      acknowledgeApplication({ legacyId: 'hero-a', locks: null })
    ).rejects.toBeInstanceOf(PlayerBackupLockUnavailableError);
    await expect(acknowledgeApplication({ legacyId: 'hero-a' })).resolves.toBe(
      true
    );
    expect(await readApplicationRecords()).toEqual([]);

    await expect(resolve()).resolves.toEqual({
      status: 'resolved',
      resolution: 'use-cloud',
      apply: null,
      workQueued: false,
    });
    await expect(acknowledgeApplication({ legacyId: 'hero-a' })).resolves.toBe(
      false
    );
  });

  it('replays the keep-both application under the copy id alone', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario();
    const first = await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'keep-both',
      copyLegacyId: 'hero-copy',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });
    expect(await readApplicationRecords()).toEqual([
      expect.objectContaining({
        key: 'player-backup-application:run-a:hero-copy',
        kind: 'add',
        legacyId: 'hero-copy',
        sourceLegacyId: 'hero-a',
        resolution: 'keep-both',
      }),
    ]);

    // The copy id lives in the durable record, so the retry never repeats it.
    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'keep-both',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({ ...first, workQueued: false });

    await expect(
      acknowledgeApplication({ legacyId: 'hero-copy' })
    ).resolves.toBe(true);
    expect(await readApplicationRecords()).toEqual([]);
  });

  it('replays each conflict of one character under its own copy id', async () => {
    const { harness, gateway, row, seeded } = await seedConflictScenario();
    const replay = (conflictId: string) =>
      resolveConflict({
        conflictId,
        resolution: 'keep-both',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      });

    const first = await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'keep-both',
      copyLegacyId: 'hero-copy',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });
    // The character conflicts again in the same run, so a second unacknowledged
    // application now shares its source character with the first.
    const reseeded = await harness.seed({ row });
    expect(reseeded.conflictId).not.toBe(seeded.conflictId);
    const second = await resolveConflict({
      conflictId: reseeded.conflictId,
      resolution: 'keep-both',
      copyLegacyId: 'hero-copy-two',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });
    expect(await readApplicationRecords()).toHaveLength(2);

    await expect(replay(seeded.conflictId)).resolves.toEqual({
      ...first,
      workQueued: false,
    });
    await expect(replay(reseeded.conflictId)).resolves.toEqual({
      ...second,
      workQueued: false,
    });

    await expect(
      acknowledgeApplication({ legacyId: 'hero-copy' })
    ).resolves.toBe(true);
    await expect(
      acknowledgeApplication({ legacyId: 'hero-copy-two' })
    ).resolves.toBe(true);
    expect(await readApplicationRecords()).toEqual([]);
  });

  it('retains the application when the run is replaced before acknowledgement', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario();
    await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'use-cloud',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });
    const recorded = await readApplicationRecords();
    expect(recorded).toHaveLength(1);

    await confirmRun('run-b');

    await expect(
      acknowledgeApplication({ legacyId: 'hero-a' })
    ).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);
    expect(await readApplicationRecords()).toEqual(recorded);
  });

  it('refuses keep-mine and use-cloud on an archived candidate with zero gateway calls', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario({
      row: cloudRow({ deleted_at: ARCHIVED_AT }),
      comparison: 'removed',
    });

    for (const resolution of ['keep-mine', 'use-cloud'] as const) {
      await expect(
        resolveConflict({
          conflictId: seeded.conflictId,
          resolution,
          gateway,
          generateMutationId: harness.identities.generateMutationId,
        })
      ).resolves.toEqual({
        status: 'refused',
        reason: 'archived-requires-restore',
      });
    }

    expect(gateway.restore).not.toHaveBeenCalled();
    expect(gateway.put).not.toHaveBeenCalled();
    expect(gateway.fetch).not.toHaveBeenCalled();
    expect((await readConflict(seeded.conflictId)).resolutionState).toBe(
      'unresolved'
    );
  });

  it('refuses restore-online for a candidate that is not archived', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario();

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'restore-online',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({ status: 'refused', reason: 'not-archived' });
    expect(gateway.restore).not.toHaveBeenCalled();
  });

  it('restore-online restores explicitly with a retained identity and attaches an identical row', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario({
      row: cloudRow({ deleted_at: ARCHIVED_AT }),
      comparison: 'removed',
    });

    const result = await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'restore-online',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });

    expect(gateway.restoreRequests).toEqual([
      {
        mutationId: 'mutation-2',
        cloudId: 'cloud-1',
        expectedServerVersion: 2,
      },
    ]);
    expect(result).toEqual({
      status: 'restored',
      outcome: 'attached',
      apply: {
        kind: 'replace',
        legacyId: 'hero-a',
        payload: expect.anything(),
        contentFingerprint: expect.any(String),
      },
    });

    const conflict = await readConflict(seeded.conflictId);
    expect(conflict.cloudCandidate).toMatchObject({
      deleted_at: null,
      server_version: 3,
    });
    expect(conflict.resolutionState).toBe('resolved');
    expect(conflict.resolution).toBe('use-cloud');
    const documents = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    expect(documents[0].baseServerVersion).toBe(3);
    expect(documents[0].deletedAt).toBeNull();
    // The attach is an ordinary use-cloud application: the caller mirrors it
    // into the roster and acknowledges it like any other.
    if (result.status !== 'restored' || !result.apply) {
      throw new Error('restore-attach did not return an application');
    }
    expect(result.apply.payload).toEqual(documents[0].payload);
    expect(result.apply.contentFingerprint).toBe(
      documents[0].contentFingerprint
    );
    expect(await readApplicationRecords()).toEqual([
      expect.objectContaining({
        key: 'player-backup-application:run-a:hero-a',
        kind: 'replace',
        legacyId: 'hero-a',
        sourceLegacyId: 'hero-a',
        resolution: 'use-cloud',
        conflictId: seeded.conflictId,
      }),
    ]);
    await expect(acknowledgeApplication({ legacyId: 'hero-a' })).resolves.toBe(
      true
    );
    expect(await readApplicationRecords()).toEqual([]);

    const links = createMemoryCharacterCloudLinkRepository();
    await expect(settleConflicts(gateway, links)).resolves.toEqual({
      settled: ['hero-a'],
      pending: [],
    });
    expect((await readCheckpoints())['hero-a'].online).toMatchObject({
      state: 'protected',
      serverVersion: 3,
    });
    expect(links.get(ACCOUNT_A, 'hero-a')).toMatchObject({
      cloudId: 'cloud-1',
      serverVersion: 3,
    });
  });

  it('restore-online leaves a differing row as a three-way conflict', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario({
      row: cloudRow({
        deleted_at: ARCHIVED_AT,
        payload: encodeCharacterCloudPayload({
          ...HERO_A,
          name: 'Hero A (cloud)',
        }),
      }),
      comparison: 'removed',
    });

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'restore-online',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({
      status: 'restored',
      outcome: 'unresolved',
      apply: null,
    });

    const listing = await listPlayerBackupConflicts({
      factory: indexedDB,
      accountId: ACCOUNT_A,
      expectedActiveRunId: 'run-a',
    });
    expect(listing.conflicts).toHaveLength(1);
    expect(listing.conflicts[0]).toMatchObject({
      archived: false,
      comparison: 'different',
      resolutionState: 'unresolved',
      allowedResolutions: ['keep-mine', 'use-cloud', 'keep-both'],
    });
    expect((await readCheckpoints())['hero-a'].online).toMatchObject({
      reason: 'conflict:different',
      mutationId: 'mutation-2',
    });
  });

  it('reuses the restore identity after response loss and skips a second restore once acknowledged', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario({
      row: cloudRow({ deleted_at: ARCHIVED_AT }),
      comparison: 'removed',
    });
    gateway.failNextRestore = 'lost';

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'restore-online',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).rejects.toThrow('response lost');
    expect((await readCheckpoints())['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'needs-attention',
      reason: 'restore-pending',
      mutationId: 'mutation-2',
    });

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'restore-online',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({
      status: 'restored',
      outcome: 'attached',
      apply: expect.objectContaining({ kind: 'replace', legacyId: 'hero-a' }),
    });
    expect(gateway.restoreRequests).toHaveLength(1);
    expect(gateway.restoreRequests[0].mutationId).toBe('mutation-2');
  });

  it('refuses when the archived row changed under the restore', async () => {
    const row = cloudRow({ deleted_at: ARCHIVED_AT });
    const { harness, gateway, seeded } = await seedConflictScenario({
      row,
      comparison: 'removed',
    });
    const documentsBefore = await readStore('documents');
    gateway.failNextRestore = 'conflict';

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'restore-online',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({ status: 'refused', reason: 'online-changed' });

    const conflict = await readConflict(seeded.conflictId);
    expect(conflict.resolutionState).toBe('unresolved');
    expect(conflict.cloudCandidate).toEqual(row);
    expect(await readStore('documents')).toEqual(documentsBefore);
    expect(await readStore('legacySnapshots')).toEqual([]);
    expect((await readCheckpoints())['hero-a'].online).toMatchObject({
      reason: 'restore-pending',
      mutationId: 'mutation-2',
    });
  });

  it('keep-both on an archived candidate restores first then keeps both', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario({
      row: cloudRow({ deleted_at: ARCHIVED_AT }),
      comparison: 'removed',
    });

    const result = await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'keep-both',
      copyLegacyId: 'hero-copy',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });

    expect(gateway.restoreRequests).toEqual([
      {
        mutationId: 'mutation-2',
        cloudId: 'cloud-1',
        expectedServerVersion: 2,
      },
    ]);
    expect(result).toMatchObject({
      status: 'resolved',
      resolution: 'keep-both',
      workQueued: true,
    });
    const documents = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    expect(documents.some(document => document.legacyId === 'hero-copy')).toBe(
      true
    );
    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      legacyId: 'hero-a',
      state: 'queued',
      mutationId: 'mutation-3',
      originPlayerBackupRunId: 'run-a',
    });
  });

  it('refuses a colliding copy id before restoring an archived candidate', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario({
      row: cloudRow({ deleted_at: ARCHIVED_AT }),
      comparison: 'removed',
    });
    const [local] = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    await writeRecords('documents', [{ ...local, legacyId: 'hero-copy' }]);
    const before = await snapshotStores();

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'keep-both',
        copyLegacyId: 'hero-copy',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({ status: 'refused', reason: 'copy-id-collision' });

    expect(gateway.restore).not.toHaveBeenCalled();
    expect(gateway.fetch).not.toHaveBeenCalled();
    expect(gateway.rows.get('cloud-1')?.deleted_at).toBe(ARCHIVED_AT);
    expect(await snapshotStores()).toEqual(before);
    expect(harness.identities.generateMutationId).toHaveBeenCalledTimes(1);
  });

  it('refuses a replaced run before the lock without changing either candidate', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario();
    const documentsBefore = await readStore('documents');
    await confirmRun('run-b');

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'keep-mine',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);

    expect((await readConflict(seeded.conflictId)).resolutionState).toBe(
      'unresolved'
    );
    expect(await readStore('legacySnapshots')).toEqual([]);
    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0].state).toBe('conflict');
    expect(await readStore('documents')).toEqual(documentsBefore);
    expect(gateway.fetch).not.toHaveBeenCalled();
    expect(gateway.restore).not.toHaveBeenCalled();
  });

  it('two tabs cannot resolve stale work after a newer run wins', async () => {
    // Tab B waits for the lock, so its pre-lock run read already sees run-b:
    // the fence refuses it before the resolution transaction opens. The hook's
    // own assertions are covered by `the resolution transaction fence` below.
    const { harness, gateway, seeded } = await seedConflictScenario();
    const locks = new QueuedLocks();
    let releaseTabA: (() => void) | undefined;
    const held = new Promise<void>(resolve => {
      releaseTabA = resolve;
    });

    const tabA = withPlayerBackupAccountLock(
      { accountId: ACCOUNT_A, locks },
      async () => {
        await held;
        await confirmRun('run-b');
      }
    );
    const tabB = resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'keep-mine',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
      locks,
    }).catch((cause: unknown) => cause);
    releaseTabA!();
    await tabA;

    expect(await tabB).toBeInstanceOf(PlayerBackupRunReplacedError);
    expect((await readConflict(seeded.conflictId)).resolutionState).toBe(
      'unresolved'
    );
    expect(await readStore('legacySnapshots')).toEqual([]);
    expect(await readStore('outbox')).toHaveLength(1);
    await expect(drainWork(gateway, { runId: 'run-b' })).resolves.toEqual([
      'idle',
    ]);
  });

  it('refuses another account, a stale-run conflict, and an unselected character', async () => {
    await seedRun({ accountId: ACCOUNT_A, runId: 'run-a' });
    await seedRun({ accountId: ACCOUNT_B, runId: 'run-b' });
    const gateway = createConflictGateway();
    gateway.rows.set('cloud-1', cloudRow());
    await writeRecords('conflicts', [
      conflictRecord({
        conflictId: 'automatic-sync:foreign',
        mutationId: 'foreign',
        namespace: `user:${ACCOUNT_B}`,
      }),
      conflictRecord({
        conflictId: 'automatic-sync:stale',
        mutationId: 'stale',
        originPlayerBackupRunId: 'run-old',
      }),
      conflictRecord({
        conflictId: 'automatic-sync:cleared',
        mutationId: 'cleared',
        legacyId: 'hero-b',
        cloudCandidate: cloudRow({ legacy_client_id: 'hero-b' }),
      }),
    ]);
    const before = await snapshotStores();
    const identities = createIdentities('resolve');

    const refusals: Record<string, string> = {
      'automatic-sync:foreign': 'account-mismatch',
      'automatic-sync:stale': 'stale-run',
      'automatic-sync:cleared': 'not-selected',
    };
    for (const [conflictId, reason] of Object.entries(refusals)) {
      await expect(
        resolveConflict({
          conflictId,
          resolution: 'keep-mine',
          gateway,
          generateMutationId: identities.generateMutationId,
        })
      ).resolves.toEqual({ status: 'refused', reason });
    }

    expect(await snapshotStores()).toEqual(before);
    expect(identities.generateMutationId).not.toHaveBeenCalled();
  });

  it('fails closed without lock capability', async () => {
    const { seeded } = await seedConflictScenario();
    const factory = { open: vi.fn() } as unknown as IDBFactory;

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'keep-mine',
        gateway: createConflictGateway(),
        generateMutationId: () => 'mutation-x',
        locks: null,
        factory,
      })
    ).rejects.toBeInstanceOf(PlayerBackupLockUnavailableError);
    expect(factory.open).not.toHaveBeenCalled();
  });

  it('throws for a degraded run', async () => {
    await seedRun({ stage: 'confirmed', executionPath: 'degraded-manual' });
    await writeRecords('conflicts', [conflictRecord()]);

    await expect(
      resolveConflict({
        conflictId: 'automatic-sync:worker-1',
        resolution: 'keep-mine',
        gateway: createConflictGateway(),
        generateMutationId: () => 'mutation-x',
      })
    ).rejects.toThrow('Degraded manual backup never resolves a conflict');
  });
});

describe('settlePlayerBackupOneTimeConflicts', () => {
  it('reports pending until the refetched row matches the acknowledged document', async () => {
    const { harness, row, gateway, seeded } = await seedConflictScenario();
    await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'keep-mine',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });
    const links = createMemoryCharacterCloudLinkRepository();

    await expect(settleConflicts(gateway, links)).resolves.toEqual({
      settled: [],
      pending: ['hero-a'],
    });

    await expect(drainWork(gateway)).resolves.toEqual(['synced', 'idle']);
    const stored = gateway.rows.get(row.id);
    if (!stored) throw new Error('cloud row is missing');
    const acknowledged = stored.payload;
    stored.payload = encodeCharacterCloudPayload({
      ...HERO_A,
      name: 'Drifted',
    });
    const checkpointBefore = (await readCheckpoints())['hero-a'].online;

    await expect(settleConflicts(gateway, links)).resolves.toEqual({
      settled: [],
      pending: ['hero-a'],
    });
    expect(links.get(ACCOUNT_A, 'hero-a')).toBeNull();
    expect((await readCheckpoints())['hero-a'].online).toEqual(
      checkpointBefore
    );

    stored.payload = acknowledged;
    await expect(settleConflicts(gateway, links)).resolves.toEqual({
      settled: ['hero-a'],
      pending: [],
    });
  });

  it('contains a consent refusal to one character and settles the rest', async () => {
    const { gateway } = await seedTwoCharacterScenario();
    await expect(drainWork(gateway)).resolves.toEqual([
      'synced',
      'synced',
      'idle',
    ]);
    await writeCharacterPreference('hero-a', true);
    const checkpointBefore = (await readCheckpoints())['hero-a'].online;
    const links = createMemoryCharacterCloudLinkRepository();

    await expect(settleConflicts(gateway, links)).resolves.toEqual({
      settled: ['hero-b'],
      pending: ['hero-a'],
    });

    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toEqual(checkpointBefore);
    expect(checkpoints['hero-b'].online).toMatchObject({ state: 'protected' });
    expect(links.get(ACCOUNT_A, 'hero-a')).toBeNull();
    expect(links.get(ACCOUNT_A, 'hero-b')).toMatchObject({
      pendingMutation: null,
    });

    // A replaced run still invalidates the whole call.
    await confirmRun('run-b');
    await expect(settleConflicts(gateway, links)).rejects.toBeInstanceOf(
      PlayerBackupRunReplacedError
    );
  });

  it('does nothing for an ongoing run and pause retains data and work', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario({
      mode: 'ongoing',
    });
    await resolveConflict({
      conflictId: seeded.conflictId,
      resolution: 'keep-mine',
      gateway,
      generateMutationId: harness.identities.generateMutationId,
    });
    const links = createMemoryCharacterCloudLinkRepository();

    await expect(settleConflicts(gateway, links)).resolves.toEqual({
      settled: [],
      pending: [],
    });

    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    if (!database) throw new Error('database is missing');
    try {
      await new AutomaticCharacterSyncPreferences(database).setCharacter(
        NAMESPACE_A,
        'hero-a',
        false
      );
    } finally {
      database.close();
    }

    await expect(drainWork(gateway)).resolves.toEqual(['held']);
    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0].state).toBe('paused');
    expect(await readStore('documents')).toHaveLength(1);
    expect(gateway.putRequests).toEqual([]);
  });
});

describe('drainPlayerBackupRunWork', () => {
  it('dispatches run-origin work behind the guard and stops on the first non-synced result', async () => {
    const { gateway } = await seedTwoCharacterScenario();
    gateway.failPutFor.add('hero-b');

    await expect(drainWork(gateway)).resolves.toEqual(['synced', 'offline']);

    expect(gateway.putRequests.map(request => request.legacyId)).toEqual([
      'hero-a',
      'hero-b',
    ]);
    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ legacyId: 'hero-b', state: 'offline' });
  });
});

describe('the resolution transaction fence', () => {
  it('aborts the resolution transaction when the run pointer moved under the hook', async () => {
    const { seeded } = await seedConflictScenario();
    await confirmRun('run-b');
    const before = await snapshotStores();

    await expect(
      resolveWithFencedHook({
        conflictId: seeded.conflictId,
        expectedActiveRunId: 'run-a',
        resolution: 'keep-mine',
      })
    ).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);

    expect((await readConflict(seeded.conflictId)).resolutionState).toBe(
      'unresolved'
    );
    expect(await readStore('legacySnapshots')).toEqual([]);
    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0].state).toBe('conflict');
    expect(await snapshotStores()).toEqual(before);
  });

  it('aborts the resolution transaction for a run that is not local-ready', async () => {
    const { seeded } = await seedConflictScenario();
    // `run-b` is integrated and current, but it never reached local-ready.
    await confirmRun('run-b');
    const before = await snapshotStores();

    await expect(
      resolveWithFencedHook({
        conflictId: seeded.conflictId,
        expectedActiveRunId: 'run-b',
        resolution: 'keep-mine',
      })
    ).rejects.toThrow(
      'Conflict resolution is not authorised by the active run'
    );

    expect((await readConflict(seeded.conflictId)).resolutionState).toBe(
      'unresolved'
    );
    expect(await readStore('legacySnapshots')).toEqual([]);
    const outbox = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0].state).toBe('conflict');
    expect(await snapshotStores()).toEqual(before);
  });

  it('refuses a copy id the local stores already hold', async () => {
    const { harness, gateway, seeded } = await seedConflictScenario();
    const [local] = (await readStore(
      'documents'
    )) as AutomaticCharacterDocument[];
    await writeRecords('documents', [{ ...local, legacyId: 'hero-copy' }]);
    const beforeDocument = await snapshotStores();
    const mintedBefore =
      harness.identities.generateMutationId.mock.calls.length;

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'keep-both',
        copyLegacyId: 'hero-copy',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({ status: 'refused', reason: 'copy-id-collision' });
    expect(await snapshotStores()).toEqual(beforeDocument);
    // `resolve` mints the enqueue identity before it opens the transaction;
    // the aborted transaction discards it without writing anything.
    expect(harness.identities.generateMutationId.mock.calls.length).toBe(
      mintedBefore + 1
    );

    await writeCharacterPreference('hero-spare');
    const beforePreference = await snapshotStores();

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'keep-both',
        copyLegacyId: 'hero-spare',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({ status: 'refused', reason: 'copy-id-collision' });
    expect(await snapshotStores()).toEqual(beforePreference);
    expect(await readApplicationRecords()).toEqual([]);
    expect((await readConflict(seeded.conflictId)).resolutionState).toBe(
      'unresolved'
    );
  });

  it('quarantines an unsafe candidate and holds the character aside', async () => {
    const row = cloudRow({ schema_version: 99 });
    const { harness, gateway, seeded } = await seedConflictScenario({ row });

    await expect(
      resolveConflict({
        conflictId: seeded.conflictId,
        resolution: 'keep-mine',
        gateway,
        generateMutationId: harness.identities.generateMutationId,
      })
    ).resolves.toEqual({ status: 'quarantined' });

    const quarantine = (await readStore(
      'quarantine'
    )) as AutomaticSyncQuarantineRecord[];
    expect(quarantine).toHaveLength(1);
    expect(quarantine[0]).toMatchObject({
      quarantineId: `automatic-sync-quarantine:${seeded.conflictId}`,
      namespace: NAMESPACE_A,
      legacyId: 'hero-a',
    });
    expect(JSON.parse(quarantine[0].rawValue)).toEqual(row);
    expect((await readCheckpoints())['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'held-aside',
      reason: 'quarantined',
      cloudId: row.id,
      mutationId: 'mutation-1',
    });
    expect((await readConflict(seeded.conflictId)).resolutionState).toBe(
      'unresolved'
    );
    expect(await readStore('legacySnapshots')).toEqual([]);
  });
});
