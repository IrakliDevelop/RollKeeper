import 'fake-indexeddb/auto';

import { act } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fingerprintCombatLogArchivePayload,
  fingerprintCombatLogArchiveTombstone,
  type CombatLogArchivePayload,
} from '@/lib/durableDm/combatLogArchiveFamily';
import { writeCombatLogArchiveAuthorityMarker } from '@/lib/durableDm/combatLogArchiveLegacyAuthority';
import { commitCombatLogArchiveLocalCutover } from '@/lib/indexeddb/combatLogArchiveAuthority';
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
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import * as supabaseBrowser from '@/lib/supabase/browser';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import { useCombatLogStore } from '@/store/combatLogStore';
import { useDmStore } from '@/store/dmStore';
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

function mockOwnerWorkspace() {
  return vi
    .spyOn(browserDmWorkspace, 'createBrowserDmWorkspace')
    .mockResolvedValue({
      accountId: ACCOUNT_ID,
      accountLabel: 'fake@example.test',
      list: vi.fn().mockResolvedValue([workspace]),
      discover: vi.fn().mockResolvedValue([workspace]),
      remember: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close: vi.fn(),
    });
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

describe('CombatLogArchiveSyncControls durability guards', () => {
  beforeEach(() => {
    useDmStore.setState({ campaigns: [campaign] });
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
      screen.getByRole('button', { name: /delete this archive/i })
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
    // Let the first autosave pass populate the fingerprint cache.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
    });

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
