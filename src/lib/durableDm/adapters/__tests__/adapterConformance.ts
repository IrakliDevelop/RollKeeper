import { expect, it, vi } from 'vitest';

import type {
  DurableFamilyAdapter,
  MigrationRunContext,
} from '../../durableFamilyAdapter';

/**
 * Base conformance contract (ruling R3.1: Task 7 declares this; Tasks 8-12
 * extend it family-locally with whatever extra members their own harness
 * needs, named in their own report).
 */
export interface ConformanceHarness {
  adapter: DurableFamilyAdapter;
  /** Seeds legacy localStorage + an open rollkeeper-local database. */
  seed(): Promise<MigrationRunContext>;
  /** Every localStorage key and IndexedDB document, for byte comparison. */
  snapshot(): Promise<string>;
  /** Drives select -> prepare -> commitLocalCutover with the real adapter. */
  runChainThroughLocalCutover(context: MigrationRunContext): Promise<void>;
  /** The above, plus activateCloud against the fake server. */
  runChainThroughCloudActivation(context: MigrationRunContext): Promise<void>;
  /** Makes the next cloud call reject, for the failure-path tests. */
  failCloud(): void;
  /** Ordered trace of API actions, working-copy checks and local commits. */
  trace(): string[];
  /** Seeds the persisted `rollkeeper:<family>-device:*` key before the run. */
  seedDeviceId(deviceId: string): void;
  /** The complete request body handed to each cloud call, in order. */
  requestBodies(): {
    beginStaging: Record<string, unknown>[];
    stageItems: Record<string, unknown>[];
    confirmCutover: Record<string, unknown>[];
  };
  /** legacyId -> payloadFingerprint for every local document. */
  documentFingerprints(): Promise<Record<string, string>>;
  /**
   * Deletes one document through the family's own delete path. Single-record
   * families keep the row and set `operation: 'delete'`; multi-record families
   * drop it from the set.
   */
  deleteWorkingCopy(legacyId: string): Promise<void>;
  addPendingOutboxEntry(): Promise<void>;
  addAcknowledgedOutboxRow(): Promise<void>;
  drainOutbox(): Promise<void>;
  addUnresolvedConflict(): Promise<void>;
  /** The run id the fake server issued, for the request-body assertions. */
  serverRunId(): string;
  /** Clears `requestBodies()` so a second attempt can be compared to the first. */
  resetRecordedRequests(): void;
  /**
   * Applies the named cloud call server-side and stores its receipt, then
   * throws a transport error instead of returning the response. This is the
   * response-loss case R7 exists for, and the only way to exercise a retry:
   * an activation that actually SUCCEEDS leaves the family Postgres-
   * authoritative, and `activateCloud` refuses to run from that state.
   */
  loseResponseAfter(
    action: 'begin-staging' | 'stage-items' | 'confirm-cutover'
  ): void;
  /** How often the fake server APPLIED a call, not counting replayed receipts. */
  serverCommitCount(
    action: 'begin-staging' | 'stage-items' | 'confirm-cutover'
  ): number;
  /**
   * Pushes `'cutover'` into `sink` when the family's own `commit*LocalCutover`
   * library call is ENTERED — not when the adapter returns. Recording it after
   * the await would pass for an adapter that remembers the workspace inside or
   * after the cutover, which is exactly the ordering R10 exists to pin.
   */
  recordCutoverInto(sink: string[]): void;
  /** Marker/pointer states for Task 13b's repair cases. */
  pointerState(): Promise<'localStorage' | 'indexedDB' | 'postgres'>;
}

export function describeAdapterConformance(
  name: string,
  createHarness: () => ConformanceHarness
) {
  it(`${name}: previewManifest changes nothing`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    const before = await harness.snapshot();
    await harness.adapter.previewManifest(context);
    expect(await harness.snapshot()).toBe(before);
  });

  it(`${name}: readAuthority changes nothing`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    const before = await harness.snapshot();
    await harness.adapter.readAuthority(context);
    expect(await harness.snapshot()).toBe(before);
  });

  it(`${name}: readAuthority reports legacy before any migration`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'legacy',
      rolledBack: false,
    });
  });

  it(`${name}: selectFamily refuses without a verified receipt for this run`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    const before = await harness.snapshot();
    await expect(
      harness.adapter.selectFamily({
        ...context,
        recovery: { ...context.recovery, manifestHash: 'f'.repeat(64) },
      })
    ).rejects.toThrow();
    expect(await harness.snapshot()).toBe(before);
  });

  it(`${name}: prepareIndexedDb refuses a manifest hash that is not the run's`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    await expect(
      harness.adapter.prepareIndexedDb({
        ...context,
        recovery: { ...context.recovery, manifestHash: 'e'.repeat(64) },
      })
    ).rejects.toThrow();
  });

  it(`${name}: commitLocalCutover refuses when the workspace is not remembered`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    const before = await harness.snapshot();
    await expect(
      harness.adapter.commitLocalCutover(
        { ...context, ensureWorkspaceRemembered: async () => {} },
        { generation: prepared.generation, manifest: prepared.manifest }
      )
    ).rejects.toThrow(/workspace/i);
    expect(await harness.snapshot()).toBe(before);
  });

  it(`${name}: commitLocalCutover remembers the workspace before it cuts over`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    const order: string[] = [];
    // The harness pushes 'cutover' when the family's `commit*LocalCutover`
    // library call is ENTERED. Appending it after the adapter returns would
    // record the same order for an adapter that remembers the workspace after
    // the real cutover, which is the ordering defect R10 exists to prevent.
    harness.recordCutoverInto(order);
    const remembering = {
      ...context,
      ensureWorkspaceRemembered: vi.fn(async () => {
        order.push('remember');
        await context.ensureWorkspaceRemembered();
      }),
    };
    await harness.adapter.selectFamily(remembering);
    const prepared = await harness.adapter.prepareIndexedDb(remembering);
    await harness.adapter.commitLocalCutover(remembering, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
    expect(remembering.ensureWorkspaceRemembered).toHaveBeenCalled();
    expect(order).toEqual(['remember', 'cutover']);
    expect(await harness.adapter.readAuthority(remembering)).toMatchObject({
      state: 'indexedDB',
    });
  });

  it(`${name}: a failed cloud activation leaves IndexedDB authority in place`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    await harness.adapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
    harness.failCloud();
    await expect(
      harness.adapter.activateCloud(context, prepared.manifest)
    ).rejects.toThrow();
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'indexedDB',
      epoch: 1,
    });
  });

  it(`${name}: activation calls the server in order and commits the local half`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);
    await harness.adapter.activateCloud(context, manifest);
    expect(harness.trace()).toEqual([
      'preview-enrollment',
      'assert-working-copy',
      'begin-staging',
      'stage-items',
      'assert-working-copy',
      'confirm-cutover',
      'mark-cloud-authority',
      'write-marker',
    ]);
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'postgres',
    });
  });

  it(`${name}: sends the exact hashed request bodies, and reuses them on a retry`, async () => {
    // This is what actually pins the persisted-device rule. The fake server's
    // own self-tests call it directly with hard-coded inputs and never execute
    // an adapter, so they cannot catch an adapter that generates a fresh device
    // id per attempt. Only asserting the bodies an adapter really sends can.
    //
    // The retry has to be a RESUMED run, not a second successful one. Two
    // constraints fix the shape:
    //   - a completed activation leaves the family Postgres-authoritative, and
    //     `activateCloud` accepts only `indexedDB` (it throws
    //     'This device is not ready to back this family up yet'), so calling it
    //     again after success cannot work;
    //   - losing the response AFTER `confirm-cutover` commits sends the retry
    //     down the reconcile path, which stages nothing and therefore records
    //     no request bodies to compare (Task 6 covers that path separately).
    // So the interruption goes after `stage-items`: the server has committed
    // begin and stage, the cutover has not been confirmed, and the retry must
    // replay both bodies byte-for-byte to get its receipts back.
    const harness = createHarness();
    const context = await harness.seed();
    harness.seedDeviceId('device-under-test');
    await harness.runChainThroughLocalCutover(context);
    const manifest = await harness.adapter.previewManifest(context);

    harness.loseResponseAfter('stage-items');
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow();
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'indexedDB',
      epoch: 1,
    });

    const first = harness.requestBodies();
    expect(first.beginStaging).toHaveLength(1);
    expect(first.beginStaging[0]).toMatchObject({
      campaignId: context.campaignId,
      // Read from the persisted key, never regenerated: it is hashed into
      // begin_staging, so a fresh value turns a retry into a 22023 rejection.
      deviceId: 'device-under-test',
      expectedEpoch: 0,
      manifestFingerprint: manifest.fingerprint,
      recoveryManifestHash: context.recovery.manifestHash,
      recordCount: manifest.recordCount,
      totalBytes: manifest.totalBytes,
    });

    const runId = harness.serverRunId();
    expect(first.stageItems[0]).toMatchObject({
      runId,
      items: expect.any(Array),
    });
    expect(first.stageItems[0].items).toHaveLength(manifest.recordCount);
    expect(first.confirmCutover).toHaveLength(0);

    // Re-run the whole activation against the same fake server, which still
    // holds the receipts from the interrupted attempt. Every replayed body must
    // hash equal to the first attempt or the RPC raises 22023 instead of
    // returning the stored result.
    harness.resetRecordedRequests();
    const result = await harness.adapter.activateCloud(context, manifest);
    // Narrow on `status` before reading `epoch` (ruling R9.8):
    // `CloudActivationOutcome` is a discriminated union and `result.epoch`
    // does not type-check on the un-narrowed type.
    if (result.status === 'conflict')
      throw new Error(
        `Expected activation to succeed, got conflict: ${result.reason}`
      );
    const second = harness.requestBodies();
    expect(second.beginStaging[0]).toEqual(first.beginStaging[0]);
    expect(second.stageItems[0]).toEqual(first.stageItems[0]);
    // The confirm is the one body this run sends for the first time. Its
    // `runId` must be the one the REPLAYED begin-staging returned — a fresh
    // begin-staging would have been rejected, and a fresh run id confirms a
    // staging run that holds none of this manifest's items.
    expect(second.confirmCutover[0]).toEqual({
      mutationId: expect.any(String),
      runId,
      manifestFingerprint: manifest.fingerprint,
      expectedEpoch: 0,
    });
    // Replayed, not re-applied: the server committed each of these once.
    expect(harness.serverCommitCount('begin-staging')).toBe(1);
    expect(harness.serverCommitCount('stage-items')).toBe(1);
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'postgres',
      epoch: result.epoch,
    });
  });

  it(`${name}: rollback returns to legacy at a new epoch and keeps every document`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    const documents = await harness.documentFingerprints();
    const result = await harness.adapter.rollback(context);
    expect(result.epoch).toBeGreaterThan(1);
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'legacy',
      rolledBack: true,
    });
    expect(await harness.documentFingerprints()).toEqual(documents);
  });

  it(`${name}: verification fails on a pending outbox entry or an unresolved conflict`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    expect(await harness.adapter.verifyCloud(context)).toMatchObject({
      verified: true,
      outboxEmpty: true,
      conflictCount: 0,
    });

    await harness.addPendingOutboxEntry();
    expect(await harness.adapter.verifyCloud(context)).toMatchObject({
      verified: false,
      outboxEmpty: false,
    });

    await harness.drainOutbox();
    await harness.addUnresolvedConflict();
    expect(await harness.adapter.verifyCloud(context)).toMatchObject({
      verified: false,
    });
  });

  it(`${name}: an acknowledged outbox row does not make the family unverifiable`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    await harness.addAcknowledgedOutboxRow();
    expect(await harness.adapter.verifyCloud(context)).toMatchObject({
      verified: true,
      outboxEmpty: true,
    });
  });

  it(`${name}: confirmation names the exact manifest fingerprint being cut over`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    const manifest = await harness.adapter.previewManifest(context);
    const confirmation = harness.adapter.confirmation(context, manifest);
    expect(confirmation.manifestFingerprint).toBe(manifest.fingerprint);
    expect(confirmation.requiredPhrase.length).toBeGreaterThan(0);
    expect(confirmation.campaignLabel).toContain(context.campaignCode);
  });
}
