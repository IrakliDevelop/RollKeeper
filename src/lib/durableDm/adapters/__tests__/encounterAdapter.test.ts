import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { encounterAdapter } from '../encounterAdapter';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import { useEncounterStore } from '@/store/encounterStore';
import {
  describeAdapterConformance,
  describeCardParity,
} from './adapterConformance';
import { createEncounterHarness } from './harnesses/encounter';

describe('encounterAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describeAdapterConformance('encounter_definition', createEncounterHarness);

  describeCardParity('encounter_definition', createEncounterHarness, {
    runIndexedDbMigration: 'runEncounterIndexedDbMigration',
    commitLocalCutover: 'commitEncounterLocalCutover',
    markCloudAuthority: 'markEncounterCloudAuthority',
    rollbackLocalAuthority: 'rollbackEncounterLocalAuthority',
  });

  it('is invisible when its own client flag is off', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'false');
    expect(encounterAdapter.isVisible()).toBe(false);
  });

  // Brief's mandated extra test, quoted verbatim in the task brief.
  it('reports the active encounter as a blocker and refuses to prepare', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seedWithActiveEncounter();
    const manifest = await harness.adapter.previewManifest(context);
    expect(manifest.blockers.map(blocker => blocker.kind)).toContain(
      'active-encounter'
    );
    await harness.adapter.selectFamily(context);
    await expect(harness.adapter.prepareIndexedDb(context)).rejects.toThrow();
  });

  // Brief's mandated extra test, quoted verbatim in the task brief.
  // `combatConfig` and `activeEncounterId` are device-global and are never
  // routed by this adapter, so a full local-cutover-plus-cloud-activation
  // chain must leave them byte-identical. `rawEnvelopeFields` returns a JSON
  // string of the two fields, which is a primitive, so `toBe` is valid.
  it('leaves combatConfig and activeEncounterId byte-identical across a cutover', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    const before = harness.rawEnvelopeFields([
      'combatConfig',
      'activeEncounterId',
    ]);
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    await harness.adapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
    expect(
      harness.rawEnvelopeFields(['combatConfig', 'activeEncounterId'])
    ).toBe(before);
  });

  // Ruling 3: an encounter (or tombstone) with no `campaignCode`, or one
  // belonging to a DIFFERENT campaign, is silently ignored — never a
  // blocker and never staged. `buildEncounterManifest` filters by
  // `entryCampaignCode !== input.campaignCode` before any classification
  // runs, so an unscoped or foreign-campaign record never even reaches
  // `validateEncounterPayload`.
  it('ignores encounters with no campaignCode and encounters belonging to another campaign, without blocking', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    const raw = localStorage.getItem('rollkeeper-encounter-data');
    if (!raw) throw new Error('Seed did not persist an envelope');
    const parsed = JSON.parse(raw) as {
      state: { encounters: Record<string, unknown>[] };
    };
    parsed.state.encounters.push(
      { id: 'enc-unscoped', name: 'No campaign at all' },
      {
        id: 'enc-other-campaign',
        name: 'Belongs elsewhere',
        campaignCode: 'SOME-OTHER-CAMPAIGN',
        entities: [],
        currentTurn: 0,
        round: 1,
        isActive: false,
        sortOrder: 'initiative',
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z',
      }
    );
    localStorage.setItem('rollkeeper-encounter-data', JSON.stringify(parsed));
    const manifest = await harness.adapter.previewManifest(context);
    expect(manifest.blockers).toEqual([]);
    expect(
      manifest.records.some(record => record.legacyId === 'enc-unscoped')
    ).toBe(false);
    expect(
      manifest.records.some(record => record.legacyId === 'enc-other-campaign')
    ).toBe(false);
  });

  it('makes no projection call during the whole migration chain', async () => {
    // `encounter_definition` has no player projection at all
    // (`ENCOUNTER_FAMILY_INVENTORY.projection: 'not-applicable'`), unlike
    // `campaign_settings`/`calendar`.
    const harness = createEncounterHarness();
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
    const harness = createEncounterHarness();
    const context = await harness.seedWithBlocker();
    const manifest = await harness.adapter.previewManifest(context);
    // Compared against the EXACT blocker `seedWithBlocker()` injects (an
    // `extraField` on `enc-1`) — `blockers.length > 0` alone would stay
    // green even if the adapter rewrote every blocker's `kind`/`detail`.
    expect(manifest.blockers).toEqual([
      {
        kind: 'unclassified-field',
        legacyId: 'enc-1',
        detail: 'Encounter field extraField is not classified in Slice 11E',
      },
    ]);
  });

  // A lost `confirm-cutover` response actually committed server-side, so a
  // retry replays `preview-enrollment` and must reconcile rather than
  // re-stage.
  it('activateCloud reconciles to a conflict outcome when the replayed preview no longer matches the manifest', async () => {
    const harness = createEncounterHarness();
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
  // mirrors `npcAdapter.test.ts`/`magicItemAdapter.test.ts`.
  it('prepareIndexedDb reports the blocked-candidates message, not the generic gate message, when blockers exist', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seedWithBlocker();
    await harness.adapter.selectFamily(context);
    await expect(harness.adapter.prepareIndexedDb(context)).rejects.toThrow(
      /unresolved candidates/i
    );
  });

  it('prepareIndexedDb reports the generic gate message when preparation is not ready for a reason other than blockers', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    await expect(
      harness.adapter.prepareIndexedDb({
        ...context,
        recovery: { ...context.recovery, manifestHash: 'e'.repeat(64) },
      })
    ).rejects.toThrow(/safety gate/i);
  });

  // Matches `EncounterSyncControls.hooks.ts`'s own `prepare()` gate
  // (`:894-897`): a receipt that was recorded but never verified must not
  // satisfy `prepareIndexedDb`'s `recoveryGate`.
  it('prepareIndexedDb refuses an initiated-but-unverified recovery receipt', async () => {
    const harness = createEncounterHarness();
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
    const harness = createEncounterHarness();
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

  it('refuses to stage an encounter that was deleted since the preview', async () => {
    const harness = createEncounterHarness();
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
  it('refuses to stage an encounter roster whose working copy fingerprint drifted since the preview', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.corruptWorkingCopyFingerprint(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  it('refuses to stage an encounter roster whose working copy schemaVersion drifted since the preview', async () => {
    const harness = createEncounterHarness();
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
  // clause cannot fire either.
  it('refuses to stage when a manifest record has no corresponding working copy at all', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.replaceWorkingCopyEntirely(
      manifest.records[0].legacyId,
      'enc-replacement-elsewhere'
    );
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // `assertWorkingCopyUnchanged`'s count clause
  // (`actual.size !== manifest.records.length`) is the ONLY clause that
  // detects a document added between preview and staging — the per-record
  // fingerprint clause has nothing in `manifest.records` to compare an extra
  // document against. Card-mirrored
  // (`EncounterSyncControls.hooks.ts:1052-1053`).
  it('refuses to stage when an extra working copy exists beyond the manifest', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.addExtraWorkingCopy('enc-added-locally');
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // Requirement 3: `recoveryGate` for `selectFamily` mirrors the card's use
  // of the stricter `hasVerifiedDownloadReceipt`, dedicated test (a closure
  // cannot be pinned by parity alone).
  it('selectFamily refuses an initiated-but-unverified recovery receipt, matching prepareIndexedDb', async () => {
    const harness = createEncounterHarness();
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

  // Requirement 12: pins all three sub-fields the tombstone fixture carries.
  it('mirrors a tombstoned manifest record through commitLocalCutover and activateCloud staging', async () => {
    const harness = createEncounterHarness();
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
  // clauses. `encounter_definition` has no projection-journal clause (unlike
  // `campaign_settings`/`calendar`) because it has no player projection at
  // all, so there are two of these, not three.
  it('rollback refuses when the account is no longer cloud-authoritative', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forcePreviewAuthorityMismatch();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current postgres generation/i
    );
  });

  it('rollback refuses when the cloud preview response is missing the current generation fingerprints', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forceIncompleteCloudPreview();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current postgres generation/i
    );
  });

  // Requirement 8: the discriminating case for encounter_definition's
  // unconditional rollback restore (`?? []`, never gated behind
  // `if (documents.length > 0)` the way `calendarAdapter.ts` gates its
  // single document — `EncounterSyncControls.hooks.ts:1579-1582`). With a
  // NON-empty store already persisted from the migrated period, a
  // conditional restore would leave it untouched when the cloud generation
  // is empty; the card's actual unconditional restore explicitly clears it.
  it('rollback clears the legacy store to an empty list when the cloud generation is empty', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    expect(await harness.readLegacyStorePayload()).not.toEqual([]);
    harness.emptyCloudGeneration();
    await harness.adapter.rollback(context);
    expect(await harness.readLegacyStorePayload()).toEqual([]);
  });

  // Requirement 6: proves `readLegacyStorePayload` reads the PERSISTED
  // envelope, not the in-memory store, by swapping the marker and payload
  // writes in rollback. Weakening the base conformance test's ordering
  // assertion would let a swapped write order slip through; this test
  // exercises the actual persisted-store side effect a swapped order would
  // corrupt.
  it('rollback restores the legacy store only after the marker write, observed through the PERSISTED envelope', async () => {
    const harness = createEncounterHarness();
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

  // `encounters` is a FLAT, cross-campaign array (unlike `npc`'s
  // per-campaign-keyed record), so `rollback`'s store restore must filter by
  // `campaignCode` on both `encounters` and `encounterTombstones` — a guard
  // this adapter introduces beyond the `npc` template it otherwise mirrors.
  // Proven by seeding an UNRELATED campaign's encounter directly into the
  // store (bypassing the harness's seed, which only ever touches
  // `CAMPAIGN_CODE`) and confirming it survives this campaign's rollback
  // byte-for-byte.
  it('rollback restores only this campaign, leaving other campaigns untouched in the store', async () => {
    const harness = createEncounterHarness();
    const context = await harness.seed();
    const otherEncounter = {
      id: 'other-campaign-enc-1',
      name: 'Untouched Elsewhere',
      campaignCode: 'OTHER-CAMPAIGN',
      entities: [],
      currentTurn: 0,
      round: 1,
      isActive: false,
      sortOrder: 'initiative' as const,
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    useEncounterStore.setState(state => ({
      encounters: [...state.encounters, otherEncounter],
    }));
    await harness.runChainThroughCloudActivation(context);
    await harness.adapter.rollback(context);
    expect(
      useEncounterStore
        .getState()
        .encounters.find(encounter => encounter.id === 'other-campaign-enc-1')
    ).toEqual(otherEncounter);
  });
});
