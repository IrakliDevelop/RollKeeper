import { describe, it, expect } from 'vitest';
import {
  convertProcessedSpellToFormData,
  convertFormDataToSpell,
  searchSpells,
  createInitialSpellFormData,
  spellToFormData,
  type SpellFormData,
  type FreeCastMode,
} from '@/utils/spellConversion';
import type { ProcessedSpell } from '@/types/spells';
import type { Spell } from '@/types/character';

// =============================================
// Helpers
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
    'A bright streak flashes from your pointing finger to a point you choose within range.',
  isCantrip: false,
  isSrd: true,
  classes: [],
  tags: [],
  ...overrides,
});

const makeSpell = (overrides: Partial<Spell> = {}): Spell => ({
  id: 'spell_test',
  name: 'Magic Missile',
  level: 1,
  school: 'Evocation',
  castingTime: '1 action',
  range: '120 feet',
  components: { verbal: true, somatic: true, material: false },
  duration: 'Instantaneous',
  description: 'You create three darts of magical force.',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

// =============================================
// convertProcessedSpellToFormData
// =============================================
describe('convertProcessedSpellToFormData', () => {
  it('converts a complete spell correctly', () => {
    const spell = makeProcessedSpell();
    const result = convertProcessedSpellToFormData(spell);

    expect(result.name).toBe('Fireball');
    expect(result.level).toBe(3);
    expect(result.school).toBe('Evocation');
    expect(result.castingTime).toBe('1 action');
    expect(result.range).toBe('150 feet');
    expect(result.duration).toBe('Instantaneous');
    expect(result.source).toBe('PHB');
  });

  it('maps components including material description', () => {
    const spell = makeProcessedSpell();
    const result = convertProcessedSpellToFormData(spell);

    expect(result.components.verbal).toBe(true);
    expect(result.components.somatic).toBe(true);
    expect(result.components.material).toBe(true);
    expect(result.components.materialDescription).toBe(
      'A tiny ball of bat guano and sulfur'
    );
  });

  it('sets isPrepared and isAlwaysPrepared to false by default', () => {
    const spell = makeProcessedSpell();
    const result = convertProcessedSpellToFormData(spell);

    expect(result.isPrepared).toBe(false);
    expect(result.isAlwaysPrepared).toBe(false);
  });

  it('sets castingSource to empty string', () => {
    const result = convertProcessedSpellToFormData(makeProcessedSpell());
    expect(result.castingSource).toBe('');
  });

  it('sets freeCastMode to normal and freeCastMax to 1 by default', () => {
    const result = convertProcessedSpellToFormData(makeProcessedSpell());
    expect(result.freeCastMode).toBe('normal');
    expect(result.freeCastMax).toBe(1);
  });

  it('infers save action type from saves metadata', () => {
    const spell = makeProcessedSpell({ saves: ['dexterity'] });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.actionType).toBe('save');
    expect(result.savingThrow).toBe('Dexterity');
  });

  it('capitalizes saving throw', () => {
    const spell = makeProcessedSpell({ saves: ['constitution'] });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.savingThrow).toBe('Constitution');
  });

  it('infers attack action type from tags', () => {
    const spell = makeProcessedSpell({ tags: ['ranged spell attack'] });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.actionType).toBe('attack');
  });

  it('infers attack from description', () => {
    const spell = makeProcessedSpell({
      description: 'Make a spell attack roll against the target.',
    });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.actionType).toBe('attack');
  });

  it('infers save from description when no saves metadata', () => {
    const spell = makeProcessedSpell({
      description: 'The target must make a saving throw.',
    });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.actionType).toBe('save');
  });

  it('defaults to utility when no attack/save indicators', () => {
    const spell = makeProcessedSpell({
      description: 'You conjure a creature.',
    });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.actionType).toBe('utility');
  });

  it('extracts damage type from damage metadata', () => {
    const spell = makeProcessedSpell({ damage: ['fire'] });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.damageType).toBe('fire');
  });

  it('extracts damage dice from description {@damage} tag', () => {
    const spell = makeProcessedSpell({
      description: 'Each creature takes {@damage 8d6} fire damage.',
    });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.damage).toBe('8d6');
  });

  it('handles missing materialComponent gracefully', () => {
    const spell = makeProcessedSpell({
      components: { verbal: true, somatic: false, material: false },
    });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.components.materialDescription).toBe('');
  });

  it('handles missing saves and damage arrays', () => {
    const spell = makeProcessedSpell({ saves: undefined, damage: undefined });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.savingThrow).toBe('');
    expect(result.damageType).toBe('');
  });

  it('normalizes "1 bonus" casting time to "1 bonus action"', () => {
    const spell = makeProcessedSpell({ castingTime: '1 bonus' });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.castingTime).toBe('1 bonus action');
  });

  it('maps ritual and concentration flags', () => {
    const spell = makeProcessedSpell({ isRitual: true, concentration: true });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.ritual).toBe(true);
    expect(result.concentration).toBe(true);
  });

  it('maps higherLevelDescription to higherLevel', () => {
    const spell = makeProcessedSpell({
      higherLevelDescription:
        'When cast at 4th level or higher, the damage increases.',
    });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.higherLevel).toBeTruthy();
  });

  it('sets higherLevel to empty string when not provided', () => {
    const spell = makeProcessedSpell({ higherLevelDescription: undefined });
    const result = convertProcessedSpellToFormData(spell);
    expect(result.higherLevel).toBe('');
  });
});

// =============================================
// convertFormDataToSpell
// =============================================
describe('convertFormDataToSpell', () => {
  const baseFormData: SpellFormData = {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: '150 feet',
    components: {
      verbal: true,
      somatic: true,
      material: true,
      materialDescription: 'bat guano',
    },
    duration: 'Instantaneous',
    description: 'A bright streak...',
    higherLevel: '',
    ritual: false,
    concentration: false,
    isPrepared: false,
    isAlwaysPrepared: false,
    actionType: 'save',
    savingThrow: 'Dexterity',
    damage: '8d6',
    damageType: 'fire',
    source: 'PHB',
    castingSource: '',
    freeCastMode: 'normal',
    freeCastMax: 1,
  };

  it('creates a Spell with an id', () => {
    const spell = convertFormDataToSpell(baseFormData);
    expect(spell.id).toMatch(/^spell_/);
  });

  it('uses provided existingId', () => {
    const spell = convertFormDataToSpell(baseFormData, 'existing_id_123');
    expect(spell.id).toBe('existing_id_123');
  });

  it('maps core fields', () => {
    const spell = convertFormDataToSpell(baseFormData);
    expect(spell.name).toBe('Fireball');
    expect(spell.level).toBe(3);
    expect(spell.school).toBe('Evocation');
    expect(spell.castingTime).toBe('1 action');
    expect(spell.range).toBe('150 feet');
    expect(spell.duration).toBe('Instantaneous');
  });

  it('maps components', () => {
    const spell = convertFormDataToSpell(baseFormData);
    expect(spell.components.verbal).toBe(true);
    expect(spell.components.somatic).toBe(true);
    expect(spell.components.material).toBe(true);
    expect(spell.components.materialDescription).toBe('bat guano');
  });

  it('sets freeCastMax to 0 for at_will mode', () => {
    const spell = convertFormDataToSpell({
      ...baseFormData,
      freeCastMode: 'at_will',
    });
    expect(spell.freeCastMax).toBe(0);
    expect(spell.freeCastsUsed).toBe(0);
  });

  it('sets freeCastMax for innate mode', () => {
    const spell = convertFormDataToSpell({
      ...baseFormData,
      freeCastMode: 'innate',
      freeCastMax: 3,
    });
    expect(spell.freeCastMax).toBe(3);
    expect(spell.freeCastsUsed).toBe(0);
  });

  it('sets freeCastMax to undefined for normal mode', () => {
    const spell = convertFormDataToSpell({
      ...baseFormData,
      freeCastMode: 'normal',
    });
    expect(spell.freeCastMax).toBeUndefined();
    expect(spell.freeCastsUsed).toBeUndefined();
  });

  it('sets createdAt and updatedAt timestamps', () => {
    const spell = convertFormDataToSpell(baseFormData);
    expect(spell.createdAt).toBeTruthy();
    expect(spell.updatedAt).toBeTruthy();
  });

  it('omits empty optional string fields', () => {
    const spell = convertFormDataToSpell({
      ...baseFormData,
      higherLevel: '',
      savingThrow: '',
      damage: '',
      damageType: '',
      castingSource: '',
    });
    expect(spell.higherLevel).toBeUndefined();
    expect(spell.savingThrow).toBeUndefined();
    expect(spell.damage).toBeUndefined();
    expect(spell.damageType).toBeUndefined();
    expect(spell.castingSource).toBeUndefined();
  });
});

// =============================================
// searchSpells
// =============================================
describe('searchSpells', () => {
  const spells: ProcessedSpell[] = [
    makeProcessedSpell({
      name: 'Fireball',
      schoolName: 'Evocation',
      description: 'A blast of fire.',
    }),
    makeProcessedSpell({
      id: 'mm',
      name: 'Magic Missile',
      schoolName: 'Evocation',
      description: 'Darts of force.',
    }),
    makeProcessedSpell({
      id: 'cs',
      name: 'Cure Wounds',
      schoolName: 'Evocation',
      description: 'Heals hit points.',
    }),
    makeProcessedSpell({
      id: 'haste',
      name: 'Haste',
      schoolName: 'Transmutation',
      description: 'Speed doubles.',
      tags: ['speed', 'buff'],
    }),
  ];

  it('returns all spells when query is empty', () => {
    expect(searchSpells(spells, '')).toHaveLength(4);
  });

  it('returns all spells when query is whitespace', () => {
    expect(searchSpells(spells, '   ')).toHaveLength(4);
  });

  it('filters by name (case-insensitive)', () => {
    const result = searchSpells(spells, 'fireball');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Fireball');
  });

  it('filters by school name', () => {
    const result = searchSpells(spells, 'transmutation');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Haste');
  });

  it('filters by description text', () => {
    const result = searchSpells(spells, 'heals');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Cure Wounds');
  });

  it('filters by tags', () => {
    const result = searchSpells(spells, 'buff');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Haste');
  });

  it('sorts exact name matches first', () => {
    const result = searchSpells(spells, 'Fireball');
    expect(result[0].name).toBe('Fireball');
  });

  it('returns empty array when nothing matches', () => {
    expect(searchSpells(spells, 'zzznomatch')).toHaveLength(0);
  });
});

// =============================================
// createInitialSpellFormData
// =============================================
describe('createInitialSpellFormData', () => {
  it('returns a form data object with sensible defaults', () => {
    const data = createInitialSpellFormData();

    expect(data.name).toBe('');
    expect(data.level).toBe(0);
    expect(data.school).toBe('Evocation');
    expect(data.castingTime).toBe('1 action');
    expect(data.range).toBe('Touch');
    expect(data.duration).toBe('Instantaneous');
    expect(data.source).toBe('PHB');
    expect(data.freeCastMode).toBe('normal');
    expect(data.freeCastMax).toBe(1);
  });

  it('defaults all components to false', () => {
    const data = createInitialSpellFormData();
    expect(data.components.verbal).toBe(false);
    expect(data.components.somatic).toBe(false);
    expect(data.components.material).toBe(false);
    expect(data.components.materialDescription).toBe('');
  });

  it('defaults boolean flags to false', () => {
    const data = createInitialSpellFormData();
    expect(data.ritual).toBe(false);
    expect(data.concentration).toBe(false);
    expect(data.isPrepared).toBe(false);
    expect(data.isAlwaysPrepared).toBe(false);
  });
});

// =============================================
// spellToFormData
// =============================================
describe('spellToFormData', () => {
  it('converts a full Spell back to form data', () => {
    const spell = makeSpell({
      school: 'Evocation',
      castingTime: '1 action',
      range: '120 feet',
      duration: 'Instantaneous',
      source: 'PHB',
      savingThrow: 'Dexterity',
      damage: '3d4',
      damageType: 'force',
    });
    const result = spellToFormData(spell);

    expect(result.name).toBe('Magic Missile');
    expect(result.level).toBe(1);
    expect(result.school).toBe('Evocation');
    expect(result.savingThrow).toBe('Dexterity');
    expect(result.damage).toBe('3d4');
    expect(result.damageType).toBe('force');
  });

  it('uses default fallbacks for missing optional fields', () => {
    const spell: Spell = {
      id: 'bare',
      name: 'Bare Spell',
      level: 2,
      description: '',
      createdAt: '',
      updatedAt: '',
    } as unknown as Spell;

    const result = spellToFormData(spell);
    expect(result.school).toBe('Evocation');
    expect(result.castingTime).toBe('1 action');
    expect(result.range).toBe('Touch');
    expect(result.duration).toBe('Instantaneous');
    expect(result.source).toBe('PHB');
    expect(result.freeCastMode).toBe('normal');
    expect(result.freeCastMax).toBe(1);
  });

  it('detects at_will mode when freeCastMax is 0', () => {
    const spell = makeSpell({ freeCastMax: 0 });
    const result = spellToFormData(spell);
    expect(result.freeCastMode).toBe('at_will');
  });

  it('detects innate mode when freeCastMax is positive', () => {
    const spell = makeSpell({ freeCastMax: 3 });
    const result = spellToFormData(spell);
    expect(result.freeCastMode).toBe('innate');
    expect(result.freeCastMax).toBe(3);
  });

  it('keeps normal mode when freeCastMax is undefined', () => {
    const spell = makeSpell({ freeCastMax: undefined });
    const result = spellToFormData(spell);
    expect(result.freeCastMode).toBe('normal');
  });
});
