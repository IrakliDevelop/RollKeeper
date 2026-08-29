import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureDeviceBackup } from '@/lib/deviceRecovery';
import * as characterAuthority from '@/lib/indexeddb/characterAuthority';
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
import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import { createMemoryCharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';

import {
  PlayerBackupCloudPreviewError,
  previewPlayerBackupCloud,
} from '../playerBackupCloudPreview';
import {
  PlayerBackupEligibilityChangedError,
  PlayerBackupReadOnlyCoordinator,
  confirmDegradedPlayerBackupConsent,
  confirmPlayerBackupConsent,
  continuePlayerBackupLocalPreparation,
} from '../playerBackupCoordinator';
import { classifyDegradedEligibility } from '../playerBackupEligibility';
import type { PlayerBackupConflictListing } from '../playerBackupConflictCoordinator';
import type { PlayerBackupExecutionResult } from '../playerBackupOnlineExecution';
import type { PlayerBackupExclusiveLockProvider } from '../playerBackupRunFence';
import { PlayerBackupLockUnavailableError } from '../playerBackupRunFence';
import { playerBackupExecutionPath } from '../playerBackupRunRepository';

const RAW =
  '{"state":{"characters":[{"id":"hero-a","name":"Hero A","race":"Human","class":"Fighter","level":1,"createdAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","lastPlayed":"2020-01-01T00:00:00.000Z","characterData":{"id":"hero-a"},"tags":[],"isArchived":false}]},"version":1}';

function fakeResult(
  accountId: string,
  overrides: Partial<PlayerBackupExecutionResult> = {}
): PlayerBackupExecutionResult {
  return {
    runId: 'run-a',
    accountId,
    mode: 'one-time',
    executionPath: 'integrated',
    protected: ['hero-a'],
    queued: [],
    offline: [],
    authRequired: [],
    needsAttention: [],
    heldAside: [],
    failed: [],
    pending: [],
    outcomes: { 'hero-a': { outcome: 'protected', reason: null } },
    complete: true,
    ...overrides,
  };
}

function fakeListing(accountId: string): PlayerBackupConflictListing {
  return { accountId, runId: 'run-a', conflicts: [], heldAside: [] };
}

const HERO_A = {
  id: 'hero-a',
  name: 'Hero A',
  characterData: { id: 'hero-a', revision: 5 },
};
const HERO_B = {
  id: 'hero-b',
  name: 'Hero B',
  characterData: { id: 'hero-b', revision: 5 },
};

function cloudRow(payload: unknown): CharacterCloudRow {
  return {
    id: 'cloud-b',
    legacy_client_id: 'hero-b',
    name: 'Hero B',
    payload,
    schema_version: 1,
    client_revision: 1,
    server_version: 1,
    deleted_at: null,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
  };
}

function cloudDouble(options: {
  rows: CharacterCloudRow[];
  accountId?: string;
  expectedAccountId?: string;
}) {
  const gateway = {
    list: vi.fn(async () => options.rows),
    put: vi.fn(),
  };
  const auth = {
    getUser: vi.fn(async () => ({
      data: { user: { id: options.accountId ?? 'account-a' } },
    })),
  };
  const read = vi.fn(() =>
    previewPlayerBackupCloud({
      auth,
      gateway,
      ...(options.expectedAccountId
        ? { expectedAccountId: options.expectedAccountId }
        : {}),
      localCharacters: [HERO_A, HERO_B],
    })
  );
  return { gateway, auth, read };
}

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
    expect(confirmed.executionPath).toBeUndefined();
    expect(playerBackupExecutionPath(confirmed)).toBe('integrated');
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

  it('rejects legacy consent while an orphan selection is present', async () => {
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
      confirmPlayerBackupConsent({
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
        confirmedAt: 'confirmed',
      })
    ).rejects.toThrow(/orphan selection/i);
    await expect(
      openExistingRollkeeperDatabase({ factory: indexedDB })
    ).resolves.toBeNull();
  });

  it('refuses indexedDB consent without proved current-character coverage', async () => {
    const { bundle, receipts } = await safety();
    const coverageSpy = vi
      .spyOn(characterAuthority, 'inspectCurrentCharacterSafetyCoverage')
      .mockResolvedValue({
        authority: {
          authority: 'indexedDB',
          namespace: 'guest',
          family: 'character',
          generation: 'generation-a',
          epoch: 1,
          committedAt: 'committed-a',
        },
        rows: [],
        parity: false,
        matchingJournalCount: 1,
        broadFileCoversCurrentCharacters: false,
      });
    await expect(
      confirmPlayerBackupConsent({
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
        authority: {
          kind: 'indexedDB',
          namespace: 'guest',
          family: 'character',
          generation: 'generation-a',
          epoch: 1,
        },
        confirmedAt: 'confirmed',
      })
    ).rejects.toThrow(/current character safety coverage is required/i);
    coverageSpy.mockRestore();
    await expect(
      openExistingRollkeeperDatabase({ factory: indexedDB })
    ).resolves.toBeNull();
  });

  it('fails closed when durable consent cannot be acknowledged', async () => {
    const { bundle, receipts } = await safety();
    const spy = vi
      .spyOn(
        AutomaticCharacterSyncPreferences.prototype,
        'readConfirmedSelection'
      )
      .mockResolvedValue({
        characterPolicies: {},
        futureDefault: null,
        confirmedAt: null,
      });
    await expect(
      confirmPlayerBackupConsent({
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
        confirmedAt: 'confirmed',
      })
    ).rejects.toThrow(/could not be acknowledged/i);
    spy.mockRestore();
  });

  it('fails closed when the verified receipt or protected source is missing after consent', async () => {
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
    const continuation = {
      factory: indexedDB,
      storage: localStorage,
      locks: new ImmediateLocks(),
      accountId: 'account-a',
      appVersion: 'test',
      ownerId: 'tab-a',
      now: () => 'now',
      nowMs: () => 1,
    };
    await expect(
      continuePlayerBackupLocalPreparation({
        ...continuation,
        receipts: {
          hasVerifiedDownloadReceipt: async () => false,
          readVerifiedDownloadReceipt: async () => null,
        },
      })
    ).rejects.toThrow(/receipt is missing/i);

    await expect(
      continuePlayerBackupLocalPreparation({
        ...continuation,
        receipts: {
          hasVerifiedDownloadReceipt: async () => true,
          readVerifiedDownloadReceipt: async () => ({
            runId: 'other-run',
            manifestHash: bundle.manifestHash,
            initiatedAt: bundle.createdAt,
            verifiedAt: 'verified',
          }),
        },
      })
    ).rejects.toThrow(/receipt entries are missing/i);

    localStorage.setItem('rollkeeper-dm-data', '{"dm":"tampered"}');
    await expect(
      continuePlayerBackupLocalPreparation({
        ...continuation,
        receipts,
      })
    ).rejects.toThrow(/protected source changed/i);
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

  describe('degraded manual consent', () => {
    it('aborts the whole confirmation with zero writes when a selected row becomes contested under the lock', async () => {
      const { bundle, receipts } = await safety();
      const links = createMemoryCharacterCloudLinkRepository();
      const preflight = cloudDouble({
        rows: [cloudRow(HERO_B)],
        expectedAccountId: 'account-a',
      });
      const preflightSnapshot = classifyDegradedEligibility({
        preview: await preflight.read(),
        links,
      });
      expect(preflightSnapshot.characters.map(entry => entry.reason)).toEqual([
        'missing',
        'identical',
      ]);
      expect(preflightSnapshot.eligibleCharacterIds).toEqual([
        'hero-a',
        'hero-b',
      ]);

      const drifted = cloudDouble({
        rows: [cloudRow({ ...HERO_B, name: 'Hero B renamed' })],
        expectedAccountId: 'account-a',
      });
      const failure: unknown = await confirmDegradedPlayerBackupConsent({
        factory: indexedDB,
        storage: localStorage,
        locks: new ImmediateLocks(),
        receipts,
        accountId: 'account-a',
        expectedActiveRunId: null,
        runId: 'run-degraded',
        eligibleCharacterIds: ['hero-a', 'hero-b'],
        selectedCharacterIds: ['hero-a', 'hero-b'],
        clearedCharacterIds: [],
        broadSafetyBundle: bundle,
        authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
        confirmedAt: '2026-08-26T10:00:00.000Z',
        preview: drifted.read,
        links,
      }).then(
        () => null,
        cause => cause
      );
      expect(failure).toBeInstanceOf(PlayerBackupEligibilityChangedError);
      expect(failure).toMatchObject({
        name: 'PlayerBackupEligibilityChangedError',
        message: 'Online eligibility changed before confirmation',
        changedCharacterIds: ['hero-b'],
      });

      await expect(
        openExistingRollkeeperDatabase({ factory: indexedDB })
      ).resolves.toBeNull();
      await new Promise(resolve => setTimeout(resolve, 0));
      await expect(indexedDB.databases()).resolves.not.toContainEqual(
        expect.objectContaining({ name: 'rollkeeper-local' })
      );
      expect(links.get('account-a', 'hero-a')).toBeNull();
      expect(links.get('account-a', 'hero-b')).toBeNull();
      expect(drifted.gateway.put).not.toHaveBeenCalled();
      expect(
        localStorage.getItem(characterCutoverSelectionKey('guest'))
      ).toBeNull();
    });

    it('commits a degraded one-time run that never prepares local authority', async () => {
      const { bundle, receipts } = await safety();
      const links = createMemoryCharacterCloudLinkRepository();
      const cloud = cloudDouble({
        rows: [cloudRow(HERO_B)],
        expectedAccountId: 'account-a',
      });
      const run = await confirmDegradedPlayerBackupConsent({
        factory: indexedDB,
        storage: localStorage,
        locks: new ImmediateLocks(),
        receipts,
        accountId: 'account-a',
        expectedActiveRunId: null,
        runId: 'run-degraded',
        eligibleCharacterIds: ['hero-a', 'hero-b'],
        selectedCharacterIds: ['hero-a'],
        clearedCharacterIds: ['hero-b'],
        broadSafetyBundle: bundle,
        authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
        confirmedAt: '2026-08-26T10:00:00.000Z',
        preview: cloud.read,
        links,
      });
      expect(run).toMatchObject({
        executionPath: 'degraded-manual',
        mode: 'one-time',
        futureDefault: 'off',
        stage: 'confirmed',
        selectedCharacterIds: ['hero-a'],
        clearedCharacterIds: ['hero-b'],
      });
      expect(playerBackupExecutionPath(run)).toBe('degraded-manual');
      expect(cloud.read).toHaveBeenCalledOnce();
      expect(cloud.gateway.put).not.toHaveBeenCalled();

      const database = await openExistingRollkeeperDatabase({
        factory: indexedDB,
      });
      const acknowledged = await new AutomaticCharacterSyncPreferences(
        database!
      ).readConfirmedSelection('user:account-a', ['hero-a', 'hero-b']);
      database!.close();
      expect(acknowledged).toEqual({
        characterPolicies: { 'hero-a': 'off', 'hero-b': 'off' },
        futureDefault: 'off',
        confirmedAt: '2026-08-26T10:00:00.000Z',
      });

      await expect(
        continuePlayerBackupLocalPreparation({
          factory: indexedDB,
          storage: localStorage,
          locks: new ImmediateLocks(),
          receipts,
          accountId: 'account-a',
          appVersion: 'test',
          ownerId: 'tab-a',
          now: () => '2026-08-26T10:05:00.000Z',
          nowMs: () => 1,
        })
      ).rejects.toThrow(
        'Degraded manual backup never prepares local authority'
      );
      expect(
        localStorage.getItem(characterCutoverSelectionKey('guest'))
      ).toBeNull();

      const passive = new PlayerBackupReadOnlyCoordinator();
      passive.changeAccount('account-a');
      await expect(passive.discoverRun(indexedDB)).resolves.toMatchObject({
        runId: 'run-degraded',
        stage: 'confirmed',
        executionPath: 'degraded-manual',
      });
    });

    it('rejects a changed account under the lock before any write', async () => {
      const { bundle, receipts } = await safety();
      const links = createMemoryCharacterCloudLinkRepository();
      // No expectedAccountId, so the coordinator's own account guard is exercised.
      const cloud = cloudDouble({ rows: [], accountId: 'account-b' });
      const failure: unknown = await confirmDegradedPlayerBackupConsent({
        factory: indexedDB,
        storage: localStorage,
        locks: new ImmediateLocks(),
        receipts,
        accountId: 'account-a',
        expectedActiveRunId: null,
        runId: 'run-degraded',
        eligibleCharacterIds: ['hero-a'],
        selectedCharacterIds: ['hero-a'],
        clearedCharacterIds: [],
        broadSafetyBundle: bundle,
        authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
        confirmedAt: '2026-08-26T10:00:00.000Z',
        preview: cloud.read,
        links,
      }).then(
        () => null,
        cause => cause
      );
      expect(failure).toBeInstanceOf(PlayerBackupCloudPreviewError);
      expect(failure).toMatchObject({ category: 'account-changed' });
      await expect(
        openExistingRollkeeperDatabase({ factory: indexedDB })
      ).resolves.toBeNull();
      expect(cloud.gateway.put).not.toHaveBeenCalled();
    });

    it('fails closed without lock capability', async () => {
      const { bundle, receipts } = await safety();
      const links = createMemoryCharacterCloudLinkRepository();
      const cloud = cloudDouble({
        rows: [cloudRow(HERO_B)],
        expectedAccountId: 'account-a',
      });
      await expect(
        confirmDegradedPlayerBackupConsent({
          factory: indexedDB,
          storage: localStorage,
          locks: null,
          receipts,
          accountId: 'account-a',
          expectedActiveRunId: null,
          runId: 'run-degraded',
          eligibleCharacterIds: ['hero-a', 'hero-b'],
          selectedCharacterIds: ['hero-a', 'hero-b'],
          clearedCharacterIds: [],
          broadSafetyBundle: bundle,
          authority: {
            kind: 'legacy',
            namespace: 'guest',
            family: 'character',
          },
          confirmedAt: '2026-08-26T10:00:00.000Z',
          preview: cloud.read,
          links,
        })
      ).rejects.toBeInstanceOf(PlayerBackupLockUnavailableError);
      expect(cloud.read).not.toHaveBeenCalled();
      expect(cloud.gateway.list).not.toHaveBeenCalled();
      await expect(
        openExistingRollkeeperDatabase({ factory: indexedDB })
      ).resolves.toBeNull();
    });

    it('aborts confirmation when a selected or cleared character disappears under the lock', async () => {
      const { bundle, receipts } = await safety();
      const links = createMemoryCharacterCloudLinkRepository();
      const missingCleared = cloudDouble({
        rows: [],
        expectedAccountId: 'account-a',
      });
      await expect(
        confirmDegradedPlayerBackupConsent({
          factory: indexedDB,
          storage: localStorage,
          locks: new ImmediateLocks(),
          receipts,
          accountId: 'account-a',
          expectedActiveRunId: null,
          runId: 'run-degraded',
          eligibleCharacterIds: ['hero-a', 'hero-c'],
          selectedCharacterIds: ['hero-a'],
          clearedCharacterIds: ['hero-c'],
          broadSafetyBundle: bundle,
          authority: {
            kind: 'legacy',
            namespace: 'guest',
            family: 'character',
          },
          confirmedAt: '2026-08-26T10:00:00.000Z',
          preview: missingCleared.read,
          links,
        })
      ).rejects.toMatchObject({
        name: 'PlayerBackupEligibilityChangedError',
        changedCharacterIds: ['hero-c'],
      });
      await expect(
        openExistingRollkeeperDatabase({ factory: indexedDB })
      ).resolves.toBeNull();
    });
  });

  describe('account-token result state', () => {
    it('discovers no run and makes no database until an account is set', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      await expect(coordinator.discoverRun(indexedDB)).resolves.toBeNull();
      expect(coordinator.snapshot().accountId).toBeNull();
      await expect(
        openExistingRollkeeperDatabase({ factory: indexedDB })
      ).resolves.toBeNull();
    });

    it('switches account synchronously before a cloud load for a different account', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');
      await expect(
        coordinator.loadCloud('account-b', async () => ({
          account: { id: 'account-b' },
          characters: [],
          onlineOnly: [],
        }))
      ).resolves.toBe(true);
      expect(coordinator.snapshot().accountId).toBe('account-b');
    });

    it('discards a result error after the account switches and rethrows while current', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');
      let rejectStale!: (cause: Error) => void;
      const stale = new Promise<PlayerBackupExecutionResult>(
        (_resolve, reject) => {
          rejectStale = reject;
        }
      );
      const loading = coordinator.loadResult('account-a', () => stale);
      coordinator.changeAccount('account-b');
      rejectStale(new Error('stale-account-result'));
      await expect(loading).resolves.toBe(false);
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-b',
        result: null,
      });

      coordinator.changeAccount('account-a');
      await expect(
        coordinator.loadResult('account-a', async () => {
          throw new Error('current-account-result');
        })
      ).rejects.toThrow('current-account-result');
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-a',
        result: null,
        resultLoading: false,
      });
    });

    it('applies a current-account result', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');
      const result = fakeResult('account-a');

      await expect(
        coordinator.loadResult('account-a', async () => result)
      ).resolves.toBe(true);
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-a',
        result,
        resultLoading: false,
      });
    });

    it('discards a result resolving after changeAccount switches away', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');
      let releaseLoader: (() => void) | undefined;
      const pending = new Promise<PlayerBackupExecutionResult>(resolve => {
        releaseLoader = () => resolve(fakeResult('account-a'));
      });

      const loading = coordinator.loadResult('account-a', () => pending);
      coordinator.changeAccount('account-b');
      releaseLoader!();

      await expect(loading).resolves.toBe(false);
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-b',
        result: null,
      });
    });

    it('discards a result whose accountId differs from the requested account', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');

      await expect(
        coordinator.loadResult('account-a', async () => fakeResult('account-b'))
      ).resolves.toBe(false);
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-a',
        result: null,
        resultLoading: false,
      });
    });

    it('switches the coordinator account first when loadResult targets a different account', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');
      const result = fakeResult('account-b');

      await expect(
        coordinator.loadResult('account-b', async () => result)
      ).resolves.toBe(true);
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-b',
        result,
        resultLoading: false,
      });
    });
  });

  describe('account-token conflict state', () => {
    it('loads conflicts under the account token and discards a late listing after an account switch', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');
      const listing = fakeListing('account-a');

      await expect(
        coordinator.loadConflicts('account-a', async () => listing)
      ).resolves.toBe(true);
      expect(coordinator.snapshot()).toMatchObject({
        conflicts: listing,
        conflictsLoading: false,
      });

      let releaseLoader: (() => void) | undefined;
      const pending = new Promise<PlayerBackupConflictListing>(resolve => {
        releaseLoader = () => resolve(fakeListing('account-a'));
      });

      const loading = coordinator.loadConflicts('account-a', () => pending);
      coordinator.changeAccount('account-b');
      releaseLoader!();

      await expect(loading).resolves.toBe(false);
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-b',
        conflicts: null,
        conflictsLoading: false,
      });
    });

    it('switches account synchronously before loading conflicts for a different account', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');
      await expect(
        coordinator.loadConflicts('account-b', async () =>
          fakeListing('account-b')
        )
      ).resolves.toBe(true);
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-b',
        conflicts: fakeListing('account-b'),
      });
    });

    it('rejects a listing for another account id', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');

      await expect(
        coordinator.loadConflicts('account-a', async () =>
          fakeListing('account-b')
        )
      ).resolves.toBe(false);
      // The token and the account are still current, so this call still owns
      // the flag and must clear it rather than strand it.
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-a',
        conflicts: null,
        conflictsLoading: false,
      });
    });

    it('clears conflicts synchronously on changeAccount', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');
      await coordinator.loadConflicts('account-a', async () =>
        fakeListing('account-a')
      );
      expect(coordinator.snapshot().conflicts).not.toBeNull();

      coordinator.changeAccount('account-b');

      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-b',
        conflicts: null,
        conflictsLoading: false,
      });
    });

    it('discards a conflict error after the account switches and rethrows while current', async () => {
      const coordinator = new PlayerBackupReadOnlyCoordinator();
      coordinator.changeAccount('account-a');
      let rejectStale!: (cause: Error) => void;
      const stale = new Promise<PlayerBackupConflictListing>(
        (_resolve, reject) => {
          rejectStale = reject;
        }
      );
      const loading = coordinator.loadConflicts('account-a', () => stale);
      coordinator.changeAccount('account-b');
      rejectStale(new Error('stale-account-conflicts'));
      await expect(loading).resolves.toBe(false);
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-b',
        conflicts: null,
      });

      coordinator.changeAccount('account-a');
      await expect(
        coordinator.loadConflicts('account-a', async () => {
          throw new Error('current-account-conflicts');
        })
      ).rejects.toThrow('current-account-conflicts');
      expect(coordinator.snapshot()).toMatchObject({
        accountId: 'account-a',
        conflicts: null,
        conflictsLoading: false,
      });
    });
  });
});
