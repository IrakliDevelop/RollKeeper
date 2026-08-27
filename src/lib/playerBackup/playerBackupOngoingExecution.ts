import {
  IndexedDbAutomaticCharacterSyncRepository,
  type AutomaticCharacterDocument,
  type AutomaticCharacterOutboxEntry,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import {
  openExistingRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import type {
  AutomaticSyncDispatchDecision,
  AutomaticSyncDispatchGuard,
} from '@/lib/supabase/automaticCharacterSyncWorker';
import {
  encodeCharacterCloudPayload,
  fingerprintCharacterPayload,
} from '@/lib/supabase/characterCloudCodec';
import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import { CharacterCloudGatewayError } from '@/lib/supabase/characterCloudGateway';
import type { CharacterCloudGateway } from '@/lib/supabase/manualCharacterCloudService';

import type { PlayerBackupPreviewCharacter } from './playerBackupCloudPreview';
import { compareCloudRows } from './playerBackupCloudPreview';
import type {
  PlayerBackupConflictComparison,
  PlayerBackupHeldAsideReason,
} from './playerBackupConflictCoordinator';
import {
  holdPlayerBackupCandidateAsideInLock,
  seedPlayerBackupConflictInLock,
} from './playerBackupConflictCoordinator';
import type {
  PlayerBackupExecutionResult,
  PlayerBackupLocalCharacterSource,
} from './playerBackupOnlineExecution';
import {
  CONSENT_NOT_ACKNOWLEDGED,
  NO_CLOUD_IDENTITY,
  acknowledgeConfirmedSelection,
  derivePlayerBackupRunResult,
  onlineCheckpoint,
  retainCharacterIdentity,
  withExistingDatabase,
} from './playerBackupOnlineExecution';
import type { PlayerBackupExclusiveLockProvider } from './playerBackupRunFence';
import {
  PlayerBackupLockUnavailableError,
  hasPlayerBackupExclusiveLockCapability,
  runPlayerBackupTransaction,
  withPlayerBackupAccountLock,
} from './playerBackupRunFence';
import type {
  ActiveRunPointer,
  PlayerBackupOnlineCheckpoint,
  PlayerBackupOnlineCheckpointState,
  PlayerBackupRunV1,
} from './playerBackupRunRepository';
import {
  PlayerBackupRunReplacedError,
  assertPlayerBackupRunLocalReady,
  playerBackupActiveRunKey,
  playerBackupExecutionPath,
  readActivePlayerBackupRun,
  readPlayerBackupRunInTransaction,
  updatePlayerBackupCharacterCheckpoint,
} from './playerBackupRunRepository';

const NOT_LOCAL_READY = 'Player backup run has not reached local-ready';
const ONGOING_REQUIRES_INTEGRATED = 'Ongoing work requires an integrated run';
const WORK_NOT_SAVED = 'Initial automatic work could not be saved';

export interface PlayerBackupOngoingStartOptions {
  factory: IDBFactory;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  accountId: string;
  expectedActiveRunId: string;
  /** Correlates each selected character with the account's existing copies. */
  gateway: Pick<CharacterCloudGateway, 'list'>;
  characters: PlayerBackupLocalCharacterSource;
  generateCloudId: () => string;
  generateMutationId: () => string;
  now: () => string;
}

/** Thrown inside the fence so the aborted transaction writes nothing. */
class PlayerBackupPreferenceRefusedError extends Error {
  constructor() {
    super(CONSENT_NOT_ACKNOWLEDGED);
    this.name = 'PlayerBackupPreferenceRefusedError';
  }
}

function characterRevision(character: unknown): number {
  const value = (character as { characterData?: { revision?: unknown } })
    .characterData?.revision;
  return typeof value === 'number' && value >= 0 ? value : 0;
}

interface OngoingCharacterContext {
  database: IDBDatabase;
  repository: IndexedDbAutomaticCharacterSyncRepository;
  accountId: string;
  expectedActiveRunId: string;
  legacyId: string;
  gateway: Pick<CharacterCloudGateway, 'list'>;
  characters: PlayerBackupLocalCharacterSource;
  generateCloudId: () => string;
  generateMutationId: () => string;
  now: () => string;
}

/**
 * Whether a checkpoint is durable evidence a resumed run must never overwrite:
 * an identity or work was minted for this character, or its online candidate
 * was preserved as a conflict or held aside.
 *
 * A failure recorded before anything was written — a missing roster entry, a
 * refused preference, a failed listing — carries no identity and must not
 * strand the character: the next run re-correlates it and creates its work.
 */
function ongoingWorkAlreadyExists(
  online: PlayerBackupOnlineCheckpoint | undefined
): boolean {
  if (!online) return false;
  if (online.mutationId !== null) return true;
  return (
    online.state === 'queued' ||
    online.state === 'protected' ||
    online.state === 'needs-attention' ||
    online.state === 'held-aside'
  );
}

/**
 * Records one character's failure in a fenced transaction that first re-reads
 * its checkpoint: an identity minted by an earlier attempt is carried forward,
 * so durable work that is already queued (or later acknowledged) stays
 * attributable to this character instead of being stranded behind the
 * no-identity sentinel.
 */
function recordOngoingFailure(
  context: OngoingCharacterContext,
  reason: string,
  state: PlayerBackupOnlineCheckpointState = 'failed'
): Promise<void> {
  return runPlayerBackupTransaction({
    database: context.database,
    accountId: context.accountId,
    expectedActiveRunId: context.expectedActiveRunId,
    stores: [],
    task: async transaction => {
      const meta = transaction.objectStore('meta');
      const run = await readPlayerBackupRunInTransaction(
        meta,
        context.accountId,
        context.expectedActiveRunId
      );
      const retained = retainCharacterIdentity(
        run.characterCheckpoints[context.legacyId]?.online,
        null
      );
      await updatePlayerBackupCharacterCheckpoint(meta, {
        accountId: context.accountId,
        expectedActiveRunId: context.expectedActiveRunId,
        legacyId: context.legacyId,
        online: onlineCheckpoint({
          kind: 'automatic',
          state,
          cloudId: retained.cloudId ?? NO_CLOUD_IDENTITY,
          mutationId: retained.mutationId,
          recordedAt: context.now(),
          reason,
        }),
      });
    },
  });
}

/** Preference refusals keep their own reason; everything else reports itself. */
function ongoingFailureReason(cause: unknown): string {
  if (cause instanceof PlayerBackupPreferenceRefusedError) {
    return 'preference-not-acknowledged';
  }
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Drops this character's work left behind by a superseded run, inside the
 * caller's transaction. Such work can never be dispatched again, and leaving it
 * queued makes the dispatch guard refuse the character on every drain. Inflight
 * work (a lease another attempt may still acknowledge) and contested work (the
 * conflict record is the durable evidence) are never touched.
 */
async function supersedeStaleRunWork(
  transaction: IDBTransaction,
  scope: { namespace: `user:${string}`; runId: string; legacyId: string }
): Promise<void> {
  const outbox = transaction.objectStore('outbox');
  const entries = (await requestResult(
    outbox.getAll()
  )) as AutomaticCharacterOutboxEntry[];
  for (const entry of entries) {
    if (
      entry.namespace === scope.namespace &&
      entry.family === 'character' &&
      entry.legacyId === scope.legacyId &&
      entry.originPlayerBackupRunId !== undefined &&
      entry.originPlayerBackupRunId !== scope.runId &&
      entry.state !== 'inflight' &&
      entry.state !== 'conflict'
    ) {
      outbox.delete(entry.mutationId);
    }
  }
}

/**
 * Reads the run's consent partition for this character inside the caller's
 * fenced transaction, exactly as the initial-work path does.
 */
async function assertOngoingConsentInTransaction(
  context: OngoingCharacterContext,
  meta: IDBObjectStore
): Promise<PlayerBackupRunV1> {
  const run = await assertPlayerBackupRunLocalReady(
    meta,
    context.accountId,
    context.expectedActiveRunId
  );
  const policy =
    await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
      meta,
      run.namespace,
      context.legacyId
    );
  const account =
    await AutomaticCharacterSyncPreferences.readAccountDefaultInTransaction(
      meta,
      run.namespace
    );
  if (policy !== 'on' || account?.confirmedAt !== run.confirmedAt) {
    throw new PlayerBackupPreferenceRefusedError();
  }
  return run;
}

/**
 * Lists the account's cloud copies and classifies this character against them.
 * The listing runs before any transaction opens, because a foreign await
 * auto-commits an IndexedDB transaction. A gateway failure is recorded by its
 * own category and no work is created.
 */
async function correlateOngoingRow(
  context: OngoingCharacterContext,
  character: unknown
): Promise<PlayerBackupPreviewCharacter | null> {
  let rows;
  try {
    rows = await context.gateway.list();
  } catch (cause) {
    if (!(cause instanceof CharacterCloudGatewayError)) throw cause;
    await recordOngoingFailure(
      context,
      cause.category === 'failed' ? cause.message : cause.category,
      cause.category
    );
    return null;
  }
  const { characters } = await compareCloudRows(rows, [character]);
  return characters[0]!;
}

/**
 * The cloud already holds this exact content: the document is recorded as
 * acknowledged so later edits replace that row, and no work is ever queued for
 * it. Everything asynchronous runs before the fenced transaction opens.
 */
async function attachOngoingIdenticalRow(
  context: OngoingCharacterContext,
  character: unknown,
  compared: PlayerBackupPreviewCharacter
): Promise<void> {
  const row = compared.row;
  const decoded = compared.decoded;
  if (!row || !decoded) throw new Error('Cloud comparison is missing its row');
  const payload = encodeCharacterCloudPayload(character);
  const localRevision = characterRevision(character);
  const recordedAt = context.now();

  await runPlayerBackupTransaction({
    database: context.database,
    accountId: context.accountId,
    expectedActiveRunId: context.expectedActiveRunId,
    stores: ['documents'],
    task: async transaction => {
      const meta = transaction.objectStore('meta');
      const run = await assertOngoingConsentInTransaction(context, meta);
      if (
        ongoingWorkAlreadyExists(
          run.characterCheckpoints[context.legacyId]?.online
        )
      ) {
        return;
      }
      context.repository.writeAcknowledgedDocumentInTransaction(transaction, {
        namespace: run.namespace,
        legacyId: context.legacyId,
        cloudId: row.id,
        operation: 'replace',
        payload,
        schemaVersion: row.schema_version,
        localRevision,
        baseServerVersion: row.server_version,
        contentFingerprint: decoded.contentFingerprint,
        syncPolicy: 'on',
        updatedAt: recordedAt,
        originPlayerBackupRunId: run.runId,
      });
      await updatePlayerBackupCharacterCheckpoint(meta, {
        accountId: context.accountId,
        expectedActiveRunId: context.expectedActiveRunId,
        legacyId: context.legacyId,
        online: onlineCheckpoint({
          kind: 'automatic',
          state: 'protected',
          cloudId: row.id,
          mutationId: null,
          recordedAt,
          verified: {
            serverVersion: row.server_version,
            contentFingerprint: decoded.contentFingerprint,
            verifiedAt: recordedAt,
          },
        }),
      });
    },
  });
}

/** The checkpoint this character already carries, read outside the fence. */
async function readOngoingCheckpoint(
  context: OngoingCharacterContext
): Promise<PlayerBackupOnlineCheckpoint | undefined> {
  const transaction = context.database.transaction('meta', 'readonly');
  const run = await readPlayerBackupRunInTransaction(
    transaction.objectStore('meta'),
    context.accountId,
    context.expectedActiveRunId
  );
  await transactionComplete(transaction);
  return run.characterCheckpoints[context.legacyId]?.online;
}

/** The fenced scope both durable-evidence helpers open for themselves. */
function ongoingLockScope(context: OngoingCharacterContext) {
  return {
    database: context.database,
    accountId: context.accountId,
    expectedActiveRunId: context.expectedActiveRunId,
    legacyId: context.legacyId,
    now: context.now,
  };
}

/** Quarantines an unusable online candidate with its exact bytes. */
function holdOngoingCandidateAside(
  context: OngoingCharacterContext,
  compared: PlayerBackupPreviewCharacter,
  reason: PlayerBackupHeldAsideReason
): Promise<void> {
  return holdPlayerBackupCandidateAsideInLock({
    ...ongoingLockScope(context),
    row: compared.row,
    reason,
    detail: compared.decoded?.quarantineReason ?? null,
    checkpointKind: 'automatic',
  });
}

/**
 * Preserves both candidates of a contested row as a durable conflict. An
 * ongoing run never holds a link, so the conflict work bases itself on the
 * document alone.
 */
async function seedOngoingConflict(
  context: OngoingCharacterContext,
  character: unknown,
  compared: PlayerBackupPreviewCharacter & { row: CharacterCloudRow },
  comparison: PlayerBackupConflictComparison
): Promise<void> {
  const existing = await readOngoingCheckpoint(context);
  // Durable evidence this character already has stands; only an unresolved
  // contest may be refreshed, and the seed decides that for itself.
  if (
    existing?.state !== 'needs-attention' &&
    ongoingWorkAlreadyExists(existing)
  ) {
    return;
  }
  await seedPlayerBackupConflictInLock({
    ...ongoingLockScope(context),
    character,
    row: compared.row,
    comparison,
    existingLink: null,
    generateMutationId: context.generateMutationId,
  });
}

/**
 * Creates the initial document, outbox entry and `queued` checkpoint for one
 * selected character in a single fenced transaction. The payload and its
 * fingerprint are computed first: an IndexedDB transaction auto-commits on any
 * await that is not one of its own requests.
 */
async function createInitialOngoingWork(
  context: OngoingCharacterContext,
  character: unknown
): Promise<void> {
  const payload = encodeCharacterCloudPayload(character);
  const contentFingerprint = await fingerprintCharacterPayload(payload);
  const localRevision = characterRevision(character);

  await runPlayerBackupTransaction({
    database: context.database,
    accountId: context.accountId,
    expectedActiveRunId: context.expectedActiveRunId,
    stores: ['documents', 'outbox', 'tombstones'],
    task: async transaction => {
      const meta = transaction.objectStore('meta');
      const run = await assertOngoingConsentInTransaction(context, meta);
      // Durable work or an identity already exists for this character; a
      // resumed run must never mint a second one for it.
      if (
        ongoingWorkAlreadyExists(
          run.characterCheckpoints[context.legacyId]?.online
        )
      ) {
        return;
      }

      const existing = (await requestResult(
        transaction
          .objectStore('documents')
          .get([run.namespace, 'character', context.legacyId])
      )) as AutomaticCharacterDocument | undefined;
      const cloudId = existing?.cloudId ?? context.generateCloudId();
      const mutationId = context.generateMutationId();
      const recordedAt = context.now();
      await supersedeStaleRunWork(transaction, {
        namespace: run.namespace,
        runId: run.runId,
        legacyId: context.legacyId,
      });
      const written = await context.repository.writeMutationInTransaction(
        transaction,
        {
          namespace: run.namespace,
          legacyId: context.legacyId,
          cloudId,
          operation: existing ? 'replace' : 'create',
          payload,
          schemaVersion: existing?.schemaVersion ?? 1,
          localRevision,
          baseServerVersion: existing?.baseServerVersion ?? 0,
          contentFingerprint,
          syncPolicy: 'on',
          updatedAt: recordedAt,
          originPlayerBackupRunId: run.runId,
        },
        { mutationId }
      );
      if (!written.saved) throw new Error(WORK_NOT_SAVED);
      await updatePlayerBackupCharacterCheckpoint(meta, {
        accountId: context.accountId,
        expectedActiveRunId: context.expectedActiveRunId,
        legacyId: context.legacyId,
        online: onlineCheckpoint({
          kind: 'automatic',
          state: 'queued',
          cloudId,
          mutationId,
          recordedAt,
        }),
      });
    },
  });
}

/**
 * Prepares one selected character: an account with no cloud copy of it gets
 * ordinary initial work, an exact copy is adopted as already acknowledged, and
 * anything else becomes durable conflict or quarantine evidence.
 */
async function createOngoingCharacterWork(
  context: OngoingCharacterContext
): Promise<void> {
  const character = context.characters.get(context.legacyId);
  if (character === null || character === undefined) {
    await recordOngoingFailure(context, 'local-character-missing');
    return;
  }
  const compared = await correlateOngoingRow(context, character);
  if (!compared) return;
  switch (compared.state) {
    case 'missing':
      return createInitialOngoingWork(context, character);
    case 'identical':
      return attachOngoingIdenticalRow(context, character, compared);
    case 'future':
    case 'unavailable':
      return holdOngoingCandidateAside(context, compared, compared.state);
    default:
      // Every remaining comparison carries the row it contests.
      return seedOngoingConflict(
        context,
        character,
        compared as PlayerBackupPreviewCharacter & { row: CharacterCloudRow },
        compared.state
      );
  }
}

/**
 * Creates the initial automatic work for a local-ready ongoing run. Dispatch
 * stays with the automatic sync worker, which drains the queued entries behind
 * `createPlayerBackupDispatchGuard`.
 */
export async function startPlayerBackupOngoingWork(
  options: PlayerBackupOngoingStartOptions
): Promise<PlayerBackupExecutionResult> {
  const locks = options.locks;
  if (!hasPlayerBackupExclusiveLockCapability(locks)) {
    throw new PlayerBackupLockUnavailableError();
  }
  const run = await readActivePlayerBackupRun({
    accountId: options.accountId,
    factory: options.factory,
  });
  if (!run || run.runId !== options.expectedActiveRunId) {
    throw new PlayerBackupRunReplacedError();
  }
  if (playerBackupExecutionPath(run) !== 'integrated') {
    throw new Error(ONGOING_REQUIRES_INTEGRATED);
  }
  if (run.mode !== 'ongoing') {
    throw new Error('Ongoing work requires an ongoing run');
  }
  if (run.stage !== 'local-ready') throw new Error(NOT_LOCAL_READY);
  await acknowledgeConfirmedSelection(options.factory, run);

  return withExistingDatabase(options.factory, async database => {
    const repository = new IndexedDbAutomaticCharacterSyncRepository(database);
    for (const legacyId of run.selectedCharacterIds) {
      const context: OngoingCharacterContext = {
        database,
        repository,
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId,
        gateway: options.gateway,
        characters: options.characters,
        generateCloudId: options.generateCloudId,
        generateMutationId: options.generateMutationId,
        now: options.now,
      };
      await withPlayerBackupAccountLock(
        { accountId: options.accountId, locks },
        async () => {
          try {
            await createOngoingCharacterWork(context);
          } catch (cause) {
            // One character's failure never stops the others; only a replaced
            // run or a missing lock invalidates the whole run.
            if (
              cause instanceof PlayerBackupRunReplacedError ||
              cause instanceof PlayerBackupLockUnavailableError
            ) {
              throw cause;
            }
            await recordOngoingFailure(context, ongoingFailureReason(cause));
          }
        }
      );
    }
    return derivePlayerBackupRunResult({
      factory: options.factory,
      accountId: options.accountId,
      expectedActiveRunId: options.expectedActiveRunId,
      repository,
    });
  });
}

/**
 * A one-time run never turns a character's preference on, so its own initial
 * and conflict-resolution work would otherwise be held forever. The run's
 * committed consent authorises it instead: the work must carry this run's
 * origin, and the character must still be selected and owned by the durable
 * work path. Anything else stays paused.
 */
async function authorizeRunOriginWork(
  meta: IDBObjectStore,
  options: {
    accountId: string;
    runId: string;
    legacyId: string;
    originPlayerBackupRunId: string | undefined;
  }
): Promise<AutomaticSyncDispatchDecision> {
  if (options.originPlayerBackupRunId !== options.runId) {
    return { hold: 'preference-off' };
  }
  let run: PlayerBackupRunV1;
  try {
    run = await readPlayerBackupRunInTransaction(
      meta,
      options.accountId,
      options.runId
    );
  } catch {
    return { hold: 'preference-off' };
  }
  return run.mode === 'one-time' &&
    run.selectedCharacterIds.includes(options.legacyId) &&
    run.characterCheckpoints[options.legacyId]?.online?.kind === 'automatic'
    ? 'dispatch'
    : { hold: 'preference-off' };
}

/**
 * Holds the account lock around one automatic dispatch and refuses work whose
 * origin run, account namespace or current preference no longer authorises it.
 * Held work is retained and paused, never sent.
 */
export function createPlayerBackupDispatchGuard(options: {
  factory: IDBFactory;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  accountId: string;
}): AutomaticSyncDispatchGuard {
  const namespace = `user:${options.accountId}` as const;
  return {
    around: (_entry, task) =>
      withPlayerBackupAccountLock(
        { accountId: options.accountId, locks: options.locks },
        task
      ),
    authorize: async entry => {
      const database = await openExistingRollkeeperDatabase({
        factory: options.factory,
      });
      if (!database) return { hold: 'unavailable' };
      try {
        const transaction = database.transaction('meta', 'readonly');
        const meta = transaction.objectStore('meta');
        const pointer = (await requestResult(
          meta.get(playerBackupActiveRunKey(options.accountId))
        )) as ActiveRunPointer | undefined;
        const stale =
          entry.originPlayerBackupRunId !== undefined &&
          pointer?.runId !== entry.originPlayerBackupRunId;
        let decision: AutomaticSyncDispatchDecision = stale
          ? { hold: 'stale-origin' }
          : { hold: 'unavailable' };
        if (!stale && entry.namespace === namespace) {
          const policy =
            await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
              meta,
              namespace,
              entry.legacyId
            );
          decision =
            policy === 'off'
              ? pointer
                ? await authorizeRunOriginWork(meta, {
                    accountId: options.accountId,
                    runId: pointer.runId,
                    legacyId: entry.legacyId,
                    originPlayerBackupRunId: entry.originPlayerBackupRunId,
                  })
                : { hold: 'preference-off' }
              : 'dispatch';
        }
        await transactionComplete(transaction);
        return decision;
      } finally {
        database.close();
      }
    },
  };
}
