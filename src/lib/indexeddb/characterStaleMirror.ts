import { readCharacterAuthority } from './characterAuthority';
import { isCharacterFamilyKey } from './characterFamily';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';
import type { StorageNamespace } from './shadowJournal';

interface MirrorStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export async function reconcileStaleCharacterMirrorWrite(
  database: IDBDatabase,
  storage: MirrorStorage,
  options: {
    namespace: StorageNamespace;
    key: string;
    observedRawValue: string | null;
    conflictId: string;
    now: () => string;
  }
): Promise<void> {
  if (!isCharacterFamilyKey(options.key)) return;
  const authority = await readCharacterAuthority(database, options.namespace);
  if (authority.authority !== 'indexedDB') return;
  const read = database.transaction('kvGenerations', 'readonly');
  const active = (await requestResult(
    read
      .objectStore('kvGenerations')
      .get([options.namespace, authority.generation, options.key])
  )) as { presence: boolean; rawValue: string | null } | undefined;
  await transactionComplete(read);
  if (!active || !active.presence || active.rawValue === null) return;
  if (active.rawValue === options.observedRawValue) return;

  const preserve = database.transaction('conflicts', 'readwrite');
  preserve.objectStore('conflicts').put({
    conflictId: options.conflictId,
    kind: 'stale-localstorage-after-cutover',
    namespace: options.namespace,
    family: 'character',
    generation: authority.generation,
    cutoverEpoch: authority.epoch,
    key: options.key,
    staleRawValue: options.observedRawValue,
    activeRawValue: active.rawValue,
    detectedAt: options.now(),
    resolutionState: 'unresolved',
  });
  await transactionComplete(preserve);

  try {
    storage.setItem(options.key, active.rawValue);
  } catch {
    const journal = database.transaction('journal', 'readwrite');
    journal.objectStore('journal').put({
      journalId: `mirror-retry:${options.conflictId}`,
      kind: 'character-compatibility-mirror',
      namespace: options.namespace,
      family: 'character',
      generation: authority.generation,
      cutoverEpoch: authority.epoch,
      key: options.key,
      rawValue: active.rawValue,
      idbAck: true,
      legacyAck: false,
      attempts: 1,
      updatedAt: options.now(),
    });
    await transactionComplete(journal);
  }
}

export function installCharacterStaleMirrorMonitor(
  target: Window,
  namespace: StorageNamespace = 'guest'
): () => void {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || !isCharacterFamilyKey(event.key)) return;
    void (async () => {
      const database = await openRollkeeperDatabase();
      try {
        await reconcileStaleCharacterMirrorWrite(
          database,
          target.localStorage,
          {
            namespace,
            key: event.key!,
            observedRawValue: event.newValue,
            conflictId: crypto.randomUUID(),
            now: () => new Date().toISOString(),
          }
        );
      } finally {
        database.close();
      }
    })().catch(() => undefined);
  };
  target.addEventListener('storage', onStorage);
  return () => target.removeEventListener('storage', onStorage);
}
