import {
  openExistingRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

export interface PlayerBackupRunV1 {
  version: 1;
  runId: string;
  accountId: string;
  namespace: `user:${string}`;
  mode: 'one-time' | 'ongoing';
  stage: string;
  confirmedAt: string;
}

interface ActiveRunPointer {
  key: string;
  runId: string;
  accountId: string;
}

export function playerBackupRunKey(runId: string): string {
  return `player-backup-run:${runId}`;
}

export function playerBackupActiveRunKey(accountId: string): string {
  return `player-backup-active-run:${accountId}`;
}

function isRun(value: unknown, accountId: string): value is PlayerBackupRunV1 {
  if (typeof value !== 'object' || value === null) return false;
  const run = value as Partial<PlayerBackupRunV1>;
  return (
    run.version === 1 &&
    typeof run.runId === 'string' &&
    run.accountId === accountId &&
    run.namespace === `user:${accountId}` &&
    (run.mode === 'one-time' || run.mode === 'ongoing') &&
    typeof run.stage === 'string' &&
    typeof run.confirmedAt === 'string'
  );
}

/** Passive discovery only. It never creates or upgrades rollkeeper-local. */
export async function readActivePlayerBackupRun(options: {
  accountId: string;
  factory?: IDBFactory | null;
}): Promise<PlayerBackupRunV1 | null> {
  const database = await openExistingRollkeeperDatabase({
    factory: options.factory,
  });
  if (!database) return null;
  try {
    const transaction = database.transaction('meta', 'readonly');
    const store = transaction.objectStore('meta');
    const pointer = (await requestResult(
      store.get(playerBackupActiveRunKey(options.accountId))
    )) as ActiveRunPointer | undefined;
    const run = pointer
      ? await requestResult(store.get(playerBackupRunKey(pointer.runId)))
      : undefined;
    await transactionComplete(transaction);
    return pointer?.accountId === options.accountId &&
      isRun(run, options.accountId)
      ? run
      : null;
  } finally {
    database.close();
  }
}
