export const DATABASE_NAME = 'rollkeeper-local';
export const DATABASE_VERSION = 1;

// IDBDatabase.objectStoreNames is lexicographically ordered.
export const OBJECT_STORE_NAMES = [
  'conflicts',
  'documents',
  'intents',
  'journal',
  'kvGenerations',
  'legacySnapshots',
  'meta',
  'outbox',
  'quarantine',
  'tombstones',
] as const;

export type ObjectStoreName = (typeof OBJECT_STORE_NAMES)[number];

export interface OpenDatabaseOptions {
  factory?: IDBFactory | null;
  onBlocked?: () => void;
  onVersionChange?: (database: IDBDatabase) => void;
}

const STORE_DEFINITIONS: Readonly<
  Record<ObjectStoreName, IDBObjectStoreParameters>
> = {
  meta: { keyPath: 'key' },
  legacySnapshots: { keyPath: ['runId', 'key', 'captureNumber'] },
  kvGenerations: { keyPath: ['namespace', 'generation', 'key'] },
  documents: { keyPath: ['namespace', 'family', 'legacyId'] },
  intents: { keyPath: 'intentId' },
  outbox: { keyPath: 'mutationId' },
  tombstones: { keyPath: ['namespace', 'family', 'legacyId'] },
  conflicts: { keyPath: 'conflictId' },
  quarantine: { keyPath: 'quarantineId' },
  journal: { keyPath: 'journalId' },
};

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export function transactionComplete(
  transaction: IDBTransaction
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

export function openRollkeeperDatabase(
  options: OpenDatabaseOptions = {}
): Promise<IDBDatabase> {
  const factory =
    options.factory === null ? null : (options.factory ?? globalThis.indexedDB);
  if (!factory) return Promise.reject(new Error('IndexedDB is unavailable'));

  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const name of OBJECT_STORE_NAMES) {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name, STORE_DEFINITIONS[name]);
        }
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        options.onVersionChange?.(database);
        database.close();
      };
      resolve(database);
    };
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => {
      options.onBlocked?.();
      reject(new Error('rollkeeper-local database open is blocked'));
    };
  });
}

export function openExistingRollkeeperDatabase(
  options: OpenDatabaseOptions = {}
): Promise<IDBDatabase | null> {
  const factory =
    options.factory === null ? null : (options.factory ?? globalThis.indexedDB);
  if (!factory) return Promise.reject(new Error('IndexedDB is unavailable'));

  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME);
    let abortedCreation = false;
    let settled = false;
    const resolveOnce = (value: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const rejectOnce = (cause: unknown) => {
      if (settled) return;
      settled = true;
      reject(cause);
    };

    request.onupgradeneeded = () => {
      abortedCreation = true;
      request.transaction?.abort();
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      if (abortedCreation) {
        database.close();
        resolveOnce(null);
        return;
      }
      const compatible =
        database.version === DATABASE_VERSION &&
        OBJECT_STORE_NAMES.every(name =>
          database.objectStoreNames.contains(name)
        ) &&
        database.objectStoreNames.length === OBJECT_STORE_NAMES.length;
      if (!compatible) {
        database.close();
        rejectOnce(
          new Error('Existing rollkeeper-local database is incompatible')
        );
        return;
      }
      database.onversionchange = () => {
        options.onVersionChange?.(database);
        database.close();
      };
      resolveOnce(database);
    };
    request.onerror = () => {
      if (abortedCreation && request.error?.name === 'AbortError') {
        resolveOnce(null);
        return;
      }
      rejectOnce(request.error ?? new Error('IndexedDB open failed'));
    };
    request.onblocked = () => {
      options.onBlocked?.();
      rejectOnce(new Error('rollkeeper-local database open is blocked'));
    };
  });
}

export function deleteRollkeeperDatabaseForTests(
  factory: IDBFactory
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database deletion blocked'));
  });
}
