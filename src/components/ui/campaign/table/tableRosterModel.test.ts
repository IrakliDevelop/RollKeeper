import { describe, expect, it } from 'vitest';

import type { TableRosterEntry, TableSceneRoster } from '@/lib/table/roster';

import {
  controlLabel,
  creatureFromEntity,
  describeEntry,
  manualPcStats,
  placedIndex,
  rosterEntities,
} from './tableRosterModel';

function entry(overrides: Partial<TableRosterEntry>): TableRosterEntry {
  return {
    sceneMemberId: 'member-1',
    actorId: 'actor-1',
    sourceEntityId: null,
    name: 'Goblin',
    category: 'monster',
    avatarUrl: null,
    tokenCells: 1,
    walkFeet: null,
    adoptedPc: false,
    playerIdentity: false,
    statsEditable: true,
    liveStats: {
      name: 'Goblin',
      currentHp: 7,
      maxHp: 7,
      tempHp: 0,
      armorClass: 15,
      conditions: [],
    },
    control: { kind: 'dm' },
    verifiedLegacyPlayerId: null,
    boundTokenIds: [],
    aliasTokenIds: [],
    mismatchedTokenIds: [],
    removed: false,
    ...overrides,
  };
}

const roster = (entries: TableRosterEntry[]): TableSceneRoster => ({
  entries,
  ambiguousTokenIds: [],
  unmatchedTokenIds: [],
  needsSceneMemberIds: false,
});

describe('table roster model', () => {
  it('maps active members to roster-tray entities keyed by sceneMemberId', () => {
    const entities = rosterEntities(
      roster([
        entry({ sceneMemberId: 'm-pc', category: 'pc', name: 'Aria' }),
        entry({ sceneMemberId: 'm-npc', category: 'npc', tokenCells: 2 }),
        entry({ sceneMemberId: null }),
        entry({ sceneMemberId: 'm-gone', removed: true }),
      ])
    );
    expect(entities.map(entity => [entity.id, entity.type])).toEqual([
      ['m-pc', 'player'],
      ['m-npc', 'npc'],
    ]);
    expect(entities[1]!.tokenSize).toBe(2);
  });

  it('indexes only bound or alias tokens that exist on the live canvas', () => {
    const index = placedIndex(
      roster([
        entry({
          sceneMemberId: 'm1',
          boundTokenIds: ['t-bound', 't-missing'],
          aliasTokenIds: ['t-alias'],
        }),
      ]),
      new Set(['t-bound', 't-alias'])
    );
    expect(index.get('m1')).toEqual(['t-bound', 't-alias']);
  });

  it('labels control status truthfully', () => {
    expect(
      controlLabel(entry({ control: { kind: 'player', legacyPlayerId: 'a' } }))
    ).toBe('Player-controlled');
    expect(controlLabel(entry({}))).toBe('DM-controlled');
    expect(
      controlLabel(
        entry({
          control: { kind: 'unavailable', reason: 'identity-unresolved' },
        })
      )
    ).toBe('Identity unresolved');
    expect(
      controlLabel(
        entry({
          control: { kind: 'unavailable', reason: 'control-unavailable' },
        })
      )
    ).toBe('Control unavailable');
  });

  it('describes placement, aliases and mismatches', () => {
    expect(describeEntry(entry({}), new Set())).toBe(
      'DM-controlled · Not on map'
    );
    expect(
      describeEntry(
        entry({ boundTokenIds: ['t'], mismatchedTokenIds: ['t'] }),
        new Set(['t'])
      )
    ).toBe('DM-controlled · Repair needed');
    expect(
      describeEntry(entry({ aliasTokenIds: ['a', 'b'] }), new Set(['a', 'b']))
    ).toBe('DM-controlled · 2 unbound aliases');
  });

  it('copies creature stats and a safe profile from an encounter entity', () => {
    const copy = creatureFromEntity(
      {
        type: 'monster',
        name: 'Goblin',
        initiative: null,
        initiativeModifier: 2,
        currentHp: 7,
        maxHp: 7,
        tempHp: 0,
        armorClass: 15,
        conditions: [],
        tokenSize: 2,
        avatarUrl: 'data:image/png;base64,AAAA',
        monsterSourceId: 'goblin',
        monsterStatBlock: { speed: '30 ft., climb 20 ft.' } as never,
      },
      'bestiary'
    );
    expect(copy).toEqual({
      liveStats: {
        name: 'Goblin',
        currentHp: 7,
        maxHp: 7,
        tempHp: 0,
        armorClass: 15,
        conditions: [],
      },
      profile: {
        category: 'monster',
        sourceKind: 'bestiary',
        sourceId: 'goblin',
        tokenCells: 2,
        walkFeet: 30,
      },
    });
  });

  it('builds a manual PC with DM-managed stats', () => {
    expect(manualPcStats({ name: ' Nyx ', maxHp: 12, armorClass: 14 })).toEqual(
      {
        liveStats: {
          name: 'Nyx',
          currentHp: 12,
          maxHp: 12,
          tempHp: 0,
          armorClass: 14,
          conditions: [],
        },
        profile: { category: 'pc', sourceKind: 'manual' },
      }
    );
  });
});
