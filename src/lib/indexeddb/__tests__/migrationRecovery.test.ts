import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { afterEach, describe, expect, it } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { captureLegacySources } from '@/lib/indexeddb/migrationCapture';
import {
  exportMigrationRecovery,
  importMigrationRecovery,
  validateMigrationRecoveryJson,
} from '@/lib/indexeddb/migrationRecovery';

describe('migration recovery export/import', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('round-trips exact immutable captures into an inactive recovery run', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      ' {"state":{},"version":1}\n'
    );
    let database = await openRollkeeperDatabase({ factory: indexedDB });
    const manifest = await captureLegacySources({
      database,
      storage: localStorage,
      runId: 'run-export',
      now: () => '2026-08-16T10:00:00.000Z',
    });
    const serialized = await exportMigrationRecovery(
      database,
      'run-export',
      'guest'
    );
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);

    database = await openRollkeeperDatabase({ factory: indexedDB });
    const imported = await importMigrationRecovery(database, serialized);
    expect(imported).toMatchObject({
      format: 'rollkeeper-indexeddb-migration-recovery',
      formatVersion: 1,
      namespace: 'guest',
      status: 'inactive',
      manifest,
    });
    const tx = database.transaction(['legacySnapshots', 'meta'], 'readonly');
    const snapshots = await requestResult(
      tx.objectStore('legacySnapshots').getAll()
    );
    expect(
      snapshots.find(snapshot => snapshot.key === 'rollkeeper-player-data')
    ).toMatchObject({ rawValue: ' {"state":{},"version":1}\n' });
    expect(
      await requestResult(tx.objectStore('meta').get('active-generation'))
    ).toBeUndefined();
    await transactionComplete(tx);
    database.close();
  });

  it('rejects tampering and same-run collisions without mutating existing recovery data', async () => {
    localStorage.setItem('rollkeeper-player-data', '{"state":{},"version":1}');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await captureLegacySources({
      database,
      storage: localStorage,
      runId: 'run-collision',
      now: () => 'now',
    });
    const serialized = await exportMigrationRecovery(
      database,
      'run-collision',
      'guest'
    );
    const parsed = JSON.parse(serialized);
    parsed.snapshots[0].rawValue = 'different';
    const tampered = JSON.stringify(parsed);
    await expect(validateMigrationRecoveryJson(tampered)).rejects.toThrow(
      /checksum/i
    );
    await expect(importMigrationRecovery(database, tampered)).rejects.toThrow(
      /checksum/i
    );

    const tx = database.transaction('legacySnapshots', 'readonly');
    const existing = await requestResult(
      tx.objectStore('legacySnapshots').getAll()
    );
    await transactionComplete(tx);
    expect(existing.some(snapshot => snapshot.rawValue === 'different')).toBe(
      false
    );
    database.close();
  });

  it('validates shape/version and supports idempotent import while rejecting a valid same-run collision', async () => {
    await expect(validateMigrationRecoveryJson('not json')).rejects.toThrow(
      /not valid JSON/i
    );
    await expect(validateMigrationRecoveryJson('null')).rejects.toThrow(
      /invalid/i
    );
    await expect(
      validateMigrationRecoveryJson(
        JSON.stringify({ format: 'wrong', formatVersion: 99 })
      )
    ).rejects.toThrow(/invalid/i);

    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"source":"a"},"version":1}'
    );
    const target = await openRollkeeperDatabase({ factory: indexedDB });
    await captureLegacySources({
      database: target,
      storage: localStorage,
      runId: 'same-run',
      now: () => 'a',
    });
    const same = await exportMigrationRecovery(target, 'same-run', 'guest');
    await expect(importMigrationRecovery(target, same)).resolves.toMatchObject({
      manifest: { runId: 'same-run' },
    });

    const sourceFactory = new IDBFactory();
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"source":"b"},"version":1}'
    );
    const source = await openRollkeeperDatabase({ factory: sourceFactory });
    await captureLegacySources({
      database: source,
      storage: localStorage,
      runId: 'same-run',
      now: () => 'b',
    });
    const collision = await exportMigrationRecovery(
      source,
      'same-run',
      'guest'
    );
    await expect(importMigrationRecovery(target, collision)).rejects.toThrow(
      /immutable.*collision/i
    );
    source.close();
    target.close();
  });
});
