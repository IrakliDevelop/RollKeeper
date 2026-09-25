import { describe, expect, it } from 'vitest';

import { creatureBadge, creatureMetaLine } from '../CreatureDrawer.utils';
import type { EncounterEntity, MonsterStatBlock } from '@/types/encounter';

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin Boss',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    ...overrides,
  };
}

function makeStatBlock(
  overrides: Partial<MonsterStatBlock> = {}
): MonsterStatBlock {
  return {
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
    actions: [],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '1',
    type: 'humanoid',
    size: 'Small',
    languages: '',
    alignment: 'neutral evil',
    hpFormula: '2d6',
    ...overrides,
  };
}

describe('creatureBadge', () => {
  it('badges a summon Summon/blue even if it also has a type', () => {
    const entity = makeEntity({ type: 'monster', summonId: 'summon-1' });
    expect(creatureBadge(entity)).toEqual({ label: 'Summon', tone: 'blue' });
  });

  it('badges a lair entity Lair/emerald', () => {
    const entity = makeEntity({ type: 'lair' });
    expect(creatureBadge(entity)).toEqual({ label: 'Lair', tone: 'emerald' });
  });

  it('badges type npc NPC/amber', () => {
    const entity = makeEntity({ type: 'npc' });
    expect(creatureBadge(entity)).toEqual({ label: 'NPC', tone: 'amber' });
  });

  it('badges a monster with an npcSourceId (custom monster) NPC/amber', () => {
    const entity = makeEntity({ type: 'monster', npcSourceId: 'npc-1' });
    expect(creatureBadge(entity)).toEqual({ label: 'NPC', tone: 'amber' });
  });

  it('badges a plain monster Monster/purple', () => {
    const entity = makeEntity({ type: 'monster' });
    expect(creatureBadge(entity)).toEqual({ label: 'Monster', tone: 'purple' });
  });
});

describe('creatureMetaLine', () => {
  it('returns null when there is no stat block', () => {
    expect(creatureMetaLine(makeEntity())).toBeNull();
  });

  it('joins size, type, and alignment with a middot', () => {
    const entity = makeEntity({ monsterStatBlock: makeStatBlock() });
    expect(creatureMetaLine(entity)).toBe('Small · humanoid · neutral evil');
  });

  it('drops missing fields instead of leaving empty segments', () => {
    const entity = makeEntity({
      monsterStatBlock: makeStatBlock({ alignment: '' }),
    });
    expect(creatureMetaLine(entity)).toBe('Small · humanoid');
  });
});
