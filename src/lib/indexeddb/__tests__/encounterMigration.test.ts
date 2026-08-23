import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Encounter } from '@/types/encounter';

import { runEncounterIndexedDbMigration } from '../encounterMigration';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

function encounter(
  id: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    campaignCode: 'AAA111',
    name: `Encounter ${id}`,
    entities: [],
    currentTurn: 0,
    round: 1,
    isActive: false,
    sortOrder: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...extra,
  } satisfies Partial<Encounter> & Record<string, unknown>;
}

function validEnvelope(
  encounters: Array<Record<string, unknown>>,
  version = 2,
  tombstones: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    state: {
      encounters,
      encounterTombstones: tombstones,
      combatConfig: {
        enemyHpDisplay: 'bar',
        hpStateBands: [],
        enemyConditionsDisplay: 'on',
      },
      activeEncounterId: null,
    },
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

describe('Encounter family Slice 11E preparation', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('captures the complete encounter envelope and no unrelated key', async () => {
    localStorage.setItem(
      'rollkeeper-encounter-data',
      validEnvelope([encounter('enc-a'), encounter('enc-b')])
    );
    localStorage.setItem(
      'rollkeeper-npc-data',
      '{"state":{"npcsByCampaign":{}},"version":4}'
    );
    const receipt = vi.fn().mockResolvedValue(true);
    const result = await runEncounterIndexedDbMigration({
      ...baseOptions,
      runId: 'encounter-run',
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: receipt },
    });

    expect(result).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'encounter-run',
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
    ).toEqual(['rollkeeper-encounter-data']);
    expect(
      await requestResult(transaction.objectStore('kvGenerations').getAll())
    ).toEqual([
      expect.objectContaining({
        namespace: 'user:account-a',
        generation: 'encounter-run',
        key: 'rollkeeper-encounter-data',
      }),
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:encounter_definition:campaign-a')
      )
    ).toMatchObject({
      value: expect.objectContaining({
        family: 'encounter_definition',
        recordCount: 2,
        blockers: [],
      }),
    });
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('migration-state:user:account-a:encounter_definition:campaign-a')
      )
    ).toMatchObject({ state: 'CUTOVER_READY', runId: 'encounter-run' });
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([]);
    await transactionComplete(transaction);
    database.close();

    expect(localStorage.getItem('rollkeeper-npc-data')).toBe(
      '{"state":{"npcsByCampaign":{}},"version":4}'
    );
  });

  it('reports the persisted ready generation when preparation is retried with a new run id', async () => {
    localStorage.setItem(
      'rollkeeper-encounter-data',
      validEnvelope([encounter('enc-a')])
    );
    const base = {
      ...baseOptions,
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    };

    const first = await runEncounterIndexedDbMigration({
      ...base,
      runId: 'encounter-run-original',
    });
    expect(first).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'encounter-run-original',
    });

    const retry = await runEncounterIndexedDbMigration({
      ...base,
      runId: 'encounter-run-retry',
    });
    expect(retry).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'encounter-run-original',
    });
  });

  it('prepares a campaign with no encounters without blocking', async () => {
    localStorage.setItem('rollkeeper-encounter-data', validEnvelope([]));
    const result = await runEncounterIndexedDbMigration({
      ...baseOptions,
      runId: 'empty-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({ state: 'CUTOVER_READY' });
    expect(result.manifest.recordCount).toBe(0);
    expect(result.manifest.blockers).toEqual([]);
  });

  it('leaves encounters of other campaigns and unscoped encounters untouched', async () => {
    const raw = validEnvelope([
      encounter('enc-a'),
      encounter('enc-other', { campaignCode: 'ZZZ999' }),
      { ...encounter('enc-unscoped'), campaignCode: undefined },
    ]);
    localStorage.setItem('rollkeeper-encounter-data', raw);
    const result = await runEncounterIndexedDbMigration({
      ...baseOptions,
      runId: 'scoped-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({ state: 'CUTOVER_READY' });
    expect(result.manifest.recordCount).toBe(1);
    expect(result.manifest.records.map(record => record.legacyId)).toEqual([
      'enc-a',
    ]);
    expect(result.manifest.blockers).toEqual([]);
    expect(localStorage.getItem('rollkeeper-encounter-data')).toBe(raw);
  });

  it('blocks cutover on an active encounter for the campaign', async () => {
    const raw = validEnvelope([
      encounter('enc-active', { isActive: true }),
      encounter('enc-b'),
    ]);
    localStorage.setItem('rollkeeper-encounter-data', raw);
    const result = await runEncounterIndexedDbMigration({
      ...baseOptions,
      runId: 'active-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      quarantineCount: 1,
      requestedBytes: 0,
      error: 'Encounter candidates require explicit reconciliation',
    });
    expect(result.manifest.blockers).toEqual([
      expect.objectContaining({
        kind: 'active-encounter',
        legacyId: 'enc-active',
      }),
    ]);
    expect(localStorage.getItem('rollkeeper-encounter-data')).toBe(raw);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['conflicts', 'meta', 'kvGenerations'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        conflictId: `encounter_definition:user:account-a:campaign-a:${result.manifest.fingerprint}`,
        family: 'encounter_definition',
        legacyId: 'AAA111',
        kind: 'candidate-blocker',
        resolutionState: 'unresolved',
        detectedAt: 'now',
        blockers: [
          expect.objectContaining({
            kind: 'active-encounter',
            legacyId: 'enc-active',
          }),
        ],
      }),
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('migration-state:user:account-a:encounter_definition:campaign-a')
      )
    ).toMatchObject({ state: 'BLOCKED', runId: 'active-run' });
    expect(
      await requestResult(transaction.objectStore('kvGenerations').getAll())
    ).toEqual([]);
    await transactionComplete(transaction);
    database.close();
  });

  it('preserves a malformed envelope and blocks before authority change', async () => {
    const raw = '{"state":{"encounters":';
    localStorage.setItem('rollkeeper-encounter-data', raw);
    const result = await runEncounterIndexedDbMigration({
      ...baseOptions,
      runId: 'blocked-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      quarantineCount: 1,
      requestedBytes: 0,
      error: 'Encounter candidates require explicit reconciliation',
    });
    expect(localStorage.getItem('rollkeeper-encounter-data')).toBe(raw);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['conflicts', 'meta', 'kvGenerations', 'legacySnapshots'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        conflictId: `encounter_definition:user:account-a:campaign-a:${result.manifest.fingerprint}`,
        namespace: 'user:account-a',
        campaignId: 'campaign-a',
        family: 'encounter_definition',
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
          .get('migration-state:user:account-a:encounter_definition:campaign-a')
      )
    ).toMatchObject({ state: 'BLOCKED', runId: 'blocked-run' });
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:encounter_definition:campaign-a')
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

  it('blocks a pre-version-2 envelope on the store migration instead of rewriting it', async () => {
    const raw = validEnvelope([encounter('enc-a')], 1);
    localStorage.setItem('rollkeeper-encounter-data', raw);
    const result = await runEncounterIndexedDbMigration({
      ...baseOptions,
      runId: 'legacy-schema-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      quarantineCount: 1,
      requestedBytes: 0,
      error: 'Encounter candidates require explicit reconciliation',
    });
    expect(result.manifest.blockers.map(blocker => blocker.kind)).toEqual([
      'legacy-schema',
    ]);
    expect(localStorage.getItem('rollkeeper-encounter-data')).toBe(raw);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['conflicts', 'kvGenerations'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        family: 'encounter_definition',
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
    const result = await runEncounterIndexedDbMigration({
      ...baseOptions,
      runId: 'missing-envelope',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      error: 'Encounter candidates require explicit reconciliation',
    });
    expect(localStorage.getItem('rollkeeper-encounter-data')).toBeNull();
    expect(result.manifest.blockers.map(blocker => blocker.kind)).toContain(
      'incomplete-envelope'
    );
  });
});
