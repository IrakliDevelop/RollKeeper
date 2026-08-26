// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

import { initCrossTabEncounterSync } from '@/lib/crossTabEncounterSync';
import { writeEncounterAuthorityMarker } from '@/lib/durableDm/encounterLegacyAuthority';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';

import type { Encounter } from '@/types/encounter';
import type { EncounterDeletionTombstone } from '@/store/encounterStore';

function makeEncounter(overrides: Partial<Encounter>): Encounter {
  return {
    id: 'enc-1',
    name: 'Goblin Ambush',
    entities: [],
    currentTurn: 0,
    round: 1,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Encounter;
}

function makeStore(
  encounters: Encounter[],
  encounterTombstones: Record<string, EncounterDeletionTombstone> = {}
) {
  const state = { encounters, encounterTombstones };
  return {
    getState: vi.fn(() => state),
    setState: vi.fn(
      (partial: {
        encounters: Encounter[];
        encounterTombstones: Record<string, EncounterDeletionTombstone>;
      }) => {
        state.encounters = partial.encounters;
        state.encounterTombstones = partial.encounterTombstones;
      }
    ),
  };
}

function fireStorage(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

const wrap = (
  encounters: Encounter[],
  encounterTombstones: Record<string, EncounterDeletionTombstone> = {}
) => JSON.stringify({ state: { encounters, encounterTombstones } });

function routeCampaign(code: string) {
  writeEncounterAuthorityMarker(localStorage, code, {
    version: 1,
    authority: 'postgres',
    epoch: 4,
    campaignId: `cloud-${code}`,
  });
}

function tombstoneOf(encounter: Encounter): EncounterDeletionTombstone {
  return {
    id: encounter.id,
    deletedAt: '2026-07-09T00:00:00.000Z',
    beforeImage: encounter,
  };
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('initCrossTabEncounterSync', () => {
  it('does not resurrect a locally tombstoned encounter from a stale tab', () => {
    const deleted = makeEncounter({ id: 'enc-deleted' });
    const store = makeStore([], {
      'enc-deleted': {
        id: 'enc-deleted',
        deletedAt: '2026-07-03T00:00:00.000Z',
        beforeImage: deleted,
      },
    });
    cleanup = initCrossTabEncounterSync(
      store as unknown as Parameters<typeof initCrossTabEncounterSync>[0]
    );

    fireStorage(ENCOUNTER_STORAGE_KEY, wrap([deleted]));

    expect(store.getState().encounters).toEqual([]);
  });

  it('adopts an incoming encounter with a strictly newer updatedAt', () => {
    const local = makeEncounter({ updatedAt: '2026-07-01T00:00:00.000Z' });
    const incoming = makeEncounter({
      updatedAt: '2026-07-02T00:00:00.000Z',
      isActive: true,
    });
    const store = makeStore([local]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(ENCOUNTER_STORAGE_KEY, wrap([incoming]));

    expect(store.setState).toHaveBeenCalledTimes(1);
    expect(store.getState().encounters[0].isActive).toBe(true);
  });

  it('keeps local when incoming updatedAt is older', () => {
    const local = makeEncounter({ updatedAt: '2026-07-02T00:00:00.000Z' });
    const incoming = makeEncounter({
      updatedAt: '2026-07-01T00:00:00.000Z',
      isActive: true,
    });
    const store = makeStore([local]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(ENCOUNTER_STORAGE_KEY, wrap([incoming]));

    expect(store.setState).not.toHaveBeenCalled();
  });

  it('equal updatedAt is a no-op — the echo event terminates', () => {
    const local = makeEncounter({});
    const store = makeStore([local]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(ENCOUNTER_STORAGE_KEY, wrap([makeEncounter({})]));

    expect(store.setState).not.toHaveBeenCalled();
  });

  it('adopts encounters with unknown ids (created in another tab)', () => {
    const store = makeStore([makeEncounter({ id: 'enc-1' })]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(
      ENCOUNTER_STORAGE_KEY,
      wrap([makeEncounter({ id: 'enc-1' }), makeEncounter({ id: 'enc-2' })])
    );

    expect(store.setState).toHaveBeenCalledTimes(1);
    expect(store.getState().encounters.map(e => e.id)).toEqual([
      'enc-1',
      'enc-2',
    ]);
  });

  it('keeps local-only encounters missing from the incoming state', () => {
    const store = makeStore([
      makeEncounter({ id: 'enc-1' }),
      makeEncounter({ id: 'enc-local' }),
    ]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(
      ENCOUNTER_STORAGE_KEY,
      wrap([
        makeEncounter({ id: 'enc-1', updatedAt: '2026-07-02T00:00:00.000Z' }),
      ])
    );

    expect(store.getState().encounters.map(e => e.id)).toEqual([
      'enc-1',
      'enc-local',
    ]);
  });

  it('ignores other storage keys', () => {
    const store = makeStore([makeEncounter({})]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage('some-other-key', wrap([makeEncounter({ isActive: true })]));

    expect(store.setState).not.toHaveBeenCalled();
  });

  it('ignores malformed JSON and null newValue', () => {
    const store = makeStore([makeEncounter({})]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(ENCOUNTER_STORAGE_KEY, '{not json');
    fireStorage(ENCOUNTER_STORAGE_KEY, null);
    fireStorage(ENCOUNTER_STORAGE_KEY, JSON.stringify({ state: {} }));

    expect(store.setState).not.toHaveBeenCalled();
  });

  it('cleanup removes the listener', () => {
    const store = makeStore([makeEncounter({})]);
    const dispose = initCrossTabEncounterSync(store);
    dispose();

    fireStorage(
      ENCOUNTER_STORAGE_KEY,
      wrap([makeEncounter({ updatedAt: '2027-01-01T00:00:00.000Z' })])
    );

    expect(store.setState).not.toHaveBeenCalled();
  });
});

describe('initCrossTabEncounterSync routed-campaign guard', () => {
  it('reads no authority marker while the client flag is off', () => {
    const local = makeEncounter({
      campaignCode: 'ABC123',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    routeCampaign('ABC123');
    const store = makeStore([local]);
    cleanup = initCrossTabEncounterSync(store);
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    fireStorage(
      ENCOUNTER_STORAGE_KEY,
      wrap([
        makeEncounter({
          campaignCode: 'ABC123',
          updatedAt: '2026-07-02T00:00:00.000Z',
          isActive: true,
        }),
      ])
    );

    // Default-off is byte-identical to the pre-11E merge: no marker lookups.
    expect(getItem).not.toHaveBeenCalled();
    expect(store.setState).toHaveBeenCalledTimes(1);
    expect(store.getState().encounters[0].isActive).toBe(true);
  });

  it('never overwrites a routed encounter with a newer legacy copy', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    routeCampaign('ABC123');
    const local = makeEncounter({
      campaignCode: 'ABC123',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    const store = makeStore([local]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(
      ENCOUNTER_STORAGE_KEY,
      wrap([
        makeEncounter({
          campaignCode: 'ABC123',
          updatedAt: '2026-07-02T00:00:00.000Z',
          isActive: true,
        }),
        makeEncounter({ id: 'enc-new', campaignCode: 'ABC123' }),
      ])
    );

    expect(store.setState).not.toHaveBeenCalled();
    expect(store.getState().encounters).toEqual([local]);
  });

  it('never deletes a routed encounter through an incoming tombstone', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    routeCampaign('ABC123');
    const local = makeEncounter({ campaignCode: 'ABC123' });
    const store = makeStore([local]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(
      ENCOUNTER_STORAGE_KEY,
      wrap([], { [local.id]: tombstoneOf(local) })
    );

    expect(store.setState).not.toHaveBeenCalled();
    expect(store.getState().encounters).toEqual([local]);
    expect(store.getState().encounterTombstones).toEqual({});
  });

  it('keeps a routed encounter alive against a pre-existing local tombstone', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    routeCampaign('ABC123');
    const routedLocal = makeEncounter({
      id: 'enc-routed',
      campaignCode: 'ABC123',
    });
    // A legacy tab deleted this encounter before the campaign was routed, so
    // the tombstone is already in local state; the cloud family owns the
    // encounter now and the merge must never drop it.
    const store = makeStore([routedLocal], {
      [routedLocal.id]: tombstoneOf(routedLocal),
    });
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(
      ENCOUNTER_STORAGE_KEY,
      wrap([makeEncounter({ id: 'enc-legacy', campaignCode: 'DEF456' })])
    );

    expect(store.setState).toHaveBeenCalledTimes(1);
    expect(store.getState().encounters.map(e => e.id)).toEqual([
      'enc-routed',
      'enc-legacy',
    ]);
  });

  it('still merges, adopts and tombstones campaigns that stayed on legacy', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    routeCampaign('ABC123');
    const routed = makeEncounter({
      id: 'enc-routed',
      campaignCode: 'ABC123',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    const legacy = makeEncounter({
      id: 'enc-legacy',
      campaignCode: 'DEF456',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    const doomed = makeEncounter({ id: 'enc-doomed', campaignCode: 'DEF456' });
    const store = makeStore([routed, legacy, doomed]);
    cleanup = initCrossTabEncounterSync(store);

    fireStorage(
      ENCOUNTER_STORAGE_KEY,
      wrap(
        [
          makeEncounter({
            id: 'enc-routed',
            campaignCode: 'ABC123',
            updatedAt: '2026-07-09T00:00:00.000Z',
            isActive: true,
          }),
          makeEncounter({
            id: 'enc-legacy',
            campaignCode: 'DEF456',
            updatedAt: '2026-07-09T00:00:00.000Z',
            isActive: true,
          }),
          makeEncounter({ id: 'enc-adopted', campaignCode: 'DEF456' }),
        ],
        { 'enc-doomed': tombstoneOf(doomed) }
      )
    );

    const state = store.getState();
    expect(state.encounters.map(e => e.id)).toEqual([
      'enc-routed',
      'enc-legacy',
      'enc-adopted',
    ]);
    expect(state.encounters[0].isActive).toBe(false);
    expect(state.encounters[1].isActive).toBe(true);
    expect(Object.keys(state.encounterTombstones)).toEqual(['enc-doomed']);
  });
});
