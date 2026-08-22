import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CustomMagicItem } from '@/types/magicItemLibrary';

import { runMagicItemIndexedDbMigration } from '../magicItemMigration';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

function item(
  id: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    campaignCode: 'AAA111',
    name: `Item ${id}`,
    category: 'wondrous',
    rarity: 'rare',
    description: 'A curious trinket.',
    properties: [],
    requiresAttunement: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    tags: [],
    ...extra,
  } satisfies Partial<CustomMagicItem> & Record<string, unknown>;
}

function validEnvelope(items: Array<Record<string, unknown>>) {
  return JSON.stringify({
    state: { itemsByCampaign: { AAA111: items } },
    version: 1,
  });
}

const baseOptions = {
  factory: indexedDB,
  storage: localStorage,
  namespace: 'user:account-a' as const,
  campaignId: 'campaign-a',
  campaignCode: 'AAA111',
  ownerId: 'tab-a',
  now: () => 'now',
  nowMs: () => 1,
};

describe('magic item library Slice 11C preparation', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('captures the complete DM library envelope and no unrelated key', async () => {
    localStorage.setItem(
      'rollkeeper-dm-magic-item-library',
      validEnvelope([item('item-a'), item('item-b')])
    );
    localStorage.setItem(
      'rollkeeper-npc-data',
      '{"state":{"npcs":["untouched"]},"version":4}'
    );
    const receipt = vi.fn().mockResolvedValue(true);
    const result = await runMagicItemIndexedDbMigration({
      ...baseOptions,
      runId: 'magic-item-run',
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: receipt },
    });

    expect(result).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'magic-item-run',
    });
    expect(result.manifest.recordCount).toBe(2);
    expect(result.manifest.blockers).toEqual([]);
    expect(receipt).toHaveBeenCalledWith('f'.repeat(64));

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['legacySnapshots', 'kvGenerations', 'meta', 'conflicts'],
      'readonly'
    );
    expect(
      (
        await requestResult(transaction.objectStore('legacySnapshots').getAll())
      ).map(row => row.key)
    ).toEqual(['rollkeeper-dm-magic-item-library']);
    expect(
      await requestResult(transaction.objectStore('kvGenerations').getAll())
    ).toEqual([
      expect.objectContaining({
        namespace: 'user:account-a',
        generation: 'magic-item-run',
        key: 'rollkeeper-dm-magic-item-library',
      }),
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:magic_item:campaign-a')
      )
    ).toMatchObject({
      value: expect.objectContaining({
        family: 'magic_item',
        recordCount: 2,
        blockers: [],
      }),
    });
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('migration-state:user:account-a:magic_item:campaign-a')
      )
    ).toMatchObject({ state: 'CUTOVER_READY', runId: 'magic-item-run' });
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([]);
    await transactionComplete(transaction);
    database.close();

    expect(localStorage.getItem('rollkeeper-npc-data')).toBe(
      '{"state":{"npcs":["untouched"]},"version":4}'
    );
  });

  it('reports the persisted ready generation when preparation is retried with a new run id', async () => {
    localStorage.setItem(
      'rollkeeper-dm-magic-item-library',
      validEnvelope([item('item-a')])
    );
    const base = {
      ...baseOptions,
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    };

    const first = await runMagicItemIndexedDbMigration({
      ...base,
      runId: 'magic-item-run-original',
    });
    expect(first).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'magic-item-run-original',
    });

    const retry = await runMagicItemIndexedDbMigration({
      ...base,
      runId: 'magic-item-run-retry',
    });
    expect(retry).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'magic-item-run-original',
    });
  });

  it('prepares an empty campaign library without blocking', async () => {
    localStorage.setItem(
      'rollkeeper-dm-magic-item-library',
      JSON.stringify({ state: { itemsByCampaign: {} }, version: 1 })
    );
    const result = await runMagicItemIndexedDbMigration({
      ...baseOptions,
      runId: 'empty-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({ state: 'CUTOVER_READY' });
    expect(result.manifest.recordCount).toBe(0);
    expect(result.manifest.blockers).toEqual([]);
  });

  it('preserves a malformed envelope and blocks before authority change', async () => {
    const raw = '{"state":{"itemsByCampaign":';
    localStorage.setItem('rollkeeper-dm-magic-item-library', raw);
    const result = await runMagicItemIndexedDbMigration({
      ...baseOptions,
      runId: 'blocked-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      quarantineCount: 1,
      requestedBytes: 0,
      error: 'Magic item candidates require explicit reconciliation',
    });
    expect(localStorage.getItem('rollkeeper-dm-magic-item-library')).toBe(raw);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['conflicts', 'meta', 'kvGenerations', 'legacySnapshots'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        conflictId: `magic_item:user:account-a:campaign-a:${result.manifest.fingerprint}`,
        namespace: 'user:account-a',
        campaignId: 'campaign-a',
        family: 'magic_item',
        legacyId: 'AAA111',
        kind: 'candidate-blocker',
        rawValue: raw,
        rawFingerprint: result.manifest.rawCandidates[0].fingerprint,
        resolutionState: 'unresolved',
        detectedAt: 'now',
        blockers: [
          expect.objectContaining({ kind: 'malformed-json', legacyId: null }),
        ],
      }),
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('migration-state:user:account-a:magic_item:campaign-a')
      )
    ).toMatchObject({ state: 'BLOCKED', runId: 'blocked-run' });
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:magic_item:campaign-a')
      )
    ).toMatchObject({ value: expect.objectContaining({ recordCount: 0 }) });
    expect(
      await requestResult(transaction.objectStore('kvGenerations').getAll())
    ).toEqual([]);
    expect(
      await requestResult(transaction.objectStore('legacySnapshots').getAll())
    ).toEqual([]);
    await transactionComplete(transaction);
    database.close();
  });

  it('blocks a missing legacy envelope without manufacturing defaults', async () => {
    const result = await runMagicItemIndexedDbMigration({
      ...baseOptions,
      runId: 'missing-envelope',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      error: 'Magic item candidates require explicit reconciliation',
    });
    expect(localStorage.getItem('rollkeeper-dm-magic-item-library')).toBeNull();
    expect(result.manifest.blockers.map(blocker => blocker.kind)).toContain(
      'incomplete-envelope'
    );
  });
});
