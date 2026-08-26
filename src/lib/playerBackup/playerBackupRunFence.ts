import {
  type ObjectStoreName,
  openExistingRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

import {
  type ActiveRunPointer,
  PlayerBackupRunReplacedError,
  playerBackupActiveRunKey,
} from './playerBackupRunRepository';

export const PLAYER_BACKUP_ACCOUNT_LOCK_PREFIX =
  'rollkeeper:player-backup-account:';

export interface PlayerBackupExclusiveLockProvider {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T>;
}

export class PlayerBackupLockUnavailableError extends Error {
  constructor() {
    super('The exclusive player backup lock is unavailable');
    this.name = 'PlayerBackupLockUnavailableError';
  }
}

export function hasPlayerBackupExclusiveLockCapability(
  locks: PlayerBackupExclusiveLockProvider | null | undefined
): locks is PlayerBackupExclusiveLockProvider {
  return typeof locks?.request === 'function';
}

export function playerBackupAccountLockName(accountId: string): string {
  if (!accountId) throw new Error('A player backup account is required');
  return `${PLAYER_BACKUP_ACCOUNT_LOCK_PREFIX}${accountId}`;
}

export async function withPlayerBackupAccountLock<T>(
  options: {
    accountId: string;
    locks: PlayerBackupExclusiveLockProvider | null | undefined;
  },
  task: () => Promise<T> | T
): Promise<T> {
  if (!hasPlayerBackupExclusiveLockCapability(options.locks)) {
    throw new PlayerBackupLockUnavailableError();
  }
  return options.locks.request(
    playerBackupAccountLockName(options.accountId),
    { mode: 'exclusive' },
    task
  );
}

async function readAndAssertPointer(
  meta: IDBObjectStore,
  accountId: string,
  expectedActiveRunId: string
): Promise<void> {
  const pointer = (await requestResult(
    meta.get(playerBackupActiveRunKey(accountId))
  )) as ActiveRunPointer | undefined;
  if (
    pointer?.accountId !== accountId ||
    pointer.runId !== expectedActiveRunId
  ) {
    throw new PlayerBackupRunReplacedError();
  }
}

export async function runPlayerBackupTransaction<T>(options: {
  database: IDBDatabase;
  accountId: string;
  expectedActiveRunId: string;
  stores: readonly ObjectStoreName[];
  task: (transaction: IDBTransaction) => Promise<T> | T;
}): Promise<T> {
  const storeNames = [...new Set<ObjectStoreName>(['meta', ...options.stores])];
  const transaction = options.database.transaction(storeNames, 'readwrite');
  const completion = transactionComplete(transaction);
  try {
    await readAndAssertPointer(
      transaction.objectStore('meta'),
      options.accountId,
      options.expectedActiveRunId
    );
    const result = await options.task(transaction);
    await completion;
    return result;
  } catch (cause) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have completed or aborted.
    }
    await completion.catch(() => undefined);
    throw cause;
  }
}

export async function assertActivePlayerBackupRun(options: {
  accountId: string;
  expectedActiveRunId: string;
  factory?: IDBFactory | null;
}): Promise<void> {
  const database = await openExistingRollkeeperDatabase({
    factory: options.factory,
  });
  if (!database) throw new PlayerBackupRunReplacedError();
  try {
    const transaction = database.transaction('meta', 'readonly');
    await readAndAssertPointer(
      transaction.objectStore('meta'),
      options.accountId,
      options.expectedActiveRunId
    );
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

/**
 * The callback covers both the gateway request and its durable local
 * acknowledgement. The account lock is deliberately retained until it returns.
 */
export async function mutatePlayerBackupWithFence<T>(options: {
  accountId: string;
  expectedActiveRunId: string;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  factory?: IDBFactory | null;
  mutateAndAcknowledge: () => Promise<T> | T;
}): Promise<T> {
  return withPlayerBackupAccountLock(
    { accountId: options.accountId, locks: options.locks },
    async () => {
      await assertActivePlayerBackupRun({
        accountId: options.accountId,
        expectedActiveRunId: options.expectedActiveRunId,
        factory: options.factory,
      });
      return options.mutateAndAcknowledge();
    }
  );
}
