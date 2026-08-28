import {
  previewRecoveryBundle,
  validateDeviceBackupJson,
  type DeviceBackupEntry,
  type DeviceBackupV1,
} from '../deviceRecovery';
import {
  characterActivationEvidenceKey,
  readCharacterAuthority,
  scopedCharacterAuthorityKeys,
  type CharacterAuthority,
} from './characterAuthority';
import { CHARACTER_FAMILY, isCharacterFamilyKey } from './characterFamily';
import {
  readCharacterCutoverSelection,
  writeRecoveredCharacterSelectionMarker,
} from './characterCutoverSelection';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';
import { validateLegacyEnvelope } from './migrationValidation';
import { setCharacterRuntimeAuthority } from './characterPersistenceRuntime';
import type { StorageNamespace } from './shadowJournal';

interface RecoveryGenerationRecord {
  key: string;
  generation: string;
  namespace: StorageNamespace;
  status: 'inactive';
  bundleHash: string;
  recoveryRunId: string;
  recoveryCreatedAt: string;
  quarantineCount: number;
  importedAt: string;
}

interface CompatibilityStorage {
  length?: number;
  key?(index: number): string | null;
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
}

export type CharacterRecoveryInspectReason =
  | 'invalid-json'
  | 'invalid-shape'
  | 'unsupported-version'
  | 'checksum-mismatch'
  | 'aggregate-mismatch'
  | 'empty-character-set'
  | 'duplicate-character-key'
  | 'diagnostic-not-restorable';

export type CharacterRecoveryInspectResult =
  | {
      ok: true;
      bundle: DeviceBackupV1;
      characterEntries: DeviceBackupEntry[];
      quarantineCount: number;
    }
  | { ok: false; reason: CharacterRecoveryInspectReason };

const DIAGNOSTIC_FORMAT = 'rollkeeper-current-character-export';

function mapValidationError(cause: unknown): CharacterRecoveryInspectReason {
  const message = cause instanceof Error ? cause.message : '';
  if (message.includes('not valid JSON')) return 'invalid-json';
  if (message.includes('Unsupported recovery bundle version'))
    return 'unsupported-version';
  if (message.includes('entry checksum mismatch')) return 'checksum-mismatch';
  if (message.includes('manifest checksum mismatch'))
    return 'aggregate-mismatch';
  return 'invalid-shape';
}

export type SafetyFileInspectResult =
  | {
      ok: true;
      kind: 'character' | 'generic';
      bundle: DeviceBackupV1;
      characterEntries: DeviceBackupEntry[];
      quarantineCount: number;
    }
  | { ok: false; reason: CharacterRecoveryInspectReason };

export async function inspectPlayerBackupSafetyFile(
  serialized: string
): Promise<SafetyFileInspectResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    (parsed as { format?: unknown }).format === DIAGNOSTIC_FORMAT
  ) {
    return { ok: false, reason: 'diagnostic-not-restorable' };
  }
  let bundle: DeviceBackupV1;
  try {
    bundle = await validateDeviceBackupJson(serialized);
  } catch (cause) {
    return { ok: false, reason: mapValidationError(cause) };
  }
  const characterEntries = bundle.entries.filter(entry =>
    isCharacterFamilyKey(entry.key)
  );
  const keys = characterEntries.map(entry => entry.key);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, reason: 'duplicate-character-key' };
  }
  const quarantineCount = characterEntries.filter(
    entry =>
      validateLegacyEnvelope(entry.key, entry.rawValue).status === 'quarantined'
  ).length;
  return {
    ok: true,
    kind: characterEntries.length > 0 ? 'character' : 'generic',
    bundle,
    characterEntries,
    quarantineCount,
  };
}

export async function inspectCharacterRecoveryBundle(
  serialized: string
): Promise<CharacterRecoveryInspectResult> {
  const inspected = await inspectPlayerBackupSafetyFile(serialized);
  if (!inspected.ok) return inspected;
  if (inspected.characterEntries.length === 0) {
    return { ok: false, reason: 'empty-character-set' };
  }
  return {
    ok: true,
    bundle: inspected.bundle,
    characterEntries: inspected.characterEntries,
    quarantineCount: inspected.quarantineCount,
  };
}

export async function stageCharacterRecoveryFromSerialized(options: {
  factory: IDBFactory;
  serialized: string;
  namespace: StorageNamespace;
}) {
  const inspected = await inspectCharacterRecoveryBundle(options.serialized);
  if (!inspected.ok) {
    throw new Error(`Character recovery file is ${inspected.reason}`);
  }
  const database = await openRollkeeperDatabase({ factory: options.factory });
  try {
    return await importCharacterRecoveryGeneration(
      database,
      options.serialized,
      options.namespace
    );
  } finally {
    database.close();
  }
}

export async function importCharacterRecoveryGeneration(
  database: IDBDatabase,
  serialized: string,
  namespace: StorageNamespace
) {
  const inspected = await inspectCharacterRecoveryBundle(serialized);
  if (!inspected.ok) {
    throw new Error(`Character recovery file is ${inspected.reason}`);
  }
  const { bundle, characterEntries: entries, quarantineCount } = inspected;
  const generation = `recovery:${bundle.runId}`;
  const preview = previewRecoveryBundle(bundle, new Map());
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
    recoveryRunId: bundle.runId,
    recoveryCreatedAt: bundle.createdAt,
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

function hasCharacterFamilyCompatibility(
  storage: CompatibilityStorage | undefined
): boolean {
  if (!storage || typeof storage.length !== 'number' || !storage.key) {
    return false;
  }
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isCharacterFamilyKey(key) && storage.getItem(key) !== null) {
      return true;
    }
  }
  return false;
}

export async function activateImportedCharacterGeneration(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    generation: string;
    confirmed: boolean;
    now: () => string;
    storage?: CompatibilityStorage & {
      setItem(key: string, value: string): void;
    };
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
  if (authority.authority === 'indexedDB' && activeRows.length === 0) {
    transaction.abort();
    throw new Error('Active character generation is missing');
  }
  const storage =
    options.storage ??
    (typeof localStorage === 'undefined' ? undefined : localStorage);
  const emptyProfile =
    authority.authority === 'localStorage' &&
    !hasCharacterFamilyCompatibility(storage);
  const importedByKey = new Map(importedRows.map(row => [row.key, row]));
  const activeByKey = new Map(activeRows.map(row => [row.key, row]));
  const legacyByKey = new Map<string, { rawValue: string | null }>();
  if (
    authority.authority === 'localStorage' &&
    storage &&
    typeof storage.length === 'number' &&
    storage.key
  ) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !isCharacterFamilyKey(key)) continue;
      const rawValue = storage.getItem(key);
      if (rawValue !== null) legacyByKey.set(key, { rawValue });
    }
  }
  const compareByKey = emptyProfile
    ? importedByKey
    : authority.authority === 'indexedDB'
      ? activeByKey
      : legacyByKey;
  const divergentKeys = emptyProfile
    ? []
    : [...new Set([...compareByKey.keys(), ...importedByKey.keys()])].filter(
        key =>
          compareByKey.get(key)?.rawValue !== importedByKey.get(key)?.rawValue
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
        activeRawValue: compareByKey.get(key)?.rawValue ?? null,
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
  const evidence = {
    key: characterActivationEvidenceKey(options.namespace, options.generation),
    version: 1 as const,
    namespace: options.namespace,
    family: CHARACTER_FAMILY,
    selectedAt: committedAt,
    recoveryManifestHash: recovery.bundleHash,
    recoveryRunId: recovery.recoveryRunId,
    recoveryCreatedAt: recovery.recoveryCreatedAt,
    activatedGeneration: options.generation,
    activatedEpoch: epoch,
    committedAt,
  };
  const existingEvidence = (await requestResult(meta.get(evidence.key))) as
    | typeof evidence
    | undefined;
  if (
    existingEvidence &&
    JSON.stringify(existingEvidence) !== JSON.stringify(evidence)
  ) {
    transaction.abort();
    throw new Error('Immutable character activation evidence already differs');
  }
  meta.put(evidence);
  await transactionComplete(transaction);
  if (options.storage) {
    writeRecoveredCharacterSelectionMarker(options.storage, evidence);
  }
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

export async function verifyActivatedCharacterRecovery(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    serialized: string;
    storage?: { getItem(key: string): string | null };
    visibleCharacters?: ReadonlyArray<{ id: string; tags?: unknown }>;
  }
) {
  const inspected = await inspectCharacterRecoveryBundle(options.serialized);
  if (!inspected.ok) return { ok: false as const, reason: inspected.reason };
  const authority = await readCharacterAuthority(database, options.namespace);
  if (authority.authority !== 'indexedDB') {
    return { ok: false as const, reason: 'authority-mismatch' as const };
  }
  if (options.storage) {
    const marker = readCharacterCutoverSelection(
      options.storage,
      options.namespace
    );
    if (
      !marker ||
      marker.activatedGeneration !== authority.generation ||
      marker.activatedEpoch !== authority.epoch
    ) {
      return { ok: false as const, reason: 'marker-mismatch' as const };
    }
  }
  const transaction = database.transaction('kvGenerations', 'readonly');
  const rows = (await requestResult(
    transaction.objectStore('kvGenerations').getAll()
  )) as Array<{
    namespace: StorageNamespace;
    generation: string;
    key: string;
    rawValue: string | null;
    sourceSha256?: string;
    presence?: boolean;
  }>;
  await transactionComplete(transaction);
  const active = rows.filter(
    row =>
      row.namespace === options.namespace &&
      row.generation === authority.generation &&
      isCharacterFamilyKey(row.key) &&
      row.presence !== false
  );
  const byKey = new Map(active.map(row => [row.key, row]));
  for (const entry of inspected.characterEntries) {
    const row = byKey.get(entry.key);
    if (
      !row ||
      row.rawValue !== entry.rawValue ||
      (row.sourceSha256 !== undefined && row.sourceSha256 !== entry.sha256)
    ) {
      return { ok: false as const, reason: 'hash-mismatch' as const };
    }
  }
  const characterIds = expectedVisibleCharacterIds(inspected.characterEntries);
  if (
    options.visibleCharacters &&
    !visibleCharactersMatchRecovery(options.visibleCharacters, characterIds)
  ) {
    return { ok: false as const, reason: 'visible-mismatch' as const };
  }
  return { ok: true as const, characterIds };
}

export function visibleCharactersMatchRecovery(
  characters: ReadonlyArray<{ id: string; tags?: unknown }>,
  expectedIds: readonly string[]
): boolean {
  if (
    !characters.every(
      character =>
        typeof character.id === 'string' && Array.isArray(character.tags)
    )
  ) {
    return false;
  }
  const actual = [...characters.map(character => character.id)].sort();
  const expected = [...expectedIds].sort();
  return (
    actual.length === expected.length &&
    actual.every((id, index) => id === expected[index])
  );
}

function expectedVisibleCharacterIds(
  entries: readonly DeviceBackupEntry[]
): string[] {
  const envelopeIds = entries.flatMap(entry =>
    entry.key.startsWith('rollkeeper-character:')
      ? [entry.key.slice('rollkeeper-character:'.length)]
      : []
  );
  if (envelopeIds.length > 0) return [...new Set(envelopeIds)].sort();
  const roster = entries.find(entry => entry.key === 'rollkeeper-player-data');
  if (!roster) return [];
  try {
    const parsed = JSON.parse(roster.rawValue) as {
      state?: { characters?: Array<{ id?: unknown }> };
    };
    return (parsed.state?.characters ?? [])
      .flatMap(character =>
        typeof character.id === 'string' ? [character.id] : []
      )
      .sort();
  } catch {
    return [];
  }
}
