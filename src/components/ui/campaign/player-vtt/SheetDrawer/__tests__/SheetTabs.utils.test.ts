import { describe, it, expect } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState, Spell } from '@/types/character';

import {
  buildConditionToggles,
  buildFeatureGroups,
  buildOtherEffects,
  buildProficiencyGroups,
  buildSaveRows,
  buildSkillRows,
  buildSpellGroups,
  exhaustionRulesText,
  hasSlotForSpell,
  nextSkillLevel,
} from '../SheetTabs.utils';

function fixture(overrides: Partial<CharacterState> = {}): CharacterState {
  const base = useCharacterStore.getState().character;
  return {
    ...base,
    name: 'Kaelen Voss',
    race: 'Half-Elf',
    background: 'Outlander',
    level: 7,
    totalLevel: 7,
    classes: [
      {
        className: 'Ranger',
        level: 5,
        isCustom: false,
        hitDie: 10,
        subclass: 'Hunter',
      },
      { className: 'Fighter', level: 2, isCustom: false, hitDie: 10 },
    ],
    abilities: {
      strength: 12,
      dexterity: 18,
      constitution: 14,
      intelligence: 10,
      wisdom: 15,
      charisma: 8,
    },
    ...overrides,
  } as CharacterState;
}

describe('buildSkillRows', () => {
  it('returns 18 skills sorted by display name with level, modifier and passive', () => {
    const base = fixture();
    const rows = buildSkillRows({
      ...base,
      abilities: { ...base.abilities, dexterity: 16 },
      skills: {
        ...base.skills,
        stealth: { proficient: true, expertise: true },
      },
    });
    expect(rows).toHaveLength(18);
    expect(rows[0].name).toBe('Acrobatics');
    const stealth = rows.find(r => r.skill === 'stealth')!;
    expect(stealth.level).toBe(2);
    expect(stealth.abilityAbbr).toBe('DEX');
    expect(stealth.passive).toBe(10 + stealth.modifier);
  });
});

describe('nextSkillLevel', () => {
  it('cycles none → proficient → expertise → none', () => {
    expect([0, 1, 2].map(l => nextSkillLevel(l as 0 | 1 | 2))).toEqual([
      1, 2, 0,
    ]);
  });
});

describe('buildSaveRows', () => {
  it('lists six saves with proficiency', () => {
    const base = fixture();
    const rows = buildSaveRows({
      ...base,
      savingThrows: { ...base.savingThrows, wisdom: { proficient: true } },
    });
    expect(rows.map(r => r.name)).toEqual([
      'Strength',
      'Dexterity',
      'Constitution',
      'Intelligence',
      'Wisdom',
      'Charisma',
    ]);
    expect(rows[4].proficient).toBe(true);
  });
});

describe('buildProficiencyGroups', () => {
  it('summarizes weapons, tools and languages and omits empty groups', () => {
    const base = fixture();
    const groups = buildProficiencyGroups({
      ...base,
      weaponProficiencies: {
        simpleWeapons: true,
        martialWeapons: false,
        specificWeapons: ['Longbow'],
      },
      toolProficiencies: [],
      languages: [{ id: 'l1', name: 'Elvish', createdAt: '', updatedAt: '' }],
    });
    expect(groups).toEqual([
      { label: 'Weapons', items: ['Simple weapons', 'Longbow'] },
      { label: 'Languages', items: ['Elvish'] },
    ]);
  });
});

describe('buildSpellGroups', () => {
  const spell = (o: Partial<Spell>): Spell => ({
    id: o.name!,
    name: o.name!,
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: '',
    createdAt: '',
    updatedAt: '',
    ...o,
  });
  it('groups by level with cantrips first, filters by query, and marks castability', () => {
    const base = fixture();
    const c = {
      ...base,
      spellSlots: {
        ...base.spellSlots,
        1: { max: 2, used: 2 },
        2: { max: 1, used: 0 },
      },
      spells: [
        spell({ name: 'Fire Bolt', level: 0 }),
        spell({ name: 'Shield', level: 1, isPrepared: true }),
        spell({ name: 'Sleep', level: 1 }),
        spell({ name: 'Misty Step', level: 2, isAlwaysPrepared: true }),
      ],
    };
    const groups = buildSpellGroups(c, '');
    expect(groups.map(g => g.label)).toEqual([
      'Cantrips',
      '1st level',
      '2nd level',
    ]);
    expect(groups[0].slot).toBeNull();
    const shield = groups[1].spells.find(s => s.spell.name === 'Shield')!;
    expect(shield.castable).toBe(true); // 1st slots gone but a 2nd-level slot can upcast
    const sleep = groups[1].spells.find(s => s.spell.name === 'Sleep')!;
    expect(sleep.castable).toBe(false); // not prepared
    expect(
      buildSpellGroups(c, 'mist').flatMap(g => g.spells.map(s => s.spell.name))
    ).toEqual(['Misty Step']);
  });
});

describe('hasSlotForSpell', () => {
  it('accepts cantrips, rituals, free casts and pact slots', () => {
    const base = fixture();
    const noSlots = {
      ...base,
      spellSlots: { ...base.spellSlots, 1: { max: 0, used: 0 } },
    };
    const s = { level: 1 } as Spell;
    expect(hasSlotForSpell(noSlots, { level: 0 } as Spell)).toBe(true);
    expect(hasSlotForSpell(noSlots, { ...s, ritual: true })).toBe(true);
    expect(
      hasSlotForSpell(noSlots, { ...s, freeCastMax: 1, freeCastsUsed: 0 })
    ).toBe(true);
    expect(
      hasSlotForSpell(
        { ...noSlots, pactMagic: { level: 2, slots: { max: 1, used: 0 } } },
        s
      )
    ).toBe(true);
    expect(hasSlotForSpell(noSlots, s)).toBe(false);
  });
});

describe('buildFeatureGroups', () => {
  it('groups extended features by source and appends traits not mirrored as features', () => {
    const base = fixture();
    const groups = buildFeatureGroups({
      ...base,
      extendedFeatures: [
        {
          id: 'sw',
          name: 'Second Wind',
          sourceType: 'class',
          maxUses: 1,
          usedUses: 0,
          restType: 'short',
          displayOrder: 0,
          description: '<p>Heal</p>',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'dv',
          name: 'Darkvision',
          sourceType: 'race',
          maxUses: 0,
          usedUses: 0,
          restType: 'long',
          displayOrder: 0,
          isPassive: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      trackableTraits: [
        {
          id: 'sw',
          name: 'Second Wind',
          maxUses: 1,
          usedUses: 0,
          restType: 'short',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'luck',
          name: 'Lucky',
          maxUses: 3,
          usedUses: 1,
          restType: 'long',
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    expect(groups.map(g => g.label)).toEqual([
      'Class Features',
      'Racial Features',
      'Tracked traits',
    ]);
    expect(groups[0].features[0]).toMatchObject({
      id: 'sw',
      kind: 'extended',
      maxUses: 1,
      tag: '1 / short rest',
    });
    expect(groups[1].features[0].tag).toBe('Passive');
    expect(groups[2].features[0]).toMatchObject({
      id: 'luck',
      kind: 'trait',
      usedUses: 1,
    });
  });
});

describe('buildConditionToggles', () => {
  it('lists the 14 standard conditions (no exhaustion) with active ids', () => {
    const base = fixture();
    const toggles = buildConditionToggles({
      ...base,
      conditionsAndDiseases: {
        ...base.conditionsAndDiseases,
        activeConditions: [
          {
            id: 'prone-1',
            name: 'Prone',
            source: 'Self',
            description: '',
            stackable: false,
            count: 1,
            appliedAt: '',
          },
        ],
      },
    });
    expect(toggles).toHaveLength(14);
    expect(toggles.find(t => t.name === 'Prone')!.activeId).toBe('prone-1');
    expect(toggles.some(t => t.name === 'Exhaustion')).toBe(false);
  });
});

describe('buildOtherEffects', () => {
  const cond = (
    id: string,
    name: string,
    extra: Partial<
      CharacterState['conditionsAndDiseases']['activeConditions'][number]
    > = {}
  ) => ({
    id,
    name,
    source: 'Self',
    description: '',
    stackable: false,
    count: 1,
    appliedAt: '',
    ...extra,
  });

  it('keeps non-standard conditions and diseases, dropping standard ones and exhaustion', () => {
    const base = fixture();
    const view = buildOtherEffects({
      ...base,
      conditionsAndDiseases: {
        ...base.conditionsAndDiseases,
        activeConditions: [
          cond('p', 'Prone'),
          cond('e', 'Exhaustion', { count: 2 }),
          cond('b', 'Bless', { kind: 'buff', source: 'Map' }),
          cond('x', 'Hexed', { count: 3 }),
        ],
        activeDiseases: [
          {
            id: 'd1',
            name: 'Sewer Plague',
            source: 'DMG',
            description: '',
            appliedAt: '',
          },
        ],
      },
    });
    expect(view.conditions).toEqual([
      { id: 'b', name: 'Bless', kind: 'buff', count: 1, source: 'Map' },
      { id: 'x', name: 'Hexed', kind: 'neutral', count: 3, source: 'Self' },
    ]);
    expect(view.diseases).toEqual([
      { id: 'd1', name: 'Sewer Plague', source: 'DMG' },
    ]);
  });

  it('is empty when nothing non-standard is active', () => {
    const view = buildOtherEffects(fixture());
    expect(view).toEqual({ conditions: [], diseases: [] });
  });
});

describe('exhaustionRulesText', () => {
  it('describes both rule variants', () => {
    expect(exhaustionRulesText(0, '2024')).toBe('None');
    expect(exhaustionRulesText(2, '2024')).toBe(
      '−4 to d20 tests, −10 ft speed'
    );
    expect(exhaustionRulesText(6, '2024')).toBe('Death');
    expect(exhaustionRulesText(2, '2014')).toBe(
      'Disadvantage on ability checks; speed halved'
    );
  });
});
