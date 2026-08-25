import 'fake-indexeddb/auto';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { CampaignSettingsSyncControls } from '@/components/ui/campaign/CampaignSettingsSyncControls';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import { campaignSettingsAdapter } from '@/lib/durableDm/adapters/campaignSettingsAdapter';
import type { MigrationRunContext } from '@/lib/durableDm/durableFamilyAdapter';
import * as campaignSettingsLegacyProjectionModule from '@/lib/durableDm/campaignSettingsLegacyProjection';
import * as resumableCloudActivationModule from '@/lib/durableDm/resumableCloudActivation';
import { captureDeviceBackup } from '@/lib/deviceRecovery';
import * as campaignSettingsAuthorityModule from '@/lib/indexeddb/campaignSettingsAuthority';
import * as campaignSettingsMigrationModule from '@/lib/indexeddb/campaignSettingsMigration';
import * as browserDmWorkspaceModule from '@/lib/supabase/browserDmWorkspace';
import * as supabaseBrowserModule from '@/lib/supabase/browser';
import {
  IndexedDbCampaignSettingsRepository,
  type CampaignSettingsOutboxEntry,
} from '@/lib/indexeddb/campaignSettingsRepository';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  OBJECT_STORE_NAMES,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { useDmStore } from '@/store/dmStore';

import type { CardParityHarness } from '../adapterConformance';

const NOW = '2026-08-24T00:00:00.000Z';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const CAMPAIGN_CODE = 'SYNTH1';

type FakeCloudAction = 'begin-staging' | 'stage-items' | 'confirm-cutover';

interface StagedItem {
  legacyId: string;
  schemaVersion: number;
  payload: unknown;
  payloadFingerprint: string;
  tombstoned?: boolean;
}

interface FakeReceipt {
  operation: string;
  signature: string;
  result: unknown;
}

function envelope(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    state: {
      dmId: 'dm-local',
      campaigns: [
        {
          code: CAMPAIGN_CODE,
          name: 'Canary',
          createdAt: 'now',
          stackableInspiration: true,
          ...extra,
        },
      ],
    },
    version: 1,
  });
}

// `legacyId` matches `localId` exactly, mirroring the production invariant:
// `browserDmWorkspace.ts`'s `discover()` sets both to `cloud:<campaignId>`,
// and `commitCreate` sets `legacyId: intent.localId`. The
// `IndexedDbDmWorkspaceRepository.get(namespace, localId)` lookup keys the
// `documents` store on `legacyId`, so a fixture where the two diverge could
// never round-trip through it.
const ownerWorkspace: DmWorkspaceDocument = {
  namespace: NAMESPACE,
  localId: `legacy:${CAMPAIGN_CODE}`,
  legacyId: `legacy:${CAMPAIGN_CODE}`,
  name: 'Canary',
  creationKind: 'import_fork',
  sourceFingerprint: 'source',
  createdAt: NOW,
  family: 'workspace_identity',
  cloudId: CAMPAIGN_ID,
  displayCode: 'A1B2C3D4E5F6',
  membershipAuthority: 'legacy',
  familyAuthorities: 'legacy',
  liveRuntimeAuthority: 'redis_relay',
  acknowledgedAt: NOW,
};

/**
 * Ruling R3.1: extra members this family's own tests use, beyond the base
 * `ConformanceHarness` Task 7 declares.
 */
export interface CampaignSettingsConformanceHarness extends CardParityHarness {
  seedWithBlocker(): Promise<MigrationRunContext>;
  /** Fix round 1, item 2: forces the cloud `projection-status` response. */
  setProjectionStatus(status: string): void;
  /** Fix round 2, item 4: isolates rollback's server-authority clause. */
  forcePreviewAuthorityMismatch(): void;
  /** Fix round 2, item 4: isolates rollback's three preview null-checks. */
  forceIncompleteCloudPreview(): void;
  /**
   * Task 8 review, Important 3: rewrites the IndexedDB working copy's
   * `contentFingerprint` so it no longer matches its own payload, without
   * deleting it — isolates `activateCloud`'s
   * `assertWorkingCopyUnchanged` fingerprint clause from its neighbouring
   * delete clause. (This mutation is also what `previewManifest`'s own
   * fingerprint-verification guard is proven against, when called before
   * `previewManifest` re-runs.)
   */
  corruptWorkingCopyFingerprint(): Promise<void>;
  /**
   * Task 8 review, Important 3: rewrites the working copy's
   * `schemaVersion` alone (keeping `contentFingerprint` matching) —
   * isolates `assertWorkingCopyUnchanged`'s schemaVersion clause, which has
   * no counterpart check in the card
   * (`CampaignSettingsSyncControls.tsx`'s own `assertWorkingCopyUnchanged`
   * checks only `contentFingerprint`) — declared here as adapter-only.
   */
  corruptWorkingCopySchemaVersion(): Promise<void>;
  /**
   * Fix round 1 (coordinator review of Task 10): hides this run's namespace
   * directly in `meta` (the same `account-namespace-visibility:<namespace>`
   * row `removeAccountFromDevice` writes, `campaignSettingsRepository.ts:444`),
   * WITHOUT going through the full removal flow (its own outbox/loss-
   * confirmation checks are irrelevant here) — the only way `getDocument`
   * (`campaignSettingsRepository.ts:197-211`) returns `null` for an EXISTING
   * document, reached NATURALLY in production whenever a namespace is
   * hidden, unlike a raw-row delete. Isolates `assertWorkingCopyUnchanged`'s
   * `!document` clause from its `operation === 'delete'` neighbor — a
   * soft-deleted row is never absent (`commit()` always upserts the same
   * key), so no delete fixture can reach this clause; see the corrected
   * comment on `campaignSettingsAdapter.ts`'s own guard.
   */
  hideNamespace(): Promise<void>;
}

export function createCampaignSettingsHarness(): CampaignSettingsConformanceHarness {
  // Clears every spy the PREVIOUS harness instance installed, so the
  // "original" functions captured below are always the true, unwrapped
  // module exports rather than a previous test's mock.
  vi.restoreAllMocks();

  const trace: string[] = [];
  let cutoverSink: string[] | null = null;
  // Fix round 2, item 1(a): armed by `recordRollbackOrderInto`, not at
  // harness creation.
  let rollbackOrderSink: string[] | null = null;
  // Fix round 3, item 1: last-call argument capture for the step-parity
  // test, keyed by function name — both the card and the adapter funnel
  // through these SAME module exports, so one spy layer sees both callers.
  // Fix round 4, item 1: an ARRAY of calls per function, not last-call-wins
  // — `campaign_settings` calls each wrapped function exactly once (a
  // single-record family), so this makes no observable difference here, but
  // `npc`/`encounter_definition`/`magic_item`/`combat_log_archive` call some
  // of these per document, and a last-call-wins map would silently drop
  // every call but the final one from comparison — exactly where an adapter
  // and its card are most likely to diverge and least likely to be caught.
  const libraryCalls: Record<string, unknown[][]> = {};
  function recordLibraryCall(name: string, args: unknown[]) {
    (libraryCalls[name] ??= []).push(args);
  }
  // Fix round 3, item 1: every cloud request body, by action, including the
  // read-only and rollback actions `requestBodies()` does not track.
  const allRequestBodiesByAction: Record<string, Record<string, unknown>[]> =
    {};

  // ---------------------------------------------------------------------
  // Fake `/api/campaign-settings` server. Mirrors the real RPC's
  // `request_hash` shape field-for-field (verified in
  // resumableCloudActivation.ts's own header comment): campaign_settings is
  // the ORIGINAL family and its RPCs carry no `family` key at all.
  //   begin_staging   {campaignId, deviceId, epoch, manifest, recovery, count, bytes}
  //   stage_items     {runId, items}
  //   confirm_cutover {runId, manifest, epoch}
  // ---------------------------------------------------------------------
  let serverAuthority: 'legacy' | 'postgres' = 'legacy';
  let serverEpoch = 0;
  // Fix round 1, item 2 (rollback's five-clause precondition): controllable
  // so a test can force the projection-journal branch of that guard without
  // hand-rolling a second fake server.
  let projectionStatus = 'current';
  // Fix round 2, item 4: isolates rollback's `current.authority !==
  // 'postgres'` clause from its neighbouring null-checks. A REAL legacy
  // response never carries fingerprint/version fields (there is nothing to
  // report), so `serverAuthority = 'legacy'` alone cannot isolate this
  // clause — every null-check clause fires too. 'authority-mismatch' keeps
  // every other field populated, something only a fake can do, precisely to
  // prove THIS clause alone is load-bearing. 'incomplete' is the mirror
  // case for the three null-checks: reports `authority: 'postgres'` (so
  // that clause does not fire) but omits every other field.
  let forcedPreviewMode: 'authority-mismatch' | 'incomplete' | null = null;
  let serverDocument: {
    legacyId: string;
    serverVersion: number;
    schemaVersion: number;
    payloadFingerprint: string;
    tombstoned: boolean;
    payload: unknown;
  } | null = null;
  const receipts = new Map<string, FakeReceipt>();
  const runs = new Map<string, 'staging' | 'validated' | 'finalized'>();
  const pendingItems = new Map<string, StagedItem[]>();
  const commitCounts: Record<FakeCloudAction, number> = {
    'begin-staging': 0,
    'stage-items': 0,
    'confirm-cutover': 0,
  };
  let runCounter = 0;
  let lastRunId = '';
  let failNextCall = false;
  let loseResponseAfterAction: FakeCloudAction | null = null;
  const recorded: {
    beginStaging: Record<string, unknown>[];
    stageItems: Record<string, unknown>[];
    confirmCutover: Record<string, unknown>[];
  } = { beginStaging: [], stageItems: [], confirmCutover: [] };

  function replay<T>(
    mutationId: string,
    operation: string,
    signature: string,
    produce: () => T
  ): T {
    const existing = receipts.get(mutationId);
    if (existing) {
      if (existing.operation !== operation || existing.signature !== signature)
        throw new Error('mutation ID reuse mismatch');
      return existing.result as T;
    }
    const result = produce();
    receipts.set(mutationId, { operation, signature, result });
    return result;
  }

  function previewEnrollment() {
    if (forcedPreviewMode === 'authority-mismatch') {
      return {
        authority: 'legacy' as const,
        previewFingerprint: 'p'.repeat(64),
        legacyId: serverDocument?.legacyId,
        serverVersion: serverDocument?.serverVersion,
        schemaVersion: serverDocument?.schemaVersion,
        payloadFingerprint: serverDocument?.payloadFingerprint,
      };
    }
    if (forcedPreviewMode === 'incomplete') {
      return { authority: 'postgres' as const, epoch: serverEpoch };
    }
    if (serverAuthority === 'legacy' || !serverDocument)
      return { authority: 'legacy' as const };
    return {
      authority: 'postgres' as const,
      epoch: serverEpoch,
      previewFingerprint: 'p'.repeat(64),
      legacyId: serverDocument.legacyId,
      serverVersion: serverDocument.serverVersion,
      schemaVersion: serverDocument.schemaVersion,
      payloadFingerprint: serverDocument.payloadFingerprint,
      tombstoned: serverDocument.tombstoned,
    };
  }

  async function applyAction(
    action: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    switch (action) {
      case 'preview-enrollment':
        return previewEnrollment();
      case 'projection-status':
        return { status: projectionStatus };
      case 'begin-staging':
        return replay(
          body.mutationId as string,
          'begin-staging',
          JSON.stringify({
            campaignId: body.campaignId,
            deviceId: body.deviceId,
            epoch: body.expectedEpoch,
            manifest: body.manifestFingerprint,
            recovery: body.recoveryManifestHash,
            count: body.recordCount,
            bytes: body.totalBytes,
          }),
          () => {
            const runId = `server-run-${(runCounter += 1)}`;
            runs.set(runId, 'staging');
            lastRunId = runId;
            commitCounts['begin-staging'] += 1;
            return { runId };
          }
        );
      case 'stage-items':
        return replay(
          body.mutationId as string,
          'stage-items',
          JSON.stringify({ runId: body.runId, items: body.items }),
          () => {
            const runId = body.runId as string;
            const state = runs.get(runId);
            if (state !== 'staging' && state !== 'validated')
              throw new Error('staging run is unavailable');
            runs.set(runId, 'validated');
            pendingItems.set(runId, body.items as StagedItem[]);
            commitCounts['stage-items'] += 1;
            return {};
          }
        );
      case 'confirm-cutover':
        return replay(
          body.mutationId as string,
          'confirm-cutover',
          JSON.stringify({
            runId: body.runId,
            manifest: body.manifestFingerprint,
            epoch: body.expectedEpoch,
          }),
          () => {
            const runId = body.runId as string;
            if (runs.get(runId) !== 'validated')
              throw new Error('validated staging run required');
            runs.set(runId, 'finalized');
            serverAuthority = 'postgres';
            serverEpoch = (body.expectedEpoch as number) + 1;
            const items = pendingItems.get(runId) ?? [];
            if (items[0]) {
              serverDocument = {
                legacyId: items[0].legacyId,
                serverVersion: 1,
                schemaVersion: items[0].schemaVersion,
                payloadFingerprint: items[0].payloadFingerprint,
                tombstoned: items[0].tombstoned ?? false,
                payload: items[0].payload,
              };
            }
            commitCounts['confirm-cutover'] += 1;
            return { epoch: serverEpoch };
          }
        );
      case 'rollback':
        if (body.expectedEpoch !== serverEpoch)
          throw new Error('stale rollback epoch');
        serverAuthority = 'legacy';
        serverEpoch += 1;
        return {
          epoch: serverEpoch,
          currentGeneration: {
            legacyId: serverDocument?.legacyId,
            fingerprint: serverDocument?.payloadFingerprint,
            serverVersion: serverDocument?.serverVersion,
            // Fix round 1, CRITICAL item 1: the real RPC's rollback response
            // carries the payload the adapter must restore into the legacy
            // store. Omitting it here would let the harness pass even if the
            // adapter dropped the restore, since `result.currentGeneration`
            // would never carry anything to restore in the first place.
            payload: serverDocument?.payload,
          },
        };
      default:
        throw new Error(`Unhandled fake action ${action}`);
    }
  }

  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (_input, init): Promise<Response> => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown> & {
        action: string;
      };
      const action = body.action;

      if (failNextCall) {
        failNextCall = false;
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'simulated failure' }),
        } as Response;
      }

      const rest = Object.fromEntries(
        Object.entries(body).filter(([field]) => field !== 'action')
      );
      // Fix round 3, item 1: EVERY action's body, for the step-parity test —
      // `recorded` below stays scoped to the three staging actions the
      // existing `requestBodies()` contract already promises.
      (allRequestBodiesByAction[action] ??= []).push(rest);

      if (
        action === 'begin-staging' ||
        action === 'stage-items' ||
        action === 'confirm-cutover'
      ) {
        trace.push(action);
        const key =
          action === 'begin-staging'
            ? 'beginStaging'
            : action === 'stage-items'
              ? 'stageItems'
              : 'confirmCutover';
        recorded[key].push(rest);
      } else if (action === 'preview-enrollment') {
        trace.push('preview-enrollment');
      }

      let result: unknown;
      try {
        result = await applyAction(action, body);
      } catch (cause) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            error: cause instanceof Error ? cause.message : String(cause),
          }),
        } as Response;
      }

      if (
        (action === 'begin-staging' ||
          action === 'stage-items' ||
          action === 'confirm-cutover') &&
        loseResponseAfterAction === action
      ) {
        loseResponseAfterAction = null;
        throw new Error(`simulated transport failure after ${action}`);
      }

      return { ok: true, status: 200, json: async () => result } as Response;
    }
  );

  // ---------------------------------------------------------------------
  // Trace instrumentation on the library calls the adapter makes. Ruling
  // R3.2: the harness owns `assertWorkingCopyUnchanged`'s trace entry by
  // wrapping the field `runResumableCloudActivation` receives — the adapter
  // itself never emits a trace string.
  // ---------------------------------------------------------------------
  const realRunResumableCloudActivation =
    resumableCloudActivationModule.runResumableCloudActivation;
  vi.spyOn(
    resumableCloudActivationModule,
    'runResumableCloudActivation'
  ).mockImplementation(async input =>
    realRunResumableCloudActivation({
      ...input,
      assertWorkingCopyUnchanged: async () => {
        trace.push('assert-working-copy');
        await input.assertWorkingCopyUnchanged();
      },
    })
  );

  const realMarkCampaignSettingsCloudAuthority =
    campaignSettingsAuthorityModule.markCampaignSettingsCloudAuthority;
  vi.spyOn(
    campaignSettingsAuthorityModule,
    'markCampaignSettingsCloudAuthority'
  ).mockImplementation(async (...args) => {
    trace.push('mark-cloud-authority');
    recordLibraryCall('markCampaignSettingsCloudAuthority', args);
    return realMarkCampaignSettingsCloudAuthority(...args);
  });

  const realCommitCampaignSettingsLocalCutover =
    campaignSettingsAuthorityModule.commitCampaignSettingsLocalCutover;
  vi.spyOn(
    campaignSettingsAuthorityModule,
    'commitCampaignSettingsLocalCutover'
  ).mockImplementation(async (...args) => {
    cutoverSink?.push('cutover');
    recordLibraryCall('commitCampaignSettingsLocalCutover', args);
    return realCommitCampaignSettingsLocalCutover(...args);
  });

  const realRollbackCampaignSettingsLocalAuthority =
    campaignSettingsAuthorityModule.rollbackCampaignSettingsLocalAuthority;
  vi.spyOn(
    campaignSettingsAuthorityModule,
    'rollbackCampaignSettingsLocalAuthority'
  ).mockImplementation(async (...args) => {
    recordLibraryCall('rollbackCampaignSettingsLocalAuthority', args);
    return realRollbackCampaignSettingsLocalAuthority(...args);
  });

  // Task 8 review, Critical 2c: the template spied only
  // `runResumableCloudActivation` and the three authority functions, never
  // `runCampaignSettingsIndexedDbMigration` — which is why a card/adapter
  // divergence in ITS options (e.g. a different `recoveryGate` strictness)
  // was invisible to the step-parity comparison. Both the card
  // (`CampaignSettingsSyncControls.tsx`'s `prepare()`) and the adapter
  // (`prepareIndexedDb`) call this SAME module export directly, so one spy
  // layer sees either caller, exactly like the three spies above.
  const realRunCampaignSettingsIndexedDbMigration =
    campaignSettingsMigrationModule.runCampaignSettingsIndexedDbMigration;
  vi.spyOn(
    campaignSettingsMigrationModule,
    'runCampaignSettingsIndexedDbMigration'
  ).mockImplementation(async (...args) => {
    recordLibraryCall('runCampaignSettingsIndexedDbMigration', args);
    return realRunCampaignSettingsIndexedDbMigration(...args);
  });

  const realWriteCampaignSettingsProjectionAuthority =
    campaignSettingsLegacyProjectionModule.writeCampaignSettingsProjectionAuthority;
  vi.spyOn(
    campaignSettingsLegacyProjectionModule,
    'writeCampaignSettingsProjectionAuthority'
  ).mockImplementation((...args) => {
    // Only the cloud-activation marker write ('postgres') is the trace-level
    // 'write-marker' step; the local-cutover marker write ('indexedDB')
    // happens earlier in every chained scenario and is not part of this
    // vocabulary.
    if (args[2]?.authority === 'postgres') trace.push('write-marker');
    // Fix round 2, item 1(a): the rollback marker write, for
    // `recordRollbackOrderInto`'s entry-time ordering trace.
    if (args[2]?.authority === 'legacy_restored')
      rollbackOrderSink?.push('marker');
    return realWriteCampaignSettingsProjectionAuthority(...args);
  });

  async function seedWithEnvelope(raw: string): Promise<MigrationRunContext> {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
    // `dmStore` is a module-level singleton, so it is reset to hold exactly
    // this run's campaign (not accumulated across tests) — this is what
    // `rollback`'s `useDmStore.getState().updateCampaign(...)` call needs a
    // target row to update. Seeded BEFORE the raw envelope write below: see
    // the base `ConformanceHarness`'s "PERSIST-BACKED SEEDING TRAP" doc
    // comment (fix round 2, item 5) for why the order matters here.
    // `stackableInspiration: true` matches `envelope()`'s default content
    // (fix round 3, item 1): the card's own autosave effect diffs the LIVE
    // `campaign` prop it is rendered with against the manifest fingerprint,
    // and a store campaign that disagrees with the raw envelope makes that
    // effect fire a spurious commit the instant the card hydrates — which
    // is exactly what happened here before this fix, and is why
    // `runCardThroughFullChain` renders a small wrapper that reads this
    // store live rather than a static prop, mirroring the shipped card
    // test's own `CampaignSettingsHarness` pattern.
    useDmStore.setState({
      campaigns: [
        {
          code: CAMPAIGN_CODE,
          name: 'Canary',
          createdAt: NOW,
          stackableInspiration: true,
        },
      ],
    });
    localStorage.setItem('rollkeeper-dm-data', raw);

    const recovery = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: crypto.randomUUID(),
      timestamp: NOW,
    });
    await browserRecoveryRepository.recordDownloadReceipt({
      runId: recovery.runId,
      manifestHash: recovery.manifestHash,
      initiatedAt: NOW,
    });
    await browserRecoveryRepository.verifyDownloadReceipt({
      runId: recovery.runId,
      manifestHash: recovery.manifestHash,
      verifiedAt: NOW,
    });

    let rememberPromise: Promise<void> | null = null;
    const ensureWorkspaceRemembered = () => {
      rememberPromise ??= (async () => {
        const database = await openRollkeeperDatabase();
        try {
          await new IndexedDbDmWorkspaceRepository(database).rememberDiscovered(
            ownerWorkspace
          );
        } finally {
          database.close();
        }
      })();
      return rememberPromise;
    };

    return {
      accountId: ACCOUNT_ID,
      campaignId: CAMPAIGN_ID,
      campaignCode: CAMPAIGN_CODE,
      workspace: ownerWorkspace,
      recovery,
      ensureWorkspaceRemembered,
    };
  }

  async function runChainThroughLocalCutover(context: MigrationRunContext) {
    await campaignSettingsAdapter.selectFamily(context);
    const prepared = await campaignSettingsAdapter.prepareIndexedDb(context);
    await campaignSettingsAdapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
  }

  return {
    adapter: campaignSettingsAdapter,

    seed: () => seedWithEnvelope(envelope()),
    // Extra member (ruling R3.1): an unclassified field the shipped fixtures
    // already use (`campaignSettingsMigration.test.ts`) to produce a
    // blocker without inventing a new fixture shape.
    seedWithBlocker: () => seedWithEnvelope(envelope({ calendar: { day: 1 } })),

    async snapshot() {
      const storage: [string, string][] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key === null) continue;
        storage.push([key, localStorage.getItem(key) ?? '']);
      }
      storage.sort(([left], [right]) => left.localeCompare(right));

      const database = await openRollkeeperDatabase();
      const stores: Record<string, unknown[]> = {};
      try {
        for (const name of OBJECT_STORE_NAMES) {
          const transaction = database.transaction(name, 'readonly');
          stores[name] = await requestResult(
            transaction.objectStore(name).getAll()
          );
          await transactionComplete(transaction);
        }
      } finally {
        database.close();
      }
      return JSON.stringify({ storage, stores });
    },

    runChainThroughLocalCutover,

    async runChainThroughCloudActivation(context) {
      await runChainThroughLocalCutover(context);
      const manifest = await campaignSettingsAdapter.previewManifest(context);
      await campaignSettingsAdapter.activateCloud(context, manifest);
    },

    failCloud() {
      failNextCall = true;
    },

    trace: () => [...trace],

    seedDeviceId(deviceId) {
      localStorage.setItem(
        `rollkeeper:campaign-settings-device:${ACCOUNT_ID}:${CAMPAIGN_ID}`,
        deviceId
      );
    },

    requestBodies: () => ({
      beginStaging: [...recorded.beginStaging],
      stageItems: [...recorded.stageItems],
      confirmCutover: [...recorded.confirmCutover],
    }),

    async documentFingerprints() {
      const database = await openRollkeeperDatabase();
      try {
        const document = await new IndexedDbCampaignSettingsRepository(
          database
        ).getDocument(NAMESPACE, CAMPAIGN_CODE);
        return document
          ? { [document.legacyId]: document.contentFingerprint }
          : {};
      } finally {
        database.close();
      }
    },

    async deleteWorkingCopy(legacyId) {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbCampaignSettingsRepository(database);
        const current = await repository.getDocument(NAMESPACE, legacyId);
        if (!current) throw new Error('No working copy to delete');
        await repository.commit({
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          legacyId,
          cutoverEpoch: current.cutoverEpoch,
          operation: 'delete',
          payload: null,
          schemaVersion: current.schemaVersion,
          localRevision: current.localRevision + 1,
          baseServerVersion: current.baseServerVersion,
          contentFingerprint: current.contentFingerprint,
          updatedAt: NOW,
        });
      } finally {
        database.close();
      }
    },

    async addPendingOutboxEntry() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('outbox', 'readwrite');
        transaction.objectStore('outbox').put({
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          legacyId: CAMPAIGN_CODE,
          family: 'campaign_settings',
          mutationId: `test-pending-${crypto.randomUUID()}`,
          cutoverEpoch: 1,
          operation: 'replace',
          payload: {},
          schemaVersion: 1,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: 'pending-fingerprint',
          updatedAt: NOW,
          state: 'queued',
          attemptCount: 0,
          nextAttemptAt: 0,
          inflightAt: null,
          lastError: null,
        } satisfies CampaignSettingsOutboxEntry);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    async addAcknowledgedOutboxRow() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('outbox', 'readwrite');
        transaction.objectStore('outbox').put({
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          legacyId: CAMPAIGN_CODE,
          family: 'campaign_settings',
          mutationId: `test-acknowledged-${crypto.randomUUID()}`,
          cutoverEpoch: 1,
          operation: 'replace',
          payload: {},
          schemaVersion: 1,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: 'acknowledged-fingerprint',
          updatedAt: NOW,
          state: 'acknowledged',
          attemptCount: 1,
          nextAttemptAt: 0,
          inflightAt: null,
          lastError: null,
        } satisfies CampaignSettingsOutboxEntry);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },
    /**
     * Coordinator review, Important 4: the `superseded` half of
     * `outboxEmpty`'s definition (spec R8 -- settled means zero
     * NON-TERMINAL entries; acknowledged AND superseded rows are both
     * history and stay) was previously unpinned -- dropping
     * `|| entry.state === 'superseded'` from `verifyCloud` left every
     * conformance test green. A superseded row (a mutation replaced by a
     * later one before the server ever acknowledged it) must not make the
     * family unverifiable either.
     */
    async addSupersededOutboxRow() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('outbox', 'readwrite');
        transaction.objectStore('outbox').put({
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          legacyId: CAMPAIGN_CODE,
          family: 'campaign_settings',
          mutationId: `test-superseded-${crypto.randomUUID()}`,
          cutoverEpoch: 1,
          operation: 'replace',
          payload: {},
          schemaVersion: 1,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: 'superseded-fingerprint',
          updatedAt: NOW,
          state: 'superseded',
          attemptCount: 1,
          nextAttemptAt: 0,
          inflightAt: null,
          lastError: null,
        } satisfies CampaignSettingsOutboxEntry);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    async drainOutbox() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('outbox', 'readwrite');
        const store = transaction.objectStore('outbox');
        const all = (await requestResult(
          store.getAll()
        )) as CampaignSettingsOutboxEntry[];
        for (const entry of all) {
          if (
            entry.namespace === NAMESPACE &&
            entry.campaignId === CAMPAIGN_ID &&
            entry.family === 'campaign_settings' &&
            entry.state !== 'acknowledged' &&
            entry.state !== 'superseded'
          ) {
            store.put({ ...entry, state: 'acknowledged' });
          }
        }
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    async addUnresolvedConflict() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('conflicts', 'readwrite');
        transaction.objectStore('conflicts').put({
          conflictId: `test-conflict-${crypto.randomUUID()}`,
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          family: 'campaign_settings',
          legacyId: CAMPAIGN_CODE,
          kind: 'test-conflict',
          resolutionState: 'unresolved',
          detectedAt: NOW,
        });
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },
    /**
     * Coordinator review, Important 3: spec R8 counts UNRESOLVED
     * conflicts only -- a preserved device candidate is recoverable data
     * this program exists to protect, and counting it here would make a
     * second device permanently unverifiable after any legitimate
     * divergence. Previously unpinned: a wrong predicate
     * (`resolutionState !== 'resolved'`, which WOULD count `'preserved'`)
     * left every conformance test green.
     */
    async addPreservedConflict() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('conflicts', 'readwrite');
        transaction.objectStore('conflicts').put({
          conflictId: `test-preserved-conflict-${crypto.randomUUID()}`,
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          family: 'campaign_settings',
          legacyId: CAMPAIGN_CODE,
          kind: 'test-conflict',
          resolutionState: 'preserved',
          detectedAt: NOW,
        });
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    serverRunId: () => lastRunId,

    resetRecordedRequests() {
      recorded.beginStaging = [];
      recorded.stageItems = [];
      recorded.confirmCutover = [];
    },

    loseResponseAfter(action) {
      loseResponseAfterAction = action;
    },

    serverCommitCount: action => commitCounts[action],

    recordCutoverInto(sink) {
      cutoverSink = sink;
    },

    async pointerState() {
      const database = await openRollkeeperDatabase();
      try {
        const pointer =
          await campaignSettingsAuthorityModule.readCampaignSettingsAuthority(
            database,
            NAMESPACE,
            CAMPAIGN_ID
          );
        return pointer.authority;
      } finally {
        database.close();
      }
    },

    async hardDeleteOneDocument() {
      const database = await openRollkeeperDatabase();
      try {
        const document = await new IndexedDbCampaignSettingsRepository(
          database
        ).getDocument(NAMESPACE, CAMPAIGN_CODE);
        if (!document) throw new Error('No document to delete');
        const transaction = database.transaction('documents', 'readwrite');
        transaction
          .objectStore('documents')
          .delete([document.namespace, document.family, document.legacyId]);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    bumpCloudEpoch() {
      serverEpoch += 1;
    },

    // Fix round 2, item 1: no `stackableInspiration` (or any other
    // FAMILY_FIELDS entry) — `buildCampaignSettingsManifest` still produces
    // exactly ONE record (the campaign itself is present), but with an
    // empty `{}` payload. This family cannot legitimately reach ZERO
    // records without a blocker (see the removed-branch comment in
    // `campaignSettingsAdapter.ts`'s `verifyIndexedDbGeneration`), so
    // "empty" here means minimal data, not an absent record.
    seedEmpty: () =>
      seedWithEnvelope(
        JSON.stringify({
          state: {
            dmId: 'dm-local',
            campaigns: [
              { code: CAMPAIGN_CODE, name: 'Canary', createdAt: NOW },
            ],
          },
          version: 1,
        })
      ),

    async deleteAuthorityMarker() {
      localStorage.removeItem(
        campaignSettingsLegacyProjectionModule.campaignSettingsProjectionAuthorityKey(
          CAMPAIGN_CODE
        )
      );
    },

    async seedMarkerPointerDisagreement() {
      const context = await seedWithEnvelope(envelope());
      await runChainThroughLocalCutover(context);
      localStorage.removeItem(
        campaignSettingsLegacyProjectionModule.campaignSettingsProjectionAuthorityKey(
          CAMPAIGN_CODE
        )
      );
      return context;
    },

    async seedMarkerAheadOfPointer() {
      const context = await seedWithEnvelope(envelope());
      campaignSettingsLegacyProjectionModule.writeCampaignSettingsProjectionAuthority(
        localStorage,
        CAMPAIGN_CODE,
        {
          version: 1,
          authority: 'indexedDB',
          epoch: 1,
          campaignId: CAMPAIGN_ID,
          namespace: NAMESPACE,
        }
      );
      return context;
    },

    // ---------------------------------------------------------------------
    // Fix round 1 additions.
    // ---------------------------------------------------------------------

    /**
     * Item 5: changes the legacy source in a way that changes its manifest
     * fingerprint without re-running `prepareIndexedDb`, so a test can prove
     * `commitLocalCutover` re-checks the source manifest instead of trusting
     * the one it was handed.
     */
    async mutateLegacyEnvelope() {
      const raw = localStorage.getItem('rollkeeper-dm-data');
      if (!raw) throw new Error('No legacy envelope to mutate');
      const parsed = JSON.parse(raw) as {
        state: {
          campaigns: { code: string; stackableInspiration?: boolean }[];
        };
      };
      const campaign = parsed.state.campaigns.find(
        entry => entry.code === CAMPAIGN_CODE
      );
      if (!campaign) throw new Error('Seeded campaign is missing');
      campaign.stackableInspiration = !campaign.stackableInspiration;
      localStorage.setItem('rollkeeper-dm-data', JSON.stringify(parsed));
    },

    /**
     * CRITICAL item 1, re-spec'd in fix round 2 item 5: reads the
     * PERSISTED `rollkeeper-dm-data` envelope directly (never the in-memory
     * `useDmStore` state, and never IndexedDB) — this is what makes the
     * marker-before-payload write ORDER observable at all, since
     * `createCampaignSettingsAwareDmStorage` only intercepts the persisted
     * write, not the in-memory `set()`. campaign_settings is single-record,
     * so this returns one object (or `null` if the campaign is absent from
     * the persisted envelope).
     */
    async readLegacyStorePayload() {
      const raw = localStorage.getItem('rollkeeper-dm-data');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        state?: { campaigns?: Record<string, unknown>[] };
      };
      const campaign = parsed.state?.campaigns?.find(
        entry => entry.code === CAMPAIGN_CODE
      );
      if (!campaign) return null;
      return {
        bannerUrl: campaign.bannerUrl,
        playerColors: campaign.playerColors,
        dmDashboardUi: campaign.dmDashboardUi,
        stackableInspiration: campaign.stackableInspiration,
        customCounterLabel: campaign.customCounterLabel,
        playerCounters: campaign.playerCounters,
      };
    },

    /**
     * CRITICAL item 1: mutates the fake server's own current generation so
     * it differs from the frozen legacy value in several fields, simulating
     * an edit made on another device during the migrated period. Bumps
     * `serverVersion` and replaces `payloadFingerprint` too, so the
     * generation is internally consistent with having actually changed.
     */
    async divergeCloudGeneration() {
      // Fix round 3, item 5: all six restorable fields now diverge from the
      // frozen legacy value (`{stackableInspiration: true}`, every other
      // field absent) — previously only three did, so deleting the other
      // three `updateCampaign` mappings (`bannerUrl`, `playerColors`,
      // `dmDashboardUi`) survived 34/34.
      if (!serverDocument) throw new Error('No cloud generation to diverge');
      serverDocument = {
        ...serverDocument,
        serverVersion: serverDocument.serverVersion + 1,
        payloadFingerprint: 'd'.repeat(64),
        payload: {
          stackableInspiration: false,
          customCounterLabel: 'Edited on another device',
          playerCounters: { 'player-1': 3 },
          bannerUrl: 'https://example.test/banner-edited.png',
          playerColors: { 'player-1': '#ff00ff' },
          dmDashboardUi: { playersSectionOpen: false },
        },
      };
    },

    /**
     * CRITICAL item 1, RENAMED in fix round 2 item 5 (was
     * `cloudCurrentGenerationPayload`): the fake server's OWN record of what
     * `currentGeneration.payload` holds right now, independent of anything
     * the adapter did with it — computed straight from `serverDocument`,
     * never read back through the adapter or the store. The expected value
     * the restore test compares `readLegacyStorePayload()` against.
     */
    expectedLegacyStoreAfterRollback: () => serverDocument?.payload ?? null,

    /**
     * Fix round 2, item 1(a): entry-time ordering trace for rollback's
     * marker-then-store write sequence. Armed here (at call time), not at
     * harness creation, so the seed's own unrelated `useDmStore.setState`
     * call is never captured. The spy targets the LIVE state object
     * `useDmStore.getState()` returns at the moment this is called — stable
     * for the rest of the test because nothing else calls `dmStore`'s
     * `set`/`setState` between here and `rollback()`'s own
     * `useDmStore.getState().updateCampaign(...)` call, which resolves
     * `getState()` to this SAME object and therefore calls this spy.
     */
    recordRollbackOrderInto(sink: string[]) {
      rollbackOrderSink = sink;
      const state = useDmStore.getState();
      const originalUpdateCampaign = state.updateCampaign;
      vi.spyOn(state, 'updateCampaign').mockImplementation((...args) => {
        sink.push('store');
        return originalUpdateCampaign(...args);
      });
    },

    /** Item 2: forces `rollback`'s projection-journal precondition branch. */
    setProjectionStatus(status: string) {
      projectionStatus = status;
    },

    /**
     * Fix round 2, item 4: isolates `rollback`'s
     * `current.authority !== 'postgres'` clause — see the `forcedPreviewMode`
     * comment above for why a real legacy response cannot do this alone.
     */
    forcePreviewAuthorityMismatch() {
      forcedPreviewMode = 'authority-mismatch';
    },

    /**
     * Fix round 2, item 4: isolates the three null-check clauses
     * (`!previewFingerprint`, `!payloadFingerprint`, `serverVersion ===
     * undefined`) as one shared case, honest coverage for three checks that
     * only ever guard "the preview response is incomplete".
     */
    forceIncompleteCloudPreview() {
      forcedPreviewMode = 'incomplete';
    },

    // -----------------------------------------------------------------
    // Task 8 review, Important 3.
    // -----------------------------------------------------------------

    async corruptWorkingCopyFingerprint() {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbCampaignSettingsRepository(database);
        const current = await repository.getDocument(NAMESPACE, CAMPAIGN_CODE);
        if (!current) throw new Error('No working copy to corrupt');
        await repository.commit({
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          legacyId: CAMPAIGN_CODE,
          cutoverEpoch: current.cutoverEpoch,
          operation: 'replace',
          payload: current.payload,
          schemaVersion: current.schemaVersion,
          localRevision: current.localRevision + 1,
          baseServerVersion: current.baseServerVersion,
          contentFingerprint: 'c'.repeat(64),
          updatedAt: NOW,
        });
      } finally {
        database.close();
      }
    },

    async corruptWorkingCopySchemaVersion() {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbCampaignSettingsRepository(database);
        const current = await repository.getDocument(NAMESPACE, CAMPAIGN_CODE);
        if (!current) throw new Error('No working copy to corrupt');
        await repository.commit({
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          legacyId: CAMPAIGN_CODE,
          cutoverEpoch: current.cutoverEpoch,
          operation: 'replace',
          payload: current.payload,
          schemaVersion: current.schemaVersion + 1,
          localRevision: current.localRevision + 1,
          baseServerVersion: current.baseServerVersion,
          contentFingerprint: current.contentFingerprint,
          updatedAt: NOW,
        });
      } finally {
        database.close();
      }
    },

    // -----------------------------------------------------------------
    // Coordinator review of Task 12, Important 1 (slice-level fix):
    // `verifyCloud`'s R8 comparisons, added to the shared base interface.
    // -----------------------------------------------------------------

    async divergeVerifiedFingerprint() {
      await this.corruptWorkingCopyFingerprint();
    },

    async divergeVerifiedSchemaVersion() {
      await this.corruptWorkingCopySchemaVersion();
    },

    async divergeVerifiedTombstoneFlag() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('documents', 'readwrite');
        const store = transaction.objectStore('documents');
        const key = [NAMESPACE, 'campaign_settings', CAMPAIGN_CODE];
        const current = (await requestResult(store.get(key))) as
          | { operation: string; deletedAt: string | null }
          | undefined;
        if (!current) throw new Error('No working copy to corrupt');
        store.put({ ...current, operation: 'delete', deletedAt: NOW });
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    // A single-record family has no EXTRA document to add — this is the
    // one-document store's only way for a local count to differ from the
    // cloud's: hard-delete the local row entirely (bypassing `commit()`,
    // which would keep a soft-deleted row and only trip the fingerprint
    // and tombstone clauses, not a count clause). `verifyCloud`'s
    // `documentsMatch` never literally counts documents for this family —
    // it is gated behind `if (cloudAuthority === 'postgres' && document)`,
    // so a genuinely ABSENT document folds into that same guard, which is
    // what a local count of 0 (vs the cloud's 1) actually means here.
    async divergeVerifiedRecordCount() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('documents', 'readwrite');
        transaction
          .objectStore('documents')
          .delete([NAMESPACE, 'campaign_settings', CAMPAIGN_CODE]);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    async hideNamespace() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('meta', 'readwrite');
        transaction.objectStore('meta').put({
          key: `account-namespace-visibility:${NAMESPACE}`,
          hidden: true,
          removedAt: NOW,
        });
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    // -----------------------------------------------------------------
    // Fix round 3, item 1: the card/adapter step-parity test support.
    // -----------------------------------------------------------------

    /**
     * Renders the SHIPPED `CampaignSettingsSyncControls` card and drives it,
     * by clicking its own buttons, through discovery -> select -> preview ->
     * download+select -> prepare -> confirm local cutover -> activate cloud
     * -> verified rollback. Every library call the card makes along the way
     * is captured by the SAME spies `recordedLibraryCalls()` and
     * `allCloudRequestBodies()` expose for the adapter — the card and the
     * adapter both funnel through these exact module exports, so one spy
     * layer sees either caller with no card-specific instrumentation.
     *
     * Named, expected differences from the adapter's own chain (kept out of
     * the comparison the step-parity test makes):
     *   - the card discovers and selects a workspace interactively; the
     *     adapter receives an already-selected `MigrationRunContext`.
     *   - the card's `downloadAndSelect` only ever records an INITIATED
     *     recovery receipt (`initiateDeviceBackupDownload` ->
     *     `recordDownloadReceipt`); its own `prepare()` gate
     *     (`recoveryGate.hasDownloadReceipt`) only checks existence. The
     *     adapter's `selectFamily` requires a VERIFIED receipt
     *     (`hasVerifiedDownloadReceipt`) — deliberately stricter, because
     *     the wizard (unlike the card) has no per-family manual
     *     download-and-reopen step of its own; the wizard's own bundle
     *     verification is what the adapter's guard trusts. This harness
     *     satisfies both: `seed()` already records AND verifies the
     *     receipt, which is a superset of what the card's own flow needs.
     *   - the card uses `window.confirm`; the adapter has none (spec R12).
     *   - the card has no `verifyCloud` equivalent (new per R1).
     *   - mutation ids are random (`crypto.randomUUID()`) on the card and
     *     deterministic (`migrationMutationId`) on the adapter — excluded
     *     from every body comparison, like `runId` and `generation`.
     */
    async runCardThroughFullChain() {
      const remembered: DmWorkspaceDocument[] = [];
      vi.spyOn(
        browserDmWorkspaceModule,
        'createBrowserDmWorkspace'
      ).mockImplementation(async () => ({
        accountId: ACCOUNT_ID,
        accountLabel: 'synthetic@example.test',
        list: vi.fn().mockImplementation(async () => [...remembered]),
        discover: vi.fn().mockResolvedValue([ownerWorkspace]),
        remember: vi
          .fn()
          .mockImplementation(async (item: DmWorkspaceDocument) => {
            if (!remembered.some(known => known.cloudId === item.cloudId))
              remembered.push(item);
          }),
        create: vi.fn(),
        forkLegacy: vi.fn(),
        close: vi.fn(),
      }));
      vi.spyOn(
        supabaseBrowserModule,
        'createSupabaseBrowserClient'
      ).mockReturnValue({
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
          onAuthStateChange: vi.fn().mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
          }),
        },
      } as never);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(
        'blob:campaign-settings-recovery'
      );
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        () => undefined
      );

      // Reads the campaign LIVE from `useDmStore`, mirroring the shipped
      // card test's own `CampaignSettingsHarness` wrapper
      // (`CampaignSettingsSyncControls.test.tsx`) — a STATIC prop here
      // disagrees with the store the card's own autosave effect reads,
      // which fires a spurious commit the instant the card hydrates and
      // corrupts the working copy this test depends on staying untouched.
      function CardHarness() {
        const campaign = useDmStore(state =>
          state.campaigns.find(item => item.code === CAMPAIGN_CODE)
        );
        if (!campaign) return null;
        return <CampaignSettingsSyncControls campaign={campaign} />;
      }
      render(<CardHarness />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Find owner workspaces' })
      );
      fireEvent.click(
        await screen.findByRole('button', { name: /Select Canary/ })
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Preview exact manifest' })
      );
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Download recovery and select',
        })
      );
      await screen.findByText(
        /selected\. LocalStorage remains authoritative\./i
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Prepare IndexedDB' })
      );
      await screen.findByText(/Final confirmation is still required\./i);
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirm local cutover' })
      );
      await screen.findByText(/IndexedDB authority epoch/i);
      fireEvent.click(
        await screen.findByRole('button', { name: 'Activate cloud family' })
      );
      await screen.findByText(/Cloud: saved/i);
      fireEvent.click(
        await screen.findByRole('button', { name: 'Verified rollback' })
      );
      await screen.findByText(/Rollback accepted/i);
      cleanup();
    },

    /** Fix round 4, item 1: full call-sequence argument capture, by function name. */
    recordedLibraryCalls: () => ({ ...libraryCalls }),

    /** Fix round 3, item 1: every cloud request body ever sent, by action. */
    allCloudRequestBodies: () => ({ ...allRequestBodiesByAction }),

    /** Fix round 3, item 1: the persisted marker, parsed. */
    currentMarkerRaw() {
      const raw = localStorage.getItem(
        `rollkeeper:campaign-settings-projection-authority:${CAMPAIGN_CODE}`
      );
      return raw ? (JSON.parse(raw) as unknown) : null;
    },
  };
}
