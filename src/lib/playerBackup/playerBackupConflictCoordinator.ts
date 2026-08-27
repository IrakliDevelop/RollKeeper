import type {
  AutomaticCharacterConflict,
  AutomaticCharacterDocument,
  AutomaticCharacterOutboxEntry,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import {
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

import {
  CONSENT_NOT_ACKNOWLEDGED,
  NO_CLOUD_IDENTITY,
  onlineCheckpoint,
  withExistingDatabase,
} from './playerBackupOnlineExecution';
import type { PlayerBackupExclusiveLockProvider } from './playerBackupRunFence';
import {
  PlayerBackupLockUnavailableError,
  hasPlayerBackupExclusiveLockCapability,
  runPlayerBackupTransaction,
  withPlayerBackupAccountLock,
} from './playerBackupRunFence';
import type { PlayerBackupRunV1 } from './playerBackupRunRepository';
import {
  assertPlayerBackupRunLocalReady,
  listPlayerBackupPendingApplicationsInTransaction,
  playerBackupExecutionPath,
  readActivePlayerBackupRun,
  readPlayerBackupRunInTransaction,
  updatePlayerBackupCharacterCheckpoint,
} from './playerBackupRunRepository';

// Resolution, explicit restore, one-time settlement and the run-origin drain
// live in `playerBackupConflictResolution` and are re-exported here so callers
// keep a single conflict entry point.
export type {
  PlayerBackupConflictRefusal,
  PlayerBackupConflictResolveOptions,
  PlayerBackupConflictResolveResult,
  PlayerBackupDrainOptions,
  PlayerBackupLocalApplication,
  PlayerBackupPendingApplication,
  PlayerBackupSettleOptions,
} from './playerBackupConflictResolution';
export {
  PlayerBackupCopyIdCollisionError,
  applyPlayerBackupPendingApplication,
  drainPlayerBackupRunWork,
  resolvePlayerBackupConflict,
  settlePlayerBackupOneTimeConflicts,
} from './playerBackupConflictResolution';

/** How the online row differs from the selected local character. */
export type PlayerBackupConflictComparison = 'newer' | 'different' | 'removed';
/** Why a candidate was held aside instead of becoming a conflict. */
export type PlayerBackupHeldAsideReason = 'future' | 'unavailable';
export type PlayerBackupConflictResolution =
  | 'keep-mine'
  | 'use-cloud'
  | 'keep-both'
  | 'restore-online';

/** Checkpoint reasons are machine discriminants: `conflict:<comparison>`. */
export const CONFLICT_REASON_PREFIX = 'conflict:';
export const RESTORE_PENDING_REASON = 'restore-pending';

const UNSAFE_CANDIDATE = 'Cloud conflict candidate identity is unsafe';
const DEGRADED_NEVER = 'Degraded manual backup never ';
const NOT_SELECTED = 'Character is not selected in this player backup run';
const WORK_NOT_SAVED = 'Conflict work could not be saved';
const RUN_MISSING = 'Committed player backup run is missing';

const UNRESOLVED_ARCHIVED: PlayerBackupConflictResolution[] = [
  'restore-online',
  'keep-both',
];
const UNRESOLVED_PRESENT: PlayerBackupConflictResolution[] = [
  'keep-mine',
  'use-cloud',
  'keep-both',
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * The only run a conflict may be seeded, held aside or listed against: the
 * active account's committed, integrated run at stage local-ready, with the
 * character still selected and its consent partition intact.
 *
 * The execution path is checked against a permissive read first, so a degraded
 * run — which is structurally pinned to stage `confirmed` — is refused for
 * being degraded rather than for not being local-ready. `action` names what
 * the caller was attempting, so that refusal reads truthfully.
 */
async function assertSeedableRun(
  meta: IDBObjectStore,
  options: {
    accountId: string;
    expectedActiveRunId: string;
    legacyId: string;
    action: 'seeds a conflict' | 'holds a candidate aside';
  }
): Promise<PlayerBackupRunV1> {
  const committed = await readPlayerBackupRunInTransaction(
    meta,
    options.accountId,
    options.expectedActiveRunId
  );
  if (playerBackupExecutionPath(committed) !== 'integrated') {
    throw new Error(`${DEGRADED_NEVER}${options.action}`);
  }
  const run = await assertPlayerBackupRunLocalReady(
    meta,
    options.accountId,
    options.expectedActiveRunId
  );
  if (!run.selectedCharacterIds.includes(options.legacyId)) {
    throw new Error(NOT_SELECTED);
  }
  const policy =
    await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
      meta,
      run.namespace,
      options.legacyId
    );
  const account =
    await AutomaticCharacterSyncPreferences.readAccountDefaultInTransaction(
      meta,
      run.namespace
    );
  if (
    policy !== (run.mode === 'ongoing' ? 'on' : 'off') ||
    account?.confirmedAt !== run.confirmedAt
  ) {
    throw new Error(CONSENT_NOT_ACKNOWLEDGED);
  }
  return run;
}

/** Two online candidates are the same when their identity triple matches. */
function sameCandidate(left: unknown, right: CharacterCloudRow): boolean {
  const candidate = left as Partial<CharacterCloudRow> | null;
  return (
    candidate?.id === right.id &&
    candidate.server_version === right.server_version &&
    (candidate.deleted_at ?? null) === right.deleted_at
  );
}

function conflictCheckpoint(options: {
  cloudId: string;
  mutationId: string;
  recordedAt: string;
  comparison: PlayerBackupConflictComparison;
}) {
  return onlineCheckpoint({
    kind: 'automatic',
    state: 'needs-attention',
    cloudId: options.cloudId,
    mutationId: options.mutationId,
    recordedAt: options.recordedAt,
    reason: `${CONFLICT_REASON_PREFIX}${options.comparison}`,
  });
}

function localRevisionOf(character: unknown): number {
  const revision = (
    character as { characterData?: { revision?: unknown } } | null
  )?.characterData?.revision;
  return typeof revision === 'number' &&
    Number.isFinite(revision) &&
    revision >= 0
    ? revision
    : 0;
}

/** A candidate without a readable `deleted_at` counts as archived: the safe
 * direction, since only an explicit recovery decision may resurrect one. */
function isArchivedCandidate(candidate: unknown): boolean {
  return (
    (candidate as { deleted_at?: string | null } | null)?.deleted_at !== null
  );
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

export interface PlayerBackupConflictSeedInLockOptions {
  /** Open existing database; the caller holds the account lock. */
  database: IDBDatabase;
  accountId: string;
  expectedActiveRunId: string;
  legacyId: string;
  /** Roster object shaped `{ id, name, characterData }`. */
  character: unknown;
  row: CharacterCloudRow;
  comparison: PlayerBackupConflictComparison;
  existingLink: CharacterCloudLink | null;
  generateMutationId: () => string;
  now: () => string;
}

export interface PlayerBackupConflictSeedResult {
  conflictId: string;
  mutationId: string;
  created: boolean;
  refreshed: boolean;
}

/**
 * Preserves both candidates durably for one selected character.
 *
 * Everything asynchronous that is not an IndexedDB request — the payload and
 * its fingerprint — is computed before the fenced transaction opens, because a
 * foreign `await` would auto-commit it.
 *
 * @internal caller must hold `withPlayerBackupAccountLock` for `accountId`
 */
export async function seedPlayerBackupConflictInLock(
  options: PlayerBackupConflictSeedInLockOptions
): Promise<PlayerBackupConflictSeedResult> {
  const { row, legacyId, comparison } = options;
  const payload = encodeCharacterCloudPayload(options.character);
  const contentFingerprint = await fingerprintCharacterPayload(payload);
  const localRevision = localRevisionOf(options.character);
  const recordedAt = options.now();

  if (
    row.legacy_client_id !== legacyId ||
    (comparison === 'removed') !== (row.deleted_at !== null)
  ) {
    throw new Error(UNSAFE_CANDIDATE);
  }

  const repository = new IndexedDbAutomaticCharacterSyncRepository(
    options.database
  );

  return runPlayerBackupTransaction({
    database: options.database,
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    stores: [
      'documents',
      'outbox',
      'tombstones',
      'conflicts',
      'legacySnapshots',
    ],
    task: async transaction => {
      const meta = transaction.objectStore('meta');
      const run = await assertSeedableRun(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId,
        action: 'seeds a conflict',
      });

      const writeCheckpoint = (mutationId: string) =>
        updatePlayerBackupCharacterCheckpoint(meta, {
          accountId: options.accountId,
          expectedActiveRunId: options.expectedActiveRunId,
          legacyId,
          online: conflictCheckpoint({
            cloudId: row.id,
            mutationId,
            recordedAt,
            comparison,
          }),
        });

      const existing = (
        await repository.listConflictsInTransaction(transaction, run.namespace)
      ).find(
        conflict =>
          conflict.legacyId === legacyId &&
          conflict.resolutionState === 'unresolved'
      );
      if (existing) {
        // Adopting a conflict whose preserved local candidate already points
        // at a different cloud copy would silently retarget it, so the
        // transaction aborts instead. A candidate that never carried a cloud
        // identity (base version zero) is still adoptable.
        const preservedCloudId = existing.localCandidate?.cloudId;
        if (preservedCloudId !== undefined && preservedCloudId !== row.id) {
          throw new Error(UNSAFE_CANDIDATE);
        }
        // A candidate preserved before the character changed no longer states
        // what this run would back up, so it is verified against the freshly
        // read character rather than adopted on trust.
        const localMatches =
          existing.localCandidate !== null &&
          existing.localCandidate.contentFingerprint === contentFingerprint &&
          existing.localCandidate.localRevision === localRevision;
        // An unresolved conflict left by ordinary automatic sync (no origin) or
        // by a superseded run is adopted into this run — the new consent
        // authorises it — but only once it carries this run's origin.
        if (
          sameCandidate(existing.cloudCandidate, row) &&
          existing.originPlayerBackupRunId === run.runId &&
          localMatches
        ) {
          return {
            conflictId: existing.conflictId,
            mutationId: existing.mutationId,
            created: false,
            refreshed: false,
          };
        }
        if (!localMatches) {
          await repository.refreshConflictLocalCandidateInTransaction(
            transaction,
            existing.conflictId,
            {
              namespace: run.namespace,
              family: 'character',
              legacyId,
              cloudId: row.id,
              operation:
                (existing.localCandidate?.baseServerVersion ?? 0) > 0
                  ? 'replace'
                  : 'create',
              payload,
              schemaVersion: existing.localCandidate?.schemaVersion ?? 1,
              localRevision,
              baseServerVersion:
                existing.localCandidate?.baseServerVersion ?? 0,
              contentFingerprint,
              syncPolicy: run.mode === 'ongoing' ? 'on' : 'off',
              updatedAt: recordedAt,
              deletedAt: null,
              originPlayerBackupRunId: run.runId,
            },
            recordedAt
          );
        }
        if (
          !sameCandidate(existing.cloudCandidate, row) ||
          existing.originPlayerBackupRunId !== run.runId
        ) {
          await repository.refreshConflictCloudCandidateInTransaction(
            transaction,
            existing.conflictId,
            row,
            recordedAt,
            { originPlayerBackupRunId: run.runId }
          );
        }
        await writeCheckpoint(existing.mutationId);
        return {
          conflictId: existing.conflictId,
          mutationId: existing.mutationId,
          created: false,
          refreshed: true,
        };
      }

      const existingDocument = (await requestResult(
        transaction
          .objectStore('documents')
          .get([run.namespace, 'character', legacyId])
      )) as AutomaticCharacterDocument | undefined;
      const baseServerVersion =
        existingDocument?.cloudId === row.id
          ? existingDocument.baseServerVersion
          : options.existingLink?.cloudId === row.id
            ? options.existingLink.serverVersion
            : 0;
      const mutationId = options.generateMutationId();
      const written = await repository.writeMutationInTransaction(
        transaction,
        {
          namespace: run.namespace,
          legacyId,
          cloudId: row.id,
          operation: baseServerVersion > 0 ? 'replace' : 'create',
          payload,
          schemaVersion: existingDocument?.schemaVersion ?? 1,
          localRevision,
          baseServerVersion,
          contentFingerprint,
          syncPolicy: run.mode === 'ongoing' ? 'on' : 'off',
          updatedAt: recordedAt,
          originPlayerBackupRunId: run.runId,
        },
        { mutationId }
      );
      if (!written.saved) throw new Error(WORK_NOT_SAVED);

      const entry = (await requestResult(
        transaction.objectStore('outbox').get(mutationId)
      )) as AutomaticCharacterOutboxEntry | undefined;
      if (!entry) throw new Error(WORK_NOT_SAVED);

      const conflict = await repository.preserveConflictInTransaction(
        transaction,
        entry,
        row,
        recordedAt,
        { originPlayerBackupRunId: run.runId }
      );
      await writeCheckpoint(mutationId);
      return {
        conflictId: conflict.conflictId,
        mutationId,
        created: true,
        refreshed: false,
      };
    },
  });
}

/**
 * Acquires the account lock, then seeds inside it. Fails closed without one.
 *
 * Must not be called while the caller holds the account lock; use
 * `seedPlayerBackupConflictInLock` from inside the lock.
 */
export async function seedPlayerBackupConflict(
  options: Omit<PlayerBackupConflictSeedInLockOptions, 'database'> & {
    factory: IDBFactory;
    locks: PlayerBackupExclusiveLockProvider | null | undefined;
  }
): Promise<PlayerBackupConflictSeedResult> {
  const { factory, locks, ...seed } = options;
  if (!hasPlayerBackupExclusiveLockCapability(locks)) {
    throw new PlayerBackupLockUnavailableError();
  }
  return withPlayerBackupAccountLock({ accountId: seed.accountId, locks }, () =>
    withExistingDatabase(factory, database =>
      seedPlayerBackupConflictInLock({ ...seed, database })
    )
  );
}

// ---------------------------------------------------------------------------
// Holding a candidate aside
// ---------------------------------------------------------------------------

export interface PlayerBackupHoldAsideInLockOptions {
  database: IDBDatabase;
  accountId: string;
  expectedActiveRunId: string;
  legacyId: string;
  row: CharacterCloudRow | null;
  reason: PlayerBackupHeldAsideReason;
  detail?: string | null;
  checkpointKind: 'manual' | 'automatic';
  now: () => string;
}

/**
 * Records an unusable online candidate without ever adopting it: the exact
 * bytes go to quarantine and the character keeps a held-aside checkpoint.
 *
 * @internal caller must hold the account lock
 */
export async function holdPlayerBackupCandidateAsideInLock(
  options: PlayerBackupHoldAsideInLockOptions
): Promise<void> {
  const { row, legacyId, reason } = options;
  const recordedAt = options.now();
  const repository = new IndexedDbAutomaticCharacterSyncRepository(
    options.database
  );

  await runPlayerBackupTransaction({
    database: options.database,
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    stores: ['quarantine'],
    task: async transaction => {
      const meta = transaction.objectStore('meta');
      const run = await assertSeedableRun(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId,
        action: 'holds a candidate aside',
      });
      if (row) {
        repository.quarantineCloudCandidateInTransaction(
          transaction,
          run.namespace,
          legacyId,
          row,
          options.detail ?? reason,
          recordedAt
        );
      }
      await updatePlayerBackupCharacterCheckpoint(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId,
        online: onlineCheckpoint({
          kind: options.checkpointKind,
          state: 'held-aside',
          cloudId: row?.id ?? NO_CLOUD_IDENTITY,
          mutationId:
            run.characterCheckpoints[legacyId]?.online?.mutationId ?? null,
          recordedAt,
          reason,
        }),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Read-only listing
// ---------------------------------------------------------------------------

export interface PlayerBackupConflictSummary {
  conflictId: string;
  legacyId: string;
  mutationId: string;
  comparison: PlayerBackupConflictComparison | 'unknown';
  archived: boolean;
  originPlayerBackupRunId: string | null;
  detectedAt: string;
  resolutionState: 'unresolved' | 'resolved';
  pendingApplicationLegacyId: string | null;
  allowedResolutions: PlayerBackupConflictResolution[];
  localCandidate: AutomaticCharacterDocument | null;
  cloudCandidate: CharacterCloudRow;
}

export interface PlayerBackupHeldAsideSummary {
  legacyId: string;
  reason: string;
  detectedAt: string;
  recoveryAvailable: boolean;
}

export interface PlayerBackupConflictListing {
  accountId: string;
  runId: string;
  conflicts: PlayerBackupConflictSummary[];
  heldAside: PlayerBackupHeldAsideSummary[];
}

const COMPARISONS: PlayerBackupConflictComparison[] = [
  'newer',
  'different',
  'removed',
];

/** The comparison the seeding decision recorded, when the run still holds it. */
function checkpointComparison(
  run: PlayerBackupRunV1,
  legacyId: string
): PlayerBackupConflictComparison | 'unknown' {
  const reason = run.characterCheckpoints[legacyId]?.online?.reason;
  if (!reason?.startsWith(CONFLICT_REASON_PREFIX)) return 'unknown';
  const comparison = reason.slice(CONFLICT_REASON_PREFIX.length);
  return COMPARISONS.find(value => value === comparison) ?? 'unknown';
}

function summarizeConflict(
  conflict: AutomaticCharacterConflict,
  run: PlayerBackupRunV1,
  pendingApplicationLegacyId: string | null
): PlayerBackupConflictSummary {
  const archived = isArchivedCandidate(conflict.cloudCandidate);
  const origin = conflict.originPlayerBackupRunId ?? null;
  // Work stamped by a superseded run is retained, never resolved through this
  // wizard, until a seed adopts it into the active run. A conflict with no
  // origin has not been claimed by any run and stays resolvable.
  const stale = origin !== null && origin !== run.runId;
  return {
    conflictId: conflict.conflictId,
    legacyId: conflict.legacyId,
    mutationId: conflict.mutationId,
    comparison: checkpointComparison(run, conflict.legacyId),
    archived,
    originPlayerBackupRunId: origin,
    detectedAt: conflict.detectedAt,
    resolutionState: conflict.resolutionState,
    pendingApplicationLegacyId,
    allowedResolutions:
      conflict.resolutionState === 'resolved' || stale
        ? []
        : [...(archived ? UNRESOLVED_ARCHIVED : UNRESOLVED_PRESENT)],
    localCandidate: conflict.localCandidate,
    cloudCandidate: conflict.cloudCandidate as CharacterCloudRow,
  };
}

/**
 * Passive: reports the durable conflict and quarantine evidence of the active
 * run's selected characters. It never seeds, adopts, resolves or writes.
 */
export async function listPlayerBackupConflicts(options: {
  factory: IDBFactory;
  accountId: string;
  expectedActiveRunId: string;
}): Promise<PlayerBackupConflictListing> {
  const run = await readActivePlayerBackupRun({
    accountId: options.accountId,
    factory: options.factory,
  });
  if (!run || run.runId !== options.expectedActiveRunId) {
    throw new Error(RUN_MISSING);
  }
  if (playerBackupExecutionPath(run) === 'degraded-manual') {
    // A degraded run never seeds, quarantines or resolves integrated conflicts,
    // so it has nothing of its own to list and must not surface anyone else's.
    return {
      accountId: run.accountId,
      runId: run.runId,
      conflicts: [],
      heldAside: [],
    };
  }
  const selected = new Set(run.selectedCharacterIds);
  return withExistingDatabase(options.factory, async database => {
    const repository = new IndexedDbAutomaticCharacterSyncRepository(database);
    const conflicts = await repository.listConflicts(run.namespace);
    const quarantine = await repository.listQuarantine(run.namespace);
    const transaction = database.transaction('meta', 'readonly');
    const pendingApplications =
      await listPlayerBackupPendingApplicationsInTransaction(
        transaction.objectStore('meta'),
        run.runId
      );
    await transactionComplete(transaction);
    const pendingApplicationByConflict = new Map(
      pendingApplications
        .filter(application => application.accountId === run.accountId)
        .map(application => [application.conflictId, application.legacyId])
    );
    return {
      accountId: run.accountId,
      runId: run.runId,
      conflicts: conflicts
        .filter(conflict => selected.has(conflict.legacyId))
        .map(conflict =>
          summarizeConflict(
            conflict,
            run,
            pendingApplicationByConflict.get(conflict.conflictId) ?? null
          )
        ),
      heldAside: quarantine
        .filter(record => selected.has(record.legacyId))
        .map(record => ({
          legacyId: record.legacyId,
          reason: record.reason,
          detectedAt: record.detectedAt,
          recoveryAvailable:
            typeof record.rawValue === 'string' && record.rawValue.length > 0,
        })),
    };
  });
}
