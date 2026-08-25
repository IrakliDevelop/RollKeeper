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
   * Fix round 1, CRITICAL item 1; re-spec'd fix round 2 item 5; corrected
   * fix round 3 item 4: the family's FULL restored persisted slice, in
   * whatever shape that family's `apply*Documents` actually writes — a
   * record or a list, never a spec-mandated one. `combat_log_archive` is
   * why "always a list" was wrong: `applyCombatLogArchiveDocuments`
   * (`src/components/ui/campaign/CombatLogArchiveSyncControls/CombatLogArchiveSyncControls.hooks.ts:284-315`)
   * writes `encounters` as
   * a RECORD keyed by `archiveId`, not an array — an enforced list would
   * force that family's harness to invent a sort order production does not
   * have. Single-record families (campaign_settings, calendar) return one
   * object (or `null` if absent). The genuinely list-shaped families (npc,
   * encounter_definition, magic_item) return an ordered list. Whatever the
   * shape, EVERY persisted key the restore touches is in scope — for
   * `combat_log_archive` that is `encounters` AND the second slice
   * `applyCombatLogArchiveDocuments` also rewrites, `combatLogTombstones`; a
   * projection that reads only one and silently drops the other leaves half
   * the restore unpinned. Each family-local implementation states how a
   * tombstoned document is represented (encounter/npc/combat_log_archive
   * all carry a `tombstoned` flag on `currentGeneration.documents` entries).
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
   * Fix round 1, CRITICAL item 1; re-spec'd fix round 3 item 4 for the
   * multi-record families: mutates the fake server's OWN current generation
   * so it differs from what is currently frozen in the local legacy store —
   * reproducing "edits made during the migrated period", the scenario the
   * Critical restore exists for. Without this, a fixture whose frozen
   * legacy value and cloud generation coincidentally agree cannot
   * distinguish a correct restore from a dropped or hardcoded one.
   *
   * For a single-record family (campaign_settings, calendar), change
   * several fields of the one payload. For a multi-record family (npc,
   * encounter_definition, magic_item, combat_log_archive), a single-field
   * edit on a single document is NOT sufficient coverage on its own — each
   * of the following is a DIFFERENT branch of `apply*Documents` and the
   * family-local implementation states which of these it exercises:
   *   - an existing document's payload changed (the update branch);
   *   - a document present in the migrated generation but absent from the
   *     diverged one (the added-since-migration branch);
   *   - a document tombstoned in the diverged generation that was live in
   *     the migrated one (the delete/tombstone branch).
   * Diverging only one field on one document reproduces the exact weakness
   * fix round 2 closed for the single-record case: a restore that dropped
   * or hardcoded every other document, or every other branch, would still
   * pass.
   */
  divergeCloudGeneration(): Promise<void>;
  /**
   * Fix round 1, CRITICAL item 1, RENAMED and re-spec'd fix round 2 item 5
   * (was `cloudCurrentGenerationPayload`); hazard named fix round 3 item 4:
   * the expected value `readLegacyStorePayload()` should equal after a
   * successful rollback, store-shaped exactly like that method's return.
   * Only campaign_settings and calendar have a `currentGeneration.payload`
   * to project directly; the four multi-record families have
   * `currentGeneration.documents` (a list of `{legacyId, payload,
   * payloadFingerprint, serverVersion, tombstoned}`) and MUST each supply
   * their own store-shaped projection of those, matching how
   * `apply*Documents` maps them into the legacy store.
   *
   * MUST be computed from the fake server's OWN state, and the projection
   * logic MUST BE RESTATED IN THE HARNESS, never imported from the module
   * the adapter itself imports to build its restore.
   * `src/lib/durableDm/npcFamily.ts`'s `campaignNpcFromPayload`/`sortNpcs`
   * and `src/lib/durableDm/combatLogArchiveFamily.ts`'s
   * `combatLogArchiveFromPayload` are all exported, so it is possible to
   * import the very function the adapter uses — which would make
   * expectation and implementation share one oracle, the exact
   * self-fulfilling-fake pattern ruling R8.4 rejects for `request_hash`. "A
   * value derived from the adapter's output" (the old guard) does not name
   * this: a SHARED PURE FUNCTION is neither the adapter's output nor
   * independent of it.
   *
   * `combat_log_archive` CAN satisfy the base "rollback writes the marker
   * before restoring the legacy store" test despite having no
   * `legacy_restored` marker value: within
   * `src/components/ui/campaign/CombatLogArchiveSyncControls/CombatLogArchiveSyncControls.hooks.ts`,
   * `writeCombatLogArchiveAuthorityMarker` writes `indexedDB` at `:1071`,
   * `postgres` at `:1204`/`:1332`, and `localStorage` ONLY at rollback
   * (`:1711`) — `authority === 'localStorage'` is `combat_log_archive`'s
   * distinguishable rollback signal, the same role `legacy_restored` plays
   * for campaign_settings. The ordering premise holds too:
   * `combatLogArchiveUsesIndexedDbAuthority` and `npcUsesIndexedDbAuthority`
   * both return `authority === 'indexedDB' || authority === 'postgres'`, so
   * `localStorage` un-routes the store write exactly as `legacy_restored`
   * does for campaign_settings. Task 12 uses this signal directly; nothing
   * about this member or that test is unresolved for that family.
   *
   * Recorded for Task 12, not acted on here: `combat_log_archive`'s
   * rollback does not rehydrate tombstones from cloud documents — it only
   * strips the campaign's own — so the `combatLogTombstones` half of this
   * member's return cannot be "computed from the fake server's own state"
   * the way the rest of this doc comment requires; it has to come from the
   * harness's own seed instead. That is the one legitimate exception to
   * this member's central rule, not a violation of it.
   */
  expectedLegacyStoreAfterRollback(): unknown;
  /**
   * Fix round 2, item 1(a): pushes `'marker'` into `sink` when the family's
   * ROLLBACK marker write is entered, and `'store'` when the family's
   * legacy-store restore write is entered — both at ENTRY, mirroring
   * `recordCutoverInto`'s R10 discipline. Armed only from the moment this
   * is called (not from harness creation), so an unrelated store write made
   * while seeding the fixture is never captured. Every family's marker
   * dialect has a state distinguishable as "this is the rollback write" —
   * see `expectedLegacyStoreAfterRollback()`'s doc comment for
   * `combat_log_archive`'s specific signal.
   */
  recordRollbackOrderInto(sink: string[]): void;

  /**
   * Fix round (coordinator review of Task 12, Important 1): spec R8 defines
   * "verified" as an exact document-multiset match — same `legacyId` set,
   * same `payloadFingerprint`, same `schemaVersion` and same tombstone flag
   * per document, same record count. Before this fix round no fixture
   * anywhere made the LOCAL IndexedDB working copy disagree with the fake
   * server's OWN confirmed generation after a successful activation, so
   * `verifyCloud`'s `documentsMatch`/`tombstonesMatch` comparisons were
   * tautologically satisfied in all six families. These four members let
   * `describeAdapterConformance` diverge one already-uploaded, already-
   * confirmed document's LOCAL copy from what the cloud confirmed, in each
   * of R8's four independent ways, so each of the four checks below can be
   * pinned and mutation-isolated.
   *
   * After `runChainThroughCloudActivation`, corrupts the LOCAL working copy
   * of one already-uploaded document's `contentFingerprint` ALONE —
   * `schemaVersion` and tombstone state unchanged — so it disagrees with
   * what the cloud confirmed. Isolates `verifyCloud`'s `documentsMatch`
   * fingerprint clause. For a single-record family this is its one
   * document.
   */
  divergeVerifiedFingerprint(): Promise<void>;
  /** Same target document; `schemaVersion` diverges instead. */
  divergeVerifiedSchemaVersion(): Promise<void>;
  /**
   * Flips ONE already-uploaded document's LOCAL tombstone state
   * (`operation`) by writing the `documents` row directly — bypassing the
   * family's own delete path, which also changes `contentFingerprint` —
   * so `contentFingerprint`/`schemaVersion` stay exactly as confirmed and
   * ONLY `tombstonesMatch` disagrees. TEST-ONLY: production code never
   * writes this store directly.
   */
  divergeVerifiedTombstoneFlag(): Promise<void>;
  /**
   * Changes the LOCAL working copy's document count so it disagrees with
   * the cloud's confirmed record count, isolating `documentsMatch`'s count
   * clause. A multi-record family hard-deletes a SEEDED document's row
   * (never adds an extra one — adding a local-only document does not reach
   * the length comparison at all, because the per-document `cloud !==
   * undefined` check inside `.every()` catches it first, so the fixture
   * must instead make the LOCAL set smaller than the cloud's, which only a
   * removal can do). A single-record family has no "extra document" to add
   * either — its own implementation's doc comment states that it instead
   * hard-deletes its one local row, the only way a one-document store's
   * local count can differ from the cloud's; the resulting `documentsMatch:
   * false` comes from the SAME `if (... && document)` guard a genuine count
   * check would also need, not a distinct comparison that family's
   * `verifyCloud` ever contains — disclosed rather than left to look like a
   * literal count comparison.
   */
  divergeVerifiedRecordCount(): Promise<void>;
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
    // checked, not merely asserted `true`. Fix round 3, item 6c: tightened
    // from a bare `.rejects.toThrow()` now that this guard's message is
    // required to be distinct from `activateCloud`'s working-copy-drift
    // message (fix round 2, item 6c) — `/prepared/i` names the moment THIS
    // guard detected drift (before/at cutover), which a message about "the
    // last check" (staging-time drift) cannot satisfy.
    const harness = createHarness();
    const context = await harness.seed();
    await harness.adapter.selectFamily(context);
    const prepared = await harness.adapter.prepareIndexedDb(context);
    await harness.mutateLegacyEnvelope();
    const attempt = harness.adapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
    await expect(attempt).rejects.toThrow(/prepared/i);
    // Task 8 review, fix round 2, Minor 2: closes the vocabulary
    // regression risk in one line. This guard's message was fixed from
    // "this device" to "this browser" (R17/R5.1) with no dedicated test —
    // nothing else stops a future edit reintroducing "device" here between
    // now and Task 18b's repo-wide DOM sweep. Asserted against the actual
    // rejection reason, not a fresh call, so this is the SAME attempt
    // `/prepared/i` above already matched.
    const rejection: unknown = await attempt.catch(cause => cause);
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).not.toMatch(/\bdevice\b/i);
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

  // Coordinator review of Task 12, Important 1 (slice-level): spec R8's
  // exact-multiset claim was untested in all six families before this fix
  // round — no fixture made the LOCAL working copy disagree with the fake
  // server's OWN confirmed generation after a successful activation, so
  // `documentsMatch`/`tombstonesMatch` were tautologically satisfied. Four
  // tests below, each isolating one of R8's four independent comparisons.
  it(`${name}: verifyCloud is unverified when an uploaded document's fingerprint drifted locally`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    await harness.divergeVerifiedFingerprint();
    expect(await harness.adapter.verifyCloud(context)).toMatchObject({
      verified: false,
      documentsMatch: false,
    });
  });

  it(`${name}: verifyCloud is unverified when an uploaded document's schemaVersion drifted locally`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    await harness.divergeVerifiedSchemaVersion();
    expect(await harness.adapter.verifyCloud(context)).toMatchObject({
      verified: false,
      documentsMatch: false,
    });
  });

  it(`${name}: verifyCloud is unverified when an uploaded document's tombstone flag disagrees locally`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    await harness.divergeVerifiedTombstoneFlag();
    expect(await harness.adapter.verifyCloud(context)).toMatchObject({
      verified: false,
      tombstonesMatch: false,
    });
  });

  it(`${name}: verifyCloud is unverified when the local document count disagrees with the cloud's`, async () => {
    const harness = createHarness();
    const context = await harness.seed();
    await harness.runChainThroughCloudActivation(context);
    await harness.divergeVerifiedRecordCount();
    expect(await harness.adapter.verifyCloud(context)).toMatchObject({
      verified: false,
      documentsMatch: false,
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

/**
 * Fix round 3, item 1: extends the base contract with the support the
 * card/adapter step-parity test needs. Ruling R8.1 accepts the two-call-site
 * duplication (spec:69) on the condition that this check exists — without
 * it the adapter and the card can drift apart silently. This belongs here,
 * not in a per-family file, so Tasks 8-12 inherit `describeCardParity` the
 * same way they inherit `describeAdapterConformance`.
 */
export interface CardParityHarness extends ConformanceHarness {
  /**
   * Renders the family's own shipped card and drives it, by clicking its
   * own buttons, through discovery, selection, preview, prepare, local
   * cutover, cloud activation and rollback — the full chain
   * `describeCardParity` compares against the adapter. Implementations
   * document their own named, expected differences from the adapter (no
   * enrollment path, no history/restore/export, no `window.confirm`, and
   * any family-specific guard-strictness difference) in their own doc
   * comment, per the brief.
   */
  runCardThroughFullChain(): Promise<void>;
  /**
   * Fix round 4, item 1: the FULL, ORDERED sequence of calls each wrapped
   * library function received, by function name — never last-call-wins.
   * `campaign_settings` calls every wrapped function exactly once (a
   * single-record family), so every sequence here has length 1 and this
   * degrades to the old last-call behaviour for THAT family alone. The
   * multi-record families (npc, encounter_definition, magic_item,
   * combat_log_archive) call some of these once per document, and
   * `describeCardParity` compares the FULL sequence — length and every
   * call's arguments, not only the final one — so a divergence on any call
   * but the last is still caught.
   *
   * Fix round 4, item 3: each call's argument array is positional and
   * ASSUMES a `(database, options)` signature — true for every
   * campaign-settings authority function this harness wraps, and for the
   * equivalent per-family authority modules, but an assumption a
   * family-local implementation must confirm before reusing this shape
   * rather than inherit unread.
   */
  recordedLibraryCalls(): Record<string, unknown[][]>;
  /**
   * Every cloud request body ever sent, by action, for both callers.
   * Indexing a single action's array at `[0]` is safe for every action this
   * harness's fake server issues exactly once per attempt —
   * `resumableCloudActivation.ts:274` issues exactly one unbatched
   * `stageItems` call per activation, and campaign_settings' single-record
   * shape means one request per action overall. A family whose OWN protocol
   * batches or repeats an action would need every element, not just `[0]`.
   */
  allCloudRequestBodies(): Record<string, Record<string, unknown>[]>;
  /** The family's persisted authority marker, parsed. */
  currentMarkerRaw(): unknown;
}

function omitKeys(
  value: Record<string, unknown> | undefined,
  keys: readonly string[]
): Record<string, unknown> | undefined {
  if (!value) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key))
  );
}

/**
 * Task 9 fix round 1, Important 1: normalizes one multi-record family's
 * `initialDocuments[]` entry for comparison — strips the wall-clock
 * `updatedAt`, and replaces `deletedAt` with a stable `null | 'set'` marker
 * rather than dropping it. `deletedAt` is always either `null` (a live
 * document) or exactly `updatedAt` (a tombstoned document, set at cutover
 * time), so the raw VALUE is as wall-clock-unstable as `updatedAt` itself —
 * but the null-versus-set DISTINCTION is the field's entire meaning, and a
 * bare `omitKeys(..., ['deletedAt'])` threw that distinction away entirely,
 * letting an adapter that tombstones every live document at cutover pass
 * parity unnoticed.
 */
function normalizeInitialDocumentEntry(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const stripped = omitKeys(value, ['updatedAt', 'deletedAt']);
  if (!stripped) return stripped;
  return { ...stripped, deletedAt: value?.deletedAt === null ? null : 'set' };
}

/**
 * Fix round 4, item 1: compares the FULL, ORDERED call sequence two
 * `recordedLibraryCalls()` results hold for one function — length first
 * (a card/adapter that made a different NUMBER of calls has already
 * diverged), then every call's `options` argument (positional index
 * `optionsArgIndex`, per each function's own `(database, options)`
 * signature — see `CardParityHarness.recordedLibraryCalls`'s doc comment),
 * with `omit` stripped from each side before comparing. Exported so it can
 * be exercised directly, with constructed fixtures, independent of any
 * family's real card or adapter — `campaign_settings` itself can only ever
 * produce sequences of length 1 (a single-record family calls each wrapped
 * function exactly once), so it cannot exercise a divergence on a
 * NON-final call end-to-end; `adapterConformance.test.ts` proves this
 * function catches one anyway, with synthetic multi-call sequences
 * standing in for what a multi-record family's real run will look like.
 */
export function expectLibraryCallSequenceMatches(
  functionName: string,
  cardCalls: Record<string, unknown[][]>,
  adapterCalls: Record<string, unknown[][]>,
  optionsArgIndex: number,
  omit: readonly string[]
): { card: Record<string, unknown>; adapter: Record<string, unknown> }[] {
  // Fix round 2 (Task 8 review, Important 1): `cardCalls[functionName] ?? []`
  // on both sides made a WRONG `functionName` (a typo in a per-family
  // `CardParityFunctionNames` map, or a harness spy that silently stopped
  // firing) compare `0 === 0` and PASS — the entire comparison step
  // vanishes with the suite still green and the test count merely one
  // lower. Proven by the reviewer: typo'ing one map entry dropped the
  // comparison with zero failures. Asserting the key was actually
  // RECORDED (not merely defaulted via `?? []`) on both sides, before
  // comparing lengths, makes a name that matches nothing fail loudly
  // instead. `recordLibraryCall` only ever creates a key on its first
  // call for that name, so an absent key means "never observed", not
  // "observed zero times".
  expect(
    functionName in cardCalls,
    `${functionName}: no calls recorded on the CARD side — this name does not match anything the harness's vi.spyOn actually wraps (check the CardParityFunctionNames map against the harness for a typo)`
  ).toBe(true);
  expect(
    functionName in adapterCalls,
    `${functionName}: no calls recorded on the ADAPTER side — this name does not match anything the harness's vi.spyOn actually wraps (check the CardParityFunctionNames map against the harness for a typo)`
  ).toBe(true);
  const cardSequence = cardCalls[functionName] ?? [];
  const adapterSequence = adapterCalls[functionName] ?? [];
  expect(
    adapterSequence.length,
    `${functionName}: called ${adapterSequence.length} time(s), card called it ${cardSequence.length} time(s)`
  ).toBe(cardSequence.length);
  return cardSequence.map((cardArgs, index) => {
    const card =
      omitKeys(cardArgs[optionsArgIndex] as Record<string, unknown>, omit) ??
      {};
    const adapter =
      omitKeys(
        adapterSequence[index][optionsArgIndex] as Record<string, unknown>,
        omit
      ) ?? {};
    expect(
      adapter,
      `${functionName}: call #${index} argument mismatch`
    ).toEqual(card);
    return { card, adapter };
  });
}

/**
 * Fix round (Task 8 review, Critical 2a): `describeCardParity` hardcoded
 * `campaign_settings`' own library function names despite its doc comment
 * claiming Tasks 8-12 "inherit" it — a Task 7 residual that made it
 * unusable, unmodified, for any other family. This map is the one thing
 * that actually differs per family: each family's own
 * `run<Family>IndexedDbMigration`, `commit<Family>LocalCutover`,
 * `mark<Family>CloudAuthority` and `rollback<Family>LocalAuthority` export
 * names, exactly as the harness's own `vi.spyOn` calls target them.
 */
export interface CardParityFunctionNames {
  runIndexedDbMigration: string;
  commitLocalCutover: string;
  markCloudAuthority: string;
  rollbackLocalAuthority: string;
}

export function describeCardParity(
  name: string,
  createHarness: () => CardParityHarness,
  functionNames: CardParityFunctionNames
) {
  it(`${name}: the adapter matches the card call-for-call through local cutover, cloud activation and rollback`, async () => {
    // Same literal device id for both runs, so `deviceId` — hashed into
    // `begin_staging` — is one MORE field the comparison can check exactly
    // rather than having to exclude it alongside the genuinely
    // per-run-random `mutationId`/`runId`.
    const DEVICE_ID = 'step-parity-device';

    // --- Card run ---
    const cardHarness = createHarness();
    await cardHarness.seed();
    cardHarness.seedDeviceId(DEVICE_ID);
    await cardHarness.runCardThroughFullChain();
    const cardCalls = cardHarness.recordedLibraryCalls();
    const cardBodies = cardHarness.allCloudRequestBodies();
    const cardMarker = cardHarness.currentMarkerRaw();

    // --- Adapter run: independent harness, identical seed shape ---
    const adapterHarness = createHarness();
    const context = await adapterHarness.seed();
    adapterHarness.seedDeviceId(DEVICE_ID);
    await adapterHarness.runChainThroughLocalCutover(context);
    const manifest = await adapterHarness.adapter.previewManifest(context);
    await adapterHarness.adapter.activateCloud(context, manifest);
    await adapterHarness.adapter.rollback(context);
    const adapterCalls = adapterHarness.recordedLibraryCalls();
    const adapterBodies = adapterHarness.allCloudRequestBodies();
    const adapterMarker = adapterHarness.currentMarkerRaw();

    // 0. `run<Family>IndexedDbMigration`'s options object — a single
    // `(options)` argument, index 0, unlike the `(database, options)`
    // signature every authority function below takes. Compares only the
    // stable scoping fields (`namespace`, `campaignId`, `campaignCode`,
    // `requiredRecoveryManifestHash`): `factory`/`storage`/`now`/`nowMs` are
    // functions/handles with no cross-caller identity, and `runId`/`ownerId`
    // are per-run-random on both sides. `recoveryGate` is DELIBERATELY
    // excluded here too — it is a closure, not a comparable value — so this
    // check does NOT by itself prove the card and the adapter apply the same
    // verification strictness to it; that is pinned by each family's own
    // dedicated "requires a verified receipt" test instead (Task 8 review,
    // Important 5).
    expectLibraryCallSequenceMatches(
      functionNames.runIndexedDbMigration,
      cardCalls,
      adapterCalls,
      0,
      ['factory', 'storage', 'runId', 'ownerId', 'now', 'nowMs', 'recoveryGate']
    );

    // 1. commitLocalCutover: the FULL call sequence (fix round 4, item 1),
    // not just the last call — argument object field for field, including
    // every `gates` flag and the `initialDocument`/`initialDocuments` shape
    // — excluding `generation` (a fresh run id each side of this test
    // generates independently) and `updatedAt`/`now` (wall-clock
    // timestamps). `campaign_settings` calls this exactly once
    // (single-record), so this sequence always has length 1 here. A
    // multi-record family (magic_item and its siblings) ALSO calls this
    // exactly once per run — with an array of `initialDocuments`, one entry
    // per manifest record — never once per document; Task 9 fix round 1,
    // Minor 2 corrects this comment's earlier, wrong claim (the mutation
    // output for magic_item shows a single `call #0` holding the whole
    // array). This same check still compares the full sequence, not only
    // the final call, for whichever shape a family sends.
    expectLibraryCallSequenceMatches(
      functionNames.commitLocalCutover,
      cardCalls,
      adapterCalls,
      1,
      // Both `initialDocument` (single-record families: campaign_settings,
      // calendar) and `initialDocuments` (multi-record families: magic_item
      // and its siblings) are compared separately below, per call, with
      // their wall-clock fields stripped — excluded here so this comparison
      // is not tripped by a timestamp alone.
      ['generation', 'initialDocument', 'initialDocuments', 'now']
    );
    const cardCutoverSequence =
      cardCalls[functionNames.commitLocalCutover] ?? [];
    const adapterCutoverSequence =
      adapterCalls[functionNames.commitLocalCutover] ?? [];
    cardCutoverSequence.forEach((cardArgs, index) => {
      const cardOptions = cardArgs[1] as {
        initialDocument?: unknown;
        initialDocuments?: unknown[];
      };
      const adapterOptions = adapterCutoverSequence[index][1] as {
        initialDocument?: unknown;
        initialDocuments?: unknown[];
      };
      expect(
        omitKeys(adapterOptions.initialDocument as Record<string, unknown>, [
          'updatedAt',
        ])
      ).toEqual(
        omitKeys(cardOptions.initialDocument as Record<string, unknown>, [
          'updatedAt',
        ])
      );
      // Multi-record families pass an ARRAY, one entry per manifest record.
      // Length first (a card/adapter that built a different number of
      // initial documents has already diverged), then each entry with
      // `updatedAt` stripped (wall-clock) and `deletedAt` NORMALIZED, not
      // stripped (Task 9 fix round 1, Important 1): `deletedAt` is either
      // `null` (a live document) or exactly `updatedAt` (set at cutover for
      // a tombstoned document) — the TIMESTAMP is wall-clock-unstable, but
      // the null-versus-set DISTINCTION is the field's entire meaning.
      // Dropping the whole key let an adapter that marks every live
      // document deleted-at-cutover pass unnoticed (confirmed: mutating
      // `magicItemAdapter.ts`'s `deletedAt: record.tombstoned ? updatedAt :
      // null` to an unconditional `deletedAt: updatedAt` left 36/36 green
      // before this fix).
      expect(adapterOptions.initialDocuments?.length).toBe(
        cardOptions.initialDocuments?.length
      );
      (cardOptions.initialDocuments ?? []).forEach((cardDocument, docIndex) => {
        expect(
          normalizeInitialDocumentEntry(
            adapterOptions.initialDocuments?.[docIndex] as Record<
              string,
              unknown
            >
          )
        ).toEqual(
          normalizeInitialDocumentEntry(cardDocument as Record<string, unknown>)
        );
      });
    });

    // 2. The complete request body of each cloud call — action names alone
    // would let a changed deviceId, recovery hash, count, byte total or item
    // body through. `mutationId`/`runId` excluded: per-run-random on the
    // card, deterministic on the adapter (spec R7's whole point).
    for (const action of ['begin-staging', 'stage-items', 'confirm-cutover']) {
      const cardBody = cardBodies[action]?.[0];
      const adapterBody = adapterBodies[action]?.[0];
      expect(cardBody, `card sent no ${action} body`).toBeDefined();
      expect(
        omitKeys(adapterBody, ['mutationId', 'runId']),
        `${action} body mismatch`
      ).toEqual(omitKeys(cardBody, ['mutationId', 'runId']));
    }

    // 3. `mark*CloudAuthority` arguments, including `expectedLocalEpoch`,
    // `cloudEpoch` and `acceptedVersion` — full sequence, not just the last
    // call (fix round 4, item 1).
    //
    // Task 8 review, Minor item 6, DECLARED rather than silently excluded:
    // `acceptedVersion.serverVersion` is a KNOWN card/adapter divergence in
    // every family checked so far — the shipped card hardcodes `1`
    // (`CampaignSettingsSyncControls.tsx:784`, `CalendarSyncControls.tsx:837`),
    // while the adapter reads `result.acceptedVersions[0].serverVersion`
    // (the more correct value: whatever the server actually confirmed). This
    // `toEqual` comparison does not fail today only because every fixture in
    // this suite is a FIRST migration, where the server's real confirmed
    // version and the card's hardcoded literal both happen to be `1`. It is
    // not a general proof the two agree on any later version — recorded here
    // so a future reader does not mistake a coincidence for a contract.
    expectLibraryCallSequenceMatches(
      functionNames.markCloudAuthority,
      cardCalls,
      adapterCalls,
      1,
      ['now']
    );

    // 4. Rollback's request body and its local-authority call arguments.
    const cardRollbackBody = cardBodies.rollback?.[0];
    const adapterRollbackBody = adapterBodies.rollback?.[0];
    expect(cardRollbackBody, 'card sent no rollback body').toBeDefined();
    expect(omitKeys(adapterRollbackBody, ['mutationId'])).toEqual(
      omitKeys(cardRollbackBody, ['mutationId'])
    );
    expectLibraryCallSequenceMatches(
      functionNames.rollbackLocalAuthority,
      cardCalls,
      adapterCalls,
      1,
      ['generation', 'now']
    );

    // 5. The localStorage marker written, compared as parsed JSON.
    expect(cardMarker).toBeDefined();
    expect(adapterMarker).toEqual(cardMarker);
  });
}
