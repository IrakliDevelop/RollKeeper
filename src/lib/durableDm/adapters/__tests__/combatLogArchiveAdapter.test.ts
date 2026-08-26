import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { combatLogArchiveAdapter } from '../combatLogArchiveAdapter';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import { useCombatLogStore } from '@/store/combatLogStore';
import { COMBAT_LOG_STORAGE_KEY } from '@/utils/constants';
import {
  describeAdapterConformance,
  describeCardParity,
  seedFamilySelectionForRun,
} from './adapterConformance';
import { createCombatLogArchiveHarness } from './harnesses/combatLogArchive';

describe('combatLogArchiveAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describeAdapterConformance(
    'combat_log_archive',
    createCombatLogArchiveHarness
  );

  describeCardParity('combat_log_archive', createCombatLogArchiveHarness, {
    runIndexedDbMigration: 'runCombatLogArchiveIndexedDbMigration',
    commitLocalCutover: 'commitCombatLogArchiveLocalCutover',
    markCloudAuthority: 'markCombatLogArchiveCloudAuthority',
    rollbackLocalAuthority: 'rollbackCombatLogArchiveLocalAuthority',
  });

  it('is invisible when its own client flag is off', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'false');
    expect(combatLogArchiveAdapter.isVisible()).toBe(false);
  });

  // Brief's mandated extra test, quoted verbatim in the task brief. Ruling
  // R6.9 / brief item deletes the plan's original duplicate
  // ("normalizes the combat log dialect, including localStorage at epoch
  // zero") because it is verbatim identical to the shared conformance
  // suite's "readAuthority reports legacy before any migration" test.
  it('blocks the family when the marker names a different account', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seedWithMarkerForAnotherAccount();
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'inconsistent',
      reason: 'account-mismatch',
    });
  });

  it('leaves an unscoped archive in localStorage and out of the manifest', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seedWithUnscopedArchive();
    const manifest = await harness.adapter.previewManifest(context);
    expect(manifest.records.map(record => record.legacyId)).not.toContain(
      'unscoped-archive'
    );
    expect(harness.legacyArchiveIds()).toContain('unscoped-archive');
  });

  // Brief's mandated divergence test (replacing the deleted duplicate, per
  // ruling R6.9): the legacy id is the `archiveId` (the record key), never
  // the `encounterId` — proven with two archives sharing one `encounterId`.
  it('uses the archiveId as the legacy id, never the encounterId, including when two archives share an encounterId', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    const raw = localStorage.getItem(COMBAT_LOG_STORAGE_KEY);
    if (!raw) throw new Error('Seed did not persist an envelope');
    const parsed = JSON.parse(raw) as {
      state: { encounters: Record<string, Record<string, unknown>> };
    };
    // Two DIFFERENT archiveId keys, same encounterId.
    parsed.state.encounters['archive-shared-a'] = {
      encounterId: 'enc-shared',
      campaignCode: context.campaignCode,
      events: [],
      startedAt: '2026-08-25T00:00:00.000Z',
      endedAt: '2026-08-25T01:00:00.000Z',
    };
    parsed.state.encounters['archive-shared-b'] = {
      encounterId: 'enc-shared',
      campaignCode: context.campaignCode,
      events: [],
      startedAt: '2026-08-25T02:00:00.000Z',
      endedAt: '2026-08-25T03:00:00.000Z',
    };
    localStorage.setItem(COMBAT_LOG_STORAGE_KEY, JSON.stringify(parsed));
    const manifest = await harness.adapter.previewManifest(context);
    // No blocker: sharing an encounterId is not a manifest conflict.
    expect(manifest.blockers).toEqual([]);
    const legacyIds = manifest.records.map(record => record.legacyId);
    expect(legacyIds).toContain('archive-shared-a');
    expect(legacyIds).toContain('archive-shared-b');
    // Both survive as DISTINCT records — never collapsed or deduplicated by
    // their shared encounterId.
    expect(
      manifest.records.filter(record =>
        record.legacyId.startsWith('archive-shared-')
      )
    ).toHaveLength(2);
  });

  it('reports the active-combat-log blocker with the exact legacyId and detail, not merely its kind', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seedWithActiveCombatLog();
    const manifest = await harness.adapter.previewManifest(context);
    expect(manifest.blockers).toEqual([
      {
        kind: 'active-combat-log',
        legacyId: 'archive-1',
        detail:
          'Combat log archive archive-1 is still open; end the combat log before turning on backup',
      },
    ]);
    await harness.adapter.selectFamily(context);
    await expect(harness.adapter.prepareIndexedDb(context)).rejects.toThrow();
  });

  // Ruling 1: an archive (or tombstone) with no `campaignCode` is silently
  // ignored — never a blocker and never staged. `buildCombatLogArchiveManifest`
  // filters by `entry.campaignCode !== input.campaignCode` before any
  // classification runs.
  it('ignores archives with no campaignCode, without blocking', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seedWithUnscopedArchive();
    const manifest = await harness.adapter.previewManifest(context);
    expect(manifest.blockers).toEqual([]);
    expect(
      manifest.records.some(record => record.legacyId === 'unscoped-archive')
    ).toBe(false);
  });

  it('makes no projection call during the whole migration chain', async () => {
    // `combat_log_archive` has no player projection at all
    // (`COMBAT_LOG_ARCHIVE_FAMILY_INVENTORY.projection: 'not-applicable'`),
    // unlike `campaign_settings`/`calendar`.
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    const calls = harness.recordedApiActions();
    await harness.adapter.previewManifest(context);
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.adapter.activateCloud(context, manifest);
    await harness.adapter.rollback(context);
    expect(calls()).toEqual(
      expect.arrayContaining([
        'preview-enrollment',
        'begin-staging',
        'stage-items',
        'confirm-cutover',
        'rollback',
      ])
    );
    expect(calls()).not.toContain('projection-status');
    expect(calls()).not.toContain('replay-projection');
    expect(calls()).not.toContain('projection-incidents');
  });

  it('reports the manifest blockers verbatim, without deciding what to do about them', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seedWithBlocker();
    const manifest = await harness.adapter.previewManifest(context);
    expect(manifest.blockers).toEqual([
      {
        kind: 'unclassified-field',
        legacyId: 'archive-1',
        detail:
          'Combat log archive field extraField is not classified in Slice 11F',
      },
    ]);
  });

  // Isolates `previewManifest`'s SECOND `if` clause
  // (`sourceManifest.blockers.length === 0`) from its `authority.state !==
  // 'legacy'` neighbor: after a local cutover (`authority.state ===
  // 'indexedDB'`), a raw-envelope edit that introduces a NEW blocker must
  // still short-circuit before the IndexedDB working-copy rebuild, or
  // `buildCombatLogArchiveWorkingCopyManifest` throws (it refuses a source
  // manifest carrying a blocker) instead of previewManifest returning that
  // blocker gracefully.
  it('previewManifest reports a post-cutover blocker without attempting the IndexedDB working-copy rebuild', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const raw = localStorage.getItem(COMBAT_LOG_STORAGE_KEY);
    if (!raw) throw new Error('Seed did not persist an envelope');
    const parsed = JSON.parse(raw) as {
      state: { encounters: Record<string, Record<string, unknown>> };
    };
    parsed.state.encounters['archive-1'] = {
      ...parsed.state.encounters['archive-1'],
      extraField: 'unexpected',
    };
    localStorage.setItem(COMBAT_LOG_STORAGE_KEY, JSON.stringify(parsed));
    const manifest = await harness.adapter.previewManifest(context);
    expect(manifest.blockers).toEqual([
      {
        kind: 'unclassified-field',
        legacyId: 'archive-1',
        detail:
          'Combat log archive field extraField is not classified in Slice 11F',
      },
    ]);
  });

  it('activateCloud reconciles to a conflict outcome when the replayed preview no longer matches the manifest', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    harness.loseResponseAfter('confirm-cutover');
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow();
    await harness.divergeCloudGeneration();
    const result = await harness.adapter.activateCloud(context, manifest);
    expect(result.status).toBe('conflict');
  });

  it('prepareIndexedDb reports the blocked-candidates message, not the generic gate message, when blockers exist', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seedWithBlocker();
    await harness.adapter.selectFamily(context);
    await expect(harness.adapter.prepareIndexedDb(context)).rejects.toThrow(
      /unresolved candidates/i
    );
  });

  it('prepareIndexedDb reports the generic gate message when preparation is not ready for a reason other than blockers', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    // Final fix wave, F5: `prepareIndexedDb` now refuses a selection record
    // that is not this run's, and that gate fires BEFORE the receipt gate
    // inside `run*IndexedDbMigration`. The selection is therefore seeded for
    // the SAME recovery this call passes, so the only guard that can refuse
    // here is still the one this test is named for.
    const runContext = {
      ...context,
      recovery: { ...context.recovery, manifestHash: 'e'.repeat(64) },
    };
    await seedFamilySelectionForRun(harness.adapter, runContext);
    await expect(harness.adapter.prepareIndexedDb(runContext)).rejects.toThrow(
      /safety gate/i
    );
  });

  it('prepareIndexedDb refuses an initiated-but-unverified recovery receipt', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    const unverifiedHash = 'f'.repeat(64);
    await harness.recordUnverifiedReceipt(unverifiedHash);
    // Final fix wave, F5: the selection gate refuses a record that is not
    // this run's, before the receipt gate is reached. Seeded for this exact
    // recovery so the receipt gate stays the only guard under test -- the
    // production state this reproduces is "selected while the receipt was
    // verified, and it stopped being verified afterwards".
    const runContext = {
      ...context,
      recovery: { ...context.recovery, manifestHash: unverifiedHash },
    };
    await seedFamilySelectionForRun(harness.adapter, runContext);
    await expect(harness.adapter.prepareIndexedDb(runContext)).rejects.toThrow(
      /safety gate/i
    );
  });

  it('commitLocalCutover refuses when the remembered workspace identity belongs to a different campaign', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    const database = await openRollkeeperDatabase();
    try {
      await new IndexedDbDmWorkspaceRepository(database).rememberDiscovered({
        ...context.workspace,
        cloudId: 'a-different-campaign-id',
      });
    } finally {
      database.close();
    }
    await expect(
      harness.adapter.commitLocalCutover(
        { ...context, ensureWorkspaceRemembered: async () => {} },
        { generation: prepared.generation, manifest: prepared.manifest }
      )
    ).rejects.toThrow(/workspace/i);
  });

  it('refuses to stage a combat log archive set that was deleted since the preview', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.deleteWorkingCopy(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // Requirement 4: EVERY clause of `assertWorkingCopyUnchanged` is isolated
  // by its own test with its own single-line mutation, so each clause
  // reddens a DIFFERENT test. Four tests below: fingerprint, schemaVersion,
  // absence, count.
  it('refuses to stage a working copy whose fingerprint drifted since the preview', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.corruptWorkingCopyFingerprint(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  it('refuses to stage a working copy whose schemaVersion drifted since the preview', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.corruptWorkingCopySchemaVersion(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  it('refuses to stage when a manifest record has no corresponding working copy at all', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.replaceWorkingCopyEntirely(
      manifest.records[0].legacyId,
      'archive-replacement-elsewhere'
    );
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  it('refuses to stage when an extra working copy exists beyond the manifest', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.addExtraWorkingCopy('archive-added-locally');
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // Requirement 3: `recoveryGate` for `selectFamily` mirrors the card's use
  // of the stricter `hasVerifiedDownloadReceipt`, dedicated test (a closure
  // cannot be pinned by parity alone).
  it('selectFamily refuses an initiated-but-unverified recovery receipt, matching prepareIndexedDb', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    const unverifiedHash = 'f'.repeat(64);
    await harness.recordUnverifiedReceipt(unverifiedHash);
    await expect(
      harness.adapter.selectFamily({
        ...context,
        recovery: { ...context.recovery, manifestHash: unverifiedHash },
      })
    ).rejects.toThrow();
  });

  // Requirement 12/13: pins all three sub-fields the tombstone fixture
  // carries — `operation: 'delete'`, `deletedAt` non-null, and the staged
  // `tombstoned: true` flag.
  it('mirrors a tombstoned manifest record through commitLocalCutover and activateCloud staging', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    const legacyId = prepared.manifest.records[0].legacyId;
    const tombstonedManifest = harness.withTombstonedRecord(
      prepared.manifest,
      legacyId
    );
    await harness.adapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: tombstonedManifest,
    });
    const stored = await harness.rawDocument(legacyId);
    expect(stored?.operation).toBe('delete');
    expect(stored?.deletedAt).not.toBeNull();

    await harness.adapter.activateCloud(context, tombstonedManifest);
    const staged = harness.requestBodies().stageItems[0].items as {
      legacyId: string;
      tombstoned?: boolean;
    }[];
    expect(staged.find(item => item.legacyId === legacyId)?.tombstoned).toBe(
      true
    );
  });

  // Rollback's current-generation precondition: two independently isolated
  // clauses. `combat_log_archive` has no projection-journal clause (unlike
  // `campaign_settings`/`calendar`) because it has no player projection at
  // all, so there are two of these, not three.
  it('rollback refuses when the account is no longer cloud-authoritative', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forcePreviewAuthorityMismatch();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current postgres generation/i
    );
  });

  it('rollback refuses when the cloud preview response is missing the current generation fingerprints', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forceIncompleteCloudPreview();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current postgres generation/i
    );
  });

  // Requirement 8/9: the discriminating case for combat_log_archive's
  // unconditional rollback restore (`?? []`, never gated behind an
  // `if (documents.length > 0)` check).
  it('rollback clears the legacy store to no archives when the cloud generation is empty', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    expect(await harness.readLegacyStorePayload()).not.toEqual({
      encounters: {},
      combatLogTombstones: {},
    });
    harness.emptyCloudGeneration();
    await harness.adapter.rollback(context);
    expect(await harness.readLegacyStorePayload()).toEqual({
      encounters: {},
      combatLogTombstones: {},
    });
  });

  // Requirement 6: proves `readLegacyStorePayload` reads the PERSISTED
  // envelope, not the in-memory store, and that the marker write precedes
  // the store restore.
  it('rollback restores the legacy store only after the marker write, observed through the PERSISTED envelope', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    await harness.divergeCloudGeneration();
    const expectedPayload = harness.expectedLegacyStoreAfterRollback();
    await harness.adapter.rollback(context);
    // The marker must already report the rolled-back state...
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'legacy',
      rolledBack: true,
    });
    // ...and the PERSISTED envelope (not the in-memory store) must already
    // carry the server's current generation, proving the store write did
    // not silently no-op or write somewhere the marker check cannot see.
    expect(await harness.readLegacyStorePayload()).toEqual(expectedPayload);
  });

  // `encounters` is a RECORD keyed by `archiveId` (unlike
  // `encounter_definition`'s flat, cross-campaign ARRAY), but the isolation
  // principle is identical: `rollback`'s store restore filters by
  // `campaignCode` and must never clobber another campaign's archives held
  // under different keys in the same record.
  it('rollback restores only this campaign, leaving other campaigns untouched in the store', async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    const otherCampaignArchive = {
      encounterId: 'enc-elsewhere',
      campaignCode: 'OTHER-CAMPAIGN',
      events: [],
      startedAt: '2026-08-25T00:00:00.000Z',
      endedAt: '2026-08-25T01:00:00.000Z',
    };
    useCombatLogStore.setState(state => ({
      encounters: {
        ...state.encounters,
        'other-campaign-archive-1': otherCampaignArchive,
      },
    }));
    await harness.runChainThroughCloudActivation(context);
    await harness.adapter.rollback(context);
    expect(
      useCombatLogStore.getState().encounters['other-campaign-archive-1']
    ).toEqual(otherCampaignArchive);
  });

  // Brief item 8, precedent from Task 11's `encounterTombstones` fix: the
  // family's SECOND persisted collection (`combatLogTombstones`) gets its
  // OWN discriminating fixture — never an inherited pass from the
  // `encounters` test above. Seeds TWO tombstones directly into the store
  // (bypassing the harness, which never populates `combatLogTombstones`):
  // one whose `beforeImage.campaignCode` is THIS campaign, one for another.
  // Both assertions below are load-bearing in OPPOSITE directions: mutating
  // the adapter's filter to `.filter(() => false)` (wipe every campaign's
  // tombstones) fails the second assertion (the other campaign's tombstone
  // would also be gone); mutating it to `.filter(() => true)` (a no-op that
  // never removes anything) fails the first (this campaign's stale
  // tombstone would survive).
  it("rollback restores only this campaign's tombstones, leaving other campaigns' tombstones untouched", async () => {
    const harness = createCombatLogArchiveHarness();
    const context = await harness.seed();
    const thisCampaignDeletedArchive = {
      encounterId: 'enc-deleted-here',
      campaignCode: context.campaignCode,
      events: [],
      startedAt: '2026-08-25T00:00:00.000Z',
      endedAt: '2026-08-25T01:00:00.000Z',
    };
    const otherCampaignDeletedArchive = {
      ...thisCampaignDeletedArchive,
      encounterId: 'enc-deleted-elsewhere',
      campaignCode: 'OTHER-CAMPAIGN',
    };
    const thisCampaignTombstone = {
      legacyId: 'archive-deleted-here',
      deletedAt: '2026-08-25T02:00:00.000Z',
      beforeImage: thisCampaignDeletedArchive,
    };
    const otherCampaignTombstone = {
      legacyId: 'archive-deleted-elsewhere',
      deletedAt: '2026-08-25T02:00:00.000Z',
      beforeImage: otherCampaignDeletedArchive,
    };
    useCombatLogStore.setState(state => ({
      combatLogTombstones: {
        ...state.combatLogTombstones,
        'archive-deleted-here': thisCampaignTombstone,
        'archive-deleted-elsewhere': otherCampaignTombstone,
      },
    }));
    await harness.runChainThroughCloudActivation(context);
    await harness.adapter.rollback(context);
    const tombstones = useCombatLogStore.getState().combatLogTombstones;
    expect(tombstones['archive-deleted-here']).toBeUndefined();
    expect(tombstones['archive-deleted-elsewhere']).toEqual(
      otherCampaignTombstone
    );
  });
});
