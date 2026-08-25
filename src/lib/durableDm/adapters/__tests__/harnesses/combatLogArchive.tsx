import 'fake-indexeddb/auto';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import {
  CombatLogArchiveSyncControls,
  CombatLogArchiveSyncProvider,
} from '@/components/ui/campaign/CombatLogArchiveSyncControls';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import { combatLogArchiveAdapter } from '@/lib/durableDm/adapters/combatLogArchiveAdapter';
import type {
  FamilyManifestHandle,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import {
  combatLogArchivePayloadFrom,
  fingerprintCombatLogArchiveTombstone,
  COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
  type CombatLogArchiveManifest,
  type CombatLogArchivePayload,
} from '@/lib/durableDm/combatLogArchiveFamily';
import * as combatLogArchiveLegacyAuthorityModule from '@/lib/durableDm/combatLogArchiveLegacyAuthority';
import { combatLogArchiveAuthorityKey } from '@/lib/durableDm/combatLogArchiveLegacyAuthority';
import * as resumableCloudActivationModule from '@/lib/durableDm/resumableCloudActivation';
import { captureDeviceBackup } from '@/lib/deviceRecovery';
import * as combatLogArchiveAuthorityModule from '@/lib/indexeddb/combatLogArchiveAuthority';
import * as combatLogArchiveMigrationModule from '@/lib/indexeddb/combatLogArchiveMigration';
import {
  IndexedDbCombatLogArchiveRepository,
  type CombatLogArchiveOutboxEntry,
} from '@/lib/indexeddb/combatLogArchiveRepository';
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
import { useCombatLogStore } from '@/store/combatLogStore';
import { useDmStore } from '@/store/dmStore';
import { COMBAT_LOG_STORAGE_KEY } from '@/utils/constants';

import type { CardParityHarness } from '../adapterConformance';

const NOW = '2026-08-25T00:00:00.000Z';
const ACCOUNT_ID = '99999999-9999-4999-8999-999999999999';
const OTHER_ACCOUNT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAMPAIGN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const CAMPAIGN_CODE = 'CLA0001';

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
  payload: CombatLogArchivePayload | null;
}

interface EnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: CloudDocument[];
}

function archiveFixture(index: number): CombatLogArchivePayload & {
  campaignCode: string;
} {
  return {
    encounterId: `enc-${index}`,
    campaignCode: CAMPAIGN_CODE,
    events: [],
    startedAt: NOW,
    // Ended by default (ruling 3): an open archive (no `endedAt`) is the
    // `active-combat-log` blocker's own dedicated fixture, not the default.
    endedAt: NOW,
  };
}

// `legacyId` is the RECORD KEY (`archiveId`), distinct from `encounterId` —
// ruling 6, brief item "the legacy id is the `archiveId`, never the
// `encounterId`". `name` is `'Combat logs'` so the card's `/Use Combat
// logs/` button regex (`Use {item.name} ({item.displayCode})`) matches.
const ownerWorkspace: DmWorkspaceDocument = {
  namespace: NAMESPACE,
  localId: `legacy:${CAMPAIGN_CODE}`,
  legacyId: `legacy:${CAMPAIGN_CODE}`,
  name: 'Combat logs',
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
 * `ConformanceHarness` Task 7 declares. `seedWithMarkerForAnotherAccount`,
 * `seedWithUnscopedArchive` and `legacyArchiveIds` are the brief's three
 * mandated family-local extensions.
 */
export interface CombatLogArchiveConformanceHarness extends CardParityHarness {
  /** Every action string sent to `/api/combat-log-sync`, live. */
  recordedApiActions(): () => string[];
  /** Seeds an envelope carrying an unclassified field, producing a blocker. */
  seedWithBlocker(): Promise<MigrationRunContext>;
  /** Seeds `count` ended archives instead of the default two. */
  seedWithItems(count: number): Promise<MigrationRunContext>;
  /**
   * Brief-mandated: seeds a SINGLE archive with no `endedAt`, so
   * `previewManifest` reports the `active-combat-log` blocker and
   * `prepareIndexedDb` refuses.
   */
  seedWithActiveCombatLog(): Promise<MigrationRunContext>;
  /**
   * Brief-mandated: seeds a marker directly (never through
   * `commitLocalCutover`) whose `accountId` names a DIFFERENT account than
   * the run context uses — this family's marker dialect is the only one
   * that carries `accountId` at all, so this is the only family whose
   * marker alone (no pointer disagreement needed) can trip
   * `normalizeFamilyAuthority`'s `account-mismatch` branch.
   */
  seedWithMarkerForAnotherAccount(): Promise<MigrationRunContext>;
  /**
   * Brief-mandated: seeds the default two campaign-scoped archives PLUS one
   * extra raw entry with NO `campaignCode` at all (ruling 1 / Slice 11F
   * ruling 1: out of scope, never a blocker, never staged, left in
   * localStorage untouched).
   */
  seedWithUnscopedArchive(): Promise<MigrationRunContext>;
  /** Every archiveId key in the persisted envelope's `encounters` record, regardless of campaign scope. */
  legacyArchiveIds(): string[];
  /** The archiveIds sent in the LAST `stage-items` request body, in order. */
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
   * (`CombatLogArchiveSyncControls.hooks.ts`'s own
   * `assertWorkingCopyUnchanged` checks only `contentFingerprint`,
   * `:1117-1128`) — declared adapter-only, not removed.
   */
  corruptWorkingCopySchemaVersion(legacyId: string): Promise<void>;
  /**
   * Records a download receipt for `manifestHash` WITHOUT verifying it —
   * lets a test prove `prepareIndexedDb`'s `recoveryGate` requires the
   * STRICTER `hasVerifiedDownloadReceipt`, matching
   * `CombatLogArchiveSyncControls.hooks.ts`'s own `prepare()` (`:959-962`).
   */
  recordUnverifiedReceipt(manifestHash: string): Promise<void>;
  /**
   * Returns a COPY of `manifest` with the given `legacyId`'s record (both
   * the flattened `records` entry and the `native.records` entry) marked
   * `tombstoned: true` / `payload: null` — everything else, INCLUDING the
   * top-level `fingerprint`, is left untouched, so `commitLocalCutover`'s
   * `sourceManifestUnchanged` guard (which compares only `fingerprint`) does
   * not reject it. This is the only way to reach the tombstone-derived
   * branches at all: a fresh `prepareIndexedDb` manifest is built from the
   * raw legacy envelope, which has no tombstone concept, so no NATURALLY
   * produced first-cutover manifest ever carries one.
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
   * `actual.size !== manifest.records.length` clause detects.
   */
  addExtraWorkingCopy(legacyId: string): Promise<void>;
  /**
   * Hard-deletes one document row's underlying IndexedDB record entirely
   * (bypassing the repository's `commit()` soft-tombstone path, which always
   * upserts the same key even for a `'delete'` operation) and commits an
   * unrelated extra document elsewhere, so the total document count still
   * equals `manifest.records.length` — isolating
   * `assertWorkingCopyUnchanged`'s `current === undefined` clause from its
   * record-count neighbor. TEST-ONLY: it bypasses `commit()` and writes the
   * `documents` store directly, which production code never does.
   */
  replaceWorkingCopyEntirely(
    missingLegacyId: string,
    extraLegacyId: string
  ): Promise<void>;
  /**
   * Clears the fake server's current generation to zero documents — the
   * discriminating fixture for `rollback`'s unconditional-vs-conditional
   * restore.
   */
  emptyCloudGeneration(): void;
}

export function createCombatLogArchiveHarness(): CombatLogArchiveConformanceHarness {
  vi.restoreAllMocks();

  const trace: string[] = [];
  const apiActionLog: string[] = [];
  let cutoverSink: string[] | null = null;
  let rollbackOrderSink: string[] | null = null;

  let serverAuthority: 'legacy' | 'postgres' = 'legacy';
  let serverEpoch = 0;
  const serverDocuments = new Map<string, CloudDocument>();
  // Isolates rollback's `current.authority !== 'postgres'` clause from its
  // three neighbouring null-checks (mirrors `harnesses/encounter.tsx`).
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
                  : (item.payload as CombatLogArchivePayload),
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

  const realMarkCombatLogArchiveCloudAuthority =
    combatLogArchiveAuthorityModule.markCombatLogArchiveCloudAuthority;
  vi.spyOn(
    combatLogArchiveAuthorityModule,
    'markCombatLogArchiveCloudAuthority'
  ).mockImplementation(async (...args) => {
    trace.push('mark-cloud-authority');
    recordLibraryCall('markCombatLogArchiveCloudAuthority', args);
    return realMarkCombatLogArchiveCloudAuthority(...args);
  });

  const realCommitCombatLogArchiveLocalCutover =
    combatLogArchiveAuthorityModule.commitCombatLogArchiveLocalCutover;
  vi.spyOn(
    combatLogArchiveAuthorityModule,
    'commitCombatLogArchiveLocalCutover'
  ).mockImplementation(async (...args) => {
    cutoverSink?.push('cutover');
    recordLibraryCall('commitCombatLogArchiveLocalCutover', args);
    return realCommitCombatLogArchiveLocalCutover(...args);
  });

  const realRollbackCombatLogArchiveLocalAuthority =
    combatLogArchiveAuthorityModule.rollbackCombatLogArchiveLocalAuthority;
  vi.spyOn(
    combatLogArchiveAuthorityModule,
    'rollbackCombatLogArchiveLocalAuthority'
  ).mockImplementation(async (...args) => {
    recordLibraryCall('rollbackCombatLogArchiveLocalAuthority', args);
    return realRollbackCombatLogArchiveLocalAuthority(...args);
  });

  const realRunCombatLogArchiveIndexedDbMigration =
    combatLogArchiveMigrationModule.runCombatLogArchiveIndexedDbMigration;
  vi.spyOn(
    combatLogArchiveMigrationModule,
    'runCombatLogArchiveIndexedDbMigration'
  ).mockImplementation(async (...args) => {
    recordLibraryCall('runCombatLogArchiveIndexedDbMigration', args);
    return realRunCombatLogArchiveIndexedDbMigration(...args);
  });

  const realWriteCombatLogArchiveAuthorityMarker =
    combatLogArchiveLegacyAuthorityModule.writeCombatLogArchiveAuthorityMarker;
  vi.spyOn(
    combatLogArchiveLegacyAuthorityModule,
    'writeCombatLogArchiveAuthorityMarker'
  ).mockImplementation((...args) => {
    const marker = args[1] as { authority?: string };
    if (marker?.authority === 'postgres') trace.push('write-marker');
    // Divergence (brief): this family's rollback signal is `authority:
    // 'localStorage'`, never `legacy_restored` — see
    // `combatLogArchiveAdapter.ts`'s `rollback` doc comment.
    if (marker?.authority === 'localStorage') rollbackOrderSink?.push('marker');
    return realWriteCombatLogArchiveAuthorityMarker(...args);
  });

  async function seedWithRawItems(
    rawItems: Record<string, Record<string, unknown>>
  ): Promise<MigrationRunContext> {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
    // See the base `ConformanceHarness`'s "PERSIST-BACKED SEEDING TRAP"
    // comment: seed the persist-backed store FIRST, then write the raw
    // envelope AFTER, so the explicit raw write wins. This is the
    // "defensive raw-envelope write" R7 requires be kept even though
    // removing it reddens nothing on its own: it pins the fixture to the
    // raw legacy envelope shape, not to whatever the persist middleware
    // currently emits.
    useCombatLogStore.setState({
      encounters: rawItems as unknown as never,
      combatLogTombstones: {},
      activeArchiveId: null,
      lastAdmissionError: null,
    });
    localStorage.setItem(
      COMBAT_LOG_STORAGE_KEY,
      JSON.stringify({
        version: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
        state: {
          encounters: rawItems,
          combatLogTombstones: {},
          activeArchiveId: null,
        },
      })
    );
    // `CombatLogArchiveSyncProvider` (like `EncounterSyncProvider`) reads its
    // `campaign` object live from `useDmStore` by `campaignCode`, so every
    // seed carries a matching campaign entry too.
    useDmStore.setState({
      campaigns: [
        {
          code: CAMPAIGN_CODE,
          name: 'Combat logs',
          createdAt: NOW,
          stackableInspiration: true,
        },
      ],
    });

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
    await combatLogArchiveAdapter.selectFamily(context);
    const prepared = await combatLogArchiveAdapter.prepareIndexedDb(context);
    await combatLogArchiveAdapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
  }

  /** Shared by `addExtraWorkingCopy` and `replaceWorkingCopyEntirely`. */
  async function commitExtraDocument(legacyId: string) {
    const database = await openRollkeeperDatabase();
    try {
      const repository = new IndexedDbCombatLogArchiveRepository(database);
      await repository.commit({
        namespace: NAMESPACE,
        campaignId: CAMPAIGN_ID,
        legacyId,
        cutoverEpoch: 1,
        operation: 'create',
        payload: combatLogArchivePayloadFrom({
          encounterId: 'enc-999',
          campaignCode: CAMPAIGN_CODE,
          events: [],
          startedAt: NOW,
          endedAt: NOW,
        }),
        schemaVersion: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
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
    adapter: combatLogArchiveAdapter,

    seed: () =>
      seedWithRawItems({
        'archive-1': archiveFixture(1),
        'archive-2': archiveFixture(2),
      }),
    seedWithBlocker: () =>
      seedWithRawItems({
        'archive-1': { ...archiveFixture(1), extraField: 'unexpected' },
      }),
    seedWithItems: (count: number) =>
      seedWithRawItems(
        Object.fromEntries(
          Array.from({ length: count }, (_, index) => [
            `archive-${index + 1}`,
            archiveFixture(index + 1),
          ])
        )
      ),
    seedWithActiveCombatLog: () =>
      seedWithRawItems({
        'archive-1': { ...archiveFixture(1), endedAt: undefined },
      }),
    async seedWithMarkerForAnotherAccount() {
      const context = await seedWithRawItems({
        'archive-1': archiveFixture(1),
        'archive-2': archiveFixture(2),
      });
      combatLogArchiveLegacyAuthorityModule.writeCombatLogArchiveAuthorityMarker(
        localStorage,
        {
          version: 1,
          campaignCode: CAMPAIGN_CODE,
          authority: 'indexedDB',
          epoch: 1,
          accountId: OTHER_ACCOUNT_ID,
          campaignId: CAMPAIGN_ID,
        }
      );
      return context;
    },
    seedWithUnscopedArchive: () =>
      seedWithRawItems({
        'archive-1': archiveFixture(1),
        'archive-2': archiveFixture(2),
        'unscoped-archive': {
          encounterId: 'enc-unscoped',
          events: [],
          startedAt: NOW,
          endedAt: NOW,
          // No `campaignCode` at all — ruling 1 / Slice 11F ruling 1.
        },
      }),

    legacyArchiveIds(): string[] {
      const raw = localStorage.getItem(COMBAT_LOG_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as {
        state?: { encounters?: Record<string, unknown> };
      };
      return Object.keys(parsed.state?.encounters ?? {});
    },

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
      const manifest = await combatLogArchiveAdapter.previewManifest(context);
      await combatLogArchiveAdapter.activateCloud(context, manifest);
    },

    failCloud() {
      failNextCall = true;
    },

    trace: () => [...trace],

    seedDeviceId(deviceId) {
      // Matches the adapter's `deviceIdFor('combat-log-archive', ...)` key
      // prefix, read straight off the shipped card's own persisted key
      // (`CombatLogArchiveSyncControls.hooks.ts:229-231`, `deviceKeyFor`:
      // `` `rollkeeper:combat-log-archive-device:${accountId}:${campaignId}` ``).
      localStorage.setItem(
        `rollkeeper:combat-log-archive-device:${ACCOUNT_ID}:${CAMPAIGN_ID}`,
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
        const documents = await new IndexedDbCombatLogArchiveRepository(
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
        const repository = new IndexedDbCombatLogArchiveRepository(database);
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
          contentFingerprint:
            await fingerprintCombatLogArchiveTombstone(legacyId),
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
          legacyId: 'archive-1',
          family: 'combat_log_archive',
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
        } satisfies CombatLogArchiveOutboxEntry);
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
          legacyId: 'archive-1',
          family: 'combat_log_archive',
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
        } satisfies CombatLogArchiveOutboxEntry);
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
        )) as CombatLogArchiveOutboxEntry[];
        for (const entry of all) {
          if (
            entry.namespace === NAMESPACE &&
            entry.campaignId === CAMPAIGN_ID &&
            entry.family === 'combat_log_archive' &&
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
          family: 'combat_log_archive',
          legacyId: 'archive-1',
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
        const documents = await new IndexedDbCombatLogArchiveRepository(
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

    seedEmpty: () => seedWithRawItems({}),

    async deleteAuthorityMarker() {
      localStorage.removeItem(combatLogArchiveAuthorityKey(CAMPAIGN_CODE));
    },

    async seedMarkerPointerDisagreement() {
      const context = await this.seed();
      await runChainThroughLocalCutover(context);
      localStorage.removeItem(combatLogArchiveAuthorityKey(CAMPAIGN_CODE));
      return context;
    },

    async seedMarkerAheadOfPointer() {
      const context = await this.seed();
      combatLogArchiveLegacyAuthorityModule.writeCombatLogArchiveAuthorityMarker(
        localStorage,
        {
          version: 1,
          campaignCode: CAMPAIGN_CODE,
          authority: 'indexedDB',
          epoch: 1,
          accountId: ACCOUNT_ID,
          campaignId: CAMPAIGN_ID,
        }
      );
      return context;
    },

    async pointerState() {
      const database = await openRollkeeperDatabase();
      try {
        const pointer =
          await combatLogArchiveAuthorityModule.readCombatLogArchiveAuthority(
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
      const raw = localStorage.getItem(COMBAT_LOG_STORAGE_KEY);
      if (!raw) throw new Error('No legacy envelope to mutate');
      const parsed = JSON.parse(raw) as {
        state: { encounters: Record<string, { startedAt?: string }> };
      };
      const archive = parsed.state.encounters['archive-1'];
      if (!archive) throw new Error('Seeded archive is missing');
      archive.startedAt = `${archive.startedAt ?? ''} (edited)`;
      localStorage.setItem(COMBAT_LOG_STORAGE_KEY, JSON.stringify(parsed));
    },

    /**
     * Reads the PERSISTED `rollkeeper-combat-log` envelope directly (never
     * the in-memory `useCombatLogStore` state, and never IndexedDB) — this
     * is what makes the marker-before-restore write ORDER observable at
     * all. Both persisted keys `applyCombatLogArchiveDocuments` touches are
     * in scope (adapterConformance.ts's `readLegacyStorePayload` doc
     * comment): `encounters` (filtered to this campaign) and
     * `combatLogTombstones` (also filtered to this campaign, per
     * `isCampaignTombstone`) — matching what `applyCombatLogArchiveDocuments`
     * / `hideCombatLogArchives` leaves for this campaign after their filters
     * run.
     */
    async readLegacyStorePayload() {
      const raw = localStorage.getItem(COMBAT_LOG_STORAGE_KEY);
      if (!raw) return { encounters: {}, combatLogTombstones: {} };
      const parsed = JSON.parse(raw) as {
        state?: {
          encounters?: Record<string, { campaignCode?: string }>;
          combatLogTombstones?: Record<
            string,
            { beforeImage?: { campaignCode?: string } }
          >;
        };
      };
      const encounters = Object.fromEntries(
        Object.entries(parsed.state?.encounters ?? {}).filter(
          ([, archive]) => archive.campaignCode === CAMPAIGN_CODE
        )
      );
      const combatLogTombstones = Object.fromEntries(
        Object.entries(parsed.state?.combatLogTombstones ?? {}).filter(
          ([, tombstone]) =>
            tombstone?.beforeImage?.campaignCode === CAMPAIGN_CODE
        )
      );
      return { encounters, combatLogTombstones };
    },

    /**
     * Mutates the fake server's own current generation across all three
     * `applyCombatLogArchiveDocuments` branches, reproducing "edits made
     * during the migrated period" on more than one document and one field:
     *   - `archive-1`'s payload changes (the update branch);
     *   - `archive-2` is tombstoned in the diverged generation, having been
     *     live in the migrated one (the delete/tombstone branch);
     *   - `archive-added-elsewhere` exists in the diverged generation only,
     *     absent from the migrated one (the added branch).
     */
    async divergeCloudGeneration() {
      const archive1 = serverDocuments.get('archive-1');
      if (!archive1)
        throw new Error('Expected archive-1 in the cloud generation');
      serverDocuments.set('archive-1', {
        ...archive1,
        serverVersion: archive1.serverVersion + 1,
        payloadFingerprint: 'd'.repeat(64),
        payload: {
          ...(archive1.payload as CombatLogArchivePayload),
          startedAt: 'Edited on another device',
        },
      });
      const archive2 = serverDocuments.get('archive-2');
      if (archive2) {
        serverDocuments.set('archive-2', {
          ...archive2,
          serverVersion: archive2.serverVersion + 1,
          tombstoned: true,
          payload: null,
          payloadFingerprint: 'e'.repeat(64),
        });
      }
      serverDocuments.set('archive-added-elsewhere', {
        legacyId: 'archive-added-elsewhere',
        serverVersion: 1,
        schemaVersion: 1,
        payloadFingerprint: 'f'.repeat(64),
        tombstoned: false,
        payload: {
          encounterId: 'enc-added-elsewhere',
          events: [],
          startedAt: NOW,
          endedAt: NOW,
        },
      });
    },

    /**
     * The fake server's OWN record of what `currentGeneration.documents`
     * projects into the legacy store right now, independent of anything the
     * adapter did with it — computed straight from `serverDocuments`, NEVER
     * imported from `combatLogArchiveFamily.ts` (`combatLogArchiveFromPayload`,
     * the function the adapter itself uses to build its restore) —
     * restating the projection here, not sharing the adapter's own oracle
     * (ruling R8.4's self-fulfilling-fake pattern).
     *
     * The one sanctioned exception (brief item 8, spelled out in
     * `adapterConformance.ts`'s `expectedLegacyStoreAfterRollback` doc
     * comment): `combat_log_archive`'s rollback does not rehydrate
     * tombstones from cloud documents — it only strips this campaign's own,
     * unconditionally, and never rebuilds one from a `tombstoned` flag on a
     * cloud document (there is no `beforeImage` on the wire to rebuild one
     * from). So the `combatLogTombstones` half here is NOT derived from
     * `serverDocuments` — it is always `{}`, because after this campaign's
     * rollback no tombstone of this campaign can survive in the store,
     * matching what `readLegacyStorePayload()` (filtered to this campaign)
     * will show. This member does not by itself prove the OTHER campaign's
     * tombstones survive — that direction has its own dedicated fixture in
     * `combatLogArchiveAdapter.test.ts`, seeded and asserted directly
     * against `useCombatLogStore`, per the precedent Task 11 set for
     * `encounterTombstones`.
     */
    expectedLegacyStoreAfterRollback: () => {
      const encounters = Object.fromEntries(
        documentSnapshot()
          .filter(document => document.payload && !document.tombstoned)
          .map(document => [
            document.legacyId,
            {
              ...(document.payload as CombatLogArchivePayload),
              campaignCode: CAMPAIGN_CODE,
            },
          ])
      );
      return { encounters, combatLogTombstones: {} };
    },

    recordRollbackOrderInto(sink: string[]) {
      rollbackOrderSink = sink;
      const realSetState = useCombatLogStore.setState;
      vi.spyOn(useCombatLogStore, 'setState').mockImplementation(
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
        const repository = new IndexedDbCombatLogArchiveRepository(database);
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
        const repository = new IndexedDbCombatLogArchiveRepository(database);
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
      ) as FamilyManifestHandle<CombatLogArchiveManifest>;
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
        return await new IndexedDbCombatLogArchiveRepository(
          database
        ).getDocument(NAMESPACE, legacyId);
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
          .delete([NAMESPACE, 'combat_log_archive', missingLegacyId]);
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
      await this.corruptWorkingCopyFingerprint('archive-1');
    },

    async divergeVerifiedSchemaVersion() {
      await this.corruptWorkingCopySchemaVersion('archive-1');
    },

    async divergeVerifiedTombstoneFlag() {
      const database = await openRollkeeperDatabase();
      try {
        const transaction = database.transaction('documents', 'readwrite');
        const store = transaction.objectStore('documents');
        const key = [NAMESPACE, 'combat_log_archive', 'archive-1'];
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
          .delete([NAMESPACE, 'combat_log_archive', 'archive-2']);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    // -----------------------------------------------------------------
    // Card/adapter step-parity test support.
    // -----------------------------------------------------------------

    /**
     * Renders the SHIPPED `CombatLogArchiveSyncControls` card (wrapped in
     * its required `CombatLogArchiveSyncProvider`) and drives it, by
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
     *     record on the card
     *     (`CombatLogArchiveSyncControls.hooks.ts:1186-1190`) vs computed
     *     from the server's response on the adapter — declared centrally in
     *     `adapterConformance.ts`'s `describeCardParity` (Minor item 6),
     *     not re-declared here.
     *   - `assertWorkingCopyUnchanged`'s `schemaVersion` clause has no card
     *     counterpart (adapter-only) — see
     *     `corruptWorkingCopySchemaVersion`'s doc comment above.
     *   - `previewManifest`'s working-copy branch does no per-document
     *     fingerprint re-verification against `contentFingerprint` on
     *     EITHER side — see `combatLogArchiveAdapter.ts`'s `previewManifest`
     *     doc comment; this is not a divergence, it is shared behaviour
     *     absent from both.
     *   - the card's `rollback()` request body names the manifest field
     *     `previewFingerprint`, not `manifestFingerprint` — mirrored exactly
     *     in the adapter, so this is NOT a divergence either.
     *   - the card also exposes device-enrollment/history/restore/
     *     remove-account/export flows this suite never drives — the adapter
     *     has no equivalent methods, matching every other family in this
     *     slice.
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
        .mockReturnValue('blob:combat-log-archive-recovery');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        () => undefined
      );

      render(
        <CombatLogArchiveSyncProvider campaignCode={CAMPAIGN_CODE}>
          <CombatLogArchiveSyncControls
            campaign={{
              code: CAMPAIGN_CODE,
              name: 'Combat logs',
              createdAt: NOW,
            }}
          />
        </CombatLogArchiveSyncProvider>
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Find my campaigns' })
      );
      fireEvent.click(
        await screen.findByRole('button', { name: /Use Combat logs/ })
      );
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'See what will be backed up',
        })
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Download a safety copy' })
      );
      await screen.findByText(/Open that file here to continue/);
      const downloadedBlob = createObjectURL.mock.calls[0]![0] as Blob;
      fireEvent.change(screen.getByLabelText('Safety copy you downloaded'), {
        target: {
          files: [
            new File(
              [await downloadedBlob.text()],
              'combat-log-archive-backup.json',
              { type: 'application/json' }
            ),
          ],
        },
      });
      await screen.findByText(
        'Safety copy checked. Your combat logs are still stored the usual way for now.'
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Get this device ready' })
      );
      await screen.findByText(
        'This device is ready. One more confirmation and it will be switched over.'
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Turn on for this device' })
      );
      await screen.findByText(
        'Saved on this device. Not backed up to your account yet.'
      );
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Turn on backup to your account',
        })
      );
      await screen.findByText(
        'Saved on this device and backed up to your account.'
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Stop backing up' })
      );
      await screen.findByText(
        'Backup is off and everything was kept. Reload the page to keep working on this device.'
      );
      cleanup();
    },

    recordedLibraryCalls: () => ({ ...libraryCalls }),

    allCloudRequestBodies: () => ({ ...allRequestBodiesByAction }),

    currentMarkerRaw() {
      const raw = localStorage.getItem(
        combatLogArchiveAuthorityKey(CAMPAIGN_CODE)
      );
      return raw ? (JSON.parse(raw) as unknown) : null;
    },
  };
}
