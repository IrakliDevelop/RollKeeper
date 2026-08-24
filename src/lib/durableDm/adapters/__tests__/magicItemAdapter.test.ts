import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { magicItemAdapter } from '../magicItemAdapter';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import {
  describeAdapterConformance,
  describeCardParity,
} from './adapterConformance';
import { createMagicItemHarness } from './harnesses/magicItem';

describe('magicItemAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describeAdapterConformance('magic_item', createMagicItemHarness);

  describeCardParity('magic_item', createMagicItemHarness, {
    runIndexedDbMigration: 'runMagicItemIndexedDbMigration',
    commitLocalCutover: 'commitMagicItemLocalCutover',
    markCloudAuthority: 'markMagicItemCloudAuthority',
    rollbackLocalAuthority: 'rollbackMagicItemLocalAuthority',
  });

  it('is invisible when its own client flag is off', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'false');
    expect(magicItemAdapter.isVisible()).toBe(false);
  });

  // Brief's mandated extra test: the manifest's `records` array — sorted by
  // legacyId, per `magicItemFamily.ts`'s `finalize` — drives BOTH staging
  // and this comparison. The real chain first: `activateCloud` reads a
  // reconciled indexedDB authority and refuses outright on a family that was
  // never selected, prepared and cut over, so calling it directly would
  // assert nothing.
  it('stages every library item, in the manifest order, and nothing else', async () => {
    const harness = createMagicItemHarness();
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
    // `magic_item` has no player projection at all
    // (`MAGIC_ITEM_FAMILY_INVENTORY.projection: 'not-applicable'`), unlike
    // `campaign_settings`/`calendar`.
    const harness = createMagicItemHarness();
    const context = await harness.seed();
    const calls = harness.recordedApiActions();
    await harness.adapter.previewManifest(context);
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    await harness.adapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
    expect(calls()).not.toContain('projection-status');
    expect(calls()).not.toContain('replay-projection');
    expect(calls()).not.toContain('projection-incidents');
  });

  it('reports the manifest blockers verbatim, without deciding what to do about them', async () => {
    const harness = createMagicItemHarness();
    const context = await harness.seedWithBlocker();
    const manifest = await harness.adapter.previewManifest(context);
    expect(manifest.blockers.length).toBeGreaterThan(0);
  });

  // A lost `confirm-cutover` response actually committed server-side, so a
  // retry replays `preview-enrollment` and must reconcile rather than
  // re-stage. If the cloud generation has since diverged from the retry's
  // OWN manifest (simulated here — a real divergence would need a second
  // device), reconciliation must resolve to `conflict`, never throw.
  it('activateCloud reconciles to a conflict outcome when the replayed preview no longer matches the manifest', async () => {
    const harness = createMagicItemHarness();
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
  // mirrors `campaignSettingsAdapter.test.ts`/`calendarAdapter.test.ts`.
  it('prepareIndexedDb reports the blocked-candidates message, not the generic gate message, when blockers exist', async () => {
    const harness = createMagicItemHarness();
    const context = await harness.seedWithBlocker();
    await harness.adapter.selectFamily(context);
    await expect(harness.adapter.prepareIndexedDb(context)).rejects.toThrow(
      /unresolved candidates/i
    );
  });

  it('prepareIndexedDb reports the generic gate message when preparation is not ready for a reason other than blockers', async () => {
    const harness = createMagicItemHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    await expect(
      harness.adapter.prepareIndexedDb({
        ...context,
        recovery: { ...context.recovery, manifestHash: 'e'.repeat(64) },
      })
    ).rejects.toThrow(/safety gate/i);
  });

  // Matches `MagicItemSyncControls.tsx`'s own `prepare()` gate
  // (`:804-807`): a receipt that was recorded but never verified must not
  // satisfy `prepareIndexedDb`'s `recoveryGate`.
  it('prepareIndexedDb refuses an initiated-but-unverified recovery receipt', async () => {
    const harness = createMagicItemHarness();
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
    const harness = createMagicItemHarness();
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

  it('refuses to stage a magic item that was deleted since the preview', async () => {
    const harness = createMagicItemHarness();
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
  it('refuses to stage a magic item library whose working copy fingerprint drifted since the preview', async () => {
    const harness = createMagicItemHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.corruptWorkingCopyFingerprint(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  it('refuses to stage a magic item library whose working copy schemaVersion drifted since the preview', async () => {
    const harness = createMagicItemHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.corruptWorkingCopySchemaVersion(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // Rollback's current-generation precondition: two independently isolated
  // clauses. `magic_item` has no projection-journal clause (unlike
  // `campaign_settings`/`calendar`) because it has no player projection at
  // all, so there are two of these, not three.
  it('rollback refuses when the account is no longer cloud-authoritative', async () => {
    const harness = createMagicItemHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forcePreviewAuthorityMismatch();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current postgres generation/i
    );
  });

  it('rollback refuses when the cloud preview response is missing the current generation fingerprints', async () => {
    const harness = createMagicItemHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forceIncompleteCloudPreview();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current postgres generation/i
    );
  });
});
