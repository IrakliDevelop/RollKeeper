import 'fake-indexeddb/auto';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as campaignSettingsFamily from '@/lib/durableDm/campaignSettingsFamily';
import {
  fingerprintCampaignSettingsPayload,
  type CampaignSettingsPayload,
} from '@/lib/durableDm/campaignSettingsFamily';
import { writeCampaignSettingsProjectionAuthority } from '@/lib/durableDm/campaignSettingsLegacyProjection';
import * as campaignSettingsAuthority from '@/lib/indexeddb/campaignSettingsAuthority';
import { commitCampaignSettingsLocalCutover } from '@/lib/indexeddb/campaignSettingsAuthority';
import { IndexedDbCampaignSettingsRepository } from '@/lib/indexeddb/campaignSettingsRepository';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import * as localDatabase from '@/lib/indexeddb/localDatabase';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import * as supabaseBrowser from '@/lib/supabase/browser';
import { useDmStore } from '@/store/dmStore';
import type { CampaignInfo } from '@/types/campaign';
import { CampaignSettingsSyncControls } from './CampaignSettingsSyncControls';

const NOW = '2026-08-22T00:00:00.000Z';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const GENERATION = 'campaign-settings-generation';
const CAMPAIGN_CODE = 'SYNTH1';
const DM_ID = 'dm-synthetic';

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

const ownerWorkspace = {
  namespace: NAMESPACE,
  localId: 'legacy:SYNTH1',
  legacyId: CAMPAIGN_CODE,
  name: 'Synthetic canary',
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

function campaignFixture(): CampaignInfo {
  return {
    code: CAMPAIGN_CODE,
    name: 'Synthetic canary',
    createdAt: 'created',
    stackableInspiration: false,
    customCounterLabel: 'Favors',
    playerCounters: { 'player-1': 2 },
  };
}

function campaignSettingsPayload(): CampaignSettingsPayload {
  return {
    stackableInspiration: false,
    customCounterLabel: 'Favors',
    playerCounters: { 'player-1': 2 },
  };
}

/**
 * Seeds the DM store, whose `persist` middleware writes the legacy
 * `rollkeeper-dm-data` envelope the manifest is built from.
 */
function seedOneCampaign() {
  useDmStore.setState({ dmId: DM_ID, campaigns: [campaignFixture()] });
}

function currentDmEnvelope() {
  return localStorage.getItem('rollkeeper-dm-data') ?? '';
}

function storedCampaign() {
  return useDmStore
    .getState()
    .campaigns.find(item => item.code === CAMPAIGN_CODE);
}

/**
 * Mirrors `src/app/dm/campaign/[code]/page.tsx`, which reads the campaign out
 * of the DM store and passes it down, so a store edit reaches the controller
 * exactly the way it does in the app.
 */
function CampaignSettingsHarness() {
  const campaign = useDmStore(state =>
    state.campaigns.find(item => item.code === CAMPAIGN_CODE)
  );
  if (!campaign) return null;
  return <CampaignSettingsSyncControls campaign={campaign} />;
}

/**
 * Puts this device in the state a completed local cutover leaves behind:
 * IndexedDB holds the routed generation and the legacy key is frozen behind
 * an `indexedDB` authority marker.
 */
async function seedLocalIndexedDbAuthority() {
  const payload = campaignSettingsPayload();
  const contentFingerprint = await fingerprintCampaignSettingsPayload(payload);
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:campaign_settings:${CAMPAIGN_ID}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-dm-data',
    presence: true,
    rawValue: currentDmEnvelope(),
  });
  await transactionComplete(transaction);
  await commitCampaignSettingsLocalCutover(database, {
    namespace: NAMESPACE,
    campaignId: CAMPAIGN_ID,
    generation: GENERATION,
    confirmed: true,
    gates,
    now: () => NOW,
    initialDocument: {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      legacyId: CAMPAIGN_CODE,
      family: 'campaign_settings',
      cutoverEpoch: 1,
      operation: 'create',
      payload,
      schemaVersion: 1,
      localRevision: 1,
      baseServerVersion: 0,
      contentFingerprint,
      updatedAt: NOW,
      deletedAt: null,
    },
  });
  database.close();
  writeCampaignSettingsProjectionAuthority(localStorage, CAMPAIGN_CODE, {
    version: 1,
    authority: 'indexedDB',
    epoch: 1,
    campaignId: CAMPAIGN_ID,
    namespace: NAMESPACE,
  });
}

/**
 * Drives the discovery → preview → recovery download → prepare → cutover flow
 * that leaves this device on its own local IndexedDB authority.
 */
async function completeLocalCutover() {
  render(<CampaignSettingsHarness />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Find owner workspaces' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: /Select Synthetic canary/ })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Preview exact manifest' })
  );
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Download recovery and select',
    })
  );
  await screen.findByText(
    'campaign_settings selected. LocalStorage remains authoritative.'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Prepare IndexedDB' }));
  await screen.findByText(
    'IndexedDB preparation validated and reopened. Final confirmation is still required.'
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm local cutover' })
  );
  await screen.findByText(
    'Local: saved · IndexedDB authority epoch 1 · Cloud: inactive'
  );
}

async function readCampaignSettingsDocument() {
  const database = await openRollkeeperDatabase();
  try {
    return await new IndexedDbCampaignSettingsRepository(database).getDocument(
      NAMESPACE,
      CAMPAIGN_CODE
    );
  } finally {
    database.close();
  }
}

describe('CampaignSettingsSyncControls default-off contract', () => {
  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // The persisted store rewrites its envelope on every setState, so the
    // reset has to happen before the storage is cleared.
    useDmStore.setState({ campaigns: [] });
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('renders nothing and performs no storage, IndexedDB, cookie, or network work', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cookieBefore = document.cookie;
    const { container } = render(
      <CampaignSettingsSyncControls
        campaign={{
          code: 'SYNTH1',
          name: 'Synthetic canary',
          createdAt: 'now',
        }}
      />
    );
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByText(/campaign settings cloud canary/i)
    ).not.toBeInTheDocument();
    await Promise.resolve();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
  });

  it('keeps an unselected discovered family out of IndexedDB', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const workspace = {
      namespace: 'user:11111111-1111-4111-8111-111111111111' as const,
      localId: 'legacy:SYNTH1',
      legacyId: 'SYNTH1',
      name: 'Synthetic canary',
      creationKind: 'import_fork' as const,
      sourceFingerprint: 'source',
      createdAt: 'created',
      family: 'workspace_identity' as const,
      cloudId: '22222222-2222-4222-8222-222222222222',
      displayCode: 'A1B2C3D4E5F6',
      membershipAuthority: 'legacy' as const,
      familyAuthorities: 'legacy' as const,
      liveRuntimeAuthority: 'redis_relay' as const,
      acknowledgedAt: 'acknowledged',
    };
    vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue({
      accountId: '11111111-1111-4111-8111-111111111111',
      accountLabel: 'synthetic@example.test',
      list: vi.fn().mockResolvedValue([]),
      discover: vi.fn().mockResolvedValue([workspace]),
      remember: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close: vi.fn(),
    });
    const open = vi
      .spyOn(localDatabase, 'openRollkeeperDatabase')
      .mockRejectedValue(
        new Error('unselected family must not open IndexedDB')
      );

    render(
      <CampaignSettingsSyncControls
        campaign={{
          code: 'SYNTH1',
          name: 'Synthetic canary',
          createdAt: 'now',
        }}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    await screen.findByRole('button', { name: /Select Synthetic canary/ });
    fireEvent.click(
      screen.getByRole('button', { name: /Select Synthetic canary/ })
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview exact manifest' })
      ).toBeVisible()
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('restores an initialized Postgres workspace and its owner controls after reload', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const accountId = '11111111-1111-4111-8111-111111111111';
    const campaignId = '22222222-2222-4222-8222-222222222222';
    writeCampaignSettingsProjectionAuthority(localStorage, 'SYNTH1', {
      version: 1,
      authority: 'postgres',
      epoch: 1,
      campaignId,
      namespace: `user:${accountId}`,
    });

    const close = vi.fn();
    const workspace = {
      namespace: `user:${accountId}` as const,
      localId: 'legacy:SYNTH1',
      name: 'Synthetic canary',
      creationKind: 'import_fork' as const,
      sourceFingerprint: 'source',
      createdAt: 'created',
      family: 'workspace_identity' as const,
      legacyId: 'SYNTH1',
      cloudId: campaignId,
      displayCode: 'SYNTHETIC',
      membershipAuthority: 'legacy' as const,
      familyAuthorities: 'legacy' as const,
      liveRuntimeAuthority: 'redis_relay' as const,
      acknowledgedAt: 'acknowledged',
    };
    const restoredContext = {
      accountId,
      accountLabel: 'synthetic@example.test',
      list: vi.fn().mockResolvedValue([workspace]),
      discover: vi.fn().mockResolvedValue([workspace]),
      remember: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close,
    };
    vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue(
      restoredContext
    );
    vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: accountId } } },
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    } as never);
    vi.spyOn(localDatabase, 'openRollkeeperDatabase').mockResolvedValue({
      close: vi.fn(),
    } as never);
    vi.spyOn(
      campaignSettingsAuthority,
      'readCampaignSettingsAuthority'
    ).mockResolvedValue({
      authority: 'postgres',
      namespace: `user:${accountId}`,
      campaignId,
      family: 'campaign_settings',
      generation: 'generation-1',
      epoch: 1,
      committedAt: 'committed',
    });
    vi.spyOn(
      IndexedDbCampaignSettingsRepository.prototype,
      'getDocument'
    ).mockResolvedValue({
      namespace: `user:${accountId}`,
      campaignId,
      legacyId: 'SYNTH1',
      family: 'campaign_settings',
      cutoverEpoch: 1,
      operation: 'create',
      payload: { stackableInspiration: true },
      schemaVersion: 1,
      localRevision: 1,
      baseServerVersion: 1,
      contentFingerprint: 'fingerprint',
      updatedAt: 'updated',
      deletedAt: null,
    });
    vi.spyOn(
      campaignSettingsFamily,
      'fingerprintCampaignSettingsPayload'
    ).mockResolvedValue('fingerprint');

    render(
      <CampaignSettingsSyncControls
        campaign={{
          code: 'SYNTH1',
          name: 'Synthetic canary',
          createdAt: 'now',
        }}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Version history' })
      ).toBeVisible()
    );
    expect(
      screen.queryByRole('button', { name: 'Find owner workspaces' })
    ).not.toBeInTheDocument();
    expect(restoredContext.list).toHaveBeenCalledTimes(1);
  });

  it('offers an explicit exact-version hydration after an enrolled device previews newer cloud state', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const accountId = '11111111-1111-4111-8111-111111111111';
    const campaignId = '22222222-2222-4222-8222-222222222222';
    const workspace = {
      namespace: `user:${accountId}` as const,
      localId: 'legacy:SYNTH1',
      legacyId: 'SYNTH1',
      name: 'Synthetic canary',
      creationKind: 'import_fork' as const,
      sourceFingerprint: 'source',
      createdAt: 'created',
      family: 'workspace_identity' as const,
      cloudId: campaignId,
      displayCode: 'A1B2C3D4E5F6',
      membershipAuthority: 'legacy' as const,
      familyAuthorities: 'legacy' as const,
      liveRuntimeAuthority: 'redis_relay' as const,
      acknowledgedAt: 'acknowledged',
    };
    writeCampaignSettingsProjectionAuthority(localStorage, 'SYNTH1', {
      version: 1,
      authority: 'postgres',
      epoch: 1,
      campaignId,
      namespace: `user:${accountId}`,
    });
    vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue({
      accountId,
      accountLabel: 'synthetic@example.test',
      list: vi.fn().mockResolvedValue([workspace]),
      discover: vi.fn().mockResolvedValue([workspace]),
      remember: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close: vi.fn(),
    });
    vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: accountId } } },
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    } as never);
    vi.spyOn(
      campaignSettingsAuthority,
      'readCampaignSettingsAuthority'
    ).mockResolvedValue({
      authority: 'postgres',
      namespace: `user:${accountId}`,
      campaignId,
      family: 'campaign_settings',
      generation: 'generation-1',
      epoch: 1,
      committedAt: 'committed',
    });
    vi.spyOn(
      IndexedDbCampaignSettingsRepository.prototype,
      'getDocument'
    ).mockResolvedValue({
      namespace: `user:${accountId}`,
      campaignId,
      legacyId: 'SYNTH1',
      family: 'campaign_settings',
      cutoverEpoch: 1,
      operation: 'replace',
      payload: { stackableInspiration: true },
      schemaVersion: 1,
      localRevision: 1,
      baseServerVersion: 1,
      contentFingerprint: 'a'.repeat(64),
      updatedAt: 'updated',
      deletedAt: null,
    });
    vi.spyOn(
      campaignSettingsFamily,
      'fingerprintCampaignSettingsPayload'
    ).mockResolvedValue('a'.repeat(64));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          authority: 'postgres',
          epoch: 1,
          serverVersion: 2,
          schemaVersion: 1,
          payload: { stackableInspiration: false },
          payloadFingerprint: 'b'.repeat(64),
          previewFingerprint: 'c'.repeat(64),
          tombstoned: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <CampaignSettingsSyncControls
        campaign={{
          code: 'SYNTH1',
          name: 'Synthetic canary',
          createdAt: 'now',
        }}
      />
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview cloud enrollment' })
      ).toBeVisible()
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview cloud enrollment' })
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Apply exact cloud version' })
      ).toBeVisible()
    );
  });

  it('hydrates after a reload when the workspace was only discovered, never enrolled', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const remembered = mockOwnerWorkspaceWithMemory();
    mockOwnerSession();
    seedOneCampaign();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:campaign-settings-recovery'
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await completeLocalCutover();

    // The reload: fresh mount, localStorage keeps the frozen legacy copy plus
    // the authority marker, IndexedDB keeps the cutover generation, and cloud
    // activation never happened.
    cleanup();
    seedOneCampaign();
    render(<CampaignSettingsHarness />);

    expect(
      await screen.findByText(
        'Campaign settings loaded from the verified local IndexedDB generation.'
      )
    ).toBeVisible();
    expect(
      screen.queryByText(
        'The initialized campaign settings namespace has no matching owner workspace on this device.'
      )
    ).toBeNull();
    expect(remembered).toHaveLength(1);

    // …and edits keep committing instead of dying in the frozen legacy key.
    const commit = vi.spyOn(
      IndexedDbCampaignSettingsRepository.prototype,
      'commit'
    );
    await act(async () => {
      useDmStore.getState().updateCampaign(CAMPAIGN_CODE, {
        customCounterLabel: 'Edited after reload',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(commit).toHaveBeenCalled();
    const saved = await readCampaignSettingsDocument();
    expect(
      (saved?.payload as CampaignSettingsPayload | undefined)
        ?.customCounterLabel
    ).toBe('Edited after reload');
    expect(saved?.localRevision).toBe(2);
  });

  it('does not re-hydrate over a newer local edit on a repeated auth event', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    // The device already knows the workspace, so this case isolates the
    // re-entrancy guard from the cutover-time `remember`.
    mockOwnerWorkspaceWithMemory().push(ownerWorkspace);
    const fireAuthEvent = mockOwnerSessionCapturingListener();
    seedOneCampaign();
    await seedLocalIndexedDbAuthority();

    render(<CampaignSettingsHarness />);
    await screen.findByText(
      'Campaign settings loaded from the verified local IndexedDB generation.'
    );
    const openContext = vi.mocked(browserDmWorkspace.createBrowserDmWorkspace);
    expect(openContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      useDmStore.getState().updateCampaign(CAMPAIGN_CODE, {
        customCounterLabel: 'Edited before the token refresh',
      });
      fireAuthEvent('TOKEN_REFRESHED', { user: { id: ACCOUNT_ID } });
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    // The guard returns before `createBrowserDmWorkspace()`, so this count is
    // the scheduling-independent witness that no second hydration pass ran:
    // it is 2 without the guard however the chain happened to interleave.
    expect(openContext).toHaveBeenCalledTimes(1);
    expect(storedCampaign()?.customCounterLabel).toBe(
      'Edited before the token refresh'
    );

    // …and the baseline survived the auth event, so the edit still committed.
    const saved = await readCampaignSettingsDocument();
    expect(
      (saved?.payload as CampaignSettingsPayload | undefined)
        ?.customCounterLabel
    ).toBe('Edited before the token refresh');
    expect(saved?.localRevision).toBe(2);
  });

  it('does not upload the local candidate after enrollment until the cloud generation is applied', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    seedOneCampaign();
    const cloudPayload = {
      ...campaignSettingsPayload(),
      customCounterLabel: 'Cloud label',
    };
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
            serverVersion: 1,
            schemaVersion: 1,
            payloadFingerprint: 'cloud-fingerprint',
            tombstoned: false,
            payload: cloudPayload,
          });
        if (body.action === 'enroll-device') return respond({});
        if (body.action === 'put')
          return respond({
            serverVersion: Number(body.expectedServerVersion) + 1,
            cutoverEpoch: Number(body.expectedEpoch),
            payloadFingerprint: body.payloadFingerprint,
            cloudSaved: true,
            playerView: 'pending',
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      }
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CampaignSettingsHarness />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Synthetic canary/ })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview cloud enrollment' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enroll this device' })
    );
    await screen.findByText(
      'Device explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
    );

    // The enrollment confirm promises the local candidate "is never uploaded
    // automatically", so autosave must stay disarmed until the DM applies the
    // exact cloud generation. The 10ms window is the one the RED run showed a
    // committed autosave landing inside.
    const commit = vi.spyOn(
      IndexedDbCampaignSettingsRepository.prototype,
      'commit'
    );
    for (const customCounterLabel of [
      'Local candidate edit',
      'Local candidate edit again',
    ]) {
      await act(async () => {
        useDmStore
          .getState()
          .updateCampaign(CAMPAIGN_CODE, { customCounterLabel });
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    expect(commit).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');
  });

  it('arms autosave when the applied cloud version is one the device already holds', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    seedOneCampaign();
    const cloudPayload = {
      ...campaignSettingsPayload(),
      customCounterLabel: 'Cloud label',
    };
    const cloudFingerprint =
      await fingerprintCampaignSettingsPayload(cloudPayload);
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
            serverVersion: 1,
            schemaVersion: 1,
            payloadFingerprint: cloudFingerprint,
            tombstoned: false,
            payload: cloudPayload,
          });
        if (body.action === 'enroll-device') return respond({});
        if (body.action === 'put')
          return respond({
            serverVersion: Number(body.expectedServerVersion) + 1,
            cutoverEpoch: Number(body.expectedEpoch),
            payloadFingerprint: body.payloadFingerprint,
            cloudSaved: true,
            playerView: 'pending',
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      }
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CampaignSettingsHarness />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Synthetic canary/ })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview cloud enrollment' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enroll this device' })
    );
    await screen.findByText(
      'Device explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
    );

    // Enrollment writes exactly the previewed version into IndexedDB, so the
    // Apply button that takes the enroll button's place lands on the
    // already-has-this-version short-circuit. The DM store is still on the
    // local candidate, so that path has to hydrate too — skipping it would
    // leave a device whose frozen legacy key swallows every later edit.
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply exact cloud version' })
    );
    await screen.findByText(
      'This device already has the exact accepted cloud version.'
    );

    // Two edits, because a freshly armed run can only seed the baseline; the
    // second one is the falsifiable half of this assertion.
    const commit = vi.spyOn(
      IndexedDbCampaignSettingsRepository.prototype,
      'commit'
    );
    for (const customCounterLabel of ['Applied edit', 'Applied edit again']) {
      await act(async () => {
        useDmStore
          .getState()
          .updateCampaign(CAMPAIGN_CODE, { customCounterLabel });
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
    expect(commit).toHaveBeenCalled();
    expect(requests.map(request => request.action)).toContain('put');
  });

  /**
   * Drives an enrolled-but-unapplied device: the cloud generation is in
   * IndexedDB while the DM store still shows the local candidate, which is the
   * only state both hydrating paths below start from. The second
   * preview-enrollment answers with a newer cloud version, because
   * `applyExactCloudVersion` short-circuits on a device that already holds the
   * previewed one.
   */
  async function enrollAgainstCloudGeneration(
    requests: Record<string, unknown>[]
  ) {
    const label = (customCounterLabel: string) => ({
      ...campaignSettingsPayload(),
      customCounterLabel,
    });
    const cloudPayload = label('Cloud label');
    const cloudFingerprint =
      await fingerprintCampaignSettingsPayload(cloudPayload);
    const appliedPayload = label('Newer cloud label');
    const appliedFingerprint =
      await fingerprintCampaignSettingsPayload(appliedPayload);
    const restoredPayload = label('Restored label');
    const restoredFingerprint =
      await fingerprintCampaignSettingsPayload(restoredPayload);
    let previews = 0;
    const version = (serverVersion: number) => ({
      serverVersion,
      cutoverEpoch: 1,
      schemaVersion: 1,
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
        if (body.action === 'preview-enrollment') {
          previews += 1;
          return respond({
            authority: 'postgres',
            epoch: 1,
            previewFingerprint: 'preview-fingerprint',
            serverVersion: previews === 1 ? 1 : 2,
            schemaVersion: 1,
            payloadFingerprint:
              previews === 1 ? cloudFingerprint : appliedFingerprint,
            tombstoned: false,
            payload: previews === 1 ? cloudPayload : appliedPayload,
          });
        }
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
            schemaVersion: 1,
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
            playerView: 'pending',
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      }
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CampaignSettingsHarness />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Synthetic canary/ })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview cloud enrollment' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enroll this device' })
    );
    await screen.findByText(
      'Device explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
    );
  }

  it('arms autosave when the exact cloud version is applied', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    seedOneCampaign();
    const requests: Record<string, unknown>[] = [];
    await enrollAgainstCloudGeneration(requests);

    // Two edits, because the first armed run only seeds the baseline: without
    // the `hydrated` gate the second one commits inside its own 10ms window,
    // which is what keeps this negative from passing vacuously.
    const commit = vi.spyOn(
      IndexedDbCampaignSettingsRepository.prototype,
      'commit'
    );
    for (const customCounterLabel of [
      'Local candidate edit',
      'Local candidate edit again',
    ]) {
      await act(async () => {
        useDmStore
          .getState()
          .updateCampaign(CAMPAIGN_CODE, { customCounterLabel });
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
    expect(commit).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview cloud enrollment' })
    );
    // The Apply button is already on screen from the enrollment preview, so
    // wait for the newer preview to reach state before clicking it — applying
    // the version this device already holds is a no-op that never arms.
    await screen.findByText(
      'Cloud enrollment preview loaded. This device remains unenrolled.'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply exact cloud version' })
    );
    await screen.findByText('Device hydrated from exact cloud version 2.');

    // Applying rewrote the DM store from IndexedDB, so it is a hydrating path:
    // the next edit must still reach IndexedDB and the cloud.
    await act(async () => {
      useDmStore.getState().updateCampaign(CAMPAIGN_CODE, {
        customCounterLabel: 'Edited after applying the cloud version',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(commit).toHaveBeenCalled();
    expect(requests.map(request => request.action)).toContain('put');
  });

  it('arms autosave after a version restore on an enrolled device', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    seedOneCampaign();
    const requests: Record<string, unknown>[] = [];
    await enrollAgainstCloudGeneration(requests);

    // Enrolled but never applied, so autosave is still disarmed here.
    fireEvent.click(screen.getByRole('button', { name: 'Version history' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restore as new version' })
    );
    await screen.findByText(
      'Cloud: saved as version 3 · Player view: pending acknowledgement'
    );

    // The restore rewrote the DM store from IndexedDB, so it is a hydrating
    // path too — and it is the site Slice 11E missed on its first pass.
    const commit = vi.spyOn(
      IndexedDbCampaignSettingsRepository.prototype,
      'commit'
    );
    await act(async () => {
      useDmStore.getState().updateCampaign(CAMPAIGN_CODE, {
        customCounterLabel: 'Edited after the restore',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(commit).toHaveBeenCalled();
    expect(requests.map(request => request.action)).toContain('put');
    const saved = await readCampaignSettingsDocument();
    expect(
      (saved?.payload as CampaignSettingsPayload | undefined)
        ?.customCounterLabel
    ).toBe('Edited after the restore');
  });
});
