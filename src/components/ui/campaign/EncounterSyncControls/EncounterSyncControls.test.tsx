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
  fingerprintEncounterPayload,
  fingerprintEncounterTombstone,
  type EncounterPayload,
} from '@/lib/durableDm/encounterFamily';
import * as encounterFamily from '@/lib/durableDm/encounterFamily';
import { writeEncounterAuthorityMarker } from '@/lib/durableDm/encounterLegacyAuthority';
import {
  commitEncounterLocalCutover,
  markEncounterCloudAuthority,
} from '@/lib/indexeddb/encounterAuthority';
import { IndexedDbEncounterRepository } from '@/lib/indexeddb/encounterRepository';
import * as localDatabase from '@/lib/indexeddb/localDatabase';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import * as supabaseBrowser from '@/lib/supabase/browser';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import { useDmStore } from '@/store/dmStore';
import { useEncounterStore } from '@/store/encounterStore';
import { expectCloudProductVocabulary } from '@/test/helpers';
import type { Encounter } from '@/types/encounter';

import {
  EncounterSyncControls,
  EncounterSyncProvider,
  planEncounterMutations,
  runEncounterMutationPlan,
} from './index';

const NOW = '2026-08-23T00:00:00.000Z';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const GENERATION = 'encounter-generation';

const campaign = { code: 'SYNTH1', name: 'Encounters', createdAt: NOW };

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
  name: 'Encounters',
  creationKind: 'import_fork' as const,
  sourceFingerprint: 'source',
  createdAt: 'created',
  family: 'workspace_identity' as const,
  cloudId: CAMPAIGN_ID,
  displayCode: 'A1B2C3D4E5F6',
  membershipAuthority: 'legacy' as const,
  familyAuthorities: 'legacy' as const,
  liveRuntimeAuthority: 'redis_relay' as const,
  acknowledgedAt: 'acknowledged',
};

/** The card only reads the route-level owner, so every case mounts both. */
function renderControls(providerCode = campaign.code) {
  return render(
    <EncounterSyncProvider campaignCode={providerCode}>
      <EncounterSyncControls campaign={campaign} />
    </EncounterSyncProvider>
  );
}

function mockOwnerWorkspace() {
  vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue({
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
  vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: ACCOUNT_ID } } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  } as never);
}

function encounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    id: 'enc-1',
    name: 'Goblin Ambush',
    campaignCode: 'SYNTH1',
    entities: [],
    currentTurn: 0,
    round: 1,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function encounterPayload(): EncounterPayload {
  const { id, campaignCode, ...payload } = encounter();
  void id;
  void campaignCode;
  return payload;
}

function seedEnvelope(encounters: Encounter[], version = 2) {
  localStorage.setItem(
    'rollkeeper-encounter-data',
    JSON.stringify({
      version,
      state: {
        encounters,
        encounterTombstones: {},
        activeEncounterId: null,
        combatConfig: { enemyHpDisplay: 'bar' },
      },
    })
  );
}

async function selectWorkspaceAndPreview() {
  renderControls();
  fireEvent.click(screen.getByRole('button', { name: 'Find my campaigns' }));
  fireEvent.click(
    await screen.findByRole('button', { name: /Use Encounters/ })
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'See what will be backed up' })
    ).toBeVisible()
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'See what will be backed up' })
  );
}

async function seedCloudAuthority() {
  const payload = encounterPayload();
  const contentFingerprint = await fingerprintEncounterPayload(payload);
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:encounter_definition:${CAMPAIGN_ID}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-encounter-data',
    presence: true,
    rawValue: '{"state":{"encounters":[]},"version":2}',
  });
  await transactionComplete(transaction);
  await commitEncounterLocalCutover(database, {
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
        legacyId: 'enc-1',
        family: 'encounter_definition',
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
  await markEncounterCloudAuthority(database, {
    namespace: NAMESPACE,
    campaignId: CAMPAIGN_ID,
    expectedLocalEpoch: 1,
    cloudEpoch: 1,
    now: () => NOW,
    acceptedVersions: [
      {
        legacyId: 'enc-1',
        serverVersion: 1,
        payloadFingerprint: contentFingerprint,
      },
    ],
  });
  database.close();
  writeEncounterAuthorityMarker(localStorage, campaign.code, {
    version: 1,
    authority: 'postgres',
    epoch: 1,
    campaignId: CAMPAIGN_ID,
    namespace: NAMESPACE,
  });
  return contentFingerprint;
}

describe('EncounterSyncControls gates', () => {
  beforeEach(() => {
    useDmStore.setState({ campaigns: [campaign] });
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // The persisted store rewrites its envelope on every setState, so the
    // reset has to happen before the storage is cleared.
    useEncounterStore.setState({ encounters: [], encounterTombstones: {} });
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('renders nothing and performs zero storage, IndexedDB, cookie, or network work by default', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cookieBefore = document.cookie;
    const { container } = renderControls();
    expect(container).toBeEmptyDOMElement();
    await Promise.resolve();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
  });

  it('renders nothing when the route owner belongs to another campaign', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    useDmStore.setState({
      campaigns: [campaign, { code: 'OTHER1', name: 'Other', createdAt: NOW }],
    });

    const { container } = renderControls('OTHER1');

    expect(container).toBeEmptyDOMElement();
  });

  it('workspace discovery and selection do not open the encounter repository', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    seedEnvelope([encounter()]);
    const open = vi
      .spyOn(localDatabase, 'openRollkeeperDatabase')
      .mockRejectedValue(new Error('must not open'));
    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Find my campaigns' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Use Encounters/ })
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'See what will be backed up' })
      ).toBeVisible()
    );
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'See what will be backed up' })
    );
    expect(
      await screen.findByRole('button', { name: 'Download a safety copy' })
    ).toBeVisible();
    expect(screen.getByText(/1 encounter · /)).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Get this browser ready' })
    ).toBeDisabled();
    expect(open).not.toHaveBeenCalled();

    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:encounter-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Download a safety copy' })
    );
    await screen.findByText(/Open that file here to continue/);
    const downloadedBlob = createObjectURL.mock.calls[0]![0] as Blob;
    const recoveryFile = new File(
      [await downloadedBlob.text()],
      'encounter-backup.json',
      { type: 'application/json' }
    );
    fireEvent.change(screen.getByLabelText('Safety copy you downloaded'), {
      target: { files: [recoveryFile] },
    });
    await screen.findByText('Safety copy checked. Nothing was changed.');
    expect(
      screen.getByRole('button', { name: 'Get this browser ready' })
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Safety copy you downloaded'), {
      target: { files: [recoveryFile] },
    });
    await screen.findByText(
      'Safety copy checked. Your encounters are still stored the usual way for now.'
    );
    expect(
      screen.getByRole('button', { name: 'Get this browser ready' })
    ).toBeEnabled();
    expect(open).not.toHaveBeenCalled();
  });

  it('blocks cutover when the legacy envelope was never persisted', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    localStorage.removeItem('rollkeeper-encounter-data');
    await selectWorkspaceAndPreview();

    expect(
      await screen.findByText(
        'Nothing has been saved on this browser yet. Open an encounter first.'
      )
    ).toBeVisible();
    // The exact reason stays available as muted reference detail.
    expect(
      screen.getByText(
        /incomplete-envelope: rollkeeper-encounter-data has never been persisted on this browser/
      )
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Switch this browser over' })
    ).toBeNull();
  });

  it('renders an oversized-family blocker with R17-clean reference text, never the raw internal kind', async () => {
    // Coordinator review round 2, Important 1: the manifest's raw `kind`
    // discriminant is rendered verbatim on the muted reference line next to
    // `blocker.detail`. `'oversized-family'` is the one kind that contains
    // the forbidden word; `blockerKindReferenceLabel` maps it to
    // `'oversized-batch'` at the render site only. Mocking
    // `buildEncounterManifest` directly (rather than seeding
    // `ENCOUNTER_MAX_ITEMS + 1` real encounters) reaches this state without
    // a 2000-record fixture.
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    vi.spyOn(encounterFamily, 'buildEncounterManifest').mockResolvedValue({
      format: 'rollkeeper-encounter-manifest',
      version: 1,
      family: 'encounter_definition',
      campaignCode: campaign.code,
      recordCount: 2001,
      totalBytes: 12345,
      records: [],
      blockers: [
        {
          kind: 'oversized-family',
          legacyId: null,
          detail: 'The encounter roster exceeds 2000 encounters',
        },
      ],
      rawCandidates: [],
      fingerprint: 'f'.repeat(64),
    });
    const { container } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Find my campaigns' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Use Encounters/ })
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'See what will be backed up' })
      ).toBeVisible()
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'See what will be backed up' })
    );

    expect(
      await screen.findByText(
        /oversized-batch: The encounter roster exceeds 2000 encounters/
      )
    ).toBeVisible();
    expect(screen.queryByText(/oversized-family/i)).not.toBeInTheDocument();
    expectCloudProductVocabulary(container);
  });

  it('blocks cutover when the persisted envelope predates version 2', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    seedEnvelope([encounter()], 1);
    await selectWorkspaceAndPreview();

    expect(
      await screen.findByText(
        'The encounters on this browser were saved by a different version of RollKeeper. Open them once in this version, then try again.'
      )
    ).toBeVisible();
    expect(
      screen.getByText(
        /legacy-schema: rollkeeper-encounter-data is persisted at version 1; the encounter store migration must upgrade it to version 2 before preview/
      )
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Switch this browser over' })
    ).toBeNull();
  });

  it('surfaces the active-encounter blocker and keeps cutover unavailable', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    seedEnvelope([encounter({ isActive: true })]);
    await selectWorkspaceAndPreview();

    expect(
      await screen.findByText(
        '"Goblin Ambush" is in combat right now. End that combat first.'
      )
    ).toBeVisible();
    expect(
      screen.getByText(
        "End the combat that's running, then try again. Nothing else is affected."
      )
    ).toBeVisible();
    expect(
      screen.getByText(
        /active-encounter: Encounter "Goblin Ambush" is in active combat; end combat before cutover/
      )
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Switch this browser over' })
    ).toBeNull();
  });

  it('reports a failed workspace discovery through the guarded handler', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockRejectedValue(
      new Error('Sign in to your account first.')
    );
    renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Find my campaigns' }));

    expect(
      await screen.findByText('Sign in to your account first.')
    ).toBeVisible();
  });

  it('wires version history, exact export, and verified rollback under cloud authority', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    const contentFingerprint = await seedCloudAuthority();
    mockOwnerWorkspace();
    mockOwnerSession();
    const payload = encounterPayload();
    const requests: Record<string, unknown>[] = [];
    const respond = (value: unknown) =>
      ({ ok: true, json: async () => value }) as Response;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        if (body.action === 'history')
          return respond({
            versions: [
              {
                serverVersion: 2,
                cutoverEpoch: 1,
                schemaVersion: 2,
                payloadFingerprint: contentFingerprint,
                tombstoned: false,
                acceptedAt: NOW,
              },
              {
                serverVersion: 1,
                cutoverEpoch: 1,
                schemaVersion: 2,
                payloadFingerprint: contentFingerprint,
                tombstoned: false,
                acceptedAt: NOW,
              },
            ],
          });
        if (body.action === 'export-version')
          return respond({
            serverVersion: 2,
            schemaVersion: 2,
            payloadFingerprint: contentFingerprint,
            tombstoned: false,
            payload,
          });
        if (body.action === 'preview-enrollment')
          return respond({
            authority: 'postgres',
            epoch: 1,
            previewFingerprint: 'preview-fingerprint',
            recordCount: 1,
            documents: [
              {
                legacyId: 'enc-1',
                serverVersion: 1,
                schemaVersion: 2,
                payloadFingerprint: contentFingerprint,
                tombstoned: false,
                payload,
              },
            ],
          });
        if (body.action === 'rollback')
          return respond({
            epoch: 2,
            currentGeneration: {
              recordCount: 1,
              documents: [
                {
                  legacyId: 'enc-1',
                  serverVersion: 1,
                  schemaVersion: 2,
                  payloadFingerprint: contentFingerprint,
                  tombstoned: false,
                  payload,
                },
              ],
            },
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      }
    );

    renderControls();

    expect(
      await screen.findByRole('button', { name: 'Earlier versions' })
    ).toBeVisible();
    expect(
      screen.getByText('Players never see these. Live combat is unaffected.')
    ).toBeVisible();
    expect(
      screen.getByText('Encounter to show earlier versions for')
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Earlier versions' }));
    expect(await screen.findByText(/Version 2 ·/)).toBeVisible();

    const downloads: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:encounter-version');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloads.push(this.download);
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Download this version' })[0]
    );
    await waitFor(() => expect(downloads).toContain('encounter-enc-1-v2.json'));

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop backing up' }));
    await screen.findByText(
      'Backup is off and everything was kept. Reload the page to keep working on this browser.'
    );
    expect(requests.map(request => request.action)).toContain('rollback');
  });

  it('never uploads the local candidate after device enrollment', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    seedEnvelope([encounter()]);
    useEncounterStore.setState({
      encounters: [encounter()],
      encounterTombstones: {},
    });
    const cloudPayload = { ...encounterPayload(), name: 'Cloud encounter' };
    const requests: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        const respond = (value: unknown) =>
          ({ ok: true, json: async () => value }) as Response;
        if (body.action === 'preview-enrollment')
          return respond({
            authority: 'postgres',
            epoch: 1,
            previewFingerprint: 'preview-fingerprint',
            recordCount: 1,
            documents: [
              {
                legacyId: 'enc-cloud',
                serverVersion: 1,
                schemaVersion: 2,
                payloadFingerprint: 'cloud-fingerprint',
                tombstoned: false,
                payload: cloudPayload,
              },
            ],
          });
        if (body.action === 'enroll-device') return respond({});
        throw new Error(`unexpected action ${String(body.action)}`);
      }
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Find my campaigns' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Use Encounters/ })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Check this browser' })
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Add this browser to my account',
      })
    );
    await screen.findByText(
      'This browser was added to your account. Choose "Load the copy from my account" when you are ready.'
    );
    // Spec R17: check product vocabulary once discovery/select/check/add
    // have all been visited.
    expectCloudProductVocabulary(container);

    // The enrollment confirm promises the local candidate "is never uploaded
    // automatically", so autosave must stay disarmed until the DM applies the
    // exact cloud generation.
    const commit = vi.spyOn(IndexedDbEncounterRepository.prototype, 'commit');
    for (const name of ['Local edit one', 'Local edit two']) {
      await act(async () => {
        useEncounterStore.getState().updateEncounter('enc-1', { name });
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    expect(commit).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');
  });

  it('arms autosave after a version restore on an enrolled device', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    seedEnvelope([encounter()]);
    useEncounterStore.setState({
      encounters: [encounter()],
      encounterTombstones: {},
    });
    const cloudPayload = { ...encounterPayload(), name: 'Cloud encounter' };
    const cloudFingerprint = await fingerprintEncounterPayload(cloudPayload);
    const restoredPayload = { ...encounterPayload(), name: 'Restored v1' };
    const restoredFingerprint =
      await fingerprintEncounterPayload(restoredPayload);
    const version = (serverVersion: number) => ({
      serverVersion,
      cutoverEpoch: 1,
      schemaVersion: 2,
      payloadFingerprint: restoredFingerprint,
      tombstoned: false,
      acceptedAt: NOW,
    });
    const requests: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        const respond = (value: unknown) =>
          ({ ok: true, json: async () => value }) as Response;
        if (body.action === 'preview-enrollment')
          return respond({
            authority: 'postgres',
            epoch: 1,
            previewFingerprint: 'preview-fingerprint',
            recordCount: 1,
            documents: [
              {
                legacyId: 'enc-cloud',
                serverVersion: 1,
                schemaVersion: 2,
                payloadFingerprint: cloudFingerprint,
                tombstoned: false,
                payload: cloudPayload,
              },
            ],
          });
        if (body.action === 'enroll-device') return respond({});
        if (body.action === 'history')
          return respond({ versions: [version(2), version(1)] });
        if (body.action === 'restore-version')
          return respond({
            serverVersion: 3,
            cutoverEpoch: 1,
            payloadFingerprint: restoredFingerprint,
          });
        if (body.action === 'export-version')
          return respond({
            serverVersion: 3,
            schemaVersion: 2,
            payloadFingerprint: restoredFingerprint,
            tombstoned: false,
            payload: restoredPayload,
          });
        if (body.action === 'put')
          return respond({
            serverVersion: Number(body.expectedServerVersion) + 1,
            cutoverEpoch: Number(body.expectedEpoch),
            payloadFingerprint: body.payloadFingerprint,
            cloudSaved: true,
            playerView: 'not-applicable',
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      }
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Find my campaigns' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Use Encounters/ })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Check this browser' })
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Add this browser to my account',
      })
    );
    await screen.findByText(
      'This browser was added to your account. Choose "Load the copy from my account" when you are ready.'
    );

    // Enrolled but not yet applied: autosave is deliberately disarmed here.
    fireEvent.click(screen.getByRole('button', { name: 'Earlier versions' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restore this version' })
    );
    await screen.findByText('Restored. Saved to your account as version 3.');

    // The restore rewrote the store from IndexedDB, so it is a hydrating path:
    // the next edit must still reach IndexedDB and the cloud.
    const commit = vi.spyOn(IndexedDbEncounterRepository.prototype, 'commit');
    act(() => {
      useEncounterStore
        .getState()
        .updateEncounter('enc-1', { name: 'Post-restore edit' });
    });

    await waitFor(() => expect(commit).toHaveBeenCalled());
    await waitFor(() =>
      expect(requests.map(request => request.action)).toContain('put')
    );
  });

  it('hydrates after a reload when the workspace was only discovered, never enrolled', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    const remembered = mockOwnerWorkspaceWithMemory();
    mockOwnerSession();
    seedEnvelope([encounter()]);
    useEncounterStore.setState({
      encounters: [encounter()],
      encounterTombstones: {},
    });
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:encounter-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Find my campaigns' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Use Encounters/ })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'See what will be backed up' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Download a safety copy' })
    );
    await screen.findByText(/Open that file here to continue/);
    const downloadedBlob = createObjectURL.mock.calls[0]![0] as Blob;
    fireEvent.change(screen.getByLabelText('Safety copy you downloaded'), {
      target: {
        files: [
          new File([await downloadedBlob.text()], 'encounter-backup.json', {
            type: 'application/json',
          }),
        ],
      },
    });
    await screen.findByText(
      'Safety copy checked. Your encounters are still stored the usual way for now.'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Get this browser ready' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Switch this browser over' })
    );
    await screen.findByText(
      'Saved on this browser. Not backed up to your account yet.'
    );

    // Simulate the reload: the mount is fresh, localStorage keeps the frozen
    // legacy copy plus the authority marker, and IndexedDB keeps the cutover
    // generation. Cloud activation never happened.
    cleanup();
    useEncounterStore.setState({
      encounters: [encounter()],
      encounterTombstones: {},
    });
    renderControls();

    // A locally cut-over device must hydrate on reload without ever touching
    // the cloud; the workspace has to have been persisted for that to work.
    expect(
      await screen.findByText('Your encounters are loaded from this browser.')
    ).toBeVisible();
    expect(
      screen.queryByText(
        "This browser isn't set up for that account yet. Choose your campaign again."
      )
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Turn on backup to my account' })
    ).toBeVisible();
    expect(remembered).toHaveLength(1);

    // …and edits keep committing instead of dying in the frozen legacy key.
    const commit = vi.spyOn(IndexedDbEncounterRepository.prototype, 'commit');
    await act(async () => {
      useEncounterStore
        .getState()
        .updateEncounter('enc-1', { name: 'Edited after reload' });
    });
    await waitFor(() => expect(commit).toHaveBeenCalled());
    const database = await openRollkeeperDatabase();
    try {
      const document = await new IndexedDbEncounterRepository(
        database
      ).getDocument(NAMESPACE, 'enc-1');
      expect(document?.payload?.name).toBe('Edited after reload');
      expect(document?.localRevision).toBe(2);
    } finally {
      database.close();
    }
  });
});

describe('encounter autosave planning', () => {
  it('classifies changed, added, and removed encounters', () => {
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

    expect(planEncounterMutations(last, current, new Set())).toEqual({
      upserts: ['b', 'd'],
      deletes: ['c'],
    });
  });

  it('plans a delete for a tombstoned encounter the baseline knows is live', () => {
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
    expect(planEncounterMutations(last, current, new Set(['b', 'c']))).toEqual({
      upserts: [],
      deletes: ['b'],
    });
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

    const result = await runEncounterMutationPlan({
      plan: planEncounterMutations(baseline, current, new Set()),
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
    // The acknowledged upsert advanced; the failed one and the unreached
    // delete stay pending so the next effect run re-emits them.
    expect(baseline.get('a')).toBe('2');
    expect(baseline.has('b')).toBe(false);
    expect(baseline.has('gone')).toBe(true);
  });

  it('keeps the tombstone fingerprint in the baseline so a delete is committed once', async () => {
    const baseline = new Map([
      ['a', 'live-a'],
      ['gone', '0'],
    ]);
    const current = new Map([['a', 'tombstone-a']]);

    const result = await runEncounterMutationPlan({
      plan: planEncounterMutations(baseline, current, new Set(['a'])),
      baseline,
      current,
      commit: async (_legacyId, operation) => ({
        saved: true,
        cloud: operation === 'delete' ? 'conflict' : 'cloud-saved',
      }),
    });

    expect(result).toEqual({ outcome: 'conflict', committed: 2, error: null });
    // The tombstoned id keeps its tombstone fingerprint (no repeated delete);
    // the id that vanished without a tombstone leaves the baseline.
    expect([...baseline]).toEqual([['a', 'tombstone-a']]);
    expect(planEncounterMutations(baseline, current, new Set(['a']))).toEqual({
      upserts: [],
      deletes: [],
    });
  });

  it('derives the tombstone fingerprint from the legacy id alone', async () => {
    await expect(fingerprintEncounterTombstone('enc-1')).resolves.toMatch(
      /^[0-9a-f]{64}$/
    );
  });
});
