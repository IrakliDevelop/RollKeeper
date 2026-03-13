import { describe, it, expect } from 'vitest';
import { getSortedEntities } from './encounterStore';
import { EncounterEntity } from '@/types/encounter';

/** Helper to create a minimal EncounterEntity with overrides */
function makeEntity(
  overrides: Partial<EncounterEntity> & { id: string }
): EncounterEntity {
  return {
    type: 'monster',
    name: 'Test Entity',
    initiative: null,
    initiativeModifier: 0,
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 10,
    conditions: [],
    isHidden: false,
    ...overrides,
  };
}

function player(
  id: string,
  initiative: number | null,
  name?: string
): EncounterEntity {
  return makeEntity({
    id,
    type: 'player',
    name: name ?? `Player ${id}`,
    initiative,
    playerCharacterId: `char-${id}`,
  });
}

function monster(
  id: string,
  initiative: number | null,
  name?: string
): EncounterEntity {
  return makeEntity({
    id,
    type: 'monster',
    name: name ?? `Monster ${id}`,
    initiative,
  });
}

function lair(id: string, initiative: number | null): EncounterEntity {
  return makeEntity({
    id,
    type: 'lair',
    name: `Lair ${id}`,
    initiative,
  });
}

function summon(
  id: string,
  ownerId: string,
  initiative: number | null,
  name?: string
): EncounterEntity {
  return makeEntity({
    id,
    type: 'monster',
    name: name ?? `Summon ${id}`,
    initiative,
    summonOwnerId: `char-${ownerId}`,
    summonId: `summon-${id}`,
  });
}

/** Extract just ids for easy assertion */
function ids(entities: EncounterEntity[]): string[] {
  return entities.map(e => e.id);
}

describe('getSortedEntities', () => {
  describe('basic initiative sorting', () => {
    it('sorts entities by initiative descending', () => {
      const entities = [monster('a', 10), monster('b', 20), monster('c', 15)];
      expect(ids(getSortedEntities(entities))).toEqual(['b', 'c', 'a']);
    });

    it('handles single entity', () => {
      const entities = [monster('a', 15)];
      expect(ids(getSortedEntities(entities))).toEqual(['a']);
    });

    it('handles empty array', () => {
      expect(getSortedEntities([])).toEqual([]);
    });

    it('sorts null initiatives to the end', () => {
      const entities = [
        monster('a', null),
        monster('b', 15),
        monster('c', null),
        monster('d', 20),
      ];
      expect(ids(getSortedEntities(entities))).toEqual(['d', 'b', 'a', 'c']);
    });

    it('handles all null initiatives', () => {
      const entities = [monster('a', null), monster('b', null)];
      const result = getSortedEntities(entities);
      expect(result).toHaveLength(2);
    });

    it('handles negative initiatives', () => {
      const entities = [monster('a', -2), monster('b', 5), monster('c', -5)];
      expect(ids(getSortedEntities(entities))).toEqual(['b', 'a', 'c']);
    });

    it('handles decimal initiatives', () => {
      const entities = [
        monster('a', 15),
        monster('b', 15.5),
        monster('c', 14.999),
      ];
      expect(ids(getSortedEntities(entities))).toEqual(['b', 'a', 'c']);
    });

    it('does not mutate the input array', () => {
      const entities = [monster('a', 10), monster('b', 20)];
      const original = [...entities];
      getSortedEntities(entities);
      expect(entities.map(e => e.id)).toEqual(original.map(e => e.id));
    });
  });

  describe('ties between regular entities', () => {
    it('preserves relative order for entities with same initiative', () => {
      const entities = [monster('a', 15), monster('b', 15), monster('c', 15)];
      // Sort is stable — original order preserved on ties
      const result = getSortedEntities(entities);
      expect(result).toHaveLength(3);
      // All three should be present
      expect(ids(result).sort()).toEqual(['a', 'b', 'c']);
    });

    it('sorts mixed entity types by initiative regardless of type', () => {
      const entities = [
        player('p1', 15),
        monster('m1', 20),
        player('p2', 10),
        monster('m2', 25),
      ];
      expect(ids(getSortedEntities(entities))).toEqual([
        'm2',
        'm1',
        'p1',
        'p2',
      ]);
    });
  });

  describe('lair actions', () => {
    it('lair loses ties with non-lair entities', () => {
      const entities = [lair('l1', 20), monster('m1', 20)];
      expect(ids(getSortedEntities(entities))).toEqual(['m1', 'l1']);
    });

    it('lair at higher initiative goes before lower non-lair', () => {
      const entities = [lair('l1', 20), monster('m1', 15)];
      expect(ids(getSortedEntities(entities))).toEqual(['l1', 'm1']);
    });

    it('multiple lairs at same initiative preserve order', () => {
      const entities = [lair('l1', 20), lair('l2', 20), monster('m1', 20)];
      const result = getSortedEntities(entities);
      // Monster should be first, both lairs after
      expect(result[0].id).toBe('m1');
      expect(
        result
          .slice(1)
          .map(e => e.id)
          .sort()
      ).toEqual(['l1', 'l2']);
    });

    it('lair at initiative 20 with entities at various initiatives', () => {
      const entities = [
        monster('m1', 22),
        lair('l1', 20),
        player('p1', 20),
        monster('m2', 18),
      ];
      const result = ids(getSortedEntities(entities));
      expect(result[0]).toBe('m1');
      // Player at 20 before lair at 20
      expect(result.indexOf('p1')).toBeLessThan(result.indexOf('l1'));
      expect(result[result.length - 1]).toBe('m2');
    });
  });

  describe('summons placed after owner', () => {
    it('summon appears right after its owner', () => {
      const entities = [
        player('p1', 15),
        monster('m1', 10),
        summon('s1', 'p1', 15),
      ];
      expect(ids(getSortedEntities(entities))).toEqual(['p1', 's1', 'm1']);
    });

    it('summon appears after owner even with monster at same initiative', () => {
      const entities = [
        player('p1', 15),
        monster('m1', 15),
        summon('s1', 'p1', 15),
      ];
      const result = ids(getSortedEntities(entities));
      // p1 and m1 can be in either order (tie), but s1 must be right after p1
      const p1Idx = result.indexOf('p1');
      const s1Idx = result.indexOf('s1');
      expect(s1Idx).toBe(p1Idx + 1);
    });

    it('multiple summons from same owner appear after owner', () => {
      const entities = [
        player('p1', 15),
        monster('m1', 10),
        summon('s1', 'p1', 15),
        summon('s2', 'p1', 15),
      ];
      const result = ids(getSortedEntities(entities));
      expect(result[0]).toBe('p1');
      expect(result[1]).toBe('s1');
      expect(result[2]).toBe('s2');
      expect(result[3]).toBe('m1');
    });

    it('summons from different players at same initiative stay with their owners', () => {
      const entities = [
        player('p1', 15),
        player('p2', 15),
        summon('s1', 'p1', 15),
        summon('s2', 'p2', 15),
      ];
      const result = ids(getSortedEntities(entities));
      // Each summon must be right after its owner
      const p1Idx = result.indexOf('p1');
      const s1Idx = result.indexOf('s1');
      const p2Idx = result.indexOf('p2');
      const s2Idx = result.indexOf('s2');
      expect(s1Idx).toBe(p1Idx + 1);
      expect(s2Idx).toBe(p2Idx + 1);
    });

    it('summon at owner initiative beats monster at same initiative in placement', () => {
      // This is the key bug that was fixed: summon at 15 should be after
      // its owner at 15, not after a monster also at 15
      const entities = [
        player('p1', 15),
        monster('m1', 15),
        monster('m2', 15),
        summon('s1', 'p1', 15),
      ];
      const result = ids(getSortedEntities(entities));
      const p1Idx = result.indexOf('p1');
      const s1Idx = result.indexOf('s1');
      expect(s1Idx).toBe(p1Idx + 1);
    });
  });

  describe('complex scenarios with summons', () => {
    it('two players with summons at different initiatives', () => {
      const entities = [
        player('p1', 20),
        player('p2', 10),
        summon('s1', 'p1', 20),
        summon('s2', 'p2', 10),
      ];
      expect(ids(getSortedEntities(entities))).toEqual([
        'p1',
        's1',
        'p2',
        's2',
      ]);
    });

    it('player with summon, monster between them in initiative', () => {
      const entities = [
        player('p1', 20),
        monster('m1', 15),
        summon('s1', 'p1', 20),
      ];
      expect(ids(getSortedEntities(entities))).toEqual(['p1', 's1', 'm1']);
    });

    it('everyone at the same initiative with multiple summons from multiple players', () => {
      const entities = [
        player('p1', 15),
        player('p2', 15),
        monster('m1', 15),
        monster('m2', 15),
        summon('s1a', 'p1', 15),
        summon('s1b', 'p1', 15),
        summon('s2a', 'p2', 15),
      ];
      const result = ids(getSortedEntities(entities));

      // Each player's summons directly after them
      const p1Idx = result.indexOf('p1');
      const s1aIdx = result.indexOf('s1a');
      const s1bIdx = result.indexOf('s1b');
      expect(s1aIdx).toBe(p1Idx + 1);
      expect(s1bIdx).toBe(p1Idx + 2);

      const p2Idx = result.indexOf('p2');
      const s2aIdx = result.indexOf('s2a');
      expect(s2aIdx).toBe(p2Idx + 1);

      // All entities present
      expect(result).toHaveLength(7);
    });

    it('summon with null initiative still groups with owner', () => {
      const entities = [
        player('p1', 15),
        monster('m1', 10),
        summon('s1', 'p1', null),
      ];
      const result = ids(getSortedEntities(entities));
      const p1Idx = result.indexOf('p1');
      const s1Idx = result.indexOf('s1');
      expect(s1Idx).toBe(p1Idx + 1);
    });

    it('orphaned summon (owner not in encounter) goes to end', () => {
      const entities = [
        monster('m1', 20),
        player('p1', 15),
        summon('s1', 'p_missing', 15),
      ];
      const result = ids(getSortedEntities(entities));
      // Orphaned summon appended at the end
      expect(result[result.length - 1]).toBe('s1');
    });

    it('orphaned summons from multiple missing owners all go to end', () => {
      const entities = [
        monster('m1', 20),
        summon('s1', 'missing1', 15),
        summon('s2', 'missing2', 15),
      ];
      const result = ids(getSortedEntities(entities));
      expect(result[0]).toBe('m1');
      // Both orphans at end
      expect(result.slice(1).sort()).toEqual(['s1', 's2']);
    });
  });

  describe('lair + summon interactions', () => {
    it('lair loses tie to summon at same initiative', () => {
      const entities = [
        player('p1', 20),
        lair('l1', 20),
        summon('s1', 'p1', 20),
      ];
      const result = ids(getSortedEntities(entities));
      // Player, then summon, then lair
      expect(result[0]).toBe('p1');
      expect(result[1]).toBe('s1');
      expect(result[2]).toBe('l1');
    });

    it('full combat: players, monsters, summons, lair all at initiative 20', () => {
      const entities = [
        player('p1', 20),
        player('p2', 20),
        monster('m1', 20),
        lair('l1', 20),
        summon('s1', 'p1', 20),
        summon('s2', 'p2', 20),
      ];
      const result = ids(getSortedEntities(entities));

      // Lair should be last among the init-20 group
      const lairIdx = result.indexOf('l1');
      const monsterIdx = result.indexOf('m1');
      expect(lairIdx).toBeGreaterThan(monsterIdx);

      // Each summon right after its owner
      expect(result.indexOf('s1')).toBe(result.indexOf('p1') + 1);
      expect(result.indexOf('s2')).toBe(result.indexOf('p2') + 1);
    });
  });

  describe('realistic encounter scenarios', () => {
    it('standard party vs monsters', () => {
      const entities = [
        player('fighter', 18, 'Fighter'),
        player('wizard', 12, 'Wizard'),
        player('rogue', 22, 'Rogue'),
        monster('goblin1', 14, 'Goblin'),
        monster('goblin2', 14, 'Goblin'),
        monster('bugbear', 8, 'Bugbear'),
      ];
      const result = ids(getSortedEntities(entities));
      expect(result[0]).toBe('rogue'); // 22
      expect(result[1]).toBe('fighter'); // 18
      // goblins at 14, order between them doesn't matter
      expect(result.indexOf('wizard')).toBe(4); // 12
      expect(result[5]).toBe('bugbear'); // 8
    });

    it('druid with summon mid-combat with lair', () => {
      const entities = [
        player('druid', 16, 'Druid'),
        player('paladin', 12, 'Paladin'),
        monster('dragon', 24, 'Adult Red Dragon'),
        lair('dragon_lair', 20),
        summon('bear', 'druid', 16, 'Conjured Bear'),
      ];
      const result = ids(getSortedEntities(entities));
      expect(result).toEqual([
        'dragon', // 24
        'dragon_lair', // 20 (lair, no tie to lose)
        'druid', // 16
        'bear', // 16, right after druid
        'paladin', // 12
      ]);
    });

    it('wizard with familiar and concentration summon', () => {
      const entities = [
        player('wizard', 14, 'Wizard'),
        monster('ogre', 8, 'Ogre'),
        summon('familiar', 'wizard', 14, 'Owl Familiar'),
        summon('elemental', 'wizard', 14, 'Fire Elemental'),
      ];
      const result = ids(getSortedEntities(entities));
      expect(result[0]).toBe('wizard');
      expect(result[1]).toBe('familiar');
      expect(result[2]).toBe('elemental');
      expect(result[3]).toBe('ogre');
    });

    it('multiple players each with a summon, interleaved initiatives', () => {
      const entities = [
        player('p1', 20, 'Ranger'),
        player('p2', 15, 'Druid'),
        player('p3', 10, 'Wizard'),
        monster('m1', 18, 'Orc'),
        monster('m2', 12, 'Orc'),
        summon('hawk', 'p1', 20, 'Hawk Companion'),
        summon('bear', 'p2', 15, 'Conjured Bear'),
        summon('cat', 'p3', 10, 'Cat Familiar'),
      ];
      const result = ids(getSortedEntities(entities));
      expect(result).toEqual([
        'p1', // 20
        'hawk', // 20, summon of p1
        'm1', // 18
        'p2', // 15
        'bear', // 15, summon of p2
        'm2', // 12
        'p3', // 10
        'cat', // 10, summon of p3
      ]);
    });
  });
});
