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
});
