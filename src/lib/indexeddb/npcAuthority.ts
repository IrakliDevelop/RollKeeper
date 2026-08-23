import type { NpcPayload } from '@/lib/durableDm/npcFamily';

import type { StorageNamespace } from './shadowJournal';
import { requestResult, transactionComplete } from './localDatabase';
import type {
  NpcDocument,
  NpcOutboxEntry,
  NpcTombstone,
} from './npcRepository';

export interface NpcCutoverGates {
  recoveryReceipt: boolean;
  sourceManifestUnchanged: boolean;
  captureVerifiedAfterReopen: boolean;
  manifestConfirmed: boolean;
  noConflicts: boolean;
  noQuarantine: boolean;
  parity: boolean;
  journalEmpty: boolean;
}

export type NpcAuthority =
  | {
      authority: 'indexedDB' | 'postgres';
      namespace: StorageNamespace;
      campaignId: string;
      family: 'npc';
      generation: string;
      epoch: number;
      committedAt: string;
    }
  | {
      authority: 'localStorage';
      epoch: number;
      namespace?: StorageNamespace;
      campaignId?: string;
      family?: 'npc';
      rollbackGeneration?: string;
      committedAt?: string;
    };

export interface NpcAcceptedVersion {
  legacyId: string;
  serverVersion: number;
  payloadFingerprint: string;
}

export interface NpcEnrollmentDocument {
  legacyId: string;
  payload: NpcPayload | null;
  payloadFingerprint: string;
  tombstoned: boolean;
  schemaVersion: number;
  serverVersion: number;
}

function keys(namespace: StorageNamespace, campaignId: string) {
  const scope = `${namespace}:npc:${campaignId}`;
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

export async function readNpcAuthority(
  database: IDBDatabase,
  namespace: StorageNamespace,
  campaignId: string
): Promise<NpcAuthority> {
  const scoped = keys(namespace, campaignId);
  const transaction = database.transaction('meta', 'readonly');
  const pointer = (await requestResult(
    transaction.objectStore('meta').get(scoped.pointer)
  )) as (NpcAuthority & { key: string }) | undefined;
  const epoch = (await requestResult(
    transaction.objectStore('meta').get(scoped.epoch)
  )) as { value?: number } | undefined;
  await transactionComplete(transaction);
  if (!pointer) return { authority: 'localStorage', epoch: epoch?.value ?? 0 };
  return withoutStorageKey(pointer) as NpcAuthority;
}

export async function commitNpcLocalCutover(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    generation: string;
    confirmed: boolean;
    gates: NpcCutoverGates;
    now: () => string;
    initialDocuments?: NpcDocument[];
    testHooks?: { abortPointerTransaction?: boolean };
  }
) {
  if (!options.confirmed) throw new Error('NPC cutover requires confirmation');
  if (Object.values(options.gates).some(value => !value)) {
    throw new Error('NPC cutover gate is not satisfied');
  }
  const scoped = keys(options.namespace, options.campaignId);
  const transaction = database.transaction(
    ['meta', 'kvGenerations', 'journal', 'documents'],
    'readwrite'
  );
  const completed = transactionComplete(transaction);
  const meta = transaction.objectStore('meta');
  const current = (await requestResult(meta.get(scoped.pointer))) as
    | (NpcAuthority & { key: string })
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
    throw new Error('NPC generation is not CUTOVER_READY');
  }
  const rows = (await requestResult(
    transaction.objectStore('kvGenerations').getAll()
  )) as Array<{ namespace?: string; generation?: string; key?: string }>;
  if (
    !rows.some(
      row =>
        row.namespace === options.namespace &&
        row.generation === options.generation &&
        row.key === 'rollkeeper-npc-data'
    )
  ) {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('NPC generation is missing');
  }
  const journal = (await requestResult(
    transaction.objectStore('journal').getAll()
  )) as Array<{ namespace?: string; generation?: string; family?: string }>;
  if (
    journal.some(
      row =>
        row.namespace === options.namespace &&
        row.generation === options.generation &&
        row.family === 'npc'
    )
  ) {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('NPC journal is not empty');
  }
  const epochRecord = (await requestResult(meta.get(scoped.epoch))) as
    | { value?: number }
    | undefined;
  const authority = {
    authority: 'indexedDB' as const,
    namespace: options.namespace,
    campaignId: options.campaignId,
    family: 'npc' as const,
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
  const documents = transaction.objectStore('documents');
  for (const initial of options.initialDocuments ?? []) {
    if (
      initial.namespace !== options.namespace ||
      initial.campaignId !== options.campaignId ||
      initial.family !== 'npc'
    ) {
      transaction.abort();
      await completed.catch(() => undefined);
      throw new Error('Initial NPC document scope does not match cutover');
    }
    documents.put(structuredClone(initial));
  }
  if (options.testHooks?.abortPointerTransaction) transaction.abort();
  try {
    await completed;
  } catch {
    throw new Error('Atomic NPC pointer transaction aborted');
  }
  return authority;
}

export async function rollbackNpcLocalAuthority(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    expectedEpoch: number;
    generation: string;
    confirmed: boolean;
    currentGenerationVerified: boolean;
    now: () => string;
  }
) {
  if (!options.confirmed) throw new Error('NPC rollback requires confirmation');
  if (!options.currentGenerationVerified)
    throw new Error('A verified current generation is required');
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
    throw new Error('Stale NPC authority epoch');
  }
  const rolledBack = {
    authority: 'localStorage' as const,
    namespace: options.namespace,
    campaignId: options.campaignId,
    family: 'npc' as const,
    rollbackGeneration: options.generation,
    epoch: options.expectedEpoch + 1,
    committedAt: options.now(),
  };
  store.put({ key: scoped.pointer, ...rolledBack });
  store.put({ key: scoped.epoch, value: rolledBack.epoch });
  await transactionComplete(transaction);
  return rolledBack;
}

/** Newest wins by local revision, then by the later local timestamp. */
function isNewerNpcEntry(candidate: NpcOutboxEntry, held: NpcOutboxEntry) {
  return candidate.localRevision === held.localRevision
    ? candidate.updatedAt > held.updatedAt
    : candidate.localRevision > held.localRevision;
}

export async function markNpcCloudAuthority(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    expectedLocalEpoch: number;
    cloudEpoch: number;
    now: () => string;
    acceptedVersions?: NpcAcceptedVersion[];
  }
) {
  const scoped = keys(options.namespace, options.campaignId);
  const transaction = database.transaction(
    ['meta', 'documents', 'outbox'],
    'readwrite'
  );
  const store = transaction.objectStore('meta');
  const current = (await requestResult(store.get(scoped.pointer))) as
    | (NpcAuthority & { key: string })
    | undefined;
  if (
    current?.authority !== 'indexedDB' ||
    current.epoch !== options.expectedLocalEpoch ||
    options.cloudEpoch < current.epoch
  ) {
    transaction.abort();
    await transactionComplete(transaction).catch(() => undefined);
    throw new Error('Local NPC authority is not ready for cloud activation');
  }
  const authority = {
    ...current,
    authority: 'postgres' as const,
    epoch: options.cloudEpoch,
    committedAt: options.now(),
  };
  store.put(authority);
  store.put({ key: scoped.epoch, value: authority.epoch });
  if (options.acceptedVersions) {
    const accepted = new Map<string, NpcAcceptedVersion>();
    for (const version of options.acceptedVersions) {
      accepted.set(version.legacyId, version);
    }
    const documents = transaction.objectStore('documents');
    for (const version of accepted.values()) {
      const key = [options.namespace, 'npc', version.legacyId];
      const document = (await requestResult(documents.get(key))) as
        | NpcDocument
        | undefined;
      if (document)
        documents.put({
          ...document,
          cutoverEpoch: options.cloudEpoch,
          baseServerVersion: version.serverVersion,
        });
    }
    const outbox = transaction.objectStore('outbox');
    const entries = (await requestResult(outbox.getAll())) as NpcOutboxEntry[];
    const unresolved = entries.filter(
      entry =>
        entry.namespace === options.namespace &&
        entry.campaignId === options.campaignId &&
        entry.family === 'npc' &&
        entry.state !== 'acknowledged' &&
        entry.state !== 'superseded'
    );
    // Paused entries never supersede each other while cloud sync is inactive,
    // so one NPC can hold several stale edits. Only the newest may survive:
    // rebasing an older one would block every later cloud hydration.
    const newest = new Map<string, NpcOutboxEntry>();
    for (const entry of unresolved) {
      const held = newest.get(entry.legacyId);
      if (!held || isNewerNpcEntry(entry, held))
        newest.set(entry.legacyId, entry);
    }
    for (const entry of unresolved) {
      if (newest.get(entry.legacyId)?.mutationId !== entry.mutationId) {
        outbox.put({
          ...entry,
          state: 'superseded',
          inflightAt: null,
          lastError: null,
        });
      } else {
        const match = accepted.get(entry.legacyId);
        if (entry.contentFingerprint === match?.payloadFingerprint) {
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
            baseServerVersion: match?.serverVersion ?? entry.baseServerVersion,
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

export async function enrollNpcCloudDevice(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    campaignCode: string;
    deviceId: string;
    epoch: number;
    confirmed: boolean;
    previewFingerprint: string;
    documents: readonly NpcEnrollmentDocument[];
    localCandidate: { rawValue: string; fingerprint: string } | null;
    preserveDivergentCandidate: boolean;
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('New device enrollment requires confirmation');
  if (
    options.epoch < 1 ||
    options.documents.some(document => document.serverVersion < 1)
  ) {
    throw new Error('A durable cloud generation is required');
  }
  if (options.localCandidate && !options.preserveDivergentCandidate) {
    throw new Error('The local candidate must be preserved before enrollment');
  }
  const scoped = keys(options.namespace, options.campaignId);
  const transaction = database.transaction(
    ['meta', 'documents', 'tombstones', 'conflicts'],
    'readwrite'
  );
  const completed = transactionComplete(transaction);
  const meta = transaction.objectStore('meta');
  const current = (await requestResult(meta.get(scoped.pointer))) as
    | (NpcAuthority & { key: string })
    | undefined;
  if (current && current.authority !== 'localStorage') {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('This device already has NPC authority');
  }
  const committedAt = options.now();
  const authority = {
    authority: 'postgres' as const,
    namespace: options.namespace,
    campaignId: options.campaignId,
    family: 'npc' as const,
    generation: `cloud-enrollment:${options.deviceId}`,
    epoch: options.epoch,
    committedAt,
  };
  const documents = transaction.objectStore('documents');
  const tombstones = transaction.objectStore('tombstones');
  for (const document of options.documents) {
    documents.put({
      namespace: options.namespace,
      campaignId: options.campaignId,
      legacyId: document.legacyId,
      family: 'npc',
      cutoverEpoch: options.epoch,
      operation: document.tombstoned ? 'delete' : 'replace',
      payload: structuredClone(document.payload),
      schemaVersion: document.schemaVersion,
      localRevision: 1,
      baseServerVersion: document.serverVersion,
      contentFingerprint: document.payloadFingerprint,
      updatedAt: committedAt,
      deletedAt: document.tombstoned ? committedAt : null,
    } satisfies NpcDocument);
    if (document.tombstoned) {
      tombstones.put({
        namespace: options.namespace,
        family: 'npc',
        campaignId: options.campaignId,
        legacyId: document.legacyId,
        localRevision: 1,
        deletedAt: committedAt,
        mutationId: `cloud:${document.serverVersion}`,
        beforeImage: null,
      } satisfies NpcTombstone);
    }
  }
  if (options.localCandidate) {
    transaction.objectStore('conflicts').put({
      conflictId: `npc-enrollment:${options.namespace}:${options.campaignId}:${options.deviceId}`,
      namespace: options.namespace,
      campaignId: options.campaignId,
      family: 'npc',
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
    key: `device-enrollment:${options.namespace}:npc:${options.campaignId}:${options.deviceId}`,
    previewFingerprint: options.previewFingerprint,
    epoch: options.epoch,
    state: 'enrolled',
    committedAt,
  });
  await completed;
  return authority;
}
