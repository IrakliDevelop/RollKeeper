import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { captureDeviceBackup } from '@/lib/deviceRecovery';
import {
  commitCharacterCutover,
  inspectCurrentCharacterSafetyCoverage,
} from '@/lib/indexeddb/characterAuthority';
import { captureActiveCharacterRecoveryBundle } from '@/lib/indexeddb/characterRecoveryExport';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

import {
  assertFreshVerifiedBroadSafetyFile,
  compareProtectedSourceEntries,
  inspectPlayerBackupCharacterCoverage,
  savePlayerBackupSafetyFiles,
  verifyFreshCurrentCharacterBundle,
} from '../playerBackupSafety';

const RAW = '{"state":{"characters":[]},"version":1}';

async function seedActive(
  options: {
    mirror?: string | null;
    journal?: boolean;
    extraGeneration?: boolean;
  } = {}
) {
  localStorage.clear();
  if (options.mirror !== null)
    localStorage.setItem('rollkeeper-player-data', options.mirror ?? RAW);
  const database = await openRollkeeperDatabase({ factory: indexedDB });
  const ready = database.transaction(['meta', 'kvGenerations'], 'readwrite');
  ready.objectStore('meta').put({
    key: 'migration-state:guest:character',
    state: 'CUTOVER_READY',
    runId: 'active',
    checkpointAt: 'before',
  });
  ready.objectStore('kvGenerations').put({
    namespace: 'guest',
    generation: 'active',
    key: 'rollkeeper-player-data',
    presence: true,
    rawValue: RAW,
  });
  ready.objectStore('kvGenerations').put({
    namespace: 'guest',
    generation: 'active',
    key: 'rollkeeper-character:absent',
    presence: false,
    rawValue: null,
  });
  if (options.extraGeneration) {
    ready.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'old',
      key: 'rollkeeper-character:old',
      presence: true,
      rawValue: '{"old":true}',
    });
  }
  await transactionComplete(ready);
  await commitCharacterCutover(database, {
    namespace: 'guest',
    generation: 'active',
    confirmed: true,
    gates: {
      recoveryReceipt: true,
      sourceManifestUnchanged: true,
      captureVerifiedAfterReopen: true,
      noQuarantine: true,
      parity: true,
      journalEmpty: true,
    },
    now: () => 'committed',
  });
  if (options.journal) {
    const journal = database.transaction('journal', 'readwrite');
    journal.objectStore('journal').put({
      journalId: 'pending',
      kind: 'character-compatibility-mirror',
      namespace: 'guest',
      family: 'character',
      generation: 'active',
      cutoverEpoch: 1,
      key: 'rollkeeper-player-data',
      rawValue: RAW,
    });
    await transactionComplete(journal);
  }
  database.close();
}

afterEach(async () => {
  localStorage.clear();
  await deleteRollkeeperDatabaseForTests(indexedDB);
});

describe('player backup safety gates', () => {
  it('does not create local storage while passively checking an untouched profile', async () => {
    await expect(
      inspectPlayerBackupCharacterCoverage({
        factory: indexedDB,
        storage: localStorage,
        namespace: 'guest',
      })
    ).rejects.toThrow(/not available/i);
    await new Promise(resolve => setTimeout(resolve, 0));
    await expect(indexedDB.databases()).resolves.not.toContainEqual(
      expect.objectContaining({ name: 'rollkeeper-local' })
    );
  });

  it('requires a reselected, verified receipt and the full fresh entry vector', async () => {
    localStorage.setItem('rollkeeper-player-data', RAW);
    localStorage.setItem('rollkeeper-retained-proof', 'keep');
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'broad',
      timestamp: 'created',
    });
    await expect(
      assertFreshVerifiedBroadSafetyFile({
        bundle,
        storage: localStorage,
        receipts: {
          hasVerifiedDownloadReceipt: vi.fn().mockResolvedValue(false),
        },
      })
    ).rejects.toThrow(/verified/i);

    localStorage.setItem('rollkeeper-retained-proof', 'changed');
    await expect(
      assertFreshVerifiedBroadSafetyFile({
        bundle,
        storage: localStorage,
        receipts: {
          hasVerifiedDownloadReceipt: vi.fn().mockResolvedValue(true),
        },
      })
    ).rejects.toThrow(/changed/i);
  });

  it('rejects a tampered broad file even when a receipt lookup says yes', async () => {
    localStorage.setItem('rollkeeper-player-data', RAW);
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'broad',
      timestamp: 'created',
    });
    const tampered = structuredClone(bundle);
    tampered.entries[0].rawValue = '{"tampered":true}';
    await expect(
      assertFreshVerifiedBroadSafetyFile({
        bundle: tampered,
        storage: localStorage,
        receipts: {
          hasVerifiedDownloadReceipt: vi.fn().mockResolvedValue(true),
        },
      })
    ).rejects.toThrow(/checksum/i);
  });

  it('excludes only one exact, semantically valid selection record after confirmation', async () => {
    localStorage.setItem('rollkeeper-player-data', RAW);
    const before = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'broad',
      timestamp: 'created',
    });
    localStorage.setItem(
      'rollkeeper:indexeddb-selection:guest:character',
      JSON.stringify({
        version: 1,
        namespace: 'guest',
        family: 'character',
        selectedAt: 'selected',
        recoveryManifestHash: before.manifestHash,
        recoveryRunId: before.runId,
        recoveryCreatedAt: before.createdAt,
        playerBackupRunId: 'setup-run',
        playerBackupAccountId: 'account-a',
        playerBackupAuthorizedAt: 'authorized',
      })
    );
    const after = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: before.runId,
      timestamp: before.createdAt,
    });
    expect(
      compareProtectedSourceEntries({
        before: before.entries,
        after: after.entries,
        selectionRaw: localStorage.getItem(
          'rollkeeper:indexeddb-selection:guest:character'
        ),
        selection: {
          namespace: 'guest',
          mode: 'first-activation',
          broadReceipt: before,
          playerBackupRunId: 'setup-run',
          accountId: 'account-a',
        },
      })
    ).toMatchObject({ protectedSourceUnchanged: true, selectionValid: true });

    localStorage.setItem('rollkeeper-other-proof', 'late');
    const changed = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: before.runId,
      timestamp: before.createdAt,
    });
    expect(
      compareProtectedSourceEntries({
        before: before.entries,
        after: changed.entries,
        selectionRaw: localStorage.getItem(
          'rollkeeper:indexeddb-selection:guest:character'
        ),
        selection: {
          namespace: 'guest',
          mode: 'first-activation',
          broadReceipt: before,
          playerBackupRunId: 'setup-run',
          accountId: 'account-a',
        },
      }).protectedSourceUnchanged
    ).toBe(false);
  });

  it('fails closed for malformed, wrong-family, or wrong-account selection metadata', async () => {
    localStorage.setItem('rollkeeper-player-data', RAW);
    const before = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'broad',
      timestamp: 'created',
    });
    for (const selection of [
      '{',
      JSON.stringify({
        version: 1,
        namespace: 'guest',
        family: 'campaign',
        selectedAt: 'selected',
        playerBackupRunId: 'setup-run',
        playerBackupAccountId: 'account-a',
        playerBackupAuthorizedAt: 'authorized',
      }),
      JSON.stringify({
        version: 1,
        namespace: 'guest',
        family: 'character',
        selectedAt: 'selected',
        recoveryManifestHash: before.manifestHash,
        recoveryRunId: before.runId,
        recoveryCreatedAt: before.createdAt,
        playerBackupRunId: 'setup-run',
        playerBackupAccountId: 'account-b',
        playerBackupAuthorizedAt: 'authorized',
      }),
    ]) {
      localStorage.setItem(
        'rollkeeper:indexeddb-selection:guest:character',
        selection
      );
      const after = await captureDeviceBackup(localStorage, {
        appVersion: 'test',
        runId: before.runId,
        timestamp: before.createdAt,
      });
      expect(
        compareProtectedSourceEntries({
          before: before.entries,
          after: after.entries,
          selectionRaw: localStorage.getItem(
            'rollkeeper:indexeddb-selection:guest:character'
          ),
          selection: {
            namespace: 'guest',
            mode: 'first-activation',
            broadReceipt: before,
            playerBackupRunId: 'setup-run',
            accountId: 'account-a',
          },
        }).selectionValid
      ).toBe(false);
    }
  });

  it('accepts only stable original activation evidence for an active-profile rebind', async () => {
    localStorage.setItem('rollkeeper-player-data', RAW);
    const before = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'current',
      timestamp: 'created',
    });
    const evidence = {
      selectedAt: 'original-selection',
      recoveryManifestHash: 'original-manifest',
      recoveryRunId: 'original-run',
      recoveryCreatedAt: 'original-created',
      activatedEpoch: 3,
      activatedGeneration: 'active-generation',
    };
    const selection = {
      version: 1,
      namespace: 'user:account-a',
      family: 'character',
      ...evidence,
      playerBackupRunId: 'rebind-run',
      playerBackupAccountId: 'account-a',
      playerBackupAuthorizedAt: 'authorized',
    };
    const valid = compareProtectedSourceEntries({
      before: before.entries,
      after: before.entries,
      selectionRaw: JSON.stringify(selection),
      selection: {
        namespace: 'user:account-a',
        mode: 'active-rebind',
        originalEvidence: evidence,
        playerBackupRunId: 'rebind-run',
        accountId: 'account-a',
        authorizedAt: 'authorized',
      },
    });
    expect(valid).toMatchObject({
      protectedSourceUnchanged: true,
      selectionValid: true,
    });

    expect(
      compareProtectedSourceEntries({
        before: before.entries,
        after: before.entries,
        selectionRaw: JSON.stringify({ ...selection, activatedEpoch: 4 }),
        selection: {
          namespace: 'user:account-a',
          mode: 'active-rebind',
          originalEvidence: evidence,
          playerBackupRunId: 'rebind-run',
          accountId: 'account-a',
          authorizedAt: 'authorized',
        },
      }).selectionValid
    ).toBe(false);
  });

  it('inspects exact presence-aware parity and matching journal coverage without retrying it', async () => {
    await seedActive({ journal: true });
    const coverage = await inspectCurrentCharacterSafetyCoverage({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
    });
    expect(coverage).toMatchObject({
      parity: true,
      matchingJournalCount: 1,
      broadFileCoversCurrentCharacters: false,
      authority: { generation: 'active', epoch: 1 },
    });
    const passive = await inspectPlayerBackupCharacterCoverage({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
    });
    expect(passive.matchingJournalCount).toBe(1);
  });

  it('retries already-authorized mirror work once only on explicit save', async () => {
    await seedActive({ journal: true });
    const retryMirror = vi.fn(async () => {
      const database = await openRollkeeperDatabase({ factory: indexedDB });
      const clear = database.transaction('journal', 'readwrite');
      clear.objectStore('journal').clear();
      await transactionComplete(clear);
      database.close();
    });
    const result = await savePlayerBackupSafetyFiles({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      appVersion: 'test',
      runId: 'broad',
      timestamp: 'created',
      retryMirror,
    });
    expect(retryMirror).toHaveBeenCalledOnce();
    expect(result.currentCharacters).toBeNull();
  });

  it('builds a restorable character-only browser backup from one verified active generation', async () => {
    await seedActive({ mirror: 'stale', extraGeneration: true });
    const captured = await captureActiveCharacterRecoveryBundle({
      factory: indexedDB,
      namespace: 'guest',
      appVersion: 'test',
      runId: 'characters',
      timestamp: 'created',
    });
    expect(captured.bundle.format).toBe('rollkeeper-device-backup');
    expect(captured.bundle.entries.map(entry => entry.key)).toEqual([
      'rollkeeper-player-data',
    ]);
    expect(captured.bundle.entries[0].rawValue).toBe(RAW);
    expect(captured.authority).toMatchObject({
      generation: 'active',
      epoch: 1,
    });
  });

  it('requires the extra file receipt and a stable fresh active projection', async () => {
    await seedActive({ mirror: 'stale' });
    const captured = await captureActiveCharacterRecoveryBundle({
      factory: indexedDB,
      namespace: 'guest',
      appVersion: 'test',
      runId: 'characters',
      timestamp: 'created',
    });
    await expect(
      verifyFreshCurrentCharacterBundle({
        expected: captured,
        factory: indexedDB,
        namespace: 'guest',
        receipts: {
          hasVerifiedDownloadReceipt: vi.fn().mockResolvedValue(false),
        },
      })
    ).rejects.toThrow(/verified/i);
    await expect(
      verifyFreshCurrentCharacterBundle({
        expected: captured,
        factory: indexedDB,
        namespace: 'guest',
        receipts: {
          hasVerifiedDownloadReceipt: vi.fn().mockResolvedValue(true),
        },
      })
    ).resolves.toMatchObject({ generation: 'active', epoch: 1 });
  });
});
