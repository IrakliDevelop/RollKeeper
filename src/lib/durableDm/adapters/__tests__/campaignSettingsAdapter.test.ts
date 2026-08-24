import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { campaignSettingsAdapter } from '../campaignSettingsAdapter';
import { describeAdapterConformance } from './adapterConformance';
import { createCampaignSettingsHarness } from './harnesses/campaignSettings';

describe('campaignSettingsAdapter', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE = 'true';
  });

  describeAdapterConformance(
    'campaign_settings',
    createCampaignSettingsHarness
  );

  it('is invisible when its own client flag is off', () => {
    process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE = 'false';
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
});
