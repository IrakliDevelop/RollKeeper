import 'fake-indexeddb/auto';

import { act } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fingerprintNpcPayload,
  type NpcPayload,
} from '@/lib/durableDm/npcFamily';
import { writeNpcAuthorityMarker } from '@/lib/durableDm/npcLegacyAuthority';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { commitNpcLocalCutover } from '@/lib/indexeddb/npcAuthority';
import { IndexedDbNpcRepository } from '@/lib/indexeddb/npcRepository';
import * as supabaseBrowser from '@/lib/supabase/browser';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';

import { NpcSyncProvider } from './NpcSyncProvider';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const GENERATION = 'npc-generation';
const NOW = '2026-08-23T00:00:00.000Z';

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

function seedCampaign() {
  useDmStore.setState({
    campaigns: [{ code: 'SYNTH1', name: 'NPCs', createdAt: NOW }],
  });
}

function mockOwnerAccount() {
  vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue({
    accountId: ACCOUNT_ID,
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
        data: { session: { user: { id: ACCOUNT_ID } } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  } as never);
}

function npcPayload(): NpcPayload {
  return {
    name: 'Sildar Hallwinter',
    armorClass: '16',
    maxHp: 27,
    speed: '30 ft.',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function seedIndexedDbGeneration(payload: NpcPayload) {
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
    rawValue: '{"state":{"npcsByCampaign":{}},"version":4}',
  });
  await transactionComplete(transaction);
  const contentFingerprint = await fingerprintNpcPayload(payload);
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
  writeNpcAuthorityMarker(localStorage, 'SYNTH1', {
    version: 1,
    authority: 'indexedDB',
    epoch: 1,
    campaignId: CAMPAIGN_ID,
    namespace: NAMESPACE,
  });
  return contentFingerprint;
}

describe('NpcSyncProvider owner mount', () => {
  beforeEach(() => {
    seedCampaign();
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

  it('renders children and performs zero storage, IndexedDB, cookie, or network work by default', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cookieBefore = document.cookie;

    const { container } = render(
      <NpcSyncProvider campaignCode="SYNTH1">
        <p>route content</p>
      </NpcSyncProvider>
    );

    // The provider adds no DOM of its own, so the route renders unchanged.
    expect(container.innerHTML).toBe('<p>route content</p>');
    await Promise.resolve();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
  });

  it('renders children and stays inert while the campaign is unknown to the DM store', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    useDmStore.setState({ campaigns: [] });
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const workspaceFactory = vi.spyOn(
      browserDmWorkspace,
      'createBrowserDmWorkspace'
    );

    const { container } = render(
      <NpcSyncProvider campaignCode="SYNTH1">
        <p>route content</p>
      </NpcSyncProvider>
    );

    expect(container.innerHTML).toBe('<p>route content</p>');
    await Promise.resolve();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(workspaceFactory).not.toHaveBeenCalled();
  });

  it('hydrates and commits NPC store writes without the sync card being mounted', async () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    const payload = npcPayload();
    const contentFingerprint = await seedIndexedDbGeneration(payload);
    mockOwnerAccount();

    render(
      <NpcSyncProvider campaignCode="SYNTH1">
        <p>encounter route</p>
      </NpcSyncProvider>
    );

    // Hydration is the owner's job, so it happens without any card in the tree.
    await waitFor(() =>
      expect(useNPCStore.getState().npcsByCampaign.SYNTH1).toHaveLength(1)
    );

    await act(async () => {
      useNPCStore.getState().updateNPC('SYNTH1', 'npc-1', { currentHp: 3 });
    });

    // A write from any route under the campaign group reaches IndexedDB.
    await waitFor(async () => {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbNpcRepository(database);
        const documents = await repository.listDocuments(
          NAMESPACE,
          CAMPAIGN_ID
        );
        expect(documents).toHaveLength(1);
        expect(documents[0].payload?.currentHp).toBe(3);
        expect(documents[0].contentFingerprint).not.toBe(contentFingerprint);
        const outbox = await repository.listOutbox(NAMESPACE, CAMPAIGN_ID);
        expect(
          outbox.some(
            entry => entry.legacyId === 'npc-1' && entry.state === 'paused'
          )
        ).toBe(true);
      } finally {
        database.close();
      }
    });
  });
});
