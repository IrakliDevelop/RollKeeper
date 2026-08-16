import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import {
  MigrationInterruptedError,
  runIndexedDbMigration,
} from '@/lib/indexeddb/migrationEngine';

const validRaw = '{"state":{"characters":[],"unknown":null},"version":1}';

function baseOptions(runId = 'run-engine') {
  localStorage.clear();
  localStorage.setItem('rollkeeper-player-data', validRaw);
  return {
    factory: indexedDB,
    storage: localStorage,
    namespace: 'guest' as const,
    runId,
    ownerId: 'tab-a',
    now: () => '2026-08-16T10:00:00.000Z',
    nowMs: () => 1_000,
    recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
  };
}

describe('IndexedDB migration engine', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('preflights with a write/read/delete sentinel and requests three times source bytes', async () => {
    const requestCapacity = vi.fn().mockResolvedValue(true);
    const result = await runIndexedDbMigration({
      ...baseOptions(),
      storageManager: { requestCapacity },
    });

    expect(requestCapacity).toHaveBeenCalledWith(
      new TextEncoder().encode(validRaw).byteLength * 3
    );
    expect(result).toMatchObject({
      state: 'CUTOVER_READY',
      authority: 'localStorage',
      quarantineCount: 0,
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const tx = database.transaction('meta', 'readonly');
    expect(
      await requestResult(tx.objectStore('meta').get('preflight-sentinel'))
    ).toBeUndefined();
    expect(
      await requestResult(tx.objectStore('meta').get('active-generation'))
    ).toBeUndefined();
    await transactionComplete(tx);
    database.close();
  });

  it('uses StorageManager estimate/persist and rejects insufficient estimated quota', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const successful = await runIndexedDbMigration({
      ...baseOptions('run-estimate-ok'),
      storageManager: {
        estimate: vi.fn().mockResolvedValue({ quota: 10_000, usage: 0 }),
        persist,
      },
    });
    expect(successful.state).toBe('CUTOVER_READY');
    expect(persist).toHaveBeenCalledOnce();
    await deleteRollkeeperDatabaseForTests(indexedDB);

    const blocked = await runIndexedDbMigration({
      ...baseOptions('run-estimate-full'),
      storageManager: {
        estimate: vi.fn().mockResolvedValue({ quota: 10, usage: 9 }),
      },
    });
    expect(blocked).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
    });
  });

  it('leaves localStorage authoritative when IndexedDB is unavailable', async () => {
    const options = baseOptions();
    const before = localStorage.getItem('rollkeeper-player-data');
    const result = await runIndexedDbMigration({ ...options, factory: null });
    expect(result).toMatchObject({
      state: 'LEGACY_PRIMARY',
      authority: 'localStorage',
    });
    expect(result.error).toMatch(/unavailable/i);
    expect(localStorage.getItem('rollkeeper-player-data')).toBe(before);
  });

  it('blocks on quota exhaustion without mutating or deleting any legacy value', async () => {
    const options = baseOptions();
    localStorage.setItem('rollkeeper-recovery-marker', 'keep-me');
    const before = [...Array(localStorage.length)].map((_, index) => {
      const key = localStorage.key(index)!;
      return [key, localStorage.getItem(key)] as const;
    });
    const result = await runIndexedDbMigration({
      ...options,
      storageManager: { requestCapacity: vi.fn().mockResolvedValue(false) },
    });
    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
    });
    expect(result.error).toMatch(/capacity/i);
    expect(
      [...Array(localStorage.length)].map((_, index) => {
        const key = localStorage.key(index)!;
        return [key, localStorage.getItem(key)] as const;
      })
    ).toEqual(before);
  });

  it('blocks after a preflight transaction abort and keeps legacy primary', async () => {
    const result = await runIndexedDbMigration({
      ...baseOptions(),
      testHooks: { abortPreflightTransaction: true },
    });
    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
    });
    expect(result.error).toMatch(/abort/i);
    expect(localStorage.getItem('rollkeeper-player-data')).toBe(validRaw);
  });

  it('requires a matching recovery receipt before transformation', async () => {
    const result = await runIndexedDbMigration({
      ...baseOptions(),
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(false) },
    });
    expect(result).toMatchObject({
      state: 'RECOVERY_REQUIRED',
      authority: 'localStorage',
    });
  });

  it.each([
    'PREFLIGHT',
    'CAPTURING',
    'CAPTURED',
    'TRANSFORMING',
    'VALIDATED',
    'SHADOWING',
    'CUTOVER_READY',
  ] as const)('resumes idempotently after a crash at %s', async checkpoint => {
    const options = baseOptions(`run-crash-${checkpoint}`);
    await expect(
      runIndexedDbMigration({
        ...options,
        afterCheckpoint: state => {
          if (state === checkpoint) throw new MigrationInterruptedError(state);
        },
      })
    ).rejects.toBeInstanceOf(MigrationInterruptedError);

    await expect(runIndexedDbMigration(options)).resolves.toMatchObject({
      state: 'CUTOVER_READY',
      authority: 'localStorage',
    });
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('detects a corrupt captured generation after reload and blocks activation', async () => {
    const options = baseOptions('run-corrupt');
    await expect(
      runIndexedDbMigration({
        ...options,
        afterCheckpoint: state => {
          if (state === 'CAPTURED') throw new MigrationInterruptedError(state);
        },
      })
    ).rejects.toBeInstanceOf(MigrationInterruptedError);

    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const read = database.transaction('legacySnapshots', 'readonly');
    const snapshots = await requestResult(
      read.objectStore('legacySnapshots').getAll()
    );
    await transactionComplete(read);
    const player = snapshots.find(
      item => item.key === 'rollkeeper-player-data'
    );
    const corrupt = database.transaction('legacySnapshots', 'readwrite');
    corrupt
      .objectStore('legacySnapshots')
      .put({ ...player, rawValue: 'corrupt' });
    await transactionComplete(corrupt);
    database.close();

    const result = await runIndexedDbMigration(options);
    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
    });
    expect(result.error).toMatch(/checksum/i);
  });

  it('quarantines malformed data and refuses CUTOVER_READY', async () => {
    const options = baseOptions('run-quarantine');
    localStorage.setItem('rollkeeper-npc-data', '{broken');
    const result = await runIndexedDbMigration(options);
    expect(result).toMatchObject({
      state: 'SHADOWING',
      authority: 'localStorage',
      quarantineCount: 1,
    });
  });

  it('returns an existing CUTOVER_READY checkpoint without changing authority', async () => {
    const options = baseOptions('run-existing-ready');
    expect((await runIndexedDbMigration(options)).state).toBe('CUTOVER_READY');
    const gate = options.recoveryGate.hasDownloadReceipt as ReturnType<
      typeof vi.fn
    >;
    gate.mockClear();
    const again = await runIndexedDbMigration(options);
    expect(again).toMatchObject({
      state: 'CUTOVER_READY',
      authority: 'localStorage',
    });
    expect(gate).not.toHaveBeenCalled();
  });

  it('reconciles a valid current-source change through the journal before readiness', async () => {
    const options = baseOptions('run-parity-change');
    const result = await runIndexedDbMigration({
      ...options,
      afterCheckpoint: state => {
        if (state === 'SHADOWING') {
          localStorage.setItem(
            'rollkeeper-player-data',
            '{"state":{"characters":[],"changed":true},"version":1}'
          );
        }
      },
    });
    expect(result).toMatchObject({
      state: 'CUTOVER_READY',
      authority: 'localStorage',
    });
    expect(localStorage.getItem('rollkeeper-player-data')).toContain(
      '"changed":true'
    );
  });

  it('quarantines a malformed shadow-era change instead of declaring readiness', async () => {
    const options = baseOptions('run-shadow-quarantine');
    const result = await runIndexedDbMigration({
      ...options,
      afterCheckpoint: state => {
        if (state === 'SHADOWING') {
          localStorage.setItem(
            'rollkeeper-player-data',
            '{broken-after-capture'
          );
        }
      },
    });
    expect(result).toMatchObject({
      state: 'SHADOWING',
      authority: 'localStorage',
      quarantineCount: 1,
    });
    expect(localStorage.getItem('rollkeeper-player-data')).toBe(
      '{broken-after-capture'
    );
  });

  it('retries queued journal work on reload before readiness', async () => {
    const options = baseOptions('run-journal-reload');
    await expect(
      runIndexedDbMigration({
        ...options,
        afterCheckpoint: state => {
          if (state === 'SHADOWING') throw new MigrationInterruptedError(state);
        },
      })
    ).rejects.toBeInstanceOf(MigrationInterruptedError);
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const tx = database.transaction('journal', 'readwrite');
    tx.objectStore('journal').put({
      journalId: 'queued-after-reload',
      namespace: 'guest',
      generation: 'run-journal-reload',
      key: 'rollkeeper-player-data',
      rawValue: validRaw,
      legacyAck: true,
      idbAck: false,
      attempts: 1,
      updatedAt: 'before',
    });
    await transactionComplete(tx);
    database.close();

    expect((await runIndexedDbMigration(options)).state).toBe('CUTOVER_READY');
    const reopened = await openRollkeeperDatabase({ factory: indexedDB });
    const verify = reopened.transaction('journal', 'readonly');
    expect(await requestResult(verify.objectStore('journal').count())).toBe(0);
    await transactionComplete(verify);
    reopened.close();
  });

  it('leaves legacy primary when lock acquisition fails', async () => {
    const result = await runIndexedDbMigration({
      ...baseOptions('run-lock-failure'),
      locks: {
        request: async () => Promise.reject('lock unavailable'),
      },
    });
    expect(result).toMatchObject({
      state: 'LEGACY_PRIMARY',
      authority: 'localStorage',
      error: 'lock unavailable',
    });
  });

  it('never depends on BroadcastChannel and preserves guest/account namespace isolation', async () => {
    const original = globalThis.BroadcastChannel;
    // @ts-expect-error intentional capability removal
    delete globalThis.BroadcastChannel;
    try {
      const guest = await runIndexedDbMigration(baseOptions('run-guest'));
      expect(guest.state).toBe('CUTOVER_READY');
      const user = await runIndexedDbMigration({
        ...baseOptions('run-user'),
        namespace: 'user:user-a',
      });
      expect(user.state).toBe('CUTOVER_READY');

      const database = await openRollkeeperDatabase({ factory: indexedDB });
      const tx = database.transaction('kvGenerations', 'readonly');
      const rows = await requestResult(
        tx.objectStore('kvGenerations').getAll()
      );
      await transactionComplete(tx);
      expect(new Set(rows.map(row => row.namespace))).toEqual(
        new Set(['guest', 'user:user-a'])
      );
      database.close();
    } finally {
      globalThis.BroadcastChannel = original;
    }
  });
});
