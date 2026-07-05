import { describe, it, expect, beforeEach } from 'vitest';
import { useEncounterStore } from '@/store/encounterStore';
import { createMockEncounterEntity } from '@/test/helpers';

function resetStore() {
  useEncounterStore.setState({
    encounters: [],
    activeEncounterId: null,
  });
}

/** Helper: create an encounter and add entities to it, returns encounter id */
function setupEncounterWithEntities(
  entities: Parameters<typeof createMockEncounterEntity>[0][] = []
) {
  const store = useEncounterStore.getState();
  const encId = store.createEncounter('Test Battle', 'CAMP01');
  for (const overrides of entities) {
    store.addEntity(encId, createMockEncounterEntity(overrides));
  }
  return encId;
}

describe('encounterStore', () => {
  beforeEach(resetStore);

  // ── Encounter CRUD ──

  describe('createEncounter', () => {
    it('creates an encounter and sets it active', () => {
      const id = useEncounterStore.getState().createEncounter('Fight!', 'ABC');
      const state = useEncounterStore.getState();
      expect(state.encounters).toHaveLength(1);
      expect(state.encounters[0].name).toBe('Fight!');
      expect(state.encounters[0].campaignCode).toBe('ABC');
      expect(state.encounters[0].isActive).toBe(false);
      expect(state.encounters[0].round).toBe(0);
      expect(state.activeEncounterId).toBe(id);
    });
  });

  describe('deleteEncounter', () => {
    it('removes the encounter', () => {
      const id = useEncounterStore.getState().createEncounter('Temp');
      useEncounterStore.getState().deleteEncounter(id);
      expect(useEncounterStore.getState().encounters).toHaveLength(0);
    });

    it('clears activeEncounterId if deleted', () => {
      const id = useEncounterStore.getState().createEncounter('Temp');
      useEncounterStore.getState().deleteEncounter(id);
      expect(useEncounterStore.getState().activeEncounterId).toBeNull();
    });

    it('preserves activeEncounterId when deleting a different encounter', () => {
      const id1 = useEncounterStore.getState().createEncounter('One');
      useEncounterStore.getState().createEncounter('Two');
      // activeEncounterId is now id of "Two"
      useEncounterStore.getState().deleteEncounter(id1);
      expect(useEncounterStore.getState().activeEncounterId).not.toBeNull();
      expect(useEncounterStore.getState().encounters).toHaveLength(1);
    });
  });

  describe('updateEncounter', () => {
    it('updates encounter fields', () => {
      const id = useEncounterStore.getState().createEncounter('Old Name');
      useEncounterStore.getState().updateEncounter(id, { name: 'New Name' });
      expect(useEncounterStore.getState().getEncounter(id)?.name).toBe(
        'New Name'
      );
    });
  });

  // ── Entity management ──

  describe('addEntity / removeEntity', () => {
    it('adds an entity to an encounter', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity({ name: 'Orc' }));

      const enc = useEncounterStore.getState().getEncounter(encId)!;
      expect(enc.entities).toHaveLength(1);
      expect(enc.entities[0].name).toBe('Orc');
      expect(enc.entities[0].id).toBe(entityId);
    });

    it('removes an entity', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity());
      useEncounterStore.getState().removeEntity(encId, entityId);

      const enc = useEncounterStore.getState().getEncounter(encId)!;
      expect(enc.entities).toHaveLength(0);
    });
  });

  describe('updateEntity', () => {
    it('updates specific entity fields', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity({ name: 'Goblin' }));

      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { name: 'Hobgoblin', armorClass: 18 });

      const entity = useEncounterStore
        .getState()
        .getEncounter(encId)!
        .entities.find(e => e.id === entityId)!;
      expect(entity.name).toBe('Hobgoblin');
      expect(entity.armorClass).toBe(18);
      expect(entity.currentHp).toBe(7); // unchanged
    });
  });

  // ── Combat flow ──

  describe('startCombat', () => {
    it('sorts entities by initiative descending and sets round 1', () => {
      const encId = setupEncounterWithEntities([
        { name: 'Slow', initiative: 5, initiativeModifier: 0 },
        { name: 'Fast', initiative: 20, initiativeModifier: 3 },
        { name: 'Mid', initiative: 12, initiativeModifier: 1 },
      ]);

      useEncounterStore.getState().startCombat(encId);
      const enc = useEncounterStore.getState().getEncounter(encId)!;

      expect(enc.isActive).toBe(true);
      expect(enc.round).toBe(1);
      expect(enc.currentTurn).toBe(0);
      expect(enc.entities.map(e => e.name)).toEqual(['Fast', 'Mid', 'Slow']);
    });

    it('lair entities lose initiative ties', () => {
      const encId = setupEncounterWithEntities([
        {
          name: 'Dragon',
          initiative: 20,
          initiativeModifier: 0,
          type: 'monster',
        },
        {
          name: "Dragon's Lair",
          initiative: 20,
          initiativeModifier: 0,
          type: 'lair',
        },
      ]);

      useEncounterStore.getState().startCombat(encId);
      const enc = useEncounterStore.getState().getEncounter(encId)!;
      expect(enc.entities[0].name).toBe('Dragon');
      expect(enc.entities[1].name).toBe("Dragon's Lair");
    });
  });

  describe('endCombat', () => {
    it('sets isActive to false', () => {
      const encId = setupEncounterWithEntities([
        { name: 'A', initiative: 10, initiativeModifier: 0 },
      ]);
      useEncounterStore.getState().startCombat(encId);
      useEncounterStore.getState().endCombat(encId);

      expect(useEncounterStore.getState().getEncounter(encId)!.isActive).toBe(
        false
      );
    });
  });

  describe('nextTurn / prevTurn', () => {
    it('advances turn index', () => {
      const encId = setupEncounterWithEntities([
        { name: 'A', initiative: 20, initiativeModifier: 0 },
        { name: 'B', initiative: 10, initiativeModifier: 0 },
      ]);
      useEncounterStore.getState().startCombat(encId);
      useEncounterStore.getState().nextTurn(encId);

      const enc = useEncounterStore.getState().getEncounter(encId)!;
      expect(enc.currentTurn).toBe(1);
      expect(enc.round).toBe(1);
    });

    it('wraps to next round', () => {
      const encId = setupEncounterWithEntities([
        { name: 'A', initiative: 20, initiativeModifier: 0 },
        { name: 'B', initiative: 10, initiativeModifier: 0 },
      ]);
      useEncounterStore.getState().startCombat(encId);
      useEncounterStore.getState().nextTurn(encId); // turn 1
      useEncounterStore.getState().nextTurn(encId); // wrap → round 2, turn 0

      const enc = useEncounterStore.getState().getEncounter(encId)!;
      expect(enc.currentTurn).toBe(0);
      expect(enc.round).toBe(2);
    });

    it('resets lair actions on new round', () => {
      const encId = setupEncounterWithEntities([
        {
          name: 'Fighter',
          initiative: 15,
          initiativeModifier: 0,
          type: 'monster',
        },
        {
          name: 'Lair',
          initiative: 20,
          initiativeModifier: 0,
          type: 'lair',
          lairActions: [
            {
              id: 'la-1',
              name: 'Tremor',
              description: 'Shake',
              usedThisRound: true,
            },
          ],
        },
      ]);
      useEncounterStore.getState().startCombat(encId);
      // Advance past all entities to trigger new round
      useEncounterStore.getState().nextTurn(encId);
      useEncounterStore.getState().nextTurn(encId);

      const enc = useEncounterStore.getState().getEncounter(encId)!;
      const lair = enc.entities.find(e => e.type === 'lair')!;
      expect(lair.lairActions![0].usedThisRound).toBe(false);
    });

    it('prevTurn goes back and decrements round when at turn 0', () => {
      const encId = setupEncounterWithEntities([
        { name: 'A', initiative: 20, initiativeModifier: 0 },
        { name: 'B', initiative: 10, initiativeModifier: 0 },
      ]);
      useEncounterStore.getState().startCombat(encId);
      // Advance to round 2
      useEncounterStore.getState().nextTurn(encId);
      useEncounterStore.getState().nextTurn(encId);
      expect(useEncounterStore.getState().getEncounter(encId)!.round).toBe(2);

      useEncounterStore.getState().prevTurn(encId);
      const enc = useEncounterStore.getState().getEncounter(encId)!;
      expect(enc.currentTurn).toBe(1); // last entity
      expect(enc.round).toBe(1);
    });

    it('prevTurn does not go below round 1', () => {
      const encId = setupEncounterWithEntities([
        { name: 'A', initiative: 20, initiativeModifier: 0 },
      ]);
      useEncounterStore.getState().startCombat(encId);
      useEncounterStore.getState().prevTurn(encId);

      const enc = useEncounterStore.getState().getEncounter(encId)!;
      expect(enc.round).toBe(1);
    });
  });

  // ── Initiative ──

  describe('setInitiative', () => {
    it('sets initiative for an entity', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity());

      useEncounterStore.getState().setInitiative(encId, entityId, 17);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.initiative).toBe(17);
    });
  });

  describe('rollInitiative', () => {
    it('returns a value between 1+mod and 20+mod', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity({ initiativeModifier: 3 }));

      const result = useEncounterStore
        .getState()
        .rollInitiative(encId, entityId);

      expect(result).toBeGreaterThanOrEqual(4);
      expect(result).toBeLessThanOrEqual(23);
    });
  });

  describe('rollAllInitiatives', () => {
    it('sets lair to 20 and skips players', () => {
      const encId = setupEncounterWithEntities([
        { name: 'Monster', type: 'monster', initiativeModifier: 2 },
        {
          name: 'Player',
          type: 'player',
          initiative: null,
          initiativeModifier: 1,
        },
        { name: 'Lair', type: 'lair', initiativeModifier: 0 },
      ]);

      useEncounterStore.getState().rollAllInitiatives(encId);
      const enc = useEncounterStore.getState().getEncounter(encId)!;

      const monster = enc.entities.find(e => e.name === 'Monster')!;
      const player = enc.entities.find(e => e.name === 'Player')!;
      const lair = enc.entities.find(e => e.name === 'Lair')!;

      expect(monster.initiative).toBeGreaterThanOrEqual(3);
      expect(monster.initiative).toBeLessThanOrEqual(22);
      expect(player.initiative).toBeNull(); // unchanged
      expect(lair.initiative).toBe(20);
    });
  });

  // ── HP management ──

  describe('damageEntity', () => {
    it('reduces HP', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 20, maxHp: 20, tempHp: 0 })
        );

      useEncounterStore.getState().damageEntity(encId, entityId, 8);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.currentHp).toBe(12);
      expect(entity.tempHp).toBe(0);
    });

    it('temp HP absorbs damage first', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 20, maxHp: 20, tempHp: 5 })
        );

      useEncounterStore.getState().damageEntity(encId, entityId, 8);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.tempHp).toBe(0);
      expect(entity.currentHp).toBe(17); // 8-5=3 overflow, 20-3=17
    });

    it('temp HP fully absorbs small damage', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 20, maxHp: 20, tempHp: 10 })
        );

      useEncounterStore.getState().damageEntity(encId, entityId, 3);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.tempHp).toBe(7);
      expect(entity.currentHp).toBe(20);
    });

    it('does not go below 0 HP', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 5, maxHp: 20, tempHp: 0 })
        );

      useEncounterStore.getState().damageEntity(encId, entityId, 100);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.currentHp).toBe(0);
    });
  });

  describe('healEntity', () => {
    it('heals up to max HP', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 5, maxHp: 20 })
        );

      useEncounterStore.getState().healEntity(encId, entityId, 10);

      expect(
        useEncounterStore.getState().getEncounter(encId)!.entities[0].currentHp
      ).toBe(15);
    });

    it('does not exceed max HP', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 18, maxHp: 20 })
        );

      useEncounterStore.getState().healEntity(encId, entityId, 10);

      expect(
        useEncounterStore.getState().getEncounter(encId)!.entities[0].currentHp
      ).toBe(20);
    });
  });

  // ── Conditions ──

  describe('addCondition / removeCondition', () => {
    it('adds a condition to an entity', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity());

      useEncounterStore
        .getState()
        .addCondition(encId, entityId, { name: 'Stunned', source: 'dm' });

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.conditions).toHaveLength(1);
      expect(entity.conditions[0].name).toBe('Stunned');
      expect(entity.conditions[0].id).toBeTruthy();
    });

    it('removes a condition by id', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity());

      useEncounterStore
        .getState()
        .addCondition(encId, entityId, { name: 'Poisoned', source: 'dm' });
      const conditionId = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].conditions[0].id;

      useEncounterStore
        .getState()
        .removeCondition(encId, entityId, conditionId);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.conditions).toHaveLength(0);
    });
  });

  // ── Abilities ──

  describe('useAbility / restoreAbility', () => {
    it('increments usedUses', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          abilities: [
            {
              id: 'ab-1',
              name: 'Breath Weapon',
              description: 'Fire',
              usageType: 'recharge',
              rechargeOn: 5,
              maxUses: 1,
              usedUses: 0,
            },
          ],
        })
      );

      useEncounterStore.getState().useAbility(encId, entityId, 'ab-1');

      const ability = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].abilities![0];
      expect(ability.usedUses).toBe(1);
    });

    it('does not exceed maxUses', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          abilities: [
            {
              id: 'ab-1',
              name: 'Power',
              description: 'Desc',
              usageType: 'per-day',
              maxUses: 1,
              usedUses: 1,
            },
          ],
        })
      );

      useEncounterStore.getState().useAbility(encId, entityId, 'ab-1');

      const ability = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].abilities![0];
      expect(ability.usedUses).toBe(1); // capped
    });

    it('restoreAbility decrements usedUses', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          abilities: [
            {
              id: 'ab-1',
              name: 'Power',
              description: 'Desc',
              usageType: 'per-day',
              maxUses: 3,
              usedUses: 2,
            },
          ],
        })
      );

      useEncounterStore.getState().restoreAbility(encId, entityId, 'ab-1');

      const ability = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].abilities![0];
      expect(ability.usedUses).toBe(1);
    });

    it('restoreAbility does not go below 0', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          abilities: [
            {
              id: 'ab-1',
              name: 'Power',
              description: 'Desc',
              usageType: 'per-day',
              maxUses: 3,
              usedUses: 0,
            },
          ],
        })
      );

      useEncounterStore.getState().restoreAbility(encId, entityId, 'ab-1');

      const ability = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].abilities![0];
      expect(ability.usedUses).toBe(0);
    });
  });

  // ── Legendary Actions ──

  describe('useLegendaryAction / resetLegendaryActions', () => {
    function setupLegendary() {
      const encId = useEncounterStore.getState().createEncounter('Boss Fight');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          legendaryActions: {
            maxActions: 3,
            usedActions: 0,
            actions: [
              {
                id: 'la-detect',
                name: 'Detect',
                cost: 1,
                description: 'Perceive',
              },
              {
                id: 'la-wing',
                name: 'Wing Attack',
                cost: 2,
                description: 'Wings',
              },
            ],
          },
        })
      );
      return { encId, entityId };
    }

    it('uses a legendary action and tracks cost', () => {
      const { encId, entityId } = setupLegendary();
      useEncounterStore
        .getState()
        .useLegendaryAction(encId, entityId, 'la-detect');

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.legendaryActions!.usedActions).toBe(1);
    });

    it('rejects action when cost exceeds remaining', () => {
      const { encId, entityId } = setupLegendary();
      // Use 2 (wing attack)
      useEncounterStore
        .getState()
        .useLegendaryAction(encId, entityId, 'la-wing');
      // Try wing attack again (costs 2, only 1 remaining) — should be rejected
      useEncounterStore
        .getState()
        .useLegendaryAction(encId, entityId, 'la-wing');

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.legendaryActions!.usedActions).toBe(2); // not 4
    });

    it('resetLegendaryActions sets usedActions to 0', () => {
      const { encId, entityId } = setupLegendary();
      useEncounterStore
        .getState()
        .useLegendaryAction(encId, entityId, 'la-detect');
      useEncounterStore.getState().resetLegendaryActions(encId, entityId);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.legendaryActions!.usedActions).toBe(0);
    });
  });

  // ── Concentration ──

  describe('setConcentration', () => {
    it('sets concentration spell name', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity());

      useEncounterStore
        .getState()
        .setConcentration(encId, entityId, 'Hold Person');

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.concentrationSpell).toBe('Hold Person');
    });

    it('clears concentration with null', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity());

      useEncounterStore.getState().setConcentration(encId, entityId, 'Bless');
      useEncounterStore.getState().setConcentration(encId, entityId, null);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.concentrationSpell).toBeUndefined();
    });
  });

  // ── Lair Actions ──

  describe('useLairAction / resetLairActions', () => {
    it('marks a lair action as used', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          type: 'lair',
          lairActions: [
            {
              id: 'la-1',
              name: 'Quake',
              description: 'Shake ground',
              usedThisRound: false,
            },
            {
              id: 'la-2',
              name: 'Flood',
              description: 'Water rises',
              usedThisRound: false,
            },
          ],
        })
      );

      useEncounterStore.getState().useLairAction(encId, entityId, 'la-1');

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.lairActions![0].usedThisRound).toBe(true);
      expect(entity.lairActions![1].usedThisRound).toBe(false);
    });

    it('resetLairActions resets all to unused', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          type: 'lair',
          lairActions: [
            {
              id: 'la-1',
              name: 'Quake',
              description: 'Shake',
              usedThisRound: true,
            },
            {
              id: 'la-2',
              name: 'Flood',
              description: 'Water',
              usedThisRound: true,
            },
          ],
        })
      );

      useEncounterStore.getState().resetLairActions(encId, entityId);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.lairActions!.every(la => !la.usedThisRound)).toBe(true);
    });
  });

  // ── Queries ──

  describe('getEncountersByCampaign', () => {
    it('returns only encounters matching the campaign code', () => {
      const store = useEncounterStore.getState();
      store.createEncounter('Alpha', 'CAMP-A');
      store.createEncounter('Beta', 'CAMP-B');
      store.createEncounter('Gamma', 'CAMP-A');

      const results = useEncounterStore
        .getState()
        .getEncountersByCampaign('CAMP-A');

      expect(results).toHaveLength(2);
      expect(results.every(e => e.campaignCode === 'CAMP-A')).toBe(true);
      expect(results.map(e => e.name)).toEqual(
        expect.arrayContaining(['Alpha', 'Gamma'])
      );
    });

    it('returns empty array when no encounters match', () => {
      useEncounterStore.getState().createEncounter('Solo', 'CAMP-X');

      const results = useEncounterStore
        .getState()
        .getEncountersByCampaign('CAMP-MISSING');

      expect(results).toHaveLength(0);
    });
  });

  // ── Active encounter ──

  describe('setActiveEncounter', () => {
    it('sets the active encounter id', () => {
      const id = useEncounterStore.getState().createEncounter('Fight');
      useEncounterStore.getState().setActiveEncounter(null);
      expect(useEncounterStore.getState().activeEncounterId).toBeNull();

      useEncounterStore.getState().setActiveEncounter(id);
      expect(useEncounterStore.getState().activeEncounterId).toBe(id);
    });
  });

  // ── setTurn ──

  describe('setTurn', () => {
    it('jumps to the specified entity index', () => {
      const encId = setupEncounterWithEntities([
        { name: 'A', initiative: 20, initiativeModifier: 0 },
        { name: 'B', initiative: 15, initiativeModifier: 0 },
        { name: 'C', initiative: 10, initiativeModifier: 0 },
      ]);
      useEncounterStore.getState().startCombat(encId);

      const enc = useEncounterStore.getState().getEncounter(encId)!;
      const targetEntityId = enc.entities[2].id; // 'C'

      useEncounterStore.getState().setTurn(encId, targetEntityId);

      expect(
        useEncounterStore.getState().getEncounter(encId)!.currentTurn
      ).toBe(2);
    });

    it('does nothing when entity id is not found', () => {
      const encId = setupEncounterWithEntities([
        { name: 'A', initiative: 20, initiativeModifier: 0 },
      ]);
      useEncounterStore.getState().startCombat(encId);

      useEncounterStore.getState().setTurn(encId, 'nonexistent-id');

      expect(
        useEncounterStore.getState().getEncounter(encId)!.currentTurn
      ).toBe(0);
    });
  });

  // ── HP: setEntityHp ──

  describe('setEntityHp', () => {
    it('sets current HP directly', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 10, maxHp: 20 })
        );

      useEncounterStore.getState().setEntityHp(encId, entityId, 15);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.currentHp).toBe(15);
      expect(entity.maxHp).toBe(20); // unchanged
    });

    it('clamps current HP to max', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 10, maxHp: 20 })
        );

      useEncounterStore.getState().setEntityHp(encId, entityId, 999);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.currentHp).toBe(20);
    });

    it('clamps current HP to 0 minimum', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 10, maxHp: 20 })
        );

      useEncounterStore.getState().setEntityHp(encId, entityId, -5);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.currentHp).toBe(0);
    });

    it('updates max HP when provided', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 10, maxHp: 20 })
        );

      useEncounterStore.getState().setEntityHp(encId, entityId, 25, 30);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.maxHp).toBe(30);
      expect(entity.currentHp).toBe(25);
    });
  });

  // ── HP: addTempHp ──

  describe('addTempHp', () => {
    it('sets temp HP when entity has none', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 10, maxHp: 10, tempHp: 0 })
        );

      useEncounterStore.getState().addTempHp(encId, entityId, 8);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.tempHp).toBe(8);
    });

    it('takes the higher value when new temp HP is greater', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 10, maxHp: 10, tempHp: 5 })
        );

      useEncounterStore.getState().addTempHp(encId, entityId, 12);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.tempHp).toBe(12);
    });

    it('keeps existing temp HP when new value is lower', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 10, maxHp: 10, tempHp: 10 })
        );

      useEncounterStore.getState().addTempHp(encId, entityId, 3);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.tempHp).toBe(10);
    });
  });

  // ── Conditions: updateCondition ──

  describe('updateCondition', () => {
    it('updates specific fields of an existing condition', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity());

      useEncounterStore.getState().addCondition(encId, entityId, {
        name: 'Frightened',
        source: 'dm',
        duration: '3 rounds',
      });
      const conditionId = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].conditions[0].id;

      useEncounterStore
        .getState()
        .updateCondition(encId, entityId, conditionId, { duration: '1 round' });

      const condition = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].conditions[0];
      expect(condition.duration).toBe('1 round');
      expect(condition.name).toBe('Frightened'); // unchanged
    });

    it('does not affect other conditions', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity());

      useEncounterStore
        .getState()
        .addCondition(encId, entityId, { name: 'Blinded', source: 'dm' });
      useEncounterStore
        .getState()
        .addCondition(encId, entityId, { name: 'Deafened', source: 'dm' });

      const conditions = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].conditions;
      const blindedId = conditions.find(c => c.name === 'Blinded')!.id;

      useEncounterStore
        .getState()
        .updateCondition(encId, entityId, blindedId, { duration: '5 rounds' });

      const updated = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].conditions;
      expect(updated.find(c => c.name === 'Blinded')!.duration).toBe(
        '5 rounds'
      );
      expect(
        updated.find(c => c.name === 'Deafened')!.duration
      ).toBeUndefined();
    });
  });

  // ── reorderEntities ──

  describe('reorderEntities', () => {
    it('reorders entities to match the supplied id order', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const idA = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity({ name: 'A' }));
      const idB = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity({ name: 'B' }));
      const idC = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity({ name: 'C' }));

      useEncounterStore.getState().reorderEntities(encId, [idC, idA, idB]);

      const entities = useEncounterStore
        .getState()
        .getEncounter(encId)!.entities;
      expect(entities.map(e => e.name)).toEqual(['C', 'A', 'B']);
    });

    it('sets sortOrder to manual', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const idA = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity({ name: 'A' }));

      useEncounterStore.getState().reorderEntities(encId, [idA]);

      expect(useEncounterStore.getState().getEncounter(encId)!.sortOrder).toBe(
        'manual'
      );
    });

    it('ignores unknown entity ids', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const idA = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity({ name: 'A' }));
      const idB = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity({ name: 'B' }));

      // Provide one valid and one bogus id
      useEncounterStore
        .getState()
        .reorderEntities(encId, [idB, 'ghost-id', idA]);

      const entities = useEncounterStore
        .getState()
        .getEncounter(encId)!.entities;
      expect(entities.map(e => e.name)).toEqual(['B', 'A']);
    });
  });

  // ── longRestEntity ──

  describe('longRestEntity', () => {
    it('restores HP to max and clears temp HP', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(
          encId,
          createMockEncounterEntity({ currentHp: 3, maxHp: 30, tempHp: 5 })
        );

      useEncounterStore.getState().longRestEntity(encId, entityId);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.currentHp).toBe(30);
      expect(entity.tempHp).toBe(0);
    });

    it('clears death saves and concentration', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          currentHp: 0,
          maxHp: 20,
          tempHp: 0,
          concentrationSpell: 'Haste',
          deathSaves: { successes: 1, failures: 2, isStabilized: false },
          hasUsedReaction: true,
        })
      );

      useEncounterStore.getState().longRestEntity(encId, entityId);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.deathSaves).toBeUndefined();
      expect(entity.concentrationSpell).toBeUndefined();
      expect(entity.hasUsedReaction).toBe(false);
    });

    it('resets ability usedUses to 0', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          currentHp: 5,
          maxHp: 20,
          abilities: [
            {
              id: 'ab-1',
              name: 'Breath',
              description: 'Fire',
              usageType: 'recharge',
              rechargeOn: 5,
              maxUses: 1,
              usedUses: 1,
            },
            {
              id: 'ab-2',
              name: 'Claw',
              description: 'Slash',
              usageType: 'per-day',
              maxUses: 3,
              usedUses: 2,
            },
          ],
        })
      );

      useEncounterStore.getState().longRestEntity(encId, entityId);

      const abilities = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].abilities!;
      expect(abilities.every(a => a.usedUses === 0)).toBe(true);
    });

    it('resets legendary action usedActions to 0', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          currentHp: 5,
          maxHp: 40,
          legendaryActions: {
            maxActions: 3,
            usedActions: 3,
            actions: [
              { id: 'la-1', name: 'Detect', cost: 1, description: 'Perceive' },
            ],
          },
        })
      );

      useEncounterStore.getState().longRestEntity(encId, entityId);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.legendaryActions!.usedActions).toBe(0);
    });

    it('resets spell slot used counts to 0', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          currentHp: 5,
          maxHp: 20,
          spellcasting: {
            ability: 'intelligence',
            dc: 15,
            toHit: 7,
            atWill: [],
            perDay: {},
            slots: {
              1: { max: 4, used: 4 },
              2: { max: 3, used: 2 },
            },
            usedSpells: { 'magic-missile': 1 },
          },
        })
      );

      useEncounterStore.getState().longRestEntity(encId, entityId);

      const spellcasting = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].spellcasting!;
      expect(spellcasting.slots![1].used).toBe(0);
      expect(spellcasting.slots![2].used).toBe(0);
      expect(spellcasting.usedSpells).toEqual({});
    });

    it('restores hit dice current to max', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          currentHp: 5,
          maxHp: 20,
          hitDice: { dieType: 'd8', max: 5, current: 2 },
        })
      );

      useEncounterStore.getState().longRestEntity(encId, entityId);

      const entity = useEncounterStore.getState().getEncounter(encId)!
        .entities[0];
      expect(entity.hitDice!.current).toBe(5);
    });
  });

  // ── condition rounds ──

  describe('condition rounds', () => {
    it('decrements timed conditions at start of owner turn and removes at 0', () => {
      const encId = useEncounterStore.getState().createEncounter('Timed Conds');
      const _entityIdA = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          name: 'A',
          initiative: 20,
          initiativeModifier: 0,
        })
      );
      const entityIdB = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          name: 'B',
          initiative: 10,
          initiativeModifier: 0,
        })
      );

      useEncounterStore
        .getState()
        .addCondition(encId, entityIdB, {
          name: 'Bless',
          kind: 'buff',
          rounds: 2,
          source: 'dm',
        });
      useEncounterStore
        .getState()
        .addCondition(encId, entityIdB, { name: 'Prone', source: 'dm' });

      useEncounterStore.getState().startCombat(encId); // currentTurn = 0 (A)

      // Advance to B's turn → applyTurnStart on B → Bless: 2→1, Prone untouched
      useEncounterStore.getState().nextTurn(encId);

      let enc = useEncounterStore.getState().getEncounter(encId)!;
      let entityB = enc.entities.find(e => e.name === 'B')!;
      expect(entityB.conditions.find(c => c.name === 'Bless')?.rounds).toBe(1);
      expect(entityB.conditions.find(c => c.name === 'Prone')).toBeDefined();
      expect(
        entityB.conditions.find(c => c.name === 'Prone')?.rounds
      ).toBeUndefined();

      // Advance to A's turn (new round) → applyTurnStart on A (no timed conds)
      useEncounterStore.getState().nextTurn(encId);
      // Advance to B's turn again → applyTurnStart on B → Bless: 1→0 → removed
      useEncounterStore.getState().nextTurn(encId);

      enc = useEncounterStore.getState().getEncounter(encId)!;
      entityB = enc.entities.find(e => e.name === 'B')!;
      expect(entityB.conditions.find(c => c.name === 'Bless')).toBeUndefined();
      expect(entityB.conditions.find(c => c.name === 'Prone')).toBeDefined();
    });

    it('setConditionRounds sets, clears (null), and removes at 0', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const entityId = useEncounterStore
        .getState()
        .addEntity(encId, createMockEncounterEntity());
      useEncounterStore
        .getState()
        .addCondition(encId, entityId, { name: 'Poisoned', source: 'dm' });
      const conditionId = useEncounterStore.getState().getEncounter(encId)!
        .entities[0].conditions[0].id;

      // Set rounds to 3
      useEncounterStore
        .getState()
        .setConditionRounds(encId, entityId, conditionId, 3);
      expect(
        useEncounterStore.getState().getEncounter(encId)!.entities[0]
          .conditions[0].rounds
      ).toBe(3);

      // Clear to untimed (null)
      useEncounterStore
        .getState()
        .setConditionRounds(encId, entityId, conditionId, null);
      expect(
        useEncounterStore.getState().getEncounter(encId)!.entities[0]
          .conditions[0].rounds
      ).toBeNull();

      // Set to 0 → condition is removed
      useEncounterStore
        .getState()
        .setConditionRounds(encId, entityId, conditionId, 0);
      expect(
        useEncounterStore.getState().getEncounter(encId)!.entities[0].conditions
      ).toHaveLength(0);
    });

    it('prevTurn does not decrement rounds', () => {
      const encId = useEncounterStore.getState().createEncounter('Battle');
      const _entityIdA = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          name: 'A',
          initiative: 20,
          initiativeModifier: 0,
        })
      );
      const entityIdB = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          name: 'B',
          initiative: 10,
          initiativeModifier: 0,
        })
      );
      useEncounterStore
        .getState()
        .addCondition(encId, entityIdB, {
          name: 'Bless',
          kind: 'buff',
          rounds: 2,
          source: 'dm',
        });

      useEncounterStore.getState().startCombat(encId); // currentTurn = 0 (A)

      // nextTurn → B's turn → Bless decrements to 1
      useEncounterStore.getState().nextTurn(encId);
      const afterNext = useEncounterStore.getState().getEncounter(encId)!;
      expect(
        afterNext.entities
          .find(e => e.name === 'B')!
          .conditions.find(c => c.name === 'Bless')?.rounds
      ).toBe(1);

      // prevTurn → back to A; Bless on B must NOT change
      useEncounterStore.getState().prevTurn(encId);
      const afterPrev = useEncounterStore.getState().getEncounter(encId)!;
      expect(
        afterPrev.entities
          .find(e => e.name === 'B')!
          .conditions.find(c => c.name === 'Bless')?.rounds
      ).toBe(1);
    });
  });

  // ── legendary auto-reset ──

  describe('legendary auto-reset', () => {
    it('resets usedActions to 0 at start of the owner turn', () => {
      const encId = useEncounterStore.getState().createEncounter('Boss Fight');
      useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          name: 'Dragon',
          initiative: 20,
          initiativeModifier: 0,
          legendaryActions: {
            maxActions: 3,
            usedActions: 2,
            actions: [
              { id: 'la-1', name: 'Detect', cost: 1, description: 'Sense' },
            ],
          },
        })
      );
      useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          name: 'Fighter',
          initiative: 10,
          initiativeModifier: 0,
        })
      );

      useEncounterStore.getState().startCombat(encId); // currentTurn = 0 (Dragon, usedActions=2)

      // nextTurn → Fighter's turn → applyTurnStart on Fighter (no legendary)
      useEncounterStore.getState().nextTurn(encId);
      // nextTurn → Dragon's turn again (round 2) → applyTurnStart on Dragon → usedActions=0
      useEncounterStore.getState().nextTurn(encId);

      const entity = useEncounterStore
        .getState()
        .getEncounter(encId)!
        .entities.find(e => e.name === 'Dragon')!;
      expect(entity.legendaryActions!.usedActions).toBe(0);
    });
  });
});
