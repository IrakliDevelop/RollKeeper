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

  // Fix round 2, item 4: all five `||` clauses of rollback's
  // current-generation/projection-journal precondition are now pinned, as
  // two cases plus the projection case below (three total, matching the
  // reviewer's count of "two more" beyond the projection-status case fix
  // round 1 already had).
  it('rollback refuses when the projection journal is not reconciled', async () => {
    const harness = createCampaignSettingsHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.setProjectionStatus('pending');
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /projection journal/i
    );
  });

  it('rollback refuses when the account is no longer cloud-authoritative', async () => {
    // Isolates `current.authority !== 'postgres'` from its three
    // neighbouring null-checks. A REAL "legacy" preview response carries
    // none of the other fields either, so `setServerAuthority`-style
    // control alone cannot tell "the authority clause caught this" from
    // "a null-check caught this" — `forcePreviewAuthorityMismatch` reports
    // `authority: 'legacy'` while keeping every other field populated
    // (something only a fake can do), which only this clause can catch.
    // This is the actual safety precondition guarding a destructive epoch
    // advance against a campaign another device already rolled back, or
    // one never activated server-side at all — not a null-check.
    const harness = createCampaignSettingsHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forcePreviewAuthorityMismatch();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current Postgres generation/i
    );
  });

  it('rollback refuses when the cloud preview response is missing the current generation fingerprints', async () => {
    // One shared case for `!previewFingerprint`, `!payloadFingerprint` and
    // `serverVersion === undefined` — three null-checks on values only ever
    // forwarded into the RPC body, honestly covered together rather than
    // isolated from each other.
    const harness = createCampaignSettingsHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forceIncompleteCloudPreview();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current Postgres generation/i
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
