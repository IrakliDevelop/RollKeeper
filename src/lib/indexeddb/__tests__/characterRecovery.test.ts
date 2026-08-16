import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { captureDeviceBackup } from '@/lib/deviceRecovery';
import {
  activateImportedCharacterGeneration,
  importCharacterRecoveryGeneration,
} from '@/lib/indexeddb/characterRecovery';
import {
  commitCharacterCutover,
  readCharacterAuthority,
} from '@/lib/indexeddb/characterAuthority';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

async function seedActive(database: IDBDatabase, raw: string) {
  const tx = database.transaction(['meta', 'kvGenerations'], 'readwrite');
  tx.objectStore('meta').put({
    key: 'migration-state:guest:character',
    state: 'CUTOVER_READY',
    runId: 'active',
    checkpointAt: 'before',
  });
  tx.objectStore('kvGenerations').put({
    namespace: 'guest',
    generation: 'active',
    key: 'rollkeeper-player-data',
    presence: true,
    rawValue: raw,
  });
  await transactionComplete(tx);
  await commitCharacterCutover(database, {
    namespace: 'guest',
    generation: 'active',
    confirmed: true,
    now: () => 'active',
    gates: {
      recoveryReceipt: true,
      sourceManifestUnchanged: true,
      captureVerifiedAfterReopen: true,
      noQuarantine: true,
      parity: true,
      journalEmpty: true,
    },
  });
}

describe('post-cutover character recovery', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('validates before parsing, imports only to a new inactive generation, and requires explicit activation', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'import-a',
      timestamp: 'now',
    });
    const serialized = JSON.stringify(bundle);
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const preview = await importCharacterRecoveryGeneration(
      database,
      serialized,
      'guest'
    );
    expect(preview).toMatchObject({
      generation: 'recovery:import-a',
      status: 'inactive',
      entryCount: 1,
      quarantineCount: 0,
    });
    expect(await readCharacterAuthority(database, 'guest')).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'recovery:import-a',
        confirmed: false,
        now: () => 'later',
      })
    ).rejects.toThrow(/explicit confirmation/i);

    const tampered = JSON.parse(serialized);
    tampered.entries[0].rawValue = 'tampered';
    await expect(
      importCharacterRecoveryGeneration(
        database,
        JSON.stringify(tampered),
        'guest'
      )
    ).rejects.toThrow(/checksum/i);
    database.close();
  });

  it('never replaces newer active edits with a stale imported snapshot and preserves both as a conflict', async () => {
    const oldRaw = '{"state":{"characters":[],"revision":1},"version":1}';
    const newRaw = '{"state":{"characters":[],"revision":2},"version":1}';
    localStorage.setItem('rollkeeper-player-data', oldRaw);
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'stale',
      timestamp: 'old',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedActive(database, newRaw);
    const extra = database.transaction('kvGenerations', 'readwrite');
    extra.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-character:extra',
      presence: true,
      rawValue: '{"state":{"character":{"id":"extra"}}}',
    });
    await transactionComplete(extra);
    await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(bundle),
      'guest'
    );
    const result = await activateImportedCharacterGeneration(database, {
      namespace: 'guest',
      generation: 'recovery:stale',
      confirmed: true,
      now: () => 'later',
    });
    expect(result).toMatchObject({
      activated: false,
      conflictCount: 2,
      state: 'RECOVERY_REQUIRED',
    });
    expect(await readCharacterAuthority(database, 'guest')).toMatchObject({
      authority: 'indexedDB',
      generation: 'active',
      epoch: 1,
    });
    const tx = database.transaction('conflicts', 'readonly');
    expect(await requestResult(tx.objectStore('conflicts').getAll())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'recovery-generation-divergence',
          activeRawValue: newRaw,
          importedRawValue: oldRaw,
        }),
        expect.objectContaining({
          key: 'rollkeeper-character:extra',
          importedRawValue: null,
        }),
      ])
    );
    await transactionComplete(tx);
    database.close();
  });

  it('activates an identical imported generation at a new epoch without deleting the old generation', async () => {
    const raw = '{"state":{"characters":[]},"version":1}';
    localStorage.setItem('rollkeeper-player-data', raw);
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'same',
      timestamp: 'old',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedActive(database, raw);
    await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(bundle),
      'guest'
    );
    const result = await activateImportedCharacterGeneration(database, {
      namespace: 'guest',
      generation: 'recovery:same',
      confirmed: true,
      now: () => 'later',
    });
    expect(result).toMatchObject({
      activated: true,
      epoch: 2,
      generation: 'recovery:same',
    });
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'recovery:same',
        confirmed: true,
        now: () => 'even-later',
      })
    ).resolves.toEqual(result);
    const tx = database.transaction('kvGenerations', 'readonly');
    const rows = await requestResult(tx.objectStore('kvGenerations').getAll());
    expect(new Set(rows.map(row => row.generation))).toEqual(
      new Set(['active', 'recovery:same'])
    );
    await transactionComplete(tx);
    database.close();
  });

  it('supports idempotent import, rejects immutable collisions, and rejects missing/empty generations', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"source":"a","characters":[]},"version":1}'
    );
    const first = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'collision',
      timestamp: 'a',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(first),
      'guest'
    );
    await expect(
      importCharacterRecoveryGeneration(
        database,
        JSON.stringify(first),
        'guest'
      )
    ).resolves.toMatchObject({ status: 'inactive' });
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"source":"b","characters":[]},"version":1}'
    );
    const second = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'collision',
      timestamp: 'b',
    });
    await expect(
      importCharacterRecoveryGeneration(
        database,
        JSON.stringify(second),
        'guest'
      )
    ).rejects.toThrow(/collision/i);
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'missing',
        confirmed: true,
        now: () => 'now',
      })
    ).rejects.toThrow(/not found/i);
    const empty = database.transaction('meta', 'readwrite');
    empty.objectStore('meta').put({
      key: 'character-recovery:guest:empty',
      generation: 'empty',
      namespace: 'guest',
      status: 'inactive',
      bundleHash: 'hash',
      quarantineCount: 0,
      importedAt: 'now',
    });
    await transactionComplete(empty);
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'empty',
        confirmed: true,
        now: () => 'now',
      })
    ).rejects.toThrow(/empty/i);
    database.close();
  });

  it('blocks quarantined or journaled imports without hiding their raw values', async () => {
    localStorage.setItem('rollkeeper-player-data', '{broken');
    const malformed = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'malformed',
      timestamp: 'old',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const preview = await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(malformed),
      'guest'
    );
    expect(preview.quarantineCount).toBe(1);
    const blocked = await activateImportedCharacterGeneration(database, {
      namespace: 'guest',
      generation: 'recovery:malformed',
      confirmed: true,
      now: () => 'now',
    });
    expect(blocked).toMatchObject({
      activated: false,
      state: 'RECOVERY_REQUIRED',
    });

    const raw = '{"state":{"characters":[]},"version":1}';
    localStorage.setItem('rollkeeper-player-data', raw);
    const journaled = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'journaled',
      timestamp: 'old',
    });
    await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(journaled),
      'user:a'
    );
    const journal = database.transaction('journal', 'readwrite');
    journal
      .objectStore('journal')
      .put({ journalId: 'pending', namespace: 'user:a', family: 'character' });
    await transactionComplete(journal);
    const result = await activateImportedCharacterGeneration(database, {
      namespace: 'user:a',
      generation: 'recovery:journaled',
      confirmed: true,
      now: () => 'now',
    });
    expect(result).toMatchObject({
      activated: false,
      state: 'RECOVERY_REQUIRED',
    });
    const read = database.transaction('kvGenerations', 'readonly');
    expect(
      await requestResult(
        read
          .objectStore('kvGenerations')
          .get(['guest', 'recovery:malformed', 'rollkeeper-player-data'])
      )
    ).toMatchObject({ rawValue: '{broken' });
    await transactionComplete(read);
    database.close();
  });
});
