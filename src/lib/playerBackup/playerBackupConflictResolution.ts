import type { Json } from '@/types/database.generated';

import type { AutomaticCharacterConflict } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { AutomaticCharacterConflictService } from '@/lib/indexeddb/automaticCharacterConflictService';
import {
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import { decodeCharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import type { CharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';
import type { CharacterCloudGateway } from '@/lib/supabase/manualCharacterCloudService';
import type {
  AutomaticCharacterSyncGateway,
  AutomaticSyncRunResult,
} from '@/lib/supabase/automaticCharacterSyncWorker';
import { AutomaticCharacterSyncWorker } from '@/lib/supabase/automaticCharacterSyncWorker';

import type { PlayerBackupCloudComparison } from './playerBackupCloudPreview';
import { compareCloudRows } from './playerBackupCloudPreview';
import type { PlayerBackupConflictResolution } from './playerBackupConflictCoordinator';
import {
  CONFLICT_REASON_PREFIX,
  RESTORE_PENDING_REASON,
} from './playerBackupConflictCoordinator';
import { createPlayerBackupDispatchGuard } from './playerBackupOngoingExecution';
import type { PlayerBackupLocalCharacterSource } from './playerBackupOnlineExecution';
import {
  CONSENT_NOT_ACKNOWLEDGED,
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
  PlayerBackupRunReplacedError,
  playerBackupApplicationKey,
  playerBackupExecutionPath,
  readActivePlayerBackupRun,
  readPlayerBackupRunInTransaction,
  updatePlayerBackupCharacterCheckpoint,
} from './playerBackupRunRepository';

const CONFLICT_MISSING = 'Automatic sync conflict was not found';
const DEGRADED_NEVER_RESOLVES =
  'Degraded manual backup never resolves a conflict';
const NOT_AUTHORISED =
  'Conflict resolution is not authorised by the active run';
const RESTORE_UNVERIFIED = 'Cloud restore verification failed';
const RESOLUTION_MISSING = 'Resolved conflict has no recorded resolution';
const DOCUMENT_MISSING = 'Resolved character document is missing';

/** Thrown inside the resolution hook so the whole transaction aborts. */
export class PlayerBackupCopyIdCollisionError extends Error {
  readonly name = 'PlayerBackupCopyIdCollisionError';

  constructor() {
    super('Keep both requires an unused character id');
  }
}

/**
 * The roster change one resolution recorded durably, so a caller that crashed
 * before applying it is handed the same change again on its next attempt.
 */
export interface PlayerBackupPendingApplication {
  version: 1;
  runId: string;
  accountId: string;
  kind: 'replace' | 'add';
  /** The roster entry to write: the character, or the keep-both copy. */
  legacyId: string;
  /** The conflicted character the decision was made for. */
  sourceLegacyId: string;
  resolution: 'use-cloud' | 'keep-both';
  conflictId: string;
  recordedAt: string;
}

/** The local roster change a resolution asks its caller to apply. */
export interface PlayerBackupLocalApplication {
  kind: 'replace' | 'add';
  legacyId: string;
  payload: Json;
  contentFingerprint: string;
}

export type PlayerBackupConflictRefusal =
  | 'account-mismatch'
  | 'not-selected'
  | 'stale-run'
  | 'archived-requires-restore'
  | 'not-archived'
  | 'copy-id-required'
  | 'copy-id-collision'
  | 'online-changed';

export type PlayerBackupConflictResolveResult =
  | {
      status: 'resolved';
      resolution: 'keep-mine' | 'use-cloud' | 'keep-both';
      apply: PlayerBackupLocalApplication | null;
      workQueued: boolean;
    }
  | {
      status: 'restored';
      outcome: 'attached' | 'unresolved';
      /** Non-null only for `attached`, and acknowledged like any other. */
      apply: PlayerBackupLocalApplication | null;
    }
  | { status: 'quarantined' }
  | { status: 'refused'; reason: PlayerBackupConflictRefusal };

export interface PlayerBackupConflictResolveOptions {
  factory: IDBFactory;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  accountId: string;
  expectedActiveRunId: string;
  conflictId: string;
  resolution: PlayerBackupConflictResolution;
  copyLegacyId?: string;
  /** Collision check, and re-correlation of a restored row. */
  characters: PlayerBackupLocalCharacterSource;
  gateway: Pick<CharacterCloudGateway, 'fetch' | 'restore'>;
  generateMutationId: () => string;
  now: () => string;
}

type AppliedResolution = 'keep-mine' | 'use-cloud' | 'keep-both';

function refused(
  reason: PlayerBackupConflictRefusal
): PlayerBackupConflictResolveResult {
  return { status: 'refused', reason };
}

/**
 * The context every fenced step of one resolution shares. `run` is the
 * pre-lock read; every write re-reads the run inside its own transaction.
 */
interface ResolutionContext {
  options: PlayerBackupConflictResolveOptions;
  database: IDBDatabase;
  service: AutomaticCharacterConflictService;
  repository: IndexedDbAutomaticCharacterSyncRepository;
  conflict: AutomaticCharacterConflict;
  run: PlayerBackupRunV1;
}

/**
 * Re-asserts, inside a caller-owned transaction, that the active run still
 * authorises this character's resolution.
 */
async function assertResolvableConflict(
  meta: IDBObjectStore,
  options: {
    accountId: string;
    expectedActiveRunId: string;
    legacyId: string;
    namespace: string;
  }
): Promise<PlayerBackupRunV1> {
  const run = await readPlayerBackupRunInTransaction(
    meta,
    options.accountId,
    options.expectedActiveRunId
  );
  if (
    run.stage !== 'local-ready' ||
    playerBackupExecutionPath(run) !== 'integrated' ||
    !run.selectedCharacterIds.includes(options.legacyId) ||
    options.namespace !== run.namespace
  ) {
    throw new Error(NOT_AUTHORISED);
  }
  return run;
}

// ---------------------------------------------------------------------------
// Explicit restore
// ---------------------------------------------------------------------------

type RestoreOutcome =
  | { status: 'refused'; reason: 'online-changed' }
  | { status: 'restored'; comparison: PlayerBackupCloudComparison };

/**
 * Resurrects an archived cloud copy as an explicit decision. The retained
 * restore identity is written to the checkpoint *before* the request, so a
 * lost response is retried with the same mutation id instead of restoring
 * twice; the conflict record is refreshed only after the row is verified.
 */
async function restoreArchivedCandidate(
  context: ResolutionContext
): Promise<RestoreOutcome> {
  const { options, conflict } = context;
  const legacyId = conflict.legacyId;
  const candidate = conflict.cloudCandidate as CharacterCloudRow;
  const cloudId = candidate.id;
  const existing = context.run.characterCheckpoints[legacyId]?.online;
  const restoreMutationId =
    existing?.reason === RESTORE_PENDING_REASON && existing.mutationId
      ? existing.mutationId
      : options.generateMutationId();

  const pending = onlineCheckpoint({
    kind: 'automatic',
    state: 'needs-attention',
    cloudId,
    mutationId: restoreMutationId,
    recordedAt: options.now(),
    reason: RESTORE_PENDING_REASON,
  });
  await runPlayerBackupTransaction({
    database: context.database,
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    stores: [],
    task: async transaction => {
      const meta = transaction.objectStore('meta');
      const run = await assertResolvableConflict(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId,
        namespace: conflict.namespace,
      });
      const recorded = run.characterCheckpoints[legacyId]?.online;
      const unchanged =
        recorded?.kind === 'automatic' &&
        recorded.state === 'needs-attention' &&
        recorded.reason === RESTORE_PENDING_REASON &&
        recorded.cloudId === cloudId &&
        recorded.mutationId === restoreMutationId;
      if (unchanged) return;
      await updatePlayerBackupCharacterCheckpoint(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId,
        online: pending,
      });
    },
  });

  // A row that is already present was restored by an acknowledgement this
  // client lost, or by someone else; either way a second restore is skipped.
  const current = await options.gateway.fetch(cloudId);
  if (!current || current.deleted_at !== null) {
    const result = await options.gateway.restore({
      mutationId: restoreMutationId,
      cloudId,
      expectedServerVersion: candidate.server_version,
    });
    if (result.status !== 'success') {
      // The checkpoint keeps `restore-pending` with its identity, and the
      // conflict still holds the archived candidate untouched.
      return { status: 'refused', reason: 'online-changed' };
    }
  }

  const restored = await options.gateway.fetch(cloudId);
  if (
    !restored ||
    restored.deleted_at !== null ||
    restored.legacy_client_id !== legacyId
  ) {
    throw new Error(RESTORE_UNVERIFIED);
  }
  const decoded = await decodeCharacterCloudRow(restored);
  if (decoded.status !== 'supported') throw new Error(RESTORE_UNVERIFIED);

  const character = options.characters.get(legacyId);
  const comparison: PlayerBackupCloudComparison =
    character === null || character === undefined
      ? 'different'
      : (await compareCloudRows([restored], [character])).characters[0].state;
  // An identical row is resolved in the same call, so the transient reason
  // recorded here must never claim the conflict is already settled.
  const reason = `${CONFLICT_REASON_PREFIX}${
    comparison === 'identical' ? 'different' : comparison
  }`;
  const detectedAt = options.now();

  await runPlayerBackupTransaction({
    database: context.database,
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    stores: ['conflicts'],
    task: async transaction => {
      const meta = transaction.objectStore('meta');
      await assertResolvableConflict(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId,
        namespace: conflict.namespace,
      });
      await context.repository.refreshConflictCloudCandidateInTransaction(
        transaction,
        options.conflictId,
        restored,
        detectedAt
      );
      await updatePlayerBackupCharacterCheckpoint(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId,
        online: onlineCheckpoint({
          kind: 'automatic',
          state: 'needs-attention',
          cloudId,
          mutationId: restoreMutationId,
          recordedAt: detectedAt,
          reason,
        }),
      });
    },
  });

  return { status: 'restored', comparison };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** @internal Exported so the in-transaction fence can be tested directly. */
export interface PlayerBackupResolutionHookOptions {
  accountId: string;
  expectedActiveRunId: string;
  resolution: 'keep-mine' | 'use-cloud' | 'keep-both';
  copyLegacyId?: string;
  now: () => string;
}

/**
 * Builds the hook that runs inside the resolution transaction, after the
 * conflict is re-read and before any write. It only ever awaits requests on
 * that transaction: the run fence, the keep-both collision reads, the copy's
 * explicit `off` preference and the run checkpoint. It never touches the
 * conflict record, and any throw aborts the whole resolution.
 *
 * @internal Exported for direct fence tests; production callers reach it
 * through `resolvePlayerBackupConflict`.
 */
export function createPlayerBackupResolutionHook(
  options: PlayerBackupResolutionHookOptions
): {
  run(
    transaction: IDBTransaction,
    current: AutomaticCharacterConflict,
    plan: { enqueuedMutationId: string | null }
  ): Promise<void>;
} {
  return {
    async run(transaction, current, plan) {
      const meta = transaction.objectStore('meta');
      const fenced = await assertResolvableConflict(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId: current.legacyId,
        namespace: current.namespace,
      });

      if (options.resolution === 'keep-both') {
        const copyLegacyId = options.copyLegacyId as string;
        const copyDocument = await requestResult(
          transaction
            .objectStore('documents')
            .get([fenced.namespace, 'character', copyLegacyId])
        );
        const copyPolicy =
          await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
            meta,
            fenced.namespace,
            copyLegacyId
          );
        if (copyDocument || copyPolicy !== null) {
          throw new PlayerBackupCopyIdCollisionError();
        }
        AutomaticCharacterSyncPreferences.writeCharacterPolicyInTransaction(
          meta,
          fenced.namespace,
          copyLegacyId,
          'off'
        );
      }

      await updatePlayerBackupCharacterCheckpoint(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId: current.legacyId,
        online: onlineCheckpoint({
          kind: 'automatic',
          state: plan.enqueuedMutationId ? 'queued' : 'pending',
          cloudId: (current.cloudCandidate as CharacterCloudRow).id,
          mutationId: plan.enqueuedMutationId ?? current.mutationId,
          recordedAt: options.now(),
          reason: `resolved:${options.resolution}`,
        }),
      });

      if (options.resolution !== 'keep-mine') {
        // The roster lives outside this transaction, so the change it owes is
        // recorded with the resolution and survives until it is acknowledged.
        const legacyId =
          options.resolution === 'use-cloud'
            ? current.legacyId
            : (options.copyLegacyId as string);
        meta.put({
          key: playerBackupApplicationKey(fenced.runId, legacyId),
          version: 1,
          runId: fenced.runId,
          accountId: options.accountId,
          kind: options.resolution === 'use-cloud' ? 'replace' : 'add',
          legacyId,
          sourceLegacyId: current.legacyId,
          resolution: options.resolution,
          conflictId: current.conflictId,
          recordedAt: options.now(),
        } satisfies PlayerBackupPendingApplication & { key: string });
      }
    },
  };
}

/**
 * Reads the active run's outstanding roster applications. The `meta` store has
 * no index, so the run-scoped key prefix is the filter.
 */
async function readPendingApplications(
  database: IDBDatabase,
  runId: string
): Promise<PlayerBackupPendingApplication[]> {
  const transaction = database.transaction('meta', 'readonly');
  const rows = (await requestResult(
    transaction.objectStore('meta').getAll()
  )) as (PlayerBackupPendingApplication & { key?: unknown })[];
  await transactionComplete(transaction);
  const prefix = playerBackupApplicationKey(runId, '');
  return rows.filter(
    row =>
      typeof row.key === 'string' &&
      row.key.startsWith(prefix) &&
      row.version === 1
  );
}

/** The winning document the caller must mirror into the local roster. */
async function applicationOf(
  repository: IndexedDbAutomaticCharacterSyncRepository,
  namespace: AutomaticCharacterConflict['namespace'],
  kind: 'replace' | 'add',
  legacyId: string
): Promise<PlayerBackupLocalApplication> {
  const document = await repository.getDocument(namespace, legacyId);
  if (!document || document.payload === null) {
    // The resolution transaction committed this document, so its absence means
    // the local stores no longer support the decision the caller was given.
    throw new Error(DOCUMENT_MISSING);
  }
  return {
    kind,
    legacyId,
    payload: document.payload,
    contentFingerprint: document.contentFingerprint,
  };
}

async function applicationFor(
  context: ResolutionContext,
  resolution: AppliedResolution
): Promise<PlayerBackupLocalApplication | null> {
  if (resolution === 'keep-mine') return null;
  return applicationOf(
    context.repository,
    context.conflict.namespace,
    resolution === 'use-cloud' ? 'replace' : 'add',
    resolution === 'use-cloud'
      ? context.conflict.legacyId
      : (context.options.copyLegacyId as string)
  );
}

/**
 * Reads the keep-both collision evidence in its own fenced transaction, so an
 * archived candidate is never restored online for a copy id the local stores
 * already hold. The in-hook check stays: it is the atomic guard.
 */
async function copyIdCollides(context: ResolutionContext): Promise<boolean> {
  const { options, conflict } = context;
  const copyLegacyId = options.copyLegacyId as string;
  return runPlayerBackupTransaction({
    database: context.database,
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    stores: ['documents'],
    task: async transaction => {
      const meta = transaction.objectStore('meta');
      const fenced = await assertResolvableConflict(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId: conflict.legacyId,
        namespace: conflict.namespace,
      });
      const copyDocument = await requestResult(
        transaction
          .objectStore('documents')
          .get([fenced.namespace, 'character', copyLegacyId])
      );
      const copyPolicy =
        await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
          meta,
          fenced.namespace,
          copyLegacyId
        );
      return Boolean(copyDocument) || copyPolicy !== null;
    },
  });
}

async function applyResolution(
  context: ResolutionContext,
  resolution: AppliedResolution
): Promise<PlayerBackupConflictResolveResult> {
  const { options, conflict } = context;
  let outcome: 'resolved' | 'quarantined';
  try {
    outcome = await context.service.resolve(options.conflictId, resolution, {
      ...(options.copyLegacyId ? { copyLegacyId: options.copyLegacyId } : {}),
      originPlayerBackupRunId: context.run.runId,
      transactionHook: createPlayerBackupResolutionHook({
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        resolution,
        ...(options.copyLegacyId ? { copyLegacyId: options.copyLegacyId } : {}),
        now: options.now,
      }),
    });
  } catch (cause) {
    if (cause instanceof PlayerBackupCopyIdCollisionError) {
      return refused('copy-id-collision');
    }
    throw cause;
  }

  if (outcome === 'quarantined') {
    await runPlayerBackupTransaction({
      database: context.database,
      accountId: options.accountId,
      expectedActiveRunId: options.expectedActiveRunId,
      stores: [],
      task: async transaction => {
        const meta = transaction.objectStore('meta');
        await assertResolvableConflict(meta, {
          accountId: options.accountId,
          expectedActiveRunId: options.expectedActiveRunId,
          legacyId: conflict.legacyId,
          namespace: conflict.namespace,
        });
        await updatePlayerBackupCharacterCheckpoint(meta, {
          accountId: options.accountId,
          expectedActiveRunId: options.expectedActiveRunId,
          legacyId: conflict.legacyId,
          online: onlineCheckpoint({
            kind: 'automatic',
            state: 'held-aside',
            cloudId: (conflict.cloudCandidate as CharacterCloudRow).id,
            mutationId: conflict.mutationId,
            recordedAt: options.now(),
            reason: 'quarantined',
          }),
        });
      },
    });
    return { status: 'quarantined' };
  }

  return {
    status: 'resolved',
    resolution,
    apply: await applicationFor(context, resolution),
    workQueued: resolution !== 'use-cloud',
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function resolveInLock(
  options: PlayerBackupConflictResolveOptions,
  database: IDBDatabase
): Promise<PlayerBackupConflictResolveResult> {
  const service = new AutomaticCharacterConflictService(database, {
    randomId: options.generateMutationId,
    now: options.now,
  });
  const repository = new IndexedDbAutomaticCharacterSyncRepository(database);
  const conflict = await service.getConflict(options.conflictId);
  if (!conflict) throw new Error(CONFLICT_MISSING);
  if (conflict.namespace !== `user:${options.accountId}`) {
    return refused('account-mismatch');
  }

  const run = await readActivePlayerBackupRun({
    accountId: options.accountId,
    factory: options.factory,
  });
  if (!run || run.runId !== options.expectedActiveRunId) {
    throw new PlayerBackupRunReplacedError();
  }
  if (playerBackupExecutionPath(run) !== 'integrated') {
    throw new Error(DEGRADED_NEVER_RESOLVES);
  }
  if (!run.selectedCharacterIds.includes(conflict.legacyId)) {
    return refused('not-selected');
  }
  if (
    conflict.originPlayerBackupRunId !== undefined &&
    conflict.originPlayerBackupRunId !== run.runId
  ) {
    return refused('stale-run');
  }
  if (conflict.resolutionState === 'resolved') {
    const resolution = conflict.resolution;
    if (!resolution) throw new Error(RESOLUTION_MISSING);
    // A caller that crashed between the resolution and the roster write is
    // handed the recorded change again, until it acknowledges it.
    // Selected by conflict, not by character: one character may resolve more
    // than one conflict in a run, each owing its own roster change.
    const pending = (await readPendingApplications(database, run.runId)).find(
      record => record.conflictId === conflict.conflictId
    );
    return {
      status: 'resolved',
      resolution,
      apply: pending
        ? await applicationOf(
            repository,
            conflict.namespace,
            pending.kind,
            pending.legacyId
          )
        : null,
      workQueued: false,
    };
  }

  const { resolution } = options;
  const candidate = conflict.cloudCandidate as CharacterCloudRow;
  const archived = candidate.deleted_at !== null;
  if (archived && (resolution === 'keep-mine' || resolution === 'use-cloud')) {
    return refused('archived-requires-restore');
  }
  if (!archived && resolution === 'restore-online') {
    return refused('not-archived');
  }
  if (resolution === 'keep-both') {
    const copyLegacyId = options.copyLegacyId;
    if (!copyLegacyId) return refused('copy-id-required');
    const occupied = options.characters.get(copyLegacyId);
    if (
      (occupied !== null && occupied !== undefined) ||
      run.eligibleCharacterIds.includes(copyLegacyId) ||
      copyLegacyId === conflict.legacyId
    ) {
      return refused('copy-id-collision');
    }
  }

  const context: ResolutionContext = {
    options,
    database,
    service,
    repository,
    conflict,
    run,
  };

  if (resolution === 'restore-online') {
    const restored = await restoreArchivedCandidate(context);
    if (restored.status === 'refused') return restored;
    if (restored.comparison !== 'identical') {
      // The restored row now contests the local one: all three ordinary
      // resolutions become available against the refreshed candidate.
      return { status: 'restored', outcome: 'unresolved', apply: null };
    }
    const applied = await applyResolution(context, 'use-cloud');
    // The attach is an ordinary use-cloud resolution, so it owes the same
    // durable roster change: it is handed to the caller rather than dropped.
    return applied.status === 'resolved'
      ? { status: 'restored', outcome: 'attached', apply: applied.apply }
      : applied;
  }
  if (archived) {
    // Keep both is the only remaining resolution an archived candidate allows,
    // and it keeps the online copy, so the row is restored first. A copy id the
    // local stores already hold is refused before that, so a doomed decision
    // never resurrects a cloud copy.
    if (await copyIdCollides(context)) return refused('copy-id-collision');
    const restored = await restoreArchivedCandidate(context);
    if (restored.status === 'refused') return restored;
  }

  return applyResolution(context, resolution);
}

/**
 * Applies one explicit conflict decision under the account lock, behind the
 * run fence. Every gateway mutation and every local write is re-authorised
 * immediately before it happens, so a superseded run resolves nothing.
 *
 * A returned `apply` is a durable debt: the caller writes it to the roster and
 * then calls `acknowledgePlayerBackupApplication`. Until that acknowledgement
 * every retry of this call returns the same change again.
 *
 * Must not be called while the caller holds the account lock: it acquires the
 * lock itself, and real Web Locks are not re-entrant.
 */
export async function resolvePlayerBackupConflict(
  options: PlayerBackupConflictResolveOptions
): Promise<PlayerBackupConflictResolveResult> {
  if (!hasPlayerBackupExclusiveLockCapability(options.locks)) {
    throw new PlayerBackupLockUnavailableError();
  }
  return withPlayerBackupAccountLock(
    { accountId: options.accountId, locks: options.locks },
    () =>
      withExistingDatabase(options.factory, database =>
        resolveInLock(options, database)
      )
  );
}

/**
 * Clears the recorded roster application for one character once the caller has
 * written it. Idempotent: `false` means there was nothing left to acknowledge.
 *
 * Must not be called while the caller holds the account lock: it acquires the
 * lock itself, and real Web Locks are not re-entrant.
 */
export async function acknowledgePlayerBackupApplication(options: {
  factory: IDBFactory;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  accountId: string;
  expectedActiveRunId: string;
  legacyId: string;
}): Promise<boolean> {
  if (!hasPlayerBackupExclusiveLockCapability(options.locks)) {
    throw new PlayerBackupLockUnavailableError();
  }
  return withPlayerBackupAccountLock(
    { accountId: options.accountId, locks: options.locks },
    () =>
      withExistingDatabase(options.factory, database =>
        runPlayerBackupTransaction({
          database,
          accountId: options.accountId,
          expectedActiveRunId: options.expectedActiveRunId,
          stores: [],
          task: async transaction => {
            const meta = transaction.objectStore('meta');
            const run = await readPlayerBackupRunInTransaction(
              meta,
              options.accountId,
              options.expectedActiveRunId
            );
            const key = playerBackupApplicationKey(run.runId, options.legacyId);
            const recorded = await requestResult(meta.get(key));
            if (!recorded) return false;
            meta.delete(key);
            return true;
          },
        })
      )
  );
}

// ---------------------------------------------------------------------------
// One-time settlement
// ---------------------------------------------------------------------------

export interface PlayerBackupSettleOptions {
  factory: IDBFactory;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  accountId: string;
  expectedActiveRunId: string;
  gateway: Pick<CharacterCloudGateway, 'fetch'>;
  links: CharacterCloudLinkRepository;
  now: () => string;
}

/**
 * Confirms that the acknowledged local document really is the online copy,
 * then records the character as protected. A one-time run never turns the
 * per-character preference on, so the settled state is asserted against a
 * preference that is still `off`.
 */
async function verifySettledDocument(
  options: PlayerBackupSettleOptions,
  run: PlayerBackupRunV1,
  legacyId: string,
  database: IDBDatabase
): Promise<boolean> {
  const repository = new IndexedDbAutomaticCharacterSyncRepository(database);
  const document = await repository.getDocument(run.namespace, legacyId);
  const work = (await repository.listOutbox(run.namespace)).find(
    entry => entry.legacyId === legacyId
  );
  const conflict = (await repository.listConflicts(run.namespace)).find(
    record =>
      record.legacyId === legacyId && record.resolutionState === 'unresolved'
  );
  if (
    !document ||
    !document.cloudId ||
    document.baseServerVersion === 0 ||
    document.deletedAt !== null ||
    work ||
    conflict
  ) {
    return false;
  }
  const cloudId = document.cloudId;

  let row;
  try {
    row = await options.gateway.fetch(cloudId);
  } catch {
    return false;
  }
  if (!row) return false;
  const decoded = await decodeCharacterCloudRow(row);
  if (
    decoded.status !== 'supported' ||
    row.legacy_client_id !== legacyId ||
    row.deleted_at !== null ||
    row.server_version !== document.baseServerVersion ||
    decoded.contentFingerprint !== document.contentFingerprint
  ) {
    return false;
  }

  const verifiedAt = options.now();
  await runPlayerBackupTransaction({
    database,
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    stores: [],
    task: async transaction => {
      const meta = transaction.objectStore('meta');
      const fenced = await readPlayerBackupRunInTransaction(
        meta,
        options.accountId,
        options.expectedActiveRunId
      );
      const policy =
        await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
          meta,
          fenced.namespace,
          legacyId
        );
      if (policy !== 'off') throw new Error(CONSENT_NOT_ACKNOWLEDGED);
      await updatePlayerBackupCharacterCheckpoint(meta, {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId,
        online: onlineCheckpoint({
          kind: 'automatic',
          state: 'protected',
          cloudId,
          mutationId:
            fenced.characterCheckpoints[legacyId]?.online?.mutationId ?? null,
          recordedAt: verifiedAt,
          verified: {
            serverVersion: row.server_version,
            contentFingerprint: decoded.contentFingerprint,
            verifiedAt,
          },
        }),
      });
    },
  });

  options.links.save({
    accountId: options.accountId,
    legacyId,
    cloudId,
    serverVersion: row.server_version,
    contentFingerprint: decoded.contentFingerprint,
    pendingMutation: null,
  });
  return true;
}

/**
 * One-time runs only. Verifies each acknowledged resolution document by
 * refetch and records `protected` plus the manual link. Ongoing runs keep
 * their own preference and never settle here.
 *
 * Must not be called while the caller holds the account lock: it acquires the
 * lock itself, and real Web Locks are not re-entrant.
 */
export async function settlePlayerBackupOneTimeConflicts(
  options: PlayerBackupSettleOptions
): Promise<{ settled: string[]; pending: string[] }> {
  if (!hasPlayerBackupExclusiveLockCapability(options.locks)) {
    throw new PlayerBackupLockUnavailableError();
  }
  const run = await readActivePlayerBackupRun({
    accountId: options.accountId,
    factory: options.factory,
  });
  if (!run || run.runId !== options.expectedActiveRunId) {
    throw new PlayerBackupRunReplacedError();
  }
  if (run.mode !== 'one-time') return { settled: [], pending: [] };

  const settled: string[] = [];
  const pending: string[] = [];
  for (const legacyId of run.selectedCharacterIds) {
    const checkpoint = run.characterCheckpoints[legacyId]?.online;
    if (checkpoint?.kind !== 'automatic' || checkpoint.state === 'protected') {
      continue;
    }
    let verified = false;
    try {
      verified = await withPlayerBackupAccountLock(
        { accountId: options.accountId, locks: options.locks },
        () =>
          withExistingDatabase(options.factory, database =>
            verifySettledDocument(options, run, legacyId, database)
          )
      );
    } catch (cause) {
      // One character's refusal -- a withdrawn consent partition, an
      // unreadable database -- leaves it pending without discarding what the
      // other characters already settled. Only a replaced run or a missing
      // lock invalidates the whole call.
      if (
        cause instanceof PlayerBackupRunReplacedError ||
        cause instanceof PlayerBackupLockUnavailableError
      ) {
        throw cause;
      }
    }
    (verified ? settled : pending).push(legacyId);
  }
  return { settled, pending };
}

// ---------------------------------------------------------------------------
// Draining run-origin work
// ---------------------------------------------------------------------------

export interface PlayerBackupDrainOptions {
  factory: IDBFactory;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  accountId: string;
  expectedActiveRunId: string;
  gateway: AutomaticCharacterSyncGateway;
  now?: () => number;
  random?: () => number;
}

/**
 * Drains the active run's namespace through `AutomaticCharacterSyncWorker`
 * behind `createPlayerBackupDispatchGuard`. Stops at the first non-`synced`
 * result, or after one more iteration than there is queued work.
 *
 * Must not be called while the caller holds the account lock: the dispatch
 * guard takes it per attempt, and real Web Locks are not re-entrant.
 */
export async function drainPlayerBackupRunWork(
  options: PlayerBackupDrainOptions
): Promise<AutomaticSyncRunResult[]> {
  if (!hasPlayerBackupExclusiveLockCapability(options.locks)) {
    throw new PlayerBackupLockUnavailableError();
  }
  const run = await readActivePlayerBackupRun({
    accountId: options.accountId,
    factory: options.factory,
  });
  if (!run || run.runId !== options.expectedActiveRunId) {
    throw new PlayerBackupRunReplacedError();
  }
  return withExistingDatabase(options.factory, async database => {
    const repository = new IndexedDbAutomaticCharacterSyncRepository(database);
    const worker = new AutomaticCharacterSyncWorker({
      namespace: run.namespace,
      featureEnabled: true,
      repository,
      gateway: options.gateway,
      ...(options.now ? { now: options.now } : {}),
      ...(options.random ? { random: options.random } : {}),
      dispatchGuard: createPlayerBackupDispatchGuard({
        factory: options.factory,
        locks: options.locks,
        accountId: options.accountId,
      }),
    });
    const limit = (await repository.listOutbox(run.namespace)).length + 1;
    const results: AutomaticSyncRunResult[] = [];
    for (let attempt = 0; attempt < limit; attempt += 1) {
      const result = await worker.runOnce();
      results.push(result);
      if (result !== 'synced') break;
    }
    return results;
  });
}
