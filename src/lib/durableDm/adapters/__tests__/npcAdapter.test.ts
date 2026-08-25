import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { npcAdapter } from '../npcAdapter';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import {
  describeAdapterConformance,
  describeCardParity,
} from './adapterConformance';
import { createNpcHarness } from './harnesses/npc';

describe('npcAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describeAdapterConformance('npc', createNpcHarness);

  describeCardParity('npc', createNpcHarness, {
    runIndexedDbMigration: 'runNpcIndexedDbMigration',
    commitLocalCutover: 'commitNpcLocalCutover',
    markCloudAuthority: 'markNpcCloudAuthority',
    rollbackLocalAuthority: 'rollbackNpcLocalAuthority',
  });

  it('is invisible when its own client flag is off', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'false');
    expect(npcAdapter.isVisible()).toBe(false);
  });

  // Brief's mandated extra test: `npc` is a multi-record family with a
  // cross-family reference the adapter deliberately never touches —
  // `campaign_settings.dmDashboardUi.npcCollapsedGroupNames` points at NPC
  // group NAMES, not at a manifest record. This proves the NPC chain leaves
  // an already-migrated campaign_settings family's persisted state, marker
  // and IndexedDB document completely untouched.
  it('migrates NPC documents without touching the campaign settings family', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const harness = createNpcHarness();
    const context = await harness.seedWithCampaignSettingsAlreadyMigrated();
    const settingsBefore = await harness.campaignSettingsSnapshot();
    // previewManifest is part of the chain under test for its side effect —
    // proving it does not disturb campaign_settings' snapshot either. Its
    // return value plays no further role here: `commitLocalCutover` below
    // is driven by the manifest `prepareIndexedDb` builds and returns.
    await harness.adapter.previewManifest(context);
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    await harness.adapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
    expect(await harness.campaignSettingsSnapshot()).toBe(settingsBefore);
  });

  // Brief's mandated extra test: the manifest's `records` array — sorted by
  // legacyId, per `npcFamily.ts`'s `finalize` — drives BOTH staging and
  // this comparison. The real chain first: `activateCloud` reads a
  // reconciled indexedDB authority and refuses outright on a family that was
  // never selected, prepared and cut over, so calling it directly would
  // assert nothing.
  it('stages every NPC, in the manifest order, and nothing else', async () => {
    const harness = createNpcHarness();
    const context = await harness.seedWithItems(3);
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    await harness.adapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
    const manifest = prepared.manifest;
    await harness.adapter.activateCloud(context, manifest);
    expect(harness.stagedLegacyIds()).toEqual(
      manifest.records.map(record => record.legacyId)
    );
  });

  it('makes no projection call during the whole migration chain', async () => {
    // `npc` has no player projection at all
    // (`NPC_FAMILY_INVENTORY.projection: 'not-applicable'`), unlike
    // `campaign_settings`/`calendar`.
    const harness = createNpcHarness();
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
    const harness = createNpcHarness();
    const context = await harness.seedWithBlocker();
    const manifest = await harness.adapter.previewManifest(context);
    // Compared against the EXACT blocker `seedWithBlocker()` injects (an
    // `extraField` on `npc-1`) — `blockers.length > 0` alone would stay
    // green even if the adapter rewrote every blocker's `kind`/`detail`.
    expect(manifest.blockers).toEqual([
      {
        kind: 'unclassified-field',
        legacyId: 'npc-1',
        detail: 'NPC field extraField is not classified in Slice 11D',
      },
    ]);
  });

  // A lost `confirm-cutover` response actually committed server-side, so a
  // retry replays `preview-enrollment` and must reconcile rather than
  // re-stage. If the cloud generation has since diverged from the retry's
  // OWN manifest (simulated here — a real divergence would need a second
  // device), reconciliation must resolve to `conflict`, never throw.
  it('activateCloud reconciles to a conflict outcome when the replayed preview no longer matches the manifest', async () => {
    const harness = createNpcHarness();
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

  // The two arms of `prepareIndexedDb`'s `CUTOVER_READY` message ternary,
  // pinned by distinct tests so each is independently mutation-checkable —
  // mirrors `campaignSettingsAdapter.test.ts`/`calendarAdapter.test.ts`/
  // `magicItemAdapter.test.ts`.
  it('prepareIndexedDb reports the blocked-candidates message, not the generic gate message, when blockers exist', async () => {
    const harness = createNpcHarness();
    const context = await harness.seedWithBlocker();
    await harness.adapter.selectFamily(context);
    await expect(harness.adapter.prepareIndexedDb(context)).rejects.toThrow(
      /unresolved candidates/i
    );
  });

  it('prepareIndexedDb reports the generic gate message when preparation is not ready for a reason other than blockers', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    await expect(
      harness.adapter.prepareIndexedDb({
        ...context,
        recovery: { ...context.recovery, manifestHash: 'e'.repeat(64) },
      })
    ).rejects.toThrow(/safety gate/i);
  });

  // Matches `NpcSyncControls.hooks.ts`'s own `prepare()` gate (`:790-793`):
  // a receipt that was recorded but never verified must not satisfy
  // `prepareIndexedDb`'s `recoveryGate`.
  it('prepareIndexedDb refuses an initiated-but-unverified recovery receipt', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    const unverifiedHash = 'f'.repeat(64);
    await harness.recordUnverifiedReceipt(unverifiedHash);
    await expect(
      harness.adapter.prepareIndexedDb({
        ...context,
        recovery: { ...context.recovery, manifestHash: unverifiedHash },
      })
    ).rejects.toThrow(/safety gate/i);
  });

  // Isolates the SECOND clause of `commitLocalCutover`'s combined
  // `!identity || identity.cloudId !== context.campaignId` guard from the
  // FIRST — the conformance suite's "commitLocalCutover refuses when the
  // workspace is not remembered" test only ever reaches this with `identity`
  // absent (`!identity` true); this remembers a workspace identity for a
  // DIFFERENT cloud campaign, so only the `cloudId` clause can fire.
  it('commitLocalCutover refuses when the remembered workspace identity belongs to a different campaign', async () => {
    const harness = createNpcHarness();
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

  it('refuses to stage an NPC that was deleted since the preview', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.deleteWorkingCopy(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // `assertWorkingCopyUnchanged`'s `contentFingerprint` and `schemaVersion`
  // clauses were surviving mutants in earlier families (Task 8 review,
  // Important 3) — each pinned by its own test so a mutation to either
  // clause reddens exactly one test.
  it('refuses to stage an NPC roster whose working copy fingerprint drifted since the preview', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.corruptWorkingCopyFingerprint(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  it('refuses to stage an NPC roster whose working copy schemaVersion drifted since the preview', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.corruptWorkingCopySchemaVersion(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // `current === undefined`: the missing-document clause. Unlike a soft
  // delete — which the repository's `commit()` always upserts, so the row
  // (and a `current` value) survives with a tombstone fingerprint, caught by
  // the `contentFingerprint` clause instead, per the fingerprint-drift test
  // above — this reproduces a document row that is genuinely ABSENT from
  // IndexedDB while the manifest still expects it, with an unrelated extra
  // document elsewhere holding the total count steady so the record-count
  // clause cannot fire either. Confirmed by mutation that this clause was a
  // silent surviving mutant before this test existed, and that `magic_item`'s
  // own shipped suite (Task 9) never isolates it either — see
  // task-10-report.md.
  it('refuses to stage when a manifest record has no corresponding working copy at all', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.replaceWorkingCopyEntirely(
      manifest.records[0].legacyId,
      'npc-replacement-elsewhere'
    );
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // Rollback's current-generation precondition: two independently isolated
  // clauses. `npc` has no projection-journal clause (unlike
  // `campaign_settings`/`calendar`) because it has no player projection at
  // all, so there are two of these, not three.
  it('rollback refuses when the account is no longer cloud-authoritative', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forcePreviewAuthorityMismatch();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current postgres generation/i
    );
  });

  it('rollback refuses when the cloud preview response is missing the current generation fingerprints', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forceIncompleteCloudPreview();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current postgres generation/i
    );
  });

  // A fresh `prepareIndexedDb` manifest is built from the raw legacy
  // envelope, which has no tombstone concept, so no NATURALLY produced
  // first-cutover manifest ever carries a tombstoned record — the
  // tombstone-derived branches in `commitLocalCutover`
  // (`operation: record.tombstoned ? 'delete' : 'create'`) and
  // `activateCloud` (the staged `tombstoned` field) are dead in every other
  // test in this file. `withTombstonedRecord` constructs the one input that
  // reaches them directly, mirroring what a genuinely tombstoned manifest
  // record looks like without needing a whole extra delete-then-repreview
  // round trip. Pins all three surviving mutants `magic_item`'s own review
  // found here: `operation: 'delete'` collapsing to `'create'`, the staged
  // `tombstoned` flag going `false`, and `deletedAt` being stamped on live
  // documents.
  it('mirrors a tombstoned manifest record through commitLocalCutover and activateCloud staging', async () => {
    const harness = createNpcHarness();
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

  // `assertWorkingCopyUnchanged`'s count clause
  // (`actual.size !== manifest.records.length`) is the ONLY clause that
  // detects a document added between preview and staging — the per-record
  // fingerprint clause has nothing in `manifest.records` to compare an extra
  // document against. Card-mirrored (`NpcSyncControls.hooks.ts:938-939`).
  it('refuses to stage when an extra working copy exists beyond the manifest', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.addExtraWorkingCopy('npc-added-locally');
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // The discriminating case for npc's unconditional rollback restore
  // (`?? []`, never gated behind `if (documents.length > 0)` the way
  // `calendarAdapter.ts` gates its single document). With a NON-empty store
  // already persisted from the migrated period, a conditional restore would
  // leave it untouched when the cloud generation is empty; the card's actual
  // unconditional restore explicitly clears it.
  it('rollback clears the legacy store to an empty list when the cloud generation is empty', async () => {
    const harness = createNpcHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    expect(await harness.readLegacyStorePayload()).not.toEqual([]);
    harness.emptyCloudGeneration();
    await harness.adapter.rollback(context);
    expect(await harness.readLegacyStorePayload()).toEqual([]);
  });
});
