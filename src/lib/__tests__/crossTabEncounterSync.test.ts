// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

import { initCrossTabEncounterSync } from '@/lib/crossTabEncounterSync';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';

import type { Encounter } from '@/types/encounter';

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

function makeStore(encounters: Encounter[]) {
  const state = { encounters };
  return {
    getState: vi.fn(() => state),
    setState: vi.fn((partial: { encounters: Encounter[] }) => {
      state.encounters = partial.encounters;
    }),
  };
}

function fireStorage(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

const wrap = (encounters: Encounter[]) =>
  JSON.stringify({ state: { encounters } });

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('initCrossTabEncounterSync', () => {
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
