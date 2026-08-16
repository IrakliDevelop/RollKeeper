import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

interface MigrationStateRecord {
  state?: string;
  runId?: string;
}

export async function recordAuthoritativeShadowWrite(
  key: string,
  rawValue: string,
  scope: { namespace: StorageNamespace; family?: string } = {
    namespace: 'guest',
  }
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  let database: IDBDatabase | undefined;
  try {
    database = await openRollkeeperDatabase();
    const stateKey = `migration-state:${scope.namespace}${scope.family ? `:${scope.family}` : ''}`;
    const stateTransaction = database.transaction(
      ['meta', 'journal'],
      'readwrite'
    );
    const state = (await requestResult(
      stateTransaction.objectStore('meta').get(stateKey)
    )) as MigrationStateRecord | undefined;
    if (
      !state?.runId ||
      (state.state !== 'SHADOWING' && state.state !== 'CUTOVER_READY')
    ) {
      await transactionComplete(stateTransaction);
      return;
    }

    const journalId = crypto.randomUUID();
    const entry = {
      journalId,
      namespace: scope.namespace,
      generation: state.runId,
      key,
      rawValue,
      legacyAck: true,
      idbAck: false,
      attempts: 1,
      updatedAt: new Date().toISOString(),
    };
    stateTransaction.objectStore('journal').put(entry);
    await transactionComplete(stateTransaction);
    try {
      const transaction = database.transaction(
        ['meta', 'kvGenerations', 'journal'],
        'readwrite'
      );
      const current = (await requestResult(
        transaction.objectStore('meta').get(stateKey)
      )) as MigrationStateRecord | undefined;
      if (
        current?.runId !== state.runId ||
        (current.state !== 'SHADOWING' && current.state !== 'CUTOVER_READY')
      ) {
        await transactionComplete(transaction);
        return;
      }
      transaction.objectStore('kvGenerations').put({
        namespace: scope.namespace,
        generation: state.runId,
        key,
        presence: true,
        rawValue,
        shadowedAt: entry.updatedAt,
      });
      transaction.objectStore('journal').delete(journalId);
      await transactionComplete(transaction);
    } catch {
      // The durable journal is intentionally retained for the next bootstrap.
    }
  } catch {
    // localStorage already acknowledged the authoritative write. Shadow failure
    // must not change that result and is retried when IndexedDB becomes usable.
  } finally {
    database?.close();
  }
}
