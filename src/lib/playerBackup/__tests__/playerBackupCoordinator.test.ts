import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { captureDeviceBackup } from '@/lib/deviceRecovery';
import {
  characterActivationEvidenceKey,
  commitCharacterFamilyWrite,
  readCharacterAuthority,
  readCharacterActivationEvidence,
} from '@/lib/indexeddb/characterAuthority';
import { captureActiveCharacterRecoveryBundle } from '@/lib/indexeddb/characterRecoveryExport';
import {
  characterCutoverSelectionKey,
  readCharacterCutoverSelection,
  selectCharacterCutover,
} from '@/lib/indexeddb/characterCutoverSelection';
import {
  deleteRollkeeperDatabaseForTests,
  openExistingRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

import {
  PlayerBackupReadOnlyCoordinator,
  confirmPlayerBackupConsent,
  continuePlayerBackupLocalPreparation,
} from '../playerBackupCoordinator';
import type { PlayerBackupExclusiveLockProvider } from '../playerBackupRunFence';
import { PlayerBackupLockUnavailableError } from '../playerBackupRunFence';

const RAW = '{"state":{"characters":[{"id":"hero-a"}]},"version":1}';

class ImmediateLocks implements PlayerBackupExclusiveLockProvider {
  async request<T>(
    _name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> {
    return callback();
  }
}

describe('player backup local preparation coordinator', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('rollkeeper-player-data', RAW);
    localStorage.setItem('rollkeeper-dm-data', '{"dm":"unchanged"}');
  });

  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  async function safety() {
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'safety-a',
      timestamp: '2026-08-26T09:00:00.000Z',
    });
    const receipts = {
      hasVerifiedDownloadReceipt: async (manifestHash: string) =>
        manifestHash === bundle.manifestHash,
      readVerifiedDownloadReceipt: async (manifestHash: string) =>
        manifestHash === bundle.manifestHash
          ? {
              runId: bundle.runId,
              manifestHash,
              initiatedAt: bundle.createdAt,
              verifiedAt: '2026-08-26T09:05:00.000Z',
              entries: bundle.entries.map(({ key, byteCount, sha256 }) => ({
                key,
                byteCount,
                sha256,
              })),
            }
          : null,
    };
    return { bundle, receipts };
  }

  it('commits consent first and requires explicit continuation for local-ready', async () => {
    const { bundle, receipts } = await safety();
    const confirmed = await confirmPlayerBackupConsent({
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts,
      accountId: 'account-a',
      expectedActiveRunId: null,
      runId: 'run-a',
      mode: 'ongoing',
      eligibleCharacterIds: ['hero-a'],
      selectedCharacterIds: ['hero-a'],
      clearedCharacterIds: [],
      broadSafetyBundle: bundle,
      authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
      confirmedAt: '2026-08-26T10:00:00.000Z',
    });
    expect(confirmed.stage).toBe('confirmed');
    expect(
      localStorage.getItem(characterCutoverSelectionKey('guest'))
    ).toBeNull();

    const passive = new PlayerBackupReadOnlyCoordinator();
    passive.changeAccount('account-a');
    await expect(passive.discoverRun(indexedDB)).resolves.toMatchObject({
      runId: 'run-a',
      stage: 'confirmed',
    });
    expect(
      localStorage.getItem(characterCutoverSelectionKey('guest'))
    ).toBeNull();

    const ready = await continuePlayerBackupLocalPreparation({
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts,
      accountId: 'account-a',
      appVersion: 'test',
      ownerId: 'tab-a',
      now: () => '2026-08-26T10:05:00.000Z',
      nowMs: () => 1,
      storageManager: {
        estimate: async () => ({ quota: 10_000_000, usage: 0 }),
        persist: async () => true,
      },
    });
    expect(ready.stage).toBe('local-ready');
    expect(ready.selectedCharacterIds).toEqual(['hero-a']);
    expect(ready.mode).toBe('ongoing');

    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    expect(database).not.toBeNull();
    const authority = await readCharacterAuthority(database!, 'guest');
    expect(authority).toMatchObject({ authority: 'indexedDB', epoch: 1 });
    const selection = readCharacterCutoverSelection(localStorage, 'guest');
    expect(selection).toMatchObject({
      playerBackupRunId: 'run-a',
      playerBackupAccountId: 'account-a',
      activatedGeneration:
        ready.authority.kind === 'indexedDB'
          ? ready.authority.generation
          : undefined,
      activatedEpoch: 1,
    });
    await expect(
      readCharacterActivationEvidence(
        database!,
        'guest',
        ready.authority.kind === 'indexedDB' ? ready.authority.generation : ''
      )
    ).resolves.toMatchObject({ recoveryRunId: 'safety-a' });
    const read = database!.transaction(['documents', 'outbox'], 'readonly');
    const documents = await requestResult(
      read.objectStore('documents').getAll()
    );
    const outbox = await requestResult(read.objectStore('outbox').getAll());
    await transactionComplete(read);
    database!.close();
    expect(documents).toEqual([]);
    expect(outbox).toEqual([]);
    expect(localStorage.getItem('rollkeeper-dm-data')).toBe(
      '{"dm":"unchanged"}'
    );
  });

  it('resumes idempotently from the committed run and activated authority', async () => {
    const { bundle, receipts } = await safety();
    await confirmPlayerBackupConsent({
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts,
      accountId: 'account-a',
      expectedActiveRunId: null,
      runId: 'run-a',
      mode: 'one-time',
      eligibleCharacterIds: ['hero-a'],
      selectedCharacterIds: ['hero-a'],
      clearedCharacterIds: [],
      broadSafetyBundle: bundle,
      authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
      confirmedAt: '2026-08-26T10:00:00.000Z',
    });
    const options = {
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts,
      accountId: 'account-a',
      appVersion: 'test',
      ownerId: 'tab-a',
      now: () => '2026-08-26T10:05:00.000Z',
      nowMs: () => 1,
      storageManager: {
        estimate: async () => ({ quota: 10_000_000, usage: 0 }),
        persist: async () => true,
      },
    };
    const first = await continuePlayerBackupLocalPreparation(options);
    const second = await continuePlayerBackupLocalPreparation(options);
    expect(second).toEqual(first);
    expect(readCharacterCutoverSelection(localStorage, 'guest')).toMatchObject({
      activatedEpoch: 1,
      playerBackupRunId: 'run-a',
    });
  });

  it('resumes an exact committed run after the selection boundary', async () => {
    const { bundle, receipts } = await safety();
    await confirmPlayerBackupConsent({
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts,
      accountId: 'account-a',
      expectedActiveRunId: null,
      runId: 'run-a',
      mode: 'one-time',
      eligibleCharacterIds: ['hero-a'],
      selectedCharacterIds: ['hero-a'],
      clearedCharacterIds: [],
      broadSafetyBundle: bundle,
      authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
      confirmedAt: '2026-08-26T10:00:00.000Z',
    });
    selectCharacterCutover(
      localStorage,
      'guest',
      true,
      () => '2026-08-26T10:00:00.000Z',
      {
        manifestHash: bundle.manifestHash,
        runId: bundle.runId,
        createdAt: bundle.createdAt,
      },
      {
        runId: 'run-a',
        accountId: 'account-a',
        authorizedAt: '2026-08-26T10:00:00.000Z',
      }
    );

    const ready = await continuePlayerBackupLocalPreparation({
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts,
      accountId: 'account-a',
      appVersion: 'test',
      ownerId: 'tab-a',
      now: () => '2026-08-26T10:05:00.000Z',
      nowMs: () => 1,
      storageManager: {
        estimate: async () => ({ quota: 10_000_000, usage: 0 }),
        persist: async () => true,
      },
    });
    expect(ready).toMatchObject({
      mode: 'one-time',
      selectedCharacterIds: ['hero-a'],
      clearedCharacterIds: [],
      stage: 'local-ready',
    });
  });

  it('rejects orphan selection and missing lock capability without creating consent', async () => {
    const { bundle, receipts } = await safety();
    selectCharacterCutover(
      localStorage,
      'guest',
      true,
      () => 'selected',
      {
        manifestHash: bundle.manifestHash,
        runId: bundle.runId,
        createdAt: bundle.createdAt,
      },
      {
        runId: 'orphan',
        accountId: 'account-a',
        authorizedAt: 'authorized',
      }
    );
    await expect(
      continuePlayerBackupLocalPreparation({
        factory: indexedDB,
        storage: localStorage,
        locks: new ImmediateLocks(),
        receipts,
        accountId: 'account-a',
        appVersion: 'test',
        ownerId: 'tab-a',
        now: () => 'now',
        nowMs: () => 1,
      })
    ).rejects.toThrow(/committed/i);

    localStorage.removeItem(characterCutoverSelectionKey('guest'));
    await expect(
      confirmPlayerBackupConsent({
        factory: indexedDB,
        storage: localStorage,
        locks: undefined,
        receipts,
        accountId: 'account-a',
        expectedActiveRunId: null,
        runId: 'run-a',
        mode: 'ongoing',
        eligibleCharacterIds: ['hero-a'],
        selectedCharacterIds: ['hero-a'],
        clearedCharacterIds: [],
        broadSafetyBundle: bundle,
        authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
        confirmedAt: 'confirmed',
      })
    ).rejects.toBeInstanceOf(PlayerBackupLockUnavailableError);
    await new Promise(resolve => setTimeout(resolve, 0));
    await expect(indexedDB.databases()).resolves.not.toContainEqual(
      expect.objectContaining({ name: 'rollkeeper-local' })
    );
  });

  it('repairs a post-pointer marker interruption only on explicit continuation', async () => {
    const { bundle, receipts } = await safety();
    await confirmPlayerBackupConsent({
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts,
      accountId: 'account-a',
      expectedActiveRunId: null,
      runId: 'run-a',
      mode: 'ongoing',
      eligibleCharacterIds: ['hero-a'],
      selectedCharacterIds: ['hero-a'],
      clearedCharacterIds: [],
      broadSafetyBundle: bundle,
      authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
      confirmedAt: '2026-08-26T10:00:00.000Z',
    });
    const flakyStorage: Storage = {
      get length() {
        return localStorage.length;
      },
      key: index => localStorage.key(index),
      getItem: key => localStorage.getItem(key),
      setItem: (key, value) => {
        if (
          key === characterCutoverSelectionKey('guest') &&
          JSON.parse(value).activatedEpoch !== undefined
        ) {
          throw new Error('simulated marker interruption');
        }
        localStorage.setItem(key, value);
      },
      removeItem: key => localStorage.removeItem(key),
      clear: () => localStorage.clear(),
    };
    const continuation = {
      factory: indexedDB,
      locks: new ImmediateLocks(),
      receipts,
      accountId: 'account-a',
      appVersion: 'test',
      ownerId: 'tab-a',
      now: () => '2026-08-26T10:05:00.000Z',
      nowMs: () => 1,
      storageManager: {
        estimate: async () => ({ quota: 10_000_000, usage: 0 }),
        persist: async () => true,
      },
    };
    await expect(
      continuePlayerBackupLocalPreparation({
        ...continuation,
        storage: flakyStorage,
      })
    ).rejects.toThrow(/interruption/i);
    expect(
      readCharacterCutoverSelection(localStorage, 'guest')
    ).not.toHaveProperty('activatedEpoch');

    const passive = new PlayerBackupReadOnlyCoordinator();
    passive.changeAccount('account-a');
    await expect(passive.discoverRun(indexedDB)).resolves.toMatchObject({
      stage: 'confirmed',
    });
    expect(
      readCharacterCutoverSelection(localStorage, 'guest')
    ).not.toHaveProperty('activatedEpoch');

    await expect(
      continuePlayerBackupLocalPreparation({
        ...continuation,
        storage: localStorage,
      })
    ).resolves.toMatchObject({ stage: 'local-ready' });
    expect(readCharacterCutoverSelection(localStorage, 'guest')).toMatchObject({
      activatedEpoch: 1,
      playerBackupRunId: 'run-a',
    });
  });

  it('lets account B explicitly rebind while preserving account A activation evidence', async () => {
    const firstSafety = await safety();
    await confirmPlayerBackupConsent({
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts: firstSafety.receipts,
      accountId: 'account-a',
      expectedActiveRunId: null,
      runId: 'run-a',
      mode: 'ongoing',
      eligibleCharacterIds: ['hero-a'],
      selectedCharacterIds: ['hero-a'],
      clearedCharacterIds: [],
      broadSafetyBundle: firstSafety.bundle,
      authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
      confirmedAt: '2026-08-26T10:00:00.000Z',
    });
    const continuationA = {
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts: firstSafety.receipts,
      accountId: 'account-a',
      appVersion: 'test',
      ownerId: 'tab-a',
      now: () => '2026-08-26T10:05:00.000Z',
      nowMs: () => 1,
      storageManager: {
        estimate: async () => ({ quota: 10_000_000, usage: 0 }),
        persist: async () => true,
      },
    };
    const readyA = await continuePlayerBackupLocalPreparation(continuationA);
    const original = readCharacterCutoverSelection(localStorage, 'guest')!;
    const activeDatabase = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    const activeAuthority = await readCharacterAuthority(
      activeDatabase!,
      'guest'
    );
    expect(activeAuthority.authority).toBe('indexedDB');
    await commitCharacterFamilyWrite(
      activeDatabase!,
      {
        getItem: key => localStorage.getItem(key),
        setItem: () => {
          throw new Error('mirror stays stale');
        },
      },
      {
        namespace: 'guest',
        key: 'rollkeeper-player-data',
        rawValue:
          '{"state":{"characters":[{"id":"hero-a","level":2}]},"version":1}',
        expectedEpoch:
          activeAuthority.authority === 'indexedDB' ? activeAuthority.epoch : 0,
        journalId: 'stale-mirror',
        now: () => '2026-08-26T10:30:00.000Z',
      }
    );
    activeDatabase!.close();
    const bundleB = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'safety-b',
      timestamp: '2026-08-26T11:00:00.000Z',
    });
    const currentBundleB = await captureActiveCharacterRecoveryBundle({
      factory: indexedDB,
      namespace: 'guest',
      appVersion: 'test',
      runId: 'safety-current-b',
      timestamp: '2026-08-26T11:00:00.000Z',
      expectedAuthority:
        readyA.authority.kind === 'indexedDB' ? readyA.authority : undefined,
    });
    const receiptsB = {
      hasVerifiedDownloadReceipt: async (hash: string) =>
        hash === bundleB.manifestHash ||
        hash === currentBundleB.bundle.manifestHash,
      readVerifiedDownloadReceipt: async (hash: string) =>
        hash === bundleB.manifestHash
          ? {
              runId: bundleB.runId,
              manifestHash: hash,
              initiatedAt: bundleB.createdAt,
              verifiedAt: '2026-08-26T11:05:00.000Z',
              entries: bundleB.entries.map(({ key, byteCount, sha256 }) => ({
                key,
                byteCount,
                sha256,
              })),
            }
          : null,
    };
    expect(readyA.authority.kind).toBe('indexedDB');
    const evidenceDatabase = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    const generation =
      readyA.authority.kind === 'indexedDB' ? readyA.authority.generation : '';
    const originalEvidence = await readCharacterActivationEvidence(
      evidenceDatabase!,
      'guest',
      generation
    );
    const removeEvidence = evidenceDatabase!.transaction('meta', 'readwrite');
    removeEvidence
      .objectStore('meta')
      .delete(characterActivationEvidenceKey('guest', generation));
    await transactionComplete(removeEvidence);
    evidenceDatabase!.close();
    await expect(
      confirmPlayerBackupConsent({
        factory: indexedDB,
        storage: localStorage,
        locks: new ImmediateLocks(),
        receipts: receiptsB,
        accountId: 'account-b',
        expectedActiveRunId: null,
        runId: 'run-b',
        mode: 'one-time',
        eligibleCharacterIds: ['hero-a'],
        selectedCharacterIds: ['hero-a'],
        clearedCharacterIds: [],
        broadSafetyBundle: bundleB,
        currentCharacterSafetyBundle: currentBundleB,
        authority: readyA.authority,
        confirmedAt: '2026-08-26T11:10:00.000Z',
      })
    ).rejects.toThrow(/evidence/i);
    const passiveB = new PlayerBackupReadOnlyCoordinator();
    passiveB.changeAccount('account-b');
    await expect(passiveB.discoverRun(indexedDB)).resolves.toBeNull();
    const restoreEvidence = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    const restoreTransaction = restoreEvidence!.transaction(
      'meta',
      'readwrite'
    );
    restoreTransaction.objectStore('meta').put({
      key: characterActivationEvidenceKey('guest', generation),
      ...originalEvidence,
    });
    await transactionComplete(restoreTransaction);
    restoreEvidence!.close();
    await confirmPlayerBackupConsent({
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      receipts: receiptsB,
      accountId: 'account-b',
      expectedActiveRunId: null,
      runId: 'run-b',
      mode: 'one-time',
      eligibleCharacterIds: ['hero-a'],
      selectedCharacterIds: ['hero-a'],
      clearedCharacterIds: [],
      broadSafetyBundle: bundleB,
      currentCharacterSafetyBundle: currentBundleB,
      authority: readyA.authority,
      confirmedAt: '2026-08-26T11:10:00.000Z',
    });
    const readyB = await continuePlayerBackupLocalPreparation({
      ...continuationA,
      receipts: receiptsB,
      accountId: 'account-b',
      ownerId: 'tab-b',
      now: () => '2026-08-26T11:15:00.000Z',
    });
    expect(readyB).toMatchObject({
      runId: 'run-b',
      accountId: 'account-b',
      stage: 'local-ready',
    });
    const rebound = readCharacterCutoverSelection(localStorage, 'guest')!;
    expect(rebound).toEqual({
      ...original,
      playerBackupRunId: 'run-b',
      playerBackupAccountId: 'account-b',
      playerBackupAuthorizedAt: '2026-08-26T11:10:00.000Z',
    });
    const passiveA = new PlayerBackupReadOnlyCoordinator();
    passiveA.changeAccount('account-a');
    await expect(passiveA.discoverRun(indexedDB)).resolves.toMatchObject({
      runId: 'run-a',
      stage: 'local-ready',
    });
    expect(readCharacterCutoverSelection(localStorage, 'guest')).toEqual(
      rebound
    );
  });
});
