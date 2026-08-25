import type { CombatLogArchivePayload } from '@/lib/durableDm/combatLogArchiveFamily';
import { COMBAT_LOG_STORAGE_KEY } from '@/utils/constants';

import type { StorageNamespace } from './shadowJournal';
import { requestResult, transactionComplete } from './localDatabase';
import type {
  CombatLogArchiveDocument,
  CombatLogArchiveOutboxEntry,
  CombatLogArchiveTombstoneRow,
} from './combatLogArchiveRepository';

export interface CombatLogArchiveCutoverGates {
  recoveryReceipt: boolean;
  sourceManifestUnchanged: boolean;
  captureVerifiedAfterReopen: boolean;
  manifestConfirmed: boolean;
  noConflicts: boolean;
  noQuarantine: boolean;
  parity: boolean;
  journalEmpty: boolean;
}

export type CombatLogArchiveAuthority =
  | {
      authority: 'indexedDB' | 'postgres';
      namespace: StorageNamespace;
      campaignId: string;
      family: 'combat_log_archive';
      generation: string;
      epoch: number;
      committedAt: string;
    }
  | {
      authority: 'localStorage';
      epoch: number;
      namespace?: StorageNamespace;
      campaignId?: string;
      family?: 'combat_log_archive';
      rollbackGeneration?: string;
      committedAt?: string;
    };

export interface CombatLogArchiveAcceptedVersion {
  legacyId: string;
  serverVersion: number;
  payloadFingerprint: string;
}

export interface CombatLogArchiveEnrollmentDocument {
  legacyId: string;
  payload: CombatLogArchivePayload | null;
  payloadFingerprint: string;
  tombstoned: boolean;
  schemaVersion: number;
  serverVersion: number;
}

function keys(namespace: StorageNamespace, campaignId: string) {
  const scope = `${namespace}:combat_log_archive:${campaignId}`;
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

export async function readCombatLogArchiveAuthority(
  database: IDBDatabase,
  namespace: StorageNamespace,
  campaignId: string
): Promise<CombatLogArchiveAuthority> {
  const scoped = keys(namespace, campaignId);
  const transaction = database.transaction('meta', 'readonly');
  const pointer = (await requestResult(
    transaction.objectStore('meta').get(scoped.pointer)
  )) as (CombatLogArchiveAuthority & { key: string }) | undefined;
  const epoch = (await requestResult(
    transaction.objectStore('meta').get(scoped.epoch)
  )) as { value?: number } | undefined;
  await transactionComplete(transaction);
  if (!pointer) return { authority: 'localStorage', epoch: epoch?.value ?? 0 };
  return withoutStorageKey(pointer) as CombatLogArchiveAuthority;
}

export async function commitCombatLogArchiveLocalCutover(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    generation: string;
    confirmed: boolean;
    gates: CombatLogArchiveCutoverGates;
    now: () => string;
    initialDocuments?: CombatLogArchiveDocument[];
    testHooks?: { abortPointerTransaction?: boolean };
  }
) {
  if (!options.confirmed)
    throw new Error('Combat log archive cutover requires confirmation');
  if (Object.values(options.gates).some(value => !value)) {
    throw new Error('Combat log archive cutover gate is not satisfied');
  }
  const scoped = keys(options.namespace, options.campaignId);
  const transaction = database.transaction(
    ['meta', 'kvGenerations', 'journal', 'documents'],
    'readwrite'
  );
  const completed = transactionComplete(transaction);
  const meta = transaction.objectStore('meta');
  const current = (await requestResult(meta.get(scoped.pointer))) as
    | (CombatLogArchiveAuthority & { key: string })
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
    throw new Error('Combat log archive generation is not CUTOVER_READY');
  }
  const rows = (await requestResult(
    transaction.objectStore('kvGenerations').getAll()
  )) as Array<{ namespace?: string; generation?: string; key?: string }>;
  if (
    !rows.some(
      row =>
        row.namespace === options.namespace &&
        row.generation === options.generation &&
        row.key === COMBAT_LOG_STORAGE_KEY
    )
  ) {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('Combat log archive generation is missing');
  }
  const journal = (await requestResult(
    transaction.objectStore('journal').getAll()
  )) as Array<{ namespace?: string; generation?: string; family?: string }>;
  if (
    journal.some(
      row =>
        row.namespace === options.namespace &&
        row.generation === options.generation &&
        row.family === 'combat_log_archive'
    )
  ) {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('Combat log archive journal is not empty');
  }
  const epochRecord = (await requestResult(meta.get(scoped.epoch))) as
    | { value?: number }
    | undefined;
  const authority = {
    authority: 'indexedDB' as const,
    namespace: options.namespace,
    campaignId: options.campaignId,
    family: 'combat_log_archive' as const,
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
      initial.family !== 'combat_log_archive'
    ) {
      transaction.abort();
      await completed.catch(() => undefined);
      throw new Error(
        'Initial combat log archive document scope does not match cutover'
      );
    }
    documents.put(structuredClone(initial));
  }
  if (options.testHooks?.abortPointerTransaction) transaction.abort();
  try {
    await completed;
  } catch {
    throw new Error('Atomic combat log archive pointer transaction aborted');
  }
  return authority;
}

export async function rollbackCombatLogArchiveLocalAuthority(
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
  if (!options.confirmed)
    throw new Error('Combat log archive rollback requires confirmation');
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
    throw new Error('Stale combat log archive authority epoch');
  }
  const rolledBack = {
    authority: 'localStorage' as const,
    namespace: options.namespace,
    campaignId: options.campaignId,
    family: 'combat_log_archive' as const,
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
function isNewerCombatLogArchiveEntry(
  candidate: CombatLogArchiveOutboxEntry,
  held: CombatLogArchiveOutboxEntry
) {
  return candidate.localRevision === held.localRevision
    ? candidate.updatedAt > held.updatedAt
    : candidate.localRevision > held.localRevision;
}

export async function markCombatLogArchiveCloudAuthority(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    expectedLocalEpoch: number;
    cloudEpoch: number;
    now: () => string;
    acceptedVersions?: CombatLogArchiveAcceptedVersion[];
  }
) {
  const scoped = keys(options.namespace, options.campaignId);
  const transaction = database.transaction(
    ['meta', 'documents', 'outbox'],
    'readwrite'
  );
  const store = transaction.objectStore('meta');
  const current = (await requestResult(store.get(scoped.pointer))) as
    | (CombatLogArchiveAuthority & { key: string })
    | undefined;
  if (
    current?.authority !== 'indexedDB' ||
    current.epoch !== options.expectedLocalEpoch ||
    options.cloudEpoch < current.epoch
  ) {
    transaction.abort();
    await transactionComplete(transaction).catch(() => undefined);
    throw new Error(
      'Local combat log archive authority is not ready for cloud activation'
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
  if (options.acceptedVersions) {
    const accepted = new Map<string, CombatLogArchiveAcceptedVersion>();
    for (const version of options.acceptedVersions) {
      accepted.set(version.legacyId, version);
    }
    const documents = transaction.objectStore('documents');
    for (const version of accepted.values()) {
      const key = [options.namespace, 'combat_log_archive', version.legacyId];
      const document = (await requestResult(documents.get(key))) as
        | CombatLogArchiveDocument
        | undefined;
      if (document)
        documents.put({
          ...document,
          cutoverEpoch: options.cloudEpoch,
          baseServerVersion: version.serverVersion,
        });
    }
    const outbox = transaction.objectStore('outbox');
    const entries = (await requestResult(
      outbox.getAll()
    )) as CombatLogArchiveOutboxEntry[];
    const unresolved = entries.filter(
      entry =>
        entry.namespace === options.namespace &&
        entry.campaignId === options.campaignId &&
        entry.family === 'combat_log_archive' &&
        entry.state !== 'acknowledged' &&
        entry.state !== 'superseded'
    );
    // Paused entries never supersede each other while cloud sync is inactive,
    // so one archive can hold several stale edits. Only the newest may
    // survive: rebasing an older one would block every later cloud hydration.
    const newest = new Map<string, CombatLogArchiveOutboxEntry>();
    for (const entry of unresolved) {
      const held = newest.get(entry.legacyId);
      if (!held || isNewerCombatLogArchiveEntry(entry, held))
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

export async function enrollCombatLogArchiveCloudDevice(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    campaignCode: string;
    deviceId: string;
    epoch: number;
    confirmed: boolean;
    previewFingerprint: string;
    documents: readonly CombatLogArchiveEnrollmentDocument[];
    localCandidate: { rawValue: string; fingerprint: string } | null;
    preserveDivergentCandidate: boolean;
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('New browser enrollment requires confirmation');
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
    | (CombatLogArchiveAuthority & { key: string })
    | undefined;
  if (current && current.authority !== 'localStorage') {
    transaction.abort();
    await completed.catch(() => undefined);
    throw new Error('This browser already has combat log archive authority');
  }
  const committedAt = options.now();
  const authority = {
    authority: 'postgres' as const,
    namespace: options.namespace,
    campaignId: options.campaignId,
    family: 'combat_log_archive' as const,
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
      family: 'combat_log_archive',
      cutoverEpoch: options.epoch,
      operation: document.tombstoned ? 'delete' : 'replace',
      payload: structuredClone(document.payload),
      schemaVersion: document.schemaVersion,
      localRevision: 1,
      // The cloud preview's version and fingerprint are written verbatim: the
      // enrolled device must be byte-identical to what the server reported.
      baseServerVersion: document.serverVersion,
      contentFingerprint: document.payloadFingerprint,
      updatedAt: committedAt,
      deletedAt: document.tombstoned ? committedAt : null,
    } satisfies CombatLogArchiveDocument);
    if (document.tombstoned) {
      tombstones.put({
        namespace: options.namespace,
        family: 'combat_log_archive',
        campaignId: options.campaignId,
        legacyId: document.legacyId,
        localRevision: 1,
        deletedAt: committedAt,
        mutationId: `cloud:${document.serverVersion}`,
        beforeImage: null,
      } satisfies CombatLogArchiveTombstoneRow);
    }
  }
  if (options.localCandidate) {
    transaction.objectStore('conflicts').put({
      conflictId: `combat-log-archive-enrollment:${options.namespace}:${options.campaignId}:${options.deviceId}`,
      namespace: options.namespace,
      campaignId: options.campaignId,
      family: 'combat_log_archive',
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
    key: `device-enrollment:${options.namespace}:combat_log_archive:${options.campaignId}:${options.deviceId}`,
    previewFingerprint: options.previewFingerprint,
    epoch: options.epoch,
    state: 'enrolled',
    committedAt,
  });
  await completed;
  return authority;
}
