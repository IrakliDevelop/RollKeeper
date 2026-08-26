import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCombatLogArchiveIndexedDbMigration } from '../combatLogArchiveMigration';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

/** The legacy key the family reads; pinned verbatim, not derived. */
const LEGACY_KEY = 'rollkeeper-combat-log';
const CAMPAIGN_CODE = 'AAA111';

/** A closed archive: `endedAt` present, so it does not block cutover. */
function archive(
  encounterId: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    encounterId,
    campaignCode: CAMPAIGN_CODE,
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T01:00:00.000Z',
    ...extra,
  };
}

/** Ruling 3: an archive that is still open — a valid document, but blocking. */
function activeArchive(encounterId: string): Record<string, unknown> {
  const open = archive(encounterId);
  delete open.endedAt;
  return open;
}

/**
 * Ruling 6: the archive envelope is a record keyed by archive id, not an
 * array — `state.encounters` maps `archiveId -> archive`.
 */
function validEnvelope(
  archives: Record<string, Record<string, unknown>>,
  version = 2,
  tombstones: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    state: {
      encounters: archives,
      combatLogTombstones: tombstones,
      activeArchiveId: null,
    },
    version,
  });
}

const baseOptions = {
  factory: indexedDB,
  storage: localStorage,
  namespace: 'user:account-a' as const,
  campaignId: 'campaign-a',
  campaignCode: CAMPAIGN_CODE,
  ownerId: 'tab-a',
  now: () => 'now',
  nowMs: () => 1,
};

describe('Combat log archive family Slice 11F preparation', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('captures the complete combat log archive envelope and no unrelated key', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      validEnvelope({
        'arc-a': archive('enc-a'),
        'arc-b': archive('enc-b'),
      })
    );
    localStorage.setItem(
      'rollkeeper-npc-data',
      '{"state":{"npcsByCampaign":{}},"version":4}'
    );
    const receipt = vi.fn().mockResolvedValue(true);
    const result = await runCombatLogArchiveIndexedDbMigration({
      ...baseOptions,
      runId: 'combat-log-archive-run',
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: receipt },
    });

    expect(result).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'combat-log-archive-run',
    });
    expect(result.manifest.recordCount).toBe(2);
    // Boundary: zero blockers is the clean side of the BLOCKED branch.
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
    ).toEqual([LEGACY_KEY]);
    expect(
      await requestResult(transaction.objectStore('kvGenerations').getAll())
    ).toEqual([
      expect.objectContaining({
        namespace: 'user:account-a',
        generation: 'combat-log-archive-run',
        key: LEGACY_KEY,
      }),
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:combat_log_archive:campaign-a')
      )
    ).toMatchObject({
      value: expect.objectContaining({
        family: 'combat_log_archive',
        campaignCode: CAMPAIGN_CODE,
        recordCount: 2,
        blockers: [],
      }),
    });
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('migration-state:user:account-a:combat_log_archive:campaign-a')
      )
    ).toMatchObject({
      state: 'CUTOVER_READY',
      runId: 'combat-log-archive-run',
    });
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
      LEGACY_KEY,
      validEnvelope({ 'arc-a': archive('enc-a') })
    );
    const base = {
      ...baseOptions,
      requiredRecoveryManifestHash: 'f'.repeat(64),
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    };

    const first = await runCombatLogArchiveIndexedDbMigration({
      ...base,
      runId: 'combat-log-archive-original',
    });
    expect(first).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'combat-log-archive-original',
    });

    const retry = await runCombatLogArchiveIndexedDbMigration({
      ...base,
      runId: 'combat-log-archive-retry',
    });
    expect(retry).toMatchObject({
      state: 'CUTOVER_READY',
      generation: 'combat-log-archive-original',
    });
  });

  it('prepares a campaign with no archives without blocking', async () => {
    localStorage.setItem(LEGACY_KEY, validEnvelope({}));
    const result = await runCombatLogArchiveIndexedDbMigration({
      ...baseOptions,
      runId: 'empty-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({ state: 'CUTOVER_READY' });
    expect(result.manifest.recordCount).toBe(0);
    expect(result.manifest.blockers).toEqual([]);
  });

  // Ruling 1: an archive with no `campaignCode` falls outside the campaign
  // filter entirely — it is neither migrated nor blocking.
  it('neither migrates nor blocks an archive with no campaignCode', async () => {
    const unscoped = archive('enc-unscoped');
    delete unscoped.campaignCode;
    const raw = validEnvelope({
      'arc-a': archive('enc-a'),
      'arc-other': archive('enc-other', { campaignCode: 'ZZZ999' }),
      'arc-unscoped': unscoped,
    });
    localStorage.setItem(LEGACY_KEY, raw);
    const result = await runCombatLogArchiveIndexedDbMigration({
      ...baseOptions,
      runId: 'scoped-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({ state: 'CUTOVER_READY' });
    expect(result.manifest.recordCount).toBe(1);
    expect(result.manifest.records.map(record => record.legacyId)).toEqual([
      'arc-a',
    ]);
    expect(result.manifest.blockers).toEqual([]);
    expect(localStorage.getItem(LEGACY_KEY)).toBe(raw);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction('conflicts', 'readonly');
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([]);
    await transactionComplete(transaction);
    database.close();
  });

  // Ruling 3 / boundary: exactly one blocker is one past the clean side.
  it('blocks cutover on an archive that is still open and writes no documents', async () => {
    const raw = validEnvelope({
      'arc-open': activeArchive('enc-open'),
      'arc-b': archive('enc-b'),
    });
    localStorage.setItem(LEGACY_KEY, raw);
    const result = await runCombatLogArchiveIndexedDbMigration({
      ...baseOptions,
      runId: 'active-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      quarantineCount: 1,
      requestedBytes: 0,
      error: 'Combat log archives require explicit reconciliation',
    });
    expect(result.manifest.blockers).toEqual([
      expect.objectContaining({
        kind: 'active-combat-log',
        legacyId: 'arc-open',
      }),
    ]);
    expect(localStorage.getItem(LEGACY_KEY)).toBe(raw);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['conflicts', 'meta', 'kvGenerations', 'legacySnapshots'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        conflictId: `combat_log_archive:user:account-a:campaign-a:${result.manifest.fingerprint}`,
        namespace: 'user:account-a',
        campaignId: 'campaign-a',
        family: 'combat_log_archive',
        legacyId: CAMPAIGN_CODE,
        kind: 'candidate-blocker',
        rawValue: raw,
        rawFingerprint: result.manifest.rawCandidates[0].fingerprint,
        resolutionState: 'unresolved',
        detectedAt: 'now',
        blockers: [
          expect.objectContaining({
            kind: 'active-combat-log',
            legacyId: 'arc-open',
          }),
        ],
      }),
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('migration-state:user:account-a:combat_log_archive:campaign-a')
      )
    ).toMatchObject({ state: 'BLOCKED', runId: 'active-run' });
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:combat_log_archive:campaign-a')
      )
    ).toMatchObject({
      value: expect.objectContaining({ family: 'combat_log_archive' }),
    });
    expect(
      await requestResult(transaction.objectStore('kvGenerations').getAll())
    ).toEqual([]);
    expect(
      await requestResult(transaction.objectStore('legacySnapshots').getAll())
    ).toEqual([]);
    await transactionComplete(transaction);
    database.close();
  });

  it('preserves a malformed envelope and blocks before authority change', async () => {
    const raw = '{"state":{"encounters":';
    localStorage.setItem(LEGACY_KEY, raw);
    const result = await runCombatLogArchiveIndexedDbMigration({
      ...baseOptions,
      runId: 'blocked-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      quarantineCount: 1,
      requestedBytes: 0,
      error: 'Combat log archives require explicit reconciliation',
    });
    expect(result.manifest.blockers.map(blocker => blocker.kind)).toEqual([
      'malformed-json',
    ]);
    expect(localStorage.getItem(LEGACY_KEY)).toBe(raw);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['conflicts', 'meta', 'kvGenerations', 'legacySnapshots'],
      'readonly'
    );
    expect(
      await requestResult(transaction.objectStore('conflicts').getAll())
    ).toEqual([
      expect.objectContaining({
        family: 'combat_log_archive',
        legacyId: CAMPAIGN_CODE,
        kind: 'candidate-blocker',
        rawValue: raw,
        resolutionState: 'unresolved',
      }),
    ]);
    expect(
      await requestResult(
        transaction
          .objectStore('meta')
          .get('family-manifest:user:account-a:combat_log_archive:campaign-a')
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
    const result = await runCombatLogArchiveIndexedDbMigration({
      ...baseOptions,
      runId: 'missing-envelope',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      authority: 'localStorage',
      error: 'Combat log archives require explicit reconciliation',
    });
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(result.manifest.blockers.map(blocker => blocker.kind)).toEqual([
      'incomplete-envelope',
    ]);
  });

  it('touches no localStorage key other than rollkeeper-combat-log', async () => {
    const unrelated: Record<string, string> = {
      'rollkeeper-encounter-data': '{"state":{"encounters":[]},"version":2}',
      'rollkeeper-npc-data': '{"state":{"npcsByCampaign":{}},"version":4}',
      'rollkeeper-theme': 'dark',
      'battlemap-canvas-aaa111': '{"nodes":[]}',
      'tabbed-layout-active-tab': 'combat',
    };
    for (const [key, value] of Object.entries(unrelated)) {
      localStorage.setItem(key, value);
    }
    localStorage.setItem(
      LEGACY_KEY,
      validEnvelope({ 'arc-a': archive('enc-a') })
    );
    const before = snapshotLocalStorage();

    const reads: string[] = [];
    const writes: string[] = [];
    const recording: Storage = {
      get length() {
        return localStorage.length;
      },
      key: (index: number) => localStorage.key(index),
      getItem: (key: string) => {
        reads.push(key);
        return localStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        writes.push(`set:${key}`);
        localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        writes.push(`remove:${key}`);
        localStorage.removeItem(key);
      },
      clear: () => {
        writes.push('clear');
        localStorage.clear();
      },
    } as Storage;

    const result = await runCombatLogArchiveIndexedDbMigration({
      ...baseOptions,
      storage: recording,
      runId: 'isolation-run',
      recoveryGate: { hasDownloadReceipt: vi.fn().mockResolvedValue(true) },
    });

    expect(result).toMatchObject({ state: 'CUTOVER_READY' });
    expect([...new Set(reads)]).toEqual([LEGACY_KEY]);
    expect(writes).toEqual([]);
    expect(snapshotLocalStorage()).toEqual(before);

    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['legacySnapshots', 'kvGenerations'],
      'readonly'
    );
    expect(
      (
        await requestResult(transaction.objectStore('legacySnapshots').getAll())
      ).map(row => row.key)
    ).toEqual([LEGACY_KEY]);
    expect(
      (
        await requestResult(transaction.objectStore('kvGenerations').getAll())
      ).map(row => row.key)
    ).toEqual([LEGACY_KEY]);
    await transactionComplete(transaction);
    database.close();
  });
});

function snapshotLocalStorage(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key !== null) snapshot[key] = localStorage.getItem(key) ?? '';
  }
  return snapshot;
}
