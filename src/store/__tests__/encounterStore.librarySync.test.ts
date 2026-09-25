import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEncounterStore } from '@/store/encounterStore';
import { useNPCStore } from '@/store/npcStore';
import { buildNpcEntity } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/buildEntity';
import { createMockEncounterEntity } from '@/test/helpers';
import { ensureStatBlockEntryIds } from '@/utils/statBlockAbilities';
import type { MonsterStatBlock } from '@/types/encounter';

const CAMPAIGN = 'CAMP01';

function resetStores() {
  useEncounterStore.setState({
    encounters: [],
    encounterTombstones: {},
    activeEncounterId: null,
  });
  useNPCStore.setState({ npcsByCampaign: {} });
}

function statBlock(
  overrides: Partial<MonsterStatBlock> = {}
): MonsterStatBlock {
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
    actions: [{ id: 'entry-bite', name: 'Bite', text: 'Bite attack.' }],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '1',
    type: 'Beast',
    size: 'Medium',
    languages: '',
    alignment: '',
    hpFormula: '',
    ...overrides,
  });
}

/** Creates a library NPC + a linked combat entity, returns their ids. */
function setupLinkedEntity(
  npcOverrides: Partial<
    Parameters<ReturnType<typeof useNPCStore.getState>['createNPC']>[1]
  > = {}
) {
  const npcId = useNPCStore.getState().createNPC(CAMPAIGN, {
    name: 'Dire Wolf',
    armorClass: '13 (natural armor)',
    maxHp: 37,
    speed: '50 ft.',
    initiativeModifier: 2,
    proficiencyBonus: 2,
    monsterStatBlock: statBlock(),
    ...npcOverrides,
  });
  const npc = useNPCStore.getState().getNPC(CAMPAIGN, npcId)!;
  const built = buildNpcEntity(npc, {
    isHidden: false,
    playerDisposition: 'enemy',
    campaignCode: CAMPAIGN,
  });
  const encId = useEncounterStore
    .getState()
    .createEncounter('Battle', CAMPAIGN);
  useEncounterStore.getState().addEntity(encId, built);
  const entityId = useEncounterStore
    .getState()
    .encounters.find(e => e.id === encId)!.entities[0].id;
  return { npcId, encId, entityId };
}

function getNpc(npcId: string) {
  return useNPCStore.getState().getNPC(CAMPAIGN, npcId)!;
}

describe('encounterStore — NPC library write-back', () => {
  beforeEach(resetStores);

  it('updateEntity AC change syncs to the NPC, keeping its annotation', () => {
    const { npcId, encId, entityId } = setupLinkedEntity();
    useEncounterStore.getState().updateEntity(encId, entityId, {
      armorClass: 18,
    });
    expect(getNpc(npcId).armorClass).toBe('18 (natural armor)');
  });

  it('updateEntity stat block STR change syncs to the NPC, other fields untouched', () => {
    const { npcId, encId, entityId } = setupLinkedEntity();
    const entity = useEncounterStore
      .getState()
      .encounters.find(e => e.id === encId)!
      .entities.find(e => e.id === entityId)!;
    const sb = structuredClone(entity.monsterStatBlock!);
    sb.str = 18;
    useEncounterStore
      .getState()
      .updateEntity(encId, entityId, { monsterStatBlock: sb });
    const npc = getNpc(npcId);
    expect(npc.monsterStatBlock!.str).toBe(18);
    expect(npc.monsterStatBlock!.dex).toBe(10);
    expect(npc.monsterStatBlock!.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'entry-bite' })])
    );
  });

  it('setEntityHp(max) syncs maxHp to the NPC and currentHp syncs as before', () => {
    const { npcId, encId, entityId } = setupLinkedEntity();
    useEncounterStore.getState().setEntityHp(encId, entityId, 40, 40);
    const npc = getNpc(npcId);
    expect(npc.maxHp).toBe(40);
    expect(npc.currentHp).toBe(40);
  });

  it('updateEntity initiativeModifier/proficiencyBonus changes sync to the NPC', () => {
    const { npcId, encId, entityId } = setupLinkedEntity();
    useEncounterStore.getState().updateEntity(encId, entityId, {
      initiativeModifier: 5,
      proficiencyBonus: 4,
    });
    const npc = getNpc(npcId);
    expect(npc.initiativeModifier).toBe(5);
    expect(npc.proficiencyBonus).toBe(4);
  });

  it('updateEntity({name}) does not change the NPC name', () => {
    const { npcId, encId, entityId } = setupLinkedEntity();
    useEncounterStore.getState().updateEntity(encId, entityId, {
      name: 'Renamed Combatant',
    });
    expect(getNpc(npcId).name).toBe('Dire Wolf');
  });

  it('updateEntity({playerAlias, isHidden}) never calls updateNPC', () => {
    const { encId, entityId } = setupLinkedEntity();
    const spy = vi.spyOn(useNPCStore.getState(), 'updateNPC');
    useEncounterStore.getState().updateEntity(encId, entityId, {
      playerAlias: 'The Mystery Beast',
      isHidden: true,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('deleted NPC: updateEntity still updates the entity and throws nothing', () => {
    const { npcId, encId, entityId } = setupLinkedEntity();
    useNPCStore.getState().deleteNPC(CAMPAIGN, npcId);
    expect(() =>
      useEncounterStore.getState().updateEntity(encId, entityId, {
        armorClass: 20,
      })
    ).not.toThrow();
    const entity = useEncounterStore
      .getState()
      .encounters.find(e => e.id === encId)!
      .entities.find(e => e.id === entityId)!;
    expect(entity.armorClass).toBe(20);
    expect(useNPCStore.getState().getNPC(CAMPAIGN, npcId)).toBeUndefined();
  });

  it('an unlinked monster entity never calls updateNPC', () => {
    const encId = useEncounterStore
      .getState()
      .createEncounter('Battle', CAMPAIGN);
    useEncounterStore
      .getState()
      .addEntity(encId, createMockEncounterEntity({ armorClass: 12 }));
    const entityId = useEncounterStore
      .getState()
      .encounters.find(e => e.id === encId)!.entities[0].id;
    const spy = vi.spyOn(useNPCStore.getState(), 'updateNPC');
    useEncounterStore.getState().updateEntity(encId, entityId, {
      armorClass: 16,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a second identical updateEntity is a no-op (updateNPC not called again)', () => {
    const { encId, entityId } = setupLinkedEntity();
    useEncounterStore.getState().updateEntity(encId, entityId, {
      armorClass: 18,
    });
    const spy = vi.spyOn(useNPCStore.getState(), 'updateNPC');
    useEncounterStore.getState().updateEntity(encId, entityId, {
      armorClass: 18,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a combat-added stat block entry stays off the NPC', () => {
    const { npcId, encId, entityId } = setupLinkedEntity();
    const entity = useEncounterStore
      .getState()
      .encounters.find(e => e.id === encId)!
      .entities.find(e => e.id === entityId)!;
    const sb = structuredClone(entity.monsterStatBlock!);
    sb.actions = [...sb.actions, { name: 'Roar (1/Day)', text: 'loud' }];
    useEncounterStore
      .getState()
      .updateEntity(encId, entityId, { monsterStatBlock: sb });
    const npc = getNpc(npcId);
    expect(
      npc.monsterStatBlock!.actions.some(a => a.name.startsWith('Roar'))
    ).toBe(false);
  });

  describe('final-review coverage', () => {
    function getEntity(encId: string, entityId: string) {
      return useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
    }

    it('an owned entry edited via updateEntity reaches the NPC', () => {
      const { npcId, encId, entityId } = setupLinkedEntity();
      const sb = structuredClone(getEntity(encId, entityId).monsterStatBlock!);
      sb.actions = sb.actions.map(a =>
        a.id === 'entry-bite' ? { ...a, text: 'Bigger bite.' } : a
      );
      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { monsterStatBlock: sb });
      expect(
        getNpc(npcId).monsterStatBlock!.actions.find(a => a.id === 'entry-bite')
          ?.text
      ).toBe('Bigger bite.');
    });

    it('two entities from the same NPC editing different fields both land', () => {
      const { npcId, encId, entityId } = setupLinkedEntity();
      const npc = getNpc(npcId);
      const second = buildNpcEntity(npc, {
        isHidden: false,
        playerDisposition: 'enemy',
        campaignCode: CAMPAIGN,
      });
      const secondId = useEncounterStore.getState().addEntity(encId, second);

      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { armorClass: 18 });
      const sb = structuredClone(getEntity(encId, secondId).monsterStatBlock!);
      sb.str = 20;
      useEncounterStore
        .getState()
        .updateEntity(encId, secondId, { monsterStatBlock: sb });

      const fresh = getNpc(npcId);
      expect(fresh.armorClass).toBe('18 (natural armor)');
      expect(fresh.monsterStatBlock!.str).toBe(20);
    });

    it('a library edit made after add survives an unrelated entity edit', () => {
      const { npcId, encId, entityId } = setupLinkedEntity();
      const npc = getNpc(npcId);
      useNPCStore.getState().updateNPC(CAMPAIGN, npcId, {
        monsterStatBlock: { ...npc.monsterStatBlock!, skills: 'Stealth +5' },
      });
      const sb = structuredClone(getEntity(encId, entityId).monsterStatBlock!);
      sb.str = 18;
      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { monsterStatBlock: sb });
      const fresh = getNpc(npcId);
      expect(fresh.monsterStatBlock!.str).toBe(18);
      expect(fresh.monsterStatBlock!.skills).toBe('Stealth +5');
    });

    it('a byte-identical stat-block save never calls updateNPC', () => {
      const { encId, entityId } = setupLinkedEntity();
      const sb = structuredClone(getEntity(encId, entityId).monsterStatBlock!);
      const spy = vi.spyOn(useNPCStore.getState(), 'updateNPC');
      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { monsterStatBlock: sb });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('a stat-block speed edit also sets the NPC top-level speed', () => {
      const { npcId, encId, entityId } = setupLinkedEntity();
      const sb = structuredClone(getEntity(encId, entityId).monsterStatBlock!);
      sb.speed = '50 ft., climb 30 ft.';
      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { monsterStatBlock: sb });
      const fresh = getNpc(npcId);
      expect(fresh.speed).toBe('50 ft., climb 30 ft.');
      expect(fresh.monsterStatBlock!.speed).toBe('50 ft., climb 30 ft.');
    });
  });

  describe('entity abilities re-reconcile after a stat-block write-back', () => {
    function getEntity(encId: string, entityId: string) {
      return useEncounterStore
        .getState()
        .encounters.find(e => e.id === encId)!
        .entities.find(e => e.id === entityId)!;
    }

    function setupTeleport() {
      return setupLinkedEntity({
        monsterStatBlock: statBlock({
          actions: [
            { id: 'entry-bite', name: 'Bite', text: 'Bite attack.' },
            { id: 'entry-tp', name: 'Teleport (3/Day)', text: 'Blink.' },
          ],
        }),
      });
    }

    function renameEntry(
      encId: string,
      entityId: string,
      id: string,
      name: string
    ) {
      const sb = structuredClone(getEntity(encId, entityId).monsterStatBlock!);
      sb.actions = sb.actions.map(a => (a.id === id ? { ...a, name } : a));
      useEncounterStore
        .getState()
        .updateEntity(encId, entityId, { monsterStatBlock: sb });
    }

    it('3/Day → 2/Day lowers entity maxUses and clamps usedUses to the NPC', () => {
      const { npcId, encId, entityId } = setupTeleport();
      for (let i = 0; i < 3; i++) {
        useEncounterStore.getState().useAbility(encId, entityId, 'entry-tp');
      }
      expect(getNpc(npcId).abilityUsage?.['entry-tp']).toBe(3);

      renameEntry(encId, entityId, 'entry-tp', 'Teleport (2/Day)');

      expect(getNpc(npcId).abilityUsage?.['entry-tp']).toBe(2);
      const tp = getEntity(encId, entityId).abilities!.find(
        a => a.id === 'entry-tp'
      )!;
      expect(tp.maxUses).toBe(2);
      expect(tp.usedUses).toBe(2);
      expect(tp.source).toBe('npc');
    });

    it('making an owned untracked entry trackable creates the entity ability', () => {
      const { npcId, encId, entityId } = setupTeleport();
      expect(
        getEntity(encId, entityId).abilities!.some(a => a.id === 'entry-bite')
      ).toBe(false);

      renameEntry(encId, entityId, 'entry-bite', 'Bite (1/Day)');

      expect(
        getNpc(npcId).monsterStatBlock!.actions.find(a => a.id === 'entry-bite')
          ?.name
      ).toBe('Bite (1/Day)');
      const bite = getEntity(encId, entityId).abilities!.find(
        a => a.id === 'entry-bite'
      );
      expect(bite).toMatchObject({ maxUses: 1, usedUses: 0, source: 'npc' });
    });
  });
});
