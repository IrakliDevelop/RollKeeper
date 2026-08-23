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

import {
  fingerprintMagicItemPayload,
  type MagicItemPayload,
} from '@/lib/durableDm/magicItemFamily';
import * as magicItemFamily from '@/lib/durableDm/magicItemFamily';
import { writeMagicItemAuthorityMarker } from '@/lib/durableDm/magicItemLegacyAuthority';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import * as localDatabase from '@/lib/indexeddb/localDatabase';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { commitMagicItemLocalCutover } from '@/lib/indexeddb/magicItemAuthority';
import { IndexedDbMagicItemRepository } from '@/lib/indexeddb/magicItemRepository';
import * as supabaseBrowser from '@/lib/supabase/browser';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import type { CustomMagicItem } from '@/types/magicItemLibrary';

import {
  MagicItemSyncControls,
  planMagicItemMutations,
  runMagicItemMutationPlan,
} from './MagicItemSyncControls';

const NOW = '2026-08-22T00:00:00.000Z';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const GENERATION = 'magic-item-generation';

const campaign = { code: 'SYNTH1', name: 'Magic items', createdAt: 'now' };

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
  name: 'Magic items',
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

function magicItemFixture(): CustomMagicItem {
  return {
    id: 'magic-1',
    campaignCode: 'SYNTH1',
    name: 'Cloak of Elvenkind',
    category: 'wondrous',
    rarity: 'uncommon',
    description: 'A shifting grey cloak.',
    properties: [],
    requiresAttunement: true,
    isAttuned: false,
    tags: ['cloak'],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function magicItemPayload(): MagicItemPayload {
  const { id, campaignCode, ...payload } = magicItemFixture();
  void id;
  void campaignCode;
  return payload;
}

function oneItemState() {
  return { itemsByCampaign: { SYNTH1: [magicItemFixture()] } };
}

function seedOneItemEnvelope() {
  localStorage.setItem(
    'rollkeeper-dm-magic-item-library',
    JSON.stringify({ version: 1, state: oneItemState() })
  );
}

async function selectWorkspaceAndPreview() {
  render(<MagicItemSyncControls campaign={campaign} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Find owner workspaces' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: /Select Magic items/ })
  );
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
  const payload = magicItemPayload();
  const contentFingerprint = await fingerprintMagicItemPayload(payload);
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:magic_item:${CAMPAIGN_ID}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-dm-magic-item-library',
    presence: true,
    rawValue: JSON.stringify({ version: 1, state: oneItemState() }),
  });
  await transactionComplete(transaction);
  await commitMagicItemLocalCutover(database, {
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
        legacyId: 'magic-1',
        family: 'magic_item',
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
    ],
  });
  database.close();
  writeMagicItemAuthorityMarker(localStorage, campaign.code, {
    version: 1,
    authority: 'indexedDB',
    epoch: 1,
    campaignId: CAMPAIGN_ID,
    namespace: NAMESPACE,
  });
}

function magicItemFixture2(): CustomMagicItem {
  return {
    id: 'magic-2',
    campaignCode: 'SYNTH1',
    name: 'Bag of Holding',
    category: 'wondrous',
    rarity: 'uncommon',
    description: 'A bag with an interior space larger than its exterior.',
    properties: [],
    requiresAttunement: false,
    isAttuned: false,
    tags: ['bag'],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function magicItemPayload2(): MagicItemPayload {
  const { id, campaignCode, ...payload } = magicItemFixture2();
  void id;
  void campaignCode;
  return payload;
}

function twoItemState() {
  return {
    itemsByCampaign: { SYNTH1: [magicItemFixture(), magicItemFixture2()] },
  };
}

function seedTwoItemEnvelope() {
  localStorage.setItem(
    'rollkeeper-dm-magic-item-library',
    JSON.stringify({ version: 1, state: twoItemState() })
  );
}

/**
 * Same completed-local-cutover state as `seedLocalIndexedDbAuthority`, but
 * with two magic item documents, so a test can assert that editing one item
 * leaves the other's cached fingerprint alone.
 */
async function seedLocalIndexedDbAuthorityForTwoItems() {
  const payload1 = magicItemPayload();
  const payload2 = magicItemPayload2();
  const fingerprint1 = await fingerprintMagicItemPayload(payload1);
  const fingerprint2 = await fingerprintMagicItemPayload(payload2);
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:magic_item:${CAMPAIGN_ID}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-dm-magic-item-library',
    presence: true,
    rawValue: JSON.stringify({ version: 1, state: twoItemState() }),
  });
  await transactionComplete(transaction);
  await commitMagicItemLocalCutover(database, {
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
        legacyId: 'magic-1',
        family: 'magic_item',
        cutoverEpoch: 1,
        operation: 'create',
        payload: payload1,
        schemaVersion: 1,
        localRevision: 1,
        baseServerVersion: 0,
        contentFingerprint: fingerprint1,
        updatedAt: NOW,
        deletedAt: null,
      },
      {
        namespace: NAMESPACE,
        campaignId: CAMPAIGN_ID,
        legacyId: 'magic-2',
        family: 'magic_item',
        cutoverEpoch: 1,
        operation: 'create',
        payload: payload2,
        schemaVersion: 1,
        localRevision: 1,
        baseServerVersion: 0,
        contentFingerprint: fingerprint2,
        updatedAt: NOW,
        deletedAt: null,
      },
    ],
  });
  database.close();
  writeMagicItemAuthorityMarker(localStorage, campaign.code, {
    version: 1,
    authority: 'indexedDB',
    epoch: 1,
    campaignId: CAMPAIGN_ID,
    namespace: NAMESPACE,
  });
}

describe('MagicItemSyncControls gates', () => {
  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // The persisted store rewrites its envelope on every setState, so the
    // reset has to happen before the storage is cleared.
    useMagicItemLibraryStore.setState({ itemsByCampaign: {} });
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('renders nothing and performs zero storage, IndexedDB, cookie, or network work by default', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cookieBefore = document.cookie;
    const { container } = render(<MagicItemSyncControls campaign={campaign} />);
    expect(container).toBeEmptyDOMElement();
    await Promise.resolve();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
  });

  it('workspace discovery and selection do not open the magic item repository', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    seedOneItemEnvelope();
    const open = vi
      .spyOn(localDatabase, 'openRollkeeperDatabase')
      .mockRejectedValue(new Error('must not open'));
    render(<MagicItemSyncControls campaign={campaign} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Magic items/ })
    );
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
      .mockReturnValue('blob:magic-item-recovery');
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
      'magic-item-backup.json',
      { type: 'application/json' }
    );
    fireEvent.change(
      screen.getByLabelText('Downloaded magic item recovery file'),
      { target: { files: [recoveryFile] } }
    );
    await screen.findByText(/family selection was cancelled/);
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeDisabled();
    fireEvent.change(
      screen.getByLabelText('Downloaded magic item recovery file'),
      { target: { files: [recoveryFile] } }
    );
    await screen.findByText(
      'Recovery file verified and magic item library selected. LocalStorage remains authoritative.'
    );
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeEnabled();
    expect(open).not.toHaveBeenCalled();
  });

  it('blocks cutover when the legacy envelope was never persisted', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    localStorage.removeItem('rollkeeper-dm-magic-item-library');
    await selectWorkspaceAndPreview();

    expect(
      await screen.findByText(
        /incomplete-envelope: rollkeeper-dm-magic-item-library has never been persisted on this device/
      )
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Confirm local cutover' })
    ).toBeNull();
  });

  it('hydrates after a reload when the workspace was only discovered, never enrolled', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    const remembered = mockOwnerWorkspaceWithMemory();
    mockOwnerSession();
    useMagicItemLibraryStore.setState(oneItemState());
    seedOneItemEnvelope();
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:magic-item-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MagicItemSyncControls campaign={campaign} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Magic items/ })
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
            new File([await downloadedBlob.text()], 'magic-item-backup.json', {
              type: 'application/json',
            }),
          ],
        },
      }
    );
    await screen.findByText(
      'Recovery file verified and magic item library selected. LocalStorage remains authoritative.'
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
    useMagicItemLibraryStore.setState(oneItemState());
    render(<MagicItemSyncControls campaign={campaign} />);

    expect(
      await screen.findByText(
        'Magic item library loaded from the verified local IndexedDB generation.'
      )
    ).toBeVisible();
    expect(
      screen.queryByText(
        'The initialized magic item namespace has no matching owner workspace on this device.'
      )
    ).toBeNull();
    expect(remembered).toHaveLength(1);

    // …and edits keep committing instead of dying in the frozen legacy key.
    const commit = vi.spyOn(IndexedDbMagicItemRepository.prototype, 'commit');
    await act(async () => {
      useMagicItemLibraryStore.getState().updateItem(campaign.code, 'magic-1', {
        name: 'Edited after reload',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(commit).toHaveBeenCalled();
    const database = await openRollkeeperDatabase();
    try {
      const document = await new IndexedDbMagicItemRepository(
        database
      ).getDocument(NAMESPACE, 'magic-1');
      expect(document?.payload?.name).toBe('Edited after reload');
      expect(document?.localRevision).toBe(2);
    } finally {
      database.close();
    }
  });

  it('does not re-hydrate over a newer local edit on a repeated auth event', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    // The device already knows the workspace, so this case isolates the
    // re-entrancy guard from the cutover-time `remember`.
    mockOwnerWorkspaceWithMemory().push(workspace);
    const fireAuthEvent = mockOwnerSessionCapturingListener();
    await seedLocalIndexedDbAuthority();
    useMagicItemLibraryStore.setState(oneItemState());
    seedOneItemEnvelope();

    render(<MagicItemSyncControls campaign={campaign} />);
    await screen.findByText(
      'Magic item library loaded from the verified local IndexedDB generation.'
    );
    const openContext = vi.mocked(browserDmWorkspace.createBrowserDmWorkspace);
    expect(openContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      useMagicItemLibraryStore.getState().updateItem(campaign.code, 'magic-1', {
        name: 'Edited before the token refresh',
      });
      fireAuthEvent('TOKEN_REFRESHED', { user: { id: ACCOUNT_ID } });
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    // The guard returns before `createBrowserDmWorkspace()`, so this count is
    // the scheduling-independent witness that no second hydration pass ran:
    // it is 2 without the guard however the chain happened to interleave.
    expect(openContext).toHaveBeenCalledTimes(1);
    expect(
      useMagicItemLibraryStore.getState().itemsByCampaign[campaign.code]![0]!
        .name
    ).toBe('Edited before the token refresh');

    // …and the baseline survived the auth event, so the edit still committed.
    const database = await openRollkeeperDatabase();
    try {
      const document = await new IndexedDbMagicItemRepository(
        database
      ).getDocument(NAMESPACE, 'magic-1');
      expect(document?.payload?.name).toBe('Edited before the token refresh');
      expect(document?.localRevision).toBe(2);
    } finally {
      database.close();
    }
  });

  it('does not upload the local candidate after enrollment until the cloud generation is applied', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    useMagicItemLibraryStore.setState(oneItemState());
    seedOneItemEnvelope();
    const cloudPayload = { ...magicItemPayload(), name: 'Cloud item' };
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
                legacyId: 'magic-cloud',
                serverVersion: 1,
                schemaVersion: 1,
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

    render(<MagicItemSyncControls campaign={campaign} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Magic items/ })
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
    // exact cloud generation.
    const commit = vi.spyOn(IndexedDbMagicItemRepository.prototype, 'commit');
    for (const name of ['Local candidate edit', 'Local candidate edit again']) {
      await act(async () => {
        useMagicItemLibraryStore
          .getState()
          .updateItem(campaign.code, 'magic-1', { name });
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    expect(commit).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');
  });

  it('reuses a cached fingerprint for an item the store left untouched', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory().push(workspace);
    mockOwnerSession();
    await seedLocalIndexedDbAuthorityForTwoItems();
    useMagicItemLibraryStore.setState(twoItemState());
    seedTwoItemEnvelope();

    render(<MagicItemSyncControls campaign={campaign} />);
    await screen.findByText(
      'Magic item library loaded from the verified local IndexedDB generation.'
    );
    // Let the baseline-establishing autosave run (queued right after hydrate)
    // finish hashing both items before measuring, or its tail call races past
    // the spy reset below and pollutes the count.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    const fingerprint = vi.spyOn(
      magicItemFamily,
      'fingerprintMagicItemPayload'
    );
    fingerprint.mockClear();
    await act(async () => {
      useMagicItemLibraryStore.getState().updateItem(campaign.code, 'magic-1', {
        name: 'Only this one changed',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    // The untouched item (magic-2) keeps its object identity, so only the
    // edited one is re-canonicalized and re-hashed. `MagicItemPayload` omits
    // `id` (`Omit<CustomMagicItem, 'id' | 'campaignCode'>`), so `name` —
    // unique per fixture — is the identifying field available on the call
    // args.
    const hashedNames = fingerprint.mock.calls.map(call => call[0].name);
    expect(hashedNames).toEqual(['Only this one changed']);
  });
});

describe('magic item autosave planning', () => {
  it('classifies changed, added, and removed items', () => {
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

    expect(planMagicItemMutations(last, current)).toEqual({
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

    const result = await runMagicItemMutationPlan({
      plan: planMagicItemMutations(baseline, current),
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

    const result = await runMagicItemMutationPlan({
      plan: planMagicItemMutations(baseline, current),
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
