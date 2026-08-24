import { expect, it, vi } from 'vitest';

import type {
  DurableFamilyAdapter,
  MigrationRunContext,
} from '../../durableFamilyAdapter';

/**
 * Base conformance contract (ruling R3.1: Task 7 declares this; Tasks 8-12
 * extend it family-locally with whatever extra members their own harness
 * needs, named in their own report).
 *
 * PERSIST-BACKED SEEDING TRAP (fix round 2, item 5 — moved here from a
 * campaign_settings-local comment, because every family harness will hit
 * this identically): `dmStore`, `npcStore`, `encounterStore` and their
 * siblings are all `persist`-backed through their own `create*AwareStorage`
 * wrapper. Calling `use<Family>Store.setState(...)` to seed a harness's
 * in-memory legacy-store fixture WRITES ITS OWN serialization back to that
 * family's localStorage key via the persist middleware — silently
 * overwriting a raw envelope the harness set up separately (stripping
 * unclassified fields, blockers, anything the store's own type doesn't
 * carry). Seed the store FIRST, then write the intended raw envelope with a
 * direct `localStorage.setItem` AFTER, so the explicit raw write wins.
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
   * trusting the (possibly stale) one it was handed. Generalises cleanly
   * (fix round 2, item 5 survey): all six manifest builders take
   * `rawEnvelope: string` from one localStorage key, and all six cards
   * already do the same pre-cutover fingerprint re-check.
   */
  mutateLegacyEnvelope(): Promise<void>;
  /**
   * Fix round 1, CRITICAL item 1, re-spec'd in fix round 2 item 5: the
   * family's RESTORED legacy state, store-shaped — the DM-facing shape the
   * card renders, never a raw IndexedDB read. Single-record families
   * (campaign_settings, calendar) return one object (or `null` if the
   * record does not exist in the legacy store at all). Multi-record
   * families (npc, encounter_definition, magic_item, combat_log_archive)
   * return an ORDERED LIST — they restore via
   * `apply*Documents(campaignCode, result.currentGeneration.documents ?? [])`,
   * never a single object — and each entry must say how a tombstoned
   * document is represented (encounter/npc/combat_log_archive all carry a
   * `tombstoned` flag on `currentGeneration.documents` entries; a
   * family-local harness states explicitly whether a tombstoned entry is
   * included with a marker or omitted).
   *
   * MUST read the PERSISTED envelope (`localStorage.getItem(...)` on the
   * family's own key), never the in-memory store state (fix round 2, item
   * 1b): the in-memory value is correct regardless of write ORDER — only
   * the persisted value is affected by the aware-storage interception a
   * wrong write order triggers, so reading in-memory state makes an
   * ordering defect invisible to this method's callers.
   */
  readLegacyStorePayload(): Promise<unknown>;
  /**
   * Fix round 1, CRITICAL item 1: mutates the fake server's OWN current
   * generation so it differs from what is currently frozen in the local
   * legacy store, in several fields — reproducing "edits made during the
   * migrated period", the scenario the Critical restore exists for. Without
   * this, a fixture whose frozen legacy value and cloud generation
   * coincidentally agree cannot distinguish a correct restore from a
   * dropped or hardcoded one.
   */
  divergeCloudGeneration(): Promise<void>;
  /**
   * Fix round 1, CRITICAL item 1, RENAMED and re-spec'd in fix round 2 item
   * 5 (was `cloudCurrentGenerationPayload`): the expected value
   * `readLegacyStorePayload()` should equal after a successful rollback,
   * store-shaped exactly like that method's return. Only campaign_settings
   * and calendar have a `currentGeneration.payload` to project directly;
   * the four multi-record families have `currentGeneration.documents` (a
   * list of `{legacyId, payload, payloadFingerprint, serverVersion,
   * tombstoned}`) and MUST each supply their own store-shaped projection of
   * those, matching how `apply*Documents` maps them into the legacy store.
   *
   * MUST be computed from the fake server's OWN state, never from anything
   * the adapter wrote — that is the property the old name claimed and this
   * rename preserves. A value derived from the adapter's output could not
   * fail even if the adapter dropped or corrupted the restore.
   *
   * `combat_log_archive` is the awkward case for a family-local
   * implementation (per `CombatLogArchiveSyncControls.hooks.ts:1709`): its
   * own marker dialect has no `legacy_restored` value, so the base
   * "rollback writes the marker before restoring the legacy store" test's
   * implicit premise (a marker write distinguishable from every other
   * marker state) does not hold there. Task 12 states explicitly how that
   * family's harness satisfies both this member and that test.
   */
  expectedLegacyStoreAfterRollback(): unknown;
  /**
   * Fix round 2, item 1(a): pushes `'marker'` into `sink` when the family's
   * ROLLBACK marker write is entered, and `'store'` when the family's
   * legacy-store restore write is entered — both at ENTRY, mirroring
   * `recordCutoverInto`'s R10 discipline. Armed only from the moment this
   * is called (not from harness creation), so an unrelated store write made
   * while seeding the fixture is never captured.
   */
  recordRollbackOrderInto(sink: string[]): void;
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
    // (fix round 1, item 3). Fix round 2, item 2: a bare `.rejects.toThrow()`
    // is masked by the adjacent 'Campaign settings generation is missing'
    // guard, which fires for the same input and would let this test pass
    // even with the CUTOVER_READY check itself removed. Asserting the
    // specific message isolates it.
    const harness = createHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    const manifest = await harness.adapter.previewManifest(context);
    await expect(
      harness.adapter.commitLocalCutover(context, {
        generation: 'not-a-real-generation',
        manifest,
      })
    ).rejects.toThrow(/CUTOVER_READY/i);
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

  it(`${name}: rollback writes the marker before restoring the legacy store`, async () => {
    // Fix round 2, item 1(a): pins the ORDER directly, entry-time, the same
    // way the R10 test pins `commitLocalCutover`'s
    // `ensureWorkspaceRemembered`-before-cutover ordering. A behavioural
    // assertion on the end result (the next test) proves the SAME thing
    // indirectly, through the aware-storage side effect the wrong order
    // triggers — this test proves it directly, and does not depend on that
    // side effect existing.
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    const order: string[] = [];
    harness.recordRollbackOrderInto(order);
    await harness.adapter.rollback(context);
    expect(order).toEqual(['marker', 'store']);
  });

  it(`${name}: rollback restores the legacy store to the server's current generation`, async () => {
    // Fix round 1, CRITICAL item 1: the card writes the server's
    // `currentGeneration.payload` (or `.documents`, for multi-record
    // families) back into the legacy store immediately after the rollback
    // marker write. Without it, routing reverts to the FROZEN legacy
    // envelope and every edit made during the migrated period becomes
    // invisible to the DM, even though the IndexedDB documents themselves
    // survive untouched (proven separately by the next test).
    //
    // Fix round 2, item 1: three fixes to what was previously a
    // non-reproducing test.
    //   (b) `readLegacyStorePayload()` now reads the PERSISTED
    //       `rollkeeper-dm-data` envelope, not the in-memory Zustand store —
    //       the in-memory value is correct regardless of write order (the
    //       aware storage only intercepts the PERSISTED write), so reading
    //       it made the ordering defect from the test above invisible here.
    //   (c) `harness.divergeCloudGeneration()` makes the server's current
    //       generation differ from the frozen legacy envelope in several
    //       fields BEFORE rollback runs, reproducing "edits made during the
    //       migrated period" — the scenario the Critical finding is about.
    //       Previously the fixture never diverged (both were
    //       `{stackableInspiration: true}`), so this test could not tell a
    //       correct restore from one that dropped every field or hardcoded
    //       the original value.
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    await harness.divergeCloudGeneration();
    const expectedPayload = harness.expectedLegacyStoreAfterRollback();
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
    //
    // Fix round 2, item 3: the family half is checked against
    // `harness.adapter.label` — an INDEPENDENT field on the adapter, set
    // separately from `confirmation()`'s own local label — never against
    // `confirmation.familyLabel` itself. Checking `requiredPhrase` against
    // `familyLabel` from the SAME `confirmation()` call is self-referential:
    // mutating the one local variable that produces both fields (e.g.
    // `const familyLabel = 'x'`) satisfies the assertion while genuinely
    // mislabelling the family — exactly the copy-paste failure mode Tasks
    // 8-12 are at risk of.
    expect(confirmation.requiredPhrase.toLowerCase()).toContain(
      harness.adapter.label.toLowerCase()
    );
    expect(confirmation.requiredPhrase).toContain(context.campaignCode);
    expect(confirmation.campaignLabel).toContain(context.campaignCode);
  });
}
