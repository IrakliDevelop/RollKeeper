import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarAdapter } from '../calendarAdapter';
import { describeAdapterConformance } from './adapterConformance';
import { createCalendarHarness } from './harnesses/calendar';

describe('calendarAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describeAdapterConformance('calendar', createCalendarHarness);

  it('is invisible when its own client flag is off', () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'false');
    expect(calendarAdapter.isVisible()).toBe(false);
  });

  it('normalizes the flat enrollment preview into the generic shape', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    // The fake route answers exactly as the real one does: flat, no documents.
    harness.seedFlatEnrollmentPreview({
      authority: 'postgres',
      epoch: 1,
      previewFingerprint: 'a'.repeat(64),
      legacyId: context.campaignCode,
      serverVersion: 1,
      schemaVersion: 1,
      payloadFingerprint: 'b'.repeat(64),
    });
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    // Reconcile, not conflict, and above all not a second staging run: that is
    // only reachable if `recordCount` and `documents` were normalized before
    // `matchesManifest` saw them.
    harness.setCloudPayloadFingerprint(manifest.records[0].payloadFingerprint);
    await harness.adapter.activateCloud(context, manifest);
    expect(harness.trace()).not.toContain('begin-staging');
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'postgres',
    });
  });

  it('refuses to stage a calendar that was deleted since the preview', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    // A delete does not remove the row; it rewrites it with `operation:
    // 'delete'` and leaves `contentFingerprint` alone, so every other
    // condition in the guard still passes. Message pinned (not a bare
    // `.rejects.toThrow()`) because `activateCloud`'s
    // "not ready to back this data category up yet" guard is an adjacent
    // guard that a bare assertion would let a deleted-delete-guard mutant
    // survive against.
    await harness.deleteWorkingCopy(manifest.records[0].legacyId);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/changed since the last check/i);
    expect(harness.trace()).not.toContain('begin-staging');
  });

  it('makes no projection call during the whole migration chain', async () => {
    const harness = createCalendarHarness();
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
    const harness = createCalendarHarness();
    const context = await harness.seedWithBlocker();
    const manifest = await harness.adapter.previewManifest(context);
    expect(manifest.blockers.length).toBeGreaterThan(0);
  });

  it('activateCloud returns a conflict outcome when the cloud already diverged', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    // Forces the cloud to already report a postgres generation whose
    // fingerprint does NOT match this run's manifest — the flat preview is
    // normalized (same shape as the "normalizes..." test above) but never
    // aligned via `setCloudPayloadFingerprint`, so `matchesManifest` must
    // disagree and `activateCloud` must resolve to `conflict`, never throw.
    harness.seedFlatEnrollmentPreview({
      authority: 'postgres',
      epoch: 1,
      previewFingerprint: 'a'.repeat(64),
      legacyId: context.campaignCode,
      serverVersion: 1,
      schemaVersion: 1,
      payloadFingerprint: 'z'.repeat(64),
    });
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    const result = await harness.adapter.activateCloud(context, manifest);
    expect(result.status).toBe('conflict');
    expect(harness.trace()).not.toContain('begin-staging');
  });

  // The two arms of `prepareIndexedDb`'s `CUTOVER_READY` message ternary,
  // pinned by distinct tests so each is independently mutation-checkable —
  // mirrors `campaignSettingsAdapter.test.ts`.
  it('prepareIndexedDb reports the blocked-candidates message, not the generic gate message, when blockers exist', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seedWithBlocker();
    await harness.adapter.selectFamily(context);
    await expect(harness.adapter.prepareIndexedDb(context)).rejects.toThrow(
      /unresolved candidates/i
    );
  });

  it('prepareIndexedDb reports the generic gate message when preparation is not ready for a reason other than blockers', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    await expect(
      harness.adapter.prepareIndexedDb({
        ...context,
        recovery: { ...context.recovery, manifestHash: 'e'.repeat(64) },
      })
    ).rejects.toThrow(/safety gate/i);
  });

  // Two sequential guards in `previewManifest`'s post-cutover branch, pinned
  // by distinct messages so mutating either is caught by a DIFFERENT test.
  it('previewManifest refuses when the IndexedDB working copy was deleted since cutover', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    await harness.deleteWorkingCopy(context.campaignCode);
    await expect(harness.adapter.previewManifest(context)).rejects.toThrow(
      /verified IndexedDB working copy is required/i
    );
  });

  it('previewManifest refuses when the IndexedDB working copy fails fingerprint verification', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    await harness.corruptWorkingCopyFingerprint();
    await expect(harness.adapter.previewManifest(context)).rejects.toThrow(
      /failed fingerprint verification/i
    );
  });

  // Rollback's current-generation/projection-journal precondition: three
  // independently isolated clauses, matching
  // `campaignSettingsAdapter.test.ts`'s equivalent trio.
  it('rollback refuses when the projection journal is not reconciled', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.setProjectionStatus('pending');
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /projection journal/i
    );
  });

  it('rollback refuses when the account is no longer cloud-authoritative', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forcePreviewAuthorityMismatch();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current Postgres generation/i
    );
  });

  it('rollback refuses when the cloud preview response is missing the current generation fingerprints', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    harness.forceIncompleteCloudPreview();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /exact current Postgres generation/i
    );
  });

  // Divergence from `campaignSettingsAdapter.ts`: the calendar card only
  // restores the legacy store when the server's `currentGeneration` carries
  // a payload. Pins the "no payload" arm, which the base conformance
  // restore test (payload always present via `divergeCloudGeneration`)
  // never reaches.
  it('rollback leaves the legacy store untouched when the server currentGeneration carries no payload', async () => {
    const harness = createCalendarHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    const before = await harness.readLegacyStorePayload();
    harness.nullifyCloudPayload();
    await harness.adapter.rollback(context);
    expect(await harness.readLegacyStorePayload()).toEqual(before);
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'legacy',
      rolledBack: true,
    });
  });
});
