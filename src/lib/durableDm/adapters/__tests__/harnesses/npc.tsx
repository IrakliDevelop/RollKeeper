import 'fake-indexeddb/auto';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import {
  NpcSyncControls,
  NpcSyncProvider,
} from '@/components/ui/campaign/NpcSyncControls';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import { npcAdapter } from '@/lib/durableDm/adapters/npcAdapter';
import { campaignSettingsAdapter } from '@/lib/durableDm/adapters/campaignSettingsAdapter';
import type {
  FamilyManifestHandle,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import {
  fingerprintNpcTombstone,
  npcPayloadFromCampaignNpc,
  NPC_STORAGE_KEY,
  type NpcManifest,
  type NpcPayload,
} from '@/lib/durableDm/npcFamily';
import * as npcLegacyAuthorityModule from '@/lib/durableDm/npcLegacyAuthority';
import { npcAuthorityKey } from '@/lib/durableDm/npcLegacyAuthority';
import * as resumableCloudActivationModule from '@/lib/durableDm/resumableCloudActivation';
import { captureDeviceBackup } from '@/lib/deviceRecovery';
import * as npcAuthorityModule from '@/lib/indexeddb/npcAuthority';
import * as npcMigrationModule from '@/lib/indexeddb/npcMigration';
import {
  IndexedDbNpcRepository,
  type NpcOutboxEntry,
} from '@/lib/indexeddb/npcRepository';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import { readCampaignSettingsAuthority } from '@/lib/indexeddb/campaignSettingsAuthority';
import { IndexedDbCampaignSettingsRepository } from '@/lib/indexeddb/campaignSettingsRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  OBJECT_STORE_NAMES,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import * as browserDmWorkspaceModule from '@/lib/supabase/browserDmWorkspace';
import * as supabaseBrowserModule from '@/lib/supabase/browser';
import { useNPCStore } from '@/store/npcStore';
import { useDmStore } from '@/store/dmStore';
import type { CampaignNPC } from '@/types/encounter';

import type { CardParityHarness } from '../adapterConformance';

const NOW = '2026-08-25T00:00:00.000Z';
const ACCOUNT_ID = '99999999-9999-4999-8999-999999999999';
const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const CAMPAIGN_CODE = 'NPC0001';
const CAMPAIGN_SETTINGS_STORAGE_KEY = 'rollkeeper-dm-data';

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

interface CloudDocument {
  legacyId: string;
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: NpcPayload | null;
}

interface EnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: CloudDocument[];
}

function npcFixture(index: number): CampaignNPC {
  return {
    id: `npc-${index}`,
    campaignCode: CAMPAIGN_CODE,
    name: `Seed NPC ${index}`,
    description: `Seed NPC ${index} description`,
    armorClass: '12',
    maxHp: 10,
    currentHp: 10,
    speed: '30 ft.',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

// `legacyId` matches `localId` exactly, mirroring the production invariant —
// see `harnesses/campaignSettings.tsx`'s and `harnesses/magicItem.tsx`'s
// identical comment.
const ownerWorkspace: DmWorkspaceDocument = {
  namespace: NAMESPACE,
  localId: `legacy:${CAMPAIGN_CODE}`,
  legacyId: `legacy:${CAMPAIGN_CODE}`,
  name: 'Vault',
  creationKind: 'import_fork',
  sourceFingerprint: 'source',
  createdAt: NOW,
  family: 'workspace_identity',
  cloudId: CAMPAIGN_ID,
  displayCode: 'F1E2D3C4B5A6',
  membershipAuthority: 'legacy',
  familyAuthorities: 'legacy',
  liveRuntimeAuthority: 'redis_relay',
  acknowledgedAt: NOW,
};

/**
 * Ruling R3.1: extra members this family's own tests use, beyond the base
 * `ConformanceHarness` Task 7 declares.
 */
export interface NpcConformanceHarness extends CardParityHarness {
  /** Every action string sent to `/api/npc-sync`, live. */
  recordedApiActions(): () => string[];
  /** Seeds an envelope carrying an unclassified field, producing a blocker. */
  seedWithBlocker(): Promise<MigrationRunContext>;
  /** Seeds `count` NPCs instead of the default two. */
  seedWithItems(count: number): Promise<MigrationRunContext>;
  /** The legacy ids sent in the LAST `stage-items` request body, in order. */
  stagedLegacyIds(): string[];
  /** Isolates rollback's server-authority clause. */
  forcePreviewAuthorityMismatch(): void;
  /** Isolates rollback's three preview null-checks. */
  forceIncompleteCloudPreview(): void;
  /**
   * Rewrites one IndexedDB document's `contentFingerprint` without changing
   * its `schemaVersion` — isolates `activateCloud`'s
   * `assertWorkingCopyUnchanged` fingerprint clause from its schemaVersion
   * neighbor.
   */
  corruptWorkingCopyFingerprint(legacyId: string): Promise<void>;
  /**
   * Rewrites one IndexedDB document's `schemaVersion` alone (keeping
   * `contentFingerprint` matching) — isolates `assertWorkingCopyUnchanged`'s
   * schemaVersion clause, which has no counterpart in the card
   * (`NpcSyncControls.hooks.ts`'s own `assertWorkingCopyUnchanged` checks
   * only `contentFingerprint`, `:938-944`) — declared adapter-only, not
   * removed.
   */
  corruptWorkingCopySchemaVersion(legacyId: string): Promise<void>;
  /**
   * Records a download receipt for `manifestHash` WITHOUT verifying it —
   * lets a test prove `prepareIndexedDb`'s `recoveryGate` requires the
   * STRICTER `hasVerifiedDownloadReceipt`, matching
   * `NpcSyncControls.hooks.ts`'s own `prepare()` (`:790-793`).
   */
  recordUnverifiedReceipt(manifestHash: string): Promise<void>;
  /**
   * Returns a COPY of `manifest` with the given `legacyId`'s record (both
   * the flattened `records` entry and the `native.records` entry) marked
   * `tombstoned: true` / `payload: null` — everything else, INCLUDING the
   * top-level `fingerprint`, is left untouched, so `commitLocalCutover`'s
   * `sourceManifestUnchanged` guard (which compares only `fingerprint`) does
   * not reject it. This is the only way to reach the tombstone-derived
   * branches (`operation: record.tombstoned ? 'delete' : 'create'`, the
   * staged `tombstoned` field, and `deletedAt`) at all: a fresh
   * `prepareIndexedDb` manifest is built from the raw legacy envelope, which
   * has no tombstone concept, so no NATURALLY produced first-cutover
   * manifest ever carries one.
   */
  withTombstonedRecord(
    manifest: FamilyManifestHandle,
    legacyId: string
  ): FamilyManifestHandle;
  /** The full persisted IndexedDB document for `legacyId`, or `null`. */
  rawDocument(legacyId: string): Promise<{
    operation: string;
    deletedAt: string | null;
    contentFingerprint: string;
  } | null>;
  /**
   * Commits an EXTRA document directly into IndexedDB through the family's
   * own commit path, without it ever appearing in a manifest — reproduces "a
   * document was added on this browser between preview and staging", the
   * only scenario `assertWorkingCopyUnchanged`'s
   * `actual.size !== manifest.records.length` clause detects (the
   * per-legacyId fingerprint clause cannot: it has nothing in
   * `manifest.records` to compare the extra document against).
   */
  addExtraWorkingCopy(legacyId: string): Promise<void>;
  /**
   * Hard-deletes one document row's underlying IndexedDB record entirely
   * (bypassing the repository's `commit()` soft-tombstone path, which always
   * upserts the same key even for a `'delete'` operation) and commits an
   * unrelated extra document elsewhere, so the total document count still
   * equals `manifest.records.length` — isolating
   * `assertWorkingCopyUnchanged`'s `current === undefined` clause from its
   * record-count neighbor. Confirmed by mutation (task-10-report.md) that a
   * SOFT delete (`deleteWorkingCopy`) never reaches this clause at all —
   * the row survives with a tombstone fingerprint, which the
   * `contentFingerprint` clause catches instead — and that this is also
   * true, unfixed, of `magic_item`'s own shipped suite (Task 9): this
   * clause was a silent surviving mutant there too until this task's
   * mutation pass found it.
   */
  replaceWorkingCopyEntirely(
    missingLegacyId: string,
    extraLegacyId: string
  ): Promise<void>;
  /**
   * Clears the fake server's current generation to zero documents — the
   * discriminating fixture for `rollback`'s unconditional-vs-conditional
   * restore. With ZERO documents, a CONDITIONAL restore
   * (`if (documents.length > 0) { ... }`) leaves whatever the store already
   * held untouched, while the card's actual unconditional restore explicitly
   * clears it to `[]`. Two 2-item fixtures reaching cloud authority first,
   * so there is stale non-empty store state to fail to clear if the guard
   * were conditional.
   */
  emptyCloudGeneration(): void;
  /**
   * Brief's mandated extra test support: seeds BOTH families' legacy state
   * from ONE shared device-recovery bundle (`captureDeviceBackup` snapshots
   * every classified localStorage key at once, so one verified receipt
   * covers both `rollkeeper-npc-data` and `rollkeeper-dm-data`), then drives
   * `campaignSettingsAdapter` through its own full local-cutover chain
   * (select -> prepare -> commit) BEFORE returning — "already migrated"
   * means campaign_settings already holds IndexedDB authority when the NPC
   * chain in the test body runs. Returns the SAME `MigrationRunContext` the
   * NPC chain in the test body then drives — this run's workspace, recovery
   * and account/campaign scope are shared by both families, exactly as the
   * wizard shares one run context across every family it migrates in a
   * single bundle.
   */
  seedWithCampaignSettingsAlreadyMigrated(): Promise<MigrationRunContext>;
  /**
   * A snapshot scoped to ONLY campaign_settings' own persisted state — the
   * `rollkeeper-dm-data` envelope, its authority marker, its IndexedDB
   * document and its IndexedDB authority pointer — never the whole-database
   * snapshot the base harness's `snapshot()` returns. A whole-database
   * snapshot would also change once the NPC chain writes its OWN IndexedDB
   * documents and meta rows, which would make the "untouched" assertion
   * fail for a reason that has nothing to do with campaign_settings.
   */
  campaignSettingsSnapshot(): Promise<string>;
}

export function createNpcHarness(): NpcConformanceHarness {
  vi.restoreAllMocks();

  const trace: string[] = [];
  const apiActionLog: string[] = [];
  let cutoverSink: string[] | null = null;
  let rollbackOrderSink: string[] | null = null;

  let serverAuthority: 'legacy' | 'postgres' = 'legacy';
  let serverEpoch = 0;
  const serverDocuments = new Map<string, CloudDocument>();
  // Isolates rollback's `current.authority !== 'postgres'` clause from its
  // three neighbouring null-checks (mirrors `harnesses/campaignSettings.tsx`
  // and `harnesses/magicItem.tsx`): a REAL "legacy" preview response never
  // carries the other fields either, so `'authority-mismatch'` keeps every
  // other field populated (something only a fake can do) to prove THIS
  // clause alone is load-bearing. `'incomplete'` is the mirror case for the
  // three null-checks: reports `authority: 'postgres'` (so that clause does
  // not fire) but omits every other field.
  let forcedPreviewMode: 'authority-mismatch' | 'incomplete' | null = null;
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
  const allRequestBodiesByAction: Record<string, Record<string, unknown>[]> =
    {};
  const libraryCalls: Record<string, unknown[][]> = {};
  function recordLibraryCall(name: string, args: unknown[]) {
    (libraryCalls[name] ??= []).push(args);
  }

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

  function documentSnapshot(): CloudDocument[] {
    return [...serverDocuments.values()]
      .sort((left, right) => left.legacyId.localeCompare(right.legacyId))
      .map(document => ({ ...document }));
  }

  function previewEnrollment(): EnrollmentPreview {
    if (forcedPreviewMode === 'authority-mismatch') {
      return {
        authority: 'legacy',
        previewFingerprint: 'p'.repeat(64),
        recordCount: serverDocuments.size,
        documents: documentSnapshot(),
      };
    }
    if (forcedPreviewMode === 'incomplete') {
      return { authority: 'postgres', epoch: serverEpoch };
    }
    if (serverAuthority === 'legacy') return { authority: 'legacy' };
    return {
      authority: 'postgres',
      epoch: serverEpoch,
      previewFingerprint: 'p'.repeat(64),
      recordCount: serverDocuments.size,
      documents: documentSnapshot(),
    };
  }

  async function applyAction(
    action: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    switch (action) {
      case 'preview-enrollment':
        return previewEnrollment();
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
            for (const item of items) {
              const existing = serverDocuments.get(item.legacyId);
              serverDocuments.set(item.legacyId, {
                legacyId: item.legacyId,
                serverVersion: (existing?.serverVersion ?? 0) + 1,
                schemaVersion: item.schemaVersion,
                payloadFingerprint: item.payloadFingerprint,
                tombstoned: item.tombstoned ?? false,
                payload: item.tombstoned ? null : (item.payload as NpcPayload),
              });
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
            recordCount: serverDocuments.size,
            documents: documentSnapshot(),
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
      apiActionLog.push(action);

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
  // wrapping the field `runResumableCloudActivation` receives.
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

  const realMarkNpcCloudAuthority = npcAuthorityModule.markNpcCloudAuthority;
  vi.spyOn(npcAuthorityModule, 'markNpcCloudAuthority').mockImplementation(
    async (...args) => {
      trace.push('mark-cloud-authority');
      recordLibraryCall('markNpcCloudAuthority', args);
      return realMarkNpcCloudAuthority(...args);
    }
  );

  const realCommitNpcLocalCutover = npcAuthorityModule.commitNpcLocalCutover;
  vi.spyOn(npcAuthorityModule, 'commitNpcLocalCutover').mockImplementation(
    async (...args) => {
      cutoverSink?.push('cutover');
      recordLibraryCall('commitNpcLocalCutover', args);
      return realCommitNpcLocalCutover(...args);
    }
  );

  const realRollbackNpcLocalAuthority =
    npcAuthorityModule.rollbackNpcLocalAuthority;
  vi.spyOn(npcAuthorityModule, 'rollbackNpcLocalAuthority').mockImplementation(
    async (...args) => {
      recordLibraryCall('rollbackNpcLocalAuthority', args);
      return realRollbackNpcLocalAuthority(...args);
    }
  );

  const realRunNpcIndexedDbMigration =
    npcMigrationModule.runNpcIndexedDbMigration;
  vi.spyOn(npcMigrationModule, 'runNpcIndexedDbMigration').mockImplementation(
    async (...args) => {
      recordLibraryCall('runNpcIndexedDbMigration', args);
      return realRunNpcIndexedDbMigration(...args);
    }
  );

  const realWriteNpcAuthorityMarker =
    npcLegacyAuthorityModule.writeNpcAuthorityMarker;
  vi.spyOn(
    npcLegacyAuthorityModule,
    'writeNpcAuthorityMarker'
  ).mockImplementation((...args) => {
    if (args[2]?.authority === 'postgres') trace.push('write-marker');
    if (args[2]?.authority === 'legacy_restored')
      rollbackOrderSink?.push('marker');
    return realWriteNpcAuthorityMarker(...args);
  });

  async function seedWithRawItems(
    rawItems: Record<string, unknown>[]
  ): Promise<MigrationRunContext> {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
    // See the base `ConformanceHarness`'s "PERSIST-BACKED SEEDING TRAP"
    // comment: seed the persist-backed store FIRST, then write the raw
    // envelope AFTER, so the explicit raw write wins.
    useNPCStore.setState({
      npcsByCampaign: {
        [CAMPAIGN_CODE]: rawItems as unknown as CampaignNPC[],
      },
    });
    localStorage.setItem(
      NPC_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        state: { npcsByCampaign: { [CAMPAIGN_CODE]: rawItems } },
      })
    );
    // `NpcSyncProvider` (unlike `MagicItemSyncControls`/
    // `CampaignSettingsSyncControls`) reads its `campaign` object live from
    // `useDmStore` rather than a prop, so every seed — used by both the
    // adapter path and `runCardThroughFullChain` — carries a matching
    // campaign_settings envelope too. Seeded here, ONCE, so the recovery
    // bundle `captureDeviceBackup` computes just below already includes
    // `rollkeeper-dm-data`: capturing it again later (e.g. from inside
    // `runCardThroughFullChain`, after this function returns) would add a
    // localStorage key this run's `recovery.manifestHash` never covered,
    // and the card's own internal `preview()` — which captures its OWN
    // fresh backup — would then hash a different key set than the adapter
    // path's `context.recovery`, failing the step-parity comparison on
    // `requiredRecoveryManifestHash` for a reason that has nothing to do
    // with either implementation.
    useDmStore.setState({
      campaigns: [
        {
          code: CAMPAIGN_CODE,
          name: 'Vault',
          createdAt: NOW,
          stackableInspiration: true,
        },
      ],
    });
    localStorage.setItem(
      CAMPAIGN_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        state: {
          dmId: 'dm-local',
          campaigns: [
            {
              code: CAMPAIGN_CODE,
              name: 'Vault',
              createdAt: NOW,
              stackableInspiration: true,
            },
          ],
        },
        version: 1,
      })
    );

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
    await npcAdapter.selectFamily(context);
    const prepared = await npcAdapter.prepareIndexedDb(context);
    await npcAdapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
  }

  /** Shared by `addExtraWorkingCopy` and `replaceWorkingCopyEntirely`. */
  async function commitExtraDocument(legacyId: string) {
    const database = await openRollkeeperDatabase();
    try {
      const repository = new IndexedDbNpcRepository(database);
      await repository.commit({
        namespace: NAMESPACE,
        campaignId: CAMPAIGN_ID,
        legacyId,
        cutoverEpoch: 1,
        operation: 'create',
        payload: npcPayloadFromCampaignNpc({
          ...npcFixture(999),
          id: legacyId,
          name: 'Added locally, not in the manifest',
        }),
        schemaVersion: 4,
        localRevision: 1,
        baseServerVersion: 0,
        contentFingerprint: 'extra-working-copy-fingerprint',
        updatedAt: NOW,
      });
    } finally {
      database.close();
    }
  }

  return {
    adapter: npcAdapter,

    seed: () =>
      seedWithRawItems([
        npcFixture(1) as unknown as Record<string, unknown>,
        npcFixture(2) as unknown as Record<string, unknown>,
      ]),
    seedWithBlocker: () =>
      seedWithRawItems([
        {
          ...(npcFixture(1) as unknown as Record<string, unknown>),
          extraField: 'unexpected',
        },
      ]),
    seedWithItems: (count: number) =>
      seedWithRawItems(
        Array.from({ length: count }, (_, index) =>
          npcFixture(index + 1)
        ) as unknown as Record<string, unknown>[]
      ),

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
      const manifest = await npcAdapter.previewManifest(context);
      await npcAdapter.activateCloud(context, manifest);
    },

    failCloud() {
      failNextCall = true;
    },

    trace: () => [...trace],

    seedDeviceId(deviceId) {
      // Matches the adapter's `deviceIdFor('npc', ...)` key prefix, read
      // straight off the shipped card's own persisted key
      // (`NpcSyncControls.hooks.ts:953`, `:1083`, `:1497`:
      // `` `rollkeeper:npc-device:${accountId}:${campaignId}` ``).
      localStorage.setItem(
        `rollkeeper:npc-device:${ACCOUNT_ID}:${CAMPAIGN_ID}`,
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
        const documents = await new IndexedDbNpcRepository(
          database
        ).listDocuments(NAMESPACE, CAMPAIGN_ID);
        const result: Record<string, string> = {};
        for (const document of documents) {
          // Multi-record families drop a deleted item from the observed
          // set entirely, unlike a single-record family, which keeps its
          // one row with `operation: 'delete'`.
          if (document.operation === 'delete') continue;
          result[document.legacyId] = document.contentFingerprint;
        }
        return result;
      } finally {
        database.close();
      }
    },

    async deleteWorkingCopy(legacyId) {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbNpcRepository(database);
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
          contentFingerprint: await fingerprintNpcTombstone(legacyId),
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
          legacyId: 'npc-1',
          family: 'npc',
          mutationId: `test-pending-${crypto.randomUUID()}`,
          cutoverEpoch: 1,
          operation: 'replace',
          payload: null,
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
        } satisfies NpcOutboxEntry);
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
          legacyId: 'npc-1',
          family: 'npc',
          mutationId: `test-acknowledged-${crypto.randomUUID()}`,
          cutoverEpoch: 1,
          operation: 'replace',
          payload: null,
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
        } satisfies NpcOutboxEntry);
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
        const all = (await requestResult(store.getAll())) as NpcOutboxEntry[];
        for (const entry of all) {
          if (
            entry.namespace === NAMESPACE &&
            entry.campaignId === CAMPAIGN_ID &&
            entry.family === 'npc' &&
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
          family: 'npc',
          legacyId: 'npc-1',
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

    async hardDeleteOneDocument() {
      const database = await openRollkeeperDatabase();
      try {
        const documents = await new IndexedDbNpcRepository(
          database
        ).listDocuments(NAMESPACE, CAMPAIGN_ID);
        const target = documents[0];
        if (!target) throw new Error('No document to delete');
        const transaction = database.transaction('documents', 'readwrite');
        transaction
          .objectStore('documents')
          .delete([target.namespace, target.family, target.legacyId]);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    bumpCloudEpoch() {
      serverEpoch += 1;
    },

    seedEmpty: () => seedWithRawItems([]),

    async deleteAuthorityMarker() {
      localStorage.removeItem(npcAuthorityKey(CAMPAIGN_CODE));
    },

    async seedMarkerPointerDisagreement() {
      const context = await this.seed();
      await runChainThroughLocalCutover(context);
      localStorage.removeItem(npcAuthorityKey(CAMPAIGN_CODE));
      return context;
    },

    async seedMarkerAheadOfPointer() {
      const context = await this.seed();
      npcLegacyAuthorityModule.writeNpcAuthorityMarker(
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

    async pointerState() {
      const database = await openRollkeeperDatabase();
      try {
        const pointer = await npcAuthorityModule.readNpcAuthority(
          database,
          NAMESPACE,
          CAMPAIGN_ID
        );
        return pointer.authority;
      } finally {
        database.close();
      }
    },

    async mutateLegacyEnvelope() {
      const raw = localStorage.getItem(NPC_STORAGE_KEY);
      if (!raw) throw new Error('No legacy envelope to mutate');
      const parsed = JSON.parse(raw) as {
        state: {
          npcsByCampaign: Record<
            string,
            { id: string; description?: string }[]
          >;
        };
      };
      const npcs = parsed.state.npcsByCampaign[CAMPAIGN_CODE];
      const npc = npcs?.find(entry => entry.id === 'npc-1');
      if (!npc) throw new Error('Seeded NPC is missing');
      npc.description = `${npc.description ?? ''} (edited)`;
      localStorage.setItem(NPC_STORAGE_KEY, JSON.stringify(parsed));
    },

    /**
     * Reads the PERSISTED `rollkeeper-npc-data` envelope directly (never the
     * in-memory `useNPCStore` state, and never IndexedDB) — this is what
     * makes the marker-before-restore write ORDER observable at all. `npc`
     * is a multi-record family, so this returns the whole ordered LIST
     * persisted for `CAMPAIGN_CODE` (`[]` if absent), matching how
     * `applyNpcDocuments` writes it.
     */
    async readLegacyStorePayload() {
      const raw = localStorage.getItem(NPC_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as {
        state?: { npcsByCampaign?: Record<string, unknown[]> };
      };
      return parsed.state?.npcsByCampaign?.[CAMPAIGN_CODE] ?? [];
    },

    /**
     * Mutates the fake server's own current generation across all three
     * `applyNpcDocuments` branches, reproducing "edits made during the
     * migrated period" on more than one document and one field:
     *   - `npc-1`'s payload changes (the update branch);
     *   - `npc-2` is tombstoned in the diverged generation, having been live
     *     in the migrated one (the delete/tombstone branch);
     *   - `npc-added-elsewhere` exists in the diverged generation only,
     *     absent from the migrated one (the added branch).
     */
    async divergeCloudGeneration() {
      const npc1 = serverDocuments.get('npc-1');
      if (!npc1) throw new Error('Expected npc-1 in the cloud generation');
      serverDocuments.set('npc-1', {
        ...npc1,
        serverVersion: npc1.serverVersion + 1,
        payloadFingerprint: 'd'.repeat(64),
        payload: {
          ...(npc1.payload as NpcPayload),
          name: 'Edited on another device',
        },
      });
      const npc2 = serverDocuments.get('npc-2');
      if (npc2) {
        serverDocuments.set('npc-2', {
          ...npc2,
          serverVersion: npc2.serverVersion + 1,
          tombstoned: true,
          payload: null,
          payloadFingerprint: 'e'.repeat(64),
        });
      }
      serverDocuments.set('npc-added-elsewhere', {
        legacyId: 'npc-added-elsewhere',
        serverVersion: 1,
        schemaVersion: 1,
        payloadFingerprint: 'f'.repeat(64),
        tombstoned: false,
        payload: npcPayloadFromCampaignNpc({
          ...npcFixture(999),
          id: 'npc-added-elsewhere',
          name: 'Added on another device',
        }),
      });
    },

    /**
     * The fake server's OWN record of what `currentGeneration.documents`
     * projects into the legacy store right now, independent of anything the
     * adapter did with it — computed straight from `serverDocuments`, NEVER
     * imported from `npcFamily.ts` (`campaignNpcFromPayload`/`sortNpcs`, the
     * functions the adapter itself uses to build its restore) — restating
     * the projection here, not sharing the adapter's own oracle (ruling
     * R8.4's self-fulfilling-fake pattern).
     */
    expectedLegacyStoreAfterRollback: () => {
      const npcs = documentSnapshot()
        .filter(document => document.payload && !document.tombstoned)
        .map(document => ({
          ...(document.payload as NpcPayload),
          id: document.legacyId,
          campaignCode: CAMPAIGN_CODE,
        }));
      return [...npcs].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id)
      );
    },

    recordRollbackOrderInto(sink: string[]) {
      rollbackOrderSink = sink;
      const realSetState = useNPCStore.setState;
      vi.spyOn(useNPCStore, 'setState').mockImplementation(
        (...args: Parameters<typeof realSetState>) => {
          sink.push('store');
          return (realSetState as (...a: unknown[]) => unknown)(...args);
        }
      );
    },

    // -----------------------------------------------------------------
    // Family-local extensions (ruling R3.1).
    // -----------------------------------------------------------------

    recordedApiActions() {
      return () => [...apiActionLog];
    },

    stagedLegacyIds() {
      const last = recorded.stageItems.at(-1);
      const items = (last?.items ?? []) as StagedItem[];
      return items.map(item => item.legacyId);
    },

    forcePreviewAuthorityMismatch() {
      forcedPreviewMode = 'authority-mismatch';
    },

    forceIncompleteCloudPreview() {
      forcedPreviewMode = 'incomplete';
    },

    async corruptWorkingCopyFingerprint(legacyId: string) {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbNpcRepository(database);
        const current = await repository.getDocument(NAMESPACE, legacyId);
        if (!current) throw new Error('No working copy to corrupt');
        await repository.commit({
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          legacyId,
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

    async corruptWorkingCopySchemaVersion(legacyId: string) {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbNpcRepository(database);
        const current = await repository.getDocument(NAMESPACE, legacyId);
        if (!current) throw new Error('No working copy to corrupt');
        await repository.commit({
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          legacyId,
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

    async recordUnverifiedReceipt(manifestHash) {
      await browserRecoveryRepository.recordDownloadReceipt({
        runId: crypto.randomUUID(),
        manifestHash,
        initiatedAt: NOW,
      });
    },

    withTombstonedRecord(manifest, legacyId) {
      const clone = structuredClone(
        manifest
      ) as FamilyManifestHandle<NpcManifest>;
      const record = clone.records.find(entry => entry.legacyId === legacyId);
      if (!record) throw new Error(`No manifest record for ${legacyId}`);
      record.tombstoned = true;
      const nativeRecord = clone.native.records.find(
        entry => entry.legacyId === legacyId
      );
      if (nativeRecord) {
        nativeRecord.tombstoned = true;
        nativeRecord.payload = null;
      }
      return clone as FamilyManifestHandle;
    },

    async rawDocument(legacyId) {
      const database = await openRollkeeperDatabase();
      try {
        return await new IndexedDbNpcRepository(database).getDocument(
          NAMESPACE,
          legacyId
        );
      } finally {
        database.close();
      }
    },

    async addExtraWorkingCopy(legacyId) {
      await commitExtraDocument(legacyId);
    },

    async replaceWorkingCopyEntirely(missingLegacyId, extraLegacyId) {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('documents', 'readwrite');
        transaction
          .objectStore('documents')
          .delete([NAMESPACE, 'npc', missingLegacyId]);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
      await commitExtraDocument(extraLegacyId);
    },

    emptyCloudGeneration() {
      serverDocuments.clear();
    },

    async seedWithCampaignSettingsAlreadyMigrated() {
      // `seedWithRawItems` already seeds BOTH families' legacy state and
      // captures/verifies ONE device-recovery bundle covering both
      // (`captureDeviceBackup` snapshots every classified localStorage key
      // at once) — see its own doc comment. Only campaign_settings' own
      // local-cutover chain is driven here; "already migrated" means it
      // already holds IndexedDB authority by the time the test body's own
      // NPC chain runs.
      const context = await seedWithRawItems([
        npcFixture(1) as unknown as Record<string, unknown>,
        npcFixture(2) as unknown as Record<string, unknown>,
      ]);
      await campaignSettingsAdapter.selectFamily(context);
      const prepared = await campaignSettingsAdapter.prepareIndexedDb(context);
      await campaignSettingsAdapter.commitLocalCutover(context, {
        generation: prepared.generation,
        manifest: prepared.manifest,
      });
      return context;
    },

    async campaignSettingsSnapshot() {
      const raw = localStorage.getItem(CAMPAIGN_SETTINGS_STORAGE_KEY);
      const markerRaw = localStorage.getItem(
        `rollkeeper:campaign-settings-projection-authority:${CAMPAIGN_CODE}`
      );
      const database = await openRollkeeperDatabase();
      try {
        const document = await new IndexedDbCampaignSettingsRepository(
          database
        ).getDocument(NAMESPACE, CAMPAIGN_CODE);
        const pointer = await readCampaignSettingsAuthority(
          database,
          NAMESPACE,
          CAMPAIGN_ID
        );
        return JSON.stringify({ raw, markerRaw, document, pointer });
      } finally {
        database.close();
      }
    },

    // -----------------------------------------------------------------
    // Coordinator review of Task 12, Important 1 (slice-level fix):
    // `verifyCloud`'s R8 comparisons, added to the shared base interface.
    // -----------------------------------------------------------------

    async divergeVerifiedFingerprint() {
      await this.corruptWorkingCopyFingerprint('npc-1');
    },

    async divergeVerifiedSchemaVersion() {
      await this.corruptWorkingCopySchemaVersion('npc-1');
    },

    async divergeVerifiedTombstoneFlag() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('documents', 'readwrite');
        const store = transaction.objectStore('documents');
        const key = [NAMESPACE, 'npc', 'npc-1'];
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

    // An EXTRA local document (what `addExtraWorkingCopy` would add) is
    // already caught by the per-document `cloud !== undefined` check inside
    // `.every()` even with the length clause deleted (verified directly:
    // mutating the length clause away left an add-based fixture's test
    // green) — only a document that exists in the cloud but is ABSENT
    // locally is unreachable by `.every()`, which iterates the LOCAL
    // documents only, so removing one is what actually isolates this
    // clause. Hard-deletes the row (bypassing `commit()`, which would keep
    // it as a soft-tombstoned row the cloud comparison would still see and
    // catch via the fingerprint/tombstone clauses instead) — TEST-ONLY.
    async divergeVerifiedRecordCount() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('documents', 'readwrite');
        transaction
          .objectStore('documents')
          .delete([NAMESPACE, 'npc', 'npc-2']);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    // -----------------------------------------------------------------
    // Card/adapter step-parity test support.
    // -----------------------------------------------------------------

    /**
     * Renders the SHIPPED `NpcSyncControls` card and drives it, by clicking
     * its own buttons, through discovery -> select -> preview -> download
     * recovery file -> verify (via a re-uploaded File built from the
     * downloaded Blob) and select -> prepare -> confirm local cutover ->
     * activate cloud -> verified rollback. Every library call the card
     * makes along the way is captured by the SAME spies
     * `recordedLibraryCalls()` and `allCloudRequestBodies()` expose for the
     * adapter.
     *
     * Named, expected differences from the adapter's own chain:
     *   - the card discovers and selects a workspace interactively; the
     *     adapter receives an already-selected `MigrationRunContext`.
     *   - the card uses `window.confirm`; the adapter has none (spec R12).
     *   - the card has no `verifyCloud` equivalent (adapter-only, per R1).
     *   - mutation ids are random (`crypto.randomUUID()`) on the card and
     *     deterministic on the adapter.
     *   - `acceptedVersions[].serverVersion` is hardcoded `1` for every
     *     record on the card (`NpcSyncControls.hooks.ts:999-1003`) vs
     *     computed from the server's response on the adapter — declared
     *     centrally in `adapterConformance.ts`'s `describeCardParity`
     *     (Minor item 6), not re-declared here.
     *   - `assertWorkingCopyUnchanged`'s `schemaVersion` clause has no card
     *     counterpart (adapter-only) — see
     *     `corruptWorkingCopySchemaVersion`'s doc comment above.
     *   - `previewManifest`'s working-copy branch does no per-document
     *     fingerprint re-verification against `contentFingerprint` on
     *     EITHER side — see `npcAdapter.ts`'s `previewManifest` doc
     *     comment; this is not a divergence, it is shared behaviour absent
     *     from both.
     *   - the card's `rollback()` request body names the manifest field
     *     `previewFingerprint`, not `manifestFingerprint` — mirrored exactly
     *     in the adapter, so this is NOT a divergence either.
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
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: ACCOUNT_ID } } },
          }),
          onAuthStateChange: vi.fn().mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
          }),
        },
      } as never);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const createObjectURL = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:npc-recovery');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        () => undefined
      );

      // `NpcSyncControls` takes no `campaign` prop — unlike
      // `MagicItemSyncControls`/`CampaignSettingsSyncControls`, it reads its
      // controller from `NpcSyncProvider`'s React context, and the provider
      // itself reads the `campaign` object live from `useDmStore` by
      // `campaignCode` (`NpcSyncProvider.tsx:21-31`). `seedWithRawItems`
      // already seeded a matching `useDmStore` campaign entry (see its own
      // doc comment on why that seeding cannot happen here instead).
      render(
        <NpcSyncProvider campaignCode={CAMPAIGN_CODE}>
          <NpcSyncControls />
        </NpcSyncProvider>
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Find owner workspaces' })
      );
      fireEvent.click(
        await screen.findByRole('button', { name: /Select Vault/ })
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Preview exact manifest' })
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Download recovery file' })
      );
      await screen.findByText(/Reopen that file here before selection/);
      const downloadedBlob = createObjectURL.mock.calls[0]![0] as Blob;
      fireEvent.change(screen.getByLabelText('Downloaded NPC recovery file'), {
        target: {
          files: [
            new File([await downloadedBlob.text()], 'npc-backup.json', {
              type: 'application/json',
            }),
          ],
        },
      });
      await screen.findByText(
        'Recovery file verified and NPCs selected. LocalStorage remains authoritative.'
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Prepare IndexedDB' })
      );
      await screen.findByText(
        'IndexedDB preparation validated and reopened. Final confirmation is still required.'
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirm local cutover' })
      );
      await screen.findByText(/IndexedDB authority epoch/);
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

    recordedLibraryCalls: () => ({ ...libraryCalls }),

    allCloudRequestBodies: () => ({ ...allRequestBodiesByAction }),

    currentMarkerRaw() {
      const raw = localStorage.getItem(npcAuthorityKey(CAMPAIGN_CODE));
      return raw ? (JSON.parse(raw) as unknown) : null;
    },
  };
}
