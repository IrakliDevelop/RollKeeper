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
  /**
   * Fix round 1, item 5: changes the family's legacy source in a way that
   * changes its manifest fingerprint, without re-running `prepareIndexedDb`
   * — proves `commitLocalCutover` re-checks the source manifest rather than
   * trusting the (possibly stale) one it was handed.
   */
  mutateLegacyEnvelope(): Promise<void>;
  /**
   * Fix round 1, CRITICAL item 1: the family's own legacy-store fields for
   * the seeded record, read the same way its card renders them — never
   * through IndexedDB. `null` if the record does not exist in the legacy
   * store at all.
   */
  readLegacyStorePayload(): Promise<unknown>;
  /**
   * Fix round 1, CRITICAL item 1: the fake server's own record of what a
   * fresh `currentGeneration.payload` holds right now, independent of
   * anything the adapter did with it — the expected value the
   * rollback-restores-the-legacy-store test compares `readLegacyStorePayload()`
   * against.
   */
  cloudCurrentGenerationPayload(): unknown;
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

  it(`${name}: readAuthority reports legacy when the family's client flag is off, even after a local cutover`, async () => {
    // Fix round 1, item 2: the carried-forward Task 5 contract — marker
    // readers return `null` when the client flag is off, so `readAuthority`
    // must short-circuit on `isVisible()` rather than calling the
    // normalizer, or a disabled family with real IndexedDB history reports a
    // spurious marker/pointer disagreement (`inconsistent`) instead of
    // `legacy`. Toggled through the adapter's own `isVisible()` rather than
    // a family-specific env var, so this stays generic across every family.
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughLocalCutover(context);
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'indexedDB',
    });
    const isVisible = vi
      .spyOn(harness.adapter, 'isVisible')
      .mockReturnValue(false);
    try {
      expect(await harness.adapter.readAuthority(context)).toMatchObject({
        state: 'legacy',
      });
    } finally {
      isVisible.mockRestore();
    }
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

  it(`${name}: commitLocalCutover refuses without a prepared generation`, async () => {
    // R15 names this explicitly; it was missing from every conformance test
    // (fix round 1, item 3).
    const harness = createHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    const manifest = await harness.adapter.previewManifest(context);
    await expect(
      harness.adapter.commitLocalCutover(context, {
        generation: 'not-a-real-generation',
        manifest,
      })
    ).rejects.toThrow();
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'legacy',
    });
  });

  it(`${name}: commitLocalCutover refuses when the legacy envelope changed since prepare`, async () => {
    // Fix round 1, item 5: the `sourceManifestUnchanged` gate is attested in
    // every adapter's `commitLocalCutover` call but must actually be
    // checked, not merely asserted `true`.
    const harness = createHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    await harness.mutateLegacyEnvelope();
    await expect(
      harness.adapter.commitLocalCutover(context, {
        generation: prepared.generation,
        manifest: prepared.manifest,
      })
    ).rejects.toThrow();
    expect(await harness.adapter.readAuthority(context)).toMatchObject({
      state: 'legacy',
    });
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

  it(`${name}: activateCloud refuses when this browser has not completed local cutover`, async () => {
    // Fix round 1, item 2: unpinned before this. A legacy (never-migrated)
    // context also independently fails `assertWorkingCopyUnchanged` (no
    // IndexedDB document to find), and a re-activation after a completed
    // cutover also independently fails `mark*CloudAuthority`'s own pointer
    // check — both are adjacent guards that would let a bare
    // `.rejects.toThrow()` here pass even with THIS guard deleted (the
    // Task 6 standing instruction's trap). Asserting the specific message
    // is what isolates this guard from both neighbors.
    const harness = createHarness();
    const context = await harness.seed();
    const manifest = await harness.adapter.previewManifest(context);
    await expect(
      harness.adapter.activateCloud(context, manifest)
    ).rejects.toThrow(/not ready to back this data category up yet/i);
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
    //     'This browser is not ready to back this data category up yet.'
    //     per ruling R5.1), so calling it again after success cannot work;
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

  it(`${name}: rollback refuses when this browser has not activated cloud authority`, async () => {
    // Fix round 1, item 2: unpinned before this. Rollback is destructive
    // (it moves the server epoch forward), so it must never run from a
    // state that never activated the cloud in the first place. Asserting
    // the specific message distinguishes this local-pointer guard from the
    // adjacent server-side "exact current generation" precondition, which
    // would also reject a never-activated browser with a DIFFERENT message
    // and would let a bare `.rejects.toThrow()` pass even with THIS guard
    // deleted (the Task 6 standing instruction's trap).
    const harness = createHarness();
    const context = await harness.seed();
    await expect(harness.adapter.rollback(context)).rejects.toThrow(
      /not ready to roll back/i
    );
  });

  it(`${name}: rollback restores the legacy store to the server's current generation`, async () => {
    // Fix round 1, CRITICAL item 1: the card writes the server's
    // `currentGeneration.payload` back into the legacy store immediately
    // after the rollback marker write. Without it, routing reverts to the
    // FROZEN legacy envelope and every edit made during the migrated period
    // becomes invisible to the DM, even though the IndexedDB documents
    // themselves survive untouched (proven separately by the next test).
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    const expectedPayload = harness.cloudCurrentGenerationPayload();
    await harness.adapter.rollback(context);
    expect(await harness.readLegacyStorePayload()).toEqual(expectedPayload);
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
    // Fix round 1, item 4: `.length > 0` is satisfied by a degenerate
    // single-character phrase (e.g. 'x'). The real contract is that the
    // phrase is derived from THIS family and THIS campaign, so a phrase
    // built for a different family or campaign cannot satisfy it.
    expect(confirmation.requiredPhrase.toLowerCase()).toContain(
      confirmation.familyLabel.toLowerCase()
    );
    expect(confirmation.requiredPhrase).toContain(context.campaignCode);
    expect(confirmation.campaignLabel).toContain(context.campaignCode);
  });
}
