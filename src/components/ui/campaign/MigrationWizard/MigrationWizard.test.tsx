import 'fake-indexeddb/auto';

import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { configure } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  verifyDownloadedDeviceBackup,
} from '@/lib/deviceRecovery';
import { decideAuthorityRepair } from '@/lib/durableDm/authorityRepair';
import { changedOnAnotherBrowserMessage } from '@/lib/durableDm/familyConflictMessage';
import type {
  CloudActivationConflictReason,
  DurableFamilyAdapter,
  DurableFamilyName,
  FamilyManifestHandle,
  FamilyVerification,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import type {
  AuthorityPointerView,
  NormalizedAuthority,
  NormalizedAuthorityInconsistent,
} from '@/lib/durableDm/familyAuthorityNormalizer';
import {
  DURABLE_FAMILY_REGISTRY,
  registeredAdapters,
  enabledAdapters,
} from '@/lib/durableDm/familyRegistry';
import {
  OBJECT_STORE_NAMES,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import * as localDatabaseModule from '@/lib/indexeddb/localDatabase';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import { selectCampaignSettings } from '@/lib/indexeddb/campaignSettingsSelection';
import { createBrowserDmWorkspace } from '@/lib/supabase/browserDmWorkspace';
import { expectCloudProductVocabulary } from '@/test/helpers';
import { forkCampaignToCloudLabel } from '@/components/ui/campaign/dmCloudWorkspaceLabels';
import { APP_VERSION } from '@/utils/constants';

import { MigrationWizard } from './index';
import { useMigrationWizard } from './MigrationWizard.hooks';
import type { FamilyRunOutcome } from './MigrationWizard.types';

vi.mock('@/lib/supabase/browserDmWorkspace', () => ({
  createBrowserDmWorkspace: vi.fn(),
}));

// Ruling: Task 15's production-registry tests (`renderWizardWithProductionRegistry`)
// need the REAL `registeredAdapters`/`enabledAdapters` implementations back
// after other tests have overridden the mock's return value. `vi.hoisted`
// is the supported way to hand a value computed inside a hoisted `vi.mock`
// factory back to the test body.
const familyRegistryHolder = vi.hoisted(() => ({
  actual: undefined as
    | Pick<
        typeof import('@/lib/durableDm/familyRegistry'),
        'registeredAdapters' | 'enabledAdapters'
      >
    | undefined,
}));

vi.mock('@/lib/durableDm/familyRegistry', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/durableDm/familyRegistry')>();
  familyRegistryHolder.actual = actual;
  return {
    ...actual,
    registeredAdapters: vi.fn(actual.registeredAdapters),
    enabledAdapters: vi.fn(actual.enabledAdapters),
  };
});

vi.mock('@/lib/deviceRecovery', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/deviceRecovery')>();
  return {
    ...actual,
    captureDeviceBackup: vi.fn(actual.captureDeviceBackup),
    initiateDeviceBackupDownload: vi.fn(actual.initiateDeviceBackupDownload),
    verifyDownloadedDeviceBackup: vi.fn(actual.verifyDownloadedDeviceBackup),
  };
});

const mockedCreateBrowserDmWorkspace = vi.mocked(createBrowserDmWorkspace);
const mockedRegisteredAdapters = vi.mocked(registeredAdapters);
const mockedEnabledAdapters = vi.mocked(enabledAdapters);
const mockedCaptureDeviceBackup = vi.mocked(captureDeviceBackup);

// Real, un-stubbed WebCrypto SHA-256 hashing (`captureDeviceBackup`,
// `verifyDownloadedDeviceBackup`) can occasionally run past
// testing-library's default 1000ms `findBy*`/`waitFor` timeout under system
// load — this is patience for genuine async crypto work, not a masked race.
// `testTimeout` is raised well above `asyncUtilTimeout` so a slow crypto call
// reddens with THIS timeout's message, not vitest's own bare "Test timed out".
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 15000, hookTimeout: 15000 });

const FIXED_TS = '2026-08-24T00:00:00.000Z';
const FIXED_RUN_ID = '99999999-9999-4999-8999-999999999999';
/** Ruling R9.2: names the behavioural number instead of a bare literal. */
const MIGRATION_NARROW_VIEWPORT_PX = 390;

// ---------------------------------------------------------------------
// Test-only infrastructure. `renderRunController` reconciles the brief's four
// call shapes into one coherent helper — see the task report for the full
// writeup of that reconciliation and its relation to `useMigrationWizard`.
// ---------------------------------------------------------------------

/**
 * A previous test's unmounted component can leave an async IndexedDB read
 * (e.g. the mount-time recovery capture effect) still in flight for a beat
 * after `cleanup()` — unmounting sets `cancelled = true` inside the effect,
 * which blocks further STATE updates, but does not abort the in-flight
 * promise or close its connection early. If `deleteDatabase` races that
 * connection, `onblocked` fires. Per the IndexedDB spec the delete request
 * is NOT abandoned when blocked — it stays pending and still fires
 * `onsuccess` once every blocking connection closes on its own — so this
 * must NOT resolve early on `onblocked` (an earlier version did, which
 * silently abandoned the wait and let a stale database leak into the next
 * test — the source of an intermittent ~4% flake this fix eliminated).
 */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    // Deliberately no early resolve here — see doc comment above.
  });
}

/**
 * Covers localStorage plus every `rollkeeper-local` object store — correct
 * and sufficient for R2a's claim (step 0 never touches authority, marker,
 * pointer or selection state, all of which live there). Deliberately does
 * NOT cover `rollkeeper-recovery` (download receipts) — a later task must
 * not assume this snapshot is total; it is scoped to exactly what R2a makes
 * a claim about.
 */
async function snapshotDurableState(): Promise<string> {
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
}

async function openRecoveryDatabaseForTests(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rollkeeper-recovery', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function verifiedReceiptCount(): Promise<number> {
  const database = await openRecoveryDatabaseForTests();
  try {
    const transaction = database.transaction('downloadReceipts', 'readonly');
    const all = await requestResult<{ verifiedAt?: string }[]>(
      transaction.objectStore('downloadReceipts').getAll()
    );
    await transactionComplete(transaction);
    return all.filter(entry => typeof entry.verifiedAt === 'string').length;
  } finally {
    database.close();
  }
}

/** Spec R15's third resume property: every receipt currently on record, verified or not -- used to assert no orphaned initiated-only receipt survives a reload. */
async function allDownloadReceipts(): Promise<
  { runId: string; manifestHash: string; verifiedAt?: string }[]
> {
  const database = await openRecoveryDatabaseForTests();
  try {
    const transaction = database.transaction('downloadReceipts', 'readonly');
    const all = await requestResult<
      { runId: string; manifestHash: string; verifiedAt?: string }[]
    >(transaction.objectStore('downloadReceipts').getAll());
    await transactionComplete(transaction);
    return all;
  } finally {
    database.close();
  }
}

/**
 * Seeds the persisted `migration-state:<namespace>:<family>:<campaignId>`
 * checkpoint every `run*IndexedDbMigration` writes on reaching
 * `CUTOVER_READY` (`adapters/shared.ts`'s `verifyPreparedGeneration` reads
 * the identical key). Used to prove `deriveFamilyStepState`'s `prepared`
 * branch renders from this REAL persisted record, not an invented
 * client-side flag.
 */
async function seedPreparedCheckpoint(options: {
  family: DurableFamilyName;
  namespace: string;
  campaignId: string;
  runId: string;
}) {
  const database = await openRollkeeperDatabase();
  try {
    const transaction = database.transaction('meta', 'readwrite');
    transaction.objectStore('meta').put({
      key: `migration-state:${options.namespace}:${options.family}:${options.campaignId}`,
      state: 'CUTOVER_READY',
      runId: options.runId,
    });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function currentDeviceHash(): Promise<string> {
  const bundle = await captureDeviceBackup(window.localStorage, {
    appVersion: APP_VERSION,
    runId: 'hash-probe',
    timestamp: FIXED_TS,
  });
  return bundle.manifestHash;
}

async function currentEntryCount(): Promise<number> {
  const bundle = await captureDeviceBackup(window.localStorage, {
    appVersion: APP_VERSION,
    runId: 'hash-probe',
    timestamp: FIXED_TS,
  });
  return bundle.entries.length;
}

async function storedReceiptEntries(runId: string) {
  const hash = await currentDeviceHash();
  const receipt =
    await browserRecoveryRepository.readVerifiedDownloadReceipt(hash);
  if (!receipt || receipt.runId !== runId) return [];
  return receipt.entries ?? [];
}

async function seedVerifiedReceipt({
  runId,
  manifestHash,
}: {
  runId: string;
  manifestHash: string;
}) {
  const bundle = await captureDeviceBackup(window.localStorage, {
    appVersion: APP_VERSION,
    runId,
    timestamp: FIXED_TS,
  });
  await browserRecoveryRepository.recordDownloadReceipt({
    runId,
    manifestHash,
    initiatedAt: FIXED_TS,
    entries: bundle.entries.map(({ key, byteCount, sha256 }) => ({
      key,
      byteCount,
      sha256,
    })),
  });
  await browserRecoveryRepository.verifyDownloadReceipt({
    runId,
    manifestHash,
    verifiedAt: FIXED_TS,
  });
}

async function seedVerifiedReceiptWithoutEntries({
  runId,
  manifestHash,
}: {
  runId: string;
  manifestHash: string;
}) {
  await browserRecoveryRepository.recordDownloadReceipt({
    runId,
    manifestHash,
    initiatedAt: FIXED_TS,
  });
  await browserRecoveryRepository.verifyDownloadReceipt({
    runId,
    manifestHash,
    verifiedAt: FIXED_TS,
  });
}

async function seedInitiatedOnlyReceipt({
  runId,
  manifestHash,
}: {
  runId: string;
  manifestHash: string;
}) {
  await browserRecoveryRepository.recordDownloadReceipt({
    runId,
    manifestHash,
    initiatedAt: FIXED_TS,
  });
}

async function bundleFile(): Promise<File> {
  const bundle = await captureDeviceBackup(window.localStorage, {
    appVersion: APP_VERSION,
    runId: FIXED_RUN_ID,
    timestamp: FIXED_TS,
  });
  return new File([JSON.stringify(bundle)], 'backup.json', {
    type: 'application/json',
  });
}

async function staleBundleFile(): Promise<File> {
  const bundle = await captureDeviceBackup(
    new Map([
      [
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-local', campaigns: [] },
          version: 1,
        }),
      ],
    ]),
    { appVersion: APP_VERSION, runId: 'stale-run', timestamp: FIXED_TS }
  );
  return new File([JSON.stringify(bundle)], 'backup.json', {
    type: 'application/json',
  });
}

async function renderWizardAtRecoveryStep() {
  render(<MigrationWizard campaignCode="ALPHA" />);
  // Waits for the button to be ENABLED, not merely present: the button
  // renders immediately but stays disabled until the async mount-time
  // recovery capture resolves `recovery.bundle`. A caller that clicks
  // "Download" or uploads a file before that resolves races a silent no-op
  // (`selectBundleFile` early-returns on `!recovery.bundle`) — invisible
  // under light load (the capture usually wins the race) but a genuine,
  // unbounded hang under heavy load, since the awaited text can then never
  // appear at all. This was the actual root cause of an intermittent hang
  // this suite exposed under a full ~460-file parallel run — no timeout
  // value fixes a race that can only ever resolve one way.
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /download/i })).toBeEnabled()
  );
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

/**
 * Coordinator review round 3, item 1: walks ANCESTORS (the original
 * pattern, inherited from Task 14) plus DESCENDANTS. The ancestor-only walk
 * catches `truncate` on the alert container, but a real truncation
 * regression is just as likely -- more likely -- on the inner detail `<p>`
 * that actually carries the long copy a narrow column would clip, and that
 * element is a DESCENDANT of `element`, never an ancestor. Fixed in this
 * one shared helper so Task 14's own 390px test (which calls it too) gets
 * the same fix.
 */
function assertNoTruncationClasses(element: Element) {
  // `getAttribute('class')`, not `.className`: an SVG descendant's
  // `.className` is an `SVGAnimatedString` object, not a plain string, and
  // this alert content includes icon `<svg>`s -- `.not.toMatch(...)` on that
  // object would throw rather than assert. `getAttribute` is a plain string
  // (or null) for every element, HTML or SVG alike.
  let node: Element | null = element;
  while (node) {
    expect(node.getAttribute('class') ?? '').not.toMatch(
      /truncate|line-clamp-|overflow-hidden/
    );
    node = node.parentElement;
  }
  for (const descendant of Array.from(element.querySelectorAll('*'))) {
    expect(descendant.getAttribute('class') ?? '').not.toMatch(
      /truncate|line-clamp-|overflow-hidden/
    );
  }
}

function defaultOwnerContext(accountId = 'account-1') {
  return {
    accountId,
    accountLabel: 'Owner',
    list: vi.fn(async (): Promise<DmWorkspaceDocument[]> => []),
    discover: vi.fn(async (): Promise<DmWorkspaceDocument[]> => []),
    remember: vi.fn(async (workspace: DmWorkspaceDocument): Promise<void> => {
      void workspace;
    }),
    create: vi.fn(),
    forkLegacy: vi.fn(),
    close: vi.fn(),
  };
}

function workspaceFor(
  code: string,
  options: { accountId?: string; cloudId?: string | null } = {}
): DmWorkspaceDocument {
  const accountId = options.accountId ?? 'account-1';
  return {
    namespace: `user:${accountId}` as const,
    localId: `legacy:${code}`,
    legacyId: `legacy:${code}`,
    name: `Campaign ${code}`,
    creationKind: 'import_fork',
    sourceFingerprint: 'source',
    createdAt: FIXED_TS,
    family: 'workspace_identity',
    // `IndexedDbDmWorkspaceRepository.commitCreate` writes `cloudId: null`
    // for every locally created or forked workspace until the server
    // acknowledges it (dmWorkspaceRepository.ts:84) — a queued-but-not-yet-
    // cloud-linked workspace is a real, reachable state, not a synthetic
    // one (item 5, coordinator review round 1). NOTE (round 2, noted-no-action):
    // a real queued record also carries `displayCode: null` and
    // `acknowledgedAt: null` — this fixture leaves both non-null, which is
    // irrelevant to the `cloudId` guard the test targets but is not a fully
    // faithful queued-record shape.
    cloudId: options.cloudId !== undefined ? options.cloudId : `cloud-${code}`,
    displayCode: 'A1B2C3D4E5F6',
    membershipAuthority: 'legacy',
    familyAuthorities: 'legacy',
    liveRuntimeAuthority: 'redis_relay',
    acknowledgedAt: FIXED_TS,
  };
}

const cutoverSpies = new Map<DurableFamilyName, ReturnType<typeof vi.fn>>();

function cutoverInvocationOrder(family: DurableFamilyName): number {
  const spy = cutoverSpies.get(family);
  if (!spy || spy.mock.invocationCallOrder.length === 0)
    throw new Error(`No cutover recorded for ${family}`);
  return spy.mock.invocationCallOrder[0];
}

// ---------------------------------------------------------------------
// Task 15 stub-adapter extensions. `stubAdapter` now carries a small,
// in-memory NormalizedAuthority per instance (never storage-backed —
// exactly what a stub should be) so that `readAuthority` reflects what
// `commitLocalCutover`/`activateCloud`/`repairAuthority` actually did on
// THIS instance, rather than a fixed literal that could never change. Test
// helpers below read and mutate this shared, module-level state; every one
// of them is reset in `beforeEach`.
// ---------------------------------------------------------------------

const DEFAULT_STUB_AUTHORITY: NormalizedAuthority = {
  state: 'legacy',
  epoch: 0,
  campaignId: null,
  accountId: null,
  rolledBack: false,
};

/**
 * Families for which the NEXT `activateCloud` call reports a conflict, and
 * the REAL `CloudActivationConflictReason` it reports.
 *
 * Final fix wave, F1: this used to be a bare `Set` and the stub answered with
 * the polished sentence `'Cloud sync is temporarily unavailable. Try again
 * later.'` — prose no adapter has ever produced. That made the R17 assertion
 * below validate the STUB, while production rendered the raw token
 * `cloud-generation-diverged` to the DM. `CloudActivationOutcome.reason` is
 * now the closed union, so this map can only hold values the real protocol
 * produces (and the old prose is a compile error, not a silent divergence).
 */
const cloudFailures = new Map<
  DurableFamilyName,
  CloudActivationConflictReason
>();
/** One entry per `selectFamily` call, in invocation order, across every family. */
const selectLog: { family: DurableFamilyName; runId: string }[] = [];
/**
 * Seeded `inconsistent` authorities for `seedMarkerPointerDisagreement` /
 * `seedMarkerAheadOfPointer` (ruling R9.9). Consulted lazily by
 * `readAuthority`/`repairAuthority` so seeding may happen before OR after
 * the stub adapter instance is created.
 */
const inconsistentSeeds = new Map<
  DurableFamilyName,
  NormalizedAuthorityInconsistent
>();
/** Counts calls into `activateCloud`, standing in for the real begin-staging RPC (no fake server here — see report). */
const apiActionCounts = new Map<string, number>();

// ---------------------------------------------------------------------
// Task 16 stub-adapter extensions (report / verification). All reset in
// `beforeEach`.
// ---------------------------------------------------------------------

/** Registered families whose stub `isVisible()` currently reports `false` (spec R13's "disabled registered family"). */
const disabledStubFamilies = new Set<DurableFamilyName>();
/** Every `verifyCloud` call, in order, across every family — the `verifySpy` the brief's pseudocode calls a bare spy. */
const verifyCloudCalls: DurableFamilyName[] = [];
/** A caller-supplied `FamilyVerification` a family's NEXT (and every subsequent, until cleared) `verifyCloud` call returns instead of the authority-derived default. */
const verificationOverrides = new Map<DurableFamilyName, FamilyVerification>();
/** Task 16 fix round 1, CRITICAL item 1: makes a family's NEXT `verifyCloud` call REJECT instead of resolving, for the "a failed check must not leave a stale claim standing" tests. */
const verificationThrows = new Map<DurableFamilyName, string>();
function throwVerificationFor(
  family: DurableFamilyName,
  message = 'IndexedDB is unavailable.'
) {
  verificationThrows.set(family, message);
}
/**
 * One-shot deferred `verifyCloud` responses, consumed in FIFO order per
 * family: the NEXT call to that family's `verifyCloud` returns a promise
 * only `resolve()` settles, and every call after that one falls back to the
 * override/default as normal. Models `deferVerification` from the brief's
 * pseudocode.
 */
const deferredVerificationQueue = new Map<
  DurableFamilyName,
  {
    promise: Promise<FamilyVerification>;
    resolve: (value: FamilyVerification) => void;
  }[]
>();

function disableFamily(family: DurableFamilyName) {
  disabledStubFamilies.add(family);
}

function verifySpyCallCount(): number {
  return verifyCloudCalls.length;
}

function failVerificationFor(family: DurableFamilyName) {
  verificationOverrides.set(family, {
    authorityAgrees: true,
    cloudAuthority: 'postgres',
    epoch: 1,
    recordCount: 1,
    documentsMatch: false,
    tombstonesMatch: true,
    outboxEmpty: true,
    conflictCount: 0,
    verified: false,
  });
}

function deferVerification(family: DurableFamilyName): {
  resolve: (value: FamilyVerification) => void;
} {
  let resolveFn!: (value: FamilyVerification) => void;
  const promise = new Promise<FamilyVerification>(resolve => {
    resolveFn = resolve;
  });
  const queue = deferredVerificationQueue.get(family) ?? [];
  queue.push({ promise, resolve: value => resolveFn(value) });
  deferredVerificationQueue.set(family, queue);
  return { resolve: value => resolveFn(value) };
}

/** Restores the transport for a family whose cloud call was made to fail. */
function restoreCloudFor(family: DurableFamilyName) {
  cloudFailures.delete(family);
}

function failCloudFor(
  family: DurableFamilyName,
  reason: CloudActivationConflictReason = 'cloud-generation-diverged'
) {
  cloudFailures.set(family, reason);
}

function countApiCalls(action: string): number {
  return apiActionCounts.get(action) ?? 0;
}

function selectionRecoveryRunIds(): string[] {
  return selectLog.map(entry => entry.runId);
}

async function selectionRecordFor(
  family: DurableFamilyName
): Promise<{ runId: string } | null> {
  const found = [...selectLog].reverse().find(entry => entry.family === family);
  return found ? { runId: found.runId } : null;
}

/**
 * R9.9: the pointer-ahead-at-`indexedDB` case — the only seed from which an
 * `indexedDB` repair outcome is reachable (spec R5b row 2). The marker is
 * absent (never written) and the pointer is ahead, exactly the shape an
 * interruption between `commitLocalCutover`'s two writes leaves behind.
 */
async function seedMarkerPointerDisagreement(
  family: DurableFamilyName
): Promise<void> {
  inconsistentSeeds.set(family, {
    state: 'inconsistent',
    epoch: 0,
    campaignId: null,
    accountId: null,
    rolledBack: false,
    reason: 'marker-pointer-disagreement',
    observed: {
      marker: null,
      pointer: {
        authority: 'indexedDB',
        epoch: 1,
      } as unknown as AuthorityPointerView,
    },
  });
}

/**
 * R9.9: the block case — the marker is ahead of the pointer (which is
 * absent). Spec R5b row 1: a marker with nothing behind it in IndexedDB is
 * never evidence of a completed migration, so this can never repair.
 */
async function seedMarkerAheadOfPointer(
  family: DurableFamilyName
): Promise<void> {
  inconsistentSeeds.set(family, {
    state: 'inconsistent',
    epoch: 0,
    campaignId: null,
    accountId: null,
    rolledBack: false,
    reason: 'marker-pointer-disagreement',
    observed: {
      marker: { authority: 'indexedDB', epoch: 1, campaignId: 'campaign-x' },
      pointer: null,
    },
  });
}

function stubAdapter(
  family: DurableFamilyName,
  options: {
    onCutover?: () => void;
    /** Coordinator review, Important 6: non-zero by default so the manifest card, its stats and the `blocked` branch are exercised, not falsified by an always-empty stub. */
    manifest?: {
      recordCount?: number;
      totalBytes?: number;
      blockers?: FamilyManifestHandle['blockers'];
      records?: FamilyManifestHandle['records'];
    };
    /** Coordinator review, Important 5/6: makes `previewManifest` reject, exercising the `loadError` alert. */
    previewError?: string;
    /** Coordinator review, Important 6: pre-seeds the closured authority (e.g. a completed rollback), without needing to drive `rollback()` through a real context first. */
    initialAuthority?: NormalizedAuthority;
  } = {}
): DurableFamilyAdapter {
  const manifest: FamilyManifestHandle = {
    family,
    fingerprint: `${family}-fingerprint`,
    recordCount: options.manifest?.recordCount ?? 3,
    totalBytes: options.manifest?.totalBytes ?? 4096,
    blockers: options.manifest?.blockers ?? [],
    records: options.manifest?.records ?? [
      {
        legacyId: `${family}-1`,
        schemaVersion: 1,
        byteCount: 128,
        payloadFingerprint: 'payload-fingerprint',
        tombstoned: false,
        references: [{ family: 'campaign_settings', legacyId: 'ref-1' }],
      },
    ],
    native: null,
  };
  const cutoverSpy = vi.fn(() => options.onCutover?.());
  cutoverSpies.set(family, cutoverSpy);

  // `null` means "no real operation has happened yet on this instance" —
  // `currentAuthority()` then falls back to a pending inconsistent seed, or
  // the default legacy state. Once any operation below sets it, it wins
  // permanently over any seed (mirroring how a real repair/cutover
  // supersedes a stale seeded disagreement).
  let authority: NormalizedAuthority | null = options.initialAuthority ?? null;
  const currentAuthority = (): NormalizedAuthority =>
    authority ?? inconsistentSeeds.get(family) ?? DEFAULT_STUB_AUTHORITY;

  return {
    family,
    label: family,
    isVisible: () => !disabledStubFamilies.has(family),
    previewManifest: async () => {
      if (options.previewError) throw new Error(options.previewError);
      return manifest;
    },
    confirmation: () => ({
      familyLabel: family,
      campaignLabel: 'Campaign',
      manifestFingerprint: manifest.fingerprint,
      requiredPhrase: `move ${family}`,
    }),
    selectFamily: async (context: MigrationRunContext) => {
      selectLog.push({ family, runId: context.recovery.runId });
    },
    prepareIndexedDb: async (context: MigrationRunContext) => {
      // Final fix wave, D1: mirrors what `run*IndexedDbMigration` really
      // does. Once this browser already owns the data category locally,
      // preparation refuses -- that refusal (surfaced by every adapter as
      // "Local IndexedDB preparation did not satisfy every safety gate") is
      // what stranded a category whose cloud call had failed. A stub that
      // always returns CUTOVER_READY cannot reproduce the gate's defect.
      //
      // Scoped to the account/campaign the cutover was committed FOR, like
      // the real pointer (which is keyed by namespace + campaignId): this
      // one stub instance is reused across campaign and account switches by
      // the R10 remember tests, and a real adapter would see legacy
      // authority in both of those.
      const committed = currentAuthority();
      if (
        (committed.state === 'indexedDB' || committed.state === 'postgres') &&
        committed.campaignId === context.campaignId &&
        committed.accountId === context.accountId
      )
        throw new Error(
          'Local IndexedDB preparation did not satisfy every safety gate.'
        );
      return {
        state: 'CUTOVER_READY' as const,
        generation: 'gen-1',
        manifest,
      };
    },
    commitLocalCutover: async (context: MigrationRunContext) => {
      await context.ensureWorkspaceRemembered();
      cutoverSpy();
      authority = {
        state: 'indexedDB',
        epoch: 1,
        campaignId: context.campaignId,
        accountId: context.accountId,
        rolledBack: false,
      };
      return { epoch: 1 };
    },
    activateCloud: async (context: MigrationRunContext) => {
      apiActionCounts.set(
        'begin-staging',
        (apiActionCounts.get('begin-staging') ?? 0) + 1
      );
      const failureReason = cloudFailures.get(family);
      if (failureReason !== undefined) {
        return { status: 'conflict' as const, reason: failureReason };
      }
      authority = {
        state: 'postgres',
        epoch: 1,
        campaignId: context.campaignId,
        accountId: context.accountId,
        rolledBack: false,
      };
      return { status: 'activated' as const, epoch: 1 };
    },
    // Task 16: records the call (`verifySpyCallCount`), serves one queued
    // `deferVerification` response FIFO if one is pending, else a per-test
    // `verificationOverrides` value, else a default DERIVED from this
    // instance's own current authority (so a family that never left legacy
    // is correctly unverified by default, not vacuously `verified: true`).
    verifyCloud: async () => {
      verifyCloudCalls.push(family);
      // One-shot, like the deferred queue below: consumed by the NEXT call
      // only, so a family can succeed, then fail once, then succeed again.
      const throwMessage = verificationThrows.get(family);
      if (throwMessage !== undefined) {
        verificationThrows.delete(family);
        throw new Error(throwMessage);
      }
      const queue = deferredVerificationQueue.get(family);
      if (queue && queue.length > 0) {
        const entry = queue.shift()!;
        return entry.promise;
      }
      const override = verificationOverrides.get(family);
      if (override) return override;
      const current = currentAuthority();
      const routed = current.state === 'postgres';
      return {
        authorityAgrees: current.state !== 'inconsistent',
        cloudAuthority: routed ? 'postgres' : 'legacy',
        epoch: current.epoch,
        recordCount: manifest.recordCount,
        documentsMatch: routed,
        tombstonesMatch: routed,
        outboxEmpty: true,
        conflictCount: 0,
        verified: routed,
      };
    },
    readAuthority: async () => currentAuthority(),
    rollback: async (context: MigrationRunContext) => {
      // Observable, like a real rollback: sets legacy/rolledBack so a
      // mutation that calls this from `activateCloud`'s failure path is
      // actually detectable via `readAuthority`, not a silent no-op.
      authority = {
        state: 'legacy',
        epoch: 2,
        campaignId: context.campaignId,
        accountId: context.accountId,
        rolledBack: true,
      };
      return { epoch: 2 };
    },
    repairAuthority: async () => {
      const current = currentAuthority();
      if (current.state !== 'inconsistent') return current;
      // Reuses the REAL R5b decision engine (`authorityRepair.ts`), not a
      // re-derived stand-in: only the evidence-gathering (which a real
      // adapter would do against IndexedDB/the cloud) is faked here.
      const decision = await decideAuthorityRepair({
        reason: current.reason,
        observed: current.observed,
        evidence: {
          verifyIndexedDbGeneration: async () => true,
          verifyPostgresParity: async () => true,
        },
      });
      if (decision.action === 'block') {
        throw new Error(decision.reason);
      }
      authority = {
        state: decision.authority,
        epoch: decision.epoch,
        campaignId: 'campaign-x',
        accountId: 'account-1',
        rolledBack: false,
      };
      inconsistentSeeds.delete(family);
      return authority;
    },
  };
}

const ALL_STUB_FAMILIES: DurableFamilyName[] = [
  'campaign_settings',
  'calendar',
  'magic_item',
  'npc',
  'encounter_definition',
  'combat_log_archive',
];

let stubFamiliesCache: DurableFamilyAdapter[] | null = null;

/** Same six stub instances for the whole test, so authority set by one call persists across "reload". */
function stubFamilies(): DurableFamilyAdapter[] {
  if (!stubFamiliesCache) {
    stubFamiliesCache = ALL_STUB_FAMILIES.map(family => stubAdapter(family));
  }
  return stubFamiliesCache;
}

const FAMILY_FLAG_VARS: Record<DurableFamilyName, string> = {
  campaign_settings: 'NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE',
  calendar: 'NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE',
  magic_item: 'NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE',
  npc: 'NEXT_PUBLIC_NPC_SYNC_VISIBLE',
  encounter_definition: 'NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE',
  combat_log_archive: 'NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE',
};

/** Ruling R9.3-alike: leaves every family's client flag in a known state, restored in `afterEach`. */
function disableAllFamiliesExcept(family: DurableFamilyName) {
  for (const [candidate, envVar] of Object.entries(FAMILY_FLAG_VARS)) {
    process.env[envVar] = candidate === family ? 'true' : 'false';
  }
}

function confirmationPhraseFor(family: DurableFamilyName): string {
  return `move ${family}`;
}

/** Mirrors `steps/RecoveryStep.tsx`/`steps/FamilyStep.tsx`'s own `FINGERPRINT_DISPLAY_LENGTH`/`shortHash` truncation, so a test can compute the expected on-screen value instead of asserting a literal. */
const FINGERPRINT_DISPLAY_LENGTH_FOR_TEST = 12;
function shortHashForTest(hash: string): string {
  return hash.length > FINGERPRINT_DISPLAY_LENGTH_FOR_TEST
    ? `${hash.slice(0, FINGERPRINT_DISPLAY_LENGTH_FOR_TEST)}…`
    : hash;
}

/**
 * A minimal, directly-usable `MigrationRunContext` for calling an adapter's
 * own methods (e.g. `previewManifest`) straight from a test, without going
 * through the rendered wizard. Matches what `renderRunController`'s
 * fallback context builds. Deliberately NOT family-scoped -- every stub
 * adapter shares this same fixed account/campaign/recovery shape, and
 * `family` only ever selects WHICH adapter instance to call it against
 * (the caller's job, not this builder's), so a `family` parameter here
 * would be decorative.
 */
async function minimalMigrationRunContext(): Promise<MigrationRunContext> {
  const hash = await currentDeviceHash();
  return {
    accountId: 'account-1',
    campaignId: 'cloud-ALPHA',
    campaignCode: 'ALPHA',
    workspace: workspaceFor('ALPHA'),
    recovery: {
      format: 'rollkeeper-device-backup',
      formatVersion: 1,
      appVersion: APP_VERSION,
      runId: 'run-1',
      createdAt: FIXED_TS,
      entries: [],
      manifestHash: hash,
      validation: {
        entryCount: 0,
        totalBytes: 0,
        validJsonCount: 0,
        malformedJsonCount: 0,
        futureVersionCount: 0,
        retainedOnlyCount: 0,
      },
    },
    ensureWorkspaceRemembered: async () => {},
  };
}

function familyHeadingLabel(
  family: DurableFamilyName | 'location' | 'battle_map'
): string {
  const entry = DURABLE_FAMILY_REGISTRY.find(
    candidate => candidate.family === family
  );
  if (!entry) throw new Error(`Unknown data category: ${family}`);
  return entry.label;
}

/** The RTL render currently mounted by a Task 15 helper, if any -- `null` after `cleanup()`/unmount. */
let currentRender: ReturnType<typeof render> | null = null;

/** Unmounts whatever is currently rendered (if anything) and clears `currentRender`, ready for the next helper to mount fresh. */
function unmountCurrentRender() {
  currentRender?.unmount();
  currentRender = null;
}

/** Clicks Continue until the named family's heading is on screen, mounting nothing itself. */
async function clickContinueUntil(label: string) {
  for (
    let attempt = 0;
    attempt <= DURABLE_FAMILY_REGISTRY.length;
    attempt += 1
  ) {
    if (screen.queryByRole('heading', { name: label })) return;
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  }
  throw new Error(`Never reached step: ${label}`);
}

/** Mounts with the given adapter set, resumed onto a pre-verified receipt (no download/upload). */
async function mountStubWizardResumedWithAdapters(
  adapters: DurableFamilyAdapter[]
) {
  await seedVerifiedReceipt({
    runId: 'run-1',
    manifestHash: await currentDeviceHash(),
  });
  mockedRegisteredAdapters.mockReturnValue(adapters);
  mockedEnabledAdapters.mockImplementation(() =>
    mockedRegisteredAdapters().filter(adapter => adapter.isVisible())
  );
  mockedCreateBrowserDmWorkspace.mockResolvedValue({
    ...defaultOwnerContext(),
    list: vi.fn(async () => [workspaceFor('ALPHA')]),
  });
  currentRender = render(<MigrationWizard campaignCode="ALPHA" />);
  await userEvent.click(
    screen.getByRole('button', { name: /find my campaigns/i })
  );
  await screen.findByText(/connected to campaign alpha/i);
  await screen.findByText(/safety copy is ready/i);
}

/** Mounts with the six shared stub families, resumed onto a pre-verified receipt (no download/upload). */
async function mountStubWizardResumed() {
  await mountStubWizardResumedWithAdapters(stubFamilies());
}

/** Renders/resumes at a given family's step against a CUSTOM adapter set (e.g. one adapter with a non-default manifest), instead of the shared six-family cache. */
async function renderWizardAtFamilyStepWithAdapters(
  adapters: DurableFamilyAdapter[],
  family: DurableFamilyName
) {
  await mountStubWizardResumedWithAdapters(adapters);
  await clickContinueUntil(familyHeadingLabel(family));
}

/** Mounts with the six stub families, driving a REAL download-then-upload so the initiate/verify call counts stay exactly 1. */
async function mountStubWizardWithRealBundle() {
  mockedRegisteredAdapters.mockReturnValue(stubFamilies());
  mockedEnabledAdapters.mockImplementation(() =>
    mockedRegisteredAdapters().filter(adapter => adapter.isVisible())
  );
  mockedCreateBrowserDmWorkspace.mockResolvedValue({
    ...defaultOwnerContext(),
    list: vi.fn(async () => [workspaceFor('ALPHA')]),
  });
  currentRender = render(<MigrationWizard campaignCode="ALPHA" />);
  await userEvent.click(
    screen.getByRole('button', { name: /find my campaigns/i })
  );
  await screen.findByText(/connected to campaign alpha/i);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /download/i })).toBeEnabled()
  );
  await userEvent.click(screen.getByRole('button', { name: /download/i }));
  await userEvent.upload(
    screen.getByLabelText(/safety copy/i),
    await bundleFile()
  );
  await screen.findByText(/checked.*every entry matches/i);
}

/** Renders/resumes at a given family's step (stub families), mounting if nothing is mounted yet. */
async function renderWizardAtFamilyStep(family: DurableFamilyName) {
  await mountStubWizardResumed();
  await clickContinueUntil(familyHeadingLabel(family));
}

/** Navigates to a family's step, mounting a resumed stub-backed wizard first if nothing is mounted yet. */
async function advanceToFamily(
  family: DurableFamilyName | 'location' | 'battle_map'
) {
  if (!currentRender) await mountStubWizardResumed();
  await clickContinueUntil(familyHeadingLabel(family));
}

/** Types the confirmation phrase and submits, waiting for the real completion signal (the button leaving its loading-disabled state, or disappearing on success) rather than any static copy. */
async function confirmAndSubmit(
  family: DurableFamilyName
): Promise<{ ok: boolean }> {
  const input = await screen.findByLabelText(/type .* to confirm/i);
  await userEvent.clear(input);
  await userEvent.type(input, confirmationPhraseFor(family));
  const button = await screen.findByRole('button', {
    name: /move this data to cloud sync/i,
  });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  await waitFor(() => {
    const stillPresent = screen.queryByRole('button', {
      name: /move this data to cloud sync/i,
    });
    if (stillPresent) expect(stillPresent).toBeEnabled();
  });
  const failed =
    screen.queryByText(/saved only in this browser/i) !== null ||
    screen.queryByText(/this browser.s data changed/i) !== null;
  return { ok: !failed };
}

/** Runs the wizard through each named family in order: navigate, confirm, submit. Stops at the first failure, leaving later families untouched. */
async function runWizardThroughFamilies(families: DurableFamilyName[]) {
  if (!currentRender) await mountStubWizardWithRealBundle();
  for (const family of families) {
    await clickContinueUntil(familyHeadingLabel(family));
    const result = await confirmAndSubmit(family);
    if (!result.ok) break;
  }
}

/** Simulates a close-and-reopen: unmounts the current render and re-mounts, resuming onto the same verified receipt. */
async function reloadWizard() {
  currentRender?.unmount();
  currentRender = null;
  await mountStubWizardResumed();
}

/** Reads a legacy localStorage key's raw value directly (async only for a consistent helper shape). */
async function legacyKeySnapshot(key: string): Promise<string | null> {
  return localStorage.getItem(key);
}

/** Changes a captured legacy key's value, simulating a genuine legacy-family mutation mid-run (spec R3). */
function mutateCapturedKey(key: string) {
  const previous = localStorage.getItem(key);
  localStorage.setItem(
    key,
    JSON.stringify({
      state: { mutatedAt: FIXED_TS, previousLength: previous?.length ?? 0 },
      version: 1,
    })
  );
}

/** Reads a family's current authority from whichever adapter set is currently mocked in (stub or production). */
async function authorityOf(
  family: DurableFamilyName
): Promise<NormalizedAuthority> {
  const adapter = mockedRegisteredAdapters().find(
    candidate => candidate.family === family
  );
  if (!adapter) throw new Error(`No adapter registered for ${family}`);
  return adapter.readAuthority({
    accountId: 'account-1',
    campaignId: 'cloud-ALPHA',
    campaignCode: 'ALPHA',
  });
}

/** Renders with exactly `count` registered (stub) families -- 0, 1 or 6 -- and nothing else set up (no discovery, no recovery). */
function renderWizardWithRegisteredAdapters(count: number) {
  const stubs = ALL_STUB_FAMILIES.slice(0, count).map(family =>
    stubAdapter(family)
  );
  mockedRegisteredAdapters.mockReturnValue(stubs);
  mockedEnabledAdapters.mockImplementation(() =>
    mockedRegisteredAdapters().filter(adapter => adapter.isVisible())
  );
  return render(<MigrationWizard campaignCode="ALPHA" />);
}

/** Renders against the REAL six-adapter registry (client-flag state controls `isVisible()`, never the family count). */
function renderWizardWithProductionRegistry() {
  if (!familyRegistryHolder.actual)
    throw new Error('Real family registry module was not captured');
  mockedRegisteredAdapters.mockImplementation(
    familyRegistryHolder.actual.registeredAdapters
  );
  mockedEnabledAdapters.mockImplementation(
    familyRegistryHolder.actual.enabledAdapters
  );
  return render(<MigrationWizard campaignCode="ALPHA" />);
}

/**
 * Reconciles the brief's four call shapes (a bare controller, one with
 * `remember`, one with `adapters`, one with `campaignCode`) into one options
 * object. Relation to `useMigrationWizard`: this is a thin test harness
 * around the SAME hook the shipped `<MigrationWizard>` renders
 * (`renderHook(({code}) => useMigrationWizard(code), ...)`) — it adds no
 * behaviour of its own beyond wiring the mocked `createBrowserDmWorkspace`
 * and `registeredAdapters` and performing ONE initial `discover()` as setup
 * (awaited before returning), so R10 tests can call `migrate`/`context`
 * immediately without each repeating that boilerplate. `context(family)`
 * falls back to a synthetic context carrying the hook's real
 * `ensureWorkspaceRemembered` when discovery found no owner (so that guard's
 * own rejection is still reachable through it).
 */
async function renderRunController(
  options: {
    remember?: ReturnType<typeof vi.fn>;
    adapters?: DurableFamilyAdapter[];
    campaignCode?: string;
  } = {}
) {
  const remember = options.remember ?? vi.fn(async () => {});
  const closeSpy = vi.fn();
  const state = { accountId: 'account-1' };
  const codes = ['ALPHA', 'BETA'];

  mockedCreateBrowserDmWorkspace.mockImplementation(async () => {
    const context = {
      accountId: state.accountId,
      accountLabel: 'Owner',
      list: vi.fn(
        async (): Promise<DmWorkspaceDocument[]> =>
          codes.map(code => workspaceFor(code, { accountId: state.accountId }))
      ),
      discover: vi.fn(async (): Promise<DmWorkspaceDocument[]> => []),
      remember: remember as ReturnType<typeof defaultOwnerContext>['remember'],
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close: closeSpy,
    };
    ownerContextMock = context;
    return context;
  });

  mockedRegisteredAdapters.mockReturnValue(
    options.adapters ?? [
      stubAdapter('campaign_settings'),
      stubAdapter('calendar'),
    ]
  );
  mockedEnabledAdapters.mockImplementation(() =>
    mockedRegisteredAdapters().filter(adapter => adapter.isVisible())
  );

  const view = renderHook(
    (props: { code: string }) => useMigrationWizard(props.code),
    { initialProps: { code: options.campaignCode ?? 'ALPHA' } }
  );

  // One explicit discovery as setup, awaited — see doc comment above.
  await act(async () => {
    await view.result.current.discover();
  });

  return {
    async discover() {
      await act(async () => {
        await view.result.current.discover();
      });
    },
    async migrate(family: DurableFamilyName) {
      await act(async () => {
        await view.result.current.migrate(family);
      });
    },
    /** The full typed-confirmation run (`runFamily`), for the D1 resume cases. */
    async runFamily(family: DurableFamilyName) {
      let outcome!: FamilyRunOutcome;
      await act(async () => {
        outcome = await view.result.current.runFamily(family);
      });
      return outcome;
    },
    async enrich() {
      await act(async () => {
        await view.result.current.enrichLegacyReceipt();
      });
    },
    /** The recovery bundle's manifest hash, or `null` while still capturing. */
    recoveryManifestHash(): string | null {
      return view.result.current.recovery.bundle?.manifestHash ?? null;
    },
    context(family: DurableFamilyName): MigrationRunContext {
      return (
        view.result.current.contextFor(family) ?? {
          accountId: '',
          campaignId: '',
          campaignCode: view.result.current.campaignCode,
          workspace: workspaceFor(view.result.current.campaignCode, {
            accountId: state.accountId,
          }),
          recovery: {
            format: 'rollkeeper-device-backup',
            formatVersion: 1,
            appVersion: APP_VERSION,
            runId: '',
            createdAt: '',
            entries: [],
            manifestHash: '',
            validation: {
              entryCount: 0,
              totalBytes: 0,
              validJsonCount: 0,
              malformedJsonCount: 0,
              futureVersionCount: 0,
              retainedOnlyCount: 0,
            },
          },
          ensureWorkspaceRemembered:
            view.result.current.ensureWorkspaceRemembered,
        }
      );
    },
    unmount() {
      act(() => {
        view.unmount();
      });
    },
    async switchCampaign(code: string) {
      view.rerender({ code });
      await act(async () => {
        await view.result.current.discover();
      });
    },
    async signInAsDifferentOwner() {
      state.accountId = 'account-2';
    },
  };
}

let ownerContextMock: ReturnType<typeof defaultOwnerContext>;

// ---------------------------------------------------------------------
// Task 16: report-suite helpers.
// ---------------------------------------------------------------------

/** Six fresh stub adapters, each ALREADY postgres-authoritative (as if every family's cutover already ran this session) -- so the report suite can jump straight to verification without re-running Task 15's whole per-family confirmation flow. */
function stubFamiliesAllPostgres(): DurableFamilyAdapter[] {
  return ALL_STUB_FAMILIES.map(family =>
    stubAdapter(family, {
      initialAuthority: {
        state: 'postgres',
        epoch: 1,
        campaignId: 'cloud-ALPHA',
        accountId: 'account-1',
        rolledBack: false,
      },
    })
  );
}

/** Clicks Continue until the report renders, mounting nothing itself. */
async function advanceToReport() {
  for (
    let attempt = 0;
    attempt <= DURABLE_FAMILY_REGISTRY.length + 1;
    attempt += 1
  ) {
    if (screen.queryByTestId('migration-report')) return;
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  }
  throw new Error('Never reached the report');
}

async function mountAllSixPostgresAndAdvanceToReport() {
  await mountStubWizardResumedWithAdapters(stubFamiliesAllPostgres());
  await advanceToReport();
}

/** Default report entry point: mounts (if nothing is mounted yet) with all six families already postgres-authoritative, then navigates to the report -- verifying every enabled family exactly once on the way in (spec R14). */
async function openReport() {
  if (!currentRender) await mountAllSixPostgresAndAdvanceToReport();
  else await advanceToReport();
}

/** All six registered families enabled, postgres and (by the stub's own default) verified. */
async function openReportWithAllSixMigratedAndVerified() {
  await mountAllSixPostgresAndAdvanceToReport();
}

/** All six postgres-authoritative, but NOT necessarily verified -- callers set `failVerificationFor`/`disableFamily` first. */
async function openReportWithAllSixMigrated() {
  await mountAllSixPostgresAndAdvanceToReport();
}

/** Same mount as the "all six" helpers; named separately because the brief's "Available" scenario expects the caller to have already `disableFamily`'d one first. */
async function openReportWithEveryEnabledFamilyVerified() {
  await mountAllSixPostgresAndAdvanceToReport();
}

/** Nothing has been migrated at all -- the shared six stub families at their `DEFAULT_STUB_AUTHORITY` (legacy, epoch 0). */
async function openReportWithNothingMigratedYet() {
  await mountStubWizardResumedWithAdapters(stubFamilies());
  await advanceToReport();
}

/**
 * Ruling (Minor 6): renamed from the brief's `...SchemaVersionDrift` --
 * `failVerificationFor` produces a bare `documentsMatch: false` refusal,
 * indistinguishable at the report level from any other cause. The
 * byte-vs-schema-version distinction itself is pinned per-adapter by
 * `adapterConformance.ts`'s `divergeVerifiedSchemaVersion` fixture, not
 * re-derived here; this only proves the REPORT correctly surfaces and
 * refuses on whatever `documentsMatch: false` an adapter reports.
 */
async function openReportWithDocumentMismatch(family: DurableFamilyName) {
  failVerificationFor(family);
  await mountAllSixPostgresAndAdvanceToReport();
}

async function refreshReport() {
  await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
}

async function closeReport() {
  await userEvent.click(screen.getByRole('button', { name: /^back$/i }));
}

/** Directly seeds a real, minimal ACKNOWLEDGED `outbox` row for `npc` -- proves the report trusts `verification.outboxEmpty` rather than independently requiring the raw table to be physically empty (spec R8). */
async function seedAcknowledgedOutboxRow() {
  const database = await openRollkeeperDatabase();
  try {
    const transaction = database.transaction('outbox', 'readwrite');
    transaction.objectStore('outbox').put({
      mutationId: 'npc-outbox-acknowledged-1',
      namespace: 'user:account-1',
      campaignId: 'cloud-ALPHA',
      family: 'npc',
      legacyId: 'npc-1',
      cutoverEpoch: 1,
      operation: 'create',
      payload: null,
      schemaVersion: 1,
      localRevision: 1,
      baseServerVersion: 1,
      contentFingerprint: 'fingerprint',
      updatedAt: FIXED_TS,
      state: 'acknowledged',
      attemptCount: 1,
      nextAttemptAt: 0,
      inflightAt: null,
      lastError: null,
    });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function openReportWithAcknowledgedOutboxRows() {
  await seedAcknowledgedOutboxRow();
  await mountAllSixPostgresAndAdvanceToReport();
}

let lastSeededConflictId: string | null = null;

/** Directly seeds a real `conflicts` row for `npc` with `resolutionState: 'preserved'` -- a resolved-but-kept device candidate (spec R8: preserved candidates are recoverable data and must never be treated as an unresolved conflict). */
async function seedPreservedConflictCandidate() {
  lastSeededConflictId =
    'npc:user:account-1:cloud-ALPHA:preserved-npc-1:mutation-1';
  const database = await openRollkeeperDatabase();
  try {
    const transaction = database.transaction('conflicts', 'readwrite');
    transaction.objectStore('conflicts').put({
      conflictId: lastSeededConflictId,
      namespace: 'user:account-1',
      campaignId: 'cloud-ALPHA',
      family: 'npc',
      legacyId: 'preserved-npc-1',
      mutationId: 'mutation-1',
      localCandidate: { note: 'preserved local candidate' },
      cloudCandidate: { note: 'cloud candidate' },
      resolutionState: 'preserved',
      detectedAt: FIXED_TS,
    });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function openReportWithPreservedResolvedCandidate() {
  await seedPreservedConflictCandidate();
  await mountAllSixPostgresAndAdvanceToReport();
}

/** Whether the seeded preserved conflict candidate is STILL present -- proves report verification never deletes or mutates recoverable device-candidate evidence. */
async function preservedCandidateStillReadable(): Promise<boolean> {
  if (!lastSeededConflictId)
    throw new Error('No conflict candidate was seeded');
  const database = await openRollkeeperDatabase();
  try {
    const transaction = database.transaction('conflicts', 'readonly');
    const record = await requestResult(
      transaction.objectStore('conflicts').get(lastSeededConflictId)
    );
    await transactionComplete(transaction);
    return record !== undefined;
  } finally {
    database.close();
  }
}

/** Ruling R6.8 (D10): the `toEqual([])` contract this defines. Recurses into every localStorage value and every `rollkeeper-local`/`rollkeeper-recovery` record looking for a `FamilyVerification`-shaped object (`documentsMatch`/`tombstonesMatch`/`outboxEmpty`/`conflictCount`/`verified` together) -- the shape `verifyReport` would have to persist to violate spec R14. A recovery download receipt's own legitimate `verifiedAt` (spec R4, "the bundle was checked") is NOT this shape and is deliberately not flagged. */
function looksLikeFamilyVerification(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    'documentsMatch' in record &&
    'tombstonesMatch' in record &&
    'outboxEmpty' in record &&
    'conflictCount' in record &&
    'verified' in record
  );
}

function containsFamilyVerificationShape(value: unknown, depth = 0): boolean {
  if (depth > 6 || value === null || typeof value !== 'object') return false;
  if (looksLikeFamilyVerification(value)) return true;
  if (Array.isArray(value)) {
    return value.some(item => containsFamilyVerificationShape(item, depth + 1));
  }
  return Object.values(value as Record<string, unknown>).some(item =>
    containsFamilyVerificationShape(item, depth + 1)
  );
}

async function storedVerificationClaims(): Promise<unknown[]> {
  const claims: unknown[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === null) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (containsFamilyVerificationShape(parsed)) {
        claims.push({ store: 'localStorage', key });
      }
    } catch {
      // Not JSON -- never a persisted claim shape.
    }
  }

  const local = await openRollkeeperDatabase();
  try {
    for (const name of OBJECT_STORE_NAMES) {
      const transaction = local.transaction(name, 'readonly');
      const rows = await requestResult<unknown[]>(
        transaction.objectStore(name).getAll()
      );
      await transactionComplete(transaction);
      for (const row of rows) {
        if (containsFamilyVerificationShape(row)) {
          claims.push({ store: name });
        }
      }
    }
  } finally {
    local.close();
  }

  const recovery = await openRecoveryDatabaseForTests();
  try {
    const transaction = recovery.transaction('downloadReceipts', 'readonly');
    const rows = await requestResult<unknown[]>(
      transaction.objectStore('downloadReceipts').getAll()
    );
    await transactionComplete(transaction);
    for (const row of rows) {
      if (containsFamilyVerificationShape(row)) {
        claims.push({ store: 'downloadReceipts' });
      }
    }
  } finally {
    recovery.close();
  }

  return claims;
}

beforeEach(async () => {
  await deleteDatabase('rollkeeper-local');
  await deleteDatabase('rollkeeper-recovery');
  localStorage.clear();
  localStorage.setItem(
    'rollkeeper-dm-data',
    JSON.stringify({
      state: {
        dmId: 'dm-local',
        campaigns: [{ code: 'ALPHA', name: 'Canary', createdAt: FIXED_TS }],
      },
      version: 1,
    })
  );
  process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'true';

  vi.spyOn(crypto, 'randomUUID').mockReturnValue(
    FIXED_RUN_ID as `${string}-${string}-${string}-${string}-${string}`
  );
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    () => undefined
  );

  mockedCreateBrowserDmWorkspace.mockReset();
  mockedCreateBrowserDmWorkspace.mockResolvedValue(defaultOwnerContext());
  mockedRegisteredAdapters.mockReset();
  mockedRegisteredAdapters.mockReturnValue([]);
  mockedEnabledAdapters.mockReset();
  mockedEnabledAdapters.mockReturnValue([]);
  vi.mocked(initiateDeviceBackupDownload).mockClear();
  vi.mocked(verifyDownloadedDeviceBackup).mockClear();
  mockedCaptureDeviceBackup.mockClear();
  cutoverSpies.clear();
  cloudFailures.clear();
  selectLog.length = 0;
  inconsistentSeeds.clear();
  apiActionCounts.clear();
  stubFamiliesCache = null;
  currentRender = null;
  disabledStubFamilies.clear();
  verifyCloudCalls.length = 0;
  verificationOverrides.clear();
  verificationThrows.clear();
  deferredVerificationQueue.clear();
  lastSeededConflictId = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;
  // Ruling R9.3-alike: an env var flipped by `disableAllFamiliesExcept` must
  // not leak into a later test's real-adapter `isVisible()` reads.
  for (const envVar of Object.values(FAMILY_FLAG_VARS)) {
    delete process.env[envVar];
  }
  currentRender = null;
});

describe('MigrationWizard — steps 0 and 1', () => {
  it('renders nothing while the wizard flag is off', () => {
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'false';
    const { container } = render(<MigrationWizard campaignCode="ALPHA" />);
    // `container` alone is a VACUOUS check: Radix Dialog portals its content
    // into `document.body`, so `container` is empty regardless of whether
    // the dialog actually rendered. Assert both: the wrapper AND the fact
    // that no dialog exists anywhere in the document.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('discovery changes no authority, no marker and no selection', async () => {
    const before = await snapshotDurableState();
    render(<MigrationWizard campaignCode="ALPHA" />);
    const discoverButton = screen.getByRole('button', {
      name: /find my campaigns/i,
    });
    await userEvent.click(discoverButton);
    // Coordinator review round 2, item 7: NEITHER "Nothing has changed" (static,
    // always on screen) NOR "No cloud workspace found yet" (identical text in
    // the INITIAL pre-discovery state, since `workspace` starts `null` too) is
    // a genuine completion signal — both were proven vacuous by a reviewer
    // probe that showed a write injected at the tail of `discover()`, delayed
    // by 60ms, went unnoticed. The only signal that is unique to
    // `discover()` having FULLY returned is its own button leaving the
    // loading state: `finally { setDiscovering(false) }` is the LAST
    // statement `discover()` executes (`hooks.ts:144-146`), so `Button`'s
    // `loading` prop (which also drives `disabled`) only clears after
    // every write `discover()` could ever make — early, mid-function, or at
    // the tail, delayed or not — has already happened.
    await waitFor(() => expect(discoverButton).toBeEnabled());
    expect(await snapshotDurableState()).toBe(before);
  });

  // Final fix wave, gate defect D3: the manual gate found step 1 dead-ending
  // for a DM whose account has no cloud workspace for the campaign -- "No
  // cloud workspace found yet", one control that finds nothing again, and no
  // explanation or route to the action that creates one.
  it('explains what to do, and links to the dashboard, when the account has no cloud workspace for this campaign', async () => {
    // The default owner context is signed in and its `list()` returns no
    // workspaces -- exactly the state the gate hit.
    render(<MigrationWizard campaignCode="ALPHA" campaignName="Canary" />);
    const discoverButton = screen.getByRole('button', {
      name: /find my campaigns/i,
    });
    // Before the lookup runs there is nothing to explain, and the guidance
    // must not be shown: `workspace` is null in that state too.
    expect(
      screen.queryByText(/create a cloud workspace for this campaign first/i)
    ).not.toBeInTheDocument();

    await userEvent.click(discoverButton);
    await waitFor(() => expect(discoverButton).toBeEnabled());

    const guidance = await screen.findByText(
      /^create a cloud workspace for this campaign first$/i
    );
    expect(guidance.closest('[role="alert"]')).not.toBeNull();
    // Re-review N3: the guidance names the dashboard's fork button after the
    // CAMPAIGN, never after its code -- that is what the button reads. The
    // producer/consumer binding to the real control's own label lives in
    // `workspaceGuidance.test.tsx`; this line only pins the wiring of the
    // name through the wizard.
    expect(
      screen.getByText(
        /this wizard moves campaign data into a cloud workspace/i
      )
    ).toHaveTextContent(forkCampaignToCloudLabel('Canary'));
    const link = screen.getByRole('link', { name: /go to my campaigns/i });
    expect(link).toHaveAttribute('href', '/dm');
    expectCloudProductVocabulary(document.body);
  });

  /**
   * Scoped re-review N1. F4 was closed on the FAMILY step only, while
   * workspace discovery still rendered `Error.message` verbatim -- on step
   * 0, the first thing a DM sees. `BrowserDmWorkspaceContext.list()` is
   * IndexedDB-backed, so the gate's own D2 scenario (IndexedDB blocked in a
   * private window) rejects here with a raw `DOMException` before the
   * family step is ever reached. A `DOMException` on purpose: it is the
   * real-world trigger, and it inherits `Error`, so the old
   * `cause instanceof Error ? cause.message : ...` did pass it straight to
   * the DOM.
   */
  it('never renders a raw discovery rejection, not even a DOMException, on the first step', async () => {
    const raw = 'The user denied permission to access the database.';
    mockedCreateBrowserDmWorkspace.mockRejectedValue(
      new DOMException(raw, 'UnknownError')
    );
    render(<MigrationWizard campaignCode="ALPHA" />);
    const discoverButton = screen.getByRole('button', {
      name: /find my campaigns/i,
    });
    await userEvent.click(discoverButton);
    await waitFor(() => expect(discoverButton).toBeEnabled());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be looked up just now/i);
    // The raw platform text never reaches the DOM, and neither does the
    // pre-fix generic fallback -- so restoring EITHER old branch reddens
    // the assertion above.
    expect(document.body.textContent ?? '').not.toContain(raw);
    expect(document.body.textContent ?? '').not.toContain('DOMException');
    expectCloudProductVocabulary(document.body);

    // jsdom's `DOMException` does NOT inherit `Error` (a real browser's
    // does), so the case above proves the mapping is applied but cannot
    // itself show the verbatim leak. A plain transport rejection -- the one
    // the manual gate actually saw on screen, one step later -- does.
    cleanup();
    mockedCreateBrowserDmWorkspace.mockRejectedValue(
      new TypeError('Failed to fetch')
    );
    render(<MigrationWizard campaignCode="ALPHA" />);
    const retry = screen.getByRole('button', { name: /find my campaigns/i });
    await userEvent.click(retry);
    await waitFor(() => expect(retry).toBeEnabled());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not be looked up just now/i
    );
    expect(document.body.textContent ?? '').not.toContain('Failed to fetch');
  });

  it('shows no missing-workspace guidance once a cloud workspace is found', async () => {
    mockedCreateBrowserDmWorkspace.mockResolvedValue({
      ...defaultOwnerContext(),
      list: vi.fn(async () => [workspaceFor('ALPHA')]),
    });
    render(<MigrationWizard campaignCode="ALPHA" />);
    const discoverButton = screen.getByRole('button', {
      name: /find my campaigns/i,
    });
    await userEvent.click(discoverButton);
    await screen.findByText(/connected to campaign alpha/i);
    expect(
      screen.queryByText(/create a cloud workspace for this campaign first/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /go to my campaigns/i })
    ).not.toBeInTheDocument();
  });

  it('downloads and verifies exactly one bundle for the whole run', async () => {
    await renderWizardAtRecoveryStep();
    await userEvent.click(screen.getByRole('button', { name: /download/i }));
    await userEvent.upload(
      screen.getByLabelText(/safety copy/i),
      await bundleFile()
    );
    const verifiedText = await screen.findByText(
      /checked.*every entry matches/i
    );
    // Coordinator review, item 3: the success block must be an accessible
    // `role="status"` announcement, not a plain, silent paragraph.
    expect(verifiedText.closest('[role="status"]')).not.toBeNull();
    expect(vi.mocked(initiateDeviceBackupDownload)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(verifyDownloadedDeviceBackup)).toHaveBeenCalledTimes(1);
    expect(await verifiedReceiptCount()).toBe(1);
  });

  it('refuses a bundle that does not match the current device', async () => {
    await renderWizardAtRecoveryStep();
    await userEvent.click(screen.getByRole('button', { name: /download/i }));
    await userEvent.upload(
      screen.getByLabelText(/safety copy/i),
      await staleBundleFile()
    );
    expect(
      await screen.findByText(/that file does not match this browser/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  /**
   * Scoped re-review N1, second open channel: reading the picked file back.
   * `File.text()` rejects with a `NotReadableError` `DOMException` on a file
   * that vanished or is unreadable, and that message used to render verbatim
   * under the stale-bundle heading.
   */
  it('never renders a raw browser-backup file rejection, not even a DOMException', async () => {
    const raw = 'The requested file could not be read.';
    vi.mocked(verifyDownloadedDeviceBackup).mockRejectedValueOnce(
      new DOMException(raw, 'NotReadableError')
    );
    await renderWizardAtRecoveryStep();
    await userEvent.click(screen.getByRole('button', { name: /download/i }));
    await userEvent.upload(
      screen.getByLabelText(/safety copy/i),
      await bundleFile()
    );
    // Queried by ROLE, not by the heading text: the pre-fix fallback
    // repeated that heading inside the same panel, so a text query matched
    // twice and failed with an ambiguous-element error instead of the
    // content assertion this test exists for.
    const alerts = await screen.findAllByRole('alert');
    const alert = alerts.find(node =>
      /that file does not match this browser/i.test(node.textContent ?? '')
    );
    expect(alert).toBeDefined();
    expect(alert).toHaveTextContent(/could not read that file/i);
    expect(document.body.textContent ?? '').not.toContain(raw);
    expectCloudProductVocabulary(document.body);
  });

  it('resumes on a verified receipt for the same browser data, without a second download', async () => {
    await seedVerifiedReceipt({
      runId: 'run-1',
      manifestHash: await currentDeviceHash(),
    });
    render(<MigrationWizard campaignCode="ALPHA" />);
    expect(
      await screen.findByText(/safety copy is ready/i)
    ).toBeInTheDocument();
    // Pins that the ADOPTED run id is the receipt's own — a fresh runId
    // would still show the "ready" copy but would desync every family
    // selection record pinned to `recovery.runId` (spec R4).
    expect(await screen.findByText(/run-1/)).toBeInTheDocument();
    expect(vi.mocked(initiateDeviceBackupDownload)).not.toHaveBeenCalled();
  });

  it('does not resume on a verified receipt that predates the entry vector', async () => {
    await seedVerifiedReceiptWithoutEntries({
      runId: 'run-1',
      manifestHash: await currentDeviceHash(),
    });
    render(<MigrationWizard campaignCode="ALPHA" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /download/i })).toBeEnabled()
    );
  });

  it('enriches a legacy receipt when the aggregate hash still matches, then resumes', async () => {
    await seedVerifiedReceiptWithoutEntries({
      runId: 'run-1',
      manifestHash: await currentDeviceHash(),
    });
    render(<MigrationWizard campaignCode="ALPHA" />);
    await userEvent.click(
      await screen.findByRole('button', {
        name: /^check this browser's backup$/i,
      })
    );
    expect(
      await screen.findByText(/safety copy is ready/i)
    ).toBeInTheDocument();
    expect(await storedReceiptEntries('run-1')).toHaveLength(
      await currentEntryCount()
    );
  });

  it('does not resume on a receipt that was downloaded but never verified', async () => {
    await seedInitiatedOnlyReceipt({
      runId: 'run-1',
      manifestHash: await currentDeviceHash(),
    });
    render(<MigrationWizard campaignCode="ALPHA" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /download/i })).toBeEnabled()
    );
    // An initiated-only receipt must not offer enrichment either — that
    // control is only for a VERIFIED legacy receipt missing its entry
    // vector, never for "nothing checked yet".
    expect(
      screen.queryByRole('button', { name: /^check this browser's backup$/i })
    ).not.toBeInTheDocument();
  });

  it('connects to the owner-verified workspace already linked to this campaign', async () => {
    mockedCreateBrowserDmWorkspace.mockResolvedValue({
      ...defaultOwnerContext(),
      list: vi.fn(async () => [workspaceFor('ALPHA')]),
    });
    render(<MigrationWizard campaignCode="ALPHA" />);
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    expect(
      await screen.findByText(/connected to campaign alpha/i)
    ).toBeInTheDocument();
  });

  it('does not claim to be signed in before discovery has ever run', () => {
    // Coordinator review, item 2: the sign-in row must be DERIVED from a
    // real discovery result, never rendered as a fixed claim. Weakened check
    // (fails open): a component that always renders "Signed in" regardless
    // of state fails this immediately, on initial render, with no click.
    render(<MigrationWizard campaignCode="ALPHA" />);
    expect(
      screen.queryByText(/^signed in on this browser$/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^ready$/i)).not.toBeInTheDocument();
  });

  it('renders a failure, not a false success, when no owner account is found', async () => {
    mockedCreateBrowserDmWorkspace.mockResolvedValue(null);
    render(<MigrationWizard campaignCode="ALPHA" />);
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    // The negative case, pinned two ways: the false-success claim must be
    // absent, AND a real, accessible failure signal must be present.
    expect(
      screen.queryByText(/^signed in on this browser$/i)
    ).not.toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/sign in/i);
  });

  it('does not treat a queued, not-yet-cloud-linked workspace as owner-verified', async () => {
    // Coordinator review, item 5: `IndexedDbDmWorkspaceRepository.commitCreate`
    // writes `cloudId: null` for every locally created or forked workspace
    // until the server acknowledges it — a real, reachable state for a
    // migrating DM, not a synthetic one. `discover()` reads only `list()`
    // (local records), so this workspace is visible to it but must not be
    // treated as "found".
    mockedCreateBrowserDmWorkspace.mockResolvedValue({
      ...defaultOwnerContext(),
      list: vi.fn(async () => [workspaceFor('ALPHA', { cloudId: null })]),
    });
    render(<MigrationWizard campaignCode="ALPHA" />);
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    expect(
      await screen.findByText(/no cloud workspace found yet/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/connected to campaign alpha/i)
    ).not.toBeInTheDocument();
  });

  it('surfaces a failure without resuming when enrichment cannot complete', async () => {
    await seedVerifiedReceiptWithoutEntries({
      runId: 'run-1',
      manifestHash: await currentDeviceHash(),
    });
    // Scoped re-review N1, third open channel. A `DOMException` on purpose:
    // the receipt store is IndexedDB-backed, so this is the same
    // blocked-IndexedDB rejection discovery sees, and it used to render
    // verbatim.
    const raw = 'The user denied permission to access the database.';
    const spy = vi
      .spyOn(browserRecoveryRepository, 'enrichVerifiedDownloadReceiptEntries')
      .mockRejectedValueOnce(new DOMException(raw, 'UnknownError'));
    render(<MigrationWizard campaignCode="ALPHA" />);
    await userEvent.click(
      await screen.findByRole('button', {
        name: /^check this browser's backup$/i,
      })
    );
    expect(screen.queryByText(/safety copy is ready/i)).not.toBeInTheDocument();
    // The failure must actually be SURFACED to the DM, not merely silent
    // (coordinator review, item 1 — the previous version of this test only
    // proved the absence of success, which a component that renders nothing
    // at all would also satisfy). Weakened to prove it is load-bearing: a
    // render that dropped `recovery.error` entirely fails this exact line.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/backup could not be checked just now/i);
    expect(document.body.textContent ?? '').not.toContain(raw);
    expectCloudProductVocabulary(document.body);
    // Stays in the retryable pending state rather than hanging or crashing.
    expect(
      await screen.findByRole('button', {
        name: /^check this browser's backup$/i,
      })
    ).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders every warning at a 390px viewport without truncation', async () => {
    // Coordinator review, item 3: the previous version of this test only
    // ever produced the stale-bundle alert, so the OTHER failure this task
    // renders (the not-signed-in alert, WorkspaceStep) sat outside the check
    // entirely. Drive both into existence in one render.
    mockedCreateBrowserDmWorkspace.mockResolvedValue(null);
    await renderWizardAtRecoveryStep();
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    await screen.findByText(/not signed in on this browser/i);
    await userEvent.click(screen.getByRole('button', { name: /download/i }));
    await userEvent.upload(
      screen.getByLabelText(/safety copy/i),
      await staleBundleFile()
    );
    await screen.findByText(/that file does not match this browser/i);
    setViewport(MIGRATION_NARROW_VIEWPORT_PX);

    const alertVariants: { match: RegExp; requiredSubstrings: string[] }[] = [
      {
        match: /sign in to the owner account/i,
        requiredSubstrings: [
          'Sign in to the owner account before migrating this campaign.',
        ],
      },
      {
        match: /that file does not match this browser/i,
        requiredSubstrings: [
          'That file does not match this browser',
          'It was saved from different data, so it could not restore this browser. Download a fresh one and pick that up instead.',
          // Item 8: the failure detail is surfaced too, not dropped. Scoped
          // re-review N1: it is now the vetted `backupFile` sentence rather
          // than the verifier's own `Error.message` -- the same channel a
          // `NotReadableError` `DOMException` arrives on.
          'This browser could not read that file, or it was saved from different campaign data.',
        ],
      },
    ];

    const alerts = screen.getAllByRole('alert');
    // Proves BOTH kinds of warning this task renders are actually present,
    // not merely one repeated — closing the exact gap the coordinator named.
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    for (const warning of alerts) {
      const text = warning.textContent ?? '';
      const variant = alertVariants.find(candidate =>
        candidate.match.test(text)
      );
      expect(variant, `Unrecognised alert content: ${text}`).toBeDefined();
      for (const substring of variant!.requiredSubstrings) {
        expect(text).toContain(substring);
      }
      assertNoTruncationClasses(warning);
    }
  });
});

describe('MigrationWizard run controller — spec R10', () => {
  it('remembers the workspace once for the whole run, before the first cutover', async () => {
    const remember = vi.fn(async () => {});
    const order: string[] = [];
    const controller = await renderRunController({
      remember,
      adapters: [
        stubAdapter('campaign_settings', {
          onCutover: () => order.push('cutover:campaign_settings'),
        }),
        stubAdapter('calendar', {
          onCutover: () => order.push('cutover:calendar'),
        }),
      ],
    });
    await controller.migrate('campaign_settings');
    await controller.migrate('calendar');
    expect(remember).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['cutover:campaign_settings', 'cutover:calendar']);
    // This ordering is fully determined by THIS test's own `stubAdapter` —
    // it proves the WIZARD calls `ensureWorkspaceRemembered` before
    // `migrate`'s chain reaches `commitLocalCutover`, not that any real
    // adapter's `commitLocalCutover` itself awaits it before doing real work.
    // That second guarantee is proven per-family, at real entry time, in
    // `src/lib/durableDm/adapters/__tests__/adapterConformance.ts:621-647`
    // (`harness.recordCutoverInto(order)`, `expect(order).toEqual(['remember','cutover'])`).
    expect(remember.mock.invocationCallOrder[0]).toBeLessThan(
      cutoverInvocationOrder('campaign_settings')
    );
  });

  it('does not cache a failed remember as done', async () => {
    const remember = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const controller = await renderRunController({ remember });
    await expect(controller.migrate('campaign_settings')).rejects.toThrow();
    await controller.migrate('campaign_settings');
    expect(remember).toHaveBeenCalledTimes(2);
  });

  it('makes two families that start together share one remember', async () => {
    const remember = vi.fn(
      () => new Promise<void>(resolve => setTimeout(resolve, 5))
    );
    const controller = await renderRunController({ remember });
    await Promise.all([
      controller.context('campaign_settings').ensureWorkspaceRemembered(),
      controller.context('calendar').ensureWorkspaceRemembered(),
    ]);
    expect(remember).toHaveBeenCalledTimes(1);
  });

  it('reuses the workspace context discovery opened, and never builds a second', async () => {
    const controller = await renderRunController();
    expect(mockedCreateBrowserDmWorkspace).toHaveBeenCalledTimes(1);
    await controller.migrate('campaign_settings');
    await controller.migrate('calendar');
    expect(mockedCreateBrowserDmWorkspace).toHaveBeenCalledTimes(1);
    expect(ownerContextMock.remember).toHaveBeenCalledTimes(1);
  });

  it('closes the workspace context on unmount', async () => {
    const controller = await renderRunController();
    expect(ownerContextMock.close).not.toHaveBeenCalled();
    controller.unmount();
    expect(ownerContextMock.close).toHaveBeenCalledTimes(1);
  });

  it('closes a discovered context that arrives after unmount, instead of leaking its handle', async () => {
    // Coordinator review, item 6: unmounting while `createBrowserDmWorkspace()`
    // is in flight makes `setOwnerContext(next)` a no-op on an unmounted
    // tree — the close-on-change effect never sees `next` (it never entered
    // state), so without the guard its `rollkeeper-local` handle leaks for
    // the life of the tab (R10's own `versionchange` hazard).
    let resolveDiscovery!: (
      value: ReturnType<typeof defaultOwnerContext> | null
    ) => void;
    mockedCreateBrowserDmWorkspace.mockReturnValue(
      new Promise(resolve => {
        resolveDiscovery = resolve;
      })
    );
    const view = renderHook(
      (props: { code: string }) => useMigrationWizard(props.code),
      { initialProps: { code: 'ALPHA' } }
    );
    let discoverPromise!: Promise<void>;
    act(() => {
      discoverPromise = view.result.current.discover();
    });
    view.unmount();

    const arrivedLate = defaultOwnerContext();
    resolveDiscovery(arrivedLate);
    await act(async () => {
      await discoverPromise;
    });

    expect(arrivedLate.close).toHaveBeenCalledTimes(1);
  });

  it('refuses to run when discovery found no owner context', async () => {
    mockedCreateBrowserDmWorkspace.mockResolvedValueOnce(null);
    const controller = await renderRunController();
    await expect(
      controller.context('campaign_settings').ensureWorkspaceRemembered()
    ).rejects.toThrow(/sign in/i);
  });

  it("does not reuse one campaign's remember for another", async () => {
    const controller = await renderRunController({ campaignCode: 'ALPHA' });
    await controller.migrate('campaign_settings');
    expect(ownerContextMock.remember).toHaveBeenCalledTimes(1);
    await controller.switchCampaign('BETA');
    await controller.migrate('campaign_settings');
    expect(ownerContextMock.remember).toHaveBeenCalledTimes(2);
    expect(ownerContextMock.remember.mock.calls[1][0]).toMatchObject({
      localId: workspaceFor('BETA').localId,
    });
  });

  it('does not reuse a remember across a signed-in account change', async () => {
    const controller = await renderRunController();
    await controller.migrate('campaign_settings');
    expect(ownerContextMock.remember).toHaveBeenCalledTimes(1);
    await controller.signInAsDifferentOwner();
    await controller.discover();
    await controller.migrate('campaign_settings');
    expect(ownerContextMock.remember).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a remember across a resumed run id change, account and workspace unchanged', async () => {
    // Coordinator review, item 4: the brief's mutation #9 drops the WHOLE
    // key at once, so a memo keyed on `accountId|workspace.localId` alone
    // (dropping only `runId`) was never isolated — `crypto.randomUUID` is
    // globally stubbed to one fixed value in `beforeEach`, so `runId` never
    // actually varied in any other test. This test varies ONLY `runId`,
    // holding account and workspace fixed, via the real production path
    // that changes it mid-run: resuming a legacy receipt through
    // `enrichLegacyReceipt` (`hooks.ts`'s `setRunId(receipt.runId)`).
    const remember = vi.fn(async () => {});
    const controller = await renderRunController({ remember });
    await waitFor(() =>
      expect(controller.recoveryManifestHash()).not.toBeNull()
    );
    await controller.migrate('campaign_settings');
    expect(remember).toHaveBeenCalledTimes(1);

    const hash = controller.recoveryManifestHash();
    if (!hash) throw new Error('Recovery bundle was not captured');
    await seedVerifiedReceiptWithoutEntries({
      runId: 'resumed-run-id',
      manifestHash: hash,
    });
    await controller.enrich();

    await controller.migrate('calendar');
    expect(remember).toHaveBeenCalledTimes(2);
  });
});

describe('MigrationWizard — data-category steps', () => {
  it('runs with zero, one and all families REGISTERED', async () => {
    // Registered, not enabled. Spec R13: progress is verified / registered,
    // and a registered family whose flag is off stays in the denominator.
    for (const count of [0, 1, 6]) {
      const { unmount } = renderWizardWithRegisteredAdapters(count);
      expect(
        await screen.findByText(new RegExp(`0 of ${count}`))
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('keeps a disabled registered family in the denominator (registeredCount, independent of the numerator)', async () => {
    // Coordinator review round 2, Important 2: this test's NUMERATOR is not
    // load-bearing here -- the production registry's real adapters never
    // get their `readAuthority` driven to `postgres` in this test (no
    // family is ever cut over), so `routedCount` is trivially 0 regardless
    // of whether the denominator logic is correct. What this test actually
    // pins is that `registeredCount` reads `registeredAdapters().length`
    // (which does NOT filter by the client flag) rather than
    // `enabledAdapters().length` (which would shrink to 1 once five of six
    // real families' env flags are turned off) -- i.e. the DENOMINATOR
    // only. The numerator (`routedCount` actually counting a real `postgres`
    // family) is pinned separately, with real assertions, by
    // `reports an already-routed family as moved on reopen...` above, which
    // uses the stub adapters this file fully controls to reach `postgres`.
    disableAllFamiliesExcept('campaign_settings');
    renderWizardWithProductionRegistry();
    expect(await screen.findByText(/0 of 6/)).toBeInTheDocument();
    expect(screen.queryByText(/0 of 1/)).not.toBeInTheDocument();
  });

  it('cuts a family over only after the typed confirmation', async () => {
    await renderWizardAtFamilyStep('campaign_settings');
    const button = await screen.findByRole('button', {
      name: /move this data to cloud sync/i,
    });
    expect(button).toBeDisabled();
    await userEvent.type(
      await screen.findByLabelText(/type .* to confirm/i),
      confirmationPhraseFor('campaign_settings')
    );
    expect(button).toBeEnabled();
    expectCloudProductVocabulary(document.body);
  });

  it('reuses the one verified receipt across every family', async () => {
    await runWizardThroughFamilies(['campaign_settings', 'calendar']);
    expect(initiateDeviceBackupDownload).toHaveBeenCalledTimes(1);
    expect(verifyDownloadedDeviceBackup).toHaveBeenCalledTimes(1);
    expect(await verifiedReceiptCount()).toBe(1);
    // Both families received the SAME run's recovery.runId — the run's one
    // verified receipt threaded through every family's context, not a fresh
    // capture per family.
    expect(selectionRecoveryRunIds()).toEqual([FIXED_RUN_ID, FIXED_RUN_ID]);
    // Coordinator review round 2, Important 4: a bare growth assertion on
    // `mockedCaptureDeviceBackup.mock.calls.length` here cannot fail --
    // mount capture plus this file's own helper probes already exceed any
    // low bound regardless of whether `runFamily` re-captures at all. That
    // property (read-only re-captures happen at each of R3's three
    // checkpoints, and are what catch drift) is instead pinned, with a real
    // negative control, by `catches drift injected between selectFamily and
    // prepareIndexedDb...` and `catches drift injected at the end of
    // commitLocalCutover...` below: each removes exactly one checkpoint in
    // isolation and shows the resulting capture-skipping failing to catch
    // drift it should have caught.
  });

  it('stops before the next authority transition when a captured key changes mid-run, and names it', async () => {
    await runWizardThroughFamilies(['campaign_settings']);
    mutateCapturedKey('rollkeeper-calendar-data');
    await advanceToFamily('calendar');
    // Scoped to the alert element, not the document: the always-rendered
    // rail row for "Calendar" would otherwise satisfy a document-wide query
    // and the "and names it" claim would never actually be pinned.
    const alert = await screen.findByText(/download a fresh/i);
    const alertBox = alert.closest('[role="alert"]');
    expect(alertBox).not.toBeNull();
    expect(alertBox).toHaveTextContent('rollkeeper-calendar-data');
    expect(await authorityOf('calendar')).toMatchObject({ state: 'legacy' });
    expect(await authorityOf('campaign_settings')).toMatchObject({
      state: 'postgres',
    });
  });

  it('stops a mid-session confirm when the browser drifts after the step was already open', async () => {
    // Distinct from the previous test: there, drift is already present the
    // MOMENT the family step is entered, so the on-entry drift check alone
    // explains the stop. Here the step opens clean (on-entry check passes,
    // the manifest and confirmation UI render normally), and the browser
    // only drifts AFTER that, while the DM is mid-confirmation -- so only
    // `runFamily`'s own re-check, immediately before `selectFamily`, can
    // catch it.
    await renderWizardAtFamilyStep('calendar');
    const input = await screen.findByLabelText(/type .* to confirm/i);
    mutateCapturedKey('rollkeeper-calendar-data');
    await userEvent.type(input, confirmationPhraseFor('calendar'));
    await userEvent.click(
      screen.getByRole('button', { name: /move this data to cloud sync/i })
    );
    const alert = await screen.findByText(/download a fresh/i);
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    expect(await authorityOf('calendar')).toMatchObject({ state: 'legacy' });
    // The drift-before-select guard fired before `selectFamily` -- no
    // selection was ever recorded for this attempt.
    expect(await selectionRecordFor('calendar')).toBeNull();
  });

  it('leaves a skipped family byte-identical legacy and writes nothing for it', async () => {
    const before = await legacyKeySnapshot('rollkeeper-calendar-data');
    await renderWizardAtFamilyStep('calendar');
    // Snapshot ALL durable state right before the click, not only the one
    // legacy key: a skip record persisted under a NEW key (e.g.
    // `rollkeeper:migration-skip:calendar`) would satisfy a check scoped to
    // just `rollkeeper-calendar-data` while still being exactly the
    // forbidden write spec R11 rules out.
    const beforeSkip = await snapshotDurableState();
    const skipButton = await screen.findByRole('button', {
      name: /skip this one/i,
    });
    await userEvent.click(skipButton);
    expect(await snapshotDurableState()).toBe(beforeSkip);
    expect(await legacyKeySnapshot('rollkeeper-calendar-data')).toBe(before);
    expect(await selectionRecordFor('calendar')).toBeNull();
  });

  it('leaves family k on IndexedDB authority and k+1 untouched when the cloud fails', async () => {
    failCloudFor('magic_item');
    await runWizardThroughFamilies(['magic_item', 'npc']);
    expect(await authorityOf('magic_item')).toMatchObject({
      state: 'indexedDB',
    });
    expect(await authorityOf('npc')).toMatchObject({ state: 'legacy' });
    expect(
      await screen.findByText(/saved only in this browser/i)
    ).toBeInTheDocument();
  });

  it('never rolls local authority back after a failed cloud activation', async () => {
    failCloudFor('magic_item');
    await runWizardThroughFamilies(['magic_item']);
    // Positive discriminator (R6.2): a negative on copy that may never
    // exist always passes, so this is paired with proof the failure path
    // actually rendered.
    expect(
      await screen.findByText(/saved only in this browser/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/rolled back/i)).not.toBeInTheDocument();
    expect(await authorityOf('magic_item')).toMatchObject({
      state: 'indexedDB',
      epoch: 1,
    });
  });

  // ---------------------------------------------------------------------
  // Final fix wave, F1 and F4: nothing internal reaches the DM.
  //
  // The whole-branch review's surviving mutant M14 deleted the cloud-failure
  // render entirely and 619/619 still passed -- the line was unpinned in BOTH
  // directions. The expected sentences below are RESTATED here rather than
  // imported from `migrationCopy.ts`, so the assertions cannot be satisfied
  // by whatever that module happens to return (the self-fulfilling-oracle
  // trap ruling R8.4 rejects). Each case therefore reddens on both mutations:
  // removing the render (no sentence) and removing the mapping (the token).
  // ---------------------------------------------------------------------

  const EXPECTED_CLOUD_FAILURE_COPY: Record<
    CloudActivationConflictReason,
    string
  > = {
    'cloud-generation-diverged':
      'Cloud sync already holds a different copy of this campaign data',
    'cloud-epoch-unknown':
      'Cloud sync did not report where this campaign data now lives',
    'cloud-epoch-unexpected':
      'Cloud sync moved this campaign data on while this run was in progress',
    'cloud-preview-unusable':
      'Cloud sync answered about this campaign data in a way this browser could not read',
  };

  it.each(
    Object.keys(EXPECTED_CLOUD_FAILURE_COPY) as CloudActivationConflictReason[]
  )(
    'explains the cloud refusal %s in product copy, never as the internal token',
    async reason => {
      failCloudFor('npc', reason);
      await renderWizardAtFamilyStep('npc');
      await confirmAndSubmit('npc');
      const heading = await screen.findByText(/^saved only in this browser$/i);
      const alert = heading.closest('[role="alert"]');
      expect(alert).not.toBeNull();
      const text = alert!.textContent ?? '';
      expect(text).toContain(EXPECTED_CLOUD_FAILURE_COPY[reason]);
      // The token itself, and every token in the union, must be absent from
      // the whole rendered tree -- not merely from this one alert.
      expect(document.body.textContent ?? '').not.toMatch(
        /cloud-(?:generation-diverged|epoch-unknown|epoch-unexpected|preview-unusable)/
      );
      expectCloudProductVocabulary(document.body);
    }
  );

  it('never renders raw transport text when the manifest preview rejects', async () => {
    // The exact rejection the manual browser gate saw on screen (defect D2).
    const errorAdapter = stubAdapter('encounter_definition', {
      previewError: 'Failed to fetch',
    });
    await renderWizardAtFamilyStepWithAdapters(
      [errorAdapter],
      'encounter_definition'
    );
    expect(
      await screen.findByText(/could not be previewed just now/i)
    ).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain('Failed to fetch');
    expectCloudProductVocabulary(document.body);
  });

  it('never renders raw transport text when the run itself rejects', async () => {
    const throwingAdapter = stubAdapter('encounter_definition');
    throwingAdapter.prepareIndexedDb = async () => {
      throw new TypeError('Failed to fetch');
    };
    await renderWizardAtFamilyStepWithAdapters(
      [throwingAdapter],
      'encounter_definition'
    );
    await confirmAndSubmit('encounter_definition');
    expect(
      await screen.findByText(/could not be moved to cloud sync just now/i)
    ).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain('Failed to fetch');
    expectCloudProductVocabulary(document.body);
  });

  it('never renders the internal repair-refusal reason when a repair is blocked', async () => {
    await seedMarkerAheadOfPointer('npc');
    await advanceToFamily('npc');
    await userEvent.click(
      await screen.findByRole('button', {
        name: /^check this browser and fix it$/i,
      })
    );
    expect(
      await screen.findByText(/could not be fixed automatically/i)
    ).toBeInTheDocument();
    // `decideAuthorityRepair`'s own prose -- internal reasoning, not copy.
    expect(document.body.textContent ?? '').not.toMatch(
      /pointer is not ahead of the marker/i
    );
    expect(document.body.textContent ?? '').not.toMatch(/IndexedDB/);
    expectCloudProductVocabulary(document.body);
  });

  // ---------------------------------------------------------------------
  // Final fix wave, D1 (manual browser gate): a data category whose cloud
  // call failed was stranded in BOTH surfaces. In the wizard the retry
  // re-ran `prepareIndexedDb` on an already-cut-over category and died on
  // "Local IndexedDB preparation did not satisfy every safety gate" -- and
  // it survived a full reload, so there was no way back at all.
  //
  // The stub's `prepareIndexedDb` now refuses re-preparation exactly as
  // `run*IndexedDbMigration` does, so these tests fail without the resume
  // branch rather than passing on a stub that would prepare twice.
  // ---------------------------------------------------------------------

  it('finishes a data category whose cloud call failed, once the cloud answers again', async () => {
    failCloudFor('npc', 'cloud-epoch-unknown');
    await runWizardThroughFamilies(['npc']);
    expect(await authorityOf('npc')).toMatchObject({ state: 'indexedDB' });
    expect(
      await screen.findByText(/^saved only in this browser$/i)
    ).toBeInTheDocument();
    const stagingBefore = countApiCalls('begin-staging');

    restoreCloudFor('npc');
    const retry = await confirmAndSubmit('npc');
    expect(retry.ok).toBe(true);
    expect(await authorityOf('npc')).toMatchObject({
      state: 'postgres',
      epoch: 1,
    });
    // The cloud half ran again; the LOCAL half did not.
    expect(countApiCalls('begin-staging')).toBe(stagingBefore + 1);
    expect(cutoverSpies.get('npc')!).toHaveBeenCalledTimes(1);
  });

  it('finishes a data category whose cloud call failed, after a full reload', async () => {
    failCloudFor('npc');
    await runWizardThroughFamilies(['npc']);
    expect(await authorityOf('npc')).toMatchObject({ state: 'indexedDB' });

    restoreCloudFor('npc');
    await reloadWizard();
    await advanceToFamily('npc');
    const retry = await confirmAndSubmit('npc');
    expect(retry.ok).toBe(true);
    expect(await authorityOf('npc')).toMatchObject({ state: 'postgres' });
    expect(cutoverSpies.get('npc')!).toHaveBeenCalledTimes(1);
  });

  it('treats an already-completed data category as done instead of failing', async () => {
    // The state a DM reaches by finishing this category from its own card,
    // or by confirming twice in one run. Re-running the whole chain would
    // refuse at `prepareIndexedDb`; the run must recognise "already done".
    const completed = stubAdapter('campaign_settings', {
      initialAuthority: {
        state: 'postgres',
        epoch: 1,
        campaignId: 'cloud-ALPHA',
        accountId: 'account-1',
        rolledBack: false,
      },
    });
    const controller = await renderRunController({ adapters: [completed] });
    const stagingBefore = countApiCalls('begin-staging');
    expect(await controller.runFamily('campaign_settings')).toEqual({
      outcome: 'success',
    });
    expect(countApiCalls('begin-staging')).toBe(stagingBefore);
    expect(cutoverSpies.get('campaign_settings')!).not.toHaveBeenCalled();
  });

  it('closing between steps writes nothing for any unconfirmed family', async () => {
    const before = await snapshotDurableState();
    await renderWizardAtFamilyStep('npc');
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(await snapshotDurableState()).toBe(before);
  });

  it('resumes after a reload without cutting over or staging twice', async () => {
    await runWizardThroughFamilies(['campaign_settings']);
    const stagingCalls = countApiCalls('begin-staging');
    await reloadWizard();
    await advanceToFamily('campaign_settings');
    expect(countApiCalls('begin-staging')).toBe(stagingCalls);
    expect(await authorityOf('campaign_settings')).toMatchObject({
      state: 'postgres',
      epoch: 1,
    });
    // R15's third resume property (ruling R7.6): exactly one receipt for
    // the run's manifest hash, verified -- and no initiated-only receipt
    // left orphaned by the reload.
    const receipts = await allDownloadReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].manifestHash).toBe(await currentDeviceHash());
    expect(typeof receipts[0].verifiedAt).toBe('string');
  });

  it('blocks a family whose marker and pointer disagree, and continues to the next', async () => {
    await seedMarkerPointerDisagreement('npc');
    await advanceToFamily('npc');
    expect(
      (await screen.findAllByText(/needs attention/i)).length
    ).toBeGreaterThan(0);
    expect(
      await screen.findByRole('button', { name: /^continue$/i })
    ).toBeEnabled();
    // It never advances silently: the family stays inconsistent until repaired.
    expect(await authorityOf('npc')).toMatchObject({ state: 'inconsistent' });
  });

  it('offers an inconsistent family a repair control, and continues after it succeeds', async () => {
    await seedMarkerPointerDisagreement('npc');
    await advanceToFamily('npc');
    await userEvent.click(
      await screen.findByRole('button', {
        name: /^check this browser and fix it$/i,
      })
    );
    // Anchored (R6.2): "could not be fixed" also contains "fixed", so the
    // success assertion must not be satisfiable by the refusal copy.
    expect(await screen.findByText(/was fixed/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not be fixed/i)).not.toBeInTheDocument();
    expect(await authorityOf('npc')).toMatchObject({ state: 'indexedDB' });
  });

  it('keeps an inconsistent family blocked when the repair refuses, and allows a skip', async () => {
    await seedMarkerAheadOfPointer('npc');
    await advanceToFamily('npc');
    await userEvent.click(
      await screen.findByRole('button', {
        name: /^check this browser and fix it$/i,
      })
    );
    expect(await screen.findByText(/could not be fixed/i)).toBeInTheDocument();
    expect(await authorityOf('npc')).toMatchObject({ state: 'inconsistent' });
    expect(
      await screen.findByRole('button', { name: /skip this one/i })
    ).toBeEnabled();
  });

  it('renders a planned family as not yet available and offers no controls', async () => {
    await advanceToFamily('location');
    // The rail's own "Not yet available" section caption is ALWAYS
    // rendered (it heads the planned-entries list regardless of which step
    // is current), so a bare presence check here is satisfied even if
    // `FamilyStep` never rendered its own not-available copy at all.
    // `findByText` on the FULL sentence (not the anchored word) is what
    // actually pins the step-level render.
    expect(
      await screen.findByText(/locations is not yet available in this wizard/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/type .* to confirm/i)
    ).not.toBeInTheDocument();
    expectCloudProductVocabulary(document.body);
  });

  it('renders every family-step alert at 390px without truncation, covering drift / cloud-failure / blocked / load-error / inconsistent-refusal', async () => {
    // Coordinator review, Important 5: restores Task 14's `alertVariants` +
    // `requiredSubstrings` table (copy-presence half of R6.1), and drives
    // it through every alert THIS task adds -- not only the one the
    // previous version happened to reach. Only one family step is ever on
    // screen at a time, so each scenario gets its own render rather than
    // trying to collect every alert kind into one DOM snapshot.
    setViewport(MIGRATION_NARROW_VIEWPORT_PX);

    function checkCurrentAlerts(
      variants: { match: RegExp; requiredSubstrings: string[] }[]
    ) {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
      for (const warning of alerts) {
        const text = warning.textContent ?? '';
        const variant = variants.find(candidate => candidate.match.test(text));
        expect(variant, `Unrecognised alert content: ${text}`).toBeDefined();
        for (const substring of variant!.requiredSubstrings) {
          expect(text).toContain(substring);
        }
        assertNoTruncationClasses(warning);
      }
    }

    // Scenario 1: drift.
    await runWizardThroughFamilies(['campaign_settings']);
    mutateCapturedKey('rollkeeper-calendar-data');
    await advanceToFamily('calendar');
    await screen.findByText(/download a fresh/i);
    checkCurrentAlerts([
      {
        match: /this browser.s data changed/i,
        requiredSubstrings: [
          "This browser's data changed",
          'changed since your safety copy was checked. Download a fresh backup of this browser and check it again before this data category can move.',
        ],
      },
    ]);
    // Ruling R2.2 / Task 15's deferred vocabulary mutation: every rendered
    // state must stay clean of "device", "family", "whole-device" and
    // "deliveries" copy, including accessible names (R5.2).
    expectCloudProductVocabulary(document.body);
    unmountCurrentRender();

    // Scenario 2: cloud failure. Final fix wave, F10: this used to require
    // only the alert HEADING, while the drift scenario above required the
    // full sentence -- and that asymmetry is exactly what let F1's raw token
    // through the R6.1 rewrite. The explanation sentence is required now.
    failCloudFor('npc', 'cloud-generation-diverged');
    await renderWizardAtFamilyStep('npc');
    await confirmAndSubmit('npc');
    checkCurrentAlerts([
      {
        match: /saved only in this browser/i,
        requiredSubstrings: [
          'Saved only in this browser',
          'Cloud sync already holds a different copy of this campaign data — most likely it was moved from another browser. Nothing here was changed. Check that other browser before moving this data category again.',
        ],
      },
    ]);
    expectCloudProductVocabulary(document.body);
    unmountCurrentRender();

    // Scenario 3: manifest blockers.
    const blockedAdapter = stubAdapter('magic_item', {
      manifest: {
        blockers: [
          {
            kind: 'schema-conflict',
            legacyId: 'mi-1',
            detail: 'Two records claim the same legacy id.',
          },
        ],
      },
    });
    await renderWizardAtFamilyStepWithAdapters([blockedAdapter], 'magic_item');
    checkCurrentAlerts([
      {
        match: /some records need attention/i,
        requiredSubstrings: [
          'Some records need attention before this can move',
          'Two records claim the same legacy id.',
        ],
      },
    ]);
    expectCloudProductVocabulary(document.body);
    unmountCurrentRender();

    // Scenario 4: manifest preview failure. Final fix wave, F4: the thrown
    // message is no longer rendered -- an internal sentence here stands in
    // for the `DOMException` a private window produces, and the DM sees the
    // channel's vetted copy instead.
    const errorAdapter = stubAdapter('encounter_definition', {
      previewError: 'The legacy encounter envelope is corrupted.',
    });
    await renderWizardAtFamilyStepWithAdapters(
      [errorAdapter],
      'encounter_definition'
    );
    checkCurrentAlerts([
      {
        match: /could not be previewed just now/i,
        requiredSubstrings: [
          'This data category could not be previewed just now. Nothing here was changed. Try again, or skip this one and come back to it.',
        ],
      },
    ]);
    expect(document.body.textContent ?? '').not.toContain(
      'The legacy encounter envelope is corrupted.'
    );
    expectCloudProductVocabulary(document.body);
    unmountCurrentRender();

    // Scenario 5: inconsistent, repair refuses (two alerts coexist: the
    // persistent "needs attention" headline, and the refusal message).
    await seedMarkerAheadOfPointer('combat_log_archive');
    await advanceToFamily('combat_log_archive');
    await userEvent.click(
      await screen.findByRole('button', {
        name: /^check this browser and fix it$/i,
      })
    );
    await screen.findByText(/could not be fixed/i);
    checkCurrentAlerts([
      {
        match: /this browser.s record needs attention/i,
        requiredSubstrings: ["This browser's record needs attention"],
      },
      {
        // Final fix wave, F4: `decideAuthorityRepair`'s internal reason
        // prose is no longer concatenated onto product copy.
        match: /could not be fixed/i,
        requiredSubstrings: [
          "This browser's record could not be fixed automatically. Nothing here was changed. Skip this data category for now — your campaign data is still here in this browser.",
        ],
      },
    ]);
    expectCloudProductVocabulary(document.body);
  });

  it('renders the manifest fingerprint under confirmation, and it is the one about to be cut over', async () => {
    // Coordinator review round 2, Critical 1: the previous version asserted
    // `note` contains `'fingerprint-…'` -- but every stub's fingerprint was
    // `fingerprint-<family>`, and `'fingerprint-'` is EXACTLY
    // FINGERPRINT_DISPLAY_LENGTH (12) characters, so that assertion pinned
    // only the shared 12-char prefix every one of the six stubs happened to
    // share, not this family's actual manifest. Fixed two ways: (1) the
    // stub's fingerprint is now `<family>-fingerprint`, which differs
    // WITHIN the first 12 characters per family; (2) the expected value is
    // computed here by calling this exact adapter's own `previewManifest`
    // directly -- the real manifest about to be cut over -- and truncating
    // it the same way `FamilyStep` does, rather than asserting a literal.
    await renderWizardAtFamilyStep('campaign_settings');
    await screen.findByLabelText(/type .* to confirm/i);
    // R12: `familyLabel`/`campaignLabel`/`manifestFingerprint` from the
    // structured confirmation object, all rendered together -- not only
    // `requiredPhrase`.
    const note = screen.getByText(/confirming campaign_settings for/i);
    expect(note).toHaveTextContent('Campaign');

    const adapter = stubFamilies().find(a => a.family === 'campaign_settings')!;
    const context = await minimalMigrationRunContext();
    const manifest = await adapter.previewManifest(context);
    expect(note).toHaveTextContent(shortHashForTest(manifest.fingerprint));

    // Cross-family substitution -- the literal R12 hazard: confirming a
    // DIFFERENT family's manifest fingerprint under this family's typed
    // confirmation. The rendered value must not be satisfiable by any
    // other registered family's fingerprint either.
    const otherAdapter = stubFamilies().find(a => a.family === 'calendar')!;
    const otherContext = await minimalMigrationRunContext();
    const otherManifest = await otherAdapter.previewManifest(otherContext);
    expect(note).not.toHaveTextContent(
      shortHashForTest(otherManifest.fingerprint)
    );
  });

  it('renders "Chosen" once a persisted selection record matches this run, before any cutover', async () => {
    const hash = await currentDeviceHash();
    selectCampaignSettings(localStorage, {
      namespace: 'user:account-1',
      campaignId: 'cloud-ALPHA',
      confirmed: true,
      recovery: { runId: 'run-1', manifestHash: hash, createdAt: FIXED_TS },
      now: () => FIXED_TS,
    });
    await renderWizardAtFamilyStep('campaign_settings');
    // Exactly 2, not merely >0: the stage chain's "Chosen" BOX renders its
    // label unconditionally regardless of `done` (only the icon differs),
    // so a bare presence check is satisfied even when nothing was ever
    // selected. The badge (STEP_BADGE.selected) is the second occurrence,
    // and only renders "Chosen" when `stepState === 'selected'`.
    await waitFor(async () => {
      expect((await screen.findAllByText(/^chosen$/i)).length).toBe(2);
    });
    // Not yet cut over -- this browser's authority is still legacy. Proves
    // "Chosen" is read from the persisted selection record, not inferred
    // from an authority that has already moved.
    expect(await authorityOf('campaign_settings')).toMatchObject({
      state: 'legacy',
    });
  });

  it('renders "Copied here" once the persisted CUTOVER_READY checkpoint is reached', async () => {
    const hash = await currentDeviceHash();
    selectCampaignSettings(localStorage, {
      namespace: 'user:account-1',
      campaignId: 'cloud-ALPHA',
      confirmed: true,
      recovery: { runId: 'run-1', manifestHash: hash, createdAt: FIXED_TS },
      now: () => FIXED_TS,
    });
    await seedPreparedCheckpoint({
      family: 'campaign_settings',
      namespace: 'user:account-1',
      campaignId: 'cloud-ALPHA',
      runId: 'generation-x',
    });
    await renderWizardAtFamilyStep('campaign_settings');
    // Exactly 2 (badge + stage-chain box) -- see the "Chosen" test above
    // for why a bare presence check would be vacuous here too.
    await waitFor(async () => {
      expect((await screen.findAllByText(/^copied here$/i)).length).toBe(2);
    });
    expect(await authorityOf('campaign_settings')).toMatchObject({
      state: 'legacy',
    });
  });

  it('requires the exact typed phrase, not a prefix', async () => {
    await renderWizardAtFamilyStep('campaign_settings');
    const input = await screen.findByLabelText(/type .* to confirm/i);
    const phrase = confirmationPhraseFor('campaign_settings');
    await userEvent.type(input, phrase.slice(0, 4));
    expect(
      screen.getByRole('button', { name: /move this data to cloud sync/i })
    ).toBeDisabled();
  });

  it('matches the typed phrase case-insensitively after trimming', async () => {
    await renderWizardAtFamilyStep('campaign_settings');
    const input = await screen.findByLabelText(/type .* to confirm/i);
    const phrase = confirmationPhraseFor('campaign_settings');
    await userEvent.type(input, `  ${phrase.toUpperCase()}  `);
    expect(
      screen.getByRole('button', { name: /move this data to cloud sync/i })
    ).toBeEnabled();
  });

  it('renders the exact manifest -- counts, bytes, blockers and references', async () => {
    const adapter = stubAdapter('magic_item', {
      manifest: {
        recordCount: 7,
        totalBytes: 2048,
        records: [
          {
            legacyId: 'mi-1',
            schemaVersion: 1,
            byteCount: 10,
            payloadFingerprint: 'p1',
            tombstoned: false,
            references: [
              { family: 'campaign_settings', legacyId: 'r1' },
              { family: 'npc', legacyId: 'r2' },
            ],
          },
          {
            legacyId: 'mi-2',
            schemaVersion: 1,
            byteCount: 12,
            payloadFingerprint: 'p2',
            tombstoned: false,
            references: [],
          },
        ],
      },
    });
    await renderWizardAtFamilyStepWithAdapters([adapter], 'magic_item');
    await screen.findByLabelText(/type .* to confirm/i);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2048 bytes')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // blockers
    expect(screen.getByText('2')).toBeInTheDocument(); // references (1 + 0)
  });

  it('blocks a family with a manifest blocker, renders its alert, and allows a skip -- no confirm input', async () => {
    const adapter = stubAdapter('magic_item', {
      manifest: {
        blockers: [
          {
            kind: 'schema-conflict',
            legacyId: 'mi-1',
            detail: 'Two records claim the same legacy id.',
          },
        ],
      },
    });
    await renderWizardAtFamilyStepWithAdapters([adapter], 'magic_item');
    const alert = await screen.findByText(/some records need attention/i);
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    expect(
      screen.getByText(/two records claim the same legacy id/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/type .* to confirm/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /skip this one/i })
    ).toBeEnabled();
  });

  it('renders a rolled-back family honestly, distinct from never-migrated legacy', async () => {
    const adapter = stubAdapter('magic_item', {
      initialAuthority: {
        state: 'legacy',
        epoch: 2,
        campaignId: 'cloud-ALPHA',
        accountId: 'account-1',
        rolledBack: true,
      },
    });
    await renderWizardAtFamilyStepWithAdapters([adapter], 'magic_item');
    expect(
      (await screen.findAllByText(/^rolled back$/i)).length
    ).toBeGreaterThan(0);
  });

  it('shows the "Moved to cloud sync" status panel once postgres authority is reached', async () => {
    const adapter = stubAdapter('magic_item');
    await renderWizardAtFamilyStepWithAdapters([adapter], 'magic_item');
    await confirmAndSubmit('magic_item');
    const heading = await screen.findByText(/^moved to cloud sync$/i);
    expect(heading.closest('[role="status"]')).not.toBeNull();
  });

  it('never lists Player inbox in the rendered rail', async () => {
    await mountStubWizardResumed();
    expect(screen.queryByText(/player inbox/i)).not.toBeInTheDocument();
  });

  it('has no orphaned receipt after a reload with a family stuck at indexedDB (post-cutover, cloud not yet activated)', async () => {
    failCloudFor('npc');
    await runWizardThroughFamilies(['npc']);
    expect(await authorityOf('npc')).toMatchObject({ state: 'indexedDB' });
    expect(await selectionRecordFor('npc')).not.toBeNull();
    await reloadWizard();
    await advanceToFamily('npc');
    const receipts = await allDownloadReceipts();
    expect(receipts).toHaveLength(1);
    expect(typeof receipts[0].verifiedAt).toBe('string');
    expect(await authorityOf('npc')).toMatchObject({ state: 'indexedDB' });
  });

  it('has no orphaned selection after a reload strictly between selectFamily and prepareIndexedDb', async () => {
    // Coordinator review round 2, Important 5: constructible with the
    // existing stub seam alone -- no real adapters, no artificial await
    // gate. Wraps the cached `campaign_settings` stub's `selectFamily` to
    // ALSO perform the real production write a real adapter's
    // `selectFamily` makes (`selectCampaignSettings`, the actual function
    // production code calls), and its `prepareIndexedDb` to throw, so the
    // interruption lands exactly between the two -- the point MINOR 9
    // originally called unconstructible.
    await mountStubWizardResumed();
    const target = stubFamilies().find(
      candidate => candidate.family === 'campaign_settings'
    )!;
    const originalSelect = target.selectFamily.bind(target);
    target.selectFamily = async context => {
      await originalSelect(context);
      selectCampaignSettings(localStorage, {
        namespace: 'user:account-1',
        campaignId: context.campaignId,
        confirmed: true,
        recovery: {
          runId: context.recovery.runId,
          manifestHash: context.recovery.manifestHash,
          createdAt: context.recovery.createdAt,
        },
        now: () => FIXED_TS,
      });
    };
    target.prepareIndexedDb = async () => {
      throw new Error('Interrupted before prepare.');
    };

    await clickContinueUntil(familyHeadingLabel('campaign_settings'));
    await confirmAndSubmit('campaign_settings');
    await reloadWizard();
    await advanceToFamily('campaign_settings');

    // Exactly 2 (badge + stage-chain box), not merely >0 -- see the
    // "Chosen"/"Copied here" tests above for why a bare presence check
    // would be vacuous here too. Only reaches 2 if the real selection
    // record written BEFORE the interruption survives the reload and is
    // read back as matching this run.
    await waitFor(async () => {
      expect((await screen.findAllByText(/^chosen$/i)).length).toBe(2);
    });
    expect(await authorityOf('campaign_settings')).toMatchObject({
      state: 'legacy',
    });

    const receipts = await allDownloadReceipts();
    expect(receipts).toHaveLength(1);
    expect(typeof receipts[0].verifiedAt).toBe('string');
  });

  it('catches drift injected between selectFamily and prepareIndexedDb (checkpoint 1 already passed)', async () => {
    await mountStubWizardResumed();
    const target = stubFamilies().find(a => a.family === 'calendar')!;
    const originalPrepare = target.prepareIndexedDb.bind(target);
    target.prepareIndexedDb = async context => {
      mutateCapturedKey('rollkeeper-calendar-data');
      return originalPrepare(context);
    };
    await clickContinueUntil(familyHeadingLabel('calendar'));
    const result = await confirmAndSubmit('calendar');
    expect(result.ok).toBe(false);
    expect(await screen.findByText(/download a fresh/i)).toBeInTheDocument();
    expect(await authorityOf('calendar')).toMatchObject({ state: 'legacy' });
    // selectFamily DID run before the injected drift -- proves checkpoint 1
    // passed and this is checkpoint 2 (before commitLocalCutover) catching it.
    expect(await selectionRecordFor('calendar')).not.toBeNull();
    expect(countApiCalls('begin-staging')).toBe(0);
  });

  it('catches drift injected at the end of commitLocalCutover, between the two authority transitions', async () => {
    await mountStubWizardResumed();
    const target = stubFamilies().find(a => a.family === 'magic_item')!;
    const originalCommit = target.commitLocalCutover.bind(target);
    target.commitLocalCutover = async (context, input) => {
      const result = await originalCommit(context, input);
      mutateCapturedKey('rollkeeper-calendar-data');
      return result;
    };
    await clickContinueUntil(familyHeadingLabel('magic_item'));
    const result = await confirmAndSubmit('magic_item');
    expect(result.ok).toBe(false);
    expect(await screen.findByText(/download a fresh/i)).toBeInTheDocument();
    // The first transition (legacy -> indexedDB) already committed once and
    // is not reversed; the second (indexedDB -> postgres) never started.
    expect(await authorityOf('magic_item')).toMatchObject({
      state: 'indexedDB',
    });
    expect(countApiCalls('begin-staging')).toBe(0);
  });

  it('reports an already-routed family as moved on reopen, without the DM revisiting its step', async () => {
    await runWizardThroughFamilies(['campaign_settings']);
    await reloadWizard();
    // Deliberately no `advanceToFamily` call: the assertion below must be
    // satisfied purely by mount-time discovery, not by navigating into any
    // family step this session.
    expect(await screen.findByText(/1 of 6/)).toBeInTheDocument();
  });

  it('closing between steps writes nothing, and leaves a pre-existing selection record from an abandoned run untouched', async () => {
    // Spec R11: "deleting it would itself be a write the DM never
    // confirmed." A close/reload after a prior, abandoned run's selection
    // record must not touch it -- neither writing over it nor deleting it.
    const hash = await currentDeviceHash();
    selectCampaignSettings(localStorage, {
      namespace: 'user:account-1',
      campaignId: 'cloud-ALPHA',
      confirmed: true,
      recovery: { runId: 'stale-run', manifestHash: hash, createdAt: FIXED_TS },
      now: () => FIXED_TS,
    });
    const before = await snapshotDurableState();
    await renderWizardAtFamilyStep('npc');
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(await snapshotDurableState()).toBe(before);
  });

  it('surfaces a failure instead of an unhandled rejection when the selection/prepared-state read fails', async () => {
    // Coordinator review round 2, item 6: FamilyStep's selection/prepared
    // effect had no error handling at all, unlike the manifest effect
    // right above it. Forces the exact failure mode that effect can hit --
    // `openRollkeeperDatabase()` rejecting -- and asserts it surfaces as a
    // real `loadError` alert rather than an unhandled promise rejection.
    const spy = vi
      .spyOn(localDatabaseModule, 'openRollkeeperDatabase')
      .mockRejectedValueOnce(new Error('IndexedDB is unavailable'));
    // Coordinator review round 3, item 2(b): `finally`, not a bare trailing
    // call -- this project sets no global `restoreMocks`/`afterEach`, so a
    // failure on the line above would otherwise leak this spy into every
    // later test in the file.
    try {
      await renderWizardAtFamilyStep('campaign_settings');
      // Final fix wave, F4: this used to assert the RAW message rendered.
      // It is now the channel's vetted copy, and the raw text must be
      // absent -- in production this rejection is a `DOMException` whose
      // wording is the browser's, not ours.
      const alert = await screen.findByText(
        /could not be checked just now\. Nothing here was changed/i
      );
      expect(alert.closest('[role="alert"]')).not.toBeNull();
      expect(document.body.textContent ?? '').not.toContain(
        'IndexedDB is unavailable'
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('MigrationWizard — report', () => {
  it('verifies on entry and again on Refresh, and never persists the result', async () => {
    await openReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(6));
    await refreshReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(12));
    expect(await storedVerificationClaims()).toEqual([]);
  });

  it('re-verifies when the report is reopened', async () => {
    await openReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(6));
    await closeReport();
    await openReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(12));
  });

  it('discards a stale "Verified" claim when a later verification fails, and surfaces the failure', async () => {
    // CRITICAL (coordinator review round 1): a REJECTED `verifyCloud` call
    // must not leave the PREVIOUS pass's "Verified" entry standing. The
    // reviewer's own probe: enter the report (all six verify and pass),
    // then make npc's NEXT check throw on Refresh -- the badge must flip to
    // "Not verified", the report must stop claiming "All campaign data is
    // synced", and the DM must be told the check failed, not shown silence.
    await openReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(6));
    expect(
      await screen.findByText(/all campaign data is synced/i)
    ).toBeInTheDocument();
    expect(await screen.findByTestId('npc-status')).toHaveTextContent(
      /^verified$/i
    );

    throwVerificationFor('npc', 'IndexedDB is unavailable.');
    await refreshReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(12));

    expect(await screen.findByTestId('npc-status')).toHaveTextContent(
      /^not verified$/i
    );
    expect(
      screen.queryByText(/all campaign data is synced/i)
    ).not.toBeInTheDocument();
    const alert = await screen.findByTestId('verification-error-alert');
    // Important 3: the role, not just the testid -- a failure announced as
    // `role="status"` would be an accessibility regression no testid-only
    // query would ever catch.
    expect(alert).toHaveAttribute('role', 'alert');
    expect(within(alert).getByText(/npc/i)).toBeInTheDocument();
    // Important 1: the RAW internal error text must never reach the DM --
    // only the mapped, R17-clean copy.
    expect(
      within(alert).queryByText(/IndexedDB is unavailable/i)
    ).not.toBeInTheDocument();
    expect(
      within(alert).getByText(/could not be checked/i)
    ).toBeInTheDocument();
  });

  it('does not keep counting a family in the progress numerator after it is disabled', async () => {
    // Same root cause as the stale-claim bug above, different symptom: a
    // family verified in an earlier batch, then DISABLED, never appears in
    // a later batch (excluded from `enabledAdapters()`) to overwrite its
    // old "verified" entry -- so a merge-into-previous-state implementation
    // keeps counting it forever.
    await openReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(6));
    const claimBefore = await screen.findByTestId('report-claim');
    expect(within(claimBefore).getByText(/6 of 6/)).toBeInTheDocument();

    disableFamily('npc');
    await refreshReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(11));

    const claim = await screen.findByTestId('report-claim');
    expect(within(claim).getByText(/5 of 6/)).toBeInTheDocument();
  });

  it('never renders raw internal error text verbatim in the verification-error alert', async () => {
    // Important 1 (coordinator review round 2): the reviewer's own R17
    // hazard -- all six `*Api` gateways throw
    // `'<Family> changed on another browser.'` on HTTP 409, from EVERY RPC
    // including `preview-enrollment`. Before this fix that string rendered
    // verbatim, as unvetted internal text, instead of the mapped clean
    // sentence below.
    await openReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(6));
    const rawMessage = changedOnAnotherBrowserMessage('NPCs');
    throwVerificationFor('npc', rawMessage);
    await refreshReport();
    const alert = await screen.findByTestId('verification-error-alert');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(within(alert).queryByText(rawMessage)).not.toBeInTheDocument();
    expect(within(alert).getByText(/npc/i)).toBeInTheDocument();
    // The known-failure-class mapping actually branched (not just "always
    // generic") -- this is the SPECIFIC clean sentence for a conflict, not
    // the bare fallback.
    expect(
      within(alert).getByText(
        /changed somewhere else while this browser was checking/i
      )
    ).toBeInTheDocument();
    // Minor 5 (coordinator review round 1): none of the seven existing
    // `expectCloudProductVocabulary` call sites reach the verification-error
    // alert's mapped state -- add one here.
    expectCloudProductVocabulary(document.body);
  });

  it('falls back to the generic clean message for an unrecognised verification failure', async () => {
    await openReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(6));
    throwVerificationFor(
      'calendar',
      'unexpected token < in JSON at position 0'
    );
    await refreshReport();
    const alert = await screen.findByTestId('verification-error-alert');
    expect(
      within(alert).queryByText(/unexpected token/i)
    ).not.toBeInTheDocument();
    expect(
      within(alert).getByText(/could not be checked just now/i)
    ).toBeInTheDocument();
  });

  it('ignores a stale verification response that lands after a newer one', async () => {
    const slow = deferVerification('npc');
    await openReport();
    await refreshReport();
    // The FIRST (deferred, now-superseded) npc call is resolved only after
    // the second request has already fired -- this is what the request
    // token must discard.
    slow.resolve({
      authorityAgrees: true,
      cloudAuthority: 'postgres',
      epoch: 1,
      recordCount: 1,
      documentsMatch: false,
      tombstonesMatch: false,
      outboxEmpty: false,
      conflictCount: 1,
      verified: false,
    });
    // Anchored (ruling: `/verified/i` alone is satisfied by "Not verified").
    expect(await screen.findByTestId('npc-status')).toHaveTextContent(
      /^verified$/i
    );
  });

  it('shows a visible, non-disabling busy indicator on Refresh while verification is in flight', async () => {
    const slow = deferVerification('npc');
    await openReport();
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    // Non-disabling: still clickable while the check is running (spec R14
    // requires a fresh Refresh to be able to supersede a slow one).
    expect(refreshButton).toBeEnabled();
    expect(refreshButton).toHaveAttribute('aria-busy', 'true');
    expect(refreshButton.querySelector('.animate-spin')).not.toBeNull();
    slow.resolve({
      authorityAgrees: true,
      cloudAuthority: 'postgres',
      epoch: 1,
      recordCount: 1,
      documentsMatch: true,
      tombstonesMatch: true,
      outboxEmpty: true,
      conflictCount: 0,
      verified: true,
    });
    await waitFor(() =>
      expect(refreshButton).toHaveAttribute('aria-busy', 'false')
    );
    expect(refreshButton.querySelector('.animate-spin')).toBeNull();
  });

  it('claims All campaign data is synced only when all six registered families are enabled, postgres and verified', async () => {
    await openReportWithAllSixMigratedAndVerified();
    expect(
      await screen.findByText(/all campaign data is synced/i)
    ).toBeInTheDocument();
  });

  it('claims only Available campaign data is synced when a registered family is disabled', async () => {
    disableFamily('combat_log_archive');
    await openReportWithEveryEnabledFamilyVerified();
    expect(
      await screen.findByText(/available campaign data is synced/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/all campaign data is synced/i)
    ).not.toBeInTheDocument();
    // Ruling (known plan defect 2): scoped to the dedicated callout, not the
    // document -- the family's own always-rendered row also says "Combat
    // log", which would satisfy an unscoped query regardless of this task's
    // own behaviour.
    const disabledStatus = await screen.findByTestId(
      'disabled-categories-status'
    );
    expect(within(disabledStatus).getByText(/combat log/i)).toBeInTheDocument();
    expect(
      await screen.findByTestId('combat_log_archive-status')
    ).toHaveTextContent(/^turned off$/i);
    // A disabled family's own `verifyCloud` must never be called -- pins
    // `verifyReport`'s use of `enabledAdapters()` rather than
    // `registeredAdapters()` to pick which families to verify.
    expect(verifyCloudCalls).not.toContain('combat_log_archive');
  });

  it('claims Not finished yet, not Available, when every registered family is disabled', async () => {
    // Guards the `enabledEntries.length > 0` term: `.every()` over an EMPTY
    // enabled set is vacuously true, which would wrongly satisfy "Available
    // campaign data is synced" with nothing actually enabled.
    for (const family of ALL_STUB_FAMILIES) disableFamily(family);
    await openReportWithAllSixMigrated();
    expect(await screen.findByText(/not finished yet/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/available campaign data is synced/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/all campaign data is synced/i)
    ).not.toBeInTheDocument();
    expect(verifyCloudCalls).toHaveLength(0);
  });

  it('excludes a migrated family’s own legacy key from the cross-family check', async () => {
    // Guards the exclusion set in `checkCrossFamilyDrift`: without it, EVERY
    // family's own legacy key -- which spec R2b allows to keep changing
    // after cutover -- would wrongly trip the cross-family drift alert.
    await openReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(6));
    mutateCapturedKey('rollkeeper-npc-data');
    await refreshReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(12));
    expect(
      screen.queryByTestId('cross-family-drift-alert')
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId('npc-status')).toHaveTextContent(
      /^verified$/i
    );
  });

  it('excludes a family at indexedDB authority (not yet postgres) from the cross-family check too', async () => {
    // Guards the OTHER half of `checkCrossFamilyDrift`'s exclusion
    // condition (`state === 'indexedDB' || state === 'postgres'`): without
    // the `indexedDB` half, a family that has cut over LOCALLY but not yet
    // confirmed to the cloud would wrongly trip the cross-family drift
    // alert on its own legacy key.
    const adapters = ALL_STUB_FAMILIES.map(family =>
      family === 'npc'
        ? stubAdapter('npc', {
            initialAuthority: {
              state: 'indexedDB',
              epoch: 1,
              campaignId: 'cloud-ALPHA',
              accountId: 'account-1',
              rolledBack: false,
            },
          })
        : stubAdapter(family, {
            initialAuthority: {
              state: 'postgres',
              epoch: 1,
              campaignId: 'cloud-ALPHA',
              accountId: 'account-1',
              rolledBack: false,
            },
          })
    );
    await mountStubWizardResumedWithAdapters(adapters);
    await advanceToReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(6));
    mutateCapturedKey('rollkeeper-npc-data');
    await refreshReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(12));
    expect(
      screen.queryByTestId('cross-family-drift-alert')
    ).not.toBeInTheDocument();
  });

  it('resolving a verification after the wizard unmounts throws no unhandled error', async () => {
    // NOT a mutation-discriminating test for `!mountedRef.current`: React 18
    // silently no-ops a `setState` call on an unmounted component (the
    // "Can't perform a state update on an unmounted component" warning was
    // removed in React 18), so removing this guard and re-running this exact
    // test still passes -- confirmed by hand during mutation-verify and
    // recorded in the task report. `mountedRef` is kept for consistency with
    // this file's already-established idiom (`discover()` uses the same
    // pattern) and as defense against a future React downgrade, not because
    // this test can prove it is load-bearing today.
    const slow = deferVerification('npc');
    await openReport();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      currentRender?.unmount();
      currentRender = null;
      slow.resolve({
        authorityAgrees: true,
        cloudAuthority: 'postgres',
        epoch: 1,
        recordCount: 1,
        documentsMatch: true,
        tombstonesMatch: true,
        outboxEmpty: true,
        conflictCount: 0,
        verified: true,
      });
      await Promise.resolve();
      await Promise.resolve();
      const unmountedWarning = errorSpy.mock.calls.some(
        args =>
          typeof args[0] === 'string' &&
          /unmounted component|update.*state.*unmounted/i.test(args[0])
      );
      expect(unmountedWarning).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('claims Not finished yet when nothing has been verified yet', async () => {
    await openReportWithNothingMigratedYet();
    expect(await screen.findByText(/not finished yet/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/all campaign data is synced/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/available campaign data is synced/i)
    ).not.toBeInTheDocument();
    // Scoped to the report's own claim card: the rail sidebar ALSO renders
    // an "X of Y ... moved to cloud sync" line built from different counts,
    // which an unscoped `/0 of 6/` query can collide with.
    const claim = await screen.findByTestId('report-claim');
    expect(within(claim).getByText(/0 of 6/)).toBeInTheDocument();
    // Distinguishes "never left legacy" from "moved but not verified" --
    // both are `verified: false`, but only the first is `notStarted`.
    expect(await screen.findByTestId('npc-status')).toHaveTextContent(
      /^not moved yet$/i
    );
  });

  it('refuses All campaign data is synced when one category is unverified, and names it', async () => {
    failVerificationFor('calendar');
    await openReportWithAllSixMigrated();
    await screen.findByTestId('unverified-categories-alert');
    expect(
      screen.queryByText(/all campaign data is synced/i)
    ).not.toBeInTheDocument();
    // Ruling (known plan defect 2): scoped to the alert, not the document.
    const alert = screen.getByTestId('unverified-categories-alert');
    expect(within(alert).getByText(/calendar/i)).toBeInTheDocument();
  });

  it('lists the planned families as not yet available and excludes them from the denominator', async () => {
    await openReportWithAllSixMigratedAndVerified();
    const claim = await screen.findByTestId('report-claim');
    expect(within(claim).getByText(/6 of 6/)).toBeInTheDocument();
    // Settled decision: Locations AND Battle maps, never Player inbox.
    expect(
      await screen.findByText(/battle maps.*not yet available/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/locations.*not yet available/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/player inbox/i)).not.toBeInTheDocument();
  });

  it('counts verified families in the progress line, not merely postgres authority (Task 15 carry-forward)', async () => {
    // npc is postgres-authoritative (via `stubFamiliesAllPostgres`) but its
    // OWN live verification fails -- the progress numerator must track
    // `verified`, not `authority.state === 'postgres'`.
    failVerificationFor('npc');
    await openReportWithAllSixMigrated();
    await screen.findByTestId('unverified-categories-alert');
    const claim = await screen.findByTestId('report-claim');
    expect(within(claim).getByText(/5 of 6/)).toBeInTheDocument();
    expect(await screen.findByTestId('npc-status')).toHaveTextContent(
      /^not verified$/i
    );
  });

  // Ruling (Minor 5, fix round 2): renamed -- this mounts a STUB adapter and a REAL acknowledged outbox row; it proves the REPORT trusts `verification.outboxEmpty` rather than independently requiring the raw table to be physically empty. The settled-vs-empty SEMANTIC itself is pinned per-adapter by `adapterConformance.ts`.
  it('does not independently require the outbox to be physically empty (trusts the adapter\u2019s outboxEmpty)', async () => {
    await openReportWithAcknowledgedOutboxRows();
    // Anchored: distinguishes "Verified" from "Not verified".
    expect(await screen.findByTestId('npc-status')).toHaveTextContent(
      /^verified$/i
    );
  });

  // Ruling (Minor 5, fix round 2): renamed -- this mounts a STUB adapter and a REAL preserved conflict row; it proves the REPORT never deletes/mutates that IndexedDB record while verifying, and trusts `verification.conflictCount` rather than re-deriving it. The unresolved-only SEMANTIC itself is pinned per-adapter by `adapterConformance.ts`.
  it('never mutates a real IndexedDB conflict record while verifying (trusts the adapter\u2019s conflictCount)', async () => {
    await openReportWithPreservedResolvedCandidate();
    expect(await screen.findByTestId('npc-status')).toHaveTextContent(
      /^verified$/i
    );
    expect(await preservedCandidateStillReadable()).toBe(true);
  });

  it('refuses verification when the adapter reports a document mismatch', async () => {
    await openReportWithDocumentMismatch('calendar');
    await screen.findByTestId('unverified-categories-alert');
    expect(
      screen.queryByText(/all campaign data is synced/i)
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId('calendar-status')).toHaveTextContent(
      /^not verified$/i
    );
  });

  it('reports an unrelated recovery entry whose bytes changed since the run’s bundle was captured', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      JSON.stringify({
        state: { dmId: 'dm-local', characters: [] },
        version: 1,
      })
    );
    await openReport();
    await waitFor(() => expect(verifySpyCallCount()).toBe(6));
    mutateCapturedKey('rollkeeper-player-data');
    await refreshReport();
    const alert = await screen.findByTestId('cross-family-drift-alert');
    expect(
      within(alert).getByText(/rollkeeper-player-data/)
    ).toBeInTheDocument();
    // Cross-family drift is a global condition (spec R8): it blocks EVERY
    // family's verified claim, not only the one that happens to own the
    // changed key.
    expect(await screen.findByTestId('npc-status')).toHaveTextContent(
      /^not verified$/i
    );
  });

  it('never renders Player inbox in the report, even when a registered family is disabled', async () => {
    disableFamily('magic_item');
    await openReportWithEveryEnabledFamilyVerified();
    await screen.findByTestId('disabled-categories-status');
    expect(screen.queryByText(/player inbox/i)).not.toBeInTheDocument();
  });

  it('renders every report warning at a 390px viewport without truncation', async () => {
    // Ruling (Important 2, fix round 2): the reviewer's own probe -- a
    // throwing family co-occurring with the other two alert kinds -- is
    // reproduced here, and its alert is added to the table below. Before
    // this fix `alertVariants` enumerated only two kinds and threw
    // "Unrecognised alert content" the instant a third (the verification-
    // error alert) rendered alongside them.
    failVerificationFor('calendar');
    localStorage.setItem(
      'rollkeeper-player-data',
      JSON.stringify({ state: { dmId: 'dm-local' }, version: 1 })
    );
    await openReportWithAllSixMigrated();
    await screen.findByTestId('unverified-categories-alert');
    // `throwVerificationFor` is one-shot -- armed for the UPCOMING Refresh
    // batch (not the initial entry batch), together with the mutated key,
    // so all three alert kinds render from the SAME batch simultaneously.
    throwVerificationFor('npc', 'IndexedDB is unavailable.');
    mutateCapturedKey('rollkeeper-player-data');
    await refreshReport();
    await screen.findByTestId('unverified-categories-alert');
    await screen.findByTestId('verification-error-alert');
    await screen.findByTestId('cross-family-drift-alert');
    setViewport(MIGRATION_NARROW_VIEWPORT_PX);

    const alertVariants: { match: RegExp; requiredSubstrings: string[] }[] = [
      {
        match: /not yet confirmed in cloud sync/i,
        requiredSubstrings: [
          'Not yet confirmed in cloud sync',
          'has not been confirmed in cloud sync yet',
        ],
      },
      {
        match: /this browser.s data changed outside this run/i,
        requiredSubstrings: [
          "This browser's data changed outside this run",
          'rollkeeper-player-data',
          'does not belong to a data category you have moved yet',
        ],
      },
      {
        match: /could not check cloud sync/i,
        requiredSubstrings: [
          'Could not check cloud sync',
          'could not be checked just now',
          // Ruling (Important 1): the raw thrown message must NEVER appear
          // here -- only the R17-clean, mapped copy.
          'This is not a claim that any of these are out of sync',
        ],
      },
    ];

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(3);
    for (const warning of alerts) {
      const text = warning.textContent ?? '';
      const variant = alertVariants.find(candidate =>
        candidate.match.test(text)
      );
      expect(variant, `Unrecognised alert content: ${text}`).toBeDefined();
      for (const substring of variant!.requiredSubstrings) {
        expect(text).toContain(substring);
      }
      // The raw internal message must never leak into the DOM here either.
      expect(text).not.toContain('IndexedDB is unavailable');
      assertNoTruncationClasses(warning);
    }
  });
});

/**
 * Task 17: `anyCutoverCommitted` (Task 14, R9.10) and `discoveryAttempted`
 * (added by Task 17 to close the stale-`false` hazard) have no other
 * observable surface than the `onClose` callback's argument -- neither is
 * ever rendered. This is that dedicated test, and it also pins the hazard
 * itself: a fresh mount (what a page reload produces) resets both to their
 * initial `false`, even though the underlying adapter authority (this
 * suite's stand-in for real persisted IndexedDB/localStorage state) still
 * reports a completed cutover. `anyCutoverCommitted: false` therefore does
 * NOT mean "nothing was cut over" -- it can also mean "not checked yet this
 * mount" -- which is exactly why Task 17's route treats `false` as
 * trustworthy only once `discoveryAttempted` is also `true`.
 */
describe('MigrationWizard — close status (spec R2a close-behaviour contract)', () => {
  /**
   * `routedState` defaults to `'postgres'` for every EXISTING call site
   * below. Fix round 1, Important 3 (coordinator review): `anyCutoverCommitted`'s
   * derivation (`hooks.ts`) is `state === 'indexedDB' || state === 'postgres'`
   * -- a family stuck at `indexedDB` (committed locally, not yet cloud-
   * activated) is precisely the post-cutover, pre-activation state R2a
   * protects, and reducing the guard to `postgres` alone left the whole
   * coverage suite green because no fixture anywhere exercised `indexedDB`.
   * `routedState` lets ONE test below pin that arm directly.
   */
  function postgresAdapters(
    routedFamily: DurableFamilyName,
    routedState: 'postgres' | 'indexedDB' = 'postgres'
  ) {
    return ALL_STUB_FAMILIES.map(family =>
      stubAdapter(
        family,
        family === routedFamily
          ? {
              initialAuthority: {
                state: routedState,
                epoch: 1,
                campaignId: 'cloud-ALPHA',
                accountId: 'account-1',
                rolledBack: false,
              },
            }
          : {}
      )
    );
  }

  function wireAdapters(adapters: DurableFamilyAdapter[]) {
    mockedRegisteredAdapters.mockReturnValue(adapters);
    mockedEnabledAdapters.mockImplementation(() =>
      mockedRegisteredAdapters().filter(adapter => adapter.isVisible())
    );
    mockedCreateBrowserDmWorkspace.mockResolvedValue({
      ...defaultOwnerContext(),
      list: vi.fn(async () => [workspaceFor('ALPHA')]),
    });
  }

  it('reports both false when Close is clicked before discovery has ever run, even though a family is already routed', async () => {
    // The adapter data ALREADY shows npc at postgres authority -- exactly
    // the state a real reload would find -- but nothing in this mount has
    // asked yet, so both fields must read as "not known", never as a
    // confident "nothing was cut over".
    wireAdapters(postgresAdapters('npc'));
    const onClose = vi.fn();
    render(<MigrationWizard campaignCode="ALPHA" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith({
      anyCutoverCommitted: false,
      discoveryAttempted: false,
    });
  });

  /**
   * Fix round 1, Important 1, probe A (coordinator review): a REJECTED or
   * signed-out `discover()` never reaches the bulk authority scan at all
   * (`ownerContext` stays null), so a real prior cutover (npc at postgres,
   * standing for THIS "browser"'s persisted state) is never observed this
   * mount. An earlier version set `discoveryAttempted` from `discover()`'s
   * own settling regardless of outcome, which made this reachable state
   * report a TRUSTED `false` -- routing to `/dm`, the hazard verbatim.
   */
  it('does not trust a stale false anyCutoverCommitted when discovery itself fails (signed-out / rejected)', async () => {
    wireAdapters(postgresAdapters('npc'));
    mockedCreateBrowserDmWorkspace.mockRejectedValue(
      new Error('Workspace discovery failed for this probe.')
    );
    const onClose = vi.fn();
    render(<MigrationWizard campaignCode="ALPHA" onClose={onClose} />);
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    // A real, accessible failure signal -- the scan never runs.
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith({
      anyCutoverCommitted: false,
      discoveryAttempted: false,
    });
  });

  /**
   * Fix round 1, Important 1, probe B (coordinator review): `discover()`
   * resolving a workspace does not mean the bulk authority scan it triggers
   * has finished -- `readAuthority` is still an in-flight network/IndexedDB
   * call. Closing in that exact window must not report a confident `false`
   * either. `npc`'s `readAuthority` is held pending deliberately; the test
   * resolves it only after the assertion, so nothing leaks into a later
   * test as an unhandled rejection or dangling timer.
   */
  it('does not trust a stale false anyCutoverCommitted while the bulk authority scan is still in flight', async () => {
    let resolvePending: (value: NormalizedAuthority) => void = () => {};
    const pending = new Promise<NormalizedAuthority>(resolve => {
      resolvePending = resolve;
    });
    const adapters = postgresAdapters('npc').map(adapter =>
      adapter.family === 'npc'
        ? { ...adapter, readAuthority: async () => pending }
        : adapter
    );
    wireAdapters(adapters);
    const onClose = vi.fn();
    render(<MigrationWizard campaignCode="ALPHA" onClose={onClose} />);
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    // Workspace discovery itself has completed (the connected-campaign text
    // renders once `workspace` resolves) -- but the bulk scan's own
    // `readAuthority` call for `npc` is still pending at this point.
    await screen.findByText(/connected to campaign alpha/i);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith({
      anyCutoverCommitted: false,
      discoveryAttempted: false,
    });
    resolvePending({
      state: 'postgres',
      epoch: 1,
      campaignId: 'cloud-ALPHA',
      accountId: 'account-1',
      rolledBack: false,
    });
  });

  it('reports discoveryAttempted true and anyCutoverCommitted false once discovery completes and finds nothing cut over', async () => {
    wireAdapters(stubFamilies());
    const onClose = vi.fn();
    render(<MigrationWizard campaignCode="ALPHA" onClose={onClose} />);
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    await screen.findByText(/connected to campaign alpha/i);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith({
      anyCutoverCommitted: false,
      discoveryAttempted: true,
    });
  });

  it('derives anyCutoverCommitted true from a registered family already at indexedDB/postgres authority, once discovery completes', async () => {
    wireAdapters(postgresAdapters('npc'));
    const onClose = vi.fn();
    render(<MigrationWizard campaignCode="ALPHA" onClose={onClose} />);
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    await screen.findByText(/connected to campaign alpha/i);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith({
      anyCutoverCommitted: true,
      discoveryAttempted: true,
    });
  });

  /**
   * Fix round 1, Important 3 (coordinator review): pins the `indexedDB` arm
   * of `anyCutoverCommitted`'s derivation specifically -- a family committed
   * locally but not yet cloud-activated. Reducing the guard to
   * `state === 'postgres'` alone left 605/605 green in the coverage suite
   * before this test existed, because no fixture anywhere in the slice used
   * `indexedDB`.
   */
  it('derives anyCutoverCommitted true from a family at indexedDB authority specifically, not only postgres', async () => {
    wireAdapters(postgresAdapters('npc', 'indexedDB'));
    const onClose = vi.fn();
    render(<MigrationWizard campaignCode="ALPHA" onClose={onClose} />);
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    await screen.findByText(/connected to campaign alpha/i);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith({
      anyCutoverCommitted: true,
      discoveryAttempted: true,
    });
  });

  /**
   * THE hazard test: a real cutover is on record (the SAME adapter
   * instances carry it across both mounts below, standing in for real
   * persisted state a page reload would still find), discovery ran and
   * observed it on the FIRST mount -- then the component unmounts and
   * remounts fresh (a reload). The second mount's Close, clicked before
   * this mount ever discovers again, must NOT report the confident
   * `anyCutoverCommitted: false` a naive read would produce. This is also
   * the derived-not-stored proof for `anyCutoverCommitted` (R6): if it were
   * cached anywhere outside this component instance's own state, the
   * second mount would report `true`, not `false`, without ever calling
   * discover() itself.
   */
  it('resets discoveryAttempted (and so cannot be trusted) on a fresh mount, even though the underlying cutover persists', async () => {
    const adapters = postgresAdapters('npc');
    wireAdapters(adapters);

    const onCloseFirstMount = vi.fn();
    const firstMount = render(
      <MigrationWizard campaignCode="ALPHA" onClose={onCloseFirstMount} />
    );
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    await screen.findByText(/connected to campaign alpha/i);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCloseFirstMount).toHaveBeenCalledWith({
      anyCutoverCommitted: true,
      discoveryAttempted: true,
    });
    firstMount.unmount();

    // Re-wire the SAME adapter instances (same closures, same observed
    // authority) -- nothing about the underlying "browser" data changed.
    wireAdapters(adapters);
    const onCloseSecondMount = vi.fn();
    render(
      <MigrationWizard campaignCode="ALPHA" onClose={onCloseSecondMount} />
    );
    // Deliberately no "Find my campaigns" click on this mount.
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCloseSecondMount).toHaveBeenCalledWith({
      anyCutoverCommitted: false,
      discoveryAttempted: false,
    });
  });
});
