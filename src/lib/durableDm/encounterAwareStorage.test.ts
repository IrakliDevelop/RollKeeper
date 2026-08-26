import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEncounterAwareStorage } from './encounterAwareStorage';
import {
  encounterAuthorityKey,
  encounterUsesIndexedDbAuthority,
  readEncounterAuthorityMarker,
  writeEncounterAuthorityMarker,
  type EncounterAuthorityMarker,
} from './encounterLegacyAuthority';

const KEY = 'rollkeeper-encounter-data';

function marker(
  authority: EncounterAuthorityMarker['authority']
): EncounterAuthorityMarker {
  return { version: 1, authority, epoch: 4, campaignId: 'cloud-abc' };
}

function encounter(
  id: string,
  campaignCode?: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    name: `Encounter ${id}`,
    ...(campaignCode === undefined ? {} : { campaignCode }),
    entities: [],
    currentTurn: 0,
    round: 0,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function tombstone(
  id: string,
  campaignCode: string,
  deletedAt = '2026-07-05T00:00:00.000Z'
) {
  return { id, deletedAt, beforeImage: encounter(id, campaignCode) };
}

function envelope(
  encounters: unknown[],
  encounterTombstones: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
) {
  return JSON.stringify({
    state: {
      encounters,
      encounterTombstones,
      activeEncounterId: null,
      combatConfig: { enemyHpDisplay: 'exact' },
      ...extra,
    },
    version: 2,
  });
}

describe('encounter family authority marker', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reads no marker and touches no storage while the client flag is off', () => {
    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    expect(readEncounterAuthorityMarker(localStorage, 'ABC123')).toBeNull();
    expect(encounterUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('rejects malformed and partial markers', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    const key = encounterAuthorityKey('ABC123');
    const read = () => readEncounterAuthorityMarker(localStorage, 'ABC123');

    expect(read()).toBeNull();
    localStorage.setItem(key, '{bad');
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...marker('postgres'), version: 2 })
    );
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...marker('postgres'), authority: 'redis' })
    );
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...marker('postgres'), epoch: 1.5 })
    );
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ version: 1, authority: 'postgres', epoch: 4 })
    );
    expect(read()).toBeNull();
    // A marker that cannot be parsed or validated never routes the family.
    expect(encounterUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(false);
    localStorage.setItem(key, '{bad');
    expect(encounterUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(false);
  });

  it('round-trips a written marker and classifies which authorities own the family', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    expect(encounterAuthorityKey('ABC123')).toBe(
      'rollkeeper:encounter-authority:ABC123'
    );

    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    expect(readEncounterAuthorityMarker(localStorage, 'ABC123')).toEqual(
      marker('postgres')
    );
    expect(encounterUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(true);

    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('indexedDB'));
    expect(encounterUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(true);

    writeEncounterAuthorityMarker(
      localStorage,
      'ABC123',
      marker('legacy_restored')
    );
    expect(encounterUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(false);
    expect(encounterUsesIndexedDbAuthority(localStorage, 'DEF456')).toBe(false);
  });
});

describe('encounter authority-aware Zustand storage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('passes unrelated keys through to the backing store', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    const aware = createEncounterAwareStorage(localStorage);

    aware.setItem('rollkeeper-theme', 'dark');
    expect(localStorage.getItem('rollkeeper-theme')).toBe('dark');
    expect(aware.getItem('rollkeeper-theme')).toBe('dark');

    aware.removeItem('rollkeeper-theme');
    expect(localStorage.getItem('rollkeeper-theme')).toBeNull();
  });

  it('writes the envelope byte-identically when no campaign is routed', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    localStorage.setItem(KEY, envelope([encounter('enc-a', 'ABC123')]));
    const next = envelope(
      [
        encounter('enc-a', 'ABC123', { round: 3 }),
        encounter('enc-d', 'DEF456'),
      ],
      { 'enc-x': tombstone('enc-x', 'ABC123') }
    );

    createEncounterAwareStorage(localStorage).setItem(KEY, next);

    expect(localStorage.getItem(KEY)).toBe(next);
  });

  it('freezes a routed campaign and passes every other envelope field through', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    const frozen = encounter('enc-a', 'ABC123');
    localStorage.setItem(
      KEY,
      envelope([frozen, encounter('enc-d', 'DEF456'), encounter('enc-free')])
    );
    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('postgres'));

    createEncounterAwareStorage(localStorage).setItem(
      KEY,
      envelope(
        [
          encounter('enc-a', 'ABC123', { name: 'Renamed', round: 9 }),
          encounter('enc-d', 'DEF456', { round: 4 }),
          encounter('enc-free', undefined, { round: 7 }),
          encounter('enc-a2', 'ABC123'),
        ],
        {},
        {
          activeEncounterId: 'enc-d',
          combatConfig: { enemyHpDisplay: 'bands' },
          acceptanceSentinel: 'seed-11e',
        }
      )
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    // Entries follow the previous envelope's own order — the routed campaign
    // is replaced by the previous envelope's entry in place and gains
    // nothing new; unrouted entries keep next's values (Slice 11G task 1).
    expect(persisted.state.encounters).toEqual([
      frozen,
      encounter('enc-d', 'DEF456', { round: 4 }),
      encounter('enc-free', undefined, { round: 7 }),
    ]);
    expect(persisted.state.activeEncounterId).toBe('enc-d');
    expect(persisted.state.combatConfig).toEqual({ enemyHpDisplay: 'bands' });
    expect(persisted.state.acceptanceSentinel).toBe('seed-11e');
    expect(persisted.version).toBe(2);
  });

  it('drops routed encounters written before the legacy key ever existed', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('indexedDB'));

    createEncounterAwareStorage(localStorage).setItem(
      KEY,
      envelope([encounter('enc-a', 'ABC123'), encounter('enc-d', 'DEF456')])
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(persisted.state.encounters).toEqual([encounter('enc-d', 'DEF456')]);
  });

  it('writes the first envelope byte-identically when no campaign is routed', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const next = envelope([encounter('enc-d', 'DEF456')]);

    createEncounterAwareStorage(localStorage).setItem(KEY, next);

    expect(localStorage.getItem(KEY)).toBe(next);
  });

  it('never introduces a tombstone map on an envelope that carries none', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    const frozen = encounter('enc-a', 'ABC123');
    localStorage.setItem(
      KEY,
      JSON.stringify({
        state: { encounters: [frozen], activeEncounterId: null },
        version: 2,
      })
    );
    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('postgres'));

    createEncounterAwareStorage(localStorage).setItem(
      KEY,
      JSON.stringify({
        state: {
          encounters: [
            encounter('enc-a', 'ABC123', { round: 3 }),
            encounter('enc-d', 'DEF456'),
          ],
          activeEncounterId: 'enc-d',
        },
        version: 2,
      })
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect('encounterTombstones' in persisted.state).toBe(false);
    // Order follows the previous envelope (`enc-a` first), not an
    // unrouted-then-routed rebuild (Slice 11G task 1).
    expect(persisted.state.encounters).toEqual([
      frozen,
      encounter('enc-d', 'DEF456'),
    ]);
    expect(persisted.state.activeEncounterId).toBe('enc-d');
  });

  it('freezes routed tombstones and drops routed tombstones absent from the previous envelope', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    const frozenTombstone = tombstone('enc-gone', 'ABC123');
    localStorage.setItem(KEY, envelope([], { 'enc-gone': frozenTombstone }));
    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('postgres'));

    createEncounterAwareStorage(localStorage).setItem(
      KEY,
      envelope([], {
        'enc-gone': tombstone('enc-gone', 'ABC123', '2026-07-09T00:00:00.000Z'),
        'enc-new': tombstone('enc-new', 'ABC123'),
        'enc-other': tombstone('enc-other', 'DEF456'),
      })
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    // Order follows the previous envelope (`enc-gone` first), not an
    // unrouted-then-routed rebuild (Slice 11G task 1).
    expect(Object.keys(persisted.state.encounterTombstones)).toEqual([
      'enc-gone',
      'enc-other',
    ]);
    expect(persisted.state.encounterTombstones['enc-gone']).toEqual(
      frozenTombstone
    );
  });

  it('is a fixpoint — re-writing a routed envelope changes nothing', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    localStorage.setItem(
      KEY,
      envelope([encounter('enc-a', 'ABC123'), encounter('enc-d', 'DEF456')], {
        'enc-gone': tombstone('enc-gone', 'ABC123'),
      })
    );
    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const aware = createEncounterAwareStorage(localStorage);

    aware.setItem(
      KEY,
      envelope(
        [
          encounter('enc-a', 'ABC123', { round: 2 }),
          encounter('enc-d', 'DEF456'),
        ],
        { 'enc-gone': tombstone('enc-gone', 'ABC123') }
      )
    );
    const routedRaw = localStorage.getItem(KEY)!;

    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    aware.setItem(KEY, routedRaw);

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(routedRaw);
  });

  it('writes the next envelope as-is when the previous value cannot be routed', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const aware = createEncounterAwareStorage(localStorage);
    const next = envelope([encounter('enc-a', 'ABC123')]);

    localStorage.setItem(KEY, '{bad');
    aware.setItem(KEY, next);
    expect(localStorage.getItem(KEY)).toBe(next);

    localStorage.setItem(KEY, JSON.stringify({ state: {}, version: 2 }));
    aware.setItem(KEY, next);
    expect(localStorage.getItem(KEY)).toBe(next);

    localStorage.setItem(KEY, next);
    const malformedNext = JSON.stringify({ state: { encounters: {} } });
    aware.setItem(KEY, malformedNext);
    expect(localStorage.getItem(KEY)).toBe(malformedNext);
  });

  it('writes the next envelope without reading storage while the flag is off', () => {
    const aware = createEncounterAwareStorage(localStorage);
    writeEncounterAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    localStorage.setItem(KEY, envelope([encounter('enc-a', 'ABC123')]));
    const next = envelope([encounter('enc-a', 'ABC123', { round: 5 })]);
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    aware.setItem(KEY, next);

    // Default-off must not pay for a read and a parse on every store write.
    expect(getItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(next);
  });
});
