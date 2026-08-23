import 'fake-indexeddb/auto';

import { act } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fingerprintEncounterPayload,
  type EncounterPayload,
} from '@/lib/durableDm/encounterFamily';
import { writeEncounterAuthorityMarker } from '@/lib/durableDm/encounterLegacyAuthority';
import { commitEncounterLocalCutover } from '@/lib/indexeddb/encounterAuthority';
import { IndexedDbEncounterRepository } from '@/lib/indexeddb/encounterRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import * as supabaseBrowser from '@/lib/supabase/browser';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import { useDmStore } from '@/store/dmStore';
import { useEncounterStore } from '@/store/encounterStore';
import type { Encounter } from '@/types/encounter';

import { EncounterSyncProvider } from './EncounterSyncProvider';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const GENERATION = 'encounter-generation';
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

const otherCampaignEncounter: Encounter = {
  id: 'enc-other',
  name: 'Other campaign',
  campaignCode: 'OTHER1',
  entities: [],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'manual',
  createdAt: NOW,
  updatedAt: NOW,
};

function seedCampaign() {
  useDmStore.setState({
    campaigns: [{ code: 'SYNTH1', name: 'Encounters', createdAt: NOW }],
  });
}

let authListener:
  | ((event: string, session: { user: { id: string } } | null) => void)
  | undefined;

function mockOwnerAccount() {
  authListener = undefined;
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
      onAuthStateChange: vi.fn().mockImplementation(callback => {
        authListener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  } as never);
}

function encounterPayload(): EncounterPayload {
  return {
    name: 'Goblin Ambush',
    entities: [],
    currentTurn: 0,
    round: 1,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/**
 * Ruling 1b: `isActive` blocks cutover only. This payload is mid-combat — a
 * non-zero round and a `currentTurn` pointing at a real entity — so autosave
 * has to keep committing runtime edits exactly as it does for an idle
 * encounter; the legacy key is frozen for a routed campaign, so a skipped or
 * deferred mutation would lose the runtime state outright.
 */
function activeEncounterPayload(): EncounterPayload {
  return {
    name: 'Goblin Ambush',
    entities: [
      {
        id: 'ent-1',
        type: 'monster',
        name: 'Goblin',
        initiative: 14,
        initiativeModifier: 2,
        currentHp: 7,
        maxHp: 7,
        tempHp: 0,
        armorClass: 15,
        conditions: [],
      },
    ],
    currentTurn: 0,
    round: 3,
    isActive: true,
    sortOrder: 'initiative',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function seedIndexedDbGeneration(payload: EncounterPayload) {
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
  const contentFingerprint = await fingerprintEncounterPayload(payload);
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
  database.close();
  writeEncounterAuthorityMarker(localStorage, 'SYNTH1', {
    version: 1,
    authority: 'indexedDB',
    epoch: 1,
    campaignId: CAMPAIGN_ID,
    namespace: NAMESPACE,
  });
  return contentFingerprint;
}

describe('EncounterSyncProvider owner mount', () => {
  beforeEach(() => {
    seedCampaign();
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

  it('renders children and performs zero storage, IndexedDB, cookie, or network work by default', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cookieBefore = document.cookie;

    const { container } = render(
      <EncounterSyncProvider campaignCode="SYNTH1">
        <p>route content</p>
      </EncounterSyncProvider>
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
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    useDmStore.setState({ campaigns: [] });
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const workspaceFactory = vi.spyOn(
      browserDmWorkspace,
      'createBrowserDmWorkspace'
    );

    const { container } = render(
      <EncounterSyncProvider campaignCode="SYNTH1">
        <p>route content</p>
      </EncounterSyncProvider>
    );

    expect(container.innerHTML).toBe('<p>route content</p>');
    await Promise.resolve();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(workspaceFactory).not.toHaveBeenCalled();
  });

  it('hydrates without touching other campaigns or the excluded envelope fields', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    await seedIndexedDbGeneration(encounterPayload());
    mockOwnerAccount();
    useEncounterStore.setState({
      encounters: [otherCampaignEncounter],
      activeEncounterId: 'enc-other',
    });

    render(
      <EncounterSyncProvider campaignCode="SYNTH1">
        <p>encounter route</p>
      </EncounterSyncProvider>
    );

    await waitFor(() =>
      expect(
        useEncounterStore
          .getState()
          .encounters.filter(item => item.campaignCode === 'SYNTH1')
      ).toHaveLength(1)
    );
    const state = useEncounterStore.getState();
    // Ruling 2/3: unrelated campaigns and the excluded envelope fields are
    // never rewritten by hydration.
    expect(state.encounters).toContainEqual(otherCampaignEncounter);
    expect(state.activeEncounterId).toBe('enc-other');
    expect(state.combatConfig).toBeDefined();
  });

  it('commits an encounter edit and a delete from any route in the group', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    const contentFingerprint =
      await seedIndexedDbGeneration(encounterPayload());
    mockOwnerAccount();

    render(
      <EncounterSyncProvider campaignCode="SYNTH1">
        <p>encounter route</p>
      </EncounterSyncProvider>
    );

    // Hydration is the owner's job, so it happens without any card in the tree.
    await waitFor(() =>
      expect(useEncounterStore.getState().encounters).toHaveLength(1)
    );

    await act(async () => {
      useEncounterStore
        .getState()
        .updateEncounter('enc-1', { name: 'Goblin Ambush II' });
    });

    // A write from any route under the campaign group reaches IndexedDB.
    await waitFor(async () => {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbEncounterRepository(database);
        const document = await repository.getDocument(NAMESPACE, 'enc-1');
        expect(document?.payload?.name).toBe('Goblin Ambush II');
        expect(document?.contentFingerprint).not.toBe(contentFingerprint);
      } finally {
        database.close();
      }
    });

    await act(async () => {
      useEncounterStore.getState().deleteEncounter('enc-1');
    });

    // The tombstone diff turns the removal into an explicit delete mutation
    // instead of silently dropping the document.
    await waitFor(async () => {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbEncounterRepository(database);
        const document = await repository.getDocument(NAMESPACE, 'enc-1');
        expect(document?.operation).toBe('delete');
        expect(document?.payload).toBeNull();
        const outbox = await repository.listOutbox(NAMESPACE, CAMPAIGN_ID);
        expect(
          outbox.some(
            entry => entry.operation === 'delete' && entry.state === 'paused'
          )
        ).toBe(true);
      } finally {
        database.close();
      }
    });
  });

  it('commits a runtime edit while combat is active', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    const contentFingerprint = await seedIndexedDbGeneration(
      activeEncounterPayload()
    );
    mockOwnerAccount();

    render(
      <EncounterSyncProvider campaignCode="SYNTH1">
        <p>encounter route</p>
      </EncounterSyncProvider>
    );

    await waitFor(() =>
      expect(useEncounterStore.getState().encounters).toHaveLength(1)
    );
    const hydrated = useEncounterStore.getState().encounters[0];
    expect(hydrated.isActive).toBe(true);
    expect(hydrated.round).toBe(3);
    expect(hydrated.entities[hydrated.currentTurn].id).toBe('ent-1');

    await act(async () => {
      useEncounterStore
        .getState()
        .updateEntity('enc-1', 'ent-1', { currentHp: 2 });
    });

    // Identical to the inactive case: same replace operation, the payload keeps
    // `isActive: true`, and the outbox entry lands in the same state.
    await waitFor(async () => {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbEncounterRepository(database);
        const document = await repository.getDocument(NAMESPACE, 'enc-1');
        expect(document?.operation).toBe('replace');
        expect(document?.payload?.isActive).toBe(true);
        expect(document?.payload?.round).toBe(3);
        expect(document?.payload?.entities[0].currentHp).toBe(2);
        expect(document?.contentFingerprint).not.toBe(contentFingerprint);
        const outbox = await repository.listOutbox(NAMESPACE, CAMPAIGN_ID);
        expect(
          outbox.some(
            entry => entry.operation === 'replace' && entry.state === 'paused'
          )
        ).toBe(true);
      } finally {
        database.close();
      }
    });
  });

  it('keeps an in-flight edit when a Supabase token refresh fires mid-run', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    await seedIndexedDbGeneration(encounterPayload());
    mockOwnerAccount();

    render(
      <EncounterSyncProvider campaignCode="SYNTH1">
        <p>encounter route</p>
      </EncounterSyncProvider>
    );

    await waitFor(() =>
      expect(useEncounterStore.getState().encounters).toHaveLength(1)
    );
    expect(authListener).toBeDefined();

    // Hold the autosave commit open so the refresh lands while the run has
    // already captured its fingerprints but has not yet committed.
    const commit = IndexedDbEncounterRepository.prototype.commit;
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    vi.spyOn(
      IndexedDbEncounterRepository.prototype,
      'commit'
    ).mockImplementation(async function (
      this: IndexedDbEncounterRepository,
      mutation
    ) {
      await gate;
      return commit.call(this, mutation);
    });

    await act(async () => {
      useEncounterStore
        .getState()
        .updateEncounter('enc-1', { name: 'Reinforcements arrive' });
    });

    // auth-js emits this hourly, and whenever a hidden tab's token expired.
    await act(async () => {
      authListener!('TOKEN_REFRESHED', { user: { id: ACCOUNT_ID } });
      await Promise.resolve();
    });

    await act(async () => {
      release();
      await Promise.resolve();
    });

    // The refresh must not revert the store to the pre-edit generation, and
    // must not rewrite the baseline out from under the in-flight run.
    await waitFor(async () => {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbEncounterRepository(database);
        const document = await repository.getDocument(NAMESPACE, 'enc-1');
        expect(document?.payload?.name).toBe('Reinforcements arrive');
      } finally {
        database.close();
      }
    });
    expect(useEncounterStore.getState().encounters[0].name).toBe(
      'Reinforcements arrive'
    );
  });

  it('does not re-fingerprint this campaign when another campaign is edited', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    await seedIndexedDbGeneration(encounterPayload());
    mockOwnerAccount();

    render(
      <EncounterSyncProvider campaignCode="SYNTH1">
        <p>encounter route</p>
      </EncounterSyncProvider>
    );

    await waitFor(() =>
      expect(useEncounterStore.getState().encounters).toHaveLength(1)
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    const digest = vi.spyOn(crypto.subtle, 'digest');
    await act(async () => {
      useEncounterStore.setState(state => ({
        encounters: [...state.encounters, otherCampaignEncounter],
      }));
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // An unrelated campaign's edit changes the global array identity; this
    // campaign's untouched records must not be canonicalized and hashed again.
    expect(digest).not.toHaveBeenCalled();

    // Positive control: a real edit to this campaign still hashes.
    await act(async () => {
      useEncounterStore
        .getState()
        .updateEncounter('enc-1', { name: 'Second wave' });
    });
    await waitFor(async () => {
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbEncounterRepository(database);
        const document = await repository.getDocument(NAMESPACE, 'enc-1');
        expect(document?.payload?.name).toBe('Second wave');
      } finally {
        database.close();
      }
    });
    expect(digest).toHaveBeenCalled();
  });
});
