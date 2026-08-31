import type { StorageNamespace } from './shadowJournal';
import { requestResult, transactionComplete } from './localDatabase';
import type {
  CampaignSettingsDocument,
  CampaignSettingsOutboxEntry,
} from './campaignSettingsRepository';
import type { Json } from '@/types/database.generated';

export interface CampaignSettingsCutoverGates {
  recoveryReceipt: boolean;
  sourceManifestUnchanged: boolean;
  captureVerifiedAfterReopen: boolean;
  manifestConfirmed: boolean;
  noConflicts: boolean;
  noQuarantine: boolean;
  parity: boolean;
  journalEmpty: boolean;
}

export type CampaignSettingsAuthority =
  | {
      authority: 'indexedDB' | 'postgres';
      namespace: StorageNamespace;
      campaignId: string;
      family: 'campaign_settings';
      generation: string;
      epoch: number;
      committedAt: string;
    }
  | {
      authority: 'localStorage';
      epoch: number;
      namespace?: StorageNamespace;
      campaignId?: string;
      family?: 'campaign_settings';
      rollbackGeneration?: string;
      committedAt?: string;
    };

function keys(namespace: StorageNamespace, campaignId: string) {
  const scope = `${namespace}:campaign_settings:${campaignId}`;
  return {
    pointer: `active-generation:${scope}`,
    epoch: `cutover-epoch:${scope}`,
    state: `migration-state:${scope}`,
  };
}

function withoutStorageKey<T extends { key: string }>(
  value: T
): Omit<T, 'key'> {
  const copy: Partial<T> = { ...value };
  delete copy.key;
  return copy as Omit<T, 'key'>;
}

export async function readCampaignSettingsAuthority(
  database: IDBDatabase,
  namespace: StorageNamespace,
  campaignId: string
): Promise<CampaignSettingsAuthority> {
  const scoped = keys(namespace, campaignId);
  const transaction = database.transaction('meta', 'readonly');
  const pointer = (await requestResult(
    transaction.objectStore('meta').get(scoped.pointer)
  )) as (CampaignSettingsAuthority & { key: string }) | undefined;
  const epoch = (await requestResult(
    transaction.objectStore('meta').get(scoped.epoch)
  )) as { value?: number } | undefined;
  await transactionComplete(transaction);
  if (!pointer) return { authority: 'localStorage', epoch: epoch?.value ?? 0 };
  return withoutStorageKey(pointer) as CampaignSettingsAuthority;
}

export async function commitCampaignSettingsLocalCutover(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    generation: string;
    confirmed: boolean;
    gates: CampaignSettingsCutoverGates;
    now: () => string;
    initialDocument?: CampaignSettingsDocument;
    testHooks?: { abortPointerTransaction?: boolean };
  }
) {
  if (!options.confirmed)
    throw new Error('Campaign settings cutover requires confirmation');
  if (Object.values(options.gates).some(value => !value)) {
    throw new Error('Campaign settings cutover gate is not satisfied');
  }
  const scoped = keys(options.namespace, options.campaignId);
  const transaction = database.transaction(
    ['meta', 'kvGenerations', 'journal', 'documents'],
    'readwrite'
  );
  const completed = transactionComplete(transaction);
  const meta = transaction.objectStore('meta');
  const current = (await requestResult(meta.get(scoped.pointer))) as
    | (CampaignSettingsAuthority & { key: string })
    | undefined;
  if (current?.authority === 'indexedDB') {
    await completed;
    return withoutStorageKey(current);
  }
  const state = (await requestResult(meta.get(scoped.state))) as
    | { state?: string; runId?: string }
    | undefined;
  if (state?.state !== 'CUTOVER_READY' || state.runId !== options.generation) {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('Campaign settings generation is not CUTOVER_READY');
  }
  const rows = (await requestResult(
    transaction.objectStore('kvGenerations').getAll()
  )) as Array<{ namespace?: string; generation?: string; key?: string }>;
  if (
    !rows.some(
      row =>
        row.namespace === options.namespace &&
        row.generation === options.generation &&
        row.key === 'rollkeeper-dm-data'
    )
  ) {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('Campaign settings generation is missing');
  }
  const journal = (await requestResult(
    transaction.objectStore('journal').getAll()
  )) as Array<{ namespace?: string; generation?: string; family?: string }>;
  if (
    journal.some(
      row =>
        row.namespace === options.namespace &&
        row.generation === options.generation &&
        row.family === 'campaign_settings'
    )
  ) {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('Campaign settings journal is not empty');
  }
  const epochRecord = (await requestResult(meta.get(scoped.epoch))) as
    | { value?: number }
    | undefined;
  const authority = {
    authority: 'indexedDB' as const,
    namespace: options.namespace,
    campaignId: options.campaignId,
    family: 'campaign_settings' as const,
    generation: options.generation,
    epoch: (epochRecord?.value ?? 0) + 1,
    committedAt: options.now(),
  };
  meta.put({ key: scoped.pointer, ...authority });
  meta.put({ key: scoped.epoch, value: authority.epoch });
  meta.put({
    ...state,
    key: scoped.state,
    state: 'IDB_PRIMARY',
    checkpointAt: authority.committedAt,
  });
  if (options.initialDocument) {
    if (
      options.initialDocument.namespace !== options.namespace ||
      options.initialDocument.campaignId !== options.campaignId ||
      options.initialDocument.family !== 'campaign_settings'
    ) {
      transaction.abort();
      await completed.catch(() => undefined);
      throw new Error(
        'Initial campaign settings document scope does not match cutover'
      );
    }
    transaction
      .objectStore('documents')
      .put(structuredClone(options.initialDocument));
  }
  if (options.testHooks?.abortPointerTransaction) transaction.abort();
  try {
    await completed;
  } catch {
    throw new Error('Atomic campaign settings pointer transaction aborted');
  }
  return authority;
}

export async function rollbackCampaignSettingsLocalAuthority(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    expectedEpoch: number;
    generation: string;
    confirmed: boolean;
    currentGenerationVerified: boolean;
    projectionJournalReconciled: boolean;
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('Campaign settings rollback requires confirmation');
  if (!options.currentGenerationVerified)
    throw new Error('A verified current generation is required');
  if (!options.projectionJournalReconciled)
    throw new Error('Projection journal reconciliation is required');
  const scoped = keys(options.namespace, options.campaignId);
  const transaction = database.transaction('meta', 'readwrite');
  const store = transaction.objectStore('meta');
  const current = (await requestResult(store.get(scoped.pointer))) as
    | { authority?: string; epoch?: number; generation?: string }
    | undefined;
  if (
    (current?.authority !== 'indexedDB' && current?.authority !== 'postgres') ||
    current.epoch !== options.expectedEpoch ||
    current.generation !== options.generation
  ) {
    transaction.abort();
    await transactionComplete(transaction).catch(() => undefined);
    throw new Error('Stale campaign settings authority epoch');
  }
  const rolledBack = {
    authority: 'localStorage' as const,
    namespace: options.namespace,
    campaignId: options.campaignId,
    family: 'campaign_settings' as const,
    rollbackGeneration: options.generation,
    epoch: options.expectedEpoch + 1,
    committedAt: options.now(),
  };
  store.put({ key: scoped.pointer, ...rolledBack });
  store.put({ key: scoped.epoch, value: rolledBack.epoch });
  await transactionComplete(transaction);
  return rolledBack;
}

export async function markCampaignSettingsCloudAuthority(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    expectedLocalEpoch: number;
    cloudEpoch: number;
    now: () => string;
    acceptedVersion?: {
      legacyId: string;
      serverVersion: number;
      payloadFingerprint: string;
    };
  }
) {
  const scoped = keys(options.namespace, options.campaignId);
  const transaction = database.transaction(
    ['meta', 'documents', 'outbox'],
    'readwrite'
  );
  const store = transaction.objectStore('meta');
  const current = (await requestResult(store.get(scoped.pointer))) as
    | (CampaignSettingsAuthority & { key: string })
    | undefined;
  if (
    current?.authority !== 'indexedDB' ||
    current.epoch !== options.expectedLocalEpoch ||
    options.cloudEpoch < current.epoch
  ) {
    transaction.abort();
    await transactionComplete(transaction).catch(() => undefined);
    throw new Error(
      'Local campaign settings authority is not ready for cloud activation'
    );
  }
  const authority = {
    ...current,
    authority: 'postgres' as const,
    epoch: options.cloudEpoch,
    committedAt: options.now(),
  };
  store.put(authority);
  store.put({ key: scoped.epoch, value: authority.epoch });
  if (options.acceptedVersion) {
    const documents = transaction.objectStore('documents');
    const key = [
      options.namespace,
      'campaign_settings',
      options.acceptedVersion.legacyId,
    ];
    const document = (await requestResult(documents.get(key))) as
      | CampaignSettingsDocument
      | undefined;
    const workingCopyMatchesAccepted =
      document?.contentFingerprint ===
      options.acceptedVersion.payloadFingerprint;
    if (document)
      documents.put({
        ...document,
        cutoverEpoch: options.cloudEpoch,
        baseServerVersion: options.acceptedVersion.serverVersion,
      });
    const outbox = transaction.objectStore('outbox');
    const entries = (await requestResult(
      outbox.getAll()
    )) as CampaignSettingsOutboxEntry[];
    for (const entry of entries) {
      if (
        entry.namespace === options.namespace &&
        entry.campaignId === options.campaignId &&
        entry.family === 'campaign_settings' &&
        entry.legacyId === options.acceptedVersion.legacyId &&
        entry.state !== 'acknowledged' &&
        entry.state !== 'superseded'
      ) {
        if (
          workingCopyMatchesAccepted ||
          entry.contentFingerprint ===
            options.acceptedVersion.payloadFingerprint
        ) {
          outbox.put({
            ...entry,
            state: 'superseded',
            inflightAt: null,
            lastError: null,
          });
        } else {
          outbox.put({
            ...entry,
            cutoverEpoch: options.cloudEpoch,
            baseServerVersion: options.acceptedVersion.serverVersion,
            state:
              entry.state === 'paused'
                ? (entry.pausedFromState ?? 'queued')
                : entry.state,
            inflightAt: null,
            lastError: null,
          });
        }
      }
    }
  }
  await transactionComplete(transaction);
  return withoutStorageKey(authority);
}

export async function enrollCampaignSettingsCloudDevice(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    campaignCode: string;
    deviceId: string;
    epoch: number;
    confirmed: boolean;
    previewFingerprint: string;
    payloadFingerprint: string;
    payload: Json | null;
    tombstoned?: boolean;
    schemaVersion: number;
    serverVersion: number;
    localCandidate: { rawValue: string; fingerprint: string } | null;
    preserveDivergentCandidate: boolean;
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('New browser enrollment requires confirmation');
  if (options.epoch < 1 || options.serverVersion < 1) {
    throw new Error('A durable cloud generation is required');
  }
  if (options.localCandidate && !options.preserveDivergentCandidate) {
    throw new Error('The local candidate must be preserved before enrollment');
  }
  const scoped = keys(options.namespace, options.campaignId);
  const transaction = database.transaction(
    ['meta', 'documents', 'conflicts'],
    'readwrite'
  );
  const completed = transactionComplete(transaction);
  const meta = transaction.objectStore('meta');
  const current = (await requestResult(meta.get(scoped.pointer))) as
    | (CampaignSettingsAuthority & { key: string })
    | undefined;
  if (current && current.authority !== 'localStorage') {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('This browser already has campaign settings authority');
  }
  const committedAt = options.now();
  const authority = {
    authority: 'postgres' as const,
    namespace: options.namespace,
    campaignId: options.campaignId,
    family: 'campaign_settings' as const,
    generation: `cloud-enrollment:${options.deviceId}`,
    epoch: options.epoch,
    committedAt,
  };
  transaction.objectStore('documents').put({
    namespace: options.namespace,
    campaignId: options.campaignId,
    legacyId: options.campaignCode,
    family: 'campaign_settings',
    cutoverEpoch: options.epoch,
    operation: options.tombstoned ? 'delete' : 'replace',
    payload: structuredClone(options.payload),
    schemaVersion: options.schemaVersion,
    localRevision: 1,
    baseServerVersion: options.serverVersion,
    contentFingerprint: options.payloadFingerprint,
    updatedAt: committedAt,
    deletedAt: options.tombstoned ? committedAt : null,
  } satisfies CampaignSettingsDocument);
  if (options.localCandidate) {
    transaction.objectStore('conflicts').put({
      conflictId: `campaign-settings-enrollment:${options.namespace}:${options.campaignId}:${options.deviceId}`,
      namespace: options.namespace,
      campaignId: options.campaignId,
      family: 'campaign_settings',
      legacyId: options.campaignCode,
      kind: 'preserved-device-legacy-candidate',
      rawValue: options.localCandidate.rawValue,
      rawFingerprint: options.localCandidate.fingerprint,
      cloudPreviewFingerprint: options.previewFingerprint,
      resolutionState: 'preserved',
      detectedAt: committedAt,
    });
  }
  meta.put({ key: scoped.pointer, ...authority });
  meta.put({ key: scoped.epoch, value: authority.epoch });
  meta.put({
    key: `device-enrollment:${options.namespace}:campaign_settings:${options.campaignId}:${options.deviceId}`,
    previewFingerprint: options.previewFingerprint,
    epoch: options.epoch,
    state: 'enrolled',
    committedAt,
  });
  await completed;
  return authority;
}
