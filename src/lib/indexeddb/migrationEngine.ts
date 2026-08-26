import {
  captureLegacySources,
  LEGACY_EXACT_KEYS,
  type SourceManifest,
  verifyPersistedCapture,
} from '@/lib/indexeddb/migrationCapture';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import {
  assertMigrationTransition,
  type MigrationState,
} from '@/lib/indexeddb/migrationState';
import { withMigrationLock } from '@/lib/indexeddb/migrationLock';
import {
  IndexedDbShadowJournalRepository,
  ShadowWriteCoordinator,
  type StorageNamespace,
} from '@/lib/indexeddb/shadowJournal';
import {
  transformCapturedSnapshot,
  validateLegacyEnvelope,
} from '@/lib/indexeddb/migrationValidation';

export class MigrationInterruptedError extends Error {
  constructor(readonly checkpoint: MigrationState) {
    super(`Migration interrupted after checkpoint: ${checkpoint}`);
    this.name = 'MigrationInterruptedError';
  }
}

interface CapacityManager {
  requestCapacity?: (bytes: number) => Promise<boolean>;
  estimate?: () => Promise<{ quota?: number; usage?: number }>;
  persist?: () => Promise<boolean>;
}

interface RecoveryGate {
  hasDownloadReceipt(manifestHash: string): Promise<boolean>;
}

interface WebLockProvider {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T>;
}

export interface RunIndexedDbMigrationOptions {
  factory?: IDBFactory | null;
  storage: Storage;
  namespace: StorageNamespace;
  runId: string;
  ownerId: string;
  now: () => string;
  nowMs: () => number;
  locks?: WebLockProvider;
  storageManager?: CapacityManager;
  recoveryGate: RecoveryGate;
  afterCheckpoint?: (state: MigrationState) => void | Promise<void>;
  testHooks?: { abortPreflightTransaction?: boolean };
  migrationFamily?: string;
  includeKey?: (key: string) => boolean;
  requiredRecoveryManifestHash?: string;
}

export interface MigrationRunResult {
  state: MigrationState;
  authority: 'localStorage';
  quarantineCount: number;
  requestedBytes: number;
  error?: string;
}

interface StateRecord {
  key: string;
  state: MigrationState;
  runId: string;
  checkpointAt: string;
}

const encoder = new TextEncoder();

function migrationStateKey(
  namespace: StorageNamespace,
  family?: string
): string {
  return `migration-state:${namespace}${family ? `:${family}` : ''}`;
}

function estimatedSourceBytes(
  storage: Storage,
  includeKey?: (key: string) => boolean
): number {
  const keys = currentLegacyKeys(storage, includeKey);
  let bytes = 0;
  for (const key of keys) {
    const raw = storage.getItem(key);
    if (raw !== null) bytes += encoder.encode(raw).byteLength;
  }
  return bytes;
}

function currentLegacyKeys(
  storage: Storage,
  includeKey: (key: string) => boolean = () => true
): Set<string> {
  const keys = new Set<string>(LEGACY_EXACT_KEYS);
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      key &&
      (key.startsWith('rollkeeper-') ||
        key.startsWith('location-canvas-') ||
        key.startsWith('battlemap-canvas-'))
    ) {
      keys.add(key);
    }
  }
  return new Set([...keys].filter(includeKey));
}

async function readState(
  database: IDBDatabase,
  namespace: StorageNamespace,
  fallbackRunId: string,
  family?: string
): Promise<StateRecord> {
  const transaction = database.transaction('meta', 'readonly');
  const record = (await requestResult(
    transaction.objectStore('meta').get(migrationStateKey(namespace, family))
  )) as StateRecord | undefined;
  await transactionComplete(transaction);
  return (
    record ?? {
      key: migrationStateKey(namespace, family),
      state: 'LEGACY_PRIMARY',
      runId: fallbackRunId,
      checkpointAt: '',
    }
  );
}

async function checkpoint(
  database: IDBDatabase,
  record: StateRecord,
  next: MigrationState,
  options: RunIndexedDbMigrationOptions
): Promise<StateRecord> {
  assertMigrationTransition(record.state, next);
  const updated = { ...record, state: next, checkpointAt: options.now() };
  const transaction = database.transaction('meta', 'readwrite');
  transaction.objectStore('meta').put(updated);
  await transactionComplete(transaction);
  await options.afterCheckpoint?.(next);
  return updated;
}

async function requestCapacity(
  manager: CapacityManager | undefined,
  bytes: number
): Promise<void> {
  if (!manager) return;
  if (manager.requestCapacity) {
    if (!(await manager.requestCapacity(bytes))) {
      throw new Error('Insufficient storage capacity for IndexedDB migration');
    }
    return;
  }
  const estimate = await manager.estimate?.();
  if (
    estimate?.quota !== undefined &&
    estimate.usage !== undefined &&
    estimate.quota - estimate.usage < bytes
  ) {
    throw new Error('Insufficient storage capacity for IndexedDB migration');
  }
  await manager.persist?.();
}

async function preflight(
  database: IDBDatabase,
  options: RunIndexedDbMigrationOptions,
  requestedBytes: number
): Promise<void> {
  await requestCapacity(options.storageManager, requestedBytes);
  const transaction = database.transaction('meta', 'readwrite');
  const store = transaction.objectStore('meta');
  const sentinel = {
    key: 'preflight-sentinel',
    value: `${options.ownerId}:${options.now()}`,
  };
  store.put(sentinel);
  const persisted = (await requestResult(store.get('preflight-sentinel'))) as
    | typeof sentinel
    | undefined;
  if (persisted?.value !== sentinel.value) {
    transaction.abort();
    throw new Error('IndexedDB preflight sentinel read mismatch');
  }
  if (options.testHooks?.abortPreflightTransaction) {
    transaction.abort();
  } else {
    store.delete('preflight-sentinel');
  }
  await transactionComplete(transaction);
}

async function transformAndValidate(
  database: IDBDatabase,
  manifest: SourceManifest,
  namespace: StorageNamespace
): Promise<void> {
  const transaction = database.transaction(
    ['kvGenerations', 'quarantine'],
    'readwrite'
  );
  const generations = transaction.objectStore('kvGenerations');
  const quarantine = transaction.objectStore('quarantine');
  for (const snapshot of manifest.entries) {
    if (!snapshot.presence || snapshot.rawValue === null) continue;
    const transformed = transformCapturedSnapshot(snapshot, namespace);
    generations.put(transformed);
    const validation = validateLegacyEnvelope(snapshot.key, snapshot.rawValue);
    if (validation.status === 'quarantined') {
      quarantine.put({
        quarantineId: `${namespace}:${manifest.runId}:${snapshot.key}:${snapshot.captureNumber}`,
        namespace,
        runId: manifest.runId,
        key: snapshot.key,
        captureNumber: snapshot.captureNumber,
        rawValue: snapshot.rawValue,
        reason: validation.reason,
        detail: validation.detail,
        parserVersion: 1,
        retryHistory: [],
      });
    }
  }
  await transactionComplete(transaction);
}

async function countQuarantine(
  database: IDBDatabase,
  namespace: StorageNamespace,
  runId: string
): Promise<number> {
  const transaction = database.transaction('quarantine', 'readonly');
  const rows = (await requestResult(
    transaction.objectStore('quarantine').getAll()
  )) as Array<{ namespace: StorageNamespace; runId: string }>;
  await transactionComplete(transaction);
  return rows.filter(row => row.namespace === namespace && row.runId === runId)
    .length;
}

async function writeShadowValue(
  database: IDBDatabase,
  namespace: StorageNamespace,
  generation: string,
  key: string,
  rawValue: string
): Promise<void> {
  const transaction = database.transaction('kvGenerations', 'readwrite');
  const store = transaction.objectStore('kvGenerations');
  const existing = (await requestResult(
    store.get([namespace, generation, key])
  )) as Record<string, unknown> | undefined;
  store.put({
    ...existing,
    namespace,
    generation,
    key,
    presence: true,
    rawValue,
    shadowedAt: new Date().toISOString(),
  });
  await transactionComplete(transaction);
}

async function shadowGate(
  database: IDBDatabase,
  manifest: SourceManifest,
  options: RunIndexedDbMigrationOptions
): Promise<{ parity: boolean; journalEmpty: boolean }> {
  const repository = new IndexedDbShadowJournalRepository(database);
  const coordinator = new ShadowWriteCoordinator({
    namespace: options.namespace,
    generation: manifest.runId,
    storage: options.storage,
    repository,
    writeShadow: (key, value) =>
      writeShadowValue(database, options.namespace, manifest.runId, key, value),
    now: options.now,
    randomId: () => options.runId,
  });
  const readRows = async () => {
    const transaction = database.transaction('kvGenerations', 'readonly');
    const rows = (await requestResult(
      transaction.objectStore('kvGenerations').getAll()
    )) as Array<{
      namespace: StorageNamespace;
      generation: string;
      key: string;
      rawValue: string;
    }>;
    await transactionComplete(transaction);
    return rows.filter(
      row =>
        row.namespace === options.namespace && row.generation === manifest.runId
    );
  };

  await coordinator.retryPending();
  let relevant = await readRows();
  const manifestKeys = new Set(manifest.entries.map(entry => entry.key));
  const keys = new Set([
    ...manifestKeys,
    ...currentLegacyKeys(options.storage, options.includeKey),
  ]);
  for (const key of keys) {
    const current = options.storage.getItem(key);
    if (current === null) continue;
    const shadow = relevant.find(row => row.key === key);
    if (shadow?.rawValue === current) continue;
    const validation = validateLegacyEnvelope(key, current);
    if (validation.status === 'quarantined') {
      const transaction = database.transaction('quarantine', 'readwrite');
      transaction.objectStore('quarantine').put({
        quarantineId: `${options.namespace}:${manifest.runId}:shadow:${key}:${options.now()}`,
        namespace: options.namespace,
        runId: manifest.runId,
        key,
        rawValue: current,
        reason: validation.reason,
        detail: validation.detail,
        parserVersion: 1,
        retryHistory: [],
      });
      await transactionComplete(transaction);
    }
    await coordinator.write(key, current, { expectedRawValue: current });
  }
  const pending = await repository.list(options.namespace);
  relevant = await readRows();
  const parity = [...keys].every(key => {
    const current = options.storage.getItem(key);
    const manifestEntry = manifest.entries.find(entry => entry.key === key);
    if (current === null) return !manifestEntry?.presence;
    return relevant.find(row => row.key === key)?.rawValue === current;
  });
  return { parity, journalEmpty: pending.length === 0 };
}

function result(
  state: MigrationState,
  requestedBytes: number,
  quarantineCount: number,
  error?: unknown
): MigrationRunResult {
  return {
    state,
    authority: 'localStorage',
    quarantineCount,
    requestedBytes,
    ...(error === undefined
      ? {}
      : { error: error instanceof Error ? error.message : String(error) }),
  };
}

export async function runIndexedDbMigration(
  options: RunIndexedDbMigrationOptions
): Promise<MigrationRunResult> {
  const requestedBytes =
    estimatedSourceBytes(options.storage, options.includeKey) * 3;
  let database: IDBDatabase;
  try {
    database = await openRollkeeperDatabase({ factory: options.factory });
  } catch (cause) {
    return result('LEGACY_PRIMARY', requestedBytes, 0, cause);
  }

  try {
    return await withMigrationLock(
      database,
      async () => {
        let state = await readState(
          database,
          options.namespace,
          options.runId,
          options.migrationFamily
        );
        let manifest: SourceManifest | undefined;
        try {
          if (state.state === 'CUTOVER_READY') {
            return result('CUTOVER_READY', requestedBytes, 0);
          }
          if (
            state.state === 'LEGACY_PRIMARY' ||
            state.state === 'BLOCKED' ||
            state.state === 'ROLLED_BACK' ||
            state.state === 'RECOVERY_REQUIRED'
          ) {
            state = await checkpoint(database, state, 'PREFLIGHT', options);
          }
          if (state.state === 'PREFLIGHT') {
            await preflight(database, options, requestedBytes);
            state = await checkpoint(database, state, 'CAPTURING', options);
          }
          if (state.state === 'CAPTURING') {
            manifest = await captureLegacySources({
              database,
              storage: options.storage,
              runId: state.runId,
              now: options.now,
              includeKey: options.includeKey,
            });
            state = await checkpoint(database, state, 'CAPTURED', options);
          }
          manifest ??= await verifyPersistedCapture({
            factory: options.factory ?? indexedDB,
            runId: state.runId,
          });
          if (
            !(await options.recoveryGate.hasDownloadReceipt(
              options.requiredRecoveryManifestHash ??
                manifest.recoveryManifestHash
            ))
          ) {
            state = await checkpoint(
              database,
              state,
              'RECOVERY_REQUIRED',
              options
            );
            return result(state.state, requestedBytes, 0);
          }
          if (state.state === 'CAPTURED') {
            state = await checkpoint(database, state, 'TRANSFORMING', options);
          }
          if (state.state === 'TRANSFORMING') {
            await transformAndValidate(database, manifest, options.namespace);
            state = await checkpoint(database, state, 'VALIDATED', options);
          }
          if (state.state === 'VALIDATED') {
            state = await checkpoint(database, state, 'SHADOWING', options);
          }
          const gate = await shadowGate(database, manifest, options);
          const quarantineCount = await countQuarantine(
            database,
            options.namespace,
            state.runId
          );
          // A separate connection is deliberately opened, verified, closed, and
          // reopened before readiness. This exercises persisted durability while
          // the migration lock connection remains alive.
          await verifyPersistedCapture({
            factory: options.factory ?? indexedDB,
            runId: state.runId,
          });
          await verifyPersistedCapture({
            factory: options.factory ?? indexedDB,
            runId: state.runId,
          });
          if (quarantineCount > 0 || !gate.parity || !gate.journalEmpty) {
            return result('SHADOWING', requestedBytes, quarantineCount);
          }
          state = await checkpoint(database, state, 'CUTOVER_READY', options);
          return result(state.state, requestedBytes, quarantineCount);
        } catch (cause) {
          if (cause instanceof MigrationInterruptedError) throw cause;
          if (state.state !== 'BLOCKED' && state.state !== 'LEGACY_PRIMARY') {
            state = await checkpoint(database, state, 'BLOCKED', {
              ...options,
              afterCheckpoint: undefined,
            });
          }
          return result(state.state, requestedBytes, 0, cause);
        }
      },
      {
        ownerId: options.ownerId,
        now: options.nowMs,
        locks: options.locks,
      }
    );
  } catch (cause) {
    if (cause instanceof MigrationInterruptedError) throw cause;
    const state = await readState(
      database,
      options.namespace,
      options.runId,
      options.migrationFamily
    );
    return result(state.state, requestedBytes, 0, cause);
  } finally {
    database.close();
  }
}
