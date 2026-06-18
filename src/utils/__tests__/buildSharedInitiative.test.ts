import { describe, it, expect } from 'vitest';
import { buildSharedInitiative } from '../buildSharedInitiative';
import type { Encounter, EncounterEntity } from '@/types/encounter';

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
    });
    const monster = result.turnOrder.find(r => r.entityId === 'm')!;
    expect(monster.currentHp).toBe(5);
    expect(monster.maxHp).toBe(20);
  });
});
