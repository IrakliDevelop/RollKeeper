import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { IndexedDbShadowJournalRepository } from '@/lib/indexeddb/shadowJournal';

interface MigrationStateRecord {
  state?: string;
  runId?: string;
}

export async function recordAuthoritativeShadowWrite(
  key: string,
  rawValue: string
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  let database: IDBDatabase | undefined;
  try {
    database = await openRollkeeperDatabase();
    const stateTransaction = database.transaction('meta', 'readonly');
    const state = (await requestResult(
      stateTransaction.objectStore('meta').get('migration-state:guest')
    )) as MigrationStateRecord | undefined;
    await transactionComplete(stateTransaction);
    if (
      !state?.runId ||
      (state.state !== 'SHADOWING' && state.state !== 'CUTOVER_READY')
    ) {
      return;
    }

    const journalId = crypto.randomUUID();
    const repository = new IndexedDbShadowJournalRepository(database);
    const entry = {
      journalId,
      namespace: 'guest' as const,
      generation: state.runId,
      key,
      rawValue,
      legacyAck: true,
      idbAck: false,
      attempts: 1,
      updatedAt: new Date().toISOString(),
    };
    await repository.put(entry);
    try {
      const transaction = database.transaction('kvGenerations', 'readwrite');
      transaction.objectStore('kvGenerations').put({
        namespace: 'guest',
        generation: state.runId,
        key,
        presence: true,
        rawValue,
        shadowedAt: entry.updatedAt,
      });
      await transactionComplete(transaction);
      await repository.delete(journalId);
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
