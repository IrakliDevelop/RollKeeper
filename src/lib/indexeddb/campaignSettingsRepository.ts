import type { Json } from '@/types/database.generated';

import type { StorageNamespace } from './shadowJournal';
import { requestResult, transactionComplete } from './localDatabase';

export type CampaignSettingsOperation = 'create' | 'replace' | 'delete';
export type CampaignSettingsWorkState =
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

export interface CampaignSettingsMutation {
  namespace: StorageNamespace;
  campaignId: string;
  legacyId: string;
  cutoverEpoch: number;
  operation: CampaignSettingsOperation;
  payload: Json | null;
  schemaVersion: number;
  localRevision: number;
  baseServerVersion: number;
  contentFingerprint: string;
  updatedAt: string;
}

export interface CampaignSettingsDocument extends CampaignSettingsMutation {
  family: 'campaign_settings';
  deletedAt: string | null;
}

export interface CampaignSettingsOutboxEntry extends CampaignSettingsMutation {
  family: 'campaign_settings';
  mutationId: string;
  state: CampaignSettingsWorkState;
  attemptCount: number;
  nextAttemptAt: number;
  inflightAt: string | null;
  lastError: string | null;
  pausedFromState?: Exclude<CampaignSettingsWorkState, 'paused'>;
}

export interface CampaignSettingsTombstone {
  namespace: StorageNamespace;
  family: 'campaign_settings';
  campaignId: string;
  legacyId: string;
  localRevision: number;
  deletedAt: string;
  mutationId: string;
  beforeImage: CampaignSettingsDocument | null;
}

interface RepositoryOptions {
  randomId?: () => string;
  beforeCommit?: () => void;
}

function namespaceVisibilityKey(namespace: StorageNamespace): string {
  return `account-namespace-visibility:${namespace}`;
}

function matches(
  entry: Pick<
    CampaignSettingsOutboxEntry,
    'namespace' | 'campaignId' | 'family'
  >,
  namespace: StorageNamespace,
  campaignId: string
) {
  return (
    entry.namespace === namespace &&
    entry.campaignId === campaignId &&
    entry.family === 'campaign_settings'
  );
}

export class IndexedDbCampaignSettingsRepository {
  private readonly randomId: () => string;

  constructor(
    private readonly database: IDBDatabase,
    private readonly options: RepositoryOptions = {}
  ) {
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
  }

  async commit(
    mutation: CampaignSettingsMutation,
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
      const key = [mutation.namespace, 'campaign_settings', mutation.legacyId];
      const documents = transaction.objectStore('documents');
      const outbox = transaction.objectStore('outbox');
      const tombstones = transaction.objectStore('tombstones');
      const [current, tombstone, pending] = await Promise.all([
        requestResult(documents.get(key)) as Promise<
          CampaignSettingsDocument | undefined
        >,
        requestResult(tombstones.get(key)) as Promise<
          CampaignSettingsTombstone | undefined
        >,
        requestResult(outbox.getAll()) as Promise<
          CampaignSettingsOutboxEntry[]
        >,
      ]);
      if (mutation.operation !== 'delete' && tombstone) {
        await completed;
        return { saved: false, reason: 'tombstoned' };
      }
      this.options.beforeCommit?.();
      for (const entry of pending) {
        if (
          // A newer revision is the user's explicit replacement for any
          // unsent predecessor. Keep inflight and conflict work visible, but
          // do not let a recoverable network/auth failure poison hydration.
          (entry.state === 'queued' ||
            entry.state === 'retry' ||
            entry.state === 'auth-required' ||
            entry.state === 'paused') &&
          entry.namespace === mutation.namespace &&
          entry.campaignId === mutation.campaignId &&
          entry.legacyId === mutation.legacyId &&
          entry.family === 'campaign_settings'
        ) {
          outbox.put({
            ...entry,
            state: 'superseded',
            lastError: null,
            inflightAt: null,
          });
        }
      }
      const document: CampaignSettingsDocument = {
        ...structuredClone(mutation),
        family: 'campaign_settings',
        deletedAt: mutation.operation === 'delete' ? mutation.updatedAt : null,
      };
      documents.put(document);
      if (mutation.operation === 'delete') {
        tombstones.put({
          namespace: mutation.namespace,
          family: 'campaign_settings',
          campaignId: mutation.campaignId,
          legacyId: mutation.legacyId,
          localRevision: mutation.localRevision,
          deletedAt: mutation.updatedAt,
          mutationId,
          beforeImage: current ? structuredClone(current) : null,
        } satisfies CampaignSettingsTombstone);
      }
      outbox.put({
        ...structuredClone(mutation),
        family: 'campaign_settings',
        mutationId,
        state: 'queued',
        attemptCount: 0,
        nextAttemptAt: 0,
        inflightAt: null,
        lastError: null,
      } satisfies CampaignSettingsOutboxEntry);
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
    )) as CampaignSettingsOutboxEntry[];
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
        .get([namespace, 'campaign_settings', legacyId])
    )) as CampaignSettingsDocument | undefined;
    await transactionComplete(transaction);
    return value ?? null;
  }

  async getTombstone(namespace: StorageNamespace, legacyId: string) {
    const transaction = this.database.transaction('tombstones', 'readonly');
    const value = (await requestResult(
      transaction
        .objectStore('tombstones')
        .get([namespace, 'campaign_settings', legacyId])
    )) as CampaignSettingsTombstone | undefined;
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
    )) as CampaignSettingsOutboxEntry[];
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
        CampaignSettingsOutboxEntry,
        'state' | 'attemptCount' | 'nextAttemptAt' | 'inflightAt' | 'lastError'
      >
    >
  ) {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    const entry = (await requestResult(store.get(mutationId))) as
      | CampaignSettingsOutboxEntry
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
      ['documents', 'outbox'],
      'readwrite'
    );
    const completed = transactionComplete(transaction);
    const outbox = transaction.objectStore('outbox');
    const entry = (await requestResult(outbox.get(mutationId))) as
      | CampaignSettingsOutboxEntry
      | undefined;
    if (!entry) {
      await completed;
      return;
    }
    const documents = transaction.objectStore('documents');
    const key = [entry.namespace, 'campaign_settings', entry.legacyId];
    const document = (await requestResult(documents.get(key))) as
      | CampaignSettingsDocument
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
    entry: CampaignSettingsOutboxEntry,
    cloudCandidate: unknown
  ) {
    const transaction = this.database.transaction('conflicts', 'readwrite');
    transaction.objectStore('conflicts').put({
      conflictId: `campaign-settings:${entry.namespace}:${entry.campaignId}:${entry.legacyId}:${entry.mutationId}`,
      namespace: entry.namespace,
      campaignId: entry.campaignId,
      family: 'campaign_settings',
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
    payload: Json | null;
    payloadFingerprint: string;
    tombstoned: boolean;
    acceptedAt: string;
  }) {
    const transaction = this.database.transaction(
      ['documents', 'outbox'],
      'readwrite'
    );
    const completed = transactionComplete(transaction);
    const outbox = (await requestResult(
      transaction.objectStore('outbox').getAll()
    )) as CampaignSettingsOutboxEntry[];
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
        'Unresolved local campaign settings work blocks cloud hydration'
      );
    }
    const store = transaction.objectStore('documents');
    const key = [input.namespace, 'campaign_settings', input.legacyId];
    const current = (await requestResult(store.get(key))) as
      | CampaignSettingsDocument
      | undefined;
    store.put({
      namespace: input.namespace,
      campaignId: input.campaignId,
      legacyId: input.legacyId,
      family: 'campaign_settings',
      cutoverEpoch: input.cutoverEpoch,
      operation: input.tombstoned ? 'delete' : 'replace',
      payload: structuredClone(input.payload),
      schemaVersion: input.schemaVersion,
      localRevision: (current?.localRevision ?? 0) + 1,
      baseServerVersion: input.serverVersion,
      contentFingerprint: input.payloadFingerprint,
      updatedAt: input.acceptedAt,
      deletedAt: input.tombstoned ? input.acceptedAt : null,
    } satisfies CampaignSettingsDocument);
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
    )) as CampaignSettingsOutboxEntry[];
    const unresolved = outbox.some(
      entry =>
        entry.namespace === namespace &&
        entry.family === 'campaign_settings' &&
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
