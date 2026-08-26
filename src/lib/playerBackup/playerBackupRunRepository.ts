import {
  openExistingRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

export interface PlayerBackupRunV1 {
  version: 1;
  runId: string;
  accountId: string;
  namespace: `user:${string}`;
  mode: 'one-time' | 'ongoing';
  eligibleCharacterIds: string[];
  selectedCharacterIds: string[];
  clearedCharacterIds: string[];
  futureDefault: 'on' | 'off';
  broadSafetyReceipt: PlayerBackupBroadSafetyReceipt;
  currentCharacterSafetyReceipt?: PlayerBackupCurrentCharacterSafetyReceipt;
  authority: PlayerBackupAuthoritySnapshot;
  confirmedAt: string;
  stage: PlayerBackupRunStage;
  characterCheckpoints: Record<string, PlayerBackupCharacterCheckpoint>;
  localReadyEvidence?: PlayerBackupLocalReadyEvidence;
}

export type PlayerBackupRunStage = 'confirmed' | 'local-ready';

export interface PlayerBackupBroadSafetyReceipt {
  runId: string;
  manifestHash: string;
  createdAt: string;
  protectedEntryDigest: string;
}

export interface PlayerBackupCurrentCharacterSafetyReceipt {
  runId: string;
  manifestHash: string;
  createdAt: string;
  entryVectorDigest: string;
  authorityGeneration: string;
  authorityEpoch: number;
}

export type PlayerBackupAuthoritySnapshot =
  | {
      kind: 'legacy';
      namespace: 'guest' | `user:${string}`;
      family: 'character';
    }
  | {
      kind: 'indexedDB';
      namespace: 'guest' | `user:${string}`;
      family: 'character';
      generation: string;
      epoch: number;
    };

export interface PlayerBackupCharacterCheckpoint {
  localPreparation: 'pending' | 'ready';
}

export interface PlayerBackupLocalReadyEvidence {
  authorityGeneration: string;
  authorityEpoch: number;
  selectionAuthorizedAt: string;
  verifiedAt: string;
}

export interface ActiveRunPointer {
  key: string;
  runId: string;
  accountId: string;
}

export class PlayerBackupRunReplacedError extends Error {
  constructor() {
    super('The active player backup run was replaced');
    this.name = 'PlayerBackupRunReplacedError';
  }
}

export function playerBackupRunKey(runId: string): string {
  return `player-backup-run:${runId}`;
}

export function playerBackupActiveRunKey(accountId: string): string {
  return `player-backup-active-run:${accountId}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringSnapshot(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length
  );
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length && left.every(value => right.includes(value))
  );
}

function hasExactPartition(run: PlayerBackupRunV1): boolean {
  const combined = [...run.selectedCharacterIds, ...run.clearedCharacterIds];
  return (
    run.selectedCharacterIds.length > 0 &&
    new Set(combined).size === combined.length &&
    sameSet(run.eligibleCharacterIds, combined)
  );
}

function isSafetyReceipt(
  value: unknown
): value is PlayerBackupBroadSafetyReceipt {
  if (typeof value !== 'object' || value === null) return false;
  const receipt = value as Partial<PlayerBackupBroadSafetyReceipt>;
  return (
    isNonEmptyString(receipt.runId) &&
    isNonEmptyString(receipt.manifestHash) &&
    isNonEmptyString(receipt.createdAt) &&
    isNonEmptyString(receipt.protectedEntryDigest)
  );
}

function isCurrentCharacterReceipt(
  value: unknown
): value is PlayerBackupCurrentCharacterSafetyReceipt {
  if (typeof value !== 'object' || value === null) return false;
  const receipt = value as Partial<PlayerBackupCurrentCharacterSafetyReceipt>;
  return (
    isNonEmptyString(receipt.runId) &&
    isNonEmptyString(receipt.manifestHash) &&
    isNonEmptyString(receipt.createdAt) &&
    isNonEmptyString(receipt.entryVectorDigest) &&
    isNonEmptyString(receipt.authorityGeneration) &&
    Number.isSafeInteger(receipt.authorityEpoch) &&
    receipt.authorityEpoch! > 0
  );
}

function isAuthority(value: unknown): value is PlayerBackupAuthoritySnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const authority = value as Partial<PlayerBackupAuthoritySnapshot>;
  if (
    authority.family !== 'character' ||
    !isNonEmptyString(authority.namespace)
  ) {
    return false;
  }
  if (authority.kind === 'legacy') return true;
  return (
    authority.kind === 'indexedDB' &&
    isNonEmptyString(authority.generation) &&
    Number.isSafeInteger(authority.epoch) &&
    authority.epoch! > 0
  );
}

export function isPlayerBackupRun(
  value: unknown,
  accountId?: string
): value is PlayerBackupRunV1 {
  if (typeof value !== 'object' || value === null) return false;
  const run = value as Partial<PlayerBackupRunV1>;
  if (
    run.version === 1 &&
    isNonEmptyString(run.runId) &&
    isNonEmptyString(run.accountId) &&
    (accountId === undefined || run.accountId === accountId) &&
    run.namespace === `user:${run.accountId}` &&
    (run.mode === 'one-time' || run.mode === 'ongoing') &&
    isStringSnapshot(run.eligibleCharacterIds) &&
    isStringSnapshot(run.selectedCharacterIds) &&
    isStringSnapshot(run.clearedCharacterIds) &&
    (run.futureDefault === 'on' || run.futureDefault === 'off') &&
    isSafetyReceipt(run.broadSafetyReceipt) &&
    (run.currentCharacterSafetyReceipt === undefined ||
      isCurrentCharacterReceipt(run.currentCharacterSafetyReceipt)) &&
    isAuthority(run.authority) &&
    isNonEmptyString(run.confirmedAt) &&
    (run.stage === 'confirmed' || run.stage === 'local-ready') &&
    typeof run.characterCheckpoints === 'object' &&
    run.characterCheckpoints !== null
  ) {
    const complete = run as PlayerBackupRunV1;
    const checkpointIds = Object.keys(complete.characterCheckpoints);
    return (
      hasExactPartition(complete) &&
      sameSet(checkpointIds, complete.selectedCharacterIds) &&
      checkpointIds.every(id => {
        const checkpoint = complete.characterCheckpoints[id];
        return (
          checkpoint !== null &&
          typeof checkpoint === 'object' &&
          (checkpoint.localPreparation === 'pending' ||
            checkpoint.localPreparation === 'ready')
        );
      }) &&
      (complete.mode === 'ongoing'
        ? complete.futureDefault === 'on'
        : complete.futureDefault === 'off') &&
      (complete.stage !== 'local-ready' ||
        (checkpointIds.every(
          id => complete.characterCheckpoints[id].localPreparation === 'ready'
        ) &&
          complete.authority.kind === 'indexedDB' &&
          complete.localReadyEvidence !== undefined &&
          complete.localReadyEvidence.authorityGeneration ===
            complete.authority.generation &&
          complete.localReadyEvidence.authorityEpoch ===
            complete.authority.epoch &&
          isNonEmptyString(complete.localReadyEvidence.selectionAuthorizedAt) &&
          isNonEmptyString(complete.localReadyEvidence.verifiedAt)))
    );
  }
  return false;
}

export async function assertPlayerBackupRunLocalReady(
  meta: IDBObjectStore,
  accountId: string,
  expectedActiveRunId: string
): Promise<PlayerBackupRunV1> {
  const run = await requestResult(
    meta.get(playerBackupRunKey(expectedActiveRunId))
  );
  if (
    !isPlayerBackupRun(run, accountId) ||
    run.runId !== expectedActiveRunId ||
    run.stage !== 'local-ready'
  ) {
    throw new Error('Player backup run has not reached local-ready');
  }
  const record = structuredClone(run) as PlayerBackupRunV1 & { key?: string };
  delete record.key;
  return record;
}

export async function advancePlayerBackupRunToLocalReady(
  database: IDBDatabase,
  options: {
    accountId: string;
    expectedActiveRunId: string;
    authority: Extract<PlayerBackupAuthoritySnapshot, { kind: 'indexedDB' }>;
    selectionAuthorizedAt: string;
    verifiedAt: string;
  }
): Promise<PlayerBackupRunV1> {
  if (
    !isNonEmptyString(options.selectionAuthorizedAt) ||
    !isNonEmptyString(options.verifiedAt)
  ) {
    throw new Error('Verified local-ready evidence is required');
  }
  const transaction = database.transaction('meta', 'readwrite');
  const completion = transactionComplete(transaction);
  const meta = transaction.objectStore('meta');
  try {
    const pointer = (await requestResult(
      meta.get(playerBackupActiveRunKey(options.accountId))
    )) as ActiveRunPointer | undefined;
    if (
      pointer?.accountId !== options.accountId ||
      pointer.runId !== options.expectedActiveRunId
    ) {
      throw new PlayerBackupRunReplacedError();
    }
    const stored = await requestResult(
      meta.get(playerBackupRunKey(options.expectedActiveRunId))
    );
    if (!isPlayerBackupRun(stored, options.accountId)) {
      throw new Error('Committed player backup run is missing');
    }
    const current = structuredClone(stored) as PlayerBackupRunV1 & {
      key?: string;
    };
    delete current.key;
    const characterCheckpoints = Object.fromEntries(
      current.selectedCharacterIds.map(id => [
        id,
        { localPreparation: 'ready' as const },
      ])
    );
    const next: PlayerBackupRunV1 = {
      ...current,
      authority: structuredClone(options.authority),
      stage: 'local-ready',
      characterCheckpoints,
      localReadyEvidence: {
        authorityGeneration: options.authority.generation,
        authorityEpoch: options.authority.epoch,
        selectionAuthorizedAt: options.selectionAuthorizedAt,
        verifiedAt: options.verifiedAt,
      },
    };
    assertValidPlayerBackupRun(next, options.accountId);
    meta.put({
      ...structuredClone(next),
      key: playerBackupRunKey(next.runId),
    });
    await completion;
    return next;
  } catch (cause) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have completed or aborted.
    }
    await completion.catch(() => undefined);
    throw cause;
  }
}

export function assertValidPlayerBackupRun(
  value: unknown,
  accountId?: string
): asserts value is PlayerBackupRunV1 {
  if (!isPlayerBackupRun(value, accountId)) {
    throw new Error('Player backup run is invalid or has an invalid partition');
  }
}

/** Passive discovery only. It never creates or upgrades rollkeeper-local. */
export async function readActivePlayerBackupRun(options: {
  accountId: string;
  factory?: IDBFactory | null;
}): Promise<PlayerBackupRunV1 | null> {
  const database = await openExistingRollkeeperDatabase({
    factory: options.factory,
  });
  if (!database) return null;
  try {
    const transaction = database.transaction('meta', 'readonly');
    const store = transaction.objectStore('meta');
    const pointer = (await requestResult(
      store.get(playerBackupActiveRunKey(options.accountId))
    )) as ActiveRunPointer | undefined;
    const run = pointer
      ? await requestResult(store.get(playerBackupRunKey(pointer.runId)))
      : undefined;
    await transactionComplete(transaction);
    if (
      pointer?.accountId !== options.accountId ||
      !isPlayerBackupRun(run, options.accountId)
    ) {
      return null;
    }
    const record = structuredClone(run) as PlayerBackupRunV1 & {
      key?: string;
    };
    delete record.key;
    return record;
  } finally {
    database.close();
  }
}
