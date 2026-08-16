import {
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

export class MigrationLockUnavailableError extends Error {
  constructor() {
    super('Another tab holds the IndexedDB migration lock');
    this.name = 'MigrationLockUnavailableError';
  }
}

interface WebLockProvider {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T>;
}

interface MigrationLockOptions {
  ownerId: string;
  now: () => number;
  leaseDurationMs?: number;
  locks?: WebLockProvider;
}

interface LeaseRecord {
  key: 'migration-lease';
  ownerId: string;
  expiresAt: number;
}

async function acquireLease(
  database: IDBDatabase,
  options: MigrationLockOptions
): Promise<void> {
  const transaction = database.transaction('meta', 'readwrite');
  const store = transaction.objectStore('meta');
  const current = (await requestResult(store.get('migration-lease'))) as
    | LeaseRecord
    | undefined;
  const now = options.now();
  if (
    current &&
    current.ownerId !== options.ownerId &&
    current.expiresAt > now
  ) {
    await transactionComplete(transaction);
    throw new MigrationLockUnavailableError();
  }
  store.put({
    key: 'migration-lease',
    ownerId: options.ownerId,
    expiresAt: now + (options.leaseDurationMs ?? 30_000),
  } satisfies LeaseRecord);
  await transactionComplete(transaction);
}

async function releaseLease(
  database: IDBDatabase,
  ownerId: string
): Promise<void> {
  const transaction = database.transaction('meta', 'readwrite');
  const store = transaction.objectStore('meta');
  const current = (await requestResult(store.get('migration-lease'))) as
    | LeaseRecord
    | undefined;
  if (current?.ownerId === ownerId) store.delete('migration-lease');
  await transactionComplete(transaction);
}

export async function withMigrationLock<T>(
  database: IDBDatabase,
  task: () => Promise<T> | T,
  options: MigrationLockOptions
): Promise<T> {
  if (options.locks) {
    return options.locks.request(
      'rollkeeper:indexeddb-migration',
      { mode: 'exclusive' },
      task
    );
  }

  await acquireLease(database, options);
  try {
    return await task();
  } finally {
    await releaseLease(database, options.ownerId);
  }
}
