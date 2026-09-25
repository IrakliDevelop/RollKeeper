import { describe, it, expect } from 'vitest';
import {
  buildSharedInitiative,
  toSharedConditions,
} from '../buildSharedInitiative';
import type {
  CombatConfig,
  Encounter,
  EncounterEntity,
  EnemyHpDisplay,
} from '@/types/encounter';
import type { SharedTurnEntry } from '@/types/sharedState';

function entity(o: Partial<EncounterEntity> & { id: string }): EncounterEntity {
  return {
    type: 'monster',
    name: 'E',
    initiative: 10,
    initiativeModifier: 0,
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 10,
    conditions: [],
    isHidden: false,
    ...o,
  };
}

function encounter(
  entities: EncounterEntity[],
  o: Partial<Encounter> = {}
): Encounter {
  return {
    id: 'enc-1',
    name: 'Fight',
    campaignCode: 'ABC123',
    entities,
    currentTurn: 0,
    round: 2,
    isActive: true,
    sortOrder: 'initiative',
    createdAt: '',
    updatedAt: '',
    ...o,
  };
}

describe('buildSharedInitiative', () => {
  it('orders entries by initiative (desc) and sets currentEntityId from currentTurn', () => {
    const enc = encounter(
      [
        entity({
          id: 'a',
          name: 'Aragorn',
          type: 'player',
          initiative: 20,
          playerCharacterId: 'char-a',
        }),
        entity({ id: 'b', name: 'Goblin', initiative: 5 }),
      ],
      { currentTurn: 1 }
    );
    const result = buildSharedInitiative(enc);
    expect(result.turnOrder.map(t => t.entityId)).toEqual(['a', 'b']);
    expect(result.currentEntityId).toBe('b');
    expect(result.round).toBe(2);
    expect(result.isActive).toBe(true);
    expect(result.encounterId).toBe('enc-1');
  });

  it('relabels hidden non-player entities to "Enemy" and omits their identity', () => {
    const enc = encounter([
      entity({
        id: 'm',
        name: 'Adult Red Dragon',
        initiative: 18,
        isHidden: true,
      }),
    ]);
    expect(enc).toBeDefined();
    const result = buildSharedInitiative(enc);
    expect(result.turnOrder[0].displayName).toBe('Enemy');
  });

  it('keeps hidden PLAYER names (only non-players are masked)', () => {
    const enc = encounter([
      entity({
        id: 'p',
        name: 'Aragorn',
        type: 'player',
        initiative: 18,
        isHidden: true,
        playerCharacterId: 'char-a',
      }),
    ]);
    expect(buildSharedInitiative(enc).turnOrder[0].displayName).toBe('Aragorn');
  });

  it('uses playerAlias as the player-facing name for non-player entities', () => {
    const enc = encounter([
      entity({
        id: 'm',
        name: 'Vecna the Archlich',
        initiative: 18,
        playerAlias: 'Hooded Figure',
      }),
    ]);
    expect(buildSharedInitiative(enc).turnOrder[0].displayName).toBe(
      'Hooded Figure'
    );
  });

  it('lets playerAlias take precedence over the hidden "Enemy" label', () => {
    const enc = encounter([
      entity({
        id: 'm',
        name: 'Goblin Boss',
        initiative: 18,
        isHidden: true,
        playerAlias: 'Hooded Figure',
      }),
    ]);
    expect(buildSharedInitiative(enc).turnOrder[0].displayName).toBe(
      'Hooded Figure'
    );
  });

  it('ignores a blank/whitespace playerAlias and falls back to name or "Enemy"', () => {
    const enc = encounter([
      entity({ id: 'm1', name: 'Goblin', initiative: 10, playerAlias: '   ' }),
      entity({
        id: 'm2',
        name: 'Orc',
        initiative: 8,
        isHidden: true,
        playerAlias: '',
      }),
    ]);
    const rows = buildSharedInitiative(enc).turnOrder;
    expect(rows.find(r => r.entityId === 'm1')!.displayName).toBe('Goblin');
    expect(rows.find(r => r.entityId === 'm2')!.displayName).toBe('Enemy');
  });

  it('hidden generic label follows the disguise disposition', () => {
    const enc = encounter([
      entity({
        id: 'a',
        name: 'Strahd',
        initiative: 20,
        isHidden: true,
        playerDisposition: 'ally',
      }),
      entity({
        id: 'n',
        name: 'Spy',
        initiative: 15,
        isHidden: true,
        playerDisposition: 'neutral',
      }),
      entity({ id: 'e', name: 'Orc', initiative: 10, isHidden: true }),
    ]);
    const rows = buildSharedInitiative(enc).turnOrder;
    expect(rows.find(r => r.entityId === 'a')!.displayName).toBe('Ally');
    expect(rows.find(r => r.entityId === 'n')!.displayName).toBe('Stranger');
    expect(rows.find(r => r.entityId === 'e')!.displayName).toBe('Enemy');
  });

  it('sends disposition for non-players (default enemy), not for players', () => {
    const enc = encounter([
      entity({
        id: 'a',
        name: 'Noble',
        initiative: 20,
        playerDisposition: 'ally',
      }),
      entity({ id: 'e', name: 'Goblin', initiative: 10 }),
      entity({
        id: 'p',
        name: 'Aragorn',
        type: 'player',
        initiative: 15,
        playerCharacterId: 'char-a',
      }),
    ]);
    const rows = buildSharedInitiative(enc).turnOrder;
    expect(rows.find(r => r.entityId === 'a')!.disposition).toBe('ally');
    expect(rows.find(r => r.entityId === 'e')!.disposition).toBe('enemy');
    expect(rows.find(r => r.entityId === 'p')!.disposition).toBeUndefined();
  });

  it('ignores playerAlias for player entities (players are never masked)', () => {
    const enc = encounter([
      entity({
        id: 'p',
        name: 'Aragorn',
        type: 'player',
        initiative: 18,
        playerAlias: 'Fake',
        playerCharacterId: 'char-a',
      }),
    ]);
    expect(buildSharedInitiative(enc).turnOrder[0].displayName).toBe('Aragorn');
  });

  it('includes chessPiece and tokenColor when set, for players and non-players alike', () => {
    const enc = encounter([
      entity({
        id: 'p',
        name: 'Aragorn',
        type: 'player',
        initiative: 20,
        playerCharacterId: 'char-a',
        chessPiece: 'king',
        color: '#a855f7',
      }),
      entity({
        id: 'm',
        name: 'Goblin',
        initiative: 5,
        isHidden: true,
        chessPiece: 'pawn',
        color: '#ef4444',
      }),
    ]);
    const rows = buildSharedInitiative(enc).turnOrder;
    const player = rows.find(r => r.entityId === 'p')!;
    const monster = rows.find(r => r.entityId === 'm')!;
    expect(player.chessPiece).toBe('king');
    expect(player.tokenColor).toBe('#a855f7');
    expect(monster.chessPiece).toBe('pawn');
    expect(monster.tokenColor).toBe('#ef4444');
    expect(monster.displayName).toBe('Enemy'); // still hidden — identity is separate
  });

  it('omits chessPiece/tokenColor when unset', () => {
    const enc = encounter([entity({ id: 'm', name: 'Goblin', initiative: 5 })]);
    const row = buildSharedInitiative(enc).turnOrder[0];
    expect(row.chessPiece).toBeUndefined();
    expect(row.tokenColor).toBeUndefined();
  });

  it('includes HP for player entities only', () => {
    const enc = encounter([
      entity({
        id: 'p',
        name: 'Aragorn',
        type: 'player',
        initiative: 18,
        currentHp: 24,
        maxHp: 30,
        playerCharacterId: 'char-a',
      }),
      entity({
        id: 'm',
        name: 'Goblin',
        initiative: 5,
        currentHp: 7,
        maxHp: 7,
      }),
    ]);
    const rows = buildSharedInitiative(enc).turnOrder;
    const player = rows.find(r => r.entityId === 'p')!;
    const monster = rows.find(r => r.entityId === 'm')!;
    expect(player.currentHp).toBe(24);
    expect(player.maxHp).toBe(30);
    expect(player.playerCharacterId).toBe('char-a');
    expect(monster.currentHp).toBeUndefined();
    expect(monster.maxHp).toBeUndefined();
    expect(monster.playerCharacterId).toBeUndefined();
  });

  it('always shares player conditions and concentration, projected to name/kind/stackCount', () => {
    const shared = buildSharedInitiative(
      encounter([
        entity({
          id: 'p1',
          type: 'player',
          playerCharacterId: 'char-1',
          conditions: [
            {
              id: 'c1',
              name: 'Poisoned',
              kind: 'debuff',
              duration: '1 minute',
              sourceEntity: 'Spider',
              sourceSpell: 'Venom',
              source: 'dm',
              rounds: 3,
              stackCount: 2,
            },
          ],
          concentrationSpell: 'Bless',
        }),
      ])
      // no config arg — DEFAULT_COMBAT_CONFIG has enemyConditionsDisplay 'off'
    );
    const entry = shared.turnOrder[0];
    expect(entry.conditions).toEqual([
      { name: 'Poisoned', kind: 'debuff', stackCount: 2 },
    ]);
    expect(entry.isConcentrating).toBe(true);
  });

  it('omits non-player conditions/concentration when enemyConditionsDisplay is off', () => {
    const shared = buildSharedInitiative(
      encounter([
        entity({
          id: 'm1',
          conditions: [{ id: 'c1', name: 'Prone' }],
          concentrationSpell: 'Hold Person',
        }),
      ])
    );
    const entry = shared.turnOrder[0];
    expect('conditions' in entry).toBe(false);
    expect('isConcentrating' in entry).toBe(false);
    expect(shared.enemyConditionsMode).toBe('off');
  });

  it('shares non-player (and hidden-enemy) conditions/concentration when mode is on', () => {
    const shared = buildSharedInitiative(
      encounter([
        entity({
          id: 'm1',
          isHidden: true,
          conditions: [{ id: 'c1', name: 'Prone' }],
          concentrationSpell: 'Hold Person',
        }),
      ]),
      {
        enemyHpDisplay: 'off',
        hpStateBands: [],
        enemyConditionsDisplay: 'on',
      }
    );
    const entry = shared.turnOrder[0];
    expect(entry.conditions).toEqual([{ name: 'Prone' }]);
    expect(entry.isConcentrating).toBe(true);
    expect(shared.enemyConditionsMode).toBe('on');
  });

  it('omits empty conditions, stackCount <= 1, and isConcentrating when not concentrating', () => {
    const shared = buildSharedInitiative(
      encounter([
        entity({
          id: 'p1',
          type: 'player',
          playerCharacterId: 'char-1',
          conditions: [{ id: 'c1', name: 'Blessed', stackCount: 1 }],
        }),
        entity({
          id: 'p2',
          type: 'player',
          playerCharacterId: 'char-2',
          conditions: [],
        }),
      ])
    );
    expect(shared.turnOrder[0].conditions).toEqual([{ name: 'Blessed' }]);
    expect(shared.turnOrder[0].isConcentrating).toBeUndefined();
    expect('conditions' in shared.turnOrder[1]).toBe(false);
  });

  it('defaults enemyConditionsMode to off for legacy persisted configs missing the field', () => {
    const legacyConfig = {
      enemyHpDisplay: 'off',
      hpStateBands: [],
    } as unknown as import('@/types/encounter').CombatConfig;
    const shared = buildSharedInitiative(
      encounter([
        entity({ id: 'm1', conditions: [{ id: 'c1', name: 'Prone' }] }),
      ]),
      legacyConfig
    );
    expect(shared.enemyConditionsMode).toBe('off');
    expect('conditions' in shared.turnOrder[0]).toBe(false);
  });

  it('carries description and a validated icon on player conditions', () => {
    const shared = buildSharedInitiative(
      encounter([
        entity({
          id: 'p1',
          type: 'player',
          playerCharacterId: 'char-1',
          conditions: [
            {
              id: 'c1',
              name: 'Cursed Blood',
              kind: 'debuff',
              description: '  Lose 1d4 HP at the start of each turn.  ',
              icon: 'droplet',
              source: 'dm',
              sourceEntity: 'Blood Hag',
            },
          ],
        }),
      ])
    );
    expect(shared.turnOrder[0].conditions).toEqual([
      {
        name: 'Cursed Blood',
        kind: 'debuff',
        description: 'Lose 1d4 HP at the start of each turn.',
        icon: 'droplet',
      },
    ]);
  });

  it('keeps enemy descriptions and icons behind the enemyConditionsDisplay gate', () => {
    const enemy = entity({
      id: 'm1',
      conditions: [
        {
          id: 'c1',
          name: 'Webbed',
          description: 'Restrained by sticky webbing.',
          icon: 'link',
        },
      ],
    });
    const hidden = buildSharedInitiative(encounter([enemy]));
    expect('conditions' in hidden.turnOrder[0]).toBe(false);
    expect(JSON.stringify(hidden)).not.toContain('sticky webbing');

    const visible = buildSharedInitiative(encounter([enemy]), {
      enemyHpDisplay: 'off',
      hpStateBands: [],
      enemyConditionsDisplay: 'on',
    });
    expect(visible.turnOrder[0].conditions).toEqual([
      {
        name: 'Webbed',
        description: 'Restrained by sticky webbing.',
        icon: 'link',
      },
    ]);
  });

  it('drops an invalid icon and a blank description', () => {
    const conditions = toSharedConditions([
      {
        id: 'c1',
        name: 'Hexed',
        description: '   ',
        icon: 'not-an-icon' as never,
      },
    ]);
    expect(conditions).toEqual([{ name: 'Hexed' }]);
  });

  it('caps an oversized description before it reaches the wire', () => {
    const [condition] = toSharedConditions([
      { id: 'c1', name: 'Wall of Text', description: 'x'.repeat(5000) },
    ]);
    expect(condition.description).toHaveLength(1000);
  });

  it('does not throw on a corrupt non-string description and omits it', () => {
    const shared = buildSharedInitiative(
      encounter([
        entity({
          id: 'p1',
          type: 'player',
          playerCharacterId: 'char-1',
          conditions: [
            {
              id: 'c1',
              name: 'Cursed',
              description: 42 as unknown as string,
            },
          ],
        }),
      ])
    );
    expect(shared.turnOrder[0].conditions).toStrictEqual([{ name: 'Cursed' }]);
  });
});

describe('buildSharedInitiative — enemy HP config', () => {
  const enc = () =>
    encounter([
      entity({
        id: 'p',
        name: 'Aragorn',
        type: 'player',
        initiative: 20,
        currentHp: 24,
        maxHp: 30,
        playerCharacterId: 'char-a',
      }),
      entity({
        id: 'm',
        name: 'Goblin',
        initiative: 5,
        currentHp: 5,
        maxHp: 20,
      }),
    ]);

  const bands = [
    { minPercent: 50, label: 'Healthy' },
    { minPercent: 0, label: 'Bloodied' },
  ];

  it('defaults to off — non-players expose no HP and mode is "off"', () => {
    const result = buildSharedInitiative(enc());
    expect(result.enemyHpMode).toBe('off');
    const monster = result.turnOrder.find(r => r.entityId === 'm')!;
    expect(monster.hpState).toBeUndefined();
    expect(monster.hpPercent).toBeUndefined();
    expect(monster.currentHp).toBeUndefined();
  });

  it('label mode sets hpState for non-players (not players)', () => {
    const result = buildSharedInitiative(enc(), {
      enemyHpDisplay: 'label',
      hpStateBands: bands,
      enemyConditionsDisplay: 'off',
    });
    expect(result.enemyHpMode).toBe('label');
    expect(result.turnOrder.find(r => r.entityId === 'm')!.hpState).toBe(
      'Bloodied' // 5/20 = 25% -> below 50 band
    );
    expect(
      result.turnOrder.find(r => r.entityId === 'p')!.hpState
    ).toBeUndefined();
  });

  it('percent and bar modes set hpPercent (no raw HP) for non-players', () => {
    for (const mode of ['percent', 'bar'] as const) {
      const result = buildSharedInitiative(enc(), {
        enemyHpDisplay: mode,
        hpStateBands: bands,
        enemyConditionsDisplay: 'off',
      });
      const monster = result.turnOrder.find(r => r.entityId === 'm')!;
      expect(monster.hpPercent).toBe(25);
      expect(monster.currentHp).toBeUndefined();
      expect(monster.maxHp).toBeUndefined();
    }
  });

  it('exact mode exposes raw HP for non-players', () => {
    const result = buildSharedInitiative(enc(), {
      enemyHpDisplay: 'exact',
      hpStateBands: bands,
      enemyConditionsDisplay: 'off',
    });
    const monster = result.turnOrder.find(r => r.entityId === 'm')!;
    expect(monster.currentHp).toBe(5);
    expect(monster.maxHp).toBe(20);
  });

  it('sets a coarse hpTier for a living enemy when HP is shown', () => {
    const result = buildSharedInitiative(enc(), {
      enemyHpDisplay: 'label',
      hpStateBands: bands,
      enemyConditionsDisplay: 'off',
    });
    // 5/20 = 25% -> 'critical'
    expect(result.turnOrder.find(r => r.entityId === 'm')!.hpTier).toBe(
      'critical'
    );
  });

  it('marks a dead enemy isDead (no tier) when HP is shown', () => {
    const e = encounter([
      entity({
        id: 'm',
        name: 'Goblin',
        initiative: 5,
        currentHp: 0,
        maxHp: 20,
      }),
    ]);
    const monster = buildSharedInitiative(e, {
      enemyHpDisplay: 'label',
      hpStateBands: bands,
      enemyConditionsDisplay: 'off',
    }).turnOrder[0];
    expect(monster.isDead).toBe(true);
    expect(monster.hpTier).toBeUndefined();
  });

  it('never marks enemy death when HP display is off', () => {
    const e = encounter([
      entity({
        id: 'm',
        name: 'Goblin',
        initiative: 5,
        currentHp: 0,
        maxHp: 20,
      }),
    ]);
    expect(buildSharedInitiative(e).turnOrder[0].isDead).toBeUndefined();
  });

  it('marks a downed player isDead', () => {
    const e = encounter([
      entity({
        id: 'p',
        name: 'Aragorn',
        type: 'player',
        initiative: 20,
        currentHp: 0,
        maxHp: 30,
        playerCharacterId: 'char-a',
      }),
    ]);
    expect(buildSharedInitiative(e).turnOrder[0].isDead).toBe(true);
  });
});

describe('buildSharedInitiative — per-entity hpVisibleToPlayers', () => {
  const MODES: EnemyHpDisplay[] = ['off', 'label', 'bar', 'percent', 'exact'];

  const bands = [
    { minPercent: 50, label: 'Healthy' },
    { minPercent: 0, label: 'Bloodied' },
  ];

  const config = (mode: EnemyHpDisplay): CombatConfig => ({
    enemyHpDisplay: mode,
    hpStateBands: bands,
    enemyConditionsDisplay: 'off',
  });

  // 5/20 = 25% -> tier 'critical', label 'Bloodied'.
  const goblin = (o: Partial<EncounterEntity> = {}): EncounterEntity =>
    entity({
      id: 'm',
      name: 'Goblin',
      initiative: 5,
      currentHp: 5,
      maxHp: 20,
      ...o,
    });

  const BASE: SharedTurnEntry = {
    entityId: 'm',
    displayName: 'Goblin',
    type: 'monster',
    disposition: 'enemy',
  };

  // Today's exact output per global mode for an untoggled enemy.
  const UNTOGGLED: Record<EnemyHpDisplay, SharedTurnEntry> = {
    off: BASE,
    label: { ...BASE, isDead: false, hpTier: 'critical', hpState: 'Bloodied' },
    bar: { ...BASE, isDead: false, hpTier: 'critical', hpPercent: 25 },
    percent: { ...BASE, isDead: false, hpTier: 'critical', hpPercent: 25 },
    exact: {
      ...BASE,
      isDead: false,
      hpTier: 'critical',
      currentHp: 5,
      maxHp: 20,
    },
  };

  it('toggle on: exposes exact HP + hpMode "exact" under every global mode', () => {
    for (const mode of MODES) {
      const result = buildSharedInitiative(
        encounter([goblin({ hpVisibleToPlayers: true })]),
        config(mode)
      );
      expect(result.turnOrder[0]).toStrictEqual({
        ...BASE,
        isDead: false,
        hpTier: 'critical',
        currentHp: 5,
        maxHp: 20,
        hpMode: 'exact',
      });
      // The state-level mode is still the campaign-wide setting.
      expect(result.enemyHpMode).toBe(mode);
    }
  });

  it('toggle off or absent: every global mode output is identical to today', () => {
    for (const mode of MODES) {
      for (const flag of [{}, { hpVisibleToPlayers: false }]) {
        const row = buildSharedInitiative(
          encounter([goblin(flag)]),
          config(mode)
        ).turnOrder[0];
        expect(row).toStrictEqual(UNTOGGLED[mode]);
        expect('hpMode' in row).toBe(false);
      }
    }
  });

  it('ignores the flag on player entities', () => {
    const row = buildSharedInitiative(
      encounter([
        entity({
          id: 'p',
          name: 'Aragorn',
          type: 'player',
          initiative: 20,
          currentHp: 24,
          maxHp: 30,
          playerCharacterId: 'char-a',
          hpVisibleToPlayers: true,
        }),
      ]),
      config('off')
    ).turnOrder[0];
    expect(row).toStrictEqual({
      entityId: 'p',
      displayName: 'Aragorn',
      type: 'player',
      playerCharacterId: 'char-a',
      currentHp: 24,
      maxHp: 30,
      isDead: false,
    });
  });

  it('marks a dead toggled enemy isDead (no tier) even when the global mode is off', () => {
    const row = buildSharedInitiative(
      encounter([goblin({ currentHp: 0, hpVisibleToPlayers: true })]),
      config('off')
    ).turnOrder[0];
    expect(row).toStrictEqual({
      ...BASE,
      isDead: true,
      currentHp: 0,
      maxHp: 20,
      hpMode: 'exact',
    });
  });

  it('an untoggled enemy under "off" still exposes nothing next to a toggled one', () => {
    const rows = buildSharedInitiative(
      encounter([
        goblin({ id: 'shown', initiative: 9, hpVisibleToPlayers: true }),
        goblin({ id: 'masked', initiative: 5 }),
      ]),
      config('off')
    ).turnOrder;
    expect(rows.find(r => r.entityId === 'shown')!.hpMode).toBe('exact');
    expect(rows.find(r => r.entityId === 'masked')).toStrictEqual({
      ...BASE,
      entityId: 'masked',
    });
  });

  it('the toggle shares HP only — name masking and condition sharing are unchanged', () => {
    const row = buildSharedInitiative(
      encounter([
        goblin({
          isHidden: true,
          hpVisibleToPlayers: true,
          conditions: [{ id: 'c1', name: 'Prone' }],
          concentrationSpell: 'Hold Person',
        }),
      ]),
      config('off')
    ).turnOrder[0];
    expect(row.displayName).toBe('Enemy');
    expect('conditions' in row).toBe(false);
    expect('isConcentrating' in row).toBe(false);
    expect(row.currentHp).toBe(5);
  });
});

describe('buildSharedInitiative — player hpSharedWithParty opt-out', () => {
  const bands = [
    { minPercent: 50, label: 'Healthy' },
    { minPercent: 0, label: 'Bloodied' },
  ];
  const config: CombatConfig = {
    enemyHpDisplay: 'off',
    hpStateBands: bands,
    enemyConditionsDisplay: 'off',
  };

  it('opted-out player has no currentHp/maxHp, hpMode "label", and the expected hpState/hpTier', () => {
    const enc = encounter([
      entity({
        id: 'p',
        name: 'Aragorn',
        type: 'player',
        initiative: 18,
        currentHp: 6,
        maxHp: 30,
        playerCharacterId: 'char-a',
        hpSharedWithParty: false,
      }),
    ]);
    const row = buildSharedInitiative(enc, config).turnOrder[0];
    expect(row.currentHp).toBeUndefined();
    expect(row.maxHp).toBeUndefined();
    expect(row.hpMode).toBe('label');
    // 6/30 = 20% -> below the 50 band -> 'Bloodied'
    expect(row.hpState).toBe('Bloodied');
    expect(row.hpTier).toBe('critical');
    expect(row.playerCharacterId).toBe('char-a');
  });

  it('marks an opted-out player isDead at 0 HP, and omits hpTier', () => {
    const enc = encounter([
      entity({
        id: 'p',
        type: 'player',
        currentHp: 0,
        maxHp: 30,
        playerCharacterId: 'char-a',
        hpSharedWithParty: false,
      }),
    ]);
    const row = buildSharedInitiative(enc, config).turnOrder[0];
    expect(row.isDead).toBe(true);
    expect(row.hpTier).toBeUndefined();
    expect(row.currentHp).toBeUndefined();
    expect(row.maxHp).toBeUndefined();
  });

  it('shared (hpSharedWithParty: true) player is unchanged from today', () => {
    const enc = encounter([
      entity({
        id: 'p',
        type: 'player',
        currentHp: 24,
        maxHp: 30,
        playerCharacterId: 'char-a',
        hpSharedWithParty: true,
      }),
    ]);
    const row = buildSharedInitiative(enc, config).turnOrder[0];
    expect(row.currentHp).toBe(24);
    expect(row.maxHp).toBe(30);
    expect(row.isDead).toBe(false);
    expect('hpMode' in row).toBe(false);
    expect(row.hpState).toBeUndefined();
    expect(row.hpTier).toBeUndefined();
  });

  it('legacy player (hpSharedWithParty undefined) is unchanged from today', () => {
    const enc = encounter([
      entity({
        id: 'p',
        type: 'player',
        currentHp: 24,
        maxHp: 30,
        playerCharacterId: 'char-a',
      }),
    ]);
    const row = buildSharedInitiative(enc, config).turnOrder[0];
    expect(row.currentHp).toBe(24);
    expect(row.maxHp).toBe(30);
    expect('hpMode' in row).toBe(false);
  });

  it('keeps playerCharacterId for an opted-out player', () => {
    const enc = encounter([
      entity({
        id: 'p',
        type: 'player',
        currentHp: 10,
        maxHp: 30,
        playerCharacterId: 'char-z',
        hpSharedWithParty: false,
      }),
    ]);
    const row = buildSharedInitiative(enc, config).turnOrder[0];
    expect(row.playerCharacterId).toBe('char-z');
  });
});
