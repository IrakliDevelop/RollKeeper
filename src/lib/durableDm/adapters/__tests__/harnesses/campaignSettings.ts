import 'fake-indexeddb/auto';

import { vi } from 'vitest';

import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import { campaignSettingsAdapter } from '@/lib/durableDm/adapters/campaignSettingsAdapter';
import type { MigrationRunContext } from '@/lib/durableDm/durableFamilyAdapter';
import * as campaignSettingsLegacyProjectionModule from '@/lib/durableDm/campaignSettingsLegacyProjection';
import * as resumableCloudActivationModule from '@/lib/durableDm/resumableCloudActivation';
import { captureDeviceBackup } from '@/lib/deviceRecovery';
import * as campaignSettingsAuthorityModule from '@/lib/indexeddb/campaignSettingsAuthority';
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

import type { ConformanceHarness } from '../adapterConformance';

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
export interface CampaignSettingsConformanceHarness extends ConformanceHarness {
  seedWithBlocker(): Promise<MigrationRunContext>;
  /** Fix round 1, item 2: forces the cloud `projection-status` response. */
  setProjectionStatus(status: string): void;
}

export function createCampaignSettingsHarness(): CampaignSettingsConformanceHarness {
  // Clears every spy the PREVIOUS harness instance installed, so the
  // "original" functions captured below are always the true, unwrapped
  // module exports rather than a previous test's mock.
  vi.restoreAllMocks();

  const trace: string[] = [];
  let cutoverSink: string[] | null = null;

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

      if (
        action === 'begin-staging' ||
        action === 'stage-items' ||
        action === 'confirm-cutover'
      ) {
        trace.push(action);
        const rest = Object.fromEntries(
          Object.entries(body).filter(([field]) => field !== 'action')
        );
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
    return realMarkCampaignSettingsCloudAuthority(...args);
  });

  const realCommitCampaignSettingsLocalCutover =
    campaignSettingsAuthorityModule.commitCampaignSettingsLocalCutover;
  vi.spyOn(
    campaignSettingsAuthorityModule,
    'commitCampaignSettingsLocalCutover'
  ).mockImplementation(async (...args) => {
    cutoverSink?.push('cutover');
    return realCommitCampaignSettingsLocalCutover(...args);
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
    return realWriteCampaignSettingsProjectionAuthority(...args);
  });

  async function seedWithEnvelope(raw: string): Promise<MigrationRunContext> {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
    // Fix round 1, CRITICAL item 1: `dmStore` is a module-level singleton, so
    // it is reset to hold exactly this run's campaign (not accumulated
    // across tests) — this is what `rollback`'s `useDmStore.getState()
    // .updateCampaign(...)` call needs a target row to update. Seeded BEFORE
    // the raw envelope write below: `useDmStore` is `persist`-backed by
    // `createCampaignSettingsAwareDmStorage`, so `setState` here writes its
    // own (clean, blocker-free) serialization to `rollkeeper-dm-data` too —
    // the explicit `localStorage.setItem` immediately after is what makes
    // the test's INTENDED raw envelope (blockers, unclassified fields, and
    // all) win.
    useDmStore.setState({
      campaigns: [{ code: CAMPAIGN_CODE, name: 'Canary', createdAt: NOW }],
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
     * CRITICAL item 1: reads the campaign-settings fields `rollback` is
     * responsible for restoring into the legacy `dmStore`, the same way the
     * card renders them (`useDmStore` selectors), never through IndexedDB.
     */
    async readLegacyStorePayload() {
      const campaign = useDmStore
        .getState()
        .campaigns.find(entry => entry.code === CAMPAIGN_CODE);
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
     * CRITICAL item 1: the fake server's own record of what
     * `currentGeneration.payload` holds right now, independent of anything
     * the adapter did with it — the expected value the restore test compares
     * `readLegacyStorePayload()` against.
     */
    cloudCurrentGenerationPayload: () => serverDocument?.payload ?? null,

    /** Item 2: forces `rollback`'s projection-journal precondition branch. */
    setProjectionStatus(status: string) {
      projectionStatus = status;
    },
  };
}
