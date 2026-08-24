import type { CombatLogArchivePayload } from '@/lib/durableDm/combatLogArchiveFamily';

import type { StorageNamespace } from './shadowJournal';
import { requestResult, transactionComplete } from './localDatabase';

export type CombatLogArchiveOperation = 'create' | 'replace' | 'delete';
export type CombatLogArchiveWorkState =
  | 'queued'
  | 'inflight'
  | 'retry'
  | 'offline'
  | 'auth-required'
  | 'conflict'
  | 'paused'
  | 'failed'
  | 'acknowledged'
  | 'superseded';

export interface CombatLogArchiveMutation {
  namespace: StorageNamespace;
  campaignId: string;
  legacyId: string;
  cutoverEpoch: number;
  operation: CombatLogArchiveOperation;
  payload: CombatLogArchivePayload | null;
  schemaVersion: number;
  localRevision: number;
  baseServerVersion: number;
  contentFingerprint: string;
  updatedAt: string;
}

export interface CombatLogArchiveDocument extends CombatLogArchiveMutation {
  family: 'combat_log_archive';
  deletedAt: string | null;
}

export interface CombatLogArchiveOutboxEntry extends CombatLogArchiveMutation {
  family: 'combat_log_archive';
  mutationId: string;
  state: CombatLogArchiveWorkState;
  attemptCount: number;
  nextAttemptAt: number;
  inflightAt: string | null;
  lastError: string | null;
  pausedFromState?: Exclude<CombatLogArchiveWorkState, 'paused'>;
}

export interface CombatLogArchiveTombstoneRow {
  namespace: StorageNamespace;
  family: 'combat_log_archive';
  campaignId: string;
  legacyId: string;
  localRevision: number;
  deletedAt: string;
  mutationId: string;
  beforeImage: CombatLogArchiveDocument | null;
}

interface RepositoryOptions {
  randomId?: () => string;
  beforeCommit?: () => void;
}

function namespaceVisibilityKey(namespace: StorageNamespace): string {
  return `account-namespace-visibility:${namespace}`;
}

const TERMINAL_STATES = new Set<CombatLogArchiveWorkState>([
  'acknowledged',
  'superseded',
]);

function isTerminal(state: CombatLogArchiveWorkState): boolean {
  return TERMINAL_STATES.has(state);
}

function matches(
  entry: Pick<
    CombatLogArchiveOutboxEntry,
    'namespace' | 'campaignId' | 'family'
  >,
  namespace: StorageNamespace,
  campaignId: string
) {
  return (
    entry.namespace === namespace &&
    entry.campaignId === campaignId &&
    entry.family === 'combat_log_archive'
  );
}

export class IndexedDbCombatLogArchiveRepository {
  private readonly randomId: () => string;

  constructor(
    private readonly database: IDBDatabase,
    private readonly options: RepositoryOptions = {}
  ) {
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
  }

  async commit(
    mutation: CombatLogArchiveMutation,
    hooks: { abortTransaction?: boolean } = {}
  ): Promise<
    | { saved: true; mutationId: string }
    | { saved: false; reason: 'guest' | 'failed' | 'tombstoned' }
  > {
    if (mutation.namespace === 'guest')
      return { saved: false, reason: 'guest' };
    const mutationId = this.randomId();
    const transaction = this.database.transaction(
      ['documents', 'outbox', 'tombstones'],
      'readwrite'
    );
    const completed = transactionComplete(transaction);
    try {
      const key = [mutation.namespace, 'combat_log_archive', mutation.legacyId];
      const documents = transaction.objectStore('documents');
      const outbox = transaction.objectStore('outbox');
      const tombstones = transaction.objectStore('tombstones');
      const [current, tombstone, pending] = await Promise.all([
        requestResult(documents.get(key)) as Promise<
          CombatLogArchiveDocument | undefined
        >,
        requestResult(tombstones.get(key)) as Promise<
          CombatLogArchiveTombstoneRow | undefined
        >,
        requestResult(outbox.getAll()) as Promise<
          CombatLogArchiveOutboxEntry[]
        >,
      ]);
      if (mutation.operation !== 'delete' && tombstone) {
        await completed;
        return { saved: false, reason: 'tombstoned' };
      }
      this.options.beforeCommit?.();
      for (const entry of pending) {
        if (
          // Under IndexedDB authority every commit pauses the outbox, so a
          // paused predecessor must be superseded exactly like a queued one.
          (entry.state === 'queued' || entry.state === 'paused') &&
          entry.namespace === mutation.namespace &&
          entry.campaignId === mutation.campaignId &&
          entry.legacyId === mutation.legacyId &&
          entry.family === 'combat_log_archive'
        ) {
          // Superseding is terminal, so any pause bookkeeping left on the
          // predecessor is dropped rather than carried forward.
          const superseded: CombatLogArchiveOutboxEntry = {
            ...entry,
            state: 'superseded',
            lastError: null,
            inflightAt: null,
          };
          delete superseded.pausedFromState;
          outbox.put(superseded);
        }
      }
      const document: CombatLogArchiveDocument = {
        ...structuredClone(mutation),
        family: 'combat_log_archive',
        deletedAt: mutation.operation === 'delete' ? mutation.updatedAt : null,
      };
      documents.put(document);
      if (mutation.operation === 'delete') {
        tombstones.put({
          namespace: mutation.namespace,
          family: 'combat_log_archive',
          campaignId: mutation.campaignId,
          legacyId: mutation.legacyId,
          localRevision: mutation.localRevision,
          deletedAt: mutation.updatedAt,
          mutationId,
          beforeImage: current ? structuredClone(current) : null,
        } satisfies CombatLogArchiveTombstoneRow);
      }
      outbox.put({
        ...structuredClone(mutation),
        family: 'combat_log_archive',
        mutationId,
        state: 'queued',
        attemptCount: 0,
        nextAttemptAt: 0,
        inflightAt: null,
        lastError: null,
      } satisfies CombatLogArchiveOutboxEntry);
      if (hooks.abortTransaction) transaction.abort();
      await completed;
      return { saved: true, mutationId };
    } catch {
      try {
        transaction.abort();
      } catch {
        // The transaction may already be complete or aborted.
      }
      await completed.catch(() => undefined);
      return { saved: false, reason: 'failed' };
    }
  }

  async listOutbox(namespace: StorageNamespace, campaignId: string) {
    const transaction = this.database.transaction('outbox', 'readonly');
    const values = (await requestResult(
      transaction.objectStore('outbox').getAll()
    )) as CombatLogArchiveOutboxEntry[];
    await transactionComplete(transaction);
    return values.filter(entry => matches(entry, namespace, campaignId));
  }

  private async isNamespaceHidden(namespace: StorageNamespace) {
    const transaction = this.database.transaction('meta', 'readonly');
    const hidden = await requestResult(
      transaction.objectStore('meta').get(namespaceVisibilityKey(namespace))
    );
    await transactionComplete(transaction);
    return Boolean(hidden);
  }

  async getDocument(namespace: StorageNamespace, legacyId: string) {
    if (await this.isNamespaceHidden(namespace)) return null;
    const transaction = this.database.transaction('documents', 'readonly');
    const value = (await requestResult(
      transaction
        .objectStore('documents')
        .get([namespace, 'combat_log_archive', legacyId])
    )) as CombatLogArchiveDocument | undefined;
    await transactionComplete(transaction);
    return value ?? null;
  }

  async listDocuments(
    namespace: StorageNamespace,
    campaignId: string
  ): Promise<CombatLogArchiveDocument[]> {
    if (await this.isNamespaceHidden(namespace)) return [];
    const transaction = this.database.transaction('documents', 'readonly');
    const values = (await requestResult(
      transaction.objectStore('documents').getAll()
    )) as CombatLogArchiveDocument[];
    await transactionComplete(transaction);
    return values
      .filter(value => matches(value, namespace, campaignId))
      .sort((left, right) => left.legacyId.localeCompare(right.legacyId));
  }

  async getTombstone(namespace: StorageNamespace, legacyId: string) {
    const transaction = this.database.transaction('tombstones', 'readonly');
    const value = (await requestResult(
      transaction
        .objectStore('tombstones')
        .get([namespace, 'combat_log_archive', legacyId])
    )) as CombatLogArchiveTombstoneRow | undefined;
    await transactionComplete(transaction);
    return value ?? null;
  }

  private async changePause(
    namespace: StorageNamespace,
    campaignId: string,
    paused: boolean
  ) {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    const values = (await requestResult(
      store.getAll()
    )) as CombatLogArchiveOutboxEntry[];
    for (const entry of values.filter(value =>
      matches(value, namespace, campaignId)
    )) {
      // Terminal work is finished: pausing must never resurrect an
      // acknowledged or superseded entry as pending outbox work.
      if (paused && entry.state !== 'paused' && !isTerminal(entry.state)) {
        store.put({ ...entry, state: 'paused', pausedFromState: entry.state });
      } else if (!paused && entry.state === 'paused') {
        const { pausedFromState, ...rest } = entry;
        // A legacy row paused from a terminal state restores to it, not to
        // the queue.
        store.put({ ...rest, state: pausedFromState ?? 'queued' });
      }
    }
    await transactionComplete(transaction);
  }

  pause(namespace: StorageNamespace, campaignId: string) {
    return this.changePause(namespace, campaignId, true);
  }

  resume(namespace: StorageNamespace, campaignId: string) {
    return this.changePause(namespace, campaignId, false);
  }

  async nextRunnable(
    namespace: StorageNamespace,
    campaignId: string,
    now: number
  ) {
    const entries = await this.listOutbox(namespace, campaignId);
    return (
      entries
        .filter(
          entry =>
            (entry.state === 'queued' || entry.state === 'retry') &&
            entry.nextAttemptAt <= now
        )
        .sort((left, right) => left.nextAttemptAt - right.nextAttemptAt)[0] ??
      null
    );
  }

  async updateWork(
    mutationId: string,
    updates: Partial<
      Pick<
        CombatLogArchiveOutboxEntry,
        'state' | 'attemptCount' | 'nextAttemptAt' | 'inflightAt' | 'lastError'
      >
    >
  ) {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    const entry = (await requestResult(store.get(mutationId))) as
      | CombatLogArchiveOutboxEntry
      | undefined;
    if (entry) store.put({ ...entry, ...updates });
    await transactionComplete(transaction);
  }

  async acknowledge(
    mutationId: string,
    acknowledgement: {
      serverVersion: number;
      cutoverEpoch: number;
      payloadFingerprint: string;
    }
  ) {
    const transaction = this.database.transaction(
      ['documents', 'outbox', 'tombstones'],
      'readwrite'
    );
    const completed = transactionComplete(transaction);
    const outbox = transaction.objectStore('outbox');
    const entry = (await requestResult(outbox.get(mutationId))) as
      | CombatLogArchiveOutboxEntry
      | undefined;
    if (!entry) {
      await completed;
      return;
    }
    const documents = transaction.objectStore('documents');
    const key = [entry.namespace, 'combat_log_archive', entry.legacyId];
    const document = (await requestResult(documents.get(key))) as
      | CombatLogArchiveDocument
      | undefined;
    // A late acknowledgement of an older mutation must never rewind a document
    // that a newer commit already replaced.
    if (document && document.contentFingerprint === entry.contentFingerprint) {
      documents.put({
        ...document,
        baseServerVersion: acknowledgement.serverVersion,
        cutoverEpoch: acknowledgement.cutoverEpoch,
        contentFingerprint: acknowledgement.payloadFingerprint,
      });
    }
    outbox.put({
      ...entry,
      state: 'acknowledged',
      inflightAt: null,
      lastError: null,
    });
    await completed;
  }

  async preserveCloudConflict(
    entry: CombatLogArchiveOutboxEntry,
    cloudCandidate: unknown
  ) {
    const transaction = this.database.transaction('conflicts', 'readwrite');
    transaction.objectStore('conflicts').put({
      conflictId: `combat_log_archive:${entry.namespace}:${entry.campaignId}:${entry.legacyId}:${entry.mutationId}`,
      namespace: entry.namespace,
      campaignId: entry.campaignId,
      family: 'combat_log_archive',
      legacyId: entry.legacyId,
      mutationId: entry.mutationId,
      localCandidate: structuredClone(entry),
      cloudCandidate: structuredClone(cloudCandidate),
      resolutionState: 'unresolved',
      detectedAt: new Date().toISOString(),
    });
    await transactionComplete(transaction);
    await this.updateWork(entry.mutationId, {
      state: 'conflict',
      lastError: 'cloud-conflict',
    });
  }

  async applyAcceptedCloudVersion(input: {
    namespace: StorageNamespace;
    campaignId: string;
    legacyId: string;
    cutoverEpoch: number;
    serverVersion: number;
    schemaVersion: number;
    payload: CombatLogArchivePayload | null;
    payloadFingerprint: string;
    tombstoned: boolean;
    acceptedAt: string;
  }) {
    const transaction = this.database.transaction(
      ['documents', 'outbox', 'tombstones'],
      'readwrite'
    );
    const completed = transactionComplete(transaction);
    const outbox = (await requestResult(
      transaction.objectStore('outbox').getAll()
    )) as CombatLogArchiveOutboxEntry[];
    if (
      outbox.some(
        entry =>
          matches(entry, input.namespace, input.campaignId) &&
          entry.state !== 'acknowledged' &&
          entry.state !== 'superseded'
      )
    ) {
      transaction.abort();
      await completed.catch(() => undefined);
      throw new Error(
        'Unresolved local combat log archive work blocks cloud hydration'
      );
    }
    const store = transaction.objectStore('documents');
    const tombstones = transaction.objectStore('tombstones');
    const key = [input.namespace, 'combat_log_archive', input.legacyId];
    const current = (await requestResult(store.get(key))) as
      | CombatLogArchiveDocument
      | undefined;
    store.put({
      namespace: input.namespace,
      campaignId: input.campaignId,
      legacyId: input.legacyId,
      family: 'combat_log_archive',
      cutoverEpoch: input.cutoverEpoch,
      operation: input.tombstoned ? 'delete' : 'replace',
      payload: structuredClone(input.payload),
      schemaVersion: input.schemaVersion,
      localRevision: (current?.localRevision ?? 0) + 1,
      baseServerVersion: input.serverVersion,
      contentFingerprint: input.payloadFingerprint,
      updatedAt: input.acceptedAt,
      deletedAt: input.tombstoned ? input.acceptedAt : null,
    } satisfies CombatLogArchiveDocument);
    if (input.tombstoned) {
      tombstones.put({
        namespace: input.namespace,
        family: 'combat_log_archive',
        campaignId: input.campaignId,
        legacyId: input.legacyId,
        localRevision: (current?.localRevision ?? 0) + 1,
        deletedAt: input.acceptedAt,
        mutationId: `cloud:${input.serverVersion}`,
        beforeImage: current ? structuredClone(current) : null,
      } satisfies CombatLogArchiveTombstoneRow);
    } else {
      tombstones.delete(key);
    }
    await completed;
  }

  async removeAccountFromDevice(
    namespace: StorageNamespace,
    options: { confirmed: boolean; lossConfirmed: boolean }
  ): Promise<void> {
    if (namespace === 'guest') throw new Error('Account namespace is required');
    if (!options.confirmed)
      throw new Error('Device removal requires confirmation');
    const transaction = this.database.transaction(
      ['meta', 'outbox'],
      'readwrite'
    );
    const outbox = (await requestResult(
      transaction.objectStore('outbox').getAll()
    )) as CombatLogArchiveOutboxEntry[];
    const unresolved = outbox.some(
      entry =>
        entry.namespace === namespace &&
        entry.family === 'combat_log_archive' &&
        entry.state !== 'acknowledged' &&
        entry.state !== 'superseded'
    );
    if (unresolved && !options.lossConfirmed) {
      transaction.abort();
      await transactionComplete(transaction).catch(() => undefined);
      throw new Error(
        'Unresolved device-only work requires explicit loss confirmation'
      );
    }
    transaction.objectStore('meta').put({
      key: namespaceVisibilityKey(namespace),
      hidden: true,
      removedAt: new Date().toISOString(),
    });
    await transactionComplete(transaction);
  }
}
