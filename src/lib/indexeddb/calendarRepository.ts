import type { CalendarPayload } from '@/lib/durableDm/calendarFamily';

import type { StorageNamespace } from './shadowJournal';
import { requestResult, transactionComplete } from './localDatabase';

export type CalendarOperation = 'create' | 'replace' | 'delete';
export type CalendarWorkState =
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

export interface CalendarMutation {
  namespace: StorageNamespace;
  campaignId: string;
  legacyId: string;
  cutoverEpoch: number;
  operation: CalendarOperation;
  payload: CalendarPayload | null;
  schemaVersion: number;
  localRevision: number;
  baseServerVersion: number;
  contentFingerprint: string;
  updatedAt: string;
}

export interface CalendarDocument extends CalendarMutation {
  family: 'calendar';
  deletedAt: string | null;
}

export interface CalendarOutboxEntry extends CalendarMutation {
  family: 'calendar';
  mutationId: string;
  state: CalendarWorkState;
  attemptCount: number;
  nextAttemptAt: number;
  inflightAt: string | null;
  lastError: string | null;
  pausedFromState?: Exclude<CalendarWorkState, 'paused'>;
}

export interface CalendarTombstone {
  namespace: StorageNamespace;
  family: 'calendar';
  campaignId: string;
  legacyId: string;
  localRevision: number;
  deletedAt: string;
  mutationId: string;
  beforeImage: CalendarDocument | null;
}

interface RepositoryOptions {
  randomId?: () => string;
  beforeCommit?: () => void;
}

function namespaceVisibilityKey(namespace: StorageNamespace): string {
  return `account-namespace-visibility:${namespace}`;
}

function matches(
  entry: Pick<CalendarOutboxEntry, 'namespace' | 'campaignId' | 'family'>,
  namespace: StorageNamespace,
  campaignId: string
) {
  return (
    entry.namespace === namespace &&
    entry.campaignId === campaignId &&
    entry.family === 'calendar'
  );
}

export class IndexedDbCalendarRepository {
  private readonly randomId: () => string;

  constructor(
    private readonly database: IDBDatabase,
    private readonly options: RepositoryOptions = {}
  ) {
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
  }

  async commit(
    mutation: CalendarMutation,
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
      const key = [mutation.namespace, 'calendar', mutation.legacyId];
      const documents = transaction.objectStore('documents');
      const outbox = transaction.objectStore('outbox');
      const tombstones = transaction.objectStore('tombstones');
      const [current, tombstone, pending] = await Promise.all([
        requestResult(documents.get(key)) as Promise<
          CalendarDocument | undefined
        >,
        requestResult(tombstones.get(key)) as Promise<
          CalendarTombstone | undefined
        >,
        requestResult(outbox.getAll()) as Promise<CalendarOutboxEntry[]>,
      ]);
      if (mutation.operation !== 'delete' && tombstone) {
        await completed;
        return { saved: false, reason: 'tombstoned' };
      }
      this.options.beforeCommit?.();
      for (const entry of pending) {
        if (
          entry.state === 'queued' &&
          entry.namespace === mutation.namespace &&
          entry.campaignId === mutation.campaignId &&
          entry.legacyId === mutation.legacyId &&
          entry.family === 'calendar'
        ) {
          outbox.put({
            ...entry,
            state: 'superseded',
            lastError: null,
            inflightAt: null,
          });
        }
      }
      const document: CalendarDocument = {
        ...structuredClone(mutation),
        family: 'calendar',
        deletedAt: mutation.operation === 'delete' ? mutation.updatedAt : null,
      };
      documents.put(document);
      if (mutation.operation === 'delete') {
        tombstones.put({
          namespace: mutation.namespace,
          family: 'calendar',
          campaignId: mutation.campaignId,
          legacyId: mutation.legacyId,
          localRevision: mutation.localRevision,
          deletedAt: mutation.updatedAt,
          mutationId,
          beforeImage: current ? structuredClone(current) : null,
        } satisfies CalendarTombstone);
      }
      outbox.put({
        ...structuredClone(mutation),
        family: 'calendar',
        mutationId,
        state: 'queued',
        attemptCount: 0,
        nextAttemptAt: 0,
        inflightAt: null,
        lastError: null,
      } satisfies CalendarOutboxEntry);
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
    )) as CalendarOutboxEntry[];
    await transactionComplete(transaction);
    return values.filter(entry => matches(entry, namespace, campaignId));
  }

  async getDocument(namespace: StorageNamespace, legacyId: string) {
    const visibility = this.database.transaction('meta', 'readonly');
    const hidden = await requestResult(
      visibility.objectStore('meta').get(namespaceVisibilityKey(namespace))
    );
    await transactionComplete(visibility);
    if (hidden) return null;
    const transaction = this.database.transaction('documents', 'readonly');
    const value = (await requestResult(
      transaction
        .objectStore('documents')
        .get([namespace, 'calendar', legacyId])
    )) as CalendarDocument | undefined;
    await transactionComplete(transaction);
    return value ?? null;
  }

  async getTombstone(namespace: StorageNamespace, legacyId: string) {
    const transaction = this.database.transaction('tombstones', 'readonly');
    const value = (await requestResult(
      transaction
        .objectStore('tombstones')
        .get([namespace, 'calendar', legacyId])
    )) as CalendarTombstone | undefined;
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
    )) as CalendarOutboxEntry[];
    for (const entry of values.filter(value =>
      matches(value, namespace, campaignId)
    )) {
      if (paused && entry.state !== 'paused') {
        store.put({ ...entry, state: 'paused', pausedFromState: entry.state });
      } else if (!paused && entry.state === 'paused') {
        const { pausedFromState, ...rest } = entry;
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
        CalendarOutboxEntry,
        'state' | 'attemptCount' | 'nextAttemptAt' | 'inflightAt' | 'lastError'
      >
    >
  ) {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    const entry = (await requestResult(store.get(mutationId))) as
      | CalendarOutboxEntry
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
      | CalendarOutboxEntry
      | undefined;
    if (!entry) {
      await completed;
      return;
    }
    const documents = transaction.objectStore('documents');
    const key = [entry.namespace, 'calendar', entry.legacyId];
    const document = (await requestResult(documents.get(key))) as
      | CalendarDocument
      | undefined;
    if (document) {
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
    entry: CalendarOutboxEntry,
    cloudCandidate: unknown
  ) {
    const transaction = this.database.transaction('conflicts', 'readwrite');
    transaction.objectStore('conflicts').put({
      conflictId: `calendar:${entry.namespace}:${entry.campaignId}:${entry.legacyId}:${entry.mutationId}`,
      namespace: entry.namespace,
      campaignId: entry.campaignId,
      family: 'calendar',
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
    payload: CalendarPayload | null;
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
    )) as CalendarOutboxEntry[];
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
      throw new Error('Unresolved local calendar work blocks cloud hydration');
    }
    const store = transaction.objectStore('documents');
    const tombstones = transaction.objectStore('tombstones');
    const key = [input.namespace, 'calendar', input.legacyId];
    const current = (await requestResult(store.get(key))) as
      | CalendarDocument
      | undefined;
    store.put({
      namespace: input.namespace,
      campaignId: input.campaignId,
      legacyId: input.legacyId,
      family: 'calendar',
      cutoverEpoch: input.cutoverEpoch,
      operation: input.tombstoned ? 'delete' : 'replace',
      payload: structuredClone(input.payload),
      schemaVersion: input.schemaVersion,
      localRevision: (current?.localRevision ?? 0) + 1,
      baseServerVersion: input.serverVersion,
      contentFingerprint: input.payloadFingerprint,
      updatedAt: input.acceptedAt,
      deletedAt: input.tombstoned ? input.acceptedAt : null,
    } satisfies CalendarDocument);
    if (input.tombstoned) {
      tombstones.put({
        namespace: input.namespace,
        family: 'calendar',
        campaignId: input.campaignId,
        legacyId: input.legacyId,
        localRevision: (current?.localRevision ?? 0) + 1,
        deletedAt: input.acceptedAt,
        mutationId: `cloud:${input.serverVersion}`,
        beforeImage: current ? structuredClone(current) : null,
      } satisfies CalendarTombstone);
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
      throw new Error('Browser removal requires confirmation');
    const transaction = this.database.transaction(
      ['meta', 'outbox'],
      'readwrite'
    );
    const outbox = (await requestResult(
      transaction.objectStore('outbox').getAll()
    )) as CalendarOutboxEntry[];
    const unresolved = outbox.some(
      entry =>
        entry.namespace === namespace &&
        entry.family === 'calendar' &&
        entry.state !== 'acknowledged' &&
        entry.state !== 'superseded'
    );
    if (unresolved && !options.lossConfirmed) {
      transaction.abort();
      await transactionComplete(transaction).catch(() => undefined);
      throw new Error(
        'Unresolved browser-only work requires explicit loss confirmation'
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
