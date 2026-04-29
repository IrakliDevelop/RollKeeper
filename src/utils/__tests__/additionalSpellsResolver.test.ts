import { describe, it, expect } from 'vitest';
import {
  resolveGrantedSpells,
  resolveChosenSpell,
  filterSpellsByChooseFilter,
  type ResolveResult,
} from '@/utils/additionalSpellsResolver';
import type { ProcessedSpell } from '@/types/spells';
import type { ParsedAdditionalSpells } from '@/utils/additionalSpellsParser';

// =============================================
// Minimal ProcessedSpell factory
// =============================================

const makeProcessedSpell = (
  overrides: Partial<ProcessedSpell> = {}
): ProcessedSpell => ({
  id: 'fireball-phb',
  name: 'Fireball',
  level: 3,
  school: 'V',
  schoolName: 'Evocation',
  source: 'PHB',
  isRitual: false,
  concentration: false,
  castingTime: '1 action',
  range: '150 feet',
  components: {
    verbal: true,
    somatic: true,
    material: true,
    materialComponent: 'A tiny ball of bat guano and sulfur',
  },
  duration: 'Instantaneous',
  description:
    'A bright streak flashes from your pointing finger to a point you choose.',
  isCantrip: false,
  isSrd: true,
  classes: ['wizard', 'sorcerer'],
  tags: [],
  ...overrides,
});

const ALL_SPELLS: ProcessedSpell[] = [
  makeProcessedSpell({
    id: 'fireball-phb',
    name: 'Fireball',
    level: 3,
    classes: ['wizard', 'sorcerer'],
  }),
  makeProcessedSpell({
    id: 'misty-step-phb',
    name: 'Misty Step',
    level: 2,
    school: 'C',
    schoolName: 'Conjuration',
    classes: ['wizard', 'warlock'],
  }),
  makeProcessedSpell({
    id: 'cure-wounds-phb',
    name: 'Cure Wounds',
    level: 1,
    school: 'A',
    schoolName: 'Abjuration',
    classes: ['cleric', 'druid'],
  }),
  makeProcessedSpell({
    id: 'detect-magic-phb',
    name: 'Detect Magic',
    level: 1,
    school: 'D',
    schoolName: 'Divination',
    isRitual: true,
    classes: ['wizard', 'cleric'],
  }),
  makeProcessedSpell({
    id: 'dancing-lights-phb',
    name: 'Dancing Lights',
    level: 0,
    isCantrip: true,
    school: 'V',
    schoolName: 'Evocation',
    classes: ['bard', 'wizard'],
  }),
  makeProcessedSpell({
    id: 'hex-phb',
    name: 'Hex',
    level: 1,
    school: 'E',
    schoolName: 'Enchantment',
    classes: ['warlock'],
  }),
];

// =============================================
// Minimal ParsedAdditionalSpells factory
// =============================================

function makeParsed(
  overrides: Partial<ParsedAdditionalSpells> = {}
): ParsedAdditionalSpells {
  return {
    concrete: [],
    choices: [],
    ...overrides,
  };
}

describe('resolveGrantedSpells', () => {
  it('resolves a known spell by name', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'Fireball',
          sourceRef: 'fireball|phb',
          grantType: 'prepared',
          isAlwaysPrepared: true,
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'Fey Touched');
    expect(result.resolved).toHaveLength(1);
    expect(result.unresolved).toHaveLength(0);
    expect(result.resolved[0].spell.name).toBe('Fireball');
  });

  it('adds the feat name as castingSource', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'Misty Step',
          sourceRef: 'misty step',
          grantType: 'known',
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'Fey Touched');
    expect(result.resolved[0].spell.castingSource).toBe('Fey Touched');
  });

  it('adds unresolved spell name when spell not found', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'Nonexistent Spell',
          sourceRef: 'nonexistent spell',
          grantType: 'known',
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'Some Feat');
    expect(result.resolved).toHaveLength(0);
    expect(result.unresolved).toContain('Nonexistent Spell');
  });

  it('returns "Always Prepared" label for prepared grant type', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'Fireball',
          sourceRef: 'fireball',
          grantType: 'prepared',
          isAlwaysPrepared: true,
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'Test Feat');
    expect(result.resolved[0].grantLabel).toBe('Always Prepared');
  });

  it('returns "At Will" label for innate_will grant type', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'Dancing Lights',
          sourceRef: 'dancing lights',
          grantType: 'innate_will',
          freeCastMax: 0,
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'High Elf');
    expect(result.resolved[0].grantLabel).toBe('At Will');
  });

  it('sets isAlwaysPrepared and isPrepared on prepared spell', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'Fireball',
          sourceRef: 'fireball',
          grantType: 'prepared',
          isAlwaysPrepared: true,
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'Feat');
    expect(result.resolved[0].spell.isAlwaysPrepared).toBe(true);
    expect(result.resolved[0].spell.isPrepared).toBe(true);
  });

  it('sets freeCastMax=0 on innate_will spell', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'Dancing Lights',
          sourceRef: 'dancing lights',
          grantType: 'innate_will',
          freeCastMax: 0,
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'High Elf');
    expect(result.resolved[0].spell.freeCastMax).toBe(0);
  });

  it('sets freeCastMax on innate_daily spell', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'Misty Step',
          sourceRef: 'misty step',
          grantType: 'innate_daily',
          freeCastMax: 1,
          restType: 'long',
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'Fey Touched');
    expect(result.resolved[0].spell.freeCastMax).toBe(1);
    expect(result.resolved[0].spell.freeCastsUsed).toBe(0);
  });

  it('sets ritual=true for innate_ritual spell', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'Detect Magic',
          sourceRef: 'detect magic',
          grantType: 'innate_ritual',
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'Ritual Caster');
    expect(result.resolved[0].spell.ritual).toBe(true);
  });

  it('handles empty concrete array', () => {
    const parsed = makeParsed({ concrete: [] });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'Feat');
    expect(result.resolved).toHaveLength(0);
    expect(result.unresolved).toHaveLength(0);
  });

  it('matches spell names case-insensitively', () => {
    const parsed = makeParsed({
      concrete: [
        {
          spellName: 'fireball',
          sourceRef: 'fireball',
          grantType: 'known',
        },
      ],
    });
    const result = resolveGrantedSpells(parsed, ALL_SPELLS, 'Feat');
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].spell.name).toBe('Fireball');
  });
});

describe('resolveChosenSpell', () => {
  it('converts a ProcessedSpell to a character Spell with grant properties', () => {
    const processed = makeProcessedSpell({ name: 'Hex', level: 1 });
    const spell = resolveChosenSpell(
      processed,
      'innate_daily',
      1,
      'long',
      undefined,
      'Warlock Class Feature'
    );
    expect(spell.name).toBe('Hex');
    expect(spell.castingSource).toBe('Warlock Class Feature');
    expect(spell.freeCastMax).toBe(1);
    expect(spell.freeCastsUsed).toBe(0);
  });

  it('sets isAlwaysPrepared for prepared grant type', () => {
    const processed = makeProcessedSpell({ name: 'Cure Wounds', level: 1 });
    const spell = resolveChosenSpell(
      processed,
      'prepared',
      undefined,
      undefined,
      true,
      'Divine Domain'
    );
    expect(spell.isAlwaysPrepared).toBe(true);
    expect(spell.isPrepared).toBe(true);
  });
});

describe('filterSpellsByChooseFilter', () => {
  it('filters by level', () => {
    const result = filterSpellsByChooseFilter(ALL_SPELLS, { level: 1 });
    expect(result.every(s => s.level === 1)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters level 0 (cantrips)', () => {
    const result = filterSpellsByChooseFilter(ALL_SPELLS, { level: 0 });
    expect(result.every(s => s.level === 0)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dancing Lights');
  });

  it('filters by class name', () => {
    const result = filterSpellsByChooseFilter(ALL_SPELLS, {
      className: 'cleric',
    });
    result.forEach(s => {
      expect(s.classes?.some(c => c.toLowerCase() === 'cleric')).toBe(true);
    });
  });

  it('filters by school name', () => {
    const result = filterSpellsByChooseFilter(ALL_SPELLS, {
      schools: ['Evocation'],
    });
    result.forEach(s => {
      expect(s.schoolName.toLowerCase()).toBe('evocation');
    });
  });

  it('filters by ritual flag', () => {
    const result = filterSpellsByChooseFilter(ALL_SPELLS, { ritual: true });
    result.forEach(s => expect(s.isRitual).toBe(true));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Detect Magic');
  });

  it('applies combined filters', () => {
    const result = filterSpellsByChooseFilter(ALL_SPELLS, {
      level: 1,
      className: 'wizard',
    });
    result.forEach(s => {
      expect(s.level).toBe(1);
      expect(s.classes?.some(c => c.toLowerCase() === 'wizard')).toBe(true);
    });
  });

  it('returns all spells when no filter criteria given', () => {
    const result = filterSpellsByChooseFilter(ALL_SPELLS, {});
    expect(result).toHaveLength(ALL_SPELLS.length);
  });

  it('returns empty array when no spells match', () => {
    const result = filterSpellsByChooseFilter(ALL_SPELLS, { level: 9 });
    expect(result).toHaveLength(0);
  });

  it('filters by multiple schools', () => {
    const result = filterSpellsByChooseFilter(ALL_SPELLS, {
      schools: ['Evocation', 'Conjuration'],
    });
    result.forEach(s => {
      expect(['evocation', 'conjuration']).toContain(
        s.schoolName.toLowerCase()
      );
    });
  });
});
