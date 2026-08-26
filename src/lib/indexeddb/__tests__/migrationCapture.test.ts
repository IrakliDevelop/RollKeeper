import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import {
  captureLegacySources,
  sha256Bytes,
  verifyPersistedCapture,
} from '@/lib/indexeddb/migrationCapture';
import { captureDeviceBackup } from '@/lib/deviceRecovery';

describe('immutable legacy capture', () => {
  afterEach(async () => {
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('captures exact raw bytes, presence, hashes, sizes, timestamps, run/key/capture identity, and commits the manifest last', async () => {
    localStorage.clear();
    localStorage.setItem(
      'rollkeeper-player-data',
      ' {"state":{"unknown":null},"version":1}\n'
    );
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const manifest = await captureLegacySources({
      database,
      storage: localStorage,
      runId: 'run-a',
      now: () => '2026-08-16T10:00:00.000Z',
    });

    const player = manifest.entries.find(
      entry => entry.key === 'rollkeeper-player-data'
    );
    expect(player).toMatchObject({
      runId: 'run-a',
      key: 'rollkeeper-player-data',
      captureNumber: 1,
      presence: true,
      byteCount: 40,
      timestamp: '2026-08-16T10:00:00.000Z',
    });
    expect(player?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      manifest.entries.find(entry => entry.key === 'rollkeeper-dm-data')
    ).toMatchObject({ presence: false, byteCount: 0 });

    const tx = database.transaction(['legacySnapshots', 'meta'], 'readonly');
    const snapshots = await requestResult(
      tx.objectStore('legacySnapshots').getAll()
    );
    const storedManifest = await requestResult(
      tx.objectStore('meta').get('source-manifest:run-a')
    );
    await transactionComplete(tx);
    expect(snapshots.length).toBeGreaterThanOrEqual(manifest.entries.length);
    expect(storedManifest).toEqual({
      key: 'source-manifest:run-a',
      value: manifest,
    });
    database.close();

    await expect(
      verifyPersistedCapture({ factory: indexedDB, runId: 'run-a' })
    ).resolves.toEqual(manifest);
  });

  it('re-reads every source, preserves numbered captures on mutation, and is idempotent once stable', async () => {
    localStorage.clear();
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"n":1},"version":1}'
    );
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    let changed = false;
    const manifest = await captureLegacySources({
      database,
      storage: localStorage,
      runId: 'run-mutated',
      now: () => '2026-08-16T10:00:00.000Z',
      afterRead: key => {
        if (key === 'rollkeeper-player-data' && !changed) {
          changed = true;
          localStorage.setItem(
            key,
            '{"state":{"n":2,"explicit":null},"version":1}'
          );
        }
      },
    });

    const final = manifest.entries.find(
      entry => entry.key === 'rollkeeper-player-data'
    );
    expect(final?.captureNumber).toBe(2);
    const tx = database.transaction('legacySnapshots', 'readonly');
    const captures = (
      await requestResult(tx.objectStore('legacySnapshots').getAll())
    ).filter(snapshot => snapshot.key === 'rollkeeper-player-data');
    await transactionComplete(tx);
    expect(captures.map(snapshot => snapshot.rawValue)).toEqual([
      '{"state":{"n":1},"version":1}',
      '{"state":{"n":2,"explicit":null},"version":1}',
    ]);

    const again = await captureLegacySources({
      database,
      storage: localStorage,
      runId: 'run-mutated',
      now: () => 'later',
    });
    expect(again).toEqual(manifest);
    const verifyTx = database.transaction('legacySnapshots', 'readonly');
    expect(
      await requestResult(verifyTx.objectStore('legacySnapshots').count())
    ).toBe(manifest.entries.length + 1);
    await transactionComplete(verifyTx);
    database.close();
  });

  it('aborts without committing a manifest when a source never stabilizes', async () => {
    localStorage.clear();
    localStorage.setItem('rollkeeper-player-data', '0');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    let value = 0;

    await expect(
      captureLegacySources({
        database,
        storage: localStorage,
        runId: 'run-unstable',
        now: () => 'now',
        maxCapturesPerKey: 3,
        afterRead: key => {
          if (key === 'rollkeeper-player-data') {
            localStorage.setItem(key, String(++value));
          }
        },
      })
    ).rejects.toThrow(/changed during capture/i);

    const tx = database.transaction('meta', 'readonly');
    expect(
      await requestResult(
        tx.objectStore('meta').get('source-manifest:run-unstable')
      )
    ).toBeUndefined();
    await transactionComplete(tx);

    const resumed = await captureLegacySources({
      database,
      storage: localStorage,
      runId: 'run-unstable',
      now: () => 'resumed',
    });
    expect(
      resumed.entries.find(entry => entry.key === 'rollkeeper-player-data')
        ?.captureNumber
    ).toBe(4);
    database.close();
  });

  it('matches the existing device-backup receipt hash for the same exact sources', async () => {
    localStorage.clear();
    localStorage.setItem('rollkeeper-player-data', '{"state":{},"version":1}');
    localStorage.setItem(
      'rollkeeper-character:hero',
      '{"state":{"character":{"id":"hero"}}}'
    );
    localStorage.setItem('rollkeeper-unknown-future', 'opaque');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const manifest = await captureLegacySources({
      database,
      storage: localStorage,
      runId: 'run-recovery-match',
      now: () => '2026-08-16T10:00:00.000Z',
    });
    const recovery = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'recovery-run',
      timestamp: '2026-08-16T10:00:00.000Z',
    });
    expect(manifest.recoveryManifestHash).toBe(recovery.manifestHash);
    database.close();
  });

  it('rejects reopen verification when the manifest or a referenced snapshot is missing', async () => {
    await expect(
      verifyPersistedCapture({ factory: indexedDB, runId: 'missing-run' })
    ).rejects.toThrow(/manifest is missing/i);

    localStorage.clear();
    localStorage.setItem('rollkeeper-player-data', '{"state":{},"version":1}');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const manifest = await captureLegacySources({
      database,
      storage: localStorage,
      runId: 'run-missing-snapshot',
      now: () => 'now',
    });
    const player = manifest.entries.find(
      entry => entry.key === 'rollkeeper-player-data'
    )!;
    const tx = database.transaction('legacySnapshots', 'readwrite');
    tx.objectStore('legacySnapshots').delete([
      player.runId,
      player.key,
      player.captureNumber,
    ]);
    await transactionComplete(tx);
    database.close();
    await expect(
      verifyPersistedCapture({
        factory: indexedDB,
        runId: 'run-missing-snapshot',
      })
    ).rejects.toThrow(/capture mismatch/i);
  });

  it('rejects a re-hashed snapshot whose raw bytes differ from the immutable manifest', async () => {
    localStorage.clear();
    localStorage.setItem('rollkeeper-player-data', '{"state":{},"version":1}');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const manifest = await captureLegacySources({
      database,
      storage: localStorage,
      runId: 'run-rehashed-corruption',
      now: () => 'now',
    });
    const player = manifest.entries.find(
      entry => entry.key === 'rollkeeper-player-data'
    )!;
    const rawValue = '{"state":{"tampered":true},"version":1}';
    const sha256 = await sha256Bytes(rawValue);
    const tx = database.transaction('legacySnapshots', 'readwrite');
    tx.objectStore('legacySnapshots').put({
      ...player,
      rawValue,
      sha256,
    });
    await transactionComplete(tx);
    database.close();
    await expect(
      verifyPersistedCapture({
        factory: indexedDB,
        runId: 'run-rehashed-corruption',
      })
    ).rejects.toThrow(/checksum mismatch/i);
  });
});
