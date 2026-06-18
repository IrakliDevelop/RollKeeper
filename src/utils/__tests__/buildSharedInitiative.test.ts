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
