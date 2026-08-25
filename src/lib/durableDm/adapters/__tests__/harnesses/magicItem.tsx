import 'fake-indexeddb/auto';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { MagicItemSyncControls } from '@/components/ui/campaign/MagicItemLibrary/MagicItemSyncControls';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import { magicItemAdapter } from '@/lib/durableDm/adapters/magicItemAdapter';
import type {
  FamilyManifestHandle,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import {
  fingerprintMagicItemTombstone,
  MAGIC_ITEM_STORAGE_KEY,
  type MagicItemManifest,
  type MagicItemPayload,
} from '@/lib/durableDm/magicItemFamily';
import * as magicItemLegacyAuthorityModule from '@/lib/durableDm/magicItemLegacyAuthority';
import { magicItemAuthorityKey } from '@/lib/durableDm/magicItemLegacyAuthority';
import * as resumableCloudActivationModule from '@/lib/durableDm/resumableCloudActivation';
import { captureDeviceBackup } from '@/lib/deviceRecovery';
import * as magicItemAuthorityModule from '@/lib/indexeddb/magicItemAuthority';
import * as magicItemMigrationModule from '@/lib/indexeddb/magicItemMigration';
import {
  IndexedDbMagicItemRepository,
  type MagicItemOutboxEntry,
} from '@/lib/indexeddb/magicItemRepository';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  OBJECT_STORE_NAMES,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import * as browserDmWorkspaceModule from '@/lib/supabase/browserDmWorkspace';
import * as supabaseBrowserModule from '@/lib/supabase/browser';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import type { CustomMagicItem } from '@/types/magicItemLibrary';

import type { CardParityHarness } from '../adapterConformance';

const NOW = '2026-08-25T00:00:00.000Z';
const ACCOUNT_ID = '77777777-7777-4777-8777-777777777777';
const CAMPAIGN_ID = '88888888-8888-4888-8888-888888888888';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const CAMPAIGN_CODE = 'MGI0001';

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
  payload: MagicItemPayload | null;
}

interface EnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: CloudDocument[];
}

function itemFixture(index: number): CustomMagicItem {
  return {
    id: `item-${index}`,
    campaignCode: CAMPAIGN_CODE,
    name: `Seed item ${index}`,
    category: 'wondrous',
    rarity: 'uncommon',
    description: `Seed item ${index} description`,
    properties: [],
    requiresAttunement: false,
    isAttuned: false,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function itemPayload(item: CustomMagicItem): MagicItemPayload {
  const { id, campaignCode, ...payload } = item;
  void id;
  void campaignCode;
  return payload;
}

// `legacyId` matches `localId` exactly, mirroring the production invariant —
// see `harnesses/campaignSettings.tsx`'s identical comment.
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
  displayCode: 'F6E5D4C3B2A1',
  membershipAuthority: 'legacy',
  familyAuthorities: 'legacy',
  liveRuntimeAuthority: 'redis_relay',
  acknowledgedAt: NOW,
};

const CAMPAIGN_INFO = { code: CAMPAIGN_CODE, name: 'Vault', createdAt: NOW };

/**
 * Ruling R3.1: extra members this family's own tests use, beyond the base
 * `ConformanceHarness` Task 7 declares.
 */
export interface MagicItemConformanceHarness extends CardParityHarness {
  /** Every action string sent to `/api/magic-item-sync`, live. */
  recordedApiActions(): () => string[];
  /** Seeds an envelope carrying an unclassified field, producing a blocker. */
  seedWithBlocker(): Promise<MigrationRunContext>;
  /** Seeds `count` library items instead of the default two. */
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
   * (`MagicItemSyncControls.tsx`'s own `assertWorkingCopyUnchanged` checks
   * only `contentFingerprint`, `:950-955`) — declared adapter-only, not
   * removed.
   */
  corruptWorkingCopySchemaVersion(legacyId: string): Promise<void>;
  /**
   * Records a download receipt for `manifestHash` WITHOUT verifying it —
   * lets a test prove `prepareIndexedDb`'s `recoveryGate` requires the
   * STRICTER `hasVerifiedDownloadReceipt`, matching
   * `MagicItemSyncControls.tsx`'s own `prepare()` (`:804-807`).
   */
  recordUnverifiedReceipt(manifestHash: string): Promise<void>;
  /**
   * Task 9 fix round 1, Important 2: returns a COPY of `manifest` with the
   * given `legacyId`'s record (both the flattened `records` entry and the
   * `native.records` entry) marked `tombstoned: true` / `payload: null` —
   * everything else, INCLUDING the top-level `fingerprint`, is left
   * untouched, so `commitLocalCutover`'s `sourceManifestUnchanged` guard
   * (which compares only `fingerprint`) does not reject it. This is the
   * only way to reach the tombstone-derived branches
   * (`operation: record.tombstoned ? 'delete' : 'create'`, the staged
   * `tombstoned` field, and `deletedAt`) at all: a fresh
   * `prepareIndexedDb` manifest is built from the raw legacy envelope,
   * which has no tombstone concept, so no NATURALLY produced first-cutover
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
   * Task 9 fix round 1, Important 3: commits an EXTRA document directly
   * into IndexedDB through the family's own commit path, without it ever
   * appearing in a manifest — reproduces "a document was added on this
   * browser between preview and staging", the only scenario
   * `assertWorkingCopyUnchanged`'s `actual.size !== manifest.records.length`
   * clause detects (the per-legacyId fingerprint clause cannot: it has
   * nothing in `manifest.records` to compare the extra document against).
   */
  addExtraWorkingCopy(legacyId: string): Promise<void>;
  /**
   * Fix round 1 (coordinator review of Task 10): hard-deletes one document
   * row's underlying IndexedDB record entirely (bypassing the repository's
   * `commit()` soft-tombstone path, which always upserts the same key even
   * for a `'delete'` operation) and commits an unrelated extra document
   * elsewhere, so the total document count still equals
   * `manifest.records.length` — isolating `assertWorkingCopyUnchanged`'s
   * `current === undefined` clause from its record-count neighbor. This
   * clause was a silent surviving mutant here (killing it alone left all 39
   * tests green) until this fixture and its test were added — the exact gap
   * Task 10's `npc` harness found and closed for itself first
   * (`harnesses/npc.tsx`'s identical `replaceWorkingCopyEntirely`).
   */
  replaceWorkingCopyEntirely(
    missingLegacyId: string,
    extraLegacyId: string
  ): Promise<void>;
  /**
   * Task 9 fix round 1, Important 4: clears the fake server's current
   * generation to zero documents — the discriminating fixture for
   * `rollback`'s unconditional-vs-conditional restore. With ZERO documents,
   * a CONDITIONAL restore (`if (documents.length > 0) { ... }`) leaves
   * whatever the store already held untouched, while the card's actual
   * unconditional restore explicitly clears it to `[]`. Two 2-item
   * fixtures reaching cloud authority first, so there is stale non-empty
   * store state to fail to clear if the guard were conditional.
   */
  emptyCloudGeneration(): void;
}

export function createMagicItemHarness(): MagicItemConformanceHarness {
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
  // and `harnesses/calendar.tsx`): a REAL "legacy" preview response never
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
                payload: item.tombstoned
                  ? null
                  : (item.payload as MagicItemPayload),
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

  const realMarkMagicItemCloudAuthority =
    magicItemAuthorityModule.markMagicItemCloudAuthority;
  vi.spyOn(
    magicItemAuthorityModule,
    'markMagicItemCloudAuthority'
  ).mockImplementation(async (...args) => {
    trace.push('mark-cloud-authority');
    recordLibraryCall('markMagicItemCloudAuthority', args);
    return realMarkMagicItemCloudAuthority(...args);
  });

  const realCommitMagicItemLocalCutover =
    magicItemAuthorityModule.commitMagicItemLocalCutover;
  vi.spyOn(
    magicItemAuthorityModule,
    'commitMagicItemLocalCutover'
  ).mockImplementation(async (...args) => {
    cutoverSink?.push('cutover');
    recordLibraryCall('commitMagicItemLocalCutover', args);
    return realCommitMagicItemLocalCutover(...args);
  });

  const realRollbackMagicItemLocalAuthority =
    magicItemAuthorityModule.rollbackMagicItemLocalAuthority;
  vi.spyOn(
    magicItemAuthorityModule,
    'rollbackMagicItemLocalAuthority'
  ).mockImplementation(async (...args) => {
    recordLibraryCall('rollbackMagicItemLocalAuthority', args);
    return realRollbackMagicItemLocalAuthority(...args);
  });

  const realRunMagicItemIndexedDbMigration =
    magicItemMigrationModule.runMagicItemIndexedDbMigration;
  vi.spyOn(
    magicItemMigrationModule,
    'runMagicItemIndexedDbMigration'
  ).mockImplementation(async (...args) => {
    recordLibraryCall('runMagicItemIndexedDbMigration', args);
    return realRunMagicItemIndexedDbMigration(...args);
  });

  const realWriteMagicItemAuthorityMarker =
    magicItemLegacyAuthorityModule.writeMagicItemAuthorityMarker;
  vi.spyOn(
    magicItemLegacyAuthorityModule,
    'writeMagicItemAuthorityMarker'
  ).mockImplementation((...args) => {
    if (args[2]?.authority === 'postgres') trace.push('write-marker');
    if (args[2]?.authority === 'legacy_restored')
      rollbackOrderSink?.push('marker');
    return realWriteMagicItemAuthorityMarker(...args);
  });

  async function seedWithRawItems(
    rawItems: Record<string, unknown>[]
  ): Promise<MigrationRunContext> {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
    // See the base `ConformanceHarness`'s "PERSIST-BACKED SEEDING TRAP"
    // comment: seed the persist-backed store FIRST, then write the raw
    // envelope AFTER, so the explicit raw write wins.
    useMagicItemLibraryStore.setState({
      itemsByCampaign: {
        [CAMPAIGN_CODE]: rawItems as unknown as CustomMagicItem[],
      },
    });
    localStorage.setItem(
      MAGIC_ITEM_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: { itemsByCampaign: { [CAMPAIGN_CODE]: rawItems } },
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
    await magicItemAdapter.selectFamily(context);
    const prepared = await magicItemAdapter.prepareIndexedDb(context);
    await magicItemAdapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
  }

  /**
   * Shared by `addExtraWorkingCopy` and `replaceWorkingCopyEntirely` (fix
   * round 1, coordinator review of Task 10).
   */
  async function commitExtraDocument(legacyId: string) {
    const database = await openRollkeeperDatabase();
    try {
      const repository = new IndexedDbMagicItemRepository(database);
      await repository.commit({
        namespace: NAMESPACE,
        campaignId: CAMPAIGN_ID,
        legacyId,
        cutoverEpoch: 1,
        operation: 'create',
        payload: itemPayload({
          ...itemFixture(999),
          id: legacyId,
          name: 'Added locally, not in the manifest',
        }),
        schemaVersion: 1,
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
    adapter: magicItemAdapter,

    seed: () =>
      seedWithRawItems([
        itemFixture(1) as unknown as Record<string, unknown>,
        itemFixture(2) as unknown as Record<string, unknown>,
      ]),
    seedWithBlocker: () =>
      seedWithRawItems([
        {
          ...(itemFixture(1) as unknown as Record<string, unknown>),
          extraField: 'unexpected',
        },
      ]),
    seedWithItems: (count: number) =>
      seedWithRawItems(
        Array.from({ length: count }, (_, index) =>
          itemFixture(index + 1)
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
      const manifest = await magicItemAdapter.previewManifest(context);
      await magicItemAdapter.activateCloud(context, manifest);
    },

    failCloud() {
      failNextCall = true;
    },

    trace: () => [...trace],

    seedDeviceId(deviceId) {
      // Matches the adapter's `deviceIdFor('magic-item', ...)` key prefix,
      // read straight off the shipped card's own persisted key
      // (`MagicItemSyncControls.tsx:965`, `:1093`, `:1510`:
      // `` `rollkeeper:magic-item-device:${accountId}:${campaignId}` ``).
      localStorage.setItem(
        `rollkeeper:magic-item-device:${ACCOUNT_ID}:${CAMPAIGN_ID}`,
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
        const documents = await new IndexedDbMagicItemRepository(
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
        const repository = new IndexedDbMagicItemRepository(database);
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
          contentFingerprint: await fingerprintMagicItemTombstone(legacyId),
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
          legacyId: 'item-1',
          family: 'magic_item',
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
        } satisfies MagicItemOutboxEntry);
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
          legacyId: 'item-1',
          family: 'magic_item',
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
        } satisfies MagicItemOutboxEntry);
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
          legacyId: 'item-1',
          family: 'magic_item',
          mutationId: `test-superseded-${crypto.randomUUID()}`,
          cutoverEpoch: 1,
          operation: 'replace',
          payload: null,
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
        } satisfies MagicItemOutboxEntry);
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
        )) as MagicItemOutboxEntry[];
        for (const entry of all) {
          if (
            entry.namespace === NAMESPACE &&
            entry.campaignId === CAMPAIGN_ID &&
            entry.family === 'magic_item' &&
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
          family: 'magic_item',
          legacyId: 'item-1',
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
          family: 'magic_item',
          legacyId: 'item-1',
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

    async hardDeleteOneDocument() {
      const database = await openRollkeeperDatabase();
      try {
        const documents = await new IndexedDbMagicItemRepository(
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
      localStorage.removeItem(magicItemAuthorityKey(CAMPAIGN_CODE));
    },

    async seedMarkerPointerDisagreement() {
      const context = await this.seed();
      await runChainThroughLocalCutover(context);
      localStorage.removeItem(magicItemAuthorityKey(CAMPAIGN_CODE));
      return context;
    },

    async seedMarkerAheadOfPointer() {
      const context = await this.seed();
      magicItemLegacyAuthorityModule.writeMagicItemAuthorityMarker(
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
        const pointer = await magicItemAuthorityModule.readMagicItemAuthority(
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
      const raw = localStorage.getItem(MAGIC_ITEM_STORAGE_KEY);
      if (!raw) throw new Error('No legacy envelope to mutate');
      const parsed = JSON.parse(raw) as {
        state: {
          itemsByCampaign: Record<
            string,
            { id: string; description?: string }[]
          >;
        };
      };
      const items = parsed.state.itemsByCampaign[CAMPAIGN_CODE];
      const item = items?.find(entry => entry.id === 'item-1');
      if (!item) throw new Error('Seeded magic item is missing');
      item.description = `${item.description ?? ''} (edited)`;
      localStorage.setItem(MAGIC_ITEM_STORAGE_KEY, JSON.stringify(parsed));
    },

    /**
     * Reads the PERSISTED `rollkeeper-dm-magic-item-library` envelope
     * directly (never the in-memory `useMagicItemLibraryStore` state, and
     * never IndexedDB) — this is what makes the marker-before-restore write
     * ORDER observable at all. `magic_item` is a multi-record family, so
     * this returns the whole ordered LIST persisted for `CAMPAIGN_CODE`
     * (`[]` if absent), matching how `applyMagicItemDocuments` writes it.
     */
    async readLegacyStorePayload() {
      const raw = localStorage.getItem(MAGIC_ITEM_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as {
        state?: { itemsByCampaign?: Record<string, unknown[]> };
      };
      return parsed.state?.itemsByCampaign?.[CAMPAIGN_CODE] ?? [];
    },

    /**
     * Mutates the fake server's own current generation across all three
     * `apply*Documents` branches, reproducing "edits made during the
     * migrated period" on more than one document and one field:
     *   - `item-1`'s payload changes (the update branch);
     *   - `item-2` is tombstoned in the diverged generation, having been
     *     live in the migrated one (the delete/tombstone branch);
     *   - `item-added-elsewhere` exists in the diverged generation only,
     *     absent from the migrated one (the added branch).
     */
    async divergeCloudGeneration() {
      const item1 = serverDocuments.get('item-1');
      if (!item1) throw new Error('Expected item-1 in the cloud generation');
      serverDocuments.set('item-1', {
        ...item1,
        serverVersion: item1.serverVersion + 1,
        payloadFingerprint: 'd'.repeat(64),
        payload: {
          ...(item1.payload as MagicItemPayload),
          name: 'Edited on another device',
        },
      });
      const item2 = serverDocuments.get('item-2');
      if (item2) {
        serverDocuments.set('item-2', {
          ...item2,
          serverVersion: item2.serverVersion + 1,
          tombstoned: true,
          payload: null,
          payloadFingerprint: 'e'.repeat(64),
        });
      }
      serverDocuments.set('item-added-elsewhere', {
        legacyId: 'item-added-elsewhere',
        serverVersion: 1,
        schemaVersion: 1,
        payloadFingerprint: 'f'.repeat(64),
        tombstoned: false,
        payload: itemPayload({
          ...itemFixture(999),
          id: 'item-added-elsewhere',
          name: 'Added on another device',
        }),
      });
    },

    /**
     * The fake server's OWN record of what `currentGeneration.documents`
     * projects into the legacy store right now, independent of anything the
     * adapter did with it — computed straight from `serverDocuments`, NEVER
     * imported from `magicItemFamily.ts` or `MagicItemSyncControls.tsx` (the
     * modules the adapter itself imports/mirrors to build its restore) —
     * restating the projection here, not sharing the adapter's own oracle
     * (ruling R8.4's self-fulfilling-fake pattern).
     */
    expectedLegacyStoreAfterRollback: () => {
      const items = documentSnapshot()
        .filter(document => document.payload && !document.tombstoned)
        .map(document => ({
          ...(document.payload as MagicItemPayload),
          id: document.legacyId,
          campaignCode: CAMPAIGN_CODE,
        }));
      return [...items].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id)
      );
    },

    recordRollbackOrderInto(sink: string[]) {
      rollbackOrderSink = sink;
      const realSetState = useMagicItemLibraryStore.setState;
      vi.spyOn(useMagicItemLibraryStore, 'setState').mockImplementation(
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
        const repository = new IndexedDbMagicItemRepository(database);
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
        const repository = new IndexedDbMagicItemRepository(database);
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
      ) as FamilyManifestHandle<MagicItemManifest>;
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
        return await new IndexedDbMagicItemRepository(database).getDocument(
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
          .delete([NAMESPACE, 'magic_item', missingLegacyId]);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
      await commitExtraDocument(extraLegacyId);
    },

    emptyCloudGeneration() {
      serverDocuments.clear();
    },

    // -----------------------------------------------------------------
    // Coordinator review of Task 12, Important 1 (slice-level fix):
    // `verifyCloud`'s R8 comparisons, added to the shared base interface.
    // -----------------------------------------------------------------

    async divergeVerifiedFingerprint() {
      await this.corruptWorkingCopyFingerprint('item-1');
    },

    async divergeVerifiedSchemaVersion() {
      await this.corruptWorkingCopySchemaVersion('item-1');
    },

    async divergeVerifiedTombstoneFlag() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('documents', 'readwrite');
        const store = transaction.objectStore('documents');
        const key = [NAMESPACE, 'magic_item', 'item-1'];
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
          .delete([NAMESPACE, 'magic_item', 'item-2']);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    // -----------------------------------------------------------------
    // Card/adapter step-parity test support.
    // -----------------------------------------------------------------

    /**
     * Renders the SHIPPED `MagicItemSyncControls` card and drives it, by
     * clicking its own buttons, through discovery -> select -> preview ->
     * download recovery file -> verify (via a re-uploaded File built from
     * the downloaded Blob) and select -> prepare -> confirm local cutover ->
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
     *     record on the card (`MagicItemSyncControls.tsx:1013`) vs computed
     *     from the server's response on the adapter — declared centrally in
     *     `adapterConformance.ts`'s `describeCardParity` (Minor item 6), not
     *     re-declared here.
     *   - `assertWorkingCopyUnchanged`'s `schemaVersion` clause has no card
     *     counterpart (adapter-only) — see
     *     `corruptWorkingCopySchemaVersion`'s doc comment above.
     *   - `previewManifest`'s working-copy branch does no per-document
     *     fingerprint re-verification against `contentFingerprint` on
     *     EITHER side — see `magicItemAdapter.ts`'s `previewManifest` doc
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
        .mockReturnValue('blob:magic-item-recovery');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        () => undefined
      );

      render(<MagicItemSyncControls campaign={CAMPAIGN_INFO} />);
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
      fireEvent.change(
        screen.getByLabelText('Downloaded magic item recovery file'),
        {
          target: {
            files: [
              new File(
                [await downloadedBlob.text()],
                'magic-item-backup.json',
                { type: 'application/json' }
              ),
            ],
          },
        }
      );
      await screen.findByText(
        'Recovery file verified and magic item library selected. LocalStorage remains authoritative.'
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
      const raw = localStorage.getItem(magicItemAuthorityKey(CAMPAIGN_CODE));
      return raw ? (JSON.parse(raw) as unknown) : null;
    },
  };
}
