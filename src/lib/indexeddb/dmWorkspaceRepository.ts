import type { StorageNamespace } from './shadowJournal';
import { requestResult, transactionComplete } from './localDatabase';

export type DmWorkspaceCreationKind = 'new_workspace' | 'import_fork';
export type DmWorkspaceWorkState =
  | 'queued'
  | 'inflight'
  | 'offline'
  | 'auth-required'
  | 'retry'
  | 'failed';

export interface DmWorkspaceCreateIntent {
  namespace: StorageNamespace;
  localId: string;
  name: string;
  creationKind: DmWorkspaceCreationKind;
  sourceFingerprint: string | null;
  createdAt: string;
}

export interface DmWorkspaceDocument extends DmWorkspaceCreateIntent {
  family: 'workspace_identity';
  legacyId: string;
  cloudId: string | null;
  displayCode: string | null;
  membershipAuthority: 'legacy';
  familyAuthorities: 'legacy';
  liveRuntimeAuthority: 'redis_relay';
  acknowledgedAt: string | null;
}

export interface DmWorkspaceOutboxEntry extends DmWorkspaceCreateIntent {
  mutationId: string;
  family: 'workspace_identity';
  state: DmWorkspaceWorkState;
  lastError: string | null;
}

export interface DmWorkspaceAcknowledgement {
  campaignId: string;
  displayCode: string;
  membershipAuthority: 'legacy';
  familyAuthorities: 'legacy';
  liveRuntimeAuthority: 'redis_relay';
}

interface DmWorkspaceRepositoryOptions {
  randomId?: () => string;
  beforeCommit?: () => void;
}

export class IndexedDbDmWorkspaceRepository {
  private readonly randomId: () => string;

  constructor(
    private readonly database: IDBDatabase,
    private readonly options: DmWorkspaceRepositoryOptions = {}
  ) {
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
  }

  async commitCreate(
    intent: DmWorkspaceCreateIntent
  ): Promise<
    | { saved: true; mutationId: string }
    | { saved: false; reason: 'guest' | 'failed' }
  > {
    if (intent.namespace === 'guest') {
      return { saved: false, reason: 'guest' };
    }
    const mutationId = this.randomId();
    const transaction = this.database.transaction(
      ['documents', 'outbox'],
      'readwrite'
    );
    const completed = transactionComplete(transaction);
    try {
      this.options.beforeCommit?.();
      transaction.objectStore('documents').put({
        ...structuredClone(intent),
        family: 'workspace_identity',
        legacyId: intent.localId,
        cloudId: null,
        displayCode: null,
        membershipAuthority: 'legacy',
        familyAuthorities: 'legacy',
        liveRuntimeAuthority: 'redis_relay',
        acknowledgedAt: null,
      } satisfies DmWorkspaceDocument);
      transaction.objectStore('outbox').put({
        ...structuredClone(intent),
        mutationId,
        family: 'workspace_identity',
        state: 'queued',
        lastError: null,
      } satisfies DmWorkspaceOutboxEntry);
      await completed;
      return { saved: true, mutationId };
    } catch {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have failed.
      }
      await completed.catch(() => undefined);
      return { saved: false, reason: 'failed' };
    }
  }

  async acknowledge(
    mutationId: string,
    acknowledgement: DmWorkspaceAcknowledgement,
    testHooks: { abortTransaction?: boolean } = {}
  ): Promise<void> {
    const transaction = this.database.transaction(
      ['documents', 'outbox'],
      'readwrite'
    );
    const completed = transactionComplete(transaction);
    const outbox = transaction.objectStore('outbox');
    const entry = (await requestResult(outbox.get(mutationId))) as
      | DmWorkspaceOutboxEntry
      | undefined;
    if (!entry) {
      await completed;
      return;
    }
    transaction.objectStore('documents').put({
      namespace: entry.namespace,
      localId: entry.localId,
      legacyId: entry.localId,
      name: entry.name,
      creationKind: entry.creationKind,
      sourceFingerprint: entry.sourceFingerprint,
      createdAt: entry.createdAt,
      family: 'workspace_identity',
      cloudId: acknowledgement.campaignId,
      displayCode: acknowledgement.displayCode,
      membershipAuthority: acknowledgement.membershipAuthority,
      familyAuthorities: acknowledgement.familyAuthorities,
      liveRuntimeAuthority: acknowledgement.liveRuntimeAuthority,
      acknowledgedAt: new Date().toISOString(),
    } satisfies DmWorkspaceDocument);
    outbox.delete(mutationId);
    if (testHooks.abortTransaction) transaction.abort();
    await completed;
  }

  async updateWork(
    mutationId: string,
    updates: Pick<DmWorkspaceOutboxEntry, 'state' | 'lastError'>
  ): Promise<void> {
    const transaction = this.database.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    const entry = (await requestResult(store.get(mutationId))) as
      | DmWorkspaceOutboxEntry
      | undefined;
    if (entry) store.put({ ...entry, ...updates });
    await transactionComplete(transaction);
  }

  async get(
    namespace: StorageNamespace,
    localId: string
  ): Promise<DmWorkspaceDocument | null> {
    const transaction = this.database.transaction('documents', 'readonly');
    const value = (await requestResult(
      transaction
        .objectStore('documents')
        .get([namespace, 'workspace_identity', localId])
    )) as DmWorkspaceDocument | undefined;
    await transactionComplete(transaction);
    return value ?? null;
  }

  async list(namespace: StorageNamespace): Promise<DmWorkspaceDocument[]> {
    const transaction = this.database.transaction('documents', 'readonly');
    const values = (await requestResult(
      transaction.objectStore('documents').getAll()
    )) as DmWorkspaceDocument[];
    await transactionComplete(transaction);
    return values.filter(
      value =>
        value.namespace === namespace && value.family === 'workspace_identity'
    );
  }

  async listOutbox(
    namespace: StorageNamespace
  ): Promise<DmWorkspaceOutboxEntry[]> {
    const transaction = this.database.transaction('outbox', 'readonly');
    const values = (await requestResult(
      transaction.objectStore('outbox').getAll()
    )) as DmWorkspaceOutboxEntry[];
    await transactionComplete(transaction);
    return values.filter(
      value =>
        value.namespace === namespace && value.family === 'workspace_identity'
    );
  }
}
