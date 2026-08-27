import type {
  AutomaticCharacterDocument,
  AutomaticCharacterOutboxEntry,
  IndexedDbAutomaticCharacterSyncRepository,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { openExistingRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import {
  encodeCharacterCloudPayload,
  fingerprintCharacterPayload,
} from '@/lib/supabase/characterCloudCodec';
import { CharacterCloudGatewayError } from '@/lib/supabase/characterCloudGateway';
import type {
  CharacterCloudLink,
  CharacterCloudLinkRepository,
} from '@/lib/supabase/characterCloudLinks';
import type {
  CharacterCloudGateway,
  ManualCharacterCloudService,
} from '@/lib/supabase/manualCharacterCloudService';
import { ManualCharacterCloudRejectedError } from '@/lib/supabase/manualCharacterCloudService';

import type { PlayerBackupPreviewCharacter } from './playerBackupCloudPreview';
import { compareCloudRows } from './playerBackupCloudPreview';
import type { DegradedCharacterEligibility } from './playerBackupEligibility';
import { classifyDegradedEligibility } from './playerBackupEligibility';
import type { PlayerBackupExclusiveLockProvider } from './playerBackupRunFence';
import {
  PlayerBackupLockUnavailableError,
  hasPlayerBackupExclusiveLockCapability,
  runPlayerBackupTransaction,
  withPlayerBackupAccountLock,
} from './playerBackupRunFence';
import type {
  PlayerBackupExecutionPath,
  PlayerBackupOnlineCheckpoint,
  PlayerBackupOnlineCheckpointState,
  PlayerBackupRunV1,
} from './playerBackupRunRepository';
import {
  PlayerBackupRunReplacedError,
  playerBackupExecutionPath,
  readActivePlayerBackupRun,
  readPlayerBackupRunInTransaction,
  updatePlayerBackupCharacterCheckpoint,
} from './playerBackupRunRepository';

/** @internal Shared with `playerBackupOngoingExecution`. */
export const CONSENT_NOT_ACKNOWLEDGED =
  'Durable player backup consent could not be acknowledged';
const RUN_MISSING = 'Committed player backup run is missing';
const LINKS_REQUIRED = 'Link evidence is required for one-time runs';
/**
 * Checkpoints require a non-empty cloud id even when none was ever minted.
 * @internal Shared with `playerBackupOngoingExecution`.
 */
export const NO_CLOUD_IDENTITY = 'none';

/** Roster reader shaped like the input `ManualCharacterCloudService` takes. */
export interface PlayerBackupLocalCharacterSource {
  get(legacyId: string): unknown | null;
}

export type PlayerBackupCharacterOutcome =
  | 'protected'
  | 'queued'
  | 'offline'
  | 'auth-required'
  | 'needs-attention'
  | 'held-aside'
  | 'failed'
  | 'pending';

export interface PlayerBackupExecutionResult {
  runId: string;
  accountId: string;
  mode: 'one-time' | 'ongoing';
  executionPath: PlayerBackupExecutionPath;
  protected: string[];
  queued: string[];
  offline: string[];
  authRequired: string[];
  needsAttention: string[];
  heldAside: string[];
  failed: string[];
  pending: string[];
  outcomes: Record<
    string,
    { outcome: PlayerBackupCharacterOutcome; reason: string | null }
  >;
  complete: boolean;
}

export interface PlayerBackupManualExecutionOptions {
  factory: IDBFactory;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  accountId: string;
  expectedActiveRunId: string;
  service: ManualCharacterCloudService;
  links: CharacterCloudLinkRepository;
  gateway: Pick<CharacterCloudGateway, 'list'>;
  characters: PlayerBackupLocalCharacterSource;
  generateCloudId: () => string;
  generateMutationId: () => string;
  now: () => string;
}

// ---------------------------------------------------------------------------
// Shared helpers (`playerBackupOngoingExecution` reuses the exported ones).
// ---------------------------------------------------------------------------

/** @internal Shared with `playerBackupOngoingExecution`. */
export async function withExistingDatabase<T>(
  factory: IDBFactory,
  task: (database: IDBDatabase) => Promise<T>
): Promise<T> {
  const database = await openExistingRollkeeperDatabase({ factory });
  if (!database) throw new Error(RUN_MISSING);
  try {
    return await task(database);
  } finally {
    database.close();
  }
}

export interface RetainedCharacterIdentity {
  cloudId: string | null;
  mutationId: string | null;
}

/**
 * The identity a resumed run must reuse. Checkpoints written on a path that
 * never minted an identity (roster miss, failed listing, contested row without
 * a cloud copy) carry the `NO_CLOUD_IDENTITY` sentinel, which must never become
 * a put target; a real identity from an earlier attempt is carried forward.
 */
export function retainCharacterIdentity(
  online: PlayerBackupOnlineCheckpoint | undefined,
  link: CharacterCloudLink | null
): RetainedCharacterIdentity {
  const recorded =
    online && online.cloudId !== NO_CLOUD_IDENTITY ? online.cloudId : null;
  return {
    cloudId: recorded ?? link?.cloudId ?? null,
    mutationId: online?.mutationId ?? link?.pendingMutation?.mutationId ?? null,
  };
}

/** @internal Shared with `playerBackupOngoingExecution`. */
export function onlineCheckpoint(options: {
  kind?: 'manual' | 'automatic';
  state: PlayerBackupOnlineCheckpointState;
  cloudId: string;
  mutationId: string | null;
  recordedAt: string;
  reason?: string | null;
  verified?: {
    serverVersion: number;
    contentFingerprint: string;
    verifiedAt: string;
  };
}): PlayerBackupOnlineCheckpoint {
  return {
    version: 1,
    kind: options.kind ?? 'manual',
    cloudId: options.cloudId,
    mutationId: options.mutationId,
    state: options.state,
    recordedAt: options.recordedAt,
    ...(options.verified ?? {}),
    ...(options.reason ? { reason: options.reason } : {}),
  };
}

/**
 * Writes one character checkpoint inside a transaction that re-verifies the
 * account-scoped active run pointer. A replaced run aborts without writing.
 */
async function withFencedCheckpoint(options: {
  database: IDBDatabase;
  accountId: string;
  expectedActiveRunId: string;
  legacyId: string;
  online: PlayerBackupOnlineCheckpoint;
}): Promise<void> {
  await runPlayerBackupTransaction({
    database: options.database,
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    stores: [],
    task: transaction =>
      updatePlayerBackupCharacterCheckpoint(transaction.objectStore('meta'), {
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        legacyId: options.legacyId,
        online: options.online,
      }),
  });
}

/**
 * Re-reads the run and the exact preference partition for one character in a
 * single fenced transaction, immediately before any online work.
 */
async function readAcknowledgedRun(options: {
  database: IDBDatabase;
  accountId: string;
  expectedActiveRunId: string;
  legacyId: string;
}): Promise<PlayerBackupRunV1> {
  return runPlayerBackupTransaction({
    database: options.database,
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
      if (policy !== 'off' || account?.confirmedAt !== run.confirmedAt) {
        throw new Error(CONSENT_NOT_ACKNOWLEDGED);
      }
      return run;
    },
  });
}

/**
 * A one-time run leaves every eligible character off; an ongoing run turns the
 * selected ones on. Both partitions must match the run exactly.
 * @internal Shared with `playerBackupOngoingExecution`.
 */
export async function acknowledgeConfirmedSelection(
  factory: IDBFactory,
  run: PlayerBackupRunV1
): Promise<void> {
  const selectedPolicy = run.mode === 'ongoing' ? 'on' : 'off';
  await withExistingDatabase(factory, async database => {
    const acknowledged = await new AutomaticCharacterSyncPreferences(
      database
    ).readConfirmedSelection(run.namespace, run.eligibleCharacterIds);
    if (
      acknowledged.futureDefault !== run.futureDefault ||
      acknowledged.confirmedAt !== run.confirmedAt ||
      run.selectedCharacterIds.some(
        legacyId => acknowledged.characterPolicies[legacyId] !== selectedPolicy
      ) ||
      run.clearedCharacterIds.some(
        legacyId => acknowledged.characterPolicies[legacyId] !== 'off'
      )
    ) {
      throw new Error(CONSENT_NOT_ACKNOWLEDGED);
    }
  });
}

/**
 * A pending mutation this run stamped itself is its own retained retry, not
 * evidence of a competing writer. Execution classifies against a link view that
 * masks it, so a transient failure cannot make an otherwise exact link contest
 * itself forever. The pure classifier stays unchanged for preflight, where an
 * unfinished mutation is still a reason to refuse.
 */
function linksWithoutOwnPendingMutation(
  links: CharacterCloudLinkRepository,
  runId: string
): CharacterCloudLinkRepository {
  return {
    get: (accountId, legacyId) => {
      const link = links.get(accountId, legacyId);
      return link?.pendingMutation?.originPlayerBackupRunId === runId
        ? { ...link, pendingMutation: null }
        : link;
    },
    save: link => links.save(link),
    remove: (accountId, legacyId) => links.remove(accountId, legacyId),
  };
}

/** Lists and classifies a single character with the preview's own rules. */
async function classifyUnderLock(options: {
  accountId: string;
  runId: string;
  gateway: Pick<CharacterCloudGateway, 'list'>;
  links: CharacterCloudLinkRepository;
  character: unknown;
}): Promise<{
  compared: PlayerBackupPreviewCharacter;
  eligibility: DegradedCharacterEligibility;
}> {
  const rows = await options.gateway.list();
  const { characters } = await compareCloudRows(rows, [options.character]);
  const eligibility = classifyDegradedEligibility({
    preview: {
      account: { id: options.accountId },
      characters,
      onlineOnly: [],
    },
    links: linksWithoutOwnPendingMutation(options.links, options.runId),
  }).characters[0];
  return { compared: characters[0], eligibility };
}

function mapGatewayCategory(error: CharacterCloudGatewayError): {
  state: PlayerBackupOnlineCheckpointState;
  reason: string;
} {
  return { state: error.category, reason: error.category };
}

function mapExecutionError(error: unknown): {
  state: PlayerBackupOnlineCheckpointState;
  reason: string;
} {
  if (error instanceof ManualCharacterCloudRejectedError) {
    return { state: 'needs-attention', reason: `rejected:${error.status}` };
  }
  if (error instanceof CharacterCloudGatewayError) {
    return error.category === 'failed'
      ? { state: 'failed', reason: error.message }
      : mapGatewayCategory(error);
  }
  return {
    state: 'failed',
    reason: error instanceof Error ? error.message : String(error),
  };
}

// ---------------------------------------------------------------------------
// Manual one-time execution
// ---------------------------------------------------------------------------

interface ManualExecutionContext extends PlayerBackupManualExecutionOptions {
  locks: PlayerBackupExclusiveLockProvider;
}

/**
 * Runs one selected character end to end while the caller holds the account
 * lock: fenced consent re-read, classification, identity, gateway mutation and
 * the durable checkpoint. Only a replaced run, a missing lock or a broken
 * consent partition escapes; every online failure becomes a checkpoint.
 */
async function processManualCharacter(
  context: ManualExecutionContext,
  legacyId: string
): Promise<void> {
  await withExistingDatabase(context.factory, async database => {
    const run = await readAcknowledgedRun({
      database,
      accountId: context.accountId,
      expectedActiveRunId: context.expectedActiveRunId,
      legacyId,
    });
    const existing = run.characterCheckpoints[legacyId]?.online;
    if (existing?.state === 'protected') return;
    const existingLink = context.links.get(context.accountId, legacyId);
    const retained = retainCharacterIdentity(existing, existingLink);

    const writeCheckpoint = (online: PlayerBackupOnlineCheckpoint) =>
      withFencedCheckpoint({
        database,
        accountId: context.accountId,
        expectedActiveRunId: context.expectedActiveRunId,
        legacyId,
        online,
      });

    const character = context.characters.get(legacyId);
    if (character === null || character === undefined) {
      await writeCheckpoint(
        onlineCheckpoint({
          state: 'failed',
          cloudId: retained.cloudId ?? NO_CLOUD_IDENTITY,
          mutationId: retained.mutationId,
          recordedAt: context.now(),
          reason: 'local-character-missing',
        })
      );
      return;
    }

    let classified: Awaited<ReturnType<typeof classifyUnderLock>>;
    try {
      classified = await classifyUnderLock({
        accountId: context.accountId,
        runId: run.runId,
        gateway: context.gateway,
        links: context.links,
        character,
      });
    } catch (cause) {
      if (!(cause instanceof CharacterCloudGatewayError)) throw cause;
      const mapped = mapGatewayCategory(cause);
      await writeCheckpoint(
        onlineCheckpoint({
          state: mapped.state,
          cloudId: retained.cloudId ?? NO_CLOUD_IDENTITY,
          mutationId: retained.mutationId,
          recordedAt: context.now(),
          reason: mapped.reason,
        })
      );
      return;
    }

    const { compared, eligibility } = classified;
    if (!eligibility.eligible) {
      await writeCheckpoint(
        onlineCheckpoint({
          state:
            eligibility.reason === 'future' ? 'held-aside' : 'needs-attention',
          cloudId: eligibility.row?.id ?? NO_CLOUD_IDENTITY,
          mutationId: null,
          recordedAt: context.now(),
          reason: eligibility.reason,
        })
      );
      return;
    }

    if (eligibility.reason === 'identical') {
      await attachIdenticalRow({
        context,
        legacyId,
        character,
        compared,
        existingLink,
        retained,
        writeCheckpoint,
      });
      return;
    }

    await uploadCharacter({
      context,
      run,
      legacyId,
      character,
      existing,
      existingLink,
      retained,
      writeCheckpoint,
    });
  });
}

/**
 * The cloud already holds this exact content: attach the link and confirm it
 * with a refetch. A retained mutation identity survives so a resumed run stays
 * idempotent after a lost response.
 */
async function attachIdenticalRow(options: {
  context: ManualExecutionContext;
  legacyId: string;
  character: unknown;
  compared: PlayerBackupPreviewCharacter;
  existingLink: CharacterCloudLink | null;
  retained: RetainedCharacterIdentity;
  writeCheckpoint: (online: PlayerBackupOnlineCheckpoint) => Promise<void>;
}): Promise<void> {
  const { context, compared, retained } = options;
  const row = compared.row;
  const decoded = compared.decoded;
  if (!row || !decoded) throw new Error('Cloud comparison is missing its row');
  const attached = {
    accountId: context.accountId,
    legacyId: options.legacyId,
    cloudId: row.id,
    serverVersion: row.server_version,
    contentFingerprint: decoded.contentFingerprint,
  };
  try {
    // A pending identity from a lost response is retained until the refetch
    // confirms the row, so a failed verification cannot strand it.
    context.links.save({
      ...attached,
      pendingMutation: options.existingLink?.pendingMutation ?? null,
    });
    const verified = await context.service.verify(options.character, {
      id: context.accountId,
    });
    context.links.save({ ...attached, pendingMutation: null });
    await options.writeCheckpoint(
      onlineCheckpoint({
        state: 'protected',
        cloudId: verified.row.id,
        mutationId: retained.mutationId,
        recordedAt: context.now(),
        verified: {
          serverVersion: verified.row.server_version,
          contentFingerprint: verified.fingerprint,
          verifiedAt: context.now(),
        },
      })
    );
  } catch (cause) {
    if (
      cause instanceof PlayerBackupRunReplacedError ||
      cause instanceof PlayerBackupLockUnavailableError
    ) {
      throw cause;
    }
    const mapped = mapExecutionError(cause);
    await options.writeCheckpoint(
      onlineCheckpoint({
        state: mapped.state,
        cloudId: row.id,
        mutationId: retained.mutationId,
        recordedAt: context.now(),
        reason: mapped.reason,
      })
    );
  }
}

/**
 * Records the mutation identity durably — checkpoint first, then the pending
 * link — before the request, so a lost response is retried with the same
 * identity instead of creating a second cloud copy.
 */
async function uploadCharacter(options: {
  context: ManualExecutionContext;
  run: PlayerBackupRunV1;
  legacyId: string;
  character: unknown;
  existing: PlayerBackupOnlineCheckpoint | undefined;
  existingLink: CharacterCloudLink | null;
  retained: RetainedCharacterIdentity;
  writeCheckpoint: (online: PlayerBackupOnlineCheckpoint) => Promise<void>;
}): Promise<void> {
  const { context, existing, existingLink, retained } = options;
  const cloudId = retained.cloudId ?? context.generateCloudId();
  const mutationId = retained.mutationId ?? context.generateMutationId();
  const contentFingerprint = await fingerprintCharacterPayload(
    encodeCharacterCloudPayload(options.character)
  );

  if (
    existing?.state !== 'pending' ||
    existing.cloudId !== cloudId ||
    existing.mutationId !== mutationId
  ) {
    await options.writeCheckpoint(
      onlineCheckpoint({
        state: 'pending',
        cloudId,
        mutationId,
        recordedAt: context.now(),
      })
    );
  }

  const pending = existingLink?.pendingMutation;
  if (
    !existingLink ||
    pending?.mutationId !== mutationId ||
    pending.contentFingerprint !== contentFingerprint ||
    pending.originPlayerBackupRunId !== options.run.runId
  ) {
    context.links.save({
      accountId: context.accountId,
      legacyId: options.legacyId,
      cloudId,
      serverVersion: existingLink?.serverVersion ?? 0,
      contentFingerprint: existingLink?.contentFingerprint ?? null,
      pendingMutation: {
        mutationId,
        contentFingerprint,
        originPlayerBackupRunId: options.run.runId,
      },
    });
  }

  try {
    const verified = await context.service.backup(
      options.character,
      { id: context.accountId },
      { guestSelected: true, confirmedTargetAccountId: context.accountId },
      { originPlayerBackupRunId: options.run.runId }
    );
    await options.writeCheckpoint(
      onlineCheckpoint({
        state: 'protected',
        cloudId: verified.row.id,
        mutationId,
        recordedAt: context.now(),
        verified: {
          serverVersion: verified.row.server_version,
          contentFingerprint: verified.fingerprint,
          verifiedAt: context.now(),
        },
      })
    );
  } catch (cause) {
    if (
      cause instanceof PlayerBackupRunReplacedError ||
      cause instanceof PlayerBackupLockUnavailableError
    ) {
      throw cause;
    }
    if (cause instanceof ManualCharacterCloudRejectedError && !existingLink) {
      // The pending link only ever existed for this attempt. A rejection leaves
      // both copies untouched, so the character must be left unlinked instead
      // of keeping a link to a cloud copy this run never wrote.
      context.links.remove(context.accountId, options.legacyId);
    }
    const mapped = mapExecutionError(cause);
    await options.writeCheckpoint(
      onlineCheckpoint({
        state: mapped.state,
        cloudId,
        mutationId,
        recordedAt: context.now(),
        reason: mapped.reason,
      })
    );
  }
}

/**
 * Executes a confirmed one-time run. Every selected character runs
 * independently under the account lock; results come from durable evidence, not
 * from the loop.
 */
export async function executePlayerBackupManualRun(
  options: PlayerBackupManualExecutionOptions
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
  if (run.mode !== 'one-time') {
    throw new Error('Manual execution requires a one-time run');
  }
  if (
    playerBackupExecutionPath(run) === 'integrated' &&
    run.stage !== 'local-ready'
  ) {
    throw new Error('Player backup run has not reached local-ready');
  }
  await acknowledgeConfirmedSelection(options.factory, run);

  const context: ManualExecutionContext = { ...options, locks };
  for (const legacyId of run.selectedCharacterIds) {
    await withPlayerBackupAccountLock(
      { accountId: options.accountId, locks },
      () => processManualCharacter(context, legacyId)
    );
  }

  return derivePlayerBackupRunResult({
    factory: options.factory,
    accountId: options.accountId,
    expectedActiveRunId: options.expectedActiveRunId,
    links: options.links,
  });
}

// ---------------------------------------------------------------------------
// Durable result derivation
// ---------------------------------------------------------------------------

function deriveManualOutcome(
  online: PlayerBackupOnlineCheckpoint | undefined,
  link: CharacterCloudLink | null
): { outcome: PlayerBackupCharacterOutcome; reason: string | null } {
  if (!online) return { outcome: 'pending', reason: null };
  if (online.state === 'protected') {
    const verified =
      link !== null &&
      !link.pendingMutation &&
      link.cloudId === online.cloudId &&
      link.serverVersion === online.serverVersion &&
      link.contentFingerprint === online.contentFingerprint;
    return verified
      ? { outcome: 'protected', reason: null }
      : { outcome: 'failed', reason: 'link-evidence-mismatch' };
  }
  return { outcome: online.state, reason: online.reason ?? null };
}

/** Read-only. Reports exactly what durable local evidence supports. */
export async function derivePlayerBackupRunResult(options: {
  factory: IDBFactory;
  accountId: string;
  expectedActiveRunId: string;
  /** Required for one-time runs; ongoing runs never attach a link. */
  links?: CharacterCloudLinkRepository;
  repository?: IndexedDbAutomaticCharacterSyncRepository;
}): Promise<PlayerBackupExecutionResult> {
  const run = await readActivePlayerBackupRun({
    accountId: options.accountId,
    factory: options.factory,
  });
  if (!run || run.runId !== options.expectedActiveRunId) {
    throw new Error(RUN_MISSING);
  }
  if (run.mode === 'one-time' && !options.links) {
    // Without the link repository every protected character would be derived
    // as a link-evidence mismatch, which is a false failure, not evidence.
    throw new Error(LINKS_REQUIRED);
  }
  const buckets: Record<PlayerBackupCharacterOutcome, string[]> = {
    protected: [],
    queued: [],
    offline: [],
    'auth-required': [],
    'needs-attention': [],
    'held-aside': [],
    failed: [],
    pending: [],
  };
  const outcomes: PlayerBackupExecutionResult['outcomes'] = {};
  const automatic = run.selectedCharacterIds.some(
    legacyId => run.characterCheckpoints[legacyId]?.online?.kind === 'automatic'
  );
  const evidence =
    automatic && options.repository
      ? await readAutomaticEvidence(options.repository, run.namespace)
      : null;
  for (const legacyId of run.selectedCharacterIds) {
    const online = run.characterCheckpoints[legacyId]?.online;
    const derived =
      online?.kind === 'automatic'
        ? deriveAutomaticOutcome(online, legacyId, evidence)
        : deriveManualOutcome(
            online,
            options.links?.get(options.accountId, legacyId) ?? null
          );
    buckets[derived.outcome].push(legacyId);
    outcomes[legacyId] = derived;
  }
  return {
    runId: run.runId,
    accountId: run.accountId,
    mode: run.mode,
    executionPath: playerBackupExecutionPath(run),
    protected: buckets.protected,
    queued: buckets.queued,
    offline: buckets.offline,
    authRequired: buckets['auth-required'],
    needsAttention: buckets['needs-attention'],
    heldAside: buckets['held-aside'],
    failed: buckets.failed,
    pending: buckets.pending,
    outcomes,
    complete: buckets.protected.length === run.selectedCharacterIds.length,
  };
}

// ---------------------------------------------------------------------------
// Automatic (ongoing) result derivation
// ---------------------------------------------------------------------------

interface AutomaticWorkEvidence {
  documents: Map<string, AutomaticCharacterDocument>;
  work: Map<string, AutomaticCharacterOutboxEntry>;
  conflicts: Set<string>;
  quarantine: Set<string>;
}

async function readAutomaticEvidence(
  repository: IndexedDbAutomaticCharacterSyncRepository,
  namespace: `user:${string}`
): Promise<AutomaticWorkEvidence> {
  const [documents, outbox, conflicts, quarantine] = await Promise.all([
    repository.listDocuments(namespace),
    repository.listOutbox(namespace),
    repository.listConflicts(namespace),
    repository.listQuarantine(namespace),
  ]);
  const work = new Map<string, AutomaticCharacterOutboxEntry>();
  for (const entry of outbox) {
    if (!work.has(entry.legacyId)) work.set(entry.legacyId, entry);
  }
  return {
    documents: new Map(
      documents.map(document => [document.legacyId, document])
    ),
    work,
    conflicts: new Set(
      conflicts
        .filter(conflict => conflict.resolutionState === 'unresolved')
        .map(conflict => conflict.legacyId)
    ),
    quarantine: new Set(quarantine.map(record => record.legacyId)),
  };
}

/** Reports exactly what the durable automatic stores support. */
function deriveAutomaticOutcome(
  online: PlayerBackupOnlineCheckpoint,
  legacyId: string,
  evidence: AutomaticWorkEvidence | null
): { outcome: PlayerBackupCharacterOutcome; reason: string | null } {
  if (!evidence) return { outcome: 'pending', reason: null };
  if (evidence.quarantine.has(legacyId)) {
    return { outcome: 'held-aside', reason: 'quarantined' };
  }
  const work = evidence.work.get(legacyId);
  if (evidence.conflicts.has(legacyId) || work?.state === 'conflict') {
    return {
      outcome: 'needs-attention',
      reason: work?.lastError ?? 'conflict',
    };
  }
  if (work?.state === 'auth-required') {
    return { outcome: 'auth-required', reason: work.lastError };
  }
  if (work?.state === 'offline') {
    return { outcome: 'offline', reason: work.lastError };
  }
  if (work && (work.state === 'retry' || work.state === 'failed')) {
    return { outcome: 'failed', reason: work.lastError };
  }
  if (work) return { outcome: 'queued', reason: null };
  const document = evidence.documents.get(legacyId);
  if (
    document &&
    document.baseServerVersion > 0 &&
    document.cloudId === online.cloudId
  ) {
    // An archived document is an acknowledged tombstone: the cloud copy this
    // run protected no longer exists, so completion cannot be claimed for it.
    return document.deletedAt === null
      ? { outcome: 'protected', reason: null }
      : { outcome: 'failed', reason: 'cloud-copy-removed' };
  }
  if (
    online.state !== 'pending' &&
    online.state !== 'queued' &&
    online.state !== 'protected'
  ) {
    // A refused or unusable character keeps its own recorded outcome.
    return { outcome: online.state, reason: online.reason ?? null };
  }
  return { outcome: 'pending', reason: null };
}
