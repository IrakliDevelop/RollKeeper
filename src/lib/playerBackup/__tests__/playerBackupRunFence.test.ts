import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

import {
  type PlayerBackupExclusiveLockProvider,
  PlayerBackupLockUnavailableError,
  hasPlayerBackupExclusiveLockCapability,
  mutatePlayerBackupWithFence,
  runPlayerBackupTransaction,
  withPlayerBackupAccountLock,
} from '../playerBackupRunFence';

class QueuedLocks implements PlayerBackupExclusiveLockProvider {
  private tails = new Map<string, Promise<void>>();

  async request<T>(
    name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> {
    const previous = this.tails.get(name) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    this.tails.set(
      name,
      previous.then(() => current)
    );
    await previous;
    try {
      return await callback();
    } finally {
      release();
      if (this.tails.get(name) === current) this.tails.delete(name);
    }
  }
}

async function seedPointer(
  database: IDBDatabase,
  runId: string,
  accountId = 'account-a'
) {
  const transaction = database.transaction('meta', 'readwrite');
  transaction.objectStore('meta').put({
    key: `player-backup-active-run:${accountId}`,
    runId,
    accountId,
  });
  await transactionComplete(transaction);
}

describe('player backup run fence', () => {
  let database: IDBDatabase;

  beforeEach(async () => {
    database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedPointer(database, 'run-a');
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('fails closed without an exclusive account lock capability', async () => {
    const task = vi.fn();
    expect(hasPlayerBackupExclusiveLockCapability(undefined)).toBe(false);
    await expect(
      withPlayerBackupAccountLock(
        { accountId: 'account-a', locks: undefined },
        task
      )
    ).rejects.toBeInstanceOf(PlayerBackupLockUnavailableError);
    expect(task).not.toHaveBeenCalled();
  });

  it('checks expectedActiveRunId inside the same local work transaction', async () => {
    await seedPointer(database, 'run-new');
    await expect(
      runPlayerBackupTransaction({
        database,
        accountId: 'account-a',
        expectedActiveRunId: 'run-a',
        stores: ['documents'],
        task: transaction => {
          transaction.objectStore('documents').put({
            namespace: 'user:account-a',
            family: 'character',
            legacyId: 'hero-a',
            originPlayerBackupRunId: 'run-a',
          });
        },
      })
    ).rejects.toThrow(/replaced/i);

    const read = database.transaction('documents', 'readonly');
    const rows = await requestResult(read.objectStore('documents').getAll());
    await transactionComplete(read);
    expect(rows).toEqual([]);
  });

  it('rechecks immediately before a gateway call and makes no stale mutation', async () => {
    const gateway = vi.fn();
    await seedPointer(database, 'run-new');
    await expect(
      mutatePlayerBackupWithFence({
        accountId: 'account-a',
        expectedActiveRunId: 'run-a',
        locks: new QueuedLocks(),
        factory: indexedDB,
        mutateAndAcknowledge: gateway,
      })
    ).rejects.toThrow(/replaced/i);
    expect(gateway).not.toHaveBeenCalled();
  });

  it('holds the account lock through durable acknowledgement', async () => {
    const locks = new QueuedLocks();
    let acknowledge!: () => void;
    const acknowledgement = new Promise<void>(resolve => {
      acknowledge = resolve;
    });
    const order: string[] = [];
    const mutation = mutatePlayerBackupWithFence({
      accountId: 'account-a',
      expectedActiveRunId: 'run-a',
      locks,
      factory: indexedDB,
      mutateAndAcknowledge: async () => {
        order.push('gateway');
        await acknowledgement;
        order.push('acknowledged');
      },
    });
    await vi.waitFor(() => expect(order).toEqual(['gateway']));

    const replacement = withPlayerBackupAccountLock(
      { accountId: 'account-a', locks },
      () => {
        order.push('replacement');
      }
    );
    await Promise.resolve();
    expect(order).toEqual(['gateway']);

    acknowledge();
    await Promise.all([mutation, replacement]);
    expect(order).toEqual(['gateway', 'acknowledged', 'replacement']);
  });

  it('does not serialize different accounts on one lock name', async () => {
    const locks = new QueuedLocks();
    let releaseA!: () => void;
    const holdA = new Promise<void>(resolve => {
      releaseA = resolve;
    });
    const entered: string[] = [];
    const accountA = withPlayerBackupAccountLock(
      { accountId: 'account-a', locks },
      async () => {
        entered.push('a');
        await holdA;
      }
    );
    const accountB = withPlayerBackupAccountLock(
      { accountId: 'account-b', locks },
      () => {
        entered.push('b');
      }
    );
    await accountB;
    expect(entered).toEqual(['a', 'b']);
    releaseA();
    await accountA;
  });
});
