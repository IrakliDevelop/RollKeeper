import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCampaignSettingsIndexedDbMigration } from '../campaignSettingsMigration';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

function validEnvelope(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    state: {
      dmId: 'dm-local',
      campaigns: [
        {
          code: 'AAA111',
          name: 'Canary',
          createdAt: 'now',
          stackableInspiration: true,
          ...extra,
        },
      ],
    },
    version: 1,
  });
}

describe('campaign_settings Slice 7 preparation', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('captures the complete DM envelope and no unrelated key', async () => {
    localStorage.setItem('rollkeeper-dm-data', validEnvelope());
    localStorage.setItem(
      'rollkeeper-npc-data',
      '{"state":{"npcs":["untouched"]},"version":4}'
    );
    const receipt = vi.fn().mockResolvedValue(true);
    const result = await runCampaignSettingsIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'user:account-a',
      campaignId: 'campaign-a',
      campaignCode: 'AAA111',
      runId: 'settings-run',
      ownerId: 'tab-a',
      now: () => 'now',
      nowMs: () => 1,
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: receipt },
    });
    expect(result.state).toBe('CUTOVER_READY');
    expect(receipt).toHaveBeenCalledWith('f'.repeat(64));
    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['legacySnapshots', 'kvGenerations', 'meta'],
      'readonly'
    );
    expect(
      (
        await requestResult(transaction.objectStore('legacySnapshots').getAll())
      ).map(row => row.key)
    ).toEqual(['rollkeeper-dm-data']);
    expect(
      (
        await requestResult(transaction.objectStore('kvGenerations').getAll())
      ).map(row => row.key)
    ).toEqual(['rollkeeper-dm-data']);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:campaign_settings:campaign-a')
      )
    ).toMatchObject({
      value: expect.objectContaining({ recordCount: 1, blockers: [] }),
    });
    await transactionComplete(transaction);
    database.close();
    expect(localStorage.getItem('rollkeeper-npc-data')).toBe(
      '{"state":{"npcs":["untouched"]},"version":4}'
    );
  });

  it('reports the persisted ready generation when preparation is retried with a new run id', async () => {
    localStorage.setItem('rollkeeper-dm-data', validEnvelope());
    const base = {
      factory: indexedDB,
      storage: localStorage,
      namespace: 'user:account-a' as const,
      campaignId: 'campaign-a',
      campaignCode: 'AAA111',
      ownerId: 'tab-a',
      now: () => 'now',
      nowMs: () => 1,
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    };

    const first = await runCampaignSettingsIndexedDbMigration({
      ...base,
      runId: 'settings-run-original',
    });
    expect(first).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'settings-run-original',
    });

    const retry = await runCampaignSettingsIndexedDbMigration({
      ...base,
      runId: 'settings-run-retry',
    });
    expect(retry).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'settings-run-original',
    });
  });

  it('preserves an unclassified partial-family candidate and blocks before authority change', async () => {
    const raw = validEnvelope({ calendar: { day: 1 } });
    localStorage.setItem('rollkeeper-dm-data', raw);
    const result = await runCampaignSettingsIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'user:account-a',
      campaignId: 'campaign-a',
      campaignCode: 'AAA111',
      runId: 'blocked-run',
      ownerId: 'tab-a',
      now: () => 'now',
      nowMs: () => 1,
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });
    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
    });
    expect(localStorage.getItem('rollkeeper-dm-data')).toBe(raw);
    const database = await openRollkeeperDatabase();
    const transaction = database.transaction('conflicts', 'readonly');
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        family: 'campaign_settings',
        rawValue: raw,
        resolutionState: 'unresolved',
      }),
    ]);
    await transactionComplete(transaction);
    database.close();
  });

  it('blocks a missing legacy envelope without manufacturing defaults', async () => {
    const result = await runCampaignSettingsIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: 'user:account-a',
      campaignId: 'campaign-a',
      campaignCode: 'AAA111',
      runId: 'missing-envelope',
      ownerId: 'tab-a',
      now: () => 'now',
      nowMs: () => 1,
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
    });
    expect(localStorage.getItem('rollkeeper-dm-data')).toBeNull();
  });
});
