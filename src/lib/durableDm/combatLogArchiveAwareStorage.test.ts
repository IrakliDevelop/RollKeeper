import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCombatLogArchiveAwareStorage } from './combatLogArchiveAwareStorage';
import {
  writeCombatLogArchiveAuthorityMarker,
  type CombatLogArchiveAuthorityMarker,
} from './combatLogArchiveLegacyAuthority';

const KEY = 'rollkeeper-combat-log';

function marker(
  campaignCode: string,
  authority: CombatLogArchiveAuthorityMarker['authority']
): CombatLogArchiveAuthorityMarker {
  return {
    version: 1,
    campaignCode,
    authority,
    epoch: 4,
    accountId: 'acct-11f',
    campaignId: 'cloud-abc',
  };
}

function route(
  campaignCode: string,
  authority: CombatLogArchiveAuthorityMarker['authority'] = 'postgres'
) {
  writeCombatLogArchiveAuthorityMarker(
    localStorage,
    marker(campaignCode, authority)
  );
}

/** A persisted `CombatLogState` — the value side of the `encounters` record. */
function archive(
  encounterId: string,
  campaignCode?: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    encounterId,
    ...(campaignCode === undefined ? {} : { campaignCode }),
    events: [],
    startedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function tombstone(
  archiveId: string,
  campaignCode: string,
  deletedAt = '2026-07-05T00:00:00.000Z'
) {
  return {
    legacyId: archiveId,
    beforeImage: archive(`enc-${archiveId}`, campaignCode),
    deletedAt,
  };
}

function envelope(
  encounters: Record<string, unknown>,
  combatLogTombstones: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
) {
  return JSON.stringify({
    state: {
      encounters,
      combatLogTombstones,
      activeArchiveId: null,
      ...extra,
    },
    version: 2,
  });
}

describe('combat log archive authority-aware Zustand storage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // Case 1
  it('writes the next envelope without reading storage while the flag is off', () => {
    const aware = createCombatLogArchiveAwareStorage(localStorage);
    route('ABC123');
    localStorage.setItem(
      KEY,
      envelope({ 'arc-a': archive('enc-1', 'ABC123') })
    );
    const next = envelope({
      'arc-a': archive('enc-1', 'ABC123', {
        endedAt: '2026-07-02T00:00:00.000Z',
      }),
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    aware.setItem(KEY, next);

    // Default-off must not pay for a read and a parse on every store write.
    expect(getItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(next);
  });

  // Case 2
  it('writes the envelope byte-identically when no campaign is routed', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    route('ABC123', 'localStorage');
    localStorage.setItem(
      KEY,
      envelope({ 'arc-a': archive('enc-1', 'ABC123') })
    );
    const next = envelope(
      {
        'arc-a': archive('enc-1', 'ABC123', {
          endedAt: '2026-07-02T00:00:00.000Z',
        }),
        'arc-d': archive('enc-9', 'DEF456'),
      },
      { 'arc-gone': tombstone('arc-gone', 'ABC123') }
    );

    createCombatLogArchiveAwareStorage(localStorage).setItem(KEY, next);

    expect(localStorage.getItem(KEY)).toBe(next);
  });

  // Case 3
  it('freezes a routed campaign and takes an unrouted campaign from the next envelope', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    const frozen = archive('enc-1', 'ABC123');
    const frozenTombstone = tombstone('arc-gone', 'ABC123');
    localStorage.setItem(
      KEY,
      envelope(
        { 'arc-a': frozen, 'arc-d': archive('enc-9', 'DEF456') },
        {
          'arc-gone': frozenTombstone,
          'arc-other': tombstone('arc-other', 'DEF456'),
        }
      )
    );
    route('ABC123');

    createCombatLogArchiveAwareStorage(localStorage).setItem(
      KEY,
      envelope(
        {
          'arc-a': archive('enc-1', 'ABC123', {
            endedAt: '2026-07-08T00:00:00.000Z',
          }),
          'arc-a2': archive('enc-2', 'ABC123'),
          'arc-d': archive('enc-9', 'DEF456', {
            endedAt: '2026-07-08T00:00:00.000Z',
          }),
        },
        {
          'arc-gone': tombstone(
            'arc-gone',
            'ABC123',
            '2026-07-09T00:00:00.000Z'
          ),
          'arc-new': tombstone('arc-new', 'ABC123'),
          'arc-other': tombstone('arc-other', 'DEF456'),
          'arc-other-2': tombstone('arc-other-2', 'DEF456'),
        }
      )
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    // The routed campaign keeps the previous envelope's archives verbatim and
    // gains nothing new; the unrouted campaign keeps the next envelope's.
    expect(persisted.state.encounters).toEqual({
      'arc-d': archive('enc-9', 'DEF456', {
        endedAt: '2026-07-08T00:00:00.000Z',
      }),
      'arc-a': frozen,
    });
    // Key order follows the previous envelope's own order (`arc-a`, `arc-d`),
    // not an unrouted-then-routed rebuild — otherwise re-persisting an
    // unchanged envelope would still change its byte order (Slice 11G task 1).
    expect(Object.keys(persisted.state.encounters)).toEqual(['arc-a', 'arc-d']);
    expect(persisted.state.combatLogTombstones).toEqual({
      'arc-other': tombstone('arc-other', 'DEF456'),
      'arc-other-2': tombstone('arc-other-2', 'DEF456'),
      'arc-gone': frozenTombstone,
    });
    expect(persisted.version).toBe(2);
  });

  // Case 4
  it('passes an archive with no campaign through from the next envelope', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    localStorage.setItem(
      KEY,
      envelope({
        'arc-a': archive('enc-1', 'ABC123'),
        'arc-free': archive('enc-free'),
      })
    );
    route('ABC123');
    const unscoped = archive('enc-free', undefined, {
      endedAt: '2026-07-08T00:00:00.000Z',
      events: [{ id: 'evt-1', type: 'round_start' }],
    });

    createCombatLogArchiveAwareStorage(localStorage).setItem(
      KEY,
      envelope({
        'arc-a': archive('enc-1', 'ABC123', { events: [{ id: 'evt-9' }] }),
        'arc-free': unscoped,
      })
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    // Ruling 1: no `campaignCode` means unrouted — never frozen.
    expect(persisted.state.encounters['arc-free']).toEqual(unscoped);
    expect(persisted.state.encounters['arc-a']).toEqual(
      archive('enc-1', 'ABC123')
    );
  });

  // Case 5
  it('takes the device-local activeArchiveId from the next envelope even when a campaign is routed', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    localStorage.setItem(
      KEY,
      envelope(
        {
          'arc-a': archive('enc-1', 'ABC123'),
          'arc-d': archive('enc-9', 'DEF456'),
        },
        {},
        { activeArchiveId: 'arc-a' }
      )
    );
    route('ABC123');

    createCombatLogArchiveAwareStorage(localStorage).setItem(
      KEY,
      envelope(
        {
          'arc-a': archive('enc-1', 'ABC123'),
          'arc-d': archive('enc-9', 'DEF456'),
        },
        {},
        { activeArchiveId: 'arc-d', acceptanceSentinel: 'seed-11f' }
      )
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    // Ruling 9: `activeArchiveId` is device-local, so it is never frozen.
    expect(persisted.state.activeArchiveId).toBe('arc-d');
    expect(persisted.state.acceptanceSentinel).toBe('seed-11f');
    expect('lastAdmissionError' in persisted.state).toBe(false);
  });

  // Case 6
  it('drops routed archives written before the legacy key ever existed', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    route('ABC123', 'indexedDB');

    createCombatLogArchiveAwareStorage(localStorage).setItem(
      KEY,
      envelope(
        {
          'arc-a': archive('enc-1', 'ABC123'),
          'arc-d': archive('enc-9', 'DEF456'),
        },
        { 'arc-gone': tombstone('arc-gone', 'ABC123') }
      )
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    // A freshly enrolled device must not leak cloud-hydrated archives into
    // legacy storage on its first write.
    expect(persisted.state.encounters).toEqual({
      'arc-d': archive('enc-9', 'DEF456'),
    });
    expect(persisted.state.combatLogTombstones).toEqual({});
  });

  // Case 7
  it('is a fixpoint — re-writing a routed envelope reproduces the very same bytes', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    localStorage.setItem(
      KEY,
      envelope(
        {
          'arc-a': archive('enc-1', 'ABC123'),
          'arc-d': archive('enc-9', 'DEF456'),
          'arc-b': archive('enc-3', 'ABC123'),
        },
        {
          'arc-gone': tombstone('arc-gone', 'ABC123'),
          'arc-other': tombstone('arc-other', 'DEF456'),
        }
      )
    );
    route('ABC123');
    const aware = createCombatLogArchiveAwareStorage(localStorage);

    aware.setItem(
      KEY,
      envelope(
        {
          'arc-a': archive('enc-1', 'ABC123', {
            endedAt: '2026-07-08T00:00:00.000Z',
          }),
          'arc-d': archive('enc-9', 'DEF456'),
          'arc-b': archive('enc-3', 'ABC123'),
        },
        {
          'arc-gone': tombstone('arc-gone', 'ABC123'),
          'arc-other': tombstone('arc-other', 'DEF456'),
        }
      )
    );
    const routedRaw = localStorage.getItem(KEY)!;
    // The reconstruction preserves the previous envelope's own key order —
    // it must not move routed keys to the tail (Slice 11G task 1).
    expect(Object.keys(JSON.parse(routedRaw).state.encounters)).toEqual([
      'arc-a',
      'arc-d',
      'arc-b',
    ]);

    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    aware.setItem(KEY, routedRaw);

    expect(setItem).not.toHaveBeenCalled();
    // A byte comparison, not a structural one: the key order must be stable.
    expect(localStorage.getItem(KEY)).toBe(routedRaw);
  });

  // Case 8
  it('writes the next envelope as-is when either envelope is malformed', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    route('ABC123');
    const aware = createCombatLogArchiveAwareStorage(localStorage);
    const next = envelope({ 'arc-a': archive('enc-1', 'ABC123') });

    localStorage.setItem(KEY, '{bad');
    aware.setItem(KEY, next);
    expect(localStorage.getItem(KEY)).toBe(next);

    localStorage.setItem(KEY, JSON.stringify({ state: {}, version: 2 }));
    aware.setItem(KEY, next);
    expect(localStorage.getItem(KEY)).toBe(next);

    localStorage.setItem(KEY, next);
    const malformedNext = JSON.stringify({ state: { encounters: [] } });
    aware.setItem(KEY, malformedNext);
    expect(localStorage.getItem(KEY)).toBe(malformedNext);
  });

  it('passes unrelated keys through to the backing store', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    const aware = createCombatLogArchiveAwareStorage(localStorage);

    aware.setItem('rollkeeper-theme', 'dark');
    expect(localStorage.getItem('rollkeeper-theme')).toBe('dark');
    expect(aware.getItem('rollkeeper-theme')).toBe('dark');

    aware.removeItem('rollkeeper-theme');
    expect(localStorage.getItem('rollkeeper-theme')).toBeNull();
  });
});
