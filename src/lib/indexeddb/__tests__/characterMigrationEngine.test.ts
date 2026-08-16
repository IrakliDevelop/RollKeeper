import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { runCharacterIndexedDbMigration } from '@/lib/indexeddb/characterMigrationEngine';
import { previewPersistedCharacterCandidates } from '@/lib/indexeddb/characterCandidatePreview';

describe('character-only Slice 7 preparation', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('captures and transforms the complete character family without staging unrelated DM families', async () => {
    localStorage.setItem(
      'rollkeeper-character',
      '{"state":{"character":{"id":"hero"}}}'
    );
    localStorage.setItem(
      'rollkeeper-character:hero',
      '{"state":{"character":{"id":"hero"}}}'
    );
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    localStorage.setItem(
      'rollkeeper-dm-data',
      '{"state":{"campaigns":["untouched"]},"version":1}'
    );
    const result = await runCharacterIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      runId: 'character-run',
      ownerId: 'tab-a',
      now: () => 'now',
      nowMs: () => 1,
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });
    expect(result.state).toBe('CUTOVER_READY');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const transaction = database.transaction(
      ['meta', 'legacySnapshots', 'kvGenerations'],
      'readonly'
    );
    const snapshots = await requestResult(
      transaction.objectStore('legacySnapshots').getAll()
    );
    const rows = await requestResult(
      transaction.objectStore('kvGenerations').getAll()
    );
    expect(snapshots.map(row => row.key).sort()).toEqual([
      'rollkeeper-character',
      'rollkeeper-character:hero',
      'rollkeeper-player-data',
    ]);
    expect(rows.map(row => row.key).sort()).toEqual([
      'rollkeeper-character',
      'rollkeeper-character:hero',
      'rollkeeper-player-data',
    ]);
    expect(
      await requestResult(
        transaction.objectStore('meta').get('migration-state:guest:character')
      )
    ).toMatchObject({ state: 'CUTOVER_READY' });
    expect(
      await requestResult(
        transaction.objectStore('meta').get('migration-state:guest')
      )
    ).toBeUndefined();
    await transactionComplete(transaction);
    database.close();
    expect(localStorage.getItem('rollkeeper-dm-data')).toBe(
      '{"state":{"campaigns":["untouched"]},"version":1}'
    );
  });

  it('uses the independently downloaded full-device manifest receipt without weakening the character capture', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    const hasDownloadReceipt = vi.fn().mockResolvedValue(true);
    await runCharacterIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      runId: 'receipt-run',
      ownerId: 'tab-a',
      now: () => 'now',
      nowMs: () => 1,
      requiredRecoveryManifestHash: 'full-device-manifest',
      recoveryGate: { hasDownloadReceipt },
    });
    expect(hasDownloadReceipt).toHaveBeenCalledWith('full-device-manifest');
  });

  it('preserves equal-stamp divergent character candidates as conflicts and refuses readiness', async () => {
    const stamp = {
      id: 'hero',
      revision: 1,
      lastMutatedAt: 2,
      lastMutatedBy: 'tab',
    };
    localStorage.setItem(
      'rollkeeper-character:hero',
      JSON.stringify({
        state: {
          character: { ...stamp, marker: 'envelope' },
          intentWatermarks: {},
        },
      })
    );
    localStorage.setItem(
      'rollkeeper-player-data',
      JSON.stringify({
        state: {
          characters: [
            { id: 'hero', characterData: { ...stamp, marker: 'roster' } },
          ],
        },
        version: 1,
      })
    );
    const result = await runCharacterIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'guest',
      runId: 'conflict-run',
      ownerId: 'tab-a',
      now: () => 'now',
      nowMs: () => 1,
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });
    expect(result.state).toBe('SHADOWING');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const transaction = database.transaction('conflicts', 'readonly');
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        kind: 'equal-stamp-divergence',
        characterId: 'hero',
        resolutionState: 'unresolved',
      }),
    ]);
    await transactionComplete(transaction);
    database.close();
  });

  it('ignores malformed/non-envelope/unknown candidate rows without inventing IDs', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction('kvGenerations', 'readwrite');
    for (const [key, rawValue] of [
      ['rollkeeper-character:bad-json', '{broken'],
      ['rollkeeper-character:no-state', '{}'],
      ['rollkeeper-character:no-character', '{"state":{}}'],
      [
        'rollkeeper-player-data',
        '{"state":{"characters":[null,{"id":1,"characterData":{}}]},"version":1}',
      ],
      ['rollkeeper-unknown', '{"state":{}}'],
    ]) {
      setup.objectStore('kvGenerations').put({
        namespace: 'guest',
        generation: 'invalid-preview',
        key,
        rawValue,
        presence: true,
      });
    }
    await transactionComplete(setup);
    const preview = await previewPersistedCharacterCandidates(
      database,
      'guest',
      'invalid-preview',
      () => 'now'
    );
    expect(preview.active.size).toBe(0);
    expect(preview.conflicts).toEqual([]);
    database.close();
  });

  it('returns the legacy-primary failure without opening a candidate preview database', async () => {
    localStorage.setItem('rollkeeper-player-data', '{}');
    await expect(
      runCharacterIndexedDbMigration({
        factory: null,
        storage: localStorage,
        namespace: 'guest',
        runId: 'unavailable',
        ownerId: 'tab',
        now: () => 'now',
        nowMs: () => 1,
        recoveryGate: { hasDownloadReceipt: vi.fn() },
      })
    ).resolves.toMatchObject({
      state: 'LEGACY_PRIMARY',
      authority: 'localStorage',
    });
  });
});
