import { sha256Bytes } from './migrationCapture';
import { readCharacterAuthority } from './characterAuthority';
import { isCharacterFamilyKey } from './characterFamily';
import { requestResult, transactionComplete } from './localDatabase';
import type { StorageNamespace } from './shadowJournal';

interface ExportStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
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
