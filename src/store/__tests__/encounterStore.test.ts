import { describe, it, expect, beforeEach } from 'vitest';
import { useEncounterStore } from '@/store/encounterStore';
import { useNPCStore } from '@/store/npcStore';
import { createMockEncounterEntity } from '@/test/helpers';
import { ensureStatBlockEntryIds } from '@/utils/statBlockAbilities';
import { buildNpcEntity } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/buildEntity';
import type { NpcResource, MonsterStatBlock } from '@/types/encounter';

function resetStore() {
  useEncounterStore.setState({
    encounters: [],
    encounterTombstones: {},
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
      expect(useEncounterStore.getState().encounterTombstones[id]).toEqual(
        expect.objectContaining({
          id,
          beforeImage: expect.objectContaining({ id, name: 'Temp' }),
        })
      );
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

      useEncounterStore.getState().addCondition(encId, entityIdB, {
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
      useEncounterStore.getState().addCondition(encId, entityIdB, {
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

  // ── Class resources ──

  const RES_CAMPAIGN = 'CAMP01'; // matches setupEncounterWithEntities campaign

  function resourceFixture(overrides: Partial<NpcResource> = {}): NpcResource {
    return {
      id: 'res-ws',
      name: 'Wild Shape',
      icon: 'paw-print',
      color: 'emerald',
      displayStyle: 'pips',
      maxUses: 4,
      usesExpended: 0,
      shortRestReset: 1,
      ...overrides,
    };
  }

  /** Creates a persistent NPC with resources plus a linked encounter entity. */
  function setupLinkedNpcEntity(
    resources: NpcResource[],
    entityOverrides: Record<string, unknown> = {}
  ) {
    useNPCStore.setState({ npcsByCampaign: {} });
    const npcId = useNPCStore.getState().createNPC(RES_CAMPAIGN, {
      name: 'Druid Elder',
      armorClass: '13',
      maxHp: 45,
      speed: '30 ft.',
      resources,
    });
    const store = useEncounterStore.getState();
    const encId = store.createEncounter('Test Battle', RES_CAMPAIGN);
    const entityId = store.addEntity(
      encId,
      createMockEncounterEntity({
        type: 'npc',
        npcSourceId: npcId,
        campaignCode: RES_CAMPAIGN,
        resources: resources.map(r => ({ ...r })),
        ...entityOverrides,
      })
    );
    return { npcId, encId, entityId };
  }

  function getEntityResources(encId: string, entityId: string) {
    return useEncounterStore
      .getState()
      .encounters.find(e => e.id === encId)!
      .entities.find(e => e.id === entityId)!.resources;
  }

  describe('encounterStore — spendEntityResource', () => {
    beforeEach(resetStore);

    it('linked: computes from NPC, writes both NPC and acting entity', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture(),
      ]);
      const ok = useEncounterStore
        .getState()
        .spendEntityResource(encId, entityId, 'res-ws', 2);
      expect(ok).toBe(true);
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.resources![0]
          .usesExpended
      ).toBe(2);
      expect(getEntityResources(encId, entityId)![0].usesExpended).toBe(2);
    });

    it('linked stale snapshot: rejects using NPC values, spends nothing, resyncs snapshot', () => {
      // NPC already fully spent; entity snapshot stale at 0 expended.
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture({ usesExpended: 0 }),
      ]);
      useNPCStore.getState().updateNPC(RES_CAMPAIGN, npcId, {
        resources: [resourceFixture({ usesExpended: 4 })],
      });
      const ok = useEncounterStore
        .getState()
        .spendEntityResource(encId, entityId, 'res-ws', 1);
      expect(ok).toBe(false);
      // NPC unchanged, entity snapshot resynced to authoritative 4.
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.resources![0]
          .usesExpended
      ).toBe(4);
      expect(getEntityResources(encId, entityId)![0].usesExpended).toBe(4);
    });

    it('two entity copies cannot overwrite newer expenditure (no lost update)', () => {
      const {
        npcId,
        encId,
        entityId: e1Id,
      } = setupLinkedNpcEntity([resourceFixture({ maxUses: 3 })]);
      const e2Id = useEncounterStore.getState().addEntity(
        encId,
        createMockEncounterEntity({
          type: 'npc',
          npcSourceId: npcId,
          campaignCode: RES_CAMPAIGN,
          resources: [resourceFixture({ maxUses: 3 })],
        })
      );
      useEncounterStore
        .getState()
        .spendEntityResource(encId, e1Id, 'res-ws', 2);
      // e2's snapshot is stale (0 expended) but the spend computes from the NPC (2 expended).
      const ok = useEncounterStore
        .getState()
        .spendEntityResource(encId, e2Id, 'res-ws', 1);
      expect(ok).toBe(true);
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.resources![0]
          .usesExpended
      ).toBe(3); // 2 + 1, never resurrected to 1
    });

    it('atomic: cost 2 with 1 remaining spends nothing', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture({ usesExpended: 3 }),
      ]);
      const ok = useEncounterStore
        .getState()
        .spendEntityResource(encId, entityId, 'res-ws', 2);
      expect(ok).toBe(false);
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.resources![0]
          .usesExpended
      ).toBe(3);
    });

    it('NPC deleted entirely: entity-only fallback with atomic check', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture({ usesExpended: 3 }),
      ]);
      useNPCStore.getState().deleteNPC(RES_CAMPAIGN, npcId);
      expect(
        useEncounterStore
          .getState()
          .spendEntityResource(encId, entityId, 'res-ws', 2)
      ).toBe(false);
      expect(getEntityResources(encId, entityId)![0].usesExpended).toBe(3);
      expect(
        useEncounterStore
          .getState()
          .spendEntityResource(encId, entityId, 'res-ws', 1)
      ).toBe(true);
      expect(getEntityResources(encId, entityId)![0].usesExpended).toBe(4);
    });

    it('resource deleted from existing NPC: rejects and removes from entity snapshot', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture(),
      ]);
      useNPCStore.getState().updateNPC(RES_CAMPAIGN, npcId, { resources: [] });
      const ok = useEncounterStore
        .getState()
        .spendEntityResource(encId, entityId, 'res-ws', 1);
      expect(ok).toBe(false);
      expect(getEntityResources(encId, entityId)).toEqual([]);
    });

    it('unknown resourceId on the entity is a no-op returning false', () => {
      const { encId, entityId } = setupLinkedNpcEntity([resourceFixture()]);
      expect(
        useEncounterStore
          .getState()
          .spendEntityResource(encId, entityId, 'nope', 1)
      ).toBe(false);
    });

    it('rejects zero, negative, and fractional amounts without mutation', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture({ usesExpended: 1 }),
      ]);
      for (const bad of [0, -2, 1.5]) {
        expect(
          useEncounterStore
            .getState()
            .spendEntityResource(encId, entityId, 'res-ws', bad)
        ).toBe(false);
      }
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.resources![0]
          .usesExpended
      ).toBe(1);
      expect(getEntityResources(encId, entityId)![0].usesExpended).toBe(1);
    });

    it('unlinked entity (no npcSourceId) spends against its own snapshot', () => {
      const store = useEncounterStore.getState();
      const encId = store.createEncounter('Test Battle', 'CAMP01');
      const entityId = store.addEntity(
        encId,
        createMockEncounterEntity({
          type: 'monster',
          resources: [resourceFixture()],
        })
      );
      expect(
        useEncounterStore
          .getState()
          .spendEntityResource(encId, entityId, 'res-ws', 4)
      ).toBe(true);
      expect(
        useEncounterStore
          .getState()
          .spendEntityResource(encId, entityId, 'res-ws', 1)
      ).toBe(false);
    });
  });

  describe('encounterStore — restoreEntityResource', () => {
    beforeEach(resetStore);

    it('linked: restores against NPC values, floors at 0, writes both', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture({ usesExpended: 2 }),
      ]);
      useEncounterStore
        .getState()
        .restoreEntityResource(encId, entityId, 'res-ws', 5);
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.resources![0]
          .usesExpended
      ).toBe(0);
      expect(getEntityResources(encId, entityId)![0].usesExpended).toBe(0);
    });

    it('ignores zero, negative, and fractional amounts without mutation', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture({ usesExpended: 2 }),
      ]);
      for (const bad of [0, -4, 0.5]) {
        useEncounterStore
          .getState()
          .restoreEntityResource(encId, entityId, 'res-ws', bad);
      }
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.resources![0]
          .usesExpended
      ).toBe(2);
      expect(getEntityResources(encId, entityId)![0].usesExpended).toBe(2);
    });
  });

  describe('encounterStore — shortRestEntity', () => {
    beforeEach(resetStore);

    it('linked: subtracts numeric n exactly once (no double subtraction through the mirror)', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture({ usesExpended: 3, shortRestReset: 1 }),
      ]);
      useEncounterStore.getState().shortRestEntity(encId, entityId);
      const npcVal = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!
        .resources![0].usesExpended;
      const entityVal = getEntityResources(encId, entityId)![0].usesExpended;
      expect(npcVal).toBe(2); // 3 - 1, once
      expect(entityVal).toBe(2); // identical — copied, not re-applied
    });

    it("resets abilities with restType 'short' and leaves others untouched", () => {
      const store = useEncounterStore.getState();
      const encId = store.createEncounter('Test Battle', 'CAMP01');
      const entityId = store.addEntity(
        encId,
        createMockEncounterEntity({
          type: 'npc',
          abilities: [
            {
              id: 'ab-short',
              name: 'Breath',
              description: '',
              usageType: 'per-rest',
              usedUses: 1,
              restType: 'short',
            },
            {
              id: 'ab-long',
              name: 'Frenzy',
              description: '',
              usageType: 'per-rest',
              usedUses: 1,
              restType: 'long',
            },
          ],
        })
      );
      useEncounterStore.getState().shortRestEntity(encId, entityId);
      const entity = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      expect(entity.abilities!.find(a => a.id === 'ab-short')!.usedUses).toBe(
        0
      );
      expect(entity.abilities!.find(a => a.id === 'ab-long')!.usedUses).toBe(1);
    });

    it('does not change HP or hit dice', () => {
      const store = useEncounterStore.getState();
      const encId = store.createEncounter('Test Battle', 'CAMP01');
      const entityId = store.addEntity(
        encId,
        createMockEncounterEntity({
          type: 'npc',
          currentHp: 5,
          maxHp: 20,
          hitDice: { current: 1, max: 4, dieType: 'd8' },
        })
      );
      useEncounterStore.getState().shortRestEntity(encId, entityId);
      const entity = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      expect(entity.currentHp).toBe(5);
      expect(entity.hitDice!.current).toBe(1);
    });

    it('linked with resource deleted from NPC: drops it from the snapshot instead of resting it', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture({ usesExpended: 2 }),
      ]);
      useNPCStore.getState().updateNPC(RES_CAMPAIGN, npcId, { resources: [] });
      useEncounterStore.getState().shortRestEntity(encId, entityId);
      expect(getEntityResources(encId, entityId)).toEqual([]);
    });
  });

  describe('encounterStore — longRestEntity resources', () => {
    beforeEach(resetStore);

    it('zeroes entity resources and NPC resources through the mirror', () => {
      const { npcId, encId, entityId } = setupLinkedNpcEntity([
        resourceFixture({ usesExpended: 3, shortRestReset: 0 }),
      ]);
      useEncounterStore.getState().longRestEntity(encId, entityId);
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.resources![0]
          .usesExpended
      ).toBe(0);
      expect(getEntityResources(encId, entityId)![0].usesExpended).toBe(0);
    });

    it('unlinked entity resources reset locally', () => {
      const store = useEncounterStore.getState();
      const encId = store.createEncounter('Test Battle', 'CAMP01');
      const entityId = store.addEntity(
        encId,
        createMockEncounterEntity({
          type: 'monster',
          resources: [resourceFixture({ usesExpended: 2 })],
        })
      );
      useEncounterStore.getState().longRestEntity(encId, entityId);
      expect(getEntityResources(encId, entityId)![0].usesExpended).toBe(0);
    });
  });

  describe('buildNpcEntity — resource snapshot', () => {
    beforeEach(resetStore);

    it('snapshots current NPC usage (out-of-combat spending reflected on add)', async () => {
      useNPCStore.setState({ npcsByCampaign: {} });
      const npcId = useNPCStore.getState().createNPC(RES_CAMPAIGN, {
        name: 'Druid Elder',
        armorClass: '13',
        maxHp: 45,
        speed: '30 ft.',
        resources: [resourceFixture()],
      });
      useNPCStore.getState().spendNpcResource(RES_CAMPAIGN, npcId, 'res-ws', 2);
      const { buildNpcEntity } = await import(
        '@/components/ui/encounter/combat-screen/AddCombatantDialog/buildEntity'
      );
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      const entity = buildNpcEntity(npc, {
        isHidden: false,
        playerDisposition: 'enemy',
        campaignCode: RES_CAMPAIGN,
      });
      expect(entity.resources![0].usesExpended).toBe(2);
      // Snapshot is a copy, not a reference.
      expect(entity.resources![0]).not.toBe(npc.resources![0]);
    });
  });

  // ── Ability usage (persistent, NPC-authoritative) ──

  function abilityStatBlock(): MonsterStatBlock {
    return ensureStatBlockEntryIds({
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
      saves: '',
      skills: '',
      speed: '30 ft.',
      resistances: '',
      immunities: '',
      vulnerabilities: '',
      conditionImmunities: [],
      senses: '',
      passivePerception: 10,
      traits: [],
      actions: [
        { id: 'entry-smite', name: 'Smite', text: 'holy', uses: 3 },
        {
          id: 'entry-elemental',
          name: 'Elemental Form',
          text: 'transforms',
          uses: 2,
          resourceCost: { resourceId: 'res-ws', amount: 2 },
        },
      ],
      reactions: [],
      bonusActions: [],
      lairActions: [],
      cr: '1',
      type: 'Humanoid',
      size: 'Medium',
      languages: '',
      alignment: '',
      hpFormula: '',
    });
  }

  function setupLinkedAbilityEntity() {
    useNPCStore.setState({ npcsByCampaign: {} });
    const npcId = useNPCStore.getState().createNPC(RES_CAMPAIGN, {
      name: 'Druid Elder',
      armorClass: '13',
      maxHp: 45,
      speed: '30 ft.',
      monsterStatBlock: abilityStatBlock(),
      resources: [
        {
          id: 'res-ws',
          name: 'Wild Shape',
          icon: 'paw-print',
          color: 'emerald',
          displayStyle: 'pips',
          maxUses: 4,
          usesExpended: 0,
          shortRestReset: 1,
        },
      ],
    });
    const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
    const built = buildNpcEntity(npc, {
      isHidden: false,
      playerDisposition: 'enemy',
      campaignCode: RES_CAMPAIGN,
    });
    const encId = setupEncounterWithEntities([]);
    const store = useEncounterStore.getState();
    store.addEntity(encId, built);
    const entityId = useEncounterStore
      .getState()
      .encounters.find(e => e.id === encId)!.entities[0].id;
    return { npcId, encId, entityId };
  }

  function getEntityAbility(
    encId: string,
    entityId: string,
    abilityId: string
  ) {
    return useEncounterStore
      .getState()
      .encounters.find(e => e.id === encId)!
      .entities.find(e => e.id === entityId)!
      .abilities!.find(a => a.id === abilityId);
  }

  describe('encounterStore — useAbility (NPC-authoritative)', () => {
    beforeEach(resetStore);

    it('linked use writes NPC abilityUsage and the acting entity', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      useEncounterStore.getState().useAbility(encId, entityId, 'entry-smite');
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.abilityUsage![
          'entry-smite'
        ]
      ).toBe(1);
      expect(getEntityAbility(encId, entityId, 'entry-smite')!.usedUses).toBe(
        1
      );
    });

    it('stale entity snapshot cannot resurrect spent uses', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      // NPC already at max from elsewhere; entity snapshot shows 0.
      useNPCStore
        .getState()
        .updateNPC(RES_CAMPAIGN, npcId, { abilityUsage: { 'entry-smite': 3 } });
      useEncounterStore.getState().useAbility(encId, entityId, 'entry-smite');
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.abilityUsage![
          'entry-smite'
        ]
      ).toBe(3); // unchanged
      // Rejected call resynced the acting entity's counter.
      expect(getEntityAbility(encId, entityId, 'entry-smite')!.usedUses).toBe(
        3
      );
    });

    it('combined cost through the entity path is atomic (insufficient resource → neither moves)', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      useNPCStore.getState().spendNpcResource(RES_CAMPAIGN, npcId, 'res-ws', 3);
      useEncounterStore
        .getState()
        .useAbility(encId, entityId, 'entry-elemental');
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      expect(npc.abilityUsage?.['entry-elemental'] ?? 0).toBe(0);
      expect(npc.resources![0].usesExpended).toBe(3);
    });

    it('combined cost success moves both counters and resyncs the entity resource snapshot', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      useEncounterStore
        .getState()
        .useAbility(encId, entityId, 'entry-elemental');
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      expect(npc.abilityUsage!['entry-elemental']).toBe(1);
      expect(npc.resources![0].usesExpended).toBe(2);
      const entity = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      expect(entity.resources![0].usesExpended).toBe(2);
    });

    it('entry deleted on the NPC: use rejected, entity ability removed', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      const sb = structuredClone(npc.monsterStatBlock!);
      sb.actions = sb.actions.filter(a => a.id !== 'entry-smite');
      useNPCStore
        .getState()
        .updateNPC(RES_CAMPAIGN, npcId, { monsterStatBlock: sb });
      useEncounterStore.getState().useAbility(encId, entityId, 'entry-smite');
      expect(getEntityAbility(encId, entityId, 'entry-smite')).toBeUndefined();
    });

    it('NPC deleted entirely: entity-local fallback still works and clamps', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      useNPCStore.getState().deleteNPC(RES_CAMPAIGN, npcId);
      for (let i = 0; i < 5; i++) {
        useEncounterStore.getState().useAbility(encId, entityId, 'entry-smite');
      }
      expect(getEntityAbility(encId, entityId, 'entry-smite')!.usedUses).toBe(
        3
      );
    });

    it('restoreAbility restores NPC + entity, never the resource', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      useEncounterStore
        .getState()
        .useAbility(encId, entityId, 'entry-elemental');
      useEncounterStore
        .getState()
        .restoreAbility(encId, entityId, 'entry-elemental');
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      expect(npc.abilityUsage!['entry-elemental']).toBe(0);
      expect(npc.resources![0].usesExpended).toBe(2); // not refunded
    });

    it('untrackable entry on NPC: restoreAbility drops the entity ability (mirroring useAbility)', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      const sb = structuredClone(npc.monsterStatBlock!);
      // Remove 'uses' and usage markers from entry, making it untrackable
      sb.actions = sb.actions.map(a =>
        a.id === 'entry-smite' ? { ...a, name: 'Smite', uses: undefined } : a
      );
      useNPCStore
        .getState()
        .updateNPC(RES_CAMPAIGN, npcId, { monsterStatBlock: sb });
      useEncounterStore
        .getState()
        .restoreAbility(encId, entityId, 'entry-smite');
      // Entity ability should be dropped (not just resynced)
      expect(getEntityAbility(encId, entityId, 'entry-smite')).toBeUndefined();
    });
  });

  describe('encounterStore — reconcile on stat-block edit', () => {
    beforeEach(resetStore);

    it('text edit preserves usedUses; uses-edit on a linked entry is ignored (NPC config wins)', () => {
      const { encId, entityId } = setupLinkedAbilityEntity();
      useEncounterStore.getState().useAbility(encId, entityId, 'entry-smite');
      const entity = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      const sb = structuredClone(entity.monsterStatBlock!);
      sb.actions = sb.actions.map(a =>
        a.id === 'entry-smite' ? { ...a, text: 'edited', uses: 9 } : a
      );
      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { monsterStatBlock: sb });
      const ability = getEntityAbility(encId, entityId, 'entry-smite')!;
      expect(ability.usedUses).toBe(1); // preserved
      expect(ability.maxUses).toBe(3); // NPC's 3, not the entity-edited 9
    });

    it('combat-added entry gets an id, source entity, and tracks entity-locally without touching the NPC', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      const entity = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      const sb = structuredClone(entity.monsterStatBlock!);
      sb.actions = [...sb.actions, { name: 'Roar (1/Day)', text: 'loud' }];
      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { monsterStatBlock: sb });
      const after = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      const roarEntry = after.monsterStatBlock!.actions.find(a =>
        a.name.startsWith('Roar')
      )!;
      expect(roarEntry.id).toMatch(/^entry-/);
      const roarAbility = after.abilities!.find(a => a.id === roarEntry.id)!;
      expect(roarAbility.source).toBe('entity');
      // Using it mutates the entity only — the NPC never learns about it.
      useEncounterStore.getState().useAbility(encId, entityId, roarEntry.id!);
      expect(getEntityAbility(encId, entityId, roarEntry.id!)!.usedUses).toBe(
        1
      );
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.abilityUsage?.[
          roarEntry.id!
        ]
      ).toBeUndefined();
    });

    it('entity-local path rejects malformed cost amounts atomically', () => {
      const encId = setupEncounterWithEntities([
        {
          id: 'ignored',
          type: 'monster',
          monsterStatBlock: (() => {
            const sb = abilityStatBlock();
            sb.actions = sb.actions.map(a =>
              a.id === 'entry-elemental'
                ? { ...a, resourceCost: { resourceId: 'res-ws', amount: -2 } }
                : a
            );
            return sb;
          })(),
          abilities: [
            {
              id: 'entry-elemental',
              name: 'Elemental Form',
              description: '',
              usageType: 'per-day',
              maxUses: 2,
              usedUses: 0,
              source: 'entity',
            },
          ],
          resources: [
            {
              id: 'res-ws',
              name: 'Wild Shape',
              icon: 'paw-print',
              color: 'emerald',
              displayStyle: 'pips',
              maxUses: 4,
              usesExpended: 0,
              shortRestReset: 1,
            },
          ],
        },
      ]);
      const entityId = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!.entities[0].id;
      useEncounterStore
        .getState()
        .useAbility(encId, entityId, 'entry-elemental');
      const entity = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      expect(entity.abilities![0].usedUses).toBe(0);
      expect(entity.resources![0].usesExpended).toBe(0);
    });

    it('monster entity reconcile is fully entity-local (edited uses wins)', () => {
      const encId = setupEncounterWithEntities([
        {
          id: 'ignored',
          type: 'monster',
          monsterStatBlock: abilityStatBlock(),
          abilities: [],
        },
      ]);
      const entityId = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!.entities[0].id;
      const entity = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      const sb = structuredClone(entity.monsterStatBlock!);
      sb.actions = sb.actions.map(a =>
        a.id === 'entry-smite' ? { ...a, uses: 9 } : a
      );
      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { monsterStatBlock: sb });
      expect(getEntityAbility(encId, entityId, 'entry-smite')!.maxUses).toBe(9);
    });
  });

  describe('encounterStore — rests copy authoritative ability usage', () => {
    beforeEach(resetStore);

    it('shortRestEntity resets short-rest entries once, copies to entity, leaves others', () => {
      useNPCStore.setState({ npcsByCampaign: {} });
      const npcId = useNPCStore.getState().createNPC(RES_CAMPAIGN, {
        name: 'N',
        armorClass: '10',
        maxHp: 5,
        speed: '30 ft.',
        monsterStatBlock: ensureStatBlockEntryIds({
          ...abilityStatBlock(),
          actions: [
            {
              id: 'entry-short',
              name: 'Chains (Recharges after a Short or Long Rest)',
              text: '',
            },
            { id: 'entry-day', name: 'Teleport (3/Day)', text: '' },
          ],
        }),
        abilityUsage: { 'entry-short': 1, 'entry-day': 2 },
      });
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      const encId = setupEncounterWithEntities([]);
      useEncounterStore.getState().addEntity(
        encId,
        buildNpcEntity(npc, {
          isHidden: false,
          playerDisposition: 'enemy',
          campaignCode: RES_CAMPAIGN,
        })
      );
      const entityId = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!.entities[0].id;
      useEncounterStore.getState().shortRestEntity(encId, entityId);
      expect(getEntityAbility(encId, entityId, 'entry-short')!.usedUses).toBe(
        0
      );
      expect(getEntityAbility(encId, entityId, 'entry-day')!.usedUses).toBe(2);
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.abilityUsage![
          'entry-day'
        ]
      ).toBe(2);
    });

    it("rest drops 'npc'-sourced abilities deleted on the NPC but keeps combat-added 'entity' abilities", () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      // Add a combat-only entry.
      const entity = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      const sb = structuredClone(entity.monsterStatBlock!);
      sb.actions = [...sb.actions, { name: 'Roar (1/Day)', text: 'loud' }];
      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { monsterStatBlock: sb });
      // Delete Smite on the NPC.
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      const npcSb = structuredClone(npc.monsterStatBlock!);
      npcSb.actions = npcSb.actions.filter(a => a.id !== 'entry-smite');
      useNPCStore
        .getState()
        .updateNPC(RES_CAMPAIGN, npcId, { monsterStatBlock: npcSb });

      useEncounterStore.getState().shortRestEntity(encId, entityId);
      const after = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      expect(after.abilities!.some(a => a.id === 'entry-smite')).toBe(false); // dropped
      expect(after.abilities!.some(a => a.name.startsWith('Roar'))).toBe(true); // kept
    });

    it("shortRestEntity drops an 'npc'-sourced ability whose NPC entry survives but became untrackable (uses removed, name unmarked)", () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      const npcSb = structuredClone(npc.monsterStatBlock!);
      // "Smite" carries no recharge/per-day markup — stripping `uses` makes
      // getEntryAbilityConfig return null (untrackable) without deleting the entry.
      npcSb.actions = npcSb.actions.map(a =>
        a.id === 'entry-smite' ? { ...a, uses: undefined } : a
      );
      useNPCStore
        .getState()
        .updateNPC(RES_CAMPAIGN, npcId, { monsterStatBlock: npcSb });

      useEncounterStore.getState().shortRestEntity(encId, entityId);
      const after = useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
      expect(after.abilities!.some(a => a.id === 'entry-smite')).toBe(false);
    });

    it('longRestEntity zeroes NPC usage and entity counters through the mirror', () => {
      const { npcId, encId, entityId } = setupLinkedAbilityEntity();
      useEncounterStore.getState().useAbility(encId, entityId, 'entry-smite');
      useEncounterStore.getState().longRestEntity(encId, entityId);
      expect(
        useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!.abilityUsage![
          'entry-smite'
        ]
      ).toBe(0);
      expect(getEntityAbility(encId, entityId, 'entry-smite')!.usedUses).toBe(
        0
      );
    });
  });

  describe('encounterStore — persisted legacy migration (v1→v2)', () => {
    it('returns a migrated copy instead of mutating the persisted state', async () => {
      const { migrateEncounterPersistedState } = await import(
        '@/store/encounterStore'
      );
      const persisted = {
        activeEncounterId: null,
        encounters: [{ entities: [] }],
      };

      const out = migrateEncounterPersistedState(persisted, 1);

      expect(out).not.toBe(persisted);
      expect(out.encounters[0]).not.toBe(persisted.encounters[0]);
    });

    it('re-keys legacy abilities to entry ids, preserves unambiguous usedUses, stamps entity source', async () => {
      const { migrateEncounterPersistedState } = await import(
        '@/store/encounterStore'
      );
      const legacyBlock = {
        ...abilityStatBlock(),
        actions: [
          { name: 'Smite', text: 'holy', uses: 3 }, // no id (pre-feature)
          { name: 'Teleport (2/Day)', text: 'blink' },
          { name: 'Twin', text: '', uses: 1 },
          { name: 'Twin', text: '', uses: 1 }, // ambiguous name — must reset
        ], // note: these action objects deliberately carry NO ids (pre-feature shape)
      };
      const persisted = {
        activeEncounterId: null,
        encounters: [
          {
            id: 'enc-1',
            name: 'Old Fight',
            entities: [
              {
                id: 'e1',
                type: 'npc',
                name: 'Druid',
                initiative: null,
                initiativeModifier: 0,
                currentHp: 10,
                maxHp: 10,
                tempHp: 0,
                armorClass: 12,
                conditions: [],
                npcSourceId: 'npc-x',
                campaignCode: RES_CAMPAIGN,
                monsterStatBlock: legacyBlock,
                abilities: [
                  {
                    id: 'legacy-1',
                    name: 'Smite',
                    description: '',
                    usageType: 'per-day',
                    maxUses: 3,
                    usedUses: 2,
                  },
                  {
                    id: 'legacy-2',
                    name: 'Teleport',
                    description: '',
                    usageType: 'per-day',
                    maxUses: 2,
                    usedUses: 1,
                  },
                  {
                    id: 'legacy-3',
                    name: 'Twin',
                    description: '',
                    usageType: 'per-day',
                    maxUses: 1,
                    usedUses: 1,
                  },
                ],
              },
            ],
            currentTurn: 0,
            round: 0,
            isActive: false,
            sortOrder: 'initiative',
            createdAt: 'x',
            updatedAt: 'x',
          },
        ],
      };
      const out = migrateEncounterPersistedState(persisted, 1);
      const entity = out.encounters[0].entities[0];
      const sb = entity.monsterStatBlock!;
      for (const e of sb.actions) expect(e.id).toMatch(/^entry-/);
      const smite = entity.abilities!.find(a => a.name === 'Smite')!;
      expect(smite.id).toBe(sb.actions[0].id); // re-keyed to the entry id
      expect(smite.usedUses).toBe(2); // unambiguous name match preserved
      expect(smite.source).toBe('entity'); // NPC-linked legacy stays entity-local (documented)
      expect(entity.abilities!.find(a => a.name === 'Teleport')!.usedUses).toBe(
        1
      );
      const twins = entity.abilities!.filter(a => a.name === 'Twin');
      expect(twins.every(a => a.usedUses === 0)).toBe(true); // ambiguous → reset
    });

    it('does not throw when an entity monsterStatBlock is missing bonusActions/lairActions entirely, and rebuilds abilities', async () => {
      const { migrateEncounterPersistedState } = await import(
        '@/store/encounterStore'
      );
      const legacyBlock = abilityStatBlock() as Partial<MonsterStatBlock>;
      delete legacyBlock.bonusActions;
      delete legacyBlock.lairActions;
      const persisted = {
        activeEncounterId: null,
        encounters: [
          {
            id: 'enc-1',
            name: 'Old Fight',
            entities: [
              {
                id: 'e1',
                type: 'npc',
                name: 'Druid',
                initiative: null,
                initiativeModifier: 0,
                currentHp: 10,
                maxHp: 10,
                tempHp: 0,
                armorClass: 12,
                conditions: [],
                npcSourceId: 'npc-x',
                campaignCode: RES_CAMPAIGN,
                monsterStatBlock: legacyBlock,
                abilities: [],
              },
            ],
            currentTurn: 0,
            round: 0,
            isActive: false,
            sortOrder: 'initiative',
            createdAt: 'x',
            updatedAt: 'x',
          },
        ],
      };
      let out!: ReturnType<typeof migrateEncounterPersistedState>;
      expect(() => {
        out = migrateEncounterPersistedState(structuredClone(persisted), 1);
      }).not.toThrow();
      const entity = out.encounters[0].entities[0];
      expect(entity.monsterStatBlock!.bonusActions).toEqual([]);
      expect(entity.monsterStatBlock!.lairActions).toEqual([]);
      // Abilities rebuilt from the (backfilled) normalized block.
      expect(entity.abilities!.some(a => a.id === 'entry-smite')).toBe(true);
      expect(entity.abilities!.some(a => a.id === 'entry-elemental')).toBe(
        true
      );
    });
  });

  describe('entity builders — normalization', () => {
    beforeEach(resetStore);

    it('buildNpcEntity stores a normalized CLONE (not the NPC reference) and seeds usage', () => {
      useNPCStore.setState({ npcsByCampaign: {} });
      const npcId = useNPCStore.getState().createNPC(RES_CAMPAIGN, {
        name: 'N',
        armorClass: '10',
        maxHp: 5,
        speed: '30 ft.',
        monsterStatBlock: abilityStatBlock(),
        abilityUsage: { 'entry-smite': 2 },
      });
      const npc = useNPCStore.getState().getNPC(RES_CAMPAIGN, npcId)!;
      const built = buildNpcEntity(npc, {
        isHidden: false,
        playerDisposition: 'enemy',
        campaignCode: RES_CAMPAIGN,
      });
      expect(built.monsterStatBlock).not.toBe(npc.monsterStatBlock);
      expect(built.abilities!.find(a => a.id === 'entry-smite')!.usedUses).toBe(
        2
      );
    });
  });
});
