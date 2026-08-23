import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CampaignNPC } from '@/types/encounter';

import { runNpcIndexedDbMigration } from '../npcMigration';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

function npc(
  id: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    campaignCode: 'AAA111',
    name: `NPC ${id}`,
    armorClass: '15 (natural armor)',
    maxHp: 32,
    speed: '30 ft.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...extra,
  } satisfies Partial<CampaignNPC> & Record<string, unknown>;
}

function validEnvelope(
  npcs: Array<Record<string, unknown>>,
  version = 4
): string {
  return JSON.stringify({
    state: { npcsByCampaign: { AAA111: npcs } },
    version,
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

describe('NPC family Slice 11D preparation', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('captures the complete NPC envelope and no unrelated key', async () => {
    localStorage.setItem(
      'rollkeeper-npc-data',
      validEnvelope([npc('npc-a'), npc('npc-b')])
    );
    localStorage.setItem(
      'rollkeeper-dm-magic-item-library',
      '{"state":{"itemsByCampaign":{}},"version":1}'
    );
    const receipt = vi.fn().mockResolvedValue(true);
    const result = await runNpcIndexedDbMigration({
      ...baseOptions,
      runId: 'npc-run',
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: receipt },
    });

    expect(result).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'npc-run',
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
    ).toEqual(['rollkeeper-npc-data']);
    expect(
      await requestResult(transaction.objectStore('kvGenerations').getAll())
    ).toEqual([
      expect.objectContaining({
        namespace: 'user:account-a',
        generation: 'npc-run',
        key: 'rollkeeper-npc-data',
      }),
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:npc:campaign-a')
      )
    ).toMatchObject({
      value: expect.objectContaining({
        family: 'npc',
        recordCount: 2,
        blockers: [],
      }),
    });
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('migration-state:user:account-a:npc:campaign-a')
      )
    ).toMatchObject({ state: 'CUTOVER_READY', runId: 'npc-run' });
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([]);
    await transactionComplete(transaction);
    database.close();

    expect(localStorage.getItem('rollkeeper-dm-magic-item-library')).toBe(
      '{"state":{"itemsByCampaign":{}},"version":1}'
    );
  });

  it('reports the persisted ready generation when preparation is retried with a new run id', async () => {
    localStorage.setItem('rollkeeper-npc-data', validEnvelope([npc('npc-a')]));
    const base = {
      ...baseOptions,
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    };

    const first = await runNpcIndexedDbMigration({
      ...base,
      runId: 'npc-run-original',
    });
    expect(first).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'npc-run-original',
    });

    const retry = await runNpcIndexedDbMigration({
      ...base,
      runId: 'npc-run-retry',
    });
    expect(retry).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'npc-run-original',
    });
  });

  it('prepares a campaign with no NPC roster key without blocking', async () => {
    localStorage.setItem(
      'rollkeeper-npc-data',
      JSON.stringify({ state: { npcsByCampaign: {} }, version: 4 })
    );
    const result = await runNpcIndexedDbMigration({
      ...baseOptions,
      runId: 'empty-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({ state: 'CUTOVER_READY' });
    expect(result.manifest.recordCount).toBe(0);
    expect(result.manifest.blockers).toEqual([]);
  });

  it('preserves a malformed envelope and blocks before authority change', async () => {
    const raw = '{"state":{"npcsByCampaign":';
    localStorage.setItem('rollkeeper-npc-data', raw);
    const result = await runNpcIndexedDbMigration({
      ...baseOptions,
      runId: 'blocked-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      quarantineCount: 1,
      requestedBytes: 0,
      error: 'NPC candidates require explicit reconciliation',
    });
    expect(localStorage.getItem('rollkeeper-npc-data')).toBe(raw);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['conflicts', 'meta', 'kvGenerations', 'legacySnapshots'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        conflictId: `npc:user:account-a:campaign-a:${result.manifest.fingerprint}`,
        namespace: 'user:account-a',
        campaignId: 'campaign-a',
        family: 'npc',
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
          .get('migration-state:user:account-a:npc:campaign-a')
      )
    ).toMatchObject({ state: 'BLOCKED', runId: 'blocked-run' });
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:npc:campaign-a')
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

  it('blocks a pre-version-4 envelope on the store migration instead of rewriting it', async () => {
    const raw = validEnvelope([npc('npc-a')], 3);
    localStorage.setItem('rollkeeper-npc-data', raw);
    const result = await runNpcIndexedDbMigration({
      ...baseOptions,
      runId: 'legacy-schema-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      quarantineCount: 1,
      requestedBytes: 0,
      error: 'NPC candidates require explicit reconciliation',
    });
    expect(result.manifest.blockers.map(blocker => blocker.kind)).toEqual([
      'legacy-schema',
    ]);
    expect(localStorage.getItem('rollkeeper-npc-data')).toBe(raw);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['conflicts', 'kvGenerations'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        family: 'npc',
        legacyId: 'AAA111',
        kind: 'candidate-blocker',
        blockers: [
          expect.objectContaining({ kind: 'legacy-schema', legacyId: null }),
        ],
      }),
    ]);
    expect(
      await requestResult(transaction.objectStore('kvGenerations').getAll())
    ).toEqual([]);
    await transactionComplete(transaction);
    database.close();
  });

  it('blocks a missing legacy envelope without manufacturing defaults', async () => {
    const result = await runNpcIndexedDbMigration({
      ...baseOptions,
      runId: 'missing-envelope',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      error: 'NPC candidates require explicit reconciliation',
    });
    expect(localStorage.getItem('rollkeeper-npc-data')).toBeNull();
    expect(result.manifest.blockers.map(blocker => blocker.kind)).toContain(
      'incomplete-envelope'
    );
  });
});
