import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';

import {
  type PlayerBackupOnlineCheckpoint,
  type PlayerBackupRunV1,
  PlayerBackupRunReplacedError,
  advancePlayerBackupRunToLocalReady,
  assertPlayerBackupRunLocalReady,
  isPlayerBackupRun,
  playerBackupExecutionPath,
  readActivePlayerBackupRun,
  readPlayerBackupRunInTransaction,
  updatePlayerBackupCharacterCheckpoint,
} from '../playerBackupRunRepository';
import { runPlayerBackupTransaction } from '../playerBackupRunFence';

const ACCOUNT = 'account-a';
const NAMESPACE = `user:${ACCOUNT}` as const;

function run(overrides: Partial<PlayerBackupRunV1> = {}): PlayerBackupRunV1 {
  return {
    version: 1,
    runId: 'run-a',
    accountId: ACCOUNT,
    namespace: NAMESPACE,
    mode: 'ongoing',
    eligibleCharacterIds: ['hero-a', 'hero-b'],
    selectedCharacterIds: ['hero-a'],
    clearedCharacterIds: ['hero-b'],
    futureDefault: 'on',
    broadSafetyReceipt: {
      runId: 'safety-a',
      manifestHash: 'manifest-a',
      createdAt: '2026-08-26T09:00:00.000Z',
      protectedEntryDigest: 'protected-a',
    },
    currentCharacterSafetyReceipt: {
      runId: 'safety-characters-a',
      manifestHash: 'manifest-characters-a',
      createdAt: '2026-08-26T09:00:00.000Z',
      entryVectorDigest: 'entries-a',
      authorityGeneration: 'generation-a',
      authorityEpoch: 4,
    },
    authority: {
      kind: 'legacy',
      namespace: 'guest',
      family: 'character',
    },
    confirmedAt: '2026-08-26T10:00:00.000Z',
    stage: 'confirmed',
    characterCheckpoints: {
      'hero-a': { localPreparation: 'pending' },
    },
    ...overrides,
  };
}

describe('player backup durable consent', () => {
  let database: IDBDatabase;

  beforeEach(async () => {
    database = await openRollkeeperDatabase({ factory: indexedDB });
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('atomically commits the exact run, active pointer, preference partition, and future default', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await preferences.setCharacter(NAMESPACE, 'hero-a', false);

    const confirmedRun = run();
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: confirmedRun,
      confirmed: true,
    });

    await expect(
      readActivePlayerBackupRun({ accountId: ACCOUNT, factory: indexedDB })
    ).resolves.toEqual(confirmedRun);
    await expect(
      preferences.readConfirmedSelection(NAMESPACE, ['hero-a', 'hero-b'])
    ).resolves.toEqual({
      characterPolicies: { 'hero-a': 'on', 'hero-b': 'off' },
      futureDefault: 'on',
      confirmedAt: confirmedRun.confirmedAt,
    });
  });

  it('writes selected characters off for one-time consent', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    const confirmedRun = run({
      mode: 'one-time',
      futureDefault: 'off',
      currentCharacterSafetyReceipt: undefined,
    });
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: confirmedRun,
      confirmed: true,
    });

    await expect(
      preferences.readConfirmedSelection(NAMESPACE, ['hero-a', 'hero-b'])
    ).resolves.toMatchObject({
      characterPolicies: { 'hero-a': 'off', 'hero-b': 'off' },
      futureDefault: 'off',
    });
  });

  it('aborts all consent records when the transaction fails', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await expect(
      preferences.applyConfirmedSelection({
        expectedActiveRunId: null,
        run: run(),
        confirmed: true,
        testHooks: { abortTransaction: true },
      })
    ).rejects.toThrow(/aborted/i);

    await expect(
      readActivePlayerBackupRun({ accountId: ACCOUNT, factory: indexedDB })
    ).resolves.toBeNull();
    await expect(
      preferences.readConfirmedSelection(NAMESPACE, ['hero-a', 'hero-b'])
    ).resolves.toEqual({
      characterPolicies: {},
      futureDefault: null,
      confirmedAt: null,
    });
  });

  it('requires selected and cleared IDs to exactly partition eligible IDs', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    for (const invalid of [
      run({ selectedCharacterIds: ['hero-a'], clearedCharacterIds: [] }),
      run({
        selectedCharacterIds: ['hero-a'],
        clearedCharacterIds: ['hero-a', 'hero-b'],
      }),
      run({ selectedCharacterIds: ['hero-c'] }),
    ]) {
      await expect(
        preferences.applyConfirmedSelection({
          expectedActiveRunId: null,
          run: invalid,
          confirmed: true,
        })
      ).rejects.toThrow(/partition/i);
    }
  });

  it('isolates accounts and compare-and-replaces the observed active pointer', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: run(),
      confirmed: true,
    });

    await expect(
      preferences.applyConfirmedSelection({
        expectedActiveRunId: null,
        run: run({ runId: 'run-from-stale-tab' }),
        confirmed: true,
      })
    ).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);

    await expect(
      readActivePlayerBackupRun({
        accountId: 'account-b',
        factory: indexedDB,
      })
    ).resolves.toBeNull();
    await expect(
      readActivePlayerBackupRun({ accountId: ACCOUNT, factory: indexedDB })
    ).resolves.toMatchObject({ runId: 'run-a' });
  });

  it('does not leave a run row from a losing compare-and-replace', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: run(),
      confirmed: true,
    });
    await expect(
      preferences.applyConfirmedSelection({
        expectedActiveRunId: null,
        run: run({ runId: 'loser' }),
        confirmed: true,
      })
    ).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);

    const transaction = database.transaction('meta', 'readonly');
    const loser = await requestResult(
      transaction.objectStore('meta').get('player-backup-run:loser')
    );
    await transactionComplete(transaction);
    expect(loser).toBeUndefined();
  });

  it('advances confirmed consent to local-ready only with verified local evidence', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: run(),
      confirmed: true,
    });
    await advancePlayerBackupRunToLocalReady(database, {
      accountId: ACCOUNT,
      expectedActiveRunId: 'run-a',
      authority: {
        kind: 'indexedDB',
        namespace: 'guest',
        family: 'character',
        generation: 'generation-a',
        epoch: 1,
      },
      selectionAuthorizedAt: '2026-08-26T10:00:00.000Z',
      verifiedAt: '2026-08-26T10:05:00.000Z',
    });

    await expect(
      readActivePlayerBackupRun({ accountId: ACCOUNT, factory: indexedDB })
    ).resolves.toMatchObject({
      stage: 'local-ready',
      authority: { generation: 'generation-a', epoch: 1 },
      characterCheckpoints: {
        'hero-a': { localPreparation: 'ready' },
      },
      localReadyEvidence: {
        selectionAuthorizedAt: '2026-08-26T10:00:00.000Z',
        verifiedAt: '2026-08-26T10:05:00.000Z',
      },
    });
  });

  it('prevents initial online work before local-ready in the same transaction', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: run(),
      confirmed: true,
    });
    await expect(
      runPlayerBackupTransaction({
        database,
        accountId: ACCOUNT,
        expectedActiveRunId: 'run-a',
        stores: ['documents'],
        task: async transaction => {
          await assertPlayerBackupRunLocalReady(
            transaction.objectStore('meta'),
            ACCOUNT,
            'run-a'
          );
          transaction.objectStore('documents').put({
            namespace: NAMESPACE,
            family: 'character',
            legacyId: 'hero-a',
            originPlayerBackupRunId: 'run-a',
          });
        },
      })
    ).rejects.toThrow(/local-ready/i);

    const read = database.transaction('documents', 'readonly');
    const rows = await requestResult(read.objectStore('documents').getAll());
    await transactionComplete(read);
    expect(rows).toEqual([]);
  });

  it('accepts degraded-manual one-time confirmed runs and rejects them at local-ready', async () => {
    expect(
      isPlayerBackupRun(
        run({
          mode: 'one-time',
          futureDefault: 'off',
          executionPath: 'degraded-manual',
        })
      )
    ).toBe(true);
    expect(isPlayerBackupRun(run({ executionPath: 'degraded-manual' }))).toBe(
      false
    );
    expect(playerBackupExecutionPath(run())).toBe('integrated');

    const preferences = new AutomaticCharacterSyncPreferences(database);
    const degradedRun = run({
      mode: 'one-time',
      futureDefault: 'off',
      executionPath: 'degraded-manual',
    });
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: degradedRun,
      confirmed: true,
    });

    await expect(
      advancePlayerBackupRunToLocalReady(database, {
        accountId: ACCOUNT,
        expectedActiveRunId: 'run-a',
        authority: {
          kind: 'indexedDB',
          namespace: 'guest',
          family: 'character',
          generation: 'generation-a',
          epoch: 1,
        },
        selectionAuthorizedAt: '2026-08-26T10:00:00.000Z',
        verifiedAt: '2026-08-26T10:05:00.000Z',
      })
    ).rejects.toThrow('Degraded manual runs never reach local-ready');
  });

  it('validates online checkpoints and requires protected evidence', () => {
    const pending: PlayerBackupOnlineCheckpoint = {
      version: 1,
      kind: 'manual',
      cloudId: 'cloud-a',
      mutationId: 'mutation-a',
      state: 'pending',
      recordedAt: '2026-08-26T10:01:00.000Z',
    };
    expect(
      isPlayerBackupRun(
        run({
          characterCheckpoints: {
            'hero-a': { localPreparation: 'pending', online: pending },
          },
        })
      )
    ).toBe(true);
    expect(
      isPlayerBackupRun(
        run({
          characterCheckpoints: {
            'hero-a': {
              localPreparation: 'pending',
              online: { ...pending, state: 'protected' },
            },
          },
        })
      )
    ).toBe(false);
    expect(
      isPlayerBackupRun(
        run({
          characterCheckpoints: {
            'hero-a': {
              localPreparation: 'pending',
              online: {
                ...pending,
                state: 'protected',
                serverVersion: 1,
                contentFingerprint: 'fp',
                verifiedAt: 't',
              },
            },
          },
        })
      )
    ).toBe(true);
  });

  it('updates a selected character checkpoint only inside a fenced transaction and aborts atomically', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: run(),
      confirmed: true,
    });

    const pending: PlayerBackupOnlineCheckpoint = {
      version: 1,
      kind: 'manual',
      cloudId: 'cloud-a',
      mutationId: 'mutation-a',
      state: 'pending',
      recordedAt: '2026-08-26T10:01:00.000Z',
    };

    await expect(
      runPlayerBackupTransaction({
        database,
        accountId: ACCOUNT,
        expectedActiveRunId: 'run-a',
        stores: [],
        task: async transaction => {
          await updatePlayerBackupCharacterCheckpoint(
            transaction.objectStore('meta'),
            {
              accountId: ACCOUNT,
              expectedActiveRunId: 'run-a',
              legacyId: 'hero-a',
              online: pending,
            }
          );
          throw new Error('boom');
        },
      })
    ).rejects.toThrow('boom');

    await expect(
      readActivePlayerBackupRun({ accountId: ACCOUNT, factory: indexedDB })
    ).resolves.toMatchObject({
      characterCheckpoints: { 'hero-a': { localPreparation: 'pending' } },
    });
    await expect(
      readActivePlayerBackupRun({ accountId: ACCOUNT, factory: indexedDB })
    ).resolves.not.toMatchObject({
      characterCheckpoints: { 'hero-a': { online: expect.anything() } },
    });

    const updated = await runPlayerBackupTransaction({
      database,
      accountId: ACCOUNT,
      expectedActiveRunId: 'run-a',
      stores: [],
      task: transaction =>
        updatePlayerBackupCharacterCheckpoint(transaction.objectStore('meta'), {
          accountId: ACCOUNT,
          expectedActiveRunId: 'run-a',
          legacyId: 'hero-a',
          online: pending,
        }),
    });
    expect(updated.characterCheckpoints['hero-a'].online).toEqual(pending);

    await expect(
      readActivePlayerBackupRun({ accountId: ACCOUNT, factory: indexedDB })
    ).resolves.toMatchObject({
      characterCheckpoints: { 'hero-a': { online: pending } },
    });

    await expect(
      runPlayerBackupTransaction({
        database,
        accountId: ACCOUNT,
        expectedActiveRunId: 'run-a',
        stores: [],
        task: transaction =>
          updatePlayerBackupCharacterCheckpoint(
            transaction.objectStore('meta'),
            {
              accountId: ACCOUNT,
              expectedActiveRunId: 'run-a',
              legacyId: 'hero-b',
              online: pending,
            }
          ),
      })
    ).rejects.toThrow('Character is not selected in this player backup run');

    await expect(
      readActivePlayerBackupRun({ accountId: ACCOUNT, factory: indexedDB })
    ).resolves.toMatchObject({
      characterCheckpoints: { 'hero-a': { online: pending } },
    });

    const staleTransaction = database.transaction('meta', 'readonly');
    await expect(
      readPlayerBackupRunInTransaction(
        staleTransaction.objectStore('meta'),
        ACCOUNT,
        'run-stale'
      )
    ).rejects.toBeInstanceOf(PlayerBackupRunReplacedError);
  });

  it('advancing to local-ready preserves online checkpoints', async () => {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run: run(),
      confirmed: true,
    });

    const pending: PlayerBackupOnlineCheckpoint = {
      version: 1,
      kind: 'automatic',
      cloudId: 'cloud-a',
      mutationId: 'mutation-a',
      state: 'queued',
      recordedAt: '2026-08-26T10:01:00.000Z',
    };
    await runPlayerBackupTransaction({
      database,
      accountId: ACCOUNT,
      expectedActiveRunId: 'run-a',
      stores: [],
      task: transaction =>
        updatePlayerBackupCharacterCheckpoint(transaction.objectStore('meta'), {
          accountId: ACCOUNT,
          expectedActiveRunId: 'run-a',
          legacyId: 'hero-a',
          online: pending,
        }),
    });

    await advancePlayerBackupRunToLocalReady(database, {
      accountId: ACCOUNT,
      expectedActiveRunId: 'run-a',
      authority: {
        kind: 'indexedDB',
        namespace: 'guest',
        family: 'character',
        generation: 'generation-a',
        epoch: 1,
      },
      selectionAuthorizedAt: '2026-08-26T10:00:00.000Z',
      verifiedAt: '2026-08-26T10:05:00.000Z',
    });

    await expect(
      readActivePlayerBackupRun({ accountId: ACCOUNT, factory: indexedDB })
    ).resolves.toMatchObject({
      stage: 'local-ready',
      characterCheckpoints: {
        'hero-a': { localPreparation: 'ready', online: pending },
      },
    });
  });
});
