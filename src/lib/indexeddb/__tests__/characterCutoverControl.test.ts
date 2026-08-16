import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { captureDeviceBackup } from '@/lib/deviceRecovery';
import {
  activatePreparedCharacterCutover,
  inspectCharacterCutoverReadiness,
} from '@/lib/indexeddb/characterCutoverControl';
import { runCharacterIndexedDbMigration } from '@/lib/indexeddb/characterMigrationEngine';
import { deleteRollkeeperDatabaseForTests } from '@/lib/indexeddb/localDatabase';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

describe('character cutover pre-commit control', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('derives every gate from persisted evidence and refuses a changed source manifest', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    localStorage.setItem('rollkeeper-dm-data', '{"state":{},"version":1}');
    const backup = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'backup',
      timestamp: 'created',
    });
    const receipts = { hasDownloadReceipt: vi.fn().mockResolvedValue(true) };
    await runCharacterIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      runId: 'generation',
      ownerId: 'tab',
      now: () => 'now',
      nowMs: () => 1,
      requiredRecoveryManifestHash: backup.manifestHash,
      recoveryGate: receipts,
    });
    const ready = await inspectCharacterCutoverReadiness({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      recoveryManifestHash: backup.manifestHash,
      recoveryRunId: backup.runId,
      recoveryCreatedAt: backup.createdAt,
      appVersion: 'test',
      recoveryGate: receipts,
    });
    expect(ready).toMatchObject({
      generation: 'generation',
      ready: true,
      gates: {
        recoveryReceipt: true,
        sourceManifestUnchanged: true,
        captureVerifiedAfterReopen: true,
        noQuarantine: true,
        parity: true,
        journalEmpty: true,
      },
    });

    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[],"late":true},"version":1}'
    );
    const changed = await inspectCharacterCutoverReadiness({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      recoveryManifestHash: backup.manifestHash,
      recoveryRunId: backup.runId,
      recoveryCreatedAt: backup.createdAt,
      appVersion: 'test',
      recoveryGate: receipts,
    });
    expect(changed.ready).toBe(false);
    expect(changed.gates.sourceManifestUnchanged).toBe(false);
    expect(changed.gates.parity).toBe(false);
    await expect(
      activatePreparedCharacterCutover({
        factory: indexedDB,
        storage: localStorage,
        namespace: 'guest',
        recoveryManifestHash: backup.manifestHash,
        recoveryRunId: backup.runId,
        recoveryCreatedAt: backup.createdAt,
        appVersion: 'test',
        recoveryGate: receipts,
        confirmed: true,
        now: () => 'now',
      })
    ).rejects.toThrow(/gate/i);
  });

  it('requires immediate confirmation and commits only the inspected generation', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    const backup = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'backup',
      timestamp: 'created',
    });
    const recoveryGate = {
      hasDownloadReceipt: vi.fn().mockResolvedValue(true),
    };
    await runCharacterIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      runId: 'generation',
      ownerId: 'tab',
      now: () => 'now',
      nowMs: () => 1,
      requiredRecoveryManifestHash: backup.manifestHash,
      recoveryGate,
    });
    const options = {
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest' as const,
      recoveryManifestHash: backup.manifestHash,
      recoveryRunId: backup.runId,
      recoveryCreatedAt: backup.createdAt,
      appVersion: 'test',
      recoveryGate,
      now: () => 'commit',
    };
    await expect(
      activatePreparedCharacterCutover({ ...options, confirmed: false })
    ).rejects.toThrow(/explicit confirmation/i);
    await expect(
      activatePreparedCharacterCutover({ ...options, confirmed: true })
    ).resolves.toMatchObject({
      authority: 'indexedDB',
      generation: 'generation',
      epoch: 1,
    });
  });

  it('rejects absent readiness and reports receipt, reopen, quarantine, and journal evidence independently', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    const backup = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'backup',
      timestamp: 'created',
    });
    const base = {
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest' as const,
      recoveryManifestHash: backup.manifestHash,
      recoveryRunId: backup.runId,
      recoveryCreatedAt: backup.createdAt,
      appVersion: 'test',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(false) },
    };
    await expect(inspectCharacterCutoverReadiness(base)).rejects.toThrow(
      /not ready/i
    );
    await runCharacterIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      runId: 'evidence',
      ownerId: 'tab',
      now: () => 'now',
      nowMs: () => 1,
      requiredRecoveryManifestHash: backup.manifestHash,
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const read = database.transaction('legacySnapshots', 'readonly');
    const snapshots = await requestResult(
      read.objectStore('legacySnapshots').getAll()
    );
    await transactionComplete(read);
    const player = snapshots.find(row => row.key === 'rollkeeper-player-data');
    const mutate = database.transaction(
      ['legacySnapshots', 'quarantine', 'journal'],
      'readwrite'
    );
    mutate
      .objectStore('legacySnapshots')
      .delete([player.runId, player.key, player.captureNumber]);
    mutate
      .objectStore('quarantine')
      .put({ quarantineId: 'q', namespace: 'guest', runId: 'evidence' });
    mutate
      .objectStore('journal')
      .put({ journalId: 'j', namespace: 'guest', generation: 'evidence' });
    await transactionComplete(mutate);
    database.close();
    const inspection = await inspectCharacterCutoverReadiness(base);
    expect(inspection).toMatchObject({
      ready: false,
      quarantineCount: 1,
      journalCount: 1,
      gates: {
        recoveryReceipt: false,
        captureVerifiedAfterReopen: false,
        noQuarantine: false,
        journalEmpty: false,
      },
    });
  });
});
