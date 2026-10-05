import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import {
  TABLE_DATABASE_NAME,
  TABLE_DATABASE_VERSION,
  TABLE_OBJECT_STORE_NAMES,
  openTableDatabase,
} from './database';

describe('table database', () => {
  it('creates only the isolated v1 stores with the contracted key paths', async () => {
    const factory = new IDBFactory();
    const database = await openTableDatabase({ factory });

    expect(database.name).toBe(TABLE_DATABASE_NAME);
    expect(database.name).not.toBe('rollkeeper-local');
    expect(database.version).toBe(TABLE_DATABASE_VERSION);
    expect([...database.objectStoreNames]).toEqual(TABLE_OBJECT_STORE_NAMES);

    const transaction = database.transaction(
      TABLE_OBJECT_STORE_NAMES,
      'readonly'
    );
    expect(transaction.objectStore('campaigns').keyPath).toBe('workspaceKey');
    expect(transaction.objectStore('scenes').keyPath).toEqual([
      'workspaceKey',
      'sceneId',
    ]);
    expect(transaction.objectStore('actors').keyPath).toEqual([
      'workspaceKey',
      'actorId',
    ]);
    expect(transaction.objectStore('encounters').keyPath).toEqual([
      'workspaceKey',
      'runId',
    ]);
    expect(transaction.objectStore('logs').keyPath).toEqual([
      'workspaceKey',
      'archiveId',
    ]);
    expect(transaction.objectStore('operations').keyPath).toEqual([
      'workspaceKey',
      'operationId',
    ]);
    expect(transaction.objectStore('sources').keyPath).toEqual([
      'workspaceKey',
      'sourceKey',
    ]);
    expect(transaction.objectStore('tombstones').keyPath).toEqual([
      'workspaceKey',
      'kind',
      'id',
    ]);
    database.close();
  });

  it('fails closed when IndexedDB is unavailable', async () => {
    await expect(openTableDatabase({ factory: null })).rejects.toThrow(
      'IndexedDB is unavailable'
    );
  });
});
