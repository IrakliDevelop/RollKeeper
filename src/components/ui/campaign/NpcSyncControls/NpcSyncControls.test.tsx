import 'fake-indexeddb/auto';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fingerprintNpcPayload,
  type NpcPayload,
} from '@/lib/durableDm/npcFamily';
import * as npcFamily from '@/lib/durableDm/npcFamily';
import { writeNpcAuthorityMarker } from '@/lib/durableDm/npcLegacyAuthority';
import { commitNpcLocalCutover } from '@/lib/indexeddb/npcAuthority';
import * as localDatabase from '@/lib/indexeddb/localDatabase';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { IndexedDbNpcRepository } from '@/lib/indexeddb/npcRepository';
import * as supabaseBrowser from '@/lib/supabase/browser';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';
import { expectCloudProductVocabulary } from '@/test/helpers';
import type { CampaignNPC } from '@/types/encounter';

import {
  NpcSyncControls,
  NpcSyncProvider,
  planNpcMutations,
  runNpcMutationPlan,
} from './index';

const NOW = '2026-08-23T00:00:00.000Z';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const GENERATION = 'npc-generation';

const campaign = { code: 'SYNTH1', name: 'NPCs', createdAt: 'now' };

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

/** The card only reads the route-level owner, so every case mounts both. */
function renderControls() {
  return render(
    <NpcSyncProvider campaignCode={campaign.code}>
      <NpcSyncControls />
    </NpcSyncProvider>
  );
}

const workspace = {
  namespace: NAMESPACE,
  localId: 'legacy:SYNTH1',
  legacyId: 'SYNTH1',
  name: 'NPCs',
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

function mockOwnerWorkspace() {
  vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue({
    accountId: ACCOUNT_ID,
    accountLabel: 'fake@example.test',
    list: vi.fn().mockResolvedValue([]),
    discover: vi.fn().mockResolvedValue([workspace]),
    remember: vi.fn(),
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

type AuthListener = (event: string, session: unknown) => void;

/**
 * Same owner session, but the controller's `onAuthStateChange` listener is
 * captured so a case can replay a Supabase event (TOKEN_REFRESHED fires
 * hourly, and whenever a hidden tab's token expired).
 */
function mockOwnerSessionCapturingListener() {
  let listener: AuthListener | null = null;
  vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: ACCOUNT_ID } } },
      }),
      onAuthStateChange: vi
        .fn()
        .mockImplementation((callback: AuthListener) => {
          listener = callback;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
    },
  } as never);
  return (event: string, session: unknown) => {
    if (!listener) throw new Error('The controller never subscribed to auth');
    listener(event, session);
  };
}

function npcFixture(): CampaignNPC {
  return {
    id: 'npc-1',
    campaignCode: 'SYNTH1',
    name: 'Sildar Hallwinter',
    armorClass: '16',
    maxHp: 27,
    speed: '30 ft.',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function npcPayload(): NpcPayload {
  const { id, campaignCode, ...payload } = npcFixture();
  void id;
  void campaignCode;
  return payload;
}

function oneNpcState() {
  return { npcsByCampaign: { SYNTH1: [npcFixture()] } };
}

function seedOneNpcEnvelope(version = 4) {
  localStorage.setItem(
    'rollkeeper-npc-data',
    JSON.stringify({ version, state: oneNpcState() })
  );
}

function npcFixture2(): CampaignNPC {
  return {
    id: 'npc-2',
    campaignCode: 'SYNTH1',
    name: 'Gundren Rockseeker',
    armorClass: '10',
    maxHp: 9,
    speed: '25 ft.',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function npcPayload2(): NpcPayload {
  const { id, campaignCode, ...payload } = npcFixture2();
  void id;
  void campaignCode;
  return payload;
}

function twoNpcState() {
  return { npcsByCampaign: { SYNTH1: [npcFixture(), npcFixture2()] } };
}

function seedTwoNpcEnvelope(version = 4) {
  localStorage.setItem(
    'rollkeeper-npc-data',
    JSON.stringify({ version, state: twoNpcState() })
  );
}

async function selectWorkspaceAndPreview() {
  renderControls();
  fireEvent.click(
    screen.getByRole('button', { name: 'Find owner workspaces' })
  );
  fireEvent.click(await screen.findByRole('button', { name: /Select NPCs/ }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Preview exact manifest' })
    ).toBeVisible()
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Preview exact manifest' })
  );
}

/**
 * Puts this device in the state a completed local cutover leaves behind:
 * IndexedDB holds the routed generation and the legacy key is frozen behind
 * an `indexedDB` authority marker.
 */
async function seedLocalIndexedDbAuthority() {
  const payload = npcPayload();
  const contentFingerprint = await fingerprintNpcPayload(payload);
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:npc:${CAMPAIGN_ID}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-npc-data',
    presence: true,
    rawValue: JSON.stringify({ version: 4, state: oneNpcState() }),
  });
  await transactionComplete(transaction);
  await commitNpcLocalCutover(database, {
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
        legacyId: 'npc-1',
        family: 'npc',
        cutoverEpoch: 1,
        operation: 'create',
        payload,
        schemaVersion: 4,
        localRevision: 1,
        baseServerVersion: 0,
        contentFingerprint,
        updatedAt: NOW,
        deletedAt: null,
      },
    ],
  });
  database.close();
  writeNpcAuthorityMarker(localStorage, campaign.code, {
    version: 1,
    authority: 'indexedDB',
    epoch: 1,
    campaignId: CAMPAIGN_ID,
    namespace: NAMESPACE,
  });
}

/**
 * Same completed-local-cutover state as `seedLocalIndexedDbAuthority`, but
 * with two NPC documents, so a test can assert that editing one NPC leaves
 * the other's cached fingerprint alone.
 */
async function seedLocalIndexedDbAuthorityForTwoNpcs() {
  const payload1 = npcPayload();
  const payload2 = npcPayload2();
  const fingerprint1 = await fingerprintNpcPayload(payload1);
  const fingerprint2 = await fingerprintNpcPayload(payload2);
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:npc:${CAMPAIGN_ID}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-npc-data',
    presence: true,
    rawValue: JSON.stringify({ version: 4, state: twoNpcState() }),
  });
  await transactionComplete(transaction);
  await commitNpcLocalCutover(database, {
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
        legacyId: 'npc-1',
        family: 'npc',
        cutoverEpoch: 1,
        operation: 'create',
        payload: payload1,
        schemaVersion: 4,
        localRevision: 1,
        baseServerVersion: 0,
        contentFingerprint: fingerprint1,
        updatedAt: NOW,
        deletedAt: null,
      },
      {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN_ID,
        legacyId: 'npc-2',
        family: 'npc',
        cutoverEpoch: 1,
        operation: 'create',
        payload: payload2,
        schemaVersion: 4,
        localRevision: 1,
        baseServerVersion: 0,
        contentFingerprint: fingerprint2,
        updatedAt: NOW,
        deletedAt: null,
      },
    ],
  });
  database.close();
  writeNpcAuthorityMarker(localStorage, campaign.code, {
    version: 1,
    authority: 'indexedDB',
    epoch: 1,
    campaignId: CAMPAIGN_ID,
    namespace: NAMESPACE,
  });
}

describe('NpcSyncControls gates', () => {
  beforeEach(() => {
    useDmStore.setState({ campaigns: [campaign] });
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // The persisted store rewrites its envelope on every setState, so the
    // reset has to happen before the storage is cleared.
    useNPCStore.setState({ npcsByCampaign: {} });
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

  it('workspace discovery and selection do not open the NPC repository', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    seedOneNpcEnvelope();
    const open = vi
      .spyOn(localDatabase, 'openRollkeeperDatabase')
      .mockRejectedValue(new Error('must not open'));
    renderControls();
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(await screen.findByRole('button', { name: /Select NPCs/ }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview exact manifest' })
      ).toBeVisible()
    );
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview exact manifest' })
    );
    expect(
      await screen.findByRole('button', { name: 'Download recovery file' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Verify recovery file and select' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeDisabled();
    expect(open).not.toHaveBeenCalled();

    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:npc-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Download recovery file' })
    );
    await screen.findByText(/Reopen that file here before selection/);
    const downloadedBlob = createObjectURL.mock.calls[0]![0] as Blob;
    const recoveryFile = new File(
      [await downloadedBlob.text()],
      'npc-backup.json',
      { type: 'application/json' }
    );
    fireEvent.change(screen.getByLabelText('Downloaded NPC recovery file'), {
      target: { files: [recoveryFile] },
    });
    await screen.findByText(/data category selection was cancelled/);
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Downloaded NPC recovery file'), {
      target: { files: [recoveryFile] },
    });
    await screen.findByText(
      'Recovery file verified and NPCs selected. LocalStorage remains authoritative.'
    );
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeEnabled();
    expect(open).not.toHaveBeenCalled();
  });

  it('blocks cutover when the legacy envelope was never persisted', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    localStorage.removeItem('rollkeeper-npc-data');
    await selectWorkspaceAndPreview();

    expect(
      await screen.findByText(
        /incomplete-envelope: rollkeeper-npc-data has never been persisted on this browser/
      )
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Confirm local cutover' })
    ).toBeNull();
  });

  it('blocks cutover when the persisted envelope predates version 4', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    seedOneNpcEnvelope(3);
    await selectWorkspaceAndPreview();

    expect(
      await screen.findByText(
        /legacy-schema: rollkeeper-npc-data is persisted at version 3; the NPC store migration must upgrade it to version 4 before preview/
      )
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Confirm local cutover' })
    ).toBeNull();
  });

  it('hydrates after a reload when the workspace was only discovered, never enrolled', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    const remembered = mockOwnerWorkspaceWithMemory();
    mockOwnerSession();
    useNPCStore.setState(oneNpcState());
    seedOneNpcEnvelope();
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:npc-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderControls();
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(await screen.findByRole('button', { name: /Select NPCs/ }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Prepare IndexedDB' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirm local cutover' })
    );
    await screen.findByText(
      'Local: saved · IndexedDB authority epoch 1 · Cloud: inactive'
    );

    // The reload: fresh mount, localStorage keeps the frozen legacy copy plus
    // the authority marker, IndexedDB keeps the cutover generation, and cloud
    // activation never happened.
    cleanup();
    useNPCStore.setState(oneNpcState());
    renderControls();

    expect(
      await screen.findByText(
        'NPCs loaded from the verified local IndexedDB generation.'
      )
    ).toBeVisible();
    expect(
      screen.queryByText(
        'The initialized NPC namespace has no matching owner workspace on this browser.'
      )
    ).toBeNull();
    expect(remembered).toHaveLength(1);

    // …and edits keep committing instead of dying in the frozen legacy key.
    const commit = vi.spyOn(IndexedDbNpcRepository.prototype, 'commit');
    await act(async () => {
      useNPCStore.getState().updateNPC(campaign.code, 'npc-1', {
        name: 'Edited after reload',
      });
    });
    await waitFor(() => expect(commit).toHaveBeenCalled(), { timeout: 5000 });
    await waitFor(
      async () => {
        const database = await openRollkeeperDatabase();
        try {
          const document = await new IndexedDbNpcRepository(
            database
          ).getDocument(NAMESPACE, 'npc-1');
          expect(document?.payload?.name).toBe('Edited after reload');
          expect(document?.localRevision).toBe(2);
        } finally {
          database.close();
        }
      },
      { timeout: 5000 }
    );
  });

  it('does not re-hydrate over a newer local edit on a repeated auth event', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    // The device already knows the workspace, so this case isolates the
    // re-entrancy guard from the cutover-time `remember`.
    mockOwnerWorkspaceWithMemory().push(workspace);
    const fireAuthEvent = mockOwnerSessionCapturingListener();
    await seedLocalIndexedDbAuthority();
    useNPCStore.setState(oneNpcState());
    seedOneNpcEnvelope();

    renderControls();
    await screen.findByText(
      'NPCs loaded from the verified local IndexedDB generation.'
    );
    const openContext = vi.mocked(browserDmWorkspace.createBrowserDmWorkspace);
    expect(openContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      useNPCStore.getState().updateNPC(campaign.code, 'npc-1', {
        name: 'Edited before the token refresh',
      });
      fireAuthEvent('TOKEN_REFRESHED', { user: { id: ACCOUNT_ID } });
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    // The guard returns before `createBrowserDmWorkspace()`, so this count is
    // the scheduling-independent witness that no second hydration pass ran:
    // it is 2 without the guard however the chain happened to interleave.
    expect(openContext).toHaveBeenCalledTimes(1);
    expect(useNPCStore.getState().npcsByCampaign[campaign.code]![0]!.name).toBe(
      'Edited before the token refresh'
    );

    // …and the baseline survived the auth event, so the edit still committed.
    await waitFor(
      async () => {
        const database = await openRollkeeperDatabase();
        try {
          const document = await new IndexedDbNpcRepository(
            database
          ).getDocument(NAMESPACE, 'npc-1');
          expect(document?.payload?.name).toBe(
            'Edited before the token refresh'
          );
          expect(document?.localRevision).toBe(2);
        } finally {
          database.close();
        }
      },
      { timeout: 5000 }
    );
  });

  it('does not upload the local candidate after enrollment until the cloud generation is applied', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    useNPCStore.setState(oneNpcState());
    seedOneNpcEnvelope();
    const cloudPayload = { ...npcPayload(), name: 'Cloud NPC' };
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
                legacyId: 'npc-cloud',
                serverVersion: 1,
                schemaVersion: 4,
                payloadFingerprint: 'cloud-fingerprint',
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
      }
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container } = renderControls();
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(await screen.findByRole('button', { name: /Select NPCs/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview cloud enrollment' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enroll this browser' })
    );
    await screen.findByText(
      'Browser explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
    );
    // Spec R17: check product vocabulary once discovery/select/preview/enroll
    // have all been visited.
    expectCloudProductVocabulary(container);

    // The enrollment confirm promises the local candidate "is never uploaded
    // automatically", so autosave must stay disarmed until the DM applies the
    // exact cloud generation.
    const commit = vi.spyOn(IndexedDbNpcRepository.prototype, 'commit');
    for (const name of ['Local candidate edit', 'Local candidate edit again']) {
      await act(async () => {
        useNPCStore.getState().updateNPC(campaign.code, 'npc-1', { name });
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    expect(commit).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');
  });

  /**
   * Drives an enrolled-but-unapplied device: the cloud generation is in
   * IndexedDB while the store still shows the local candidate, which is the
   * only state both hydrating paths below start from.
   */
  async function enrollAgainstCloudGeneration(
    requests: Record<string, unknown>[]
  ) {
    const cloudPayload = { ...npcPayload(), name: 'Cloud NPC' };
    const cloudFingerprint = await fingerprintNpcPayload(cloudPayload);
    const restoredPayload = { ...npcPayload(), name: 'Restored v1' };
    const restoredFingerprint = await fingerprintNpcPayload(restoredPayload);
    const version = (serverVersion: number) => ({
      serverVersion,
      cutoverEpoch: 1,
      schemaVersion: 4,
      payloadFingerprint: restoredFingerprint,
      tombstoned: false,
      acceptedAt: NOW,
    });
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
                legacyId: 'npc-1',
                serverVersion: 1,
                schemaVersion: 4,
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
            schemaVersion: 4,
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(await screen.findByRole('button', { name: /Select NPCs/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview cloud enrollment' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enroll this browser' })
    );
    await screen.findByText(
      'Browser explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
    );
  }

  it('arms autosave when the exact cloud generation is applied', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    useNPCStore.setState(oneNpcState());
    seedOneNpcEnvelope();
    const requests: Record<string, unknown>[] = [];
    await enrollAgainstCloudGeneration(requests);

    // The disarmed phase keeps a bounded fixed window on purpose: a `waitFor`
    // on a negative assertion passes instantly and proves nothing. The armed
    // phase below waits on the commit signal instead, so it no longer depends
    // on the runner finishing an open-read-fingerprint-commit cycle in 10ms.
    const commit = vi.spyOn(IndexedDbNpcRepository.prototype, 'commit');
    await act(async () => {
      useNPCStore.getState().updateNPC(campaign.code, 'npc-1', {
        name: 'Local candidate edit',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(commit).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');

    fireEvent.click(
      screen.getByRole('button', { name: 'Apply exact cloud version' })
    );
    await screen.findByText(
      'Browser hydrated from the exact cloud generation of 1 records.'
    );

    // Applying rewrote the store from IndexedDB, so it is a hydrating path:
    // the next edit must still reach IndexedDB and the cloud.
    await act(async () => {
      useNPCStore.getState().updateNPC(campaign.code, 'npc-1', {
        name: 'Edited after applying the cloud generation',
      });
    });
    await waitFor(() => expect(commit).toHaveBeenCalled(), { timeout: 5000 });
    await waitFor(
      () => expect(requests.map(request => request.action)).toContain('put'),
      { timeout: 5000 }
    );
  });

  it('arms autosave after a version restore on an enrolled device', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    useNPCStore.setState(oneNpcState());
    seedOneNpcEnvelope();
    const requests: Record<string, unknown>[] = [];
    await enrollAgainstCloudGeneration(requests);

    // Enrolled but never applied, so autosave is still disarmed here.
    fireEvent.click(screen.getByRole('button', { name: 'Version history' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restore as new version' })
    );
    await screen.findByText(
      'Cloud: saved as version 3 · Player view: not applicable'
    );

    // The restore rewrote the store from IndexedDB, so it is a hydrating path
    // too — and it is the site Slice 11E missed on its first pass.
    const commit = vi.spyOn(IndexedDbNpcRepository.prototype, 'commit');
    await act(async () => {
      useNPCStore.getState().updateNPC(campaign.code, 'npc-1', {
        name: 'Edited after the restore',
      });
    });
    await waitFor(() => expect(commit).toHaveBeenCalled(), { timeout: 5000 });
    await waitFor(
      () => expect(requests.map(request => request.action)).toContain('put'),
      { timeout: 5000 }
    );
    await waitFor(
      async () => {
        const database = await openRollkeeperDatabase();
        try {
          const document = await new IndexedDbNpcRepository(
            database
          ).getDocument(NAMESPACE, 'npc-1');
          expect(document?.payload?.name).toBe('Edited after the restore');
        } finally {
          database.close();
        }
      },
      { timeout: 5000 }
    );
  });

  it('reuses a cached fingerprint for an NPC the store left untouched', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory().push(workspace);
    mockOwnerSession();
    await seedLocalIndexedDbAuthorityForTwoNpcs();
    useNPCStore.setState(twoNpcState());
    seedTwoNpcEnvelope();

    renderControls();
    await screen.findByText(
      'NPCs loaded from the verified local IndexedDB generation.'
    );
    // Let the baseline-establishing autosave run (queued right after hydrate)
    // finish hashing both NPCs before measuring, or its tail call races past
    // the spy reset below and pollutes the count.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    const fingerprint = vi.spyOn(npcFamily, 'fingerprintNpcPayload');
    fingerprint.mockClear();
    const commit = vi.spyOn(IndexedDbNpcRepository.prototype, 'commit');
    await act(async () => {
      useNPCStore.getState().updateNPC(campaign.code, 'npc-1', {
        name: 'Only this one changed',
      });
    });
    // The autosave pass hashes every NPC it needs before it commits anything,
    // so the commit is the end-of-pass signal: waiting for it cannot observe a
    // half-hashed run the way a fixed window can miss a whole run.
    await waitFor(() => expect(commit).toHaveBeenCalled(), { timeout: 5000 });
    // The untouched NPC (npc-2) keeps its object identity, so only the edited
    // one is re-canonicalized and re-hashed. `NpcPayload` omits `id`
    // (`Omit<CampaignNPC, 'id' | 'campaignCode'>`), so `name` — unique per
    // fixture — is the identifying field available on the call args.
    const hashedNames = fingerprint.mock.calls.map(call => call[0].name);
    expect(hashedNames).toEqual(['Only this one changed']);
  });
});

describe('NPC autosave planning', () => {
  it('classifies changed, added, and removed NPCs', () => {
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

    expect(planNpcMutations(last, current)).toEqual({
      upserts: ['b', 'd'],
      deletes: ['c'],
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

    const result = await runNpcMutationPlan({
      plan: planNpcMutations(baseline, current),
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

  it('keeps the worst cloud outcome and drops deleted ids from the baseline', async () => {
    const baseline = new Map([
      ['a', '1'],
      ['gone', '0'],
    ]);
    const current = new Map([['a', '2']]);

    const result = await runNpcMutationPlan({
      plan: planNpcMutations(baseline, current),
      baseline,
      current,
      commit: async (_legacyId, operation) => ({
        saved: true,
        cloud: operation === 'delete' ? 'conflict' : 'cloud-saved',
      }),
    });

    expect(result).toEqual({ outcome: 'conflict', committed: 2, error: null });
    expect([...baseline]).toEqual([['a', '2']]);
  });
});
