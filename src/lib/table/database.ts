export const TABLE_DATABASE_NAME = 'rollkeeper-table';
export const TABLE_DATABASE_VERSION = 1;

// IDBDatabase.objectStoreNames is returned in lexicographic order.
export const TABLE_OBJECT_STORE_NAMES = [
  'actors',
  'campaigns',
  'encounters',
  'logs',
  'operations',
  'scenes',
  'sources',
  'tombstones',
] as const;

export type TableObjectStoreName = (typeof TABLE_OBJECT_STORE_NAMES)[number];

export interface OpenTableDatabaseOptions {
  factory?: IDBFactory | null;
  onBlocked?: () => void;
  onVersionChange?: (database: IDBDatabase) => void;
}

const STORE_DEFINITIONS: Readonly<
  Record<TableObjectStoreName, IDBObjectStoreParameters>
> = {
  campaigns: { keyPath: 'workspaceKey' },
  scenes: { keyPath: ['workspaceKey', 'sceneId'] },
  actors: { keyPath: ['workspaceKey', 'actorId'] },
  encounters: { keyPath: ['workspaceKey', 'runId'] },
  logs: { keyPath: ['workspaceKey', 'archiveId'] },
  operations: { keyPath: ['workspaceKey', 'operationId'] },
  sources: { keyPath: ['workspaceKey', 'sourceKey'] },
  tombstones: { keyPath: ['workspaceKey', 'kind', 'id'] },
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

export function openTableDatabase(
  options: OpenTableDatabaseOptions = {}
): Promise<IDBDatabase> {
  const factory =
    options.factory === null ? null : (options.factory ?? globalThis.indexedDB);
  if (!factory) return Promise.reject(new Error('IndexedDB is unavailable'));

  return new Promise((resolve, reject) => {
    const request = factory.open(TABLE_DATABASE_NAME, TABLE_DATABASE_VERSION);
    let settled = false;
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      for (const name of TABLE_OBJECT_STORE_NAMES) {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name, STORE_DEFINITIONS[name]);
        }
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      const compatible =
        database.version === TABLE_DATABASE_VERSION &&
        TABLE_OBJECT_STORE_NAMES.every(name =>
          database.objectStoreNames.contains(name)
        ) &&
        database.objectStoreNames.length === TABLE_OBJECT_STORE_NAMES.length;
      if (!compatible) {
        database.close();
        rejectOnce(new Error('rollkeeper-table database is incompatible'));
        return;
      }
      settled = true;
      database.onversionchange = () => {
        options.onVersionChange?.(database);
        database.close();
      };
      resolve(database);
    };
    request.onerror = () =>
      rejectOnce(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => {
      options.onBlocked?.();
      rejectOnce(new Error('rollkeeper-table database open is blocked'));
    };
  });
}

export function deleteTableDatabaseForTests(
  factory: IDBFactory
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(TABLE_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB database deletion failed'));
    request.onblocked = () =>
      reject(new Error('rollkeeper-table database deletion is blocked'));
  });
}
