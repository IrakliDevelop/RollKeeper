import { describe, expect, test } from 'vitest';

import {
  abilityModifier,
  buildMonsterStatBlock,
  monsterToEncounterEntity,
} from './encounterConverter';
import { buildMonsterEntities } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/buildEntity';
import type { ProcessedMonster } from '@/types/bestiary';

function makeMonster(
  overrides: Partial<ProcessedMonster> = {}
): ProcessedMonster {
  return {
    id: 'mon-goblin',
    name: 'Goblin',
    size: ['S'],
    type: 'humanoid',
    alignment: 'neutral evil',
    ac: '15',
    hp: '7 (2d6)',
    speed: '30 ft.',
    str: 8,
    dex: 14,
    con: 10,
    int: 10,
    wis: 8,
    cha: 8,
    saves: '',
    skills: 'Stealth +6',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    senses: 'darkvision 60 ft.',
    passivePerception: 9,
    languages: 'Common, Goblin',
    cr: '1/4',
    traits: [
      { name: 'Nimble Escape', text: 'Disengage or Hide as a bonus action.' },
    ],
    actions: [{ name: 'Scimitar', text: 'Melee: +4 to hit, 1d6+2 slashing.' }],
    source: 'MM',
    page: 166,
    acValue: 15,
    hpAverage: 7,
    hpFormula: '2d6',
    legendaryActionCount: 0,
    conditionImmunities: [],
    ...overrides,
  };
}

describe('monsterToEncounterEntity with statBlockOverride', () => {
  test('adopts the override block verbatim', () => {
    const monster = makeMonster();
    const block = {
      ...buildMonsterStatBlock(monster),
      speed: '60 ft., fly 90 ft.',
    };
    const entity = monsterToEncounterEntity(monster, {
      statBlockOverride: block,
    });
    expect(entity.monsterStatBlock).toBe(block);
  });

  test('derives initiativeModifier from the override dex', () => {
    const monster = makeMonster(); // dex 14 → +2
    const block = { ...buildMonsterStatBlock(monster), dex: 20 };
    const entity = monsterToEncounterEntity(monster, {
      statBlockOverride: block,
    });
    expect(entity.initiativeModifier).toBe(5);
  });

  test('explicit initiativeModifierOverride wins over dex', () => {
    const monster = makeMonster();
    const block = { ...buildMonsterStatBlock(monster), dex: 20 };
    const entity = monsterToEncounterEntity(monster, {
      statBlockOverride: block,
      initiativeModifierOverride: -1,
    });
    expect(entity.initiativeModifier).toBe(-1);
  });

  test('derives proficiencyBonus from the override cr', () => {
    const monster = makeMonster(); // cr 1/4 → +2
    const block = { ...buildMonsterStatBlock(monster), cr: '5' };
    const entity = monsterToEncounterEntity(monster, {
      statBlockOverride: block,
    });
    expect(entity.proficiencyBonus).toBe(3);
  });

  test('explicit proficiencyBonusOverride wins over cr', () => {
    const monster = makeMonster();
    const block = { ...buildMonsterStatBlock(monster), cr: '5' };
    const entity = monsterToEncounterEntity(monster, {
      statBlockOverride: block,
      proficiencyBonusOverride: 6,
    });
    expect(entity.proficiencyBonus).toBe(6);
  });

  test('rebuilds trackable abilities from the override (recharge parsing)', () => {
    const monster = makeMonster();
    const block = {
      ...buildMonsterStatBlock(monster),
      actions: [
        { name: 'Fire Breath (Recharge 5-6)', text: 'Cone of fire, 8d6.' },
      ],
    };
    const entity = monsterToEncounterEntity(monster, {
      statBlockOverride: block,
    });
    expect(entity.abilities?.map(a => a.name)).toContain('Fire Breath');
  });

  test('no overrides → legacy behavior unchanged', () => {
    const monster = makeMonster();
    const entity = monsterToEncounterEntity(monster);
    expect(entity.monsterStatBlock).toEqual(buildMonsterStatBlock(monster));
    expect(entity.initiativeModifier).toBe(2); // dex 14
    expect(entity.proficiencyBonus).toBe(2); // cr 1/4
    expect(entity.maxHp).toBe(7);
  });
});

describe('buildMonsterEntities pass-through', () => {
  test('forwards statBlockOverride and initiative/PB overrides to every copy', () => {
    const monster = makeMonster();
    const block = { ...buildMonsterStatBlock(monster), dex: 20 };
    const entities = buildMonsterEntities(monster, {
      count: 2,
      hpOverride: 7,
      acOverride: 15,
      isHidden: false,
      playerDisposition: 'enemy',
      colorIdx: 0,
      statBlockOverride: block,
      initiativeModifierOverride: 4,
      proficiencyBonusOverride: 5,
    });
    expect(entities).toHaveLength(2);
    for (const e of entities) {
      expect(e.monsterStatBlock).toBe(block);
      expect(e.initiativeModifier).toBe(4);
      expect(e.proficiencyBonus).toBe(5);
    }
    expect(entities[0].name).toBe('Goblin A');
    expect(entities[1].name).toBe('Goblin B');
  });
});

describe('abilityModifier export', () => {
  test('standard 5e modifiers', () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(20)).toBe(5);
    expect(abilityModifier(8)).toBe(-1);
  });
});

describe('monster token avatarUrl', () => {
  test('sets root-relative token URL when hasToken and tokenSource present', () => {
    const monster = makeMonster({
      name: 'Adult Crystal Dragon',
      hasToken: true,
      tokenSource: 'FTD',
    });
    const entity = monsterToEncounterEntity(monster);
    expect(entity.avatarUrl).toBe(
      '/api/bestiary/token/FTD/Adult%20Crystal%20Dragon'
    );
  });

  test('leaves avatarUrl undefined without hasToken', () => {
    const entity = monsterToEncounterEntity(
      makeMonster({ hasToken: false, tokenSource: 'XMM' })
    );
    expect(entity.avatarUrl).toBeUndefined();
  });

  test('leaves avatarUrl undefined without tokenSource (legacy data)', () => {
    const entity = monsterToEncounterEntity(makeMonster({ hasToken: true }));
    expect(entity.avatarUrl).toBeUndefined();
  });

  test('URL uses original monster name even with nameOverride', () => {
    const entity = monsterToEncounterEntity(
      makeMonster({ name: 'Zombie', hasToken: true, tokenSource: 'XMM' }),
      { nameOverride: 'Zombie A' }
    );
    expect(entity.name).toBe('Zombie A');
    expect(entity.avatarUrl).toBe('/api/bestiary/token/XMM/Zombie');
  });
});
