import { describe, expect, test } from 'vitest';

import {
  createMonsterEditDraft,
  setDraftInitiative,
  setDraftProficiency,
  updateDraftStatBlock,
} from './monsterEditDraft';
import type { ProcessedMonster } from '@/types/bestiary';

const monster: ProcessedMonster = {
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
  skills: '',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  senses: '',
  passivePerception: 9,
  languages: '',
  cr: '1/4',
  source: 'MM',
  page: 166,
  acValue: 15,
  hpAverage: 7,
  hpFormula: '2d6',
  legendaryActionCount: 0,
  conditionImmunities: [],
};

describe('createMonsterEditDraft', () => {
  test('seeds initiative from dex modifier and PB from CR, clean flags', () => {
    const draft = createMonsterEditDraft(monster);
    expect(draft.initiativeModifier).toBe(2); // dex 14
    expect(draft.proficiencyBonus).toBe(2); // cr 1/4
    expect(draft.initiativeDirty).toBe(false);
    expect(draft.proficiencyDirty).toBe(false);
  });
});

describe('updateDraftStatBlock', () => {
  test('dex edit recomputes initiative while clean', () => {
    const draft = updateDraftStatBlock(createMonsterEditDraft(monster), {
      dex: 20,
    });
    expect(draft.statBlock.dex).toBe(20);
    expect(draft.initiativeModifier).toBe(5);
  });

  test('dex edit does NOT touch initiative once dirty', () => {
    let draft = setDraftInitiative(createMonsterEditDraft(monster), 7);
    draft = updateDraftStatBlock(draft, { dex: 20 });
    expect(draft.initiativeModifier).toBe(7);
  });

  test('cr edit recomputes PB while clean, not once dirty', () => {
    let draft = updateDraftStatBlock(createMonsterEditDraft(monster), {
      cr: '9',
    });
    expect(draft.proficiencyBonus).toBe(4);
    draft = setDraftProficiency(draft, 6);
    draft = updateDraftStatBlock(draft, { cr: '1' });
    expect(draft.proficiencyBonus).toBe(6);
  });

  test('non-dex/cr edits leave derived values alone', () => {
    const draft = updateDraftStatBlock(createMonsterEditDraft(monster), {
      speed: '60 ft.',
    });
    expect(draft.initiativeModifier).toBe(2);
    expect(draft.proficiencyBonus).toBe(2);
  });
});

describe('manual setters', () => {
  test('flip dirty flags', () => {
    const d1 = setDraftInitiative(createMonsterEditDraft(monster), 3);
    expect(d1.initiativeDirty).toBe(true);
    const d2 = setDraftProficiency(createMonsterEditDraft(monster), 5);
    expect(d2.proficiencyDirty).toBe(true);
  });
});
