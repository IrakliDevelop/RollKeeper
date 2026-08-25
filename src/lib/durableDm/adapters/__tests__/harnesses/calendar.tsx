import 'fake-indexeddb/auto';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { CalendarSyncControls } from '@/components/ui/calendar/CalendarSyncControls';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import { calendarAdapter } from '@/lib/durableDm/adapters/calendarAdapter';
import type { MigrationRunContext } from '@/lib/durableDm/durableFamilyAdapter';
import * as calendarLegacyProjectionModule from '@/lib/durableDm/calendarLegacyProjection';
import * as resumableCloudActivationModule from '@/lib/durableDm/resumableCloudActivation';
import { captureDeviceBackup } from '@/lib/deviceRecovery';
import * as calendarAuthorityModule from '@/lib/indexeddb/calendarAuthority';
import * as calendarMigrationModule from '@/lib/indexeddb/calendarMigration';
import {
  IndexedDbCalendarRepository,
  type CalendarOutboxEntry,
} from '@/lib/indexeddb/calendarRepository';
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
import { useCalendarStore } from '@/store/calendarStore';
import type {
  CalendarConfig,
  CalendarEvent,
  CampaignCalendar,
} from '@/types/calendar';

import type { CardParityHarness } from '../adapterConformance';

const NOW = '2026-08-24T00:00:00.000Z';
const ACCOUNT_ID = '55555555-5555-4555-8555-555555555555';
const CAMPAIGN_ID = '66666666-6666-4666-8666-666666666666';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const CAMPAIGN_CODE = 'CAL0001';

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

interface FlatEnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  legacyId?: string;
  serverVersion?: number;
  schemaVersion?: number;
  payloadFingerprint?: string;
  tombstoned?: boolean;
}

function baseConfig(): CalendarConfig {
  return {
    clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
    weekDays: [{ name: 'Firstday' }],
    months: [{ name: 'Dawn', days: 30 }],
    seasons: [],
    moons: [],
    namedYears: [],
    eras: [],
    yearOffset: 0,
    yearStartWeekdayOffset: 0,
    mechanics: {
      hoursPerLongRest: 8,
      minutesPerShortRest: 60,
      secondsPerRound: 6,
    },
  };
}

function baseEvents(): CalendarEvent[] {
  return [
    {
      id: 'evt-seed',
      title: 'Vault opens',
      description: 'DM detail',
      year: 1,
      month: 0,
      day: 2,
      createdAt: 10,
      visibility: 'private',
    },
  ];
}

function calendarFixture(extra: Record<string, unknown> = {}) {
  return {
    campaignCode: CAMPAIGN_CODE,
    config: baseConfig(),
    currentTime: 1000,
    startTime: 0,
    events: baseEvents(),
    weather: 'clear',
    ...extra,
  };
}

function envelope(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    state: { calendars: [calendarFixture(extra)] },
    version: 3,
  });
}

// `legacyId` matches `localId` exactly, mirroring the production invariant —
// see `harnesses/campaignSettings.tsx`'s identical comment.
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

// The `campaign` prop `CalendarSyncControls` renders with. Calendar data
// itself lives in `useCalendarStore`, read live by the component — unlike
// `CampaignSettingsSyncControls`, whose settings ARE the `campaign` prop, so
// no live-reading wrapper component is needed here: this literal is exactly
// what `CalendarSyncControls.test.tsx`'s own fixture uses.
const CAMPAIGN_INFO = { code: CAMPAIGN_CODE, name: 'Canary', createdAt: NOW };

/**
 * Ruling R3.1: extra members this family's own tests use, beyond the base
 * `ConformanceHarness` Task 7 declares.
 */
export interface CalendarConformanceHarness extends CardParityHarness {
  /**
   * Every action string sent to `/api/calendar-sync`, live: the returned
   * function reads the CURRENT log each time it is called, not a snapshot
   * taken when `recordedApiActions()` itself was called — the brief's "no
   * projection call" test captures the getter before driving the chain.
   */
  recordedApiActions(): () => string[];
  /**
   * Forces the fake server's `preview-enrollment` response into the FLAT
   * single-document shape the real RPC returns (`CalendarSyncControls.tsx:88`)
   * — no `recordCount`, no `documents` array. Only this family's own test
   * ("normalizes the flat enrollment preview...") drives this raw shape.
   */
  seedFlatEnrollmentPreview(preview: FlatEnrollmentPreview): void;
  /** Updates only the forced preview's `payloadFingerprint`, after seeding. */
  setCloudPayloadFingerprint(payloadFingerprint: string): void;
  /** Seeds an envelope carrying an unclassified field, producing a blocker. */
  seedWithBlocker(): Promise<MigrationRunContext>;
  /** Forces the cloud `projection-status` response. */
  setProjectionStatus(status: string): void;
  /** Isolates rollback's server-authority clause. */
  forcePreviewAuthorityMismatch(): void;
  /** Isolates rollback's three preview null-checks. */
  forceIncompleteCloudPreview(): void;
  /**
   * Rewrites the IndexedDB working copy's `contentFingerprint` so it no
   * longer matches its own payload, without deleting or removing it —
   * isolates `previewManifest`'s fingerprint-verification guard AND
   * `activateCloud`'s `assertWorkingCopyUnchanged` fingerprint clause from
   * their neighbouring "document missing/deleted" and delete clauses.
   */
  corruptWorkingCopyFingerprint(): Promise<void>;
  /**
   * Task 8 review, Important 3: rewrites the working copy's `schemaVersion`
   * alone (keeping `contentFingerprint` matching) — isolates
   * `assertWorkingCopyUnchanged`'s schemaVersion clause, which has no
   * counterpart in the card (`CalendarSyncControls.tsx`'s own
   * `assertWorkingCopyUnchanged` checks only `contentFingerprint`,
   * `:775-777`) — declared adapter-only, not removed.
   */
  corruptWorkingCopySchemaVersion(): Promise<void>;
  /**
   * Nulls the fake server's own `currentGeneration.payload` (keeping every
   * other field) so `rollback`'s response carries no payload — the calendar
   * card's own condition (`CalendarSyncControls.tsx:1249`) for skipping the
   * legacy-store restore entirely.
   */
  nullifyCloudPayload(): void;
  /**
   * Task 8 review, Important 5: records a download receipt for
   * `manifestHash` WITHOUT verifying it — `recordDownloadReceipt` only,
   * never `verifyDownloadReceipt`. Lets a test prove `prepareIndexedDb`'s
   * `recoveryGate` now requires the STRICTER `hasVerifiedDownloadReceipt`,
   * matching `CalendarSyncControls.tsx`'s own `prepare()` (`:639-641`).
   */
  recordUnverifiedReceipt(manifestHash: string): Promise<void>;
  /**
   * Fix round 1 (coordinator review of Task 10): hides this run's namespace
   * directly in `meta` (the same `account-namespace-visibility:<namespace>`
   * row `removeAccountFromDevice` writes, `calendarRepository.ts:453`),
   * WITHOUT going through the full removal flow — the only way `getDocument`
   * (`calendarRepository.ts:192-206`) returns `null` for an EXISTING
   * document, reached NATURALLY in production whenever a namespace is
   * hidden, unlike a raw-row delete. Isolates `assertWorkingCopyUnchanged`'s
   * `!document` clause from its `operation === 'delete'` neighbor — a
   * soft-deleted row is never absent (`commit()` always upserts the same
   * key), so no delete fixture can reach this clause; see the corrected
   * comment on `calendarAdapter.ts`'s own guard.
   */
  hideNamespace(): Promise<void>;
}

export function createCalendarHarness(): CalendarConformanceHarness {
  vi.restoreAllMocks();

  const trace: string[] = [];
  const apiActionLog: string[] = [];
  let cutoverSink: string[] | null = null;
  let rollbackOrderSink: string[] | null = null;

  let serverAuthority: 'legacy' | 'postgres' = 'legacy';
  let serverEpoch = 0;
  let projectionStatus = 'current';
  let serverDocument: {
    legacyId: string;
    serverVersion: number;
    schemaVersion: number;
    payloadFingerprint: string;
    tombstoned: boolean;
    payload: unknown;
  } | null = null;
  let forcedFlatPreview: FlatEnrollmentPreview | null = null;
  // Isolates rollback's `current.authority !== 'postgres'` clause from its
  // three neighbouring null-checks (mirrors `harnesses/campaignSettings.tsx`):
  // a REAL "legacy" preview response never carries the other fields either,
  // so `'authority-mismatch'` keeps every other field populated (something
  // only a fake can do) to prove THIS clause alone is load-bearing.
  // `'incomplete'` is the mirror case for the three null-checks: reports
  // `authority: 'postgres'` (so that clause does not fire) but omits every
  // other field.
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
  // Task 8 review, Critical 2(b): every cloud request body ever sent, by
  // action, for the step-parity test — `recorded` above stays scoped to the
  // three staging actions `requestBodies()` already promises.
  const allRequestBodiesByAction: Record<string, Record<string, unknown>[]> =
    {};
  // Task 8 review, Critical 2(a)/(c): full ordered call-argument capture,
  // by function name, for the step-parity test — mirrors
  // `harnesses/campaignSettings.tsx`'s `libraryCalls`.
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

  function previewEnrollment(): FlatEnrollmentPreview {
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
    if (forcedFlatPreview) return forcedFlatPreview;
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
      // Every action's body, for the step-parity test.
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

  const realMarkCalendarCloudAuthority =
    calendarAuthorityModule.markCalendarCloudAuthority;
  vi.spyOn(
    calendarAuthorityModule,
    'markCalendarCloudAuthority'
  ).mockImplementation(async (...args) => {
    trace.push('mark-cloud-authority');
    recordLibraryCall('markCalendarCloudAuthority', args);
    return realMarkCalendarCloudAuthority(...args);
  });

  const realCommitCalendarLocalCutover =
    calendarAuthorityModule.commitCalendarLocalCutover;
  vi.spyOn(
    calendarAuthorityModule,
    'commitCalendarLocalCutover'
  ).mockImplementation(async (...args) => {
    cutoverSink?.push('cutover');
    recordLibraryCall('commitCalendarLocalCutover', args);
    return realCommitCalendarLocalCutover(...args);
  });

  const realRollbackCalendarLocalAuthority =
    calendarAuthorityModule.rollbackCalendarLocalAuthority;
  vi.spyOn(
    calendarAuthorityModule,
    'rollbackCalendarLocalAuthority'
  ).mockImplementation(async (...args) => {
    recordLibraryCall('rollbackCalendarLocalAuthority', args);
    return realRollbackCalendarLocalAuthority(...args);
  });

  // Task 8 review, Critical 2(c): the template spied only
  // `runResumableCloudActivation` and the three authority functions, never
  // `run<Family>IndexedDbMigration` — which is why the `recoveryGate`
  // divergence (Important 5) was invisible to the step-parity comparison.
  // Both the card (`CalendarSyncControls.tsx`'s `prepare()`) and the adapter
  // (`prepareIndexedDb`) call this SAME module export directly.
  const realRunCalendarIndexedDbMigration =
    calendarMigrationModule.runCalendarIndexedDbMigration;
  vi.spyOn(
    calendarMigrationModule,
    'runCalendarIndexedDbMigration'
  ).mockImplementation(async (...args) => {
    recordLibraryCall('runCalendarIndexedDbMigration', args);
    return realRunCalendarIndexedDbMigration(...args);
  });

  const realWriteCalendarProjectionAuthority =
    calendarLegacyProjectionModule.writeCalendarProjectionAuthority;
  vi.spyOn(
    calendarLegacyProjectionModule,
    'writeCalendarProjectionAuthority'
  ).mockImplementation((...args) => {
    if (args[2]?.authority === 'postgres') trace.push('write-marker');
    // Fix-round-2-style entry-time ordering trace for rollback's
    // marker-then-store write sequence, mirroring `campaignSettings.tsx`.
    if (args[2]?.authority === 'legacy_restored')
      rollbackOrderSink?.push('marker');
    return realWriteCalendarProjectionAuthority(...args);
  });

  async function seedWithEnvelope(raw: string): Promise<MigrationRunContext> {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
    // See `harnesses/campaignSettings.tsx`'s "PERSIST-BACKED SEEDING TRAP"
    // comment: seed the persist-backed store FIRST, then write the raw
    // envelope AFTER, so the explicit raw write wins.
    useCalendarStore.setState({
      calendars: [calendarFixture() as unknown as CampaignCalendar],
    });
    localStorage.setItem('rollkeeper-calendar-data', raw);

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
    await calendarAdapter.selectFamily(context);
    const prepared = await calendarAdapter.prepareIndexedDb(context);
    await calendarAdapter.commitLocalCutover(context, {
      generation: prepared.generation,
      manifest: prepared.manifest,
    });
  }

  return {
    adapter: calendarAdapter,

    seed: () => seedWithEnvelope(envelope()),
    // An unclassified field the calendar family does not recognize
    // (`CALENDAR_FAMILY_INVENTORY.documentFields`), producing a blocker
    // without inventing a new fixture shape — mirrors
    // `harnesses/campaignSettings.tsx`'s `seedWithBlocker`.
    seedWithBlocker: () =>
      seedWithEnvelope(envelope({ extraField: 'unexpected' })),

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
      const manifest = await calendarAdapter.previewManifest(context);
      await calendarAdapter.activateCloud(context, manifest);
    },

    failCloud() {
      failNextCall = true;
    },

    trace: () => [...trace],

    seedDeviceId(deviceId) {
      // Task 8 review, Critical 1: must match the adapter's (now corrected)
      // `deviceIdFor('campaign-calendar', ...)` key prefix, which is what
      // the shipped card itself persists to
      // (`CalendarSyncControls.tsx:789`, `:916`, `:1291`).
      localStorage.setItem(
        `rollkeeper:campaign-calendar-device:${ACCOUNT_ID}:${CAMPAIGN_ID}`,
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
        const document = await new IndexedDbCalendarRepository(
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
        const repository = new IndexedDbCalendarRepository(database);
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
          family: 'calendar',
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
        } satisfies CalendarOutboxEntry);
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
          family: 'calendar',
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
        } satisfies CalendarOutboxEntry);
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
          family: 'calendar',
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
        } satisfies CalendarOutboxEntry);
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
        )) as CalendarOutboxEntry[];
        for (const entry of all) {
          if (
            entry.namespace === NAMESPACE &&
            entry.campaignId === CAMPAIGN_ID &&
            entry.family === 'calendar' &&
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
          family: 'calendar',
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
          family: 'calendar',
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
        const pointer = await calendarAuthorityModule.readCalendarAuthority(
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
        const document = await new IndexedDbCalendarRepository(
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

    // Fix round 2, item 1: a calendar always carries its own required
    // fields (`config`/`currentTime`/`startTime`/`weather`), so unlike
    // `campaign_settings` there is no literal `{}` payload — `events: []`
    // is calendar's own analog of "zero items", the most minimal state
    // `buildCalendarManifest` does not block.
    seedEmpty: () => seedWithEnvelope(envelope({ events: [] })),

    async deleteAuthorityMarker() {
      localStorage.removeItem(
        calendarLegacyProjectionModule.calendarProjectionAuthorityKey(
          CAMPAIGN_CODE
        )
      );
    },

    async seedMarkerPointerDisagreement() {
      const context = await seedWithEnvelope(envelope());
      await runChainThroughLocalCutover(context);
      localStorage.removeItem(
        calendarLegacyProjectionModule.calendarProjectionAuthorityKey(
          CAMPAIGN_CODE
        )
      );
      return context;
    },

    async seedMarkerAheadOfPointer() {
      const context = await seedWithEnvelope(envelope());
      calendarLegacyProjectionModule.writeCalendarProjectionAuthority(
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

    /**
     * Changes the legacy source in a way that changes its manifest
     * fingerprint without re-running `prepareIndexedDb`.
     */
    async mutateLegacyEnvelope() {
      const raw = localStorage.getItem('rollkeeper-calendar-data');
      if (!raw) throw new Error('No legacy envelope to mutate');
      const parsed = JSON.parse(raw) as {
        state: { calendars: { campaignCode: string; currentTime?: number }[] };
      };
      const calendar = parsed.state.calendars.find(
        entry => entry.campaignCode === CAMPAIGN_CODE
      );
      if (!calendar) throw new Error('Seeded calendar is missing');
      calendar.currentTime = (calendar.currentTime ?? 0) + 1;
      localStorage.setItem('rollkeeper-calendar-data', JSON.stringify(parsed));
    },

    /**
     * Reads the PERSISTED `rollkeeper-calendar-data` envelope directly
     * (never the in-memory `useCalendarStore` state, and never IndexedDB) —
     * this is what makes the marker-before-payload write ORDER observable
     * at all, since `createCalendarAwareStorage` only intercepts the
     * persisted write, not the in-memory `set()`. calendar is single-record,
     * so this returns one object (or `null` if the campaign is absent from
     * the persisted envelope).
     */
    async readLegacyStorePayload() {
      const raw = localStorage.getItem('rollkeeper-calendar-data');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        state?: { calendars?: Record<string, unknown>[] };
      };
      const calendar = parsed.state?.calendars?.find(
        entry => entry.campaignCode === CAMPAIGN_CODE
      );
      if (!calendar) return null;
      return {
        config: calendar.config,
        currentTime: calendar.currentTime,
        startTime: calendar.startTime,
        events: calendar.events,
        ...(calendar.weather === undefined
          ? {}
          : { weather: calendar.weather }),
      };
    },

    /**
     * Mutates the fake server's own current generation so it differs from
     * the frozen legacy value in several fields (config, currentTime,
     * startTime, events, weather), simulating an edit made on another
     * device during the migrated period.
     */
    async divergeCloudGeneration() {
      if (!serverDocument) throw new Error('No cloud generation to diverge');
      const payload = serverDocument.payload as {
        config: CalendarConfig;
        currentTime: number;
        startTime: number;
        events: CalendarEvent[];
        weather?: string;
      };
      serverDocument = {
        ...serverDocument,
        serverVersion: serverDocument.serverVersion + 1,
        payloadFingerprint: 'd'.repeat(64),
        payload: {
          config: { ...payload.config, yearOffset: 999 },
          currentTime: payload.currentTime + 100_000,
          startTime: payload.startTime + 5_000,
          events: [
            ...payload.events,
            {
              id: 'evt-edited-elsewhere',
              title: 'Edited on another device',
              description: 'Added while this browser was offline',
              year: 2,
              month: 1,
              day: 1,
              createdAt: 999,
              visibility: 'public',
            },
          ],
          weather: 'thunderstorm',
        },
      };
    },

    /**
     * The fake server's OWN record of what `currentGeneration.payload`
     * holds right now, independent of anything the adapter did with it —
     * computed straight from `serverDocument`, NEVER imported from
     * `calendarFamily.ts` (the module the adapter itself imports to build
     * its restore) — restating the projection here, not sharing the
     * adapter's own oracle (ruling R8.4's self-fulfilling-fake pattern).
     */
    expectedLegacyStoreAfterRollback: () => serverDocument?.payload ?? null,

    /**
     * Entry-time ordering trace for rollback's marker-then-store write
     * sequence. Armed here (at call time), not at harness creation, so the
     * seed's own unrelated `useCalendarStore.setState` call is never
     * captured.
     */
    recordRollbackOrderInto(sink: string[]) {
      rollbackOrderSink = sink;
      const realSetState = useCalendarStore.setState;
      vi.spyOn(useCalendarStore, 'setState').mockImplementation(
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

    seedFlatEnrollmentPreview(preview) {
      forcedFlatPreview = { ...preview };
    },

    setCloudPayloadFingerprint(payloadFingerprint) {
      if (!forcedFlatPreview)
        throw new Error('seedFlatEnrollmentPreview must run first');
      forcedFlatPreview = { ...forcedFlatPreview, payloadFingerprint };
    },

    setProjectionStatus(status: string) {
      projectionStatus = status;
    },

    forcePreviewAuthorityMismatch() {
      forcedPreviewMode = 'authority-mismatch';
    },

    forceIncompleteCloudPreview() {
      forcedPreviewMode = 'incomplete';
    },

    async corruptWorkingCopyFingerprint() {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbCalendarRepository(database);
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
        const repository = new IndexedDbCalendarRepository(database);
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
        const key = [NAMESPACE, 'calendar', CAMPAIGN_CODE];
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
          .delete([NAMESPACE, 'calendar', CAMPAIGN_CODE]);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },

    nullifyCloudPayload() {
      if (!serverDocument) throw new Error('No cloud generation to nullify');
      serverDocument = { ...serverDocument, payload: null };
    },

    async recordUnverifiedReceipt(manifestHash) {
      await browserRecoveryRepository.recordDownloadReceipt({
        runId: crypto.randomUUID(),
        manifestHash,
        initiatedAt: NOW,
      });
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
    // Task 8 review, Critical 2(b): the card/adapter step-parity test
    // support, mirroring `harnesses/campaignSettings.tsx`'s own section.
    // -----------------------------------------------------------------

    /**
     * Renders the SHIPPED `CalendarSyncControls` card and drives it, by
     * clicking its own buttons, through discovery -> select -> preview ->
     * download recovery file -> verify (via a re-uploaded File built from
     * the downloaded Blob) and select -> prepare -> confirm local cutover
     * -> activate cloud -> verified rollback. Every library call the card
     * makes along the way is captured by the SAME spies
     * `recordedLibraryCalls()` and `allCloudRequestBodies()` expose for the
     * adapter.
     *
     * Named, expected differences from the adapter's own chain:
     *   - the card discovers and selects a workspace interactively; the
     *     adapter receives an already-selected `MigrationRunContext`.
     *   - the card's recovery flow is TWO explicit steps — "Download
     *     recovery file" then a file re-upload ("Verify recovery file and
     *     select") — unlike `campaign_settings`' one-click "Download
     *     recovery and select". Both still reach the same
     *     recorded-and-verified-receipt-plus-selected state the adapter's
     *     `selectFamily` requires.
     *   - the card uses `window.confirm`; the adapter has none (spec R12).
     *   - the card has no `verifyCloud` equivalent (new per R1).
     *   - mutation ids are random (`crypto.randomUUID()`) on the card and
     *     deterministic on the adapter.
     *   - `acceptedVersion.serverVersion` is hardcoded `1` on the card
     *     (`CalendarSyncControls.tsx:837`) vs computed from the server's
     *     response on the adapter (`calendarAdapter.ts`) — declared
     *     centrally in `adapterConformance.ts`'s `describeCardParity` (Task
     *     8 review, Minor 6), not re-declared here.
     *   - `assertWorkingCopyUnchanged`'s `schemaVersion` clause has no card
     *     counterpart (adapter-only) — see
     *     `corruptWorkingCopySchemaVersion`'s doc comment above.
     *   - after Task 8 review Important 5, the card's and the adapter's
     *     `prepareIndexedDb`/`prepare()` `recoveryGate` now agree (both
     *     require a VERIFIED receipt) — no divergence to declare here.
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
        .mockReturnValue('blob:calendar-recovery');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        () => undefined
      );

      render(<CalendarSyncControls campaign={CAMPAIGN_INFO} />);
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
        await screen.findByRole('button', { name: 'Download recovery file' })
      );
      await screen.findByText(/Reopen that file here before selection/);
      const downloadedBlob = createObjectURL.mock.calls[0]![0] as Blob;
      fireEvent.change(
        screen.getByLabelText('Downloaded calendar recovery file'),
        {
          target: {
            files: [
              new File([await downloadedBlob.text()], 'calendar-backup.json', {
                type: 'application/json',
              }),
            ],
          },
        }
      );
      await screen.findByText(
        'Recovery file verified and calendar selected. LocalStorage remains authoritative.'
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

    /** Full call-sequence argument capture, by function name. */
    recordedLibraryCalls: () => ({ ...libraryCalls }),

    /** Every cloud request body ever sent, by action. */
    allCloudRequestBodies: () => ({ ...allRequestBodiesByAction }),

    /** The persisted marker, parsed. */
    currentMarkerRaw() {
      const raw = localStorage.getItem(
        `rollkeeper:calendar-projection-authority:${CAMPAIGN_CODE}`
      );
      return raw ? (JSON.parse(raw) as unknown) : null;
    },
  };
}
