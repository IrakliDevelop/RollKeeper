import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  commitCharacterCutover,
  readCharacterActivationEvidence,
} from '@/lib/indexeddb/characterAuthority';
import {
  markCharacterCutoverActivated,
  readCharacterCutoverSelection,
  repairCharacterCutoverActivationFromEvidence,
  selectCharacterCutover,
} from '@/lib/indexeddb/characterCutoverSelection';
import * as characterAuthority from '@/lib/indexeddb/characterAuthority';
import * as localDatabase from '@/lib/indexeddb/localDatabase';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import type { PlayerBackupExclusiveLockProvider } from '../playerBackupRunFence';

import { rebindPlayerBackupActiveSelection } from '../playerBackupActiveSelection';

const RAW = '{"state":{"characters":[]},"version":1}';

class ImmediateLocks implements PlayerBackupExclusiveLockProvider {
  readonly names: string[] = [];

  async request<T>(
    name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> {
    this.names.push(name);
    return callback();
  }
}

async function seedActive(
  database: IDBDatabase,
  options: { abortPointerTransaction?: boolean } = {}
) {
  localStorage.setItem('rollkeeper-player-data', RAW);
  selectCharacterCutover(
    localStorage,
    'guest',
    true,
    () => 'selected-a',
    {
      manifestHash: 'manifest-a',
      runId: 'safety-a',
      createdAt: 'safety-created-a',
    },
    {
      runId: 'run-a',
      accountId: 'account-a',
      authorizedAt: 'authorized-a',
    }
  );
  const ready = database.transaction(['meta', 'kvGenerations'], 'readwrite');
  ready.objectStore('meta').put({
    key: 'migration-state:guest:character',
    state: 'CUTOVER_READY',
    runId: 'generation-a',
    checkpointAt: 'before',
  });
  ready.objectStore('kvGenerations').put({
    namespace: 'guest',
    generation: 'generation-a',
    key: 'rollkeeper-player-data',
    presence: true,
    rawValue: RAW,
  });
  await transactionComplete(ready);
  const authority = await commitCharacterCutover(database, {
    namespace: 'guest',
    generation: 'generation-a',
    confirmed: true,
    gates: {
      recoveryReceipt: true,
      sourceManifestUnchanged: true,
      captureVerifiedAfterReopen: true,
      noQuarantine: true,
      parity: true,
      journalEmpty: true,
    },
    activationEvidence: {
      selectedAt: 'selected-a',
      recoveryManifestHash: 'manifest-a',
      recoveryRunId: 'safety-a',
      recoveryCreatedAt: 'safety-created-a',
      playerBackupRunId: 'run-a',
      playerBackupAccountId: 'account-a',
      playerBackupAuthorizedAt: 'authorized-a',
    },
    now: () => 'committed-a',
    testHooks: options.abortPointerTransaction
      ? { abortPointerTransaction: true }
      : undefined,
  });
  return authority;
}

async function seedActiveRun(database: IDBDatabase, runId: string) {
  const transaction = database.transaction('meta', 'readwrite');
  transaction.objectStore('meta').put({
    key: 'player-backup-active-run:account-b',
    runId,
    accountId: 'account-b',
  });
  await transactionComplete(transaction);
}

describe('player backup active selection', () => {
  let database: IDBDatabase;

  beforeEach(async () => {
    localStorage.clear();
    database = await openRollkeeperDatabase({ factory: indexedDB });
  });

  afterEach(async () => {
    localStorage.clear();
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('commits immutable original activation evidence with generation and epoch', async () => {
    const authority = await seedActive(database);
    await expect(
      readCharacterActivationEvidence(database, 'guest', authority.generation)
    ).resolves.toMatchObject({
      selectedAt: 'selected-a',
      recoveryManifestHash: 'manifest-a',
      recoveryRunId: 'safety-a',
      recoveryCreatedAt: 'safety-created-a',
      activatedGeneration: 'generation-a',
      activatedEpoch: authority.epoch,
    });
  });

  it('aborts immutable evidence together with the active pointer', async () => {
    await expect(
      seedActive(database, { abortPointerTransaction: true })
    ).rejects.toThrow(/aborted/i);
    await expect(
      readCharacterActivationEvidence(database, 'guest', 'generation-a')
    ).resolves.toBeNull();
  });

  it('repairs only missing activation fields from immutable evidence on explicit continuation', async () => {
    await seedActive(database);
    const evidence = await readCharacterActivationEvidence(
      database,
      'guest',
      'generation-a'
    );
    expect(evidence).not.toBeNull();
    repairCharacterCutoverActivationFromEvidence(
      localStorage,
      'guest',
      evidence!,
      { runId: 'run-a', accountId: 'account-a' }
    );
    expect(readCharacterCutoverSelection(localStorage, 'guest')).toMatchObject({
      activatedGeneration: 'generation-a',
      activatedEpoch: 1,
      selectedAt: 'selected-a',
      playerBackupRunId: 'run-a',
    });

    localStorage.setItem(
      'rollkeeper:indexeddb-selection:guest:character',
      JSON.stringify({
        ...readCharacterCutoverSelection(localStorage, 'guest'),
        recoveryRunId: 'changed',
        activatedGeneration: undefined,
        activatedEpoch: undefined,
      })
    );
    expect(() =>
      repairCharacterCutoverActivationFromEvidence(
        localStorage,
        'guest',
        evidence!,
        { runId: 'run-a', accountId: 'account-a' }
      )
    ).toThrow(/evidence/i);
  });

  it('rebinds only authorization metadata and preserves original activation fields', async () => {
    const authority = await seedActive(database);
    markCharacterCutoverActivated(
      localStorage,
      'guest',
      authority.epoch,
      authority.generation
    );
    await seedActiveRun(database, 'run-b');
    const before = readCharacterCutoverSelection(localStorage, 'guest');
    const locks = new ImmediateLocks();

    const rebound = await rebindPlayerBackupActiveSelection({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      accountId: 'account-b',
      expectedActiveRunId: 'run-b',
      authorizedAt: 'authorized-b',
      expectedAuthority: {
        generation: authority.generation,
        epoch: authority.epoch,
      },
      currentCharacterSafetyVerified: false,
      locks,
      ownerId: 'tab-b',
      nowMs: () => 1,
    });

    expect(rebound).toEqual({
      ...before,
      playerBackupRunId: 'run-b',
      playerBackupAccountId: 'account-b',
      playerBackupAuthorizedAt: 'authorized-b',
    });
    expect(locks.names).toEqual([
      'rollkeeper:player-backup-account:account-b',
      'rollkeeper:indexeddb-migration',
    ]);
  });

  it('fails closed on missing immutable evidence without rewriting the marker', async () => {
    const authority = await seedActive(database);
    markCharacterCutoverActivated(
      localStorage,
      'guest',
      authority.epoch,
      authority.generation
    );
    await seedActiveRun(database, 'run-b');
    const before = localStorage.getItem(
      'rollkeeper:indexeddb-selection:guest:character'
    );
    const remove = database.transaction('meta', 'readwrite');
    remove
      .objectStore('meta')
      .delete('character-activation-evidence:guest:generation-a');
    await transactionComplete(remove);

    await expect(
      rebindPlayerBackupActiveSelection({
        factory: indexedDB,
        storage: localStorage,
        namespace: 'guest',
        accountId: 'account-b',
        expectedActiveRunId: 'run-b',
        authorizedAt: 'authorized-b',
        expectedAuthority: {
          generation: authority.generation,
          epoch: authority.epoch,
        },
        currentCharacterSafetyVerified: false,
        locks: new ImmediateLocks(),
        ownerId: 'tab-b',
        nowMs: () => 1,
      })
    ).rejects.toThrow(/evidence/i);
    expect(
      localStorage.getItem('rollkeeper:indexeddb-selection:guest:character')
    ).toBe(before);
  });

  it('fails closed when the database disappears after the active-run check', async () => {
    const authority = await seedActive(database);
    markCharacterCutoverActivated(
      localStorage,
      'guest',
      authority.epoch,
      authority.generation
    );
    await seedActiveRun(database, 'run-b');
    const before = localStorage.getItem(
      'rollkeeper:indexeddb-selection:guest:character'
    );
    const originalOpen = localDatabase.openExistingRollkeeperDatabase;
    const openSpy = vi
      .spyOn(localDatabase, 'openExistingRollkeeperDatabase')
      .mockImplementationOnce(options => originalOpen(options))
      .mockResolvedValueOnce(null);

    await expect(
      rebindPlayerBackupActiveSelection({
        factory: indexedDB,
        storage: localStorage,
        namespace: 'guest',
        accountId: 'account-b',
        expectedActiveRunId: 'run-b',
        authorizedAt: 'authorized-b',
        expectedAuthority: {
          generation: authority.generation,
          epoch: authority.epoch,
        },
        currentCharacterSafetyVerified: true,
        locks: new ImmediateLocks(),
        ownerId: 'tab-b',
        nowMs: () => 1,
      })
    ).rejects.toThrow(/authority is missing/i);
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(
      localStorage.getItem('rollkeeper:indexeddb-selection:guest:character')
    ).toBe(before);
    openSpy.mockRestore();
  });

  it('fails closed without current-character coverage or a verified extra file', async () => {
    const authority = await seedActive(database);
    markCharacterCutoverActivated(
      localStorage,
      'guest',
      authority.epoch,
      authority.generation
    );
    await seedActiveRun(database, 'run-b');
    const before = localStorage.getItem(
      'rollkeeper:indexeddb-selection:guest:character'
    );
    const coverageSpy = vi
      .spyOn(characterAuthority, 'inspectCurrentCharacterSafetyCoverage')
      .mockResolvedValue({
        authority: {
          authority: 'indexedDB',
          namespace: 'guest',
          family: 'character',
          generation: authority.generation,
          epoch: authority.epoch,
          committedAt: 'committed-a',
        },
        rows: [],
        parity: false,
        matchingJournalCount: 1,
        broadFileCoversCurrentCharacters: false,
      });

    await expect(
      rebindPlayerBackupActiveSelection({
        factory: indexedDB,
        storage: localStorage,
        namespace: 'guest',
        accountId: 'account-b',
        expectedActiveRunId: 'run-b',
        authorizedAt: 'authorized-b',
        expectedAuthority: {
          generation: authority.generation,
          epoch: authority.epoch,
        },
        currentCharacterSafetyVerified: false,
        locks: new ImmediateLocks(),
        ownerId: 'tab-b',
        nowMs: () => 1,
      })
    ).rejects.toThrow(/safety coverage is missing/i);
    expect(
      localStorage.getItem('rollkeeper:indexeddb-selection:guest:character')
    ).toBe(before);
    coverageSpy.mockRestore();
  });

  it('fails closed when the rebound selection cannot be read back', async () => {
    const authority = await seedActive(database);
    markCharacterCutoverActivated(
      localStorage,
      'guest',
      authority.epoch,
      authority.generation
    );
    await seedActiveRun(database, 'run-b');
    let rebindWrote = false;
    const storage: Storage = {
      get length() {
        return localStorage.length;
      },
      clear: () => localStorage.clear(),
      key: index => localStorage.key(index),
      removeItem: key => localStorage.removeItem(key),
      getItem: key => {
        const value = localStorage.getItem(key);
        if (rebindWrote && key.includes('indexeddb-selection') && value) {
          return JSON.stringify({
            ...JSON.parse(value),
            playerBackupRunId: 'stale-run',
          });
        }
        return value;
      },
      setItem: (key, value) => {
        if (key.includes('indexeddb-selection')) rebindWrote = true;
        localStorage.setItem(key, value);
      },
    };

    await expect(
      rebindPlayerBackupActiveSelection({
        factory: indexedDB,
        storage,
        namespace: 'guest',
        accountId: 'account-b',
        expectedActiveRunId: 'run-b',
        authorizedAt: 'authorized-b',
        expectedAuthority: {
          generation: authority.generation,
          epoch: authority.epoch,
        },
        currentCharacterSafetyVerified: true,
        locks: new ImmediateLocks(),
        ownerId: 'tab-b',
        nowMs: () => 1,
      })
    ).rejects.toThrow(/could not be verified/i);
  });
});
