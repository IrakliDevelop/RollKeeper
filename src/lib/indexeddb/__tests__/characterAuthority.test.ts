import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  commitCharacterCutover,
  commitCharacterFamilyWrite,
  readCharacterAuthority,
  retryCharacterMirrorJournal,
  rollbackCharacterAuthority,
  scopedCharacterAuthorityKeys,
  verifyCharacterRollbackGenerationAfterReopen,
} from '@/lib/indexeddb/characterAuthority';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

const NAMESPACE = 'guest' as const;
const GENERATION = 'generation-a';
const RAW = '{"state":{"characters":[]},"version":1}';

async function seedReady(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: 'migration-state:guest:character',
    state: 'CUTOVER_READY',
    runId: GENERATION,
    checkpointAt: 'before',
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-player-data',
    presence: true,
    rawValue: RAW,
  });
  await transactionComplete(transaction);
}

describe('scoped character authority', () => {
  afterEach(async () => {
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('uses namespace-and-family scoped pointer and epoch keys', () => {
    expect(scopedCharacterAuthorityKeys('guest')).toEqual({
      pointer: 'active-generation:guest:character',
      epoch: 'cutover-epoch:guest:character',
      state: 'migration-state:guest:character',
    });
    expect(scopedCharacterAuthorityKeys('user:a').pointer).not.toBe(
      scopedCharacterAuthorityKeys('user:b').pointer
    );
  });

  it('requires ready state, matching generation, recovery receipt, unchanged manifest, reopen/parity/empty journal gates, and confirmation', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    const complete = {
      recoveryReceipt: true,
      sourceManifestUnchanged: true,
      captureVerifiedAfterReopen: true,
      noQuarantine: true,
      parity: true,
      journalEmpty: true,
    };
    for (const field of Object.keys(complete) as Array<keyof typeof complete>) {
      await expect(
        commitCharacterCutover(database, {
          namespace: NAMESPACE,
          generation: GENERATION,
          confirmed: true,
          gates: { ...complete, [field]: false },
          now: () => 'now',
        })
      ).rejects.toThrow(/cutover gate/i);
    }
    await expect(
      commitCharacterCutover(database, {
        namespace: NAMESPACE,
        generation: GENERATION,
        confirmed: false,
        gates: complete,
        now: () => 'now',
      })
    ).rejects.toThrow(/explicit confirmation/i);
    database.close();
  });

  it('commits exactly one scoped pointer and epoch atomically and is idempotent', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    const gates = {
      recoveryReceipt: true,
      sourceManifestUnchanged: true,
      captureVerifiedAfterReopen: true,
      noQuarantine: true,
      parity: true,
      journalEmpty: true,
    };
    const first = await commitCharacterCutover(database, {
      namespace: NAMESPACE,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'now',
    });
    expect(first).toMatchObject({
      authority: 'indexedDB',
      epoch: 1,
      generation: GENERATION,
    });
    expect(
      await commitCharacterCutover(database, {
        namespace: NAMESPACE,
        generation: GENERATION,
        confirmed: true,
        gates,
        now: () => 'later',
      })
    ).toEqual(first);
    expect(await readCharacterAuthority(database, NAMESPACE)).toEqual(first);

    const transaction = database.transaction('meta', 'readonly');
    expect(
      await requestResult(
        transaction.objectStore('meta').get('active-generation')
      )
    ).toBeUndefined();
    expect(
      await requestResult(
        transaction.objectStore('meta').get('active-generation:guest:dm')
      )
    ).toBeUndefined();
    await transactionComplete(transaction);
    database.close();
  });

  it('leaves localStorage authority intact on failure before pointer commit', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    await expect(
      commitCharacterCutover(database, {
        namespace: NAMESPACE,
        generation: GENERATION,
        confirmed: true,
        gates: {
          recoveryReceipt: true,
          sourceManifestUnchanged: true,
          captureVerifiedAfterReopen: true,
          noQuarantine: true,
          parity: true,
          journalEmpty: true,
        },
        now: () => 'now',
        testHooks: { abortPointerTransaction: true },
      })
    ).rejects.toThrow(/abort/i);
    expect(await readCharacterAuthority(database, NAMESPACE)).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    database.close();
  });

  it('rechecks the scoped journal inside the atomic pointer transaction', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    const queued = database.transaction('journal', 'readwrite');
    queued.objectStore('journal').put({
      journalId: 'late-write',
      namespace: NAMESPACE,
      family: 'character',
      generation: GENERATION,
      key: 'rollkeeper-player-data',
    });
    await transactionComplete(queued);
    await expect(
      commitCharacterCutover(database, {
        namespace: NAMESPACE,
        generation: GENERATION,
        confirmed: true,
        gates: {
          recoveryReceipt: true,
          sourceManifestUnchanged: true,
          captureVerifiedAfterReopen: true,
          noQuarantine: true,
          parity: true,
          journalEmpty: true,
        },
        now: () => 'now',
      })
    ).rejects.toThrow(/journal/i);
    expect(await readCharacterAuthority(database, NAMESPACE)).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    database.close();
  });

  it('acknowledges an IndexedDB commit even when the mirror fails and retries the durable journal after reload', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    const authority = await commitCharacterCutover(database, {
      namespace: NAMESPACE,
      generation: GENERATION,
      confirmed: true,
      gates: {
        recoveryReceipt: true,
        sourceManifestUnchanged: true,
        captureVerifiedAfterReopen: true,
        noQuarantine: true,
        parity: true,
        journalEmpty: true,
      },
      now: () => 'now',
    });
    const storage = {
      setItem: vi.fn<(key: string, value: string) => void>(() => {
        throw new DOMException('full', 'QuotaExceededError');
      }),
      getItem: vi.fn(() => null),
    };
    const result = await commitCharacterFamilyWrite(database, storage, {
      namespace: NAMESPACE,
      key: 'rollkeeper-player-data',
      rawValue: '{"new":true}',
      expectedEpoch: authority.epoch,
      journalId: 'journal-a',
      now: () => 'write',
    });
    expect(result).toEqual({
      saved: true,
      idbAck: true,
      mirrorAck: false,
      mirrorPending: true,
    });
    database.close();

    const reopened = await openRollkeeperDatabase({ factory: indexedDB });
    storage.setItem.mockImplementation(() => undefined);
    await retryCharacterMirrorJournal(reopened, storage, NAMESPACE);
    expect(storage.setItem).toHaveBeenLastCalledWith(
      'rollkeeper-player-data',
      '{"new":true}'
    );
    const transaction = reopened.transaction('journal', 'readonly');
    expect(
      await requestResult(transaction.objectStore('journal').count())
    ).toBe(0);
    await transactionComplete(transaction);
    reopened.close();
  });

  it('reports unsaved when the active transaction rejects even if a compatibility mirror could write', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    await commitCharacterCutover(database, {
      namespace: NAMESPACE,
      generation: GENERATION,
      confirmed: true,
      gates: {
        recoveryReceipt: true,
        sourceManifestUnchanged: true,
        captureVerifiedAfterReopen: true,
        noQuarantine: true,
        parity: true,
        journalEmpty: true,
      },
      now: () => 'now',
    });
    const storage = { setItem: vi.fn(), getItem: vi.fn(() => RAW) };
    const result = await commitCharacterFamilyWrite(database, storage, {
      namespace: NAMESPACE,
      key: 'rollkeeper-player-data',
      rawValue: 'new',
      expectedEpoch: 1,
      journalId: 'journal-failed',
      now: () => 'write',
      testHooks: { abortActiveTransaction: true },
    });
    expect(result.saved).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    database.close();
  });

  it('rejects stale epochs and preserves the candidate as a conflict', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    await commitCharacterCutover(database, {
      namespace: NAMESPACE,
      generation: GENERATION,
      confirmed: true,
      gates: {
        recoveryReceipt: true,
        sourceManifestUnchanged: true,
        captureVerifiedAfterReopen: true,
        noQuarantine: true,
        parity: true,
        journalEmpty: true,
      },
      now: () => 'now',
    });
    const result = await commitCharacterFamilyWrite(
      database,
      { setItem: vi.fn(), getItem: vi.fn(() => null) },
      {
        namespace: NAMESPACE,
        key: 'rollkeeper-character:hero',
        rawValue: 'stale',
        expectedEpoch: 0,
        journalId: 'stale-a',
        now: () => 'later',
      }
    );
    expect(result.saved).toBe(false);
    const transaction = database.transaction('conflicts', 'readonly');
    expect(
      await requestResult(transaction.objectStore('conflicts').get('stale-a'))
    ).toMatchObject({
      kind: 'stale-cutover-epoch-write',
      rawValue: 'stale',
      resolutionState: 'unresolved',
    });
    await transactionComplete(transaction);
    database.close();
  });

  it('rolls back only with exact mirror parity and otherwise remains IndexedDB-authoritative in recovery required', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    await commitCharacterCutover(database, {
      namespace: NAMESPACE,
      generation: GENERATION,
      confirmed: true,
      gates: {
        recoveryReceipt: true,
        sourceManifestUnchanged: true,
        captureVerifiedAfterReopen: true,
        noQuarantine: true,
        parity: true,
        journalEmpty: true,
      },
      now: () => 'now',
    });
    const mismatched = { getItem: vi.fn(() => 'different') };
    await expect(
      rollbackCharacterAuthority(database, mismatched, {
        namespace: NAMESPACE,
        expectedEpoch: 1,
        confirmed: true,
        reopenVerified: true,
        now: () => 'rollback',
      })
    ).resolves.toMatchObject({
      authority: 'indexedDB',
      epoch: 1,
      state: 'RECOVERY_REQUIRED',
    });
    expect((await readCharacterAuthority(database, NAMESPACE)).authority).toBe(
      'indexedDB'
    );

    const matching = {
      getItem: vi.fn((key: string) =>
        key === 'rollkeeper-player-data' ? RAW : null
      ),
    };
    const rolledBack = await rollbackCharacterAuthority(database, matching, {
      namespace: NAMESPACE,
      expectedEpoch: 1,
      confirmed: true,
      reopenVerified: true,
      now: () => 'rollback',
    });
    expect(rolledBack).toMatchObject({
      authority: 'localStorage',
      epoch: 2,
      state: 'ROLLED_BACK',
      rollbackGeneration: GENERATION,
    });
    database.close();
  });

  it('rejects invalid activation generations and stale/unconfirmed rollback attempts', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const gates = {
      recoveryReceipt: true,
      sourceManifestUnchanged: true,
      captureVerifiedAfterReopen: true,
      noQuarantine: true,
      parity: true,
      journalEmpty: true,
    };
    await expect(
      commitCharacterCutover(database, {
        namespace: NAMESPACE,
        generation: 'missing',
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow(/not CUTOVER_READY/i);
    await seedReady(database);
    await commitCharacterCutover(database, {
      namespace: NAMESPACE,
      generation: GENERATION,
      confirmed: true,
      gates,
      now: () => 'now',
    });
    await expect(
      commitCharacterCutover(database, {
        namespace: NAMESPACE,
        generation: 'other',
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow(/different/i);
    await expect(
      rollbackCharacterAuthority(
        database,
        { getItem: () => RAW },
        {
          namespace: NAMESPACE,
          expectedEpoch: 1,
          confirmed: false,
          reopenVerified: true,
          now: () => 'now',
        }
      )
    ).rejects.toThrow(/confirmation/i);
    await expect(
      rollbackCharacterAuthority(
        database,
        { getItem: () => RAW },
        {
          namespace: NAMESPACE,
          expectedEpoch: 0,
          confirmed: true,
          reopenVerified: true,
          now: () => 'now',
        }
      )
    ).rejects.toThrow(/stale/i);
    database.close();
  });

  it('keeps failed mirror retries queued and blocks rollback for journal or reopen failures', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    await commitCharacterCutover(database, {
      namespace: NAMESPACE,
      generation: GENERATION,
      confirmed: true,
      gates: {
        recoveryReceipt: true,
        sourceManifestUnchanged: true,
        captureVerifiedAfterReopen: true,
        noQuarantine: true,
        parity: true,
        journalEmpty: true,
      },
      now: () => 'now',
    });
    const queue = database.transaction('journal', 'readwrite');
    queue.objectStore('journal').put({
      journalId: 'pending',
      kind: 'character-compatibility-mirror',
      namespace: NAMESPACE,
      family: 'character',
      generation: GENERATION,
      cutoverEpoch: 1,
      key: 'rollkeeper-player-data',
      rawValue: RAW,
      idbAck: true,
      legacyAck: false,
      attempts: 1,
      updatedAt: 'before',
    });
    await transactionComplete(queue);
    await retryCharacterMirrorJournal(
      database,
      {
        getItem: () => RAW,
        setItem: () => {
          throw new Error('still full');
        },
      },
      NAMESPACE
    );
    const read = database.transaction('journal', 'readonly');
    expect(
      await requestResult(read.objectStore('journal').get('pending'))
    ).toMatchObject({ attempts: 2 });
    await transactionComplete(read);
    await expect(
      rollbackCharacterAuthority(
        database,
        { getItem: () => RAW },
        {
          namespace: NAMESPACE,
          expectedEpoch: 1,
          confirmed: true,
          reopenVerified: true,
          now: () => 'now',
        }
      )
    ).resolves.toMatchObject({ state: 'RECOVERY_REQUIRED' });
    const clear = database.transaction('journal', 'readwrite');
    clear.objectStore('journal').clear();
    await transactionComplete(clear);
    await expect(
      rollbackCharacterAuthority(
        database,
        { getItem: () => RAW },
        {
          namespace: NAMESPACE,
          expectedEpoch: 1,
          confirmed: true,
          reopenVerified: false,
          now: () => 'now',
        }
      )
    ).resolves.toMatchObject({ state: 'RECOVERY_REQUIRED' });
    database.close();
  });

  it('covers fail-closed missing generation, non-family, absent-pointer, legacy retry, and absent-value rollback branches', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const gates = {
      recoveryReceipt: true,
      sourceManifestUnchanged: true,
      captureVerifiedAfterReopen: true,
      noQuarantine: true,
      parity: true,
      journalEmpty: true,
    };
    const ready = database.transaction('meta', 'readwrite');
    ready.objectStore('meta').put({
      key: 'migration-state:guest:character',
      state: 'CUTOVER_READY',
      runId: 'empty',
      checkpointAt: 'now',
    });
    await transactionComplete(ready);
    await expect(
      commitCharacterCutover(database, {
        namespace: NAMESPACE,
        generation: 'empty',
        confirmed: true,
        gates,
        now: () => 'now',
      })
    ).rejects.toThrow(/missing/i);
    await expect(
      commitCharacterFamilyWrite(
        database,
        { getItem: () => null, setItem: vi.fn() },
        {
          namespace: NAMESPACE,
          key: 'rollkeeper-dm-data',
          rawValue: 'dm',
          expectedEpoch: 0,
          journalId: 'dm',
          now: () => 'now',
        }
      )
    ).resolves.toMatchObject({ saved: false });
    await expect(
      commitCharacterFamilyWrite(
        database,
        { getItem: () => null, setItem: vi.fn() },
        {
          namespace: NAMESPACE,
          key: 'rollkeeper-player-data',
          rawValue: 'stale',
          expectedEpoch: 0,
          journalId: 'no-pointer',
          now: () => 'now',
        }
      )
    ).resolves.toMatchObject({ saved: false });
    await expect(
      retryCharacterMirrorJournal(
        database,
        { getItem: () => null, setItem: vi.fn() },
        NAMESPACE
      )
    ).resolves.toBeUndefined();

    const active = database.transaction(['meta', 'kvGenerations'], 'readwrite');
    active.objectStore('meta').put({
      key: 'active-generation:guest:character',
      authority: 'indexedDB',
      namespace: NAMESPACE,
      family: 'character',
      generation: 'absent',
      epoch: 1,
      committedAt: 'now',
    });
    active.objectStore('kvGenerations').put({
      namespace: NAMESPACE,
      generation: 'absent',
      key: 'rollkeeper-player-data',
      presence: false,
      rawValue: null,
    });
    await transactionComplete(active);
    await expect(
      rollbackCharacterAuthority(
        database,
        { getItem: () => null },
        {
          namespace: NAMESPACE,
          expectedEpoch: 1,
          confirmed: true,
          reopenVerified: true,
          now: () => 'rollback',
        }
      )
    ).resolves.toMatchObject({ state: 'ROLLED_BACK', epoch: 2 });
    database.close();
  });

  it('closes and reopens IndexedDB to verify the exact active rollback generation', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedReady(database);
    const authority = await commitCharacterCutover(database, {
      namespace: NAMESPACE,
      generation: GENERATION,
      confirmed: true,
      gates: {
        recoveryReceipt: true,
        sourceManifestUnchanged: true,
        captureVerifiedAfterReopen: true,
        noQuarantine: true,
        parity: true,
        journalEmpty: true,
      },
      now: () => 'now',
    });
    database.close();

    await expect(
      verifyCharacterRollbackGenerationAfterReopen(
        indexedDB,
        NAMESPACE,
        authority.generation,
        authority.epoch
      )
    ).resolves.toBe(true);
    await expect(
      verifyCharacterRollbackGenerationAfterReopen(
        indexedDB,
        NAMESPACE,
        'wrong-generation',
        authority.epoch
      )
    ).resolves.toBe(false);
  });
});
