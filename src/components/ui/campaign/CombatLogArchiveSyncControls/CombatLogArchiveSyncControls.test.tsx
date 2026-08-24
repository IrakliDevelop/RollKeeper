import 'fake-indexeddb/auto';

import { act } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canonicalJson,
  combatLogArchivePayloadFrom,
  fingerprintCombatLogArchivePayload,
  fingerprintCombatLogArchiveTombstone,
  type CombatLogArchivePayload,
} from '@/lib/durableDm/combatLogArchiveFamily';
import { writeCombatLogArchiveAuthorityMarker } from '@/lib/durableDm/combatLogArchiveLegacyAuthority';
import {
  commitCombatLogArchiveLocalCutover,
  markCombatLogArchiveCloudAuthority,
} from '@/lib/indexeddb/combatLogArchiveAuthority';
import {
  IndexedDbCombatLogArchiveRepository,
  type CombatLogArchiveDocument,
} from '@/lib/indexeddb/combatLogArchiveRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import * as localDatabase from '@/lib/indexeddb/localDatabase';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import * as supabaseBrowser from '@/lib/supabase/browser';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import { useCombatLogStore } from '@/store/combatLogStore';
import { useDmStore } from '@/store/dmStore';
import { useEncounterStore } from '@/store/encounterStore';
import type { CombatLogState, TurnEvent } from '@/types/combatLog';

import {
  CombatLogArchiveSyncControls,
  CombatLogArchiveSyncProvider,
  planCombatLogArchiveMutations,
  runCombatLogArchiveMutationPlan,
} from './index';

const NOW = '2026-08-25T00:00:00.000Z';
const ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';
const CAMPAIGN_ID = '44444444-4444-4444-8444-444444444444';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const GENERATION = 'combat-log-archive-generation';

const campaign = { code: 'SYNTH1', name: 'Combat logs', createdAt: NOW };

const gates = {
  recoveryReceipt: true,
  sourceManifestUnchanged: true,
  captureVerifiedAfterReopen: true,
  manifestConfirmed: true,
  noConflicts: true,
  noQuarantine: true,
  parity: true,
  journalEmpty: true,
};

const workspace = {
  namespace: NAMESPACE,
  localId: 'legacy:SYNTH1',
  legacyId: 'SYNTH1',
  name: 'Combat logs',
  creationKind: 'import_fork' as const,
  sourceFingerprint: 'source',
  createdAt: 'created',
  family: 'workspace_identity' as const,
  cloudId: CAMPAIGN_ID,
  displayCode: 'B2C3D4E5F6A1',
  membershipAuthority: 'legacy' as const,
  familyAuthorities: 'legacy' as const,
  liveRuntimeAuthority: 'redis_relay' as const,
  acknowledgedAt: 'acknowledged',
};

let authListener:
  | ((event: string, session: { user: { id: string } } | null) => void)
  | undefined;

/** The card only reads the route-level owner, so every case mounts both. */
function renderControls(providerCode = campaign.code) {
  return render(
    <CombatLogArchiveSyncProvider campaignCode={providerCode}>
      <CombatLogArchiveSyncControls campaign={campaign} />
    </CombatLogArchiveSyncProvider>
  );
}

function ownerContext() {
  return {
    accountId: ACCOUNT_ID,
    accountLabel: 'fake@example.test',
    list: vi.fn().mockResolvedValue([workspace]),
    discover: vi.fn().mockResolvedValue([workspace]),
    remember: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    forkLegacy: vi.fn(),
    close: vi.fn(),
  };
}

function mockOwnerWorkspace() {
  return vi
    .spyOn(browserDmWorkspace, 'createBrowserDmWorkspace')
    .mockResolvedValue(ownerContext());
}

/**
 * Faithful stand-in for the repository-backed context: `discover` returns the
 * cloud-side workspaces, but `list` returns only what was explicitly
 * `remember`ed — which is what a reload's hydrate() reads.
 */
function mockOwnerWorkspaceWithMemory() {
  const remembered: DmWorkspaceDocument[] = [];
  vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockImplementation(
    async () => ({
      accountId: ACCOUNT_ID,
      accountLabel: 'fake@example.test',
      list: vi.fn().mockImplementation(async () => [...remembered]),
      discover: vi.fn().mockResolvedValue([workspace]),
      remember: vi
        .fn()
        .mockImplementation(async (item: DmWorkspaceDocument) => {
          if (!remembered.some(known => known.cloudId === item.cloudId))
            remembered.push(item);
        }),
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close: vi.fn(),
    })
  );
  return remembered;
}

function mockOwnerSession() {
  authListener = undefined;
  vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: ACCOUNT_ID } } },
      }),
      onAuthStateChange: vi.fn().mockImplementation(callback => {
        authListener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  } as never);
}

function archivePayload(
  overrides: Partial<CombatLogArchivePayload> = {}
): CombatLogArchivePayload {
  return {
    encounterId: 'enc-a',
    events: [],
    startedAt: NOW,
    endedAt: NOW,
    ...overrides,
  };
}

/** Ruling 3: only an archive with `endedAt` clears the cutover blocker. */
function endedArchive(overrides: Partial<CombatLogState> = {}): CombatLogState {
  return { ...archivePayload(), campaignCode: campaign.code, ...overrides };
}

function turnEvent(entityName: string): Omit<TurnEvent, 'id' | 'timestamp'> {
  return {
    type: 'turn_start',
    round: 1,
    turn: 0,
    encounterId: 'enc-a',
    entityId: 'ent-1',
    entityName,
  };
}

/**
 * Seeds the store, which persists the legacy envelope the manifest reads. The
 * envelope and the store must agree, so both come from one write.
 */
function seedArchives(archives: Record<string, CombatLogState>) {
  useCombatLogStore.setState({
    encounters: archives,
    combatLogTombstones: {},
    activeArchiveId: null,
    lastAdmissionError: null,
  });
}

async function seedIndexedDbGeneration(payload: CombatLogArchivePayload) {
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:combat_log_archive:${CAMPAIGN_ID}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-combat-log',
    presence: true,
    rawValue: '{"state":{"encounters":{}},"version":2}',
  });
  await transactionComplete(transaction);
  const contentFingerprint = await fingerprintCombatLogArchivePayload(payload);
  await commitCombatLogArchiveLocalCutover(database, {
    namespace: NAMESPACE,
    campaignId: CAMPAIGN_ID,
    generation: GENERATION,
    confirmed: true,
    gates,
    now: () => NOW,
    initialDocuments: [
      {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN_ID,
        legacyId: 'arc-1',
        family: 'combat_log_archive',
        cutoverEpoch: 1,
        operation: 'create',
        payload,
        schemaVersion: 2,
        localRevision: 1,
        baseServerVersion: 0,
        contentFingerprint,
        updatedAt: NOW,
        deletedAt: null,
      },
    ],
  });
  database.close();
  writeCombatLogArchiveAuthorityMarker(localStorage, {
    version: 1,
    campaignCode: campaign.code,
    authority: 'indexedDB',
    epoch: 1,
    accountId: ACCOUNT_ID,
    campaignId: CAMPAIGN_ID,
  });
  return contentFingerprint;
}

/** Leaves the payload intact and breaks only its recorded fingerprint. */
async function damageStoredDocument(legacyId: string) {
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction('documents', 'readwrite');
  const store = transaction.objectStore('documents');
  const document = (await requestResult(
    store.get([NAMESPACE, 'combat_log_archive', legacyId])
  )) as CombatLogArchiveDocument;
  store.put({ ...document, contentFingerprint: 'f'.repeat(64) });
  await transactionComplete(transaction);
  database.close();
}

/**
 * Stands in for another tab replacing this device's local generation: only the
 * cutover epoch moves, which is what makes the next pass a re-hydration rather
 * than a signature-matched no-op.
 */
async function bumpLocalEpoch(epoch: number) {
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction('meta', 'readwrite');
  const meta = transaction.objectStore('meta');
  const scope = `${NAMESPACE}:combat_log_archive:${CAMPAIGN_ID}`;
  const pointer = (await requestResult(
    meta.get(`active-generation:${scope}`)
  )) as Record<string, unknown>;
  meta.put({ ...pointer, epoch });
  meta.put({ key: `cutover-epoch:${scope}`, value: epoch });
  await transactionComplete(transaction);
  database.close();
}

async function selectWorkspaceAndPreview() {
  fireEvent.click(screen.getByRole('button', { name: 'Find my campaigns' }));
  fireEvent.click(
    await screen.findByRole('button', { name: /Use Combat logs/ })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'See what will be backed up' })
  );
}

async function downloadAndOpenSafetyCopy(createObjectURL: {
  mock: { calls: unknown[][] };
}) {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Download a safety copy' })
  );
  await screen.findByText(/Open that file here to continue/);
  const downloaded = createObjectURL.mock.calls[0]![0] as Blob;
  fireEvent.change(screen.getByLabelText('Safety copy you downloaded'), {
    target: {
      files: [
        new File([await downloaded.text()], 'combat-log-backup.json', {
          type: 'application/json',
        }),
      ],
    },
  });
  await screen.findByText(
    'Safety copy checked. Your combat logs are still stored the usual way for now.'
  );
}

/**
 * Deliberately distinct from the cutover epoch, the schema version (2) and the
 * local revision, exactly as Task 8's enrollment fixture pins them: a document
 * written with any of those instead of the preview's own server version would
 * make the "already has this version" comparison accidentally true or
 * accidentally false, and this suite's Critical would stop meaning anything.
 */
const CLOUD_EPOCH = 3;
const CLOUD_SERVER_VERSION = 12;

let commitSpy: ReturnType<typeof vi.spyOn>;
let fetchSpy: ReturnType<typeof vi.spyOn>;
let requests: Record<string, unknown>[] = [];

const respond = (value: unknown) =>
  ({ ok: true, json: async () => value }) as Response;

function cloudVersion(serverVersion: number, payloadFingerprint: string) {
  return {
    serverVersion,
    cutoverEpoch: CLOUD_EPOCH,
    schemaVersion: 2,
    payloadFingerprint,
    tombstoned: false,
    acceptedAt: NOW,
  };
}

/**
 * Adds this device to a cloud generation the account already holds.
 *
 * `enrollCombatLogArchiveCloudDevice` writes each document with exactly the
 * preview's `serverVersion` and `payloadFingerprint`, so the "already has this
 * version" check inside `applyExactCloudVersion` is unconditionally true the
 * moment this helper returns. That is the PR #267 precondition, and it is what
 * makes the Critical test below a real guard rather than a vacuous one.
 *
 * The store is left showing the un-uploaded local candidate and `hydrated` is
 * left false, which is the whole point of the enrolled-but-unapplied state.
 */
async function enrollAgainstCloudGeneration(
  handle: (body: Record<string, unknown>) => unknown = () => undefined
) {
  vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
  mockOwnerWorkspace();
  // The local candidate this device must never push on its own.
  seedArchives({ 'arc-1': endedArchive({ encounterId: 'enc-local' }) });
  const cloudPayload = archivePayload({ encounterId: 'enc-cloud' });
  const cloudFingerprint =
    await fingerprintCombatLogArchivePayload(cloudPayload);
  fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_input, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(body);
      const handled = handle(body);
      if (handled !== undefined) return respond(handled);
      if (body.action === 'preview-enrollment')
        return respond({
          authority: 'postgres',
          epoch: CLOUD_EPOCH,
          previewFingerprint: 'a'.repeat(64),
          recordCount: 1,
          documents: [
            {
              legacyId: 'arc-1',
              serverVersion: CLOUD_SERVER_VERSION,
              schemaVersion: 2,
              payloadFingerprint: cloudFingerprint,
              tombstoned: false,
              payload: cloudPayload,
            },
          ],
        });
      if (body.action === 'enroll-device') return respond({});
      if (body.action === 'put')
        return respond({
          serverVersion: Number(body.expectedServerVersion) + 1,
          cutoverEpoch: Number(body.expectedEpoch),
          payloadFingerprint: body.payloadFingerprint,
          cloudSaved: true,
          playerView: 'not-applicable',
        });
      throw new Error(`unexpected action ${String(body.action)}`);
    });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  commitSpy = vi.spyOn(IndexedDbCombatLogArchiveRepository.prototype, 'commit');

  renderControls();
  fireEvent.click(screen.getByRole('button', { name: 'Find my campaigns' }));
  fireEvent.click(
    await screen.findByRole('button', { name: /Use Combat logs/ })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Check this device' })
  );
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Add this device to your account',
    })
  );
  await screen.findByText(
    'This device was added to your account. Choose "Use the copy from your account" when you are ready.'
  );
  return { cloudFingerprint, cloudPayload };
}

/** A device that already backs this campaign up to the account. */
async function seedCloudAuthority(payload: CombatLogArchivePayload) {
  const contentFingerprint = await seedIndexedDbGeneration(payload);
  const database = await openRollkeeperDatabase();
  await markCombatLogArchiveCloudAuthority(database, {
    namespace: NAMESPACE,
    campaignId: CAMPAIGN_ID,
    expectedLocalEpoch: 1,
    cloudEpoch: CLOUD_EPOCH,
    now: () => NOW,
    acceptedVersions: [
      {
        legacyId: 'arc-1',
        serverVersion: CLOUD_SERVER_VERSION,
        payloadFingerprint: contentFingerprint,
      },
    ],
  });
  database.close();
  writeCombatLogArchiveAuthorityMarker(localStorage, {
    version: 1,
    campaignCode: campaign.code,
    authority: 'postgres',
    epoch: CLOUD_EPOCH,
    accountId: ACCOUNT_ID,
    campaignId: CAMPAIGN_ID,
  });
  return contentFingerprint;
}

describe('CombatLogArchiveSyncControls durability guards', () => {
  beforeEach(() => {
    useDmStore.setState({ campaigns: [campaign] });
    requests = [];
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // The persisted store rewrites its envelope on every setState, so the
    // reset has to happen before the storage is cleared.
    useCombatLogStore.setState({
      encounters: {},
      combatLogTombstones: {},
      activeArchiveId: null,
      lastAdmissionError: null,
    });
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('hydrates after a reload when the workspace was only discovered, never enrolled', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    const remembered = mockOwnerWorkspaceWithMemory();
    mockOwnerSession();
    seedArchives({ 'arc-1': endedArchive() });
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:combat-log-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderControls();
    await selectWorkspaceAndPreview();
    await downloadAndOpenSafetyCopy(createObjectURL);
    fireEvent.click(
      screen.getByRole('button', { name: 'Get this device ready' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /turn on for this device/i })
    );
    await screen.findByText(
      'Saved on this device. Not backed up to your account yet.'
    );
    await waitFor(() => expect(remembered).toHaveLength(1));

    // Simulate the reload: the mount is fresh, localStorage keeps the frozen
    // legacy copy plus the authority marker, and IndexedDB keeps the cutover
    // generation. Cloud activation never happened.
    cleanup();
    seedArchives({ 'arc-1': endedArchive() });
    renderControls();

    await waitFor(() =>
      expect(screen.getByText(/loaded from this device/i)).toBeInTheDocument()
    );
    expect(
      screen.queryByText(
        "This device isn't set up for that account yet. Choose your campaign again."
      )
    ).toBeNull();

    // …and an edit made after the reload commits instead of dying in the
    // frozen legacy key.
    const commit = vi.spyOn(
      IndexedDbCombatLogArchiveRepository.prototype,
      'commit'
    );
    fireEvent.click(
      screen.getByRole('button', { name: /delete this combat log/i })
    );
    await waitFor(() =>
      expect(commit).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'delete', legacyId: 'arc-1' })
      )
    );
  });

  it('treats a repeated auth event for the same generation as a no-op', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    await seedIndexedDbGeneration(archivePayload());
    const factory = mockOwnerWorkspace();
    mockOwnerSession();

    render(
      <CombatLogArchiveSyncProvider campaignCode={campaign.code}>
        {null}
      </CombatLogArchiveSyncProvider>
    );
    await waitFor(() => expect(factory).toHaveBeenCalledTimes(1));
    expect(authListener).toBeDefined();

    // auth-js emits this hourly, and whenever a hidden tab's token expired.
    await act(async () => {
      authListener!('TOKEN_REFRESHED', { user: { id: ACCOUNT_ID } });
      await new Promise(resolve => setTimeout(resolve, 25));
    });

    // The generation guard returns before this call, so without it the count
    // is 2 regardless of interleaving.
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('never commits from an indexedDB-authoritative mount whose hydration did not complete', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    await seedIndexedDbGeneration(archivePayload());
    await damageStoredDocument('arc-1');
    // The frozen legacy copy the store still shows while hydration is refused.
    seedArchives({ 'arc-1': endedArchive() });
    mockOwnerWorkspace();
    mockOwnerSession();

    renderControls();

    // Hydration reached this device's IndexedDB authority and then stopped, so
    // `authority` and `scope` are known while the store is still un-hydrated.
    await screen.findByText(
      'The combat logs saved on this device look damaged. Use Earlier versions to restore one.'
    );

    const commit = vi.spyOn(
      IndexedDbCombatLogArchiveRepository.prototype,
      'commit'
    );
    await act(async () => {
      useCombatLogStore.getState().logEvent('arc-1', turnEvent('Goblin'));
      await new Promise(resolve => setTimeout(resolve, 25));
    });
    await act(async () => {
      useCombatLogStore.getState().logEvent('arc-1', turnEvent('Bugbear'));
      await new Promise(resolve => setTimeout(resolve, 25));
    });

    expect(commit).not.toHaveBeenCalled();
  });

  it('disarms autosave when a re-hydration onto a newer local generation stops', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    await seedIndexedDbGeneration(archivePayload());
    mockOwnerWorkspace();
    mockOwnerSession();

    renderControls();
    await screen.findByText('Your combat logs are loaded from this device.');
    expect(authListener).toBeDefined();

    // Another tab moved this device onto a newer local generation, and what it
    // left behind does not survive the integrity check.
    await damageStoredDocument('arc-1');
    await bumpLocalEpoch(2);

    const commit = vi.spyOn(
      IndexedDbCombatLogArchiveRepository.prototype,
      'commit'
    );
    await act(async () => {
      authListener!('TOKEN_REFRESHED', { user: { id: ACCOUNT_ID } });
      await new Promise(resolve => setTimeout(resolve, 25));
    });
    await screen.findByText(
      'The combat logs saved on this device look damaged. Use Earlier versions to restore one.'
    );

    // A re-hydration publishes the new authority before it replaces the store,
    // so autosave has to be disarmed for its whole duration: this pass was
    // armed by the *previous* hydration and its baseline still describes the
    // superseded generation.
    await act(async () => {
      useCombatLogStore.getState().logEvent('arc-1', turnEvent('Owlbear'));
      await new Promise(resolve => setTimeout(resolve, 25));
    });

    expect(commit).not.toHaveBeenCalled();
  });

  it('commits a new archive as a create and an edited one as a replace', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    await seedIndexedDbGeneration(archivePayload());
    mockOwnerWorkspace();
    mockOwnerSession();

    render(
      <CombatLogArchiveSyncProvider campaignCode={campaign.code}>
        {null}
      </CombatLogArchiveSyncProvider>
    );
    await waitFor(() =>
      expect(Object.keys(useCombatLogStore.getState().encounters)).toHaveLength(
        1
      )
    );

    const commit = vi.spyOn(
      IndexedDbCombatLogArchiveRepository.prototype,
      'commit'
    );
    act(() => {
      useCombatLogStore.getState().logEvent('arc-1', turnEvent('Goblin'));
    });

    // The hydrated document is live at localRevision 1, so an ordinary edit is
    // a replace that keeps its acknowledged base version.
    await waitFor(() =>
      expect(commit).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: NAMESPACE,
          campaignId: CAMPAIGN_ID,
          legacyId: 'arc-1',
          operation: 'replace',
          cutoverEpoch: 1,
          schemaVersion: 2,
          localRevision: 2,
          baseServerVersion: 0,
        })
      )
    );

    let created: string | null = null;
    act(() => {
      created = useCombatLogStore
        .getState()
        .startArchive('enc-b', campaign.code);
    });
    expect(created).not.toBeNull();

    // An archive this device has never committed has no document to replace.
    await waitFor(() =>
      expect(commit).toHaveBeenCalledWith(
        expect.objectContaining({
          legacyId: created!,
          operation: 'create',
          localRevision: 1,
          baseServerVersion: 0,
        })
      )
    );

    await waitFor(async () => {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbCombatLogArchiveRepository(database);
        const edited = await repository.getDocument(NAMESPACE, 'arc-1');
        expect(edited?.payload?.events).toHaveLength(1);
        expect(edited?.operation).toBe('replace');
        const fresh = await repository.getDocument(NAMESPACE, created!);
        expect(fresh?.payload?.encounterId).toBe('enc-b');
        const outbox = await repository.listOutbox(NAMESPACE, CAMPAIGN_ID);
        expect(outbox.filter(entry => entry.state === 'paused')).toHaveLength(
          2
        );
      } finally {
        database.close();
      }
    });
  });

  it('does not re-fingerprint this campaign when another campaign is edited', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    await seedIndexedDbGeneration(archivePayload());
    mockOwnerWorkspace();
    mockOwnerSession();

    render(
      <CombatLogArchiveSyncProvider campaignCode={campaign.code}>
        {null}
      </CombatLogArchiveSyncProvider>
    );

    await waitFor(() =>
      expect(Object.keys(useCombatLogStore.getState().encounters)).toHaveLength(
        1
      )
    );
    // Warm the fingerprint cache deterministically: an edit in this campaign
    // runs a full autosave pass, and its commit is the signal that every live
    // archive has been fingerprinted and cached.
    const commit = vi.spyOn(
      IndexedDbCombatLogArchiveRepository.prototype,
      'commit'
    );
    act(() => {
      useCombatLogStore.getState().logEvent('arc-1', turnEvent('Goblin'));
    });
    await waitFor(() => expect(commit).toHaveBeenCalled());

    const digest = vi.spyOn(crypto.subtle, 'digest');
    await act(async () => {
      useCombatLogStore.getState().startArchive('enc-other', 'OTHER1');
      await new Promise(resolve => setTimeout(resolve, 25));
    });

    // An unrelated campaign's edit changes the record identity of the whole
    // archive map; this campaign's untouched records must not be
    // canonicalized and hashed again.
    expect(digest).not.toHaveBeenCalled();

    // Positive control: a real edit in this campaign does hash.
    act(() => {
      useCombatLogStore.getState().startArchive('enc-a', campaign.code);
    });
    await waitFor(() => expect(digest).toHaveBeenCalled());
  });

  // The PR #267 Critical. Enrollment writes every document at exactly the
  // preview's server version and fingerprint, so an "already has this version"
  // short-circuit that returns from the function instead of continuing the loop
  // is unconditionally taken here — skipping the store rewrite and, fatally,
  // `setHydrated(true)`. The DM would see a success status while the legacy key
  // stays frozen and every later edit is written nowhere.
  it('arms autosave when applying the exact cloud version right after enrollment', async () => {
    await enrollAgainstCloudGeneration(); // leaves hydrated === false by design

    await userEvent.click(
      screen.getByRole('button', { name: /use the copy from your account/i })
    );

    await waitFor(() =>
      expect(
        screen.getByText(/loaded .* from your account/i)
      ).toBeInTheDocument()
    );

    // The real assertion: an edit made now must reach IndexedDB.
    act(() => {
      useCombatLogStore.getState().clearArchive('arc-1');
    });

    await waitFor(() =>
      expect(commitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'delete', legacyId: 'arc-1' })
      )
    );
  });

  it('counts only live combat logs after applying the account copy', async () => {
    const cloudPayload = archivePayload({ encounterId: 'enc-cloud' });
    const cloudFingerprint =
      await fingerprintCombatLogArchivePayload(cloudPayload);
    const tombstoneFingerprint =
      await fingerprintCombatLogArchiveTombstone('arc-deleted');
    await enrollAgainstCloudGeneration(body => {
      if (body.action !== 'preview-enrollment') return undefined;
      return {
        authority: 'postgres',
        epoch: CLOUD_EPOCH,
        previewFingerprint: 'a'.repeat(64),
        recordCount: 2,
        documents: [
          {
            legacyId: 'arc-1',
            serverVersion: CLOUD_SERVER_VERSION,
            schemaVersion: 2,
            payloadFingerprint: cloudFingerprint,
            tombstoned: false,
            payload: cloudPayload,
          },
          {
            legacyId: 'arc-deleted',
            serverVersion: CLOUD_SERVER_VERSION,
            schemaVersion: 2,
            payloadFingerprint: tombstoneFingerprint,
            tombstoned: true,
            payload: null,
          },
        ],
      };
    });

    await userEvent.click(
      screen.getByRole('button', { name: /use the copy from your account/i })
    );

    expect(
      await screen.findByText('Loaded 1 combat log from your account.')
    ).toBeVisible();
  });

  it('arms autosave after a version restore on an enrolled device', async () => {
    const restoredPayload = archivePayload({ encounterId: 'enc-restored' });
    const restoredFingerprint =
      await fingerprintCombatLogArchivePayload(restoredPayload);
    await enrollAgainstCloudGeneration(body => {
      if (body.action === 'history')
        return {
          versions: [
            cloudVersion(2, restoredFingerprint),
            cloudVersion(1, restoredFingerprint),
          ],
        };
      if (body.action === 'restore-version')
        return {
          serverVersion: 3,
          cutoverEpoch: CLOUD_EPOCH,
          payloadFingerprint: restoredFingerprint,
        };
      if (body.action === 'export-version')
        return {
          serverVersion: 3,
          schemaVersion: 2,
          payloadFingerprint: restoredFingerprint,
          tombstoned: false,
          payload: restoredPayload,
        };
      return undefined;
    });

    // Enrolled but not yet applied: autosave is deliberately disarmed here.
    fireEvent.click(screen.getByRole('button', { name: 'Earlier versions' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restore this version' })
    );
    await screen.findByText('Restored. Saved to your account as version 3.');

    // The restore rewrote the store from IndexedDB, so it is a hydrating path:
    // the next edit must still reach IndexedDB and the account.
    act(() => {
      useCombatLogStore.getState().logEvent('arc-1', turnEvent('Goblin'));
    });

    await waitFor(() => expect(commitSpy).toHaveBeenCalled());
    await waitFor(() =>
      expect(requests.map(request => request.action)).toContain('put')
    );
  });

  // Not a guard on its own: with no edit, `lastFingerprints` is still null, so
  // the first autosave pass after enrollment only seeds the baseline and would
  // commit nothing even with the disarm removed. It pins the quiet enrolled
  // state; the falsifiable companion directly below it — 'never uploads the
  // local candidate when the DM edits after enrollment' — is what actually
  // exercises the disarmed gate.
  it('never uploads the local candidate after device enrollment', async () => {
    await enrollAgainstCloudGeneration();

    await new Promise(resolve => setTimeout(resolve, 25));

    expect(commitSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalledWith(
      '/api/combat-log-sync',
      expect.objectContaining({
        body: expect.stringContaining('"action":"put"'),
      })
    );
  });

  // The companion the test above needs to be a real guard: with no baseline yet
  // recorded, the first autosave pass after enrollment only seeds
  // `lastFingerprints` and commits nothing, so an edit is what actually forces
  // the disarmed gate to be exercised.
  it('never uploads the local candidate when the DM edits after enrollment', async () => {
    await enrollAgainstCloudGeneration();

    for (const entityName of ['Goblin', 'Bugbear']) {
      await act(async () => {
        useCombatLogStore.getState().logEvent('arc-1', turnEvent(entityName));
        await new Promise(resolve => setTimeout(resolve, 25));
      });
    }

    expect(commitSpy).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');
  });

  // The delete control is deliberately ungated in the card (the refused-edit
  // banner tells the DM to delete a combat log), so the refusal has to live in
  // the controller. On an enrolled-but-unapplied device the aware storage
  // freezes the routed legacy copy and autosave is disarmed, so a deletion
  // reaches neither localStorage nor IndexedDB nor the account: it would be
  // back on the next reload. Reporting success for that is the lie this guards.
  it('refuses a delete on an enrolled device that has not applied the account copy', async () => {
    await enrollAgainstCloudGeneration(); // leaves hydrated === false by design

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete this combat log' })
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          "This device hasn't finished loading your combat logs, so nothing was deleted. Finish setting this device up, then try again."
        )
      ).toBeVisible()
    );
    // Negative assertions: a bounded window, never a waitFor.
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(screen.queryByText('Combat log deleted.')).not.toBeInTheDocument();
    expect(commitSpy).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');
    expect(useCombatLogStore.getState().encounters['arc-1']).toBeDefined();
    expect(
      useCombatLogStore.getState().combatLogTombstones['arc-1']
    ).toBeUndefined();
  });

  it('refuses a delete when a routed marker exists before authority resolves', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    seedArchives({ 'arc-1': endedArchive() });
    writeCombatLogArchiveAuthorityMarker(localStorage, {
      version: 1,
      campaignCode: campaign.code,
      authority: 'postgres',
      epoch: CLOUD_EPOCH,
      accountId: ACCOUNT_ID,
      campaignId: CAMPAIGN_ID,
    });
    vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue(
      null
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderControls();
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete this combat log' })
    );

    expect(
      await screen.findByText(
        "This device hasn't finished loading your combat logs, so nothing was deleted. Finish setting this device up, then try again."
      )
    ).toBeVisible();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(useCombatLogStore.getState().encounters['arc-1']).toBeDefined();
    expect(
      useCombatLogStore.getState().combatLogTombstones['arc-1']
    ).toBeUndefined();
  });

  // `busy` is released in a `finally`, so an `openRollkeeperDatabase()` that
  // rejects outside the `try` escapes the click handler unhandled and leaves
  // every `loading={sync.busy}` control spinning until the DM reloads.
  it('reports a failed database open when applying the account copy', async () => {
    await enrollAgainstCloudGeneration();
    vi.spyOn(localDatabase, 'openRollkeeperDatabase').mockRejectedValueOnce(
      new Error('database unavailable')
    );

    await userEvent.click(
      screen.getByRole('button', { name: /use the copy from your account/i })
    );

    await waitFor(() =>
      expect(screen.getByText('database unavailable')).toBeVisible()
    );
    expect(
      screen.getByRole('button', { name: /use the copy from your account/i })
    ).not.toBeDisabled();
  });

  it('reports a failed database open on the local cutover', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    mockOwnerSession();
    seedArchives({ 'arc-1': endedArchive() });
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:combat-log-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderControls();
    await selectWorkspaceAndPreview();
    await downloadAndOpenSafetyCopy(createObjectURL);
    fireEvent.click(
      screen.getByRole('button', { name: 'Get this device ready' })
    );
    await screen.findByRole('button', { name: /turn on for this device/i });
    vi.spyOn(localDatabase, 'openRollkeeperDatabase').mockRejectedValueOnce(
      new Error('database unavailable')
    );

    fireEvent.click(
      screen.getByRole('button', { name: /turn on for this device/i })
    );

    await waitFor(() =>
      expect(screen.getByText('database unavailable')).toBeVisible()
    );
  });

  it('wires version history, exact export, comparison, and verified rollback under cloud authority', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    const payload = archivePayload();
    const contentFingerprint = await seedCloudAuthority(payload);
    mockOwnerWorkspace();
    mockOwnerSession();
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        if (body.action === 'history')
          return respond({
            versions: [
              cloudVersion(CLOUD_SERVER_VERSION, contentFingerprint),
              cloudVersion(CLOUD_SERVER_VERSION - 1, contentFingerprint),
            ],
          });
        if (body.action === 'export-version')
          return respond({
            serverVersion: CLOUD_SERVER_VERSION,
            schemaVersion: 2,
            payloadFingerprint: contentFingerprint,
            tombstoned: false,
            payload,
          });
        if (body.action === 'compare-versions')
          return respond({ identical: true });
        if (body.action === 'preview-enrollment')
          return respond({
            authority: 'postgres',
            epoch: CLOUD_EPOCH,
            previewFingerprint: 'a'.repeat(64),
            recordCount: 1,
            documents: [
              {
                legacyId: 'arc-1',
                serverVersion: CLOUD_SERVER_VERSION,
                schemaVersion: 2,
                payloadFingerprint: contentFingerprint,
                tombstoned: false,
                payload,
              },
            ],
          });
        if (body.action === 'rollback')
          return respond({
            epoch: CLOUD_EPOCH + 1,
            currentGeneration: {
              recordCount: 1,
              documents: [
                {
                  legacyId: 'arc-1',
                  serverVersion: CLOUD_SERVER_VERSION,
                  schemaVersion: 2,
                  payloadFingerprint: contentFingerprint,
                  tombstoned: false,
                  payload,
                },
              ],
            },
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      });

    renderControls();

    expect(
      await screen.findByRole('button', { name: 'Earlier versions' })
    ).toBeVisible();
    expect(
      screen.getByText('Players never see these. Running combat is unaffected.')
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Earlier versions' }));
    expect(
      await screen.findByText(`Version ${CLOUD_SERVER_VERSION} ·`, {
        exact: false,
      })
    ).toBeVisible();

    const downloads: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:combat-log-version');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloads.push(this.download);
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Download this version' })[0]
    );
    await waitFor(() =>
      expect(downloads).toContain(
        `combat-log-arc-1-v${CLOUD_SERVER_VERSION}.json`
      )
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Compare the two most recent' })
    );
    await screen.findByText('These two versions are exactly the same.');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop backing up' }));
    await screen.findByText(
      'Backup is off and everything was kept. Reload the page to keep working on this device.'
    );
    expect(requests.map(request => request.action)).toContain('rollback');
  });

  // Version rows and the comparison line belong to exactly one archive.
  // "Restore this version" sends the picker's current legacy id with a
  // `sourceVersion` and `expectedServerVersion` read off whatever rows are on
  // screen, so a stale row can restore version N of a *different* archive
  // whenever the two happen to share version numbers.
  it('drops the previous archive versions when the history picker moves', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    const payload = archivePayload();
    const contentFingerprint = await seedCloudAuthority(payload);
    mockOwnerWorkspace();
    mockOwnerSession();
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        if (body.action === 'history')
          return respond({
            versions: [
              cloudVersion(CLOUD_SERVER_VERSION, contentFingerprint),
              cloudVersion(CLOUD_SERVER_VERSION - 1, contentFingerprint),
            ],
          });
        if (body.action === 'compare-versions')
          return respond({ identical: true });
        if (body.action === 'put')
          return respond({
            serverVersion: Number(body.expectedServerVersion) + 1,
            cutoverEpoch: Number(body.expectedEpoch),
            payloadFingerprint: body.payloadFingerprint,
            cloudSaved: true,
            playerView: 'not-applicable',
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      });

    renderControls();
    await screen.findByRole('button', { name: 'Earlier versions' });

    // A second archive, so the picker has somewhere else to point. It is still
    // running, which is what tells the two options apart below.
    await act(async () => {
      useCombatLogStore.getState().startArchive('enc-b', campaign.code);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Earlier versions' }));
    await screen.findByText(`Version ${CLOUD_SERVER_VERSION} ·`, {
      exact: false,
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Compare the two most recent' })
    );
    await screen.findByText('These two versions are exactly the same.');

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(
      await screen.findByRole('option', { name: /still running/ })
    );

    // The picker moved synchronously, so the rows are gone by this render:
    // a bounded negative assertion, never a waitFor.
    expect(
      screen.queryByText(`Version ${CLOUD_SERVER_VERSION} ·`, { exact: false })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('These two versions are exactly the same.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Restore this version' })
    ).not.toBeInTheDocument();
  });

  it('disarms autosave when this account is removed from the device', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    await seedCloudAuthority(archivePayload());
    mockOwnerWorkspace();
    mockOwnerSession();
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        if (body.action === 'remove-device') return respond({});
        throw new Error(`unexpected action ${String(body.action)}`);
      });
    localStorage.setItem(
      `rollkeeper:combat-log-archive-device:${ACCOUNT_ID}:${CAMPAIGN_ID}`,
      'device-a'
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderControls();
    await screen.findByText('Your combat logs are loaded from this device.');

    fireEvent.click(
      screen.getByRole('button', {
        name: "Remove this account's data from this device",
      })
    );
    await screen.findByText(
      'Removed from this device. Your account keeps everything.'
    );

    // The campaign's archives were hidden, so a commit now would delete every
    // document this account holds.
    commitSpy = vi.spyOn(
      IndexedDbCombatLogArchiveRepository.prototype,
      'commit'
    );
    // Two edits, because the first pass after a cleared baseline only reseeds
    // `lastFingerprints`: it is the second that would commit if the family were
    // still armed.
    for (const encounterId of ['enc-late-a', 'enc-late-b']) {
      await act(async () => {
        useCombatLogStore.getState().startArchive(encounterId, campaign.code);
        await new Promise(resolve => setTimeout(resolve, 25));
      });
    }

    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('turns on backup to the account from a device that is already local-only', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    const payload = archivePayload();
    await seedIndexedDbGeneration(payload);
    mockOwnerWorkspace();
    mockOwnerSession();
    seedArchives({ 'arc-1': endedArchive() });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:combat-log-recovery'
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        if (body.action === 'begin-staging') return respond({ runId: 'run-1' });
        if (body.action === 'stage-items') return respond({});
        if (body.action === 'confirm-cutover')
          return respond({ epoch: CLOUD_EPOCH });
        throw new Error(`unexpected action ${String(body.action)}`);
      });

    renderControls();
    // Hydration already restored the workspace, so the picker is behind us.
    await screen.findByText('Your combat logs are loaded from this device.');
    fireEvent.click(
      await screen.findByRole('button', { name: 'See what will be backed up' })
    );
    await screen.findByText(/Here is what would be backed up/);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Turn on backup to your account',
      })
    );

    await screen.findByText(
      'Saved on this device and backed up to your account.'
    );
    expect(requests.map(request => request.action)).toEqual([
      'begin-staging',
      'stage-items',
      'confirm-cutover',
    ]);
    // The staged generation is exactly what the working copy holds.
    expect(
      (requests[1].items as { payloadFingerprint: string }[])[0]
        .payloadFingerprint
    ).toBe(await fingerprintCombatLogArchivePayload(payload));
  });
});

describe('combat log archive autosave planning', () => {
  it('classifies changed, added, and removed archives', () => {
    const last = new Map([
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
    ]);
    const current = new Map([
      ['a', '1'],
      ['b', '9'],
      ['d', '4'],
    ]);

    expect(planCombatLogArchiveMutations(last, current, new Set())).toEqual({
      upserts: ['b', 'd'],
      deletes: ['c'],
    });
  });

  it('plans a delete for a tombstoned archive the baseline knows is live', () => {
    const last = new Map([
      ['a', 'live-a'],
      ['b', 'live-b'],
    ]);
    const current = new Map([
      ['a', 'live-a'],
      ['b', 'tombstone-b'],
      ['c', 'tombstone-c'],
    ]);

    // `c` was tombstoned before this device ever committed it, so there is no
    // document to delete; `b` is a real delete rather than a silent drop.
    expect(
      planCombatLogArchiveMutations(last, current, new Set(['b', 'c']))
    ).toEqual({ upserts: [], deletes: ['b'] });
  });

  it('advances the baseline only for acknowledged mutations and stops at the first failure', async () => {
    const baseline = new Map([
      ['a', '1'],
      ['gone', '0'],
    ]);
    const current = new Map([
      ['a', '2'],
      ['b', '3'],
    ]);
    const attempted: string[] = [];

    const result = await runCombatLogArchiveMutationPlan({
      plan: planCombatLogArchiveMutations(baseline, current, new Set()),
      baseline,
      current,
      commit: async legacyId => {
        attempted.push(legacyId);
        return legacyId === 'b'
          ? { saved: false, error: 'Local IndexedDB transaction failed' }
          : { saved: true, cloud: 'queued' };
      },
    });

    expect(attempted).toEqual(['a', 'b']);
    expect(result).toEqual({
      outcome: 'queued',
      committed: 1,
      error: 'Local IndexedDB transaction failed',
    });
    expect(baseline.get('a')).toBe('2');
    expect(baseline.has('b')).toBe(false);
    expect(baseline.has('gone')).toBe(true);
  });

  it('derives the tombstone fingerprint from the archive id alone', async () => {
    await expect(
      fingerprintCombatLogArchiveTombstone('arc-1')
    ).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('CombatLogArchiveSyncControls card', () => {
  beforeEach(() => {
    useDmStore.setState({ campaigns: [campaign] });
    useEncounterStore.setState({ encounters: [], encounterTombstones: {} });
    requests = [];
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // The persisted stores rewrite their envelopes on every setState, so the
    // resets have to happen before the storage is cleared.
    useCombatLogStore.setState({
      encounters: {},
      combatLogTombstones: {},
      activeArchiveId: null,
      lastAdmissionError: null,
    });
    useEncounterStore.setState({ encounters: [], encounterTombstones: {} });
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('renders nothing at all while the client flag is off', () => {
    seedArchives({ 'arc-1': endedArchive() });

    const { container } = renderControls();

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the route owner belongs to another campaign', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    // Both campaigns are known to the DM store, so the owner really does hold
    // OTHER1 rather than falling back to an undefined campaign code.
    useDmStore.setState({
      campaigns: [campaign, { code: 'OTHER1', name: 'Other', createdAt: NOW }],
    });
    seedArchives({ 'arc-1': endedArchive() });

    const { container } = render(
      <CombatLogArchiveSyncProvider campaignCode="OTHER1">
        <CombatLogArchiveSyncControls campaign={campaign} />
      </CombatLogArchiveSyncProvider>
    );

    expect(container.innerHTML).toBe('');

    // Positive control: the very same flag and fixtures do render the card
    // when the owner is this campaign's, so the emptiness above is the
    // campaign guard and not a mis-stubbed environment.
    cleanup();
    renderControls();
    expect(screen.getByText('Combat log backup')).toBeInTheDocument();
  });

  it('describes each combat log by name, start time, event count and size', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    useEncounterStore.setState({
      encounters: [
        {
          id: 'enc-a',
          name: 'Goblin ambush',
          campaignCode: campaign.code,
          entities: [],
          currentTurn: 0,
          round: 1,
          isActive: false,
          sortOrder: 'manual',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      encounterTombstones: {},
    });
    const archive = endedArchive({
      events: [
        { ...turnEvent('Goblin'), id: 'e1', timestamp: NOW },
        { ...turnEvent('Bugbear'), id: 'e2', timestamp: NOW },
      ],
    });
    seedArchives({ 'arc-1': archive });

    renderControls();

    const bytes = new TextEncoder().encode(
      canonicalJson(combatLogArchivePayloadFrom(archive))
    ).byteLength;
    // The fixture is deliberately small enough to be reported in bytes; if it
    // ever grows past a kilobyte this assertion must be updated, not deleted.
    expect(bytes).toBeLessThan(1024);

    expect(screen.getByText('Goblin ambush')).toBeInTheDocument();
    expect(
      screen.getByText(
        `${new Date(NOW).toLocaleString()} · 2 events · ${bytes} bytes`
      )
    ).toBeInTheDocument();
    // The raw archive identity is a developer detail and never the label.
    expect(screen.queryByText(/enc-a/)).toBeNull();
    // The destructive control is present from the first render — a refused
    // edit can tell the DM to delete before any workspace exists — but it is
    // last in the row, behind both read-only downloads.
    expect(
      screen.getAllByRole('button').map(button => button.textContent)
    ).toEqual([
      'Find my campaigns',
      'Download as JSON',
      'Download as text',
      'Delete this combat log',
    ]);
  });

  it('falls back to plain language when the encounter behind a log is gone', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    seedArchives({ 'arc-1': endedArchive() });

    renderControls();

    expect(screen.getByText('Untitled combat')).toBeInTheDocument();
  });

  it('downloads one combat log as JSON and as plain text', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    seedArchives({
      'arc-1': endedArchive({
        events: [{ ...turnEvent('Goblin'), id: 'e1', timestamp: NOW }],
      }),
    });
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:combat-log-export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const filenames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      filenames.push(this.download);
    });

    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Download as JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download as text' }));

    const [jsonBlob] = createObjectURL.mock.calls[0] as unknown as [Blob];
    const [textBlob] = createObjectURL.mock.calls[1] as unknown as [Blob];
    const store = useCombatLogStore.getState();
    expect(await jsonBlob.text()).toBe(store.exportArchive('arc-1', 'json'));
    expect(await textBlob.text()).toBe(store.exportArchive('arc-1', 'text'));
    // The two formats really are different, so wiring both buttons to one
    // format cannot pass.
    expect(await jsonBlob.text()).not.toBe(await textBlob.text());
    expect(jsonBlob.type).toBe('application/json');
    expect(textBlob.type).toBe('text/plain');
    expect(filenames).toEqual([
      'combat-log-arc-1.json',
      'combat-log-arc-1.txt',
    ]);
  });

  it('deletes a combat log only once the DM confirms, then commits the deletion', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    await seedIndexedDbGeneration(archivePayload());
    mockOwnerWorkspace();
    mockOwnerSession();
    seedArchives({ 'arc-1': endedArchive() });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const commit = vi.spyOn(
      IndexedDbCombatLogArchiveRepository.prototype,
      'commit'
    );

    renderControls();
    await waitFor(() =>
      expect(screen.getByText(/loaded from this device/i)).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole('button', { name: /delete this combat log/i })
    );
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Bounded window: a declined confirmation must leave the store and the
    // local generation exactly as they were.
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(useCombatLogStore.getState().encounters['arc-1']).toBeDefined();
    expect(commit).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(
      screen.getByRole('button', { name: /delete this combat log/i })
    );

    await waitFor(() =>
      expect(commit).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'delete', legacyId: 'arc-1' })
      )
    );
    expect(useCombatLogStore.getState().encounters['arc-1']).toBeUndefined();
  });

  it('offers the delete control the refused-edit guidance names, with no workspace chosen', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    seedArchives({ 'arc-1': endedArchive() });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderControls();

    // `lastAdmissionError` is session state the local store raises with no
    // relation to enrollment, so this is reachable with no cloud set up at all.
    act(() => {
      useCombatLogStore.setState({
        lastAdmissionError: {
          archiveId: 'arc-1',
          reason: 'item-count',
          at: NOW,
        },
      });
    });
    expect(screen.getByRole('alert').textContent).toContain(
      'Delete one you no longer need'
    );

    // …and the control that guidance names is on screen and works.
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete this combat log' })
    );
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(useCombatLogStore.getState().encounters['arc-1']).toBeDefined();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete this combat log' })
    );
    expect(useCombatLogStore.getState().encounters['arc-1']).toBeUndefined();
  });

  it('explains a refused combat log event in plain language and clears it on dismiss', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    seedArchives({ 'arc-1': endedArchive() });

    renderControls();

    act(() => {
      useCombatLogStore.setState({
        lastAdmissionError: {
          archiveId: 'arc-1',
          reason: 'total-bytes',
          at: NOW,
        },
      });
    });
    const together = screen.getByRole('alert').textContent ?? '';
    expect(together).toContain('take up too much space together');
    expect(together).toContain('was not saved');
    expect(together).not.toContain('total-bytes');

    // A different reason must produce different guidance, so a single constant
    // string cannot pass.
    act(() => {
      useCombatLogStore.setState({
        lastAdmissionError: {
          archiveId: 'arc-1',
          reason: 'record-bytes',
          at: NOW,
        },
      });
    });
    const single = screen.getByRole('alert').textContent ?? '';
    expect(single).toContain('too big to save');
    expect(single).not.toBe(together);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(useCombatLogStore.getState().lastAdmissionError).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
