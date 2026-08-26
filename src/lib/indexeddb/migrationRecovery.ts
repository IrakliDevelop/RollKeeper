import {
  sha256Bytes,
  type LegacySnapshot,
  type SourceManifest,
} from '@/lib/indexeddb/migrationCapture';
import {
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

const FORMAT = 'rollkeeper-indexeddb-migration-recovery' as const;
const FORMAT_VERSION = 1 as const;

export interface MigrationRecoveryBundle {
  format: typeof FORMAT;
  formatVersion: typeof FORMAT_VERSION;
  namespace: StorageNamespace;
  status: 'inactive';
  exportedAt: string;
  manifest: SourceManifest;
  snapshots: LegacySnapshot[];
  bundleHash: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hashPayload(
  bundle: Omit<MigrationRecoveryBundle, 'bundleHash'>
): string {
  return JSON.stringify({
    format: bundle.format,
    formatVersion: bundle.formatVersion,
    namespace: bundle.namespace,
    status: bundle.status,
    manifest: bundle.manifest,
    snapshots: bundle.snapshots,
  });
}

export async function exportMigrationRecovery(
  database: IDBDatabase,
  runId: string,
  namespace: StorageNamespace
): Promise<string> {
  const transaction = database.transaction(
    ['legacySnapshots', 'meta'],
    'readonly'
  );
  const snapshots = (
    (await requestResult(
      transaction.objectStore('legacySnapshots').getAll()
    )) as LegacySnapshot[]
  ).filter(snapshot => snapshot.runId === runId);
  const manifestRecord = (await requestResult(
    transaction.objectStore('meta').get(`source-manifest:${runId}`)
  )) as { value?: SourceManifest } | undefined;
  await transactionComplete(transaction);
  if (!manifestRecord?.value)
    throw new Error(`Migration run not found: ${runId}`);

  const partial: Omit<MigrationRecoveryBundle, 'bundleHash'> = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    namespace,
    status: 'inactive',
    exportedAt: new Date().toISOString(),
    manifest: manifestRecord.value,
    snapshots,
  };
  return JSON.stringify({
    ...partial,
    bundleHash: await sha256Bytes(hashPayload(partial)),
  });
}

export async function validateMigrationRecoveryJson(
  serialized: string
): Promise<MigrationRecoveryBundle> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('Migration recovery is not valid JSON');
  }
  if (!isRecord(parsed)) throw new Error('Invalid migration recovery bundle');
  const bundle = parsed as unknown as MigrationRecoveryBundle;
  if (
    bundle.format !== FORMAT ||
    bundle.formatVersion !== FORMAT_VERSION ||
    bundle.status !== 'inactive' ||
    (bundle.namespace !== 'guest' && !bundle.namespace?.startsWith('user:')) ||
    !isRecord(bundle.manifest) ||
    !Array.isArray(bundle.snapshots) ||
    typeof bundle.bundleHash !== 'string'
  ) {
    throw new Error('Invalid migration recovery bundle');
  }
  for (const snapshot of bundle.snapshots) {
    if (
      !isRecord(snapshot) ||
      typeof snapshot.key !== 'string' ||
      typeof snapshot.captureNumber !== 'number' ||
      (snapshot.rawValue !== null && typeof snapshot.rawValue !== 'string') ||
      (await sha256Bytes(snapshot.rawValue ?? '')) !== snapshot.sha256
    ) {
      throw new Error('Migration recovery snapshot checksum mismatch');
    }
  }
  for (const entry of bundle.manifest.entries) {
    const snapshot = bundle.snapshots.find(
      candidate =>
        candidate.key === entry.key &&
        candidate.captureNumber === entry.captureNumber
    );
    if (!snapshot || snapshot.sha256 !== entry.sha256) {
      throw new Error('Migration recovery manifest checksum mismatch');
    }
  }
  const partial: Omit<MigrationRecoveryBundle, 'bundleHash'> = {
    format: bundle.format,
    formatVersion: bundle.formatVersion,
    namespace: bundle.namespace,
    status: bundle.status,
    exportedAt: bundle.exportedAt,
    manifest: bundle.manifest,
    snapshots: bundle.snapshots,
  };
  if ((await sha256Bytes(hashPayload(partial))) !== bundle.bundleHash) {
    throw new Error('Migration recovery bundle checksum mismatch');
  }
  return bundle;
}

export async function importMigrationRecovery(
  database: IDBDatabase,
  serialized: string
): Promise<MigrationRecoveryBundle> {
  const bundle = await validateMigrationRecoveryJson(serialized);
  const runId = bundle.manifest.runId;
  const transaction = database.transaction(
    ['legacySnapshots', 'meta'],
    'readwrite'
  );
  const meta = transaction.objectStore('meta');
  const existing = (await requestResult(
    meta.get(`source-manifest:${runId}`)
  )) as { value?: SourceManifest } | undefined;
  if (existing) {
    await transactionComplete(transaction);
    if (existing.value?.manifestHash !== bundle.manifest.manifestHash) {
      throw new Error(`Immutable migration recovery collision: ${runId}`);
    }
    return bundle;
  }
  const snapshots = transaction.objectStore('legacySnapshots');
  for (const snapshot of bundle.snapshots) snapshots.add(snapshot);
  meta.add({ key: `source-manifest:${runId}`, value: bundle.manifest });
  meta.add({
    key: `recovery-import:${runId}`,
    value: {
      namespace: bundle.namespace,
      status: 'inactive',
      bundleHash: bundle.bundleHash,
      importedAt: new Date().toISOString(),
    },
  });
  await transactionComplete(transaction);
  return bundle;
}
