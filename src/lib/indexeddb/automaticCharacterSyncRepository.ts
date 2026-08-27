import type { Json } from '@/types/database.generated';

import type { StorageNamespace } from './shadowJournal';
import { requestResult, transactionComplete } from './localDatabase';

export type AutomaticSyncPolicy = 'off' | 'on' | 'inherit';
export type AutomaticSyncOperation = 'create' | 'replace' | 'delete';
export type AutomaticSyncWorkState =
  | 'queued'
  | 'inflight'
  | 'retry'
  | 'offline'
  | 'auth-required'
  | 'conflict'
  | 'paused'
  | 'failed';

const INFLIGHT_LEASE_MS = 30_000;

export interface AutomaticCharacterMutation {
  namespace: StorageNamespace;
  legacyId: string;
  operation: AutomaticSyncOperation;
  payload: Json | null;
  schemaVersion: number;
  localRevision: number;
  baseServerVersion: number;
  contentFingerprint: string;
  syncPolicy: AutomaticSyncPolicy;
  updatedAt: string;
  cloudId?: string;
  originPlayerBackupRunId?: string;
}

export interface AutomaticCharacterDocument extends AutomaticCharacterMutation {
  family: 'character';
  deletedAt: string | null;
}

export interface AutomaticCharacterOutboxEntry
  extends AutomaticCharacterMutation {
  mutationId: string;
  family: 'character';
  state: AutomaticSyncWorkState;
  attemptCount: number;
  nextAttemptAt: number;
  lastError: string | null;
  inflightAt: string | null;
  pausedFromState?: Exclude<AutomaticSyncWorkState, 'paused'>;
}

export interface AutomaticCharacterTombstone {
  namespace: StorageNamespace;
  family: 'character';
  legacyId: string;
  localRevision: number;
  deletedAt: string;
  beforeImage: AutomaticCharacterDocument | null;
  mutationId: string;
}

export interface AutomaticCharacterConflict {
  conflictId: string;
  namespace: StorageNamespace;
  family: 'character';
  legacyId: string;
  mutationId: string;
  localCandidate: AutomaticCharacterDocument | null;
  cloudCandidate: unknown;
  detectedAt: string;
  resolutionState: 'unresolved' | 'resolved';
  originPlayerBackupRunId?: string;
}

export interface AutomaticCommitResult {
  saved: boolean;
  mutationId?: string;
  reason?: 'failed' | 'guest' | 'tombstoned';
}

export interface AutomaticSyncQuarantineRecord {
  quarantineId: string;
  namespace: StorageNamespace;
  family: 'character';
  legacyId: string;
  rawValue: string;
  reason: string;
  detectedAt: string;
  conflictId?: string;
}

interface RepositoryOptions {
  randomId?: () => string;
  beforeCommit?: () => void;
}

function aggregateMatches(
  entry: Pick<
    AutomaticCharacterOutboxEntry,
    'namespace' | 'legacyId' | 'family'
  >,
  mutation: AutomaticCharacterMutation
): boolean {
  return (
    entry.namespace === mutation.namespace &&
    entry.family === 'character' &&
    entry.legacyId === mutation.legacyId
  );
}

export class IndexedDbAutomaticCharacterSyncRepository {
  private readonly randomId: () => string;

  constructor(
    private readonly database: IDBDatabase,
    private readonly options: RepositoryOptions = {}
  ) {
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
  }

  async commit(
    mutation: AutomaticCharacterMutation,
    testHooks: { abortTransaction?: boolean } = {}
  ): Promise<AutomaticCommitResult> {
    if (mutation.namespace === 'guest') {
      return { saved: false, reason: 'guest' };
    }
    const mutationId = this.randomId();
    const transaction = this.database.transaction(
      ['documents', 'outbox', 'tombstones'],
      'readwrite'
    );
    const completed = transactionComplete(transaction);
    try {
      const { current, tombstone, pending } = await this.readMutationContext(
        transaction,
        mutation
      );

      if (mutation.operation !== 'delete' && tombstone) {
        await completed;
        return { saved: false, reason: 'tombstoned' };
      }

      try {
        this.options.beforeCommit?.();
      } catch {
        transaction.abort();
        await completed.catch(() => undefined);
        return { saved: false, reason: 'failed' };
      }

      const result = this.writeMutation(
        transaction,
        mutation,
        mutationId,
        current,
        pending
      );

      if (testHooks.abortTransaction) transaction.abort();
      await completed;
      return result;
    } catch {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have completed or aborted.
      }
      try {
        await completed;
      } catch {
        // The failed transaction is intentionally converted to a truthful result.
      }
      return { saved: false, reason: 'failed' };
    }
  }

  /**
   * Writes the initial document and outbox entry for `mutation` inside a
   * transaction the caller owns (over at least `['documents', 'outbox',
   * 'tombstones']`). Semantics match `commit()` minus its `beforeCommit`/
   * abort test hooks.
   */
  async writeMutationInTransaction(
    transaction: IDBTransaction,
    mutation: AutomaticCharacterMutation,
    options: { mutationId: string }
  ): Promise<AutomaticCommitResult> {
    if (mutation.namespace === 'guest') {
      return { saved: false, reason: 'guest' };
    }
    const { current, tombstone, pending } = await this.readMutationContext(
      transaction,
      mutation
    );
    if (mutation.operation !== 'delete' && tombstone) {
      return { saved: false, reason: 'tombstoned' };
    }
    return this.writeMutation(
      transaction,
      mutation,
      options.mutationId,
      current,
      pending
    );
  }

  private async readMutationContext(
    transaction: IDBTransaction,
    mutation: AutomaticCharacterMutation
  ): Promise<{
    current: AutomaticCharacterDocument | undefined;
    tombstone: AutomaticCharacterTombstone | undefined;
    pending: AutomaticCharacterOutboxEntry[];
  }> {
    const documents = transaction.objectStore('documents');
    const outbox = transaction.objectStore('outbox');
    const tombstones = transaction.objectStore('tombstones');
    const aggregateKey = [mutation.namespace, 'character', mutation.legacyId];
    const [current, tombstone, pending] = await Promise.all([
      requestResult(documents.get(aggregateKey)) as Promise<
        AutomaticCharacterDocument | undefined
      >,
      requestResult(tombstones.get(aggregateKey)) as Promise<
        AutomaticCharacterTombstone | undefined
      >,
      requestResult(outbox.getAll()) as Promise<
        AutomaticCharacterOutboxEntry[]
      >,
    ]);
    return { current, tombstone, pending };
  }

  /**
   * Performs the document/outbox/tombstone writes shared by `commit()` and
   * `writeMutationInTransaction()`. Assumes the guest and tombstone checks
   * have already passed.
   */
  private writeMutation(
    transaction: IDBTransaction,
    mutation: AutomaticCharacterMutation,
    mutationId: string,
    current: AutomaticCharacterDocument | undefined,
    pending: AutomaticCharacterOutboxEntry[]
  ): AutomaticCommitResult {
    const documents = transaction.objectStore('documents');
    const outbox = transaction.objectStore('outbox');
    const tombstones = transaction.objectStore('tombstones');

    for (const entry of pending) {
      if (entry.state === 'queued' && aggregateMatches(entry, mutation)) {
        outbox.delete(entry.mutationId);
      }
    }

    const document: AutomaticCharacterDocument = {
      ...structuredClone(mutation),
      family: 'character',
      deletedAt: mutation.operation === 'delete' ? mutation.updatedAt : null,
    };
    documents.put(document);

    if (mutation.operation === 'delete') {
      tombstones.put({
        namespace: mutation.namespace,
        family: 'character',
        legacyId: mutation.legacyId,
        localRevision: mutation.localRevision,
        deletedAt: mutation.updatedAt,
        beforeImage: current ? structuredClone(current) : null,
        mutationId,
      } satisfies AutomaticCharacterTombstone);
    }

    outbox.put({
      ...structuredClone(mutation),
      mutationId,
      family: 'character',
      state: 'queued',
      attemptCount: 0,
      nextAttemptAt: 0,
      lastError: null,
      inflightAt: null,
    } satisfies AutomaticCharacterOutboxEntry);

    return { saved: true, mutationId };
  }

  async listOutbox(
    namespace: StorageNamespace
  ): Promise<AutomaticCharacterOutboxEntry[]> {
    const transaction = this.database.transaction('outbox', 'readonly');
    const entries = (await requestResult(
      transaction.objectStore('outbox').getAll()
    )) as AutomaticCharacterOutboxEntry[];
    await transactionComplete(transaction);
    return entries.filter(entry => entry.namespace === namespace);
  }

  async getTombstone(
    namespace: StorageNamespace,
    legacyId: string
  ): Promise<AutomaticCharacterTombstone | null> {
    const transaction = this.database.transaction('tombstones', 'readonly');
    const value = (await requestResult(
      transaction
        .objectStore('tombstones')
        .get([namespace, 'character', legacyId])
    )) as AutomaticCharacterTombstone | undefined;
    await transactionComplete(transaction);
    return value ?? null;
  }

  async markInflight(mutationId: string): Promise<void> {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const outbox = transaction.objectStore('outbox');
    const entry = (await requestResult(outbox.get(mutationId))) as
      | AutomaticCharacterOutboxEntry
      | undefined;
    if (entry) {
      outbox.put({
        ...entry,
        state: 'inflight',
        inflightAt: new Date().toISOString(),
      });
    }
    await transactionComplete(transaction);
  }

  async nextRunnable(
    namespace: StorageNamespace,
    now: number,
    reclaimInflight = false
  ): Promise<AutomaticCharacterOutboxEntry | null> {
    const entries = await this.listOutbox(namespace);
    return (
      entries.find(entry => {
        if (
          ['queued', 'retry', 'offline'].includes(entry.state) &&
          entry.nextAttemptAt <= now
        ) {
          return true;
        }
        if (entry.state !== 'inflight') return false;
        if (reclaimInflight) return true;
        const inflightAt = entry.inflightAt
          ? Date.parse(entry.inflightAt)
          : Number.NaN;
        return (
          !Number.isFinite(inflightAt) || inflightAt + INFLIGHT_LEASE_MS <= now
        );
      }) ?? null
    );
  }

  async getDocument(
    namespace: StorageNamespace,
    legacyId: string
  ): Promise<AutomaticCharacterDocument | null> {
    const transaction = this.database.transaction('documents', 'readonly');
    const value = (await requestResult(
      transaction
        .objectStore('documents')
        .get([namespace, 'character', legacyId])
    )) as AutomaticCharacterDocument | undefined;
    await transactionComplete(transaction);
    return value ?? null;
  }

  async listDocuments(
    namespace: StorageNamespace
  ): Promise<AutomaticCharacterDocument[]> {
    const transaction = this.database.transaction('documents', 'readonly');
    const documents = (await requestResult(
      transaction.objectStore('documents').getAll()
    )) as AutomaticCharacterDocument[];
    await transactionComplete(transaction);
    return documents.filter(
      document =>
        document.namespace === namespace && document.family === 'character'
    );
  }

  async hasParticipants(namespace: StorageNamespace): Promise<boolean> {
    const documents = await this.listDocuments(namespace);
    return documents.some(document => document.syncPolicy !== 'off');
  }

  async updateWork(
    mutationId: string,
    patch: Partial<
      Pick<
        AutomaticCharacterOutboxEntry,
        'state' | 'attemptCount' | 'nextAttemptAt' | 'lastError' | 'inflightAt'
      >
    >
  ): Promise<void> {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const outbox = transaction.objectStore('outbox');
    const entry = (await requestResult(outbox.get(mutationId))) as
      | AutomaticCharacterOutboxEntry
      | undefined;
    if (entry) outbox.put({ ...entry, ...patch });
    await transactionComplete(transaction);
  }

  async retryNow(
    namespace: StorageNamespace,
    legacyId?: string
  ): Promise<void> {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const outbox = transaction.objectStore('outbox');
    const entries = (await requestResult(
      outbox.getAll()
    )) as AutomaticCharacterOutboxEntry[];
    for (const entry of entries) {
      if (
        entry.namespace === namespace &&
        (!legacyId || entry.legacyId === legacyId) &&
        ['retry', 'offline', 'failed'].includes(entry.state)
      ) {
        outbox.put({
          ...entry,
          state: 'queued',
          nextAttemptAt: 0,
          lastError: null,
          inflightAt: null,
        });
      }
    }
    await transactionComplete(transaction);
  }

  async resumeAfterAuthentication(namespace: StorageNamespace): Promise<void> {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const outbox = transaction.objectStore('outbox');
    const entries = (await requestResult(
      outbox.getAll()
    )) as AutomaticCharacterOutboxEntry[];
    for (const entry of entries) {
      if (entry.namespace === namespace && entry.state === 'auth-required') {
        outbox.put({
          ...entry,
          state: 'queued',
          nextAttemptAt: 0,
          lastError: null,
          inflightAt: null,
        });
      }
    }
    await transactionComplete(transaction);
  }

  async pauseAggregate(
    namespace: StorageNamespace,
    legacyId: string
  ): Promise<void> {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const outbox = transaction.objectStore('outbox');
    const entries = (await requestResult(
      outbox.getAll()
    )) as AutomaticCharacterOutboxEntry[];
    for (const entry of entries) {
      if (
        entry.namespace === namespace &&
        entry.legacyId === legacyId &&
        !['inflight', 'conflict', 'paused'].includes(entry.state)
      ) {
        outbox.put({
          ...entry,
          pausedFromState: entry.state,
          state: 'paused',
          inflightAt: null,
        });
      }
    }
    await transactionComplete(transaction);
  }

  async resumeAggregate(
    namespace: StorageNamespace,
    legacyId: string
  ): Promise<void> {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const outbox = transaction.objectStore('outbox');
    const entries = (await requestResult(
      outbox.getAll()
    )) as AutomaticCharacterOutboxEntry[];
    for (const entry of entries) {
      if (
        entry.namespace === namespace &&
        entry.legacyId === legacyId &&
        entry.state === 'paused'
      ) {
        const { pausedFromState, ...retained } = entry;
        outbox.put({
          ...retained,
          state: pausedFromState ?? 'queued',
        });
      }
    }
    await transactionComplete(transaction);
  }

  async acknowledge(
    entry: AutomaticCharacterOutboxEntry,
    cloudId: string,
    serverVersion: number
  ): Promise<void> {
    const transaction = this.database.transaction(
      ['documents', 'outbox'],
      'readwrite'
    );
    const documents = transaction.objectStore('documents');
    const key = [entry.namespace, 'character', entry.legacyId];
    const current = (await requestResult(documents.get(key))) as
      | AutomaticCharacterDocument
      | undefined;
    if (current && current.localRevision <= entry.localRevision) {
      documents.put({
        ...current,
        cloudId,
        baseServerVersion: serverVersion,
      });
    }
    transaction.objectStore('outbox').delete(entry.mutationId);
    await transactionComplete(transaction);
  }

  async preserveConflict(
    entry: AutomaticCharacterOutboxEntry,
    cloudCandidate: unknown,
    detectedAt: string
  ): Promise<void> {
    const transaction = this.database.transaction(
      ['documents', 'outbox', 'conflicts'],
      'readwrite'
    );
    await this.preserveConflictInTransaction(
      transaction,
      entry,
      cloudCandidate,
      detectedAt
    );
    await transactionComplete(transaction);
  }

  /**
   * Performs the same document/conflict/outbox writes as `preserveConflict()`
   * on a transaction the caller owns (over at least `['documents', 'outbox',
   * 'conflicts']`), and returns the stored conflict record. The run origin is
   * stamped only when `options.originPlayerBackupRunId` is supplied, so legacy
   * callers keep writing byte-identical records.
   */
  async preserveConflictInTransaction(
    transaction: IDBTransaction,
    entry: AutomaticCharacterOutboxEntry,
    cloudCandidate: unknown,
    detectedAt: string,
    options: { originPlayerBackupRunId?: string } = {}
  ): Promise<AutomaticCharacterConflict> {
    const localCandidate = (await requestResult(
      transaction
        .objectStore('documents')
        .get([entry.namespace, 'character', entry.legacyId])
    )) as AutomaticCharacterDocument | undefined;
    const resolvableLocalCandidate =
      localCandidate &&
      entry.baseServerVersion === 0 &&
      localCandidate.baseServerVersion === 0
        ? { ...localCandidate, cloudId: entry.cloudId }
        : localCandidate;
    if (resolvableLocalCandidate !== localCandidate) {
      transaction.objectStore('documents').put(resolvableLocalCandidate);
    }
    const conflict: AutomaticCharacterConflict = {
      conflictId: `automatic-sync:${entry.mutationId}`,
      namespace: entry.namespace,
      family: 'character',
      legacyId: entry.legacyId,
      mutationId: entry.mutationId,
      localCandidate: resolvableLocalCandidate
        ? structuredClone(resolvableLocalCandidate)
        : null,
      cloudCandidate: structuredClone(cloudCandidate),
      detectedAt,
      resolutionState: 'unresolved',
      ...(options.originPlayerBackupRunId !== undefined
        ? { originPlayerBackupRunId: options.originPlayerBackupRunId }
        : {}),
    };
    transaction.objectStore('conflicts').put(conflict);
    transaction.objectStore('outbox').put({
      ...entry,
      state: 'conflict',
      lastError: 'Cloud version conflicts with local work',
      inflightAt: null,
    });
    return conflict;
  }

  /**
   * Reads this namespace's character conflicts on a transaction the caller
   * owns (over at least `['conflicts']`).
   */
  async listConflictsInTransaction(
    transaction: IDBTransaction,
    namespace: StorageNamespace
  ): Promise<AutomaticCharacterConflict[]> {
    const conflicts = (await requestResult(
      transaction.objectStore('conflicts').getAll()
    )) as AutomaticCharacterConflict[];
    return conflicts.filter(
      conflict =>
        conflict.namespace === namespace && conflict.family === 'character'
    );
  }

  /**
   * Replaces the cloud candidate of an unresolved conflict on a transaction
   * the caller owns (over at least `['conflicts']`). Throws when the conflict
   * is missing or already resolved so the caller can abort. The run origin is
   * restamped only when `options.originPlayerBackupRunId` is supplied, so
   * legacy four-argument callers keep writing byte-identical records.
   */
  async refreshConflictCloudCandidateInTransaction(
    transaction: IDBTransaction,
    conflictId: string,
    cloudCandidate: unknown,
    detectedAt: string,
    options: { originPlayerBackupRunId?: string } = {}
  ): Promise<AutomaticCharacterConflict> {
    const conflicts = transaction.objectStore('conflicts');
    const current = (await requestResult(conflicts.get(conflictId))) as
      | AutomaticCharacterConflict
      | undefined;
    if (!current || current.resolutionState !== 'unresolved') {
      throw new Error('Conflict is not unresolved');
    }
    const refreshed: AutomaticCharacterConflict = {
      ...current,
      cloudCandidate: structuredClone(cloudCandidate),
      detectedAt,
      ...(options.originPlayerBackupRunId !== undefined
        ? { originPlayerBackupRunId: options.originPlayerBackupRunId }
        : {}),
    };
    conflicts.put(refreshed);
    return refreshed;
  }

  async listConflicts(
    namespace: StorageNamespace
  ): Promise<AutomaticCharacterConflict[]> {
    const transaction = this.database.transaction('conflicts', 'readonly');
    const conflicts = (await requestResult(
      transaction.objectStore('conflicts').getAll()
    )) as AutomaticCharacterConflict[];
    await transactionComplete(transaction);
    return conflicts.filter(
      conflict =>
        conflict.namespace === namespace && conflict.family === 'character'
    );
  }

  async adoptCloudCandidate(
    current: AutomaticCharacterDocument,
    candidate: {
      payload: Json;
      schemaVersion: number;
      localRevision: number;
      serverVersion: number;
      contentFingerprint: string;
      deletedAt: string | null;
      updatedAt: string;
    }
  ): Promise<void> {
    const stores = candidate.deletedAt
      ? (['documents', 'tombstones'] as const)
      : (['documents'] as const);
    const transaction = this.database.transaction(stores, 'readwrite');
    const updated: AutomaticCharacterDocument = {
      ...current,
      payload: structuredClone(candidate.payload),
      schemaVersion: candidate.schemaVersion,
      localRevision: Math.max(current.localRevision, candidate.localRevision),
      baseServerVersion: candidate.serverVersion,
      contentFingerprint: candidate.contentFingerprint,
      deletedAt: candidate.deletedAt,
      updatedAt: candidate.updatedAt,
    };
    transaction.objectStore('documents').put(updated);
    if (candidate.deletedAt) {
      transaction.objectStore('tombstones').put({
        namespace: current.namespace,
        family: 'character',
        legacyId: current.legacyId,
        localRevision: updated.localRevision,
        deletedAt: candidate.deletedAt,
        beforeImage: structuredClone(current),
        mutationId: `cloud-tombstone:${current.cloudId}:${candidate.serverVersion}`,
      } satisfies AutomaticCharacterTombstone);
    }
    await transactionComplete(transaction);
  }

  async quarantineCloudCandidate(
    namespace: StorageNamespace,
    legacyId: string,
    cloudCandidate: unknown,
    reason: string,
    detectedAt: string
  ): Promise<void> {
    const transaction = this.database.transaction('quarantine', 'readwrite');
    this.quarantineCloudCandidateInTransaction(
      transaction,
      namespace,
      legacyId,
      cloudCandidate,
      reason,
      detectedAt
    );
    await transactionComplete(transaction);
  }

  /**
   * Writes the same quarantine record as `quarantineCloudCandidate()` on a
   * transaction the caller owns (over at least `['quarantine']`).
   */
  quarantineCloudCandidateInTransaction(
    transaction: IDBTransaction,
    namespace: StorageNamespace,
    legacyId: string,
    cloudCandidate: unknown,
    reason: string,
    detectedAt: string
  ): void {
    transaction.objectStore('quarantine').put({
      quarantineId: `automatic-sync-pull:${namespace}:${legacyId}`,
      namespace,
      family: 'character',
      legacyId,
      rawValue:
        typeof cloudCandidate === 'string'
          ? cloudCandidate
          : JSON.stringify(cloudCandidate),
      reason,
      detectedAt,
    });
  }

  /**
   * Puts a document that the cloud has already acknowledged, without creating
   * any outbox work, on a transaction the caller owns (over at least
   * `['documents']`).
   */
  writeAcknowledgedDocumentInTransaction(
    transaction: IDBTransaction,
    mutation: AutomaticCharacterMutation & { cloudId: string }
  ): void {
    if (!mutation.cloudId || mutation.baseServerVersion <= 0) {
      throw new Error('Acknowledged document requires a server version');
    }
    transaction.objectStore('documents').put({
      ...structuredClone(mutation),
      family: 'character',
      deletedAt: null,
    } satisfies AutomaticCharacterDocument);
  }

  async listQuarantine(
    namespace: StorageNamespace
  ): Promise<AutomaticSyncQuarantineRecord[]> {
    const transaction = this.database.transaction('quarantine', 'readonly');
    const rows = (await requestResult(
      transaction.objectStore('quarantine').getAll()
    )) as AutomaticSyncQuarantineRecord[];
    await transactionComplete(transaction);
    return rows.filter(
      row => row.namespace === namespace && row.family === 'character'
    );
  }
}
