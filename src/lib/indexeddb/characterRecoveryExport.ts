import { captureDeviceBackup, type DeviceBackupV1 } from '../deviceRecovery';
import { sha256Bytes } from './migrationCapture';
import {
  type ActiveCharacterSafetyRow,
  type IndexedDbCharacterAuthority,
  inspectCurrentCharacterSafetyCoverage,
  readCharacterAuthority,
} from './characterAuthority';
import { isCharacterFamilyKey } from './characterFamily';
import { requestResult, transactionComplete } from './localDatabase';
import type { StorageNamespace } from './shadowJournal';

interface ExportStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
}

export interface ActiveCharacterRecoveryBundle {
  bundle: DeviceBackupV1;
  authority: IndexedDbCharacterAuthority;
}

export async function captureActiveCharacterRecoveryBundleFromRows(options: {
  authority: IndexedDbCharacterAuthority;
  rows: readonly ActiveCharacterSafetyRow[];
  appVersion: string;
  runId: string;
  timestamp: string;
}): Promise<ActiveCharacterRecoveryBundle> {
  const values = new Map<string, string>();
  const seen = new Set<string>();
  for (const row of options.rows) {
    if (
      row.namespace !== options.authority.namespace ||
      row.generation !== options.authority.generation ||
      !isCharacterFamilyKey(row.key) ||
      seen.has(row.key) ||
      typeof row.presence !== 'boolean' ||
      (row.presence && typeof row.rawValue !== 'string') ||
      (!row.presence && row.rawValue !== null)
    ) {
      throw new Error('Character recovery source rows are malformed or mixed');
    }
    seen.add(row.key);
    if (row.presence) values.set(row.key, row.rawValue as string);
  }
  if (values.size === 0) {
    throw new Error('Character recovery source is empty');
  }
  return {
    authority: options.authority,
    bundle: await captureDeviceBackup(values, {
      appVersion: options.appVersion,
      runId: options.runId,
      timestamp: options.timestamp,
    }),
  };
}

export async function captureActiveCharacterRecoveryBundle(options: {
  factory: IDBFactory;
  namespace: StorageNamespace;
  appVersion: string;
  runId: string;
  timestamp: string;
  expectedAuthority?: { generation: string; epoch: number };
}): Promise<ActiveCharacterRecoveryBundle> {
  const coverage = await inspectCurrentCharacterSafetyCoverage({
    factory: options.factory,
    storage: { length: 0, key: () => null, getItem: () => null },
    namespace: options.namespace,
    expectedAuthority: options.expectedAuthority,
  });
  return captureActiveCharacterRecoveryBundleFromRows({
    authority: coverage.authority,
    rows: coverage.rows,
    appVersion: options.appVersion,
    runId: options.runId,
    timestamp: options.timestamp,
  });
}

function scopedArtifact(
  row: { namespace?: unknown; family?: unknown; key?: unknown },
  namespace: StorageNamespace
): boolean {
  return (
    row.namespace === namespace &&
    (row.family === 'character' ||
      (typeof row.key === 'string' && isCharacterFamilyKey(row.key)))
  );
}

export async function exportCurrentCharacterData(
  database: IDBDatabase,
  storage: ExportStorage,
  namespace: StorageNamespace,
  now: () => string = () => new Date().toISOString()
): Promise<string> {
  const authority = await readCharacterAuthority(database, namespace);
  const transaction = database.transaction(
    ['kvGenerations', 'journal', 'conflicts', 'quarantine', 'tombstones'],
    'readonly'
  );
  const [
    allGenerations,
    allJournal,
    allConflicts,
    allQuarantine,
    allTombstones,
  ] = await Promise.all(
    ['kvGenerations', 'journal', 'conflicts', 'quarantine', 'tombstones'].map(
      store => requestResult(transaction.objectStore(store).getAll())
    )
  );
  await transactionComplete(transaction);
  const compatibilityMirrors: Array<{ key: string; rawValue: string }> = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !isCharacterFamilyKey(key)) continue;
    const rawValue = storage.getItem(key);
    if (rawValue !== null) compatibilityMirrors.push({ key, rawValue });
  }
  compatibilityMirrors.sort((left, right) => left.key.localeCompare(right.key));
  const generations = (allGenerations as Array<Record<string, unknown>>).filter(
    row => scopedArtifact(row, namespace)
  );
  const journal = (allJournal as Array<Record<string, unknown>>).filter(row =>
    scopedArtifact(row, namespace)
  );
  const conflicts = (allConflicts as Array<Record<string, unknown>>).filter(
    row => scopedArtifact(row, namespace)
  );
  const quarantine = (allQuarantine as Array<Record<string, unknown>>).filter(
    row => scopedArtifact(row, namespace)
  );
  const tombstones = (allTombstones as Array<Record<string, unknown>>).filter(
    row => scopedArtifact(row, namespace)
  );
  const payload = {
    format: 'rollkeeper-current-character-export' as const,
    formatVersion: 1 as const,
    namespace,
    exportedAt: now(),
    authority,
    compatibilityMirrors,
    generations,
    journal,
    conflicts,
    quarantine,
    tombstones,
  };
  return JSON.stringify({
    ...payload,
    bundleHash: await sha256Bytes(JSON.stringify(payload)),
  });
}
