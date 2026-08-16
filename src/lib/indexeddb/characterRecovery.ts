import {
  previewRecoveryBundle,
  validateDeviceBackupJson,
} from '../deviceRecovery';
import {
  scopedCharacterAuthorityKeys,
  type CharacterAuthority,
} from './characterAuthority';
import { CHARACTER_FAMILY, isCharacterFamilyKey } from './characterFamily';
import { requestResult, transactionComplete } from './localDatabase';
import { validateLegacyEnvelope } from './migrationValidation';
import { setCharacterRuntimeAuthority } from './characterPersistenceRuntime';
import type { StorageNamespace } from './shadowJournal';

interface RecoveryGenerationRecord {
  key: string;
  generation: string;
  namespace: StorageNamespace;
  status: 'inactive';
  bundleHash: string;
  quarantineCount: number;
  importedAt: string;
}

export async function importCharacterRecoveryGeneration(
  database: IDBDatabase,
  serialized: string,
  namespace: StorageNamespace
) {
  // Hashes and the manifest are verified before any entry is parsed or written.
  const bundle = await validateDeviceBackupJson(serialized);
  const generation = `recovery:${bundle.runId}`;
  const entries = bundle.entries.filter(entry =>
    isCharacterFamilyKey(entry.key)
  );
  const preview = previewRecoveryBundle(bundle, new Map());
  const quarantineCount = entries.filter(
    entry =>
      validateLegacyEnvelope(entry.key, entry.rawValue).status === 'quarantined'
  ).length;
  const recordKey = `character-recovery:${namespace}:${generation}`;
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  const meta = transaction.objectStore('meta');
  const existing = (await requestResult(meta.get(recordKey))) as
    | RecoveryGenerationRecord
    | undefined;
  if (existing) {
    await transactionComplete(transaction);
    if (existing.bundleHash !== bundle.manifestHash) {
      throw new Error(`Immutable character recovery collision: ${generation}`);
    }
    return {
      generation,
      status: 'inactive' as const,
      entryCount: entries.length,
      quarantineCount: existing.quarantineCount,
      preview,
    };
  }
  const generations = transaction.objectStore('kvGenerations');
  for (const entry of entries) {
    generations.add({
      namespace,
      generation,
      key: entry.key,
      presence: true,
      rawValue: entry.rawValue,
      sourceSha256: entry.sha256,
      recoveryRunId: bundle.runId,
    });
  }
  meta.add({
    key: recordKey,
    generation,
    namespace,
    status: 'inactive',
    bundleHash: bundle.manifestHash,
    quarantineCount,
    importedAt: new Date().toISOString(),
  } satisfies RecoveryGenerationRecord);
  await transactionComplete(transaction);
  return {
    generation,
    status: 'inactive' as const,
    entryCount: entries.length,
    quarantineCount,
    preview,
  };
}

export async function activateImportedCharacterGeneration(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    generation: string;
    confirmed: boolean;
    now: () => string;
  }
) {
  if (!options.confirmed) {
    throw new Error('Recovery activation requires explicit confirmation');
  }
  const keys = scopedCharacterAuthorityKeys(options.namespace);
  const transaction = database.transaction(
    ['meta', 'kvGenerations', 'journal', 'conflicts'],
    'readwrite'
  );
  const meta = transaction.objectStore('meta');
  const pointer = (await requestResult(meta.get(keys.pointer))) as
    | {
        authority: 'indexedDB';
        namespace: StorageNamespace;
        family: typeof CHARACTER_FAMILY;
        generation: string;
        epoch: number;
        committedAt: string;
      }
    | { authority: 'localStorage'; epoch: number }
    | undefined;
  const epochRecord = (await requestResult(meta.get(keys.epoch))) as
    | { value?: number }
    | undefined;
  const authority: CharacterAuthority =
    pointer?.authority === 'indexedDB'
      ? {
          authority: 'indexedDB',
          namespace: pointer.namespace,
          family: pointer.family,
          generation: pointer.generation,
          epoch: pointer.epoch,
          committedAt: pointer.committedAt,
        }
      : {
          authority: 'localStorage',
          epoch: pointer?.epoch ?? epochRecord?.value ?? 0,
        };
  const recovery = (await requestResult(
    meta.get(`character-recovery:${options.namespace}:${options.generation}`)
  )) as RecoveryGenerationRecord | undefined;
  const rows = (await requestResult(
    transaction.objectStore('kvGenerations').getAll()
  )) as Array<{
    namespace: StorageNamespace;
    generation: string;
    key: string;
    rawValue: string | null;
  }>;
  const journals = (await requestResult(
    transaction.objectStore('journal').getAll()
  )) as Array<{ namespace?: StorageNamespace; family?: string }>;
  if (!recovery || recovery.status !== 'inactive') {
    transaction.abort();
    throw new Error('Inactive character recovery generation not found');
  }
  const importedRows = rows.filter(
    row =>
      row.namespace === options.namespace &&
      row.generation === options.generation &&
      isCharacterFamilyKey(row.key)
  );
  if (importedRows.length === 0) {
    transaction.abort();
    throw new Error('Recovery generation is empty');
  }
  if (
    authority.authority === 'indexedDB' &&
    authority.generation === options.generation
  ) {
    await transactionComplete(transaction);
    return { activated: true as const, ...authority };
  }
  const activeRows =
    authority.authority === 'indexedDB'
      ? rows.filter(
          row =>
            row.namespace === options.namespace &&
            row.generation === authority.generation &&
            isCharacterFamilyKey(row.key)
        )
      : [];
  const importedByKey = new Map(importedRows.map(row => [row.key, row]));
  const activeByKey = new Map(activeRows.map(row => [row.key, row]));
  const divergentKeys = [
    ...new Set([...activeByKey.keys(), ...importedByKey.keys()]),
  ].filter(
    key => activeByKey.get(key)?.rawValue !== importedByKey.get(key)?.rawValue
  );
  const journalEmpty = !journals.some(
    row =>
      row.namespace === options.namespace && row.family === CHARACTER_FAMILY
  );
  if (
    divergentKeys.length > 0 ||
    recovery.quarantineCount > 0 ||
    !journalEmpty
  ) {
    for (const key of divergentKeys) {
      transaction.objectStore('conflicts').put({
        conflictId: `recovery:${options.namespace}:${options.generation}:${key}`,
        kind: 'recovery-generation-divergence',
        namespace: options.namespace,
        family: CHARACTER_FAMILY,
        key,
        activeGeneration:
          authority.authority === 'indexedDB' ? authority.generation : null,
        importedGeneration: options.generation,
        activeRawValue: activeByKey.get(key)?.rawValue ?? null,
        importedRawValue: importedByKey.get(key)?.rawValue ?? null,
        detectedAt: options.now(),
        resolutionState: 'unresolved',
      });
    }
    meta.put({
      key: keys.state,
      state: 'RECOVERY_REQUIRED',
      runId:
        authority.authority === 'indexedDB'
          ? authority.generation
          : options.generation,
      checkpointAt: options.now(),
    });
    await transactionComplete(transaction);
    return {
      activated: false as const,
      conflictCount: divergentKeys.length,
      state: 'RECOVERY_REQUIRED' as const,
    };
  }

  const epoch = authority.epoch + 1;
  const committedAt = options.now();
  meta.put({
    key: keys.pointer,
    authority: 'indexedDB',
    namespace: options.namespace,
    family: CHARACTER_FAMILY,
    generation: options.generation,
    epoch,
    committedAt,
  });
  meta.put({ key: keys.epoch, value: epoch });
  meta.put({
    key: keys.state,
    state: 'IDB_PRIMARY',
    runId: options.generation,
    checkpointAt: committedAt,
  });
  meta.put({ ...recovery, status: 'inactive', activatedAt: committedAt });
  await transactionComplete(transaction);
  const activated = {
    activated: true as const,
    authority: 'indexedDB' as const,
    namespace: options.namespace,
    family: CHARACTER_FAMILY,
    generation: options.generation,
    epoch,
    committedAt,
  };
  setCharacterRuntimeAuthority(activated);
  return activated;
}
