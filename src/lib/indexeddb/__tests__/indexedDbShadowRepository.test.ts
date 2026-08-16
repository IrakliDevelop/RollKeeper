import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { IndexedDbShadowJournalRepository } from '@/lib/indexeddb/shadowJournal';

describe('IndexedDB shadow journal repository', () => {
  afterEach(async () => {
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('persists, isolates, deletes journal entries, and preserves stale candidates', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const repository = new IndexedDbShadowJournalRepository(database);
    const entry = {
      journalId: 'entry-a',
      namespace: 'guest' as const,
      generation: 'run-a',
      key: 'key',
      rawValue: 'raw',
      legacyAck: true,
      idbAck: false,
      attempts: 1,
      updatedAt: 'now',
    };
    await repository.put(entry);
    expect(await repository.list('guest')).toEqual([entry]);
    expect(await repository.list('user:user-a')).toEqual([]);
    await repository.preserveStale({
      conflictId: 'conflict-a',
      namespace: 'guest',
      generation: 'run-a',
      key: 'key',
      rawValue: 'stale',
      currentRawValue: 'current',
      detectedAt: 'now',
    });
    const tx = database.transaction('conflicts', 'readonly');
    expect(
      await requestResult(tx.objectStore('conflicts').get('conflict-a'))
    ).toMatchObject({
      kind: 'stale-shadow-write',
      rawValue: 'stale',
      resolutionState: 'unresolved',
    });
    await transactionComplete(tx);
    await repository.delete('entry-a');
    expect(await repository.list('guest')).toEqual([]);
    database.close();
  });
});
