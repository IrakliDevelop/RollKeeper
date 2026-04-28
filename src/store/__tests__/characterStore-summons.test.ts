import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { Summon } from '@/types/summon';
import type { SavedCreature } from '@/types/summon';
import type { EncounterEntity, EncounterCondition } from '@/types/encounter';

function resetStore(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: { enableDeathAnimation: false, enableLevelUpAnimation: false },
    lastSelectedCharacterId: null,
  });
}

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'entity-1',
    type: 'monster',
    name: 'Test Creature',
    initiative: null,
    initiativeModifier: 0,
    currentHp: 20,
    maxHp: 20,
    tempHp: 0,
    armorClass: 13,
    conditions: [],
    ...overrides,
  };
}

function makeSummon(overrides: Partial<Summon> = {}): Summon {
  return {
    id: 'summon-1',
    type: 'summon',
    entity: makeEntity(),
    sourceSpellName: 'Conjure Animals',
    requiresConcentration: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSavedCreature(
  overrides: Partial<SavedCreature> = {}
): SavedCreature {
  return {
    id: 'creature-1',
    name: 'Imp',
    size: 'Tiny',
    type: 'Fiend',
    alignment: 'Lawful Evil',
    ac: 13,
    hp: 10,
    speed: '20 ft., fly 40 ft.',
    str: 6,
    dex: 17,
    con: 13,
    int: 11,
    wis: 12,
    cha: 14,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('characterStore — summon management', () => {
  beforeEach(() => resetStore());

  describe('addSummon', () => {
    it('adds a summon to the empty array', () => {
      const summon = makeSummon();
      useCharacterStore.getState().addSummon(summon);
      const { summons } = useCharacterStore.getState().character;
      expect(summons).toHaveLength(1);
      expect(summons![0].id).toBe('summon-1');
    });

    it('appends multiple non-familiar summons', () => {
      useCharacterStore
        .getState()
        .addSummon(makeSummon({ id: 'summon-1', type: 'summon' }));
      useCharacterStore
        .getState()
        .addSummon(makeSummon({ id: 'summon-2', type: 'summon' }));
      expect(useCharacterStore.getState().character.summons).toHaveLength(2);
    });

    it('replaces an existing familiar when a new familiar is added', () => {
      const first = makeSummon({ id: 'familiar-1', type: 'familiar' });
      const second = makeSummon({ id: 'familiar-2', type: 'familiar' });
      useCharacterStore.getState().addSummon(first);
      useCharacterStore.getState().addSummon(second);
      const { summons } = useCharacterStore.getState().character;
      expect(summons).toHaveLength(1);
      expect(summons![0].id).toBe('familiar-2');
    });

    it('keeps non-familiar summons when a familiar is added', () => {
      useCharacterStore
        .getState()
        .addSummon(makeSummon({ id: 'summon-1', type: 'summon' }));
      useCharacterStore
        .getState()
        .addSummon(makeSummon({ id: 'familiar-1', type: 'familiar' }));
      const { summons } = useCharacterStore.getState().character;
      expect(summons).toHaveLength(2);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().addSummon(makeSummon());
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('removeSummon', () => {
    it('removes a summon by id', () => {
      resetStore({ summons: [makeSummon({ id: 'summon-1' })] });
      useCharacterStore.getState().removeSummon('summon-1');
      expect(useCharacterStore.getState().character.summons).toHaveLength(0);
    });

    it('leaves other summons intact', () => {
      resetStore({
        summons: [
          makeSummon({ id: 'summon-1' }),
          makeSummon({ id: 'summon-2' }),
        ],
      });
      useCharacterStore.getState().removeSummon('summon-1');
      const { summons } = useCharacterStore.getState().character;
      expect(summons).toHaveLength(1);
      expect(summons![0].id).toBe('summon-2');
    });

    it('marks unsaved changes', () => {
      resetStore({ summons: [makeSummon()] });
      useCharacterStore.getState().removeSummon('summon-1');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('updateSummonEntity', () => {
    it('updates fields on the entity', () => {
      resetStore({ summons: [makeSummon()] });
      useCharacterStore
        .getState()
        .updateSummonEntity('summon-1', { armorClass: 17 });
      expect(
        useCharacterStore.getState().character.summons![0].entity.armorClass
      ).toBe(17);
    });

    it('leaves unrelated summons unchanged', () => {
      resetStore({
        summons: [
          makeSummon({ id: 'summon-1' }),
          makeSummon({
            id: 'summon-2',
            entity: makeEntity({ id: 'entity-2', armorClass: 10 }),
          }),
        ],
      });
      useCharacterStore
        .getState()
        .updateSummonEntity('summon-1', { armorClass: 20 });
      expect(
        useCharacterStore.getState().character.summons![1].entity.armorClass
      ).toBe(10);
    });

    it('marks unsaved changes', () => {
      resetStore({ summons: [makeSummon()] });
      useCharacterStore
        .getState()
        .updateSummonEntity('summon-1', { name: 'Renamed' });
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('damageSummon', () => {
    it('reduces currentHp', () => {
      resetStore({
        summons: [
          makeSummon({
            entity: makeEntity({ currentHp: 20, maxHp: 20, tempHp: 0 }),
          }),
        ],
      });
      useCharacterStore.getState().damageSummon('summon-1', 8);
      expect(
        useCharacterStore.getState().character.summons![0].entity.currentHp
      ).toBe(12);
    });

    it('absorbs damage into temp HP first', () => {
      resetStore({
        summons: [
          makeSummon({
            entity: makeEntity({ currentHp: 20, maxHp: 20, tempHp: 5 }),
          }),
        ],
      });
      useCharacterStore.getState().damageSummon('summon-1', 3);
      const entity = useCharacterStore.getState().character.summons![0].entity;
      expect(entity.tempHp).toBe(2);
      expect(entity.currentHp).toBe(20);
    });

    it('spills excess damage from temp HP into currentHp', () => {
      resetStore({
        summons: [
          makeSummon({
            entity: makeEntity({ currentHp: 20, maxHp: 20, tempHp: 5 }),
          }),
        ],
      });
      useCharacterStore.getState().damageSummon('summon-1', 8);
      const entity = useCharacterStore.getState().character.summons![0].entity;
      expect(entity.tempHp).toBe(0);
      expect(entity.currentHp).toBe(17);
    });

    it('does not reduce currentHp below 0', () => {
      resetStore({
        summons: [
          makeSummon({
            entity: makeEntity({ currentHp: 5, maxHp: 20, tempHp: 0 }),
          }),
        ],
      });
      useCharacterStore.getState().damageSummon('summon-1', 100);
      expect(
        useCharacterStore.getState().character.summons![0].entity.currentHp
      ).toBe(0);
    });

    it('marks unsaved changes', () => {
      resetStore({ summons: [makeSummon()] });
      useCharacterStore.getState().damageSummon('summon-1', 1);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('healSummon', () => {
    it('increases currentHp', () => {
      resetStore({
        summons: [
          makeSummon({
            entity: makeEntity({ currentHp: 10, maxHp: 20, tempHp: 0 }),
          }),
        ],
      });
      useCharacterStore.getState().healSummon('summon-1', 5);
      expect(
        useCharacterStore.getState().character.summons![0].entity.currentHp
      ).toBe(15);
    });

    it('caps healing at maxHp', () => {
      resetStore({
        summons: [
          makeSummon({
            entity: makeEntity({ currentHp: 18, maxHp: 20, tempHp: 0 }),
          }),
        ],
      });
      useCharacterStore.getState().healSummon('summon-1', 10);
      expect(
        useCharacterStore.getState().character.summons![0].entity.currentHp
      ).toBe(20);
    });

    it('marks unsaved changes', () => {
      resetStore({
        summons: [
          makeSummon({
            entity: makeEntity({ currentHp: 10, maxHp: 20, tempHp: 0 }),
          }),
        ],
      });
      useCharacterStore.getState().healSummon('summon-1', 1);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('addSummonTempHp', () => {
    it('sets temp HP when none exists', () => {
      resetStore({
        summons: [makeSummon({ entity: makeEntity({ tempHp: 0 }) })],
      });
      useCharacterStore.getState().addSummonTempHp('summon-1', 8);
      expect(
        useCharacterStore.getState().character.summons![0].entity.tempHp
      ).toBe(8);
    });

    it('keeps existing temp HP when it is higher', () => {
      resetStore({
        summons: [makeSummon({ entity: makeEntity({ tempHp: 10 }) })],
      });
      useCharacterStore.getState().addSummonTempHp('summon-1', 5);
      expect(
        useCharacterStore.getState().character.summons![0].entity.tempHp
      ).toBe(10);
    });

    it('replaces temp HP when the new amount is higher', () => {
      resetStore({
        summons: [makeSummon({ entity: makeEntity({ tempHp: 5 }) })],
      });
      useCharacterStore.getState().addSummonTempHp('summon-1', 10);
      expect(
        useCharacterStore.getState().character.summons![0].entity.tempHp
      ).toBe(10);
    });

    it('marks unsaved changes', () => {
      resetStore({ summons: [makeSummon()] });
      useCharacterStore.getState().addSummonTempHp('summon-1', 5);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('addSummonCondition', () => {
    it('adds a condition to the summon entity', () => {
      resetStore({ summons: [makeSummon()] });
      const condition: EncounterCondition = { id: 'cond-1', name: 'Poisoned' };
      useCharacterStore.getState().addSummonCondition('summon-1', condition);
      expect(
        useCharacterStore.getState().character.summons![0].entity.conditions
      ).toHaveLength(1);
      expect(
        useCharacterStore.getState().character.summons![0].entity.conditions[0]
          .name
      ).toBe('Poisoned');
    });

    it('appends to existing conditions', () => {
      const existingCondition: EncounterCondition = {
        id: 'cond-0',
        name: 'Blinded',
      };
      resetStore({
        summons: [
          makeSummon({
            entity: makeEntity({ conditions: [existingCondition] }),
          }),
        ],
      });
      const newCondition: EncounterCondition = {
        id: 'cond-1',
        name: 'Poisoned',
      };
      useCharacterStore.getState().addSummonCondition('summon-1', newCondition);
      expect(
        useCharacterStore.getState().character.summons![0].entity.conditions
      ).toHaveLength(2);
    });

    it('marks unsaved changes', () => {
      resetStore({ summons: [makeSummon()] });
      useCharacterStore
        .getState()
        .addSummonCondition('summon-1', { id: 'cond-1', name: 'Stunned' });
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('removeSummonCondition', () => {
    it('removes a condition by id', () => {
      const condition: EncounterCondition = { id: 'cond-1', name: 'Poisoned' };
      resetStore({
        summons: [
          makeSummon({ entity: makeEntity({ conditions: [condition] }) }),
        ],
      });
      useCharacterStore.getState().removeSummonCondition('summon-1', 'cond-1');
      expect(
        useCharacterStore.getState().character.summons![0].entity.conditions
      ).toHaveLength(0);
    });

    it('leaves other conditions intact', () => {
      const c1: EncounterCondition = { id: 'cond-1', name: 'Poisoned' };
      const c2: EncounterCondition = { id: 'cond-2', name: 'Blinded' };
      resetStore({
        summons: [makeSummon({ entity: makeEntity({ conditions: [c1, c2] }) })],
      });
      useCharacterStore.getState().removeSummonCondition('summon-1', 'cond-1');
      const { conditions } =
        useCharacterStore.getState().character.summons![0].entity;
      expect(conditions).toHaveLength(1);
      expect(conditions[0].id).toBe('cond-2');
    });

    it('marks unsaved changes', () => {
      const condition: EncounterCondition = { id: 'cond-1', name: 'Poisoned' };
      resetStore({
        summons: [
          makeSummon({ entity: makeEntity({ conditions: [condition] }) }),
        ],
      });
      useCharacterStore.getState().removeSummonCondition('summon-1', 'cond-1');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('removeConcentrationSummons', () => {
    it('removes all summons that require concentration', () => {
      resetStore({
        summons: [
          makeSummon({ id: 'summon-conc', requiresConcentration: true }),
          makeSummon({ id: 'summon-noconc', requiresConcentration: false }),
        ],
      });
      useCharacterStore.getState().removeConcentrationSummons();
      const { summons } = useCharacterStore.getState().character;
      expect(summons).toHaveLength(1);
      expect(summons![0].id).toBe('summon-noconc');
    });

    it('does nothing when there are no concentration summons', () => {
      resetStore({
        summons: [makeSummon({ requiresConcentration: false })],
      });
      useCharacterStore.getState().removeConcentrationSummons();
      expect(useCharacterStore.getState().character.summons).toHaveLength(1);
    });

    it('clears all summons when all require concentration', () => {
      resetStore({
        summons: [
          makeSummon({ id: 'summon-1', requiresConcentration: true }),
          makeSummon({ id: 'summon-2', requiresConcentration: true }),
        ],
      });
      useCharacterStore.getState().removeConcentrationSummons();
      expect(useCharacterStore.getState().character.summons).toHaveLength(0);
    });

    it('marks unsaved changes', () => {
      resetStore({ summons: [makeSummon({ requiresConcentration: true })] });
      useCharacterStore.getState().removeConcentrationSummons();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('dismissFamiliar', () => {
    it('removes familiar-type summons', () => {
      resetStore({
        summons: [
          makeSummon({ id: 'familiar-1', type: 'familiar' }),
          makeSummon({ id: 'summon-1', type: 'summon' }),
        ],
      });
      useCharacterStore.getState().dismissFamiliar();
      const { summons } = useCharacterStore.getState().character;
      expect(summons).toHaveLength(1);
      expect(summons![0].id).toBe('summon-1');
    });

    it('does not affect non-familiar summons', () => {
      resetStore({
        summons: [
          makeSummon({ id: 'summon-1', type: 'summon' }),
          makeSummon({ id: 'wild-shape-1', type: 'wild-shape' }),
        ],
      });
      useCharacterStore.getState().dismissFamiliar();
      expect(useCharacterStore.getState().character.summons).toHaveLength(2);
    });

    it('marks unsaved changes', () => {
      resetStore({ summons: [makeSummon({ type: 'familiar' })] });
      useCharacterStore.getState().dismissFamiliar();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });
});

describe('characterStore — saved creature templates', () => {
  beforeEach(() => resetStore());

  describe('addSavedCreature', () => {
    it('adds a saved creature', () => {
      const creature = makeSavedCreature();
      useCharacterStore.getState().addSavedCreature(creature);
      const { savedCreatures } = useCharacterStore.getState().character;
      expect(savedCreatures).toHaveLength(1);
      expect(savedCreatures![0].id).toBe('creature-1');
    });

    it('appends multiple saved creatures', () => {
      useCharacterStore
        .getState()
        .addSavedCreature(makeSavedCreature({ id: 'creature-1' }));
      useCharacterStore
        .getState()
        .addSavedCreature(
          makeSavedCreature({ id: 'creature-2', name: 'Quasit' })
        );
      expect(
        useCharacterStore.getState().character.savedCreatures
      ).toHaveLength(2);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().addSavedCreature(makeSavedCreature());
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('updateSavedCreature', () => {
    it('updates fields on the matching creature', () => {
      resetStore({ savedCreatures: [makeSavedCreature()] } as Parameters<
        typeof resetStore
      >[0]);
      useCharacterStore
        .getState()
        .updateSavedCreature('creature-1', { name: 'Quasit' });
      expect(
        useCharacterStore.getState().character.savedCreatures![0].name
      ).toBe('Quasit');
    });

    it('updates the updatedAt timestamp', () => {
      const before = new Date('2020-01-01').toISOString();
      resetStore({
        savedCreatures: [makeSavedCreature({ updatedAt: before })],
      } as Parameters<typeof resetStore>[0]);
      useCharacterStore
        .getState()
        .updateSavedCreature('creature-1', { hp: 20 });
      const updatedAt =
        useCharacterStore.getState().character.savedCreatures![0].updatedAt;
      expect(updatedAt).not.toBe(before);
    });

    it('leaves other creatures unchanged', () => {
      resetStore({
        savedCreatures: [
          makeSavedCreature({ id: 'creature-1', name: 'Imp' }),
          makeSavedCreature({ id: 'creature-2', name: 'Quasit' }),
        ],
      } as Parameters<typeof resetStore>[0]);
      useCharacterStore
        .getState()
        .updateSavedCreature('creature-1', { name: 'Renamed Imp' });
      expect(
        useCharacterStore.getState().character.savedCreatures![1].name
      ).toBe('Quasit');
    });

    it('marks unsaved changes', () => {
      resetStore({ savedCreatures: [makeSavedCreature()] } as Parameters<
        typeof resetStore
      >[0]);
      useCharacterStore
        .getState()
        .updateSavedCreature('creature-1', { hp: 15 });
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('removeSavedCreature', () => {
    it('removes the creature by id', () => {
      resetStore({ savedCreatures: [makeSavedCreature()] } as Parameters<
        typeof resetStore
      >[0]);
      useCharacterStore.getState().removeSavedCreature('creature-1');
      expect(
        useCharacterStore.getState().character.savedCreatures
      ).toHaveLength(0);
    });

    it('leaves other creatures intact', () => {
      resetStore({
        savedCreatures: [
          makeSavedCreature({ id: 'creature-1' }),
          makeSavedCreature({ id: 'creature-2', name: 'Quasit' }),
        ],
      } as Parameters<typeof resetStore>[0]);
      useCharacterStore.getState().removeSavedCreature('creature-1');
      const { savedCreatures } = useCharacterStore.getState().character;
      expect(savedCreatures).toHaveLength(1);
      expect(savedCreatures![0].id).toBe('creature-2');
    });

    it('marks unsaved changes', () => {
      resetStore({ savedCreatures: [makeSavedCreature()] } as Parameters<
        typeof resetStore
      >[0]);
      useCharacterStore.getState().removeSavedCreature('creature-1');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });
});
