import 'fake-indexeddb/auto';

import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
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
import type {
  DurableFamilyAdapter,
  DurableFamilyName,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import {
  registeredAdapters,
  enabledAdapters,
} from '@/lib/durableDm/familyRegistry';
import {
  OBJECT_STORE_NAMES,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import { createBrowserDmWorkspace } from '@/lib/supabase/browserDmWorkspace';
import { APP_VERSION } from '@/utils/constants';

import { MigrationWizard } from './index';
import { useMigrationWizard } from './MigrationWizard.hooks';

vi.mock('@/lib/supabase/browserDmWorkspace', () => ({
  createBrowserDmWorkspace: vi.fn(),
}));

vi.mock('@/lib/durableDm/familyRegistry', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/durableDm/familyRegistry')>();
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
    initiateDeviceBackupDownload: vi.fn(actual.initiateDeviceBackupDownload),
    verifyDownloadedDeviceBackup: vi.fn(actual.verifyDownloadedDeviceBackup),
  };
});

const mockedCreateBrowserDmWorkspace = vi.mocked(createBrowserDmWorkspace);
const mockedRegisteredAdapters = vi.mocked(registeredAdapters);
const mockedEnabledAdapters = vi.mocked(enabledAdapters);

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

function assertNoTruncationClasses(element: Element) {
  let node: Element | null = element;
  while (node) {
    expect(node.className).not.toMatch(/truncate|line-clamp-|overflow-hidden/);
    node = node.parentElement;
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

function stubAdapter(
  family: DurableFamilyName,
  options: { onCutover?: () => void } = {}
): DurableFamilyAdapter {
  const manifest = {
    family,
    fingerprint: 'fingerprint',
    recordCount: 0,
    totalBytes: 0,
    blockers: [],
    records: [],
    native: null,
  };
  const cutoverSpy = vi.fn(() => options.onCutover?.());
  cutoverSpies.set(family, cutoverSpy);
  return {
    family,
    label: family,
    isVisible: () => true,
    previewManifest: async () => manifest,
    confirmation: () => ({
      familyLabel: family,
      campaignLabel: 'Campaign',
      manifestFingerprint: manifest.fingerprint,
      requiredPhrase: `move ${family}`,
    }),
    selectFamily: async () => {},
    prepareIndexedDb: async () => ({
      state: 'CUTOVER_READY',
      generation: 'gen-1',
      manifest,
    }),
    commitLocalCutover: async (context: MigrationRunContext) => {
      await context.ensureWorkspaceRemembered();
      cutoverSpy();
      return { epoch: 1 };
    },
    activateCloud: async () => ({ status: 'activated', epoch: 1 }),
    verifyCloud: async () => ({
      authorityAgrees: true,
      cloudAuthority: 'postgres',
      epoch: 1,
      recordCount: 0,
      documentsMatch: true,
      tombstonesMatch: true,
      outboxEmpty: true,
      conflictCount: 0,
      verified: true,
    }),
    readAuthority: async () => ({
      state: 'legacy',
      epoch: 0,
      campaignId: null,
      accountId: null,
      rolledBack: false,
    }),
    rollback: async () => ({ epoch: 2 }),
    repairAuthority: async () => ({
      state: 'legacy',
      epoch: 0,
      campaignId: null,
      accountId: null,
      rolledBack: false,
    }),
  };
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
  mockedEnabledAdapters.mockImplementation(() => mockedRegisteredAdapters());

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
  cutoverSpies.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;
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
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
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
    const spy = vi
      .spyOn(browserRecoveryRepository, 'enrichVerifiedDownloadReceiptEntries')
      .mockRejectedValueOnce(new Error('offline'));
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
    expect(alert).toHaveTextContent('offline');
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
          // Item 8: the real verifier message is surfaced too, not dropped.
          'The selected recovery file does not match the current preview',
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
