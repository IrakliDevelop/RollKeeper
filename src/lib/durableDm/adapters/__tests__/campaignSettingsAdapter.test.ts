import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { campaignSettingsAdapter } from '../campaignSettingsAdapter';
import { describeAdapterConformance } from './adapterConformance';
import { createCampaignSettingsHarness } from './harnesses/campaignSettings';

describe('campaignSettingsAdapter', () => {
  // Fix round 1, item 7: `vi.stubEnv` + `vi.unstubAllEnvs`, matching every
  // sibling campaign-settings suite (`slice11aFlags.test.ts`, etc.), instead
  // of a raw `process.env` assignment with nothing to reset it. This file is
  // the template Tasks 8-12 copy.
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describeAdapterConformance(
    'campaign_settings',
    createCampaignSettingsHarness
  );

  it('is invisible when its own client flag is off', () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'false');
    expect(campaignSettingsAdapter.isVisible()).toBe(false);
  });

  it('reports the manifest blockers verbatim, without deciding what to do about them', async () => {
    const harness = createCampaignSettingsHarness();
    const context = await harness.seedWithBlocker();
    const manifest = await campaignSettingsAdapter.previewManifest(context);
    expect(manifest.blockers.length).toBeGreaterThan(0);
  });

  it('refuses to stage a campaign that was deleted since the preview', async () => {
    const harness = createCampaignSettingsHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    // A delete does not remove the row; it rewrites it with `operation:
    // 'delete'` and leaves `contentFingerprint` alone, so every other
    // condition in the guard still passes.
    await harness.deleteWorkingCopy(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // Fix round 1, item 2 (rollback's five-clause precondition): the
  // projection-status clause is the one directly controllable through the
  // fake server without hand-rolling a second one. `current.authority`'s own
  // clause is exercised by the base suite's "rollback refuses when this
  // browser has not activated cloud authority" test, and the base suite's
  // "rollback restores the legacy store..." / "rollback returns to legacy"
  // tests exercise the happy path where every clause of this precondition
  // is satisfied — together they bound the guard even though this file does
  // not isolate all five `||` clauses individually.
  it('rollback refuses when the projection journal is not reconciled', async () => {
    const harness = createCampaignSettingsHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.setProjectionStatus('pending');
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /projection journal/i
    );
  });

  // Fix round 1, item 6: the two arms of `prepareIndexedDb`'s `CUTOVER_READY`
  // message ternary, pinned by distinct tests so each is independently
  // mutation-checkable.
  it('prepareIndexedDb reports the blocked-candidates message, not the generic gate message, when blockers exist', async () => {
    const harness = createCampaignSettingsHarness();
    const context = await harness.seedWithBlocker();
    await harness.adapter.selectFamily(context);
    await expect(harness.adapter.prepareIndexedDb(context)).rejects.toThrow(
      /unresolved candidates/i
    );
  });

  it('prepareIndexedDb reports the generic gate message when preparation is not ready for a reason other than blockers', async () => {
    const harness = createCampaignSettingsHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    await expect(
      harness.adapter.prepareIndexedDb({
        ...context,
        recovery: { ...context.recovery, manifestHash: 'e'.repeat(64) },
      })
    ).rejects.toThrow(/safety gate/i);
  });
});
