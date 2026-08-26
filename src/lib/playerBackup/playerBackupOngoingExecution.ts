import {
  IndexedDbAutomaticCharacterSyncRepository,
  type AutomaticCharacterDocument,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import {
  openExistingRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import type { AutomaticSyncDispatchGuard } from '@/lib/supabase/automaticCharacterSyncWorker';
import {
  encodeCharacterCloudPayload,
  fingerprintCharacterPayload,
} from '@/lib/supabase/characterCloudCodec';

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
  withExistingDatabase,
  withFencedCheckpoint,
} from './playerBackupOnlineExecution';
import type { PlayerBackupExclusiveLockProvider } from './playerBackupRunFence';
import {
  PlayerBackupLockUnavailableError,
  hasPlayerBackupExclusiveLockCapability,
  runPlayerBackupTransaction,
  withPlayerBackupAccountLock,
} from './playerBackupRunFence';
import type { ActiveRunPointer } from './playerBackupRunRepository';
import {
  PlayerBackupRunReplacedError,
  assertPlayerBackupRunLocalReady,
  playerBackupActiveRunKey,
  playerBackupExecutionPath,
  readActivePlayerBackupRun,
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
  characters: PlayerBackupLocalCharacterSource;
  generateCloudId: () => string;
  generateMutationId: () => string;
  now: () => string;
}

function recordOngoingFailure(
  context: OngoingCharacterContext,
  reason: string
): Promise<void> {
  return withFencedCheckpoint({
    database: context.database,
    accountId: context.accountId,
    expectedActiveRunId: context.expectedActiveRunId,
    legacyId: context.legacyId,
    online: onlineCheckpoint({
      kind: 'automatic',
      state: 'failed',
      cloudId: NO_CLOUD_IDENTITY,
      mutationId: null,
      recordedAt: context.now(),
      reason,
    }),
  });
}

/**
 * Creates the initial document, outbox entry and `queued` checkpoint for one
 * selected character in a single fenced transaction. The payload and its
 * fingerprint are computed first: an IndexedDB transaction auto-commits on any
 * await that is not one of its own requests.
 */
async function createOngoingCharacterWork(
  context: OngoingCharacterContext
): Promise<void> {
  const character = context.characters.get(context.legacyId);
  if (character === null || character === undefined) {
    await recordOngoingFailure(context, 'local-character-missing');
    return;
  }
  const payload = encodeCharacterCloudPayload(character);
  const contentFingerprint = await fingerprintCharacterPayload(payload);
  const localRevision = characterRevision(character);

  try {
    await runPlayerBackupTransaction({
      database: context.database,
      accountId: context.accountId,
      expectedActiveRunId: context.expectedActiveRunId,
      stores: ['documents', 'outbox', 'tombstones'],
      task: async transaction => {
        const meta = transaction.objectStore('meta');
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
        // An existing checkpoint means this character already has durable
        // work; a resumed run must never mint a second identity for it.
        if (run.characterCheckpoints[context.legacyId]?.online) return;

        const existing = (await requestResult(
          transaction
            .objectStore('documents')
            .get([run.namespace, 'character', context.legacyId])
        )) as AutomaticCharacterDocument | undefined;
        const cloudId = existing?.cloudId ?? context.generateCloudId();
        const mutationId = context.generateMutationId();
        const recordedAt = context.now();
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
  } catch (cause) {
    if (!(cause instanceof PlayerBackupPreferenceRefusedError)) throw cause;
    await recordOngoingFailure(context, 'preference-not-acknowledged');
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
      await withPlayerBackupAccountLock(
        { accountId: options.accountId, locks },
        () =>
          createOngoingCharacterWork({
            database,
            repository,
            accountId: options.accountId,
            expectedActiveRunId: options.expectedActiveRunId,
            legacyId,
            characters: options.characters,
            generateCloudId: options.generateCloudId,
            generateMutationId: options.generateMutationId,
            now: options.now,
          })
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
      if (!database) return 'hold';
      try {
        const transaction = database.transaction('meta', 'readonly');
        const meta = transaction.objectStore('meta');
        const pointer = (await requestResult(
          meta.get(playerBackupActiveRunKey(options.accountId))
        )) as ActiveRunPointer | undefined;
        const stale =
          entry.originPlayerBackupRunId !== undefined &&
          pointer?.runId !== entry.originPlayerBackupRunId;
        let decision: 'dispatch' | 'hold' = 'hold';
        if (!stale && entry.namespace === namespace) {
          const policy =
            await AutomaticCharacterSyncPreferences.readCharacterPolicyInTransaction(
              meta,
              namespace,
              entry.legacyId
            );
          decision = policy === 'off' ? 'hold' : 'dispatch';
        }
        await transactionComplete(transaction);
        return decision;
      } finally {
        database.close();
      }
    },
  };
}
