import { CHARACTER_FAMILY, isCharacterFamilyKey } from './characterFamily';
import {
  openExistingRollkeeperDatabase,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';
import type { StorageNamespace } from './shadowJournal';

export interface CharacterCutoverGates {
  recoveryReceipt: boolean;
  sourceManifestUnchanged: boolean;
  captureVerifiedAfterReopen: boolean;
  noQuarantine: boolean;
  parity: boolean;
  journalEmpty: boolean;
}

export interface IndexedDbCharacterAuthority {
  authority: 'indexedDB';
  namespace: StorageNamespace;
  family: typeof CHARACTER_FAMILY;
  generation: string;
  epoch: number;
  committedAt: string;
}

export type CharacterAuthority =
  | IndexedDbCharacterAuthority
  | {
      authority: 'localStorage';
      epoch: number;
      namespace?: StorageNamespace;
      family?: typeof CHARACTER_FAMILY;
      rollbackGeneration?: string;
      committedAt?: string;
    };

interface ActivePointerRecord extends IndexedDbCharacterAuthority {
  key: string;
}

export interface ActiveCharacterSafetyRow {
  namespace: StorageNamespace;
  generation: string;
  key: string;
  presence: boolean;
  rawValue: string | null;
}

export interface CurrentCharacterSafetyCoverage {
  authority: IndexedDbCharacterAuthority;
  rows: ActiveCharacterSafetyRow[];
  parity: boolean;
  matchingJournalCount: number;
  broadFileCoversCurrentCharacters: boolean;
}

interface RolledBackPointerRecord {
  key: string;
  authority: 'localStorage';
  namespace: StorageNamespace;
  family: typeof CHARACTER_FAMILY;
  generation: string;
  epoch: number;
  committedAt: string;
}

interface EpochRecord {
  key: string;
  value: number;
}

interface MigrationStateRecord {
  key: string;
  state: string;
  runId: string;
  checkpointAt: string;
}

export function scopedCharacterAuthorityKeys(namespace: StorageNamespace) {
  return {
    pointer: `active-generation:${namespace}:${CHARACTER_FAMILY}`,
    epoch: `cutover-epoch:${namespace}:${CHARACTER_FAMILY}`,
    state: `migration-state:${namespace}:${CHARACTER_FAMILY}`,
  } as const;
}

function withoutKey(pointer: ActivePointerRecord): IndexedDbCharacterAuthority {
  return {
    authority: pointer.authority,
    namespace: pointer.namespace,
    family: pointer.family,
    generation: pointer.generation,
    epoch: pointer.epoch,
    committedAt: pointer.committedAt,
  };
}

export async function verifyCharacterRollbackGenerationAfterReopen(
  factory: IDBFactory,
  namespace: StorageNamespace,
  expectedGeneration: string,
  expectedEpoch: number
): Promise<boolean> {
  let database: IDBDatabase | undefined;
  try {
    database = await openRollkeeperDatabase({ factory });
    const authority = await readCharacterAuthority(database, namespace);
    if (
      authority.authority !== 'indexedDB' ||
      authority.generation !== expectedGeneration ||
      authority.epoch !== expectedEpoch
    ) {
      return false;
    }
    const transaction = database.transaction('kvGenerations', 'readonly');
    const rows = (await requestResult(
      transaction.objectStore('kvGenerations').getAll()
    )) as Array<{
      namespace: StorageNamespace;
      generation: string;
      key: string;
    }>;
    await transactionComplete(transaction);
    return rows.some(
      row =>
        row.namespace === namespace &&
        row.generation === expectedGeneration &&
        isCharacterFamilyKey(row.key)
    );
  } catch {
    return false;
  } finally {
    database?.close();
  }
}

export async function inspectCurrentCharacterSafetyCoverage(options: {
  factory: IDBFactory;
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>;
  namespace: StorageNamespace;
  expectedAuthority?: { generation: string; epoch: number };
}): Promise<CurrentCharacterSafetyCoverage> {
  const database = await openExistingRollkeeperDatabase({
    factory: options.factory,
  });
  if (!database) throw new Error('Active character saving is not available');
  try {
    const keys = scopedCharacterAuthorityKeys(options.namespace);
    const transaction = database.transaction(
      ['meta', 'kvGenerations', 'journal'],
      'readonly'
    );
    const pointer = (await requestResult(
      transaction.objectStore('meta').get(keys.pointer)
    )) as ActivePointerRecord | RolledBackPointerRecord | undefined;
    const epoch = (await requestResult(
      transaction.objectStore('meta').get(keys.epoch)
    )) as EpochRecord | undefined;
    const allRows = (await requestResult(
      transaction.objectStore('kvGenerations').getAll()
    )) as unknown[];
    const journals = (await requestResult(
      transaction.objectStore('journal').getAll()
    )) as Array<Record<string, unknown>>;
    await transactionComplete(transaction);

    if (
      pointer?.authority !== 'indexedDB' ||
      pointer.namespace !== options.namespace ||
      pointer.family !== CHARACTER_FAMILY ||
      epoch?.value !== pointer.epoch
    ) {
      throw new Error('Active character saving is not available');
    }
    if (
      options.expectedAuthority &&
      (pointer.generation !== options.expectedAuthority.generation ||
        pointer.epoch !== options.expectedAuthority.epoch)
    ) {
      throw new Error('Active character saving changed during the check');
    }

    const activeRows: ActiveCharacterSafetyRow[] = [];
    const seen = new Set<string>();
    for (const value of allRows) {
      if (typeof value !== 'object' || value === null) continue;
      const row = value as Partial<ActiveCharacterSafetyRow>;
      if (
        row.namespace !== options.namespace ||
        row.generation !== pointer.generation ||
        typeof row.key !== 'string' ||
        !isCharacterFamilyKey(row.key)
      ) {
        continue;
      }
      if (
        seen.has(row.key) ||
        typeof row.presence !== 'boolean' ||
        (row.presence && typeof row.rawValue !== 'string') ||
        (!row.presence && row.rawValue !== null)
      ) {
        throw new Error('Active character row is malformed or duplicated');
      }
      seen.add(row.key);
      activeRows.push(row as ActiveCharacterSafetyRow);
    }
    activeRows.sort((left, right) => left.key.localeCompare(right.key));
    if (activeRows.length === 0) {
      throw new Error('Active character generation is empty');
    }

    const compatibilityKeys = new Set<string>();
    for (let index = 0; index < options.storage.length; index += 1) {
      const key = options.storage.key(index);
      if (key && isCharacterFamilyKey(key)) compatibilityKeys.add(key);
    }
    const parity =
      [...compatibilityKeys].every(key => seen.has(key)) &&
      activeRows.every(row =>
        row.presence
          ? options.storage.getItem(row.key) === row.rawValue
          : options.storage.getItem(row.key) === null
      );
    const matchingJournalCount = journals.filter(
      row =>
        row.kind === 'character-compatibility-mirror' &&
        row.namespace === options.namespace &&
        row.family === CHARACTER_FAMILY &&
        row.generation === pointer.generation &&
        row.cutoverEpoch === pointer.epoch
    ).length;
    const authority = withoutKey(pointer);
    return {
      authority,
      rows: activeRows,
      parity,
      matchingJournalCount,
      broadFileCoversCurrentCharacters: parity && matchingJournalCount === 0,
    };
  } finally {
    database.close();
  }
}

export async function readCharacterAuthority(
  database: IDBDatabase,
  namespace: StorageNamespace
): Promise<CharacterAuthority> {
  const keys = scopedCharacterAuthorityKeys(namespace);
  const transaction = database.transaction('meta', 'readonly');
  const pointer = (await requestResult(
    transaction.objectStore('meta').get(keys.pointer)
  )) as ActivePointerRecord | RolledBackPointerRecord | undefined;
  const epoch = (await requestResult(
    transaction.objectStore('meta').get(keys.epoch)
  )) as EpochRecord | undefined;
  await transactionComplete(transaction);
  if (!pointer) return { authority: 'localStorage', epoch: epoch?.value ?? 0 };
  if (pointer.authority === 'localStorage') {
    return {
      authority: 'localStorage',
      epoch: pointer.epoch,
      namespace: pointer.namespace,
      family: CHARACTER_FAMILY,
      rollbackGeneration: pointer.generation,
      committedAt: pointer.committedAt,
    };
  }
  return withoutKey(pointer);
}

function assertCutoverGates(gates: CharacterCutoverGates): void {
  if (Object.values(gates).some(value => !value)) {
    throw new Error('Character cutover gate is not satisfied');
  }
}

export async function commitCharacterCutover(
  database: IDBDatabase,
  options: {
    namespace: StorageNamespace;
    generation: string;
    confirmed: boolean;
    gates: CharacterCutoverGates;
    now: () => string;
    testHooks?: { abortPointerTransaction?: boolean };
  }
): Promise<IndexedDbCharacterAuthority> {
  if (!options.confirmed) {
    throw new Error('Character cutover requires explicit confirmation');
  }
  assertCutoverGates(options.gates);
  const keys = scopedCharacterAuthorityKeys(options.namespace);
  const transaction = database.transaction(
    ['meta', 'kvGenerations', 'journal'],
    'readwrite'
  );
  const meta = transaction.objectStore('meta');
  const current = (await requestResult(meta.get(keys.pointer))) as
    | ActivePointerRecord
    | undefined;
  if (current?.authority === 'indexedDB') {
    if (current.generation !== options.generation) {
      transaction.abort();
      throw new Error('A different character generation is already active');
    }
    await transactionComplete(transaction);
    return withoutKey(current);
  }
  const state = (await requestResult(meta.get(keys.state))) as
    | MigrationStateRecord
    | undefined;
  if (state?.state !== 'CUTOVER_READY' || state.runId !== options.generation) {
    transaction.abort();
    throw new Error('Character generation is not CUTOVER_READY');
  }
  const rows = (await requestResult(
    transaction.objectStore('kvGenerations').getAll()
  )) as Array<{ namespace: StorageNamespace; generation: string; key: string }>;
  if (
    !rows.some(
      row =>
        row.namespace === options.namespace &&
        row.generation === options.generation &&
        isCharacterFamilyKey(row.key)
    )
  ) {
    transaction.abort();
    throw new Error('Character generation is missing');
  }
  const journalRows = (await requestResult(
    transaction.objectStore('journal').getAll()
  )) as Array<{
    namespace?: StorageNamespace;
    family?: string;
    generation?: string;
    key?: string;
  }>;
  if (
    journalRows.some(
      row =>
        row.namespace === options.namespace &&
        row.generation === options.generation &&
        (row.family === CHARACTER_FAMILY ||
          (typeof row.key === 'string' && isCharacterFamilyKey(row.key)))
    )
  ) {
    transaction.abort();
    throw new Error('Character shadow journal is not empty');
  }
  const epochRecord = (await requestResult(meta.get(keys.epoch))) as
    | EpochRecord
    | undefined;
  const authority: IndexedDbCharacterAuthority = {
    authority: 'indexedDB',
    namespace: options.namespace,
    family: CHARACTER_FAMILY,
    generation: options.generation,
    epoch: (epochRecord?.value ?? 0) + 1,
    committedAt: options.now(),
  };
  meta.put({ key: keys.pointer, ...authority });
  meta.put({ key: keys.epoch, value: authority.epoch });
  meta.put({
    ...state,
    key: keys.state,
    state: 'IDB_PRIMARY',
    checkpointAt: authority.committedAt,
  });
  if (options.testHooks?.abortPointerTransaction) {
    transaction.abort();
    try {
      await transactionComplete(transaction);
    } catch {
      throw new Error('Atomic pointer transaction aborted');
    }
  } else {
    await transactionComplete(transaction);
  }
  return authority;
}

interface CompatibilityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CharacterWriteResult {
  saved: boolean;
  idbAck: boolean;
  mirrorAck: boolean;
  mirrorPending: boolean;
}

export async function commitCharacterFamilyWrite(
  database: IDBDatabase,
  storage: CompatibilityStorage,
  options: {
    namespace: StorageNamespace;
    key: string;
    rawValue: string;
    expectedEpoch: number;
    journalId: string;
    now: () => string;
    testHooks?: { abortActiveTransaction?: boolean };
  }
): Promise<CharacterWriteResult> {
  if (!isCharacterFamilyKey(options.key)) {
    return {
      saved: false,
      idbAck: false,
      mirrorAck: false,
      mirrorPending: false,
    };
  }
  const keys = scopedCharacterAuthorityKeys(options.namespace);
  try {
    const transaction = database.transaction(
      ['meta', 'kvGenerations', 'journal', 'conflicts'],
      'readwrite'
    );
    const pointer = (await requestResult(
      transaction.objectStore('meta').get(keys.pointer)
    )) as ActivePointerRecord | undefined;
    if (
      !pointer ||
      pointer.authority !== 'indexedDB' ||
      pointer.epoch !== options.expectedEpoch
    ) {
      transaction.objectStore('conflicts').put({
        conflictId: options.journalId,
        kind: 'stale-cutover-epoch-write',
        namespace: options.namespace,
        family: CHARACTER_FAMILY,
        key: options.key,
        rawValue: options.rawValue,
        expectedEpoch: options.expectedEpoch,
        activeEpoch: pointer?.epoch ?? null,
        detectedAt: options.now(),
        resolutionState: 'unresolved',
      });
      await transactionComplete(transaction);
      return {
        saved: false,
        idbAck: false,
        mirrorAck: false,
        mirrorPending: false,
      };
    }
    const updatedAt = options.now();
    transaction.objectStore('kvGenerations').put({
      namespace: options.namespace,
      generation: pointer.generation,
      key: options.key,
      presence: true,
      rawValue: options.rawValue,
      committedAt: updatedAt,
      cutoverEpoch: pointer.epoch,
    });
    transaction.objectStore('journal').put({
      journalId: options.journalId,
      kind: 'character-compatibility-mirror',
      namespace: options.namespace,
      family: CHARACTER_FAMILY,
      generation: pointer.generation,
      cutoverEpoch: pointer.epoch,
      key: options.key,
      rawValue: options.rawValue,
      idbAck: true,
      legacyAck: false,
      attempts: 1,
      updatedAt,
    });
    if (options.testHooks?.abortActiveTransaction) transaction.abort();
    await transactionComplete(transaction);

    try {
      storage.setItem(options.key, options.rawValue);
      const cleanup = database.transaction('journal', 'readwrite');
      cleanup.objectStore('journal').delete(options.journalId);
      await transactionComplete(cleanup);
      return {
        saved: true,
        idbAck: true,
        mirrorAck: true,
        mirrorPending: false,
      };
    } catch {
      return {
        saved: true,
        idbAck: true,
        mirrorAck: false,
        mirrorPending: true,
      };
    }
  } catch {
    return {
      saved: false,
      idbAck: false,
      mirrorAck: false,
      mirrorPending: false,
    };
  }
}

interface MirrorJournalRow {
  journalId: string;
  kind: 'character-compatibility-mirror';
  namespace: StorageNamespace;
  family: typeof CHARACTER_FAMILY;
  generation: string;
  cutoverEpoch: number;
  key: string;
  rawValue: string;
  idbAck: true;
  legacyAck: false;
  attempts: number;
  updatedAt: string;
}

export async function retryCharacterMirrorJournal(
  database: IDBDatabase,
  storage: CompatibilityStorage,
  namespace: StorageNamespace
): Promise<void> {
  const authority = await readCharacterAuthority(database, namespace);
  if (authority.authority !== 'indexedDB') return;
  const read = database.transaction('journal', 'readonly');
  const rows = (await requestResult(
    read.objectStore('journal').getAll()
  )) as MirrorJournalRow[];
  await transactionComplete(read);
  for (const row of rows.filter(
    candidate =>
      candidate.kind === 'character-compatibility-mirror' &&
      candidate.namespace === namespace &&
      candidate.family === CHARACTER_FAMILY &&
      candidate.generation === authority.generation &&
      candidate.cutoverEpoch === authority.epoch
  )) {
    try {
      storage.setItem(row.key, row.rawValue);
      const transaction = database.transaction('journal', 'readwrite');
      transaction.objectStore('journal').delete(row.journalId);
      await transactionComplete(transaction);
    } catch {
      const transaction = database.transaction('journal', 'readwrite');
      transaction.objectStore('journal').put({
        ...row,
        attempts: row.attempts + 1,
        updatedAt: new Date().toISOString(),
      });
      await transactionComplete(transaction);
    }
  }
}

export async function rollbackCharacterAuthority(
  database: IDBDatabase,
  storage: Pick<CompatibilityStorage, 'getItem'>,
  options: {
    namespace: StorageNamespace;
    expectedEpoch: number;
    confirmed: boolean;
    reopenVerified: boolean;
    now: () => string;
  }
): Promise<
  | (CharacterAuthority & { state: 'ROLLED_BACK'; rollbackGeneration: string })
  | (IndexedDbCharacterAuthority & { state: 'RECOVERY_REQUIRED' })
> {
  if (!options.confirmed)
    throw new Error('Rollback requires explicit confirmation');
  const keys = scopedCharacterAuthorityKeys(options.namespace);
  const transaction = database.transaction(
    ['meta', 'kvGenerations', 'journal'],
    'readwrite'
  );
  const meta = transaction.objectStore('meta');
  const pointer = (await requestResult(meta.get(keys.pointer))) as
    | ActivePointerRecord
    | undefined;
  if (
    pointer?.authority !== 'indexedDB' ||
    pointer.epoch !== options.expectedEpoch
  ) {
    transaction.abort();
    throw new Error('Rollback rejected for stale authority epoch');
  }
  const rows = (await requestResult(
    transaction.objectStore('kvGenerations').getAll()
  )) as Array<{
    namespace: StorageNamespace;
    generation: string;
    key: string;
    presence: boolean;
    rawValue: string | null;
  }>;
  const journals = (await requestResult(
    transaction.objectStore('journal').getAll()
  )) as Array<{ namespace?: StorageNamespace; family?: string }>;
  const authority = withoutKey(pointer);
  const activeRows = rows.filter(
    row =>
      row.namespace === options.namespace &&
      row.generation === authority.generation &&
      isCharacterFamilyKey(row.key)
  );
  const parity =
    activeRows.length > 0 &&
    activeRows.every(row =>
      row.presence
        ? storage.getItem(row.key) === row.rawValue
        : storage.getItem(row.key) === null
    );
  const journalEmpty = !journals.some(
    row =>
      row.namespace === options.namespace && row.family === CHARACTER_FAMILY
  );
  if (!parity || !journalEmpty || !options.reopenVerified) {
    meta.put({
      key: keys.state,
      state: 'RECOVERY_REQUIRED',
      runId: authority.generation,
      checkpointAt: options.now(),
    });
    await transactionComplete(transaction);
    return { ...authority, state: 'RECOVERY_REQUIRED' };
  }

  const epoch = authority.epoch + 1;
  const committedAt = options.now();
  meta.put({
    key: keys.pointer,
    authority: 'localStorage',
    namespace: options.namespace,
    family: CHARACTER_FAMILY,
    generation: authority.generation,
    epoch,
    committedAt,
  });
  meta.put({ key: keys.epoch, value: epoch });
  meta.put({
    key: keys.state,
    state: 'ROLLED_BACK',
    runId: authority.generation,
    checkpointAt: committedAt,
  });
  await transactionComplete(transaction);
  return {
    authority: 'localStorage',
    namespace: options.namespace,
    family: CHARACTER_FAMILY,
    epoch,
    committedAt,
    rollbackGeneration: authority.generation,
    state: 'ROLLED_BACK',
  };
}
