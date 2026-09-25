import { describe, it, expect } from 'vitest';
import {
  abilitySaveValue,
  computeSaveProficiencies,
  parseSavesString,
  removeSaveOverride,
  resetSavePatch,
  saveProficiencyPatch,
  signed,
  signedModifier,
} from '@/components/ui/encounter/combat-screen/detail/DetailAbilityScores.utils';
import type { MonsterStatBlock } from '@/types/encounter';

function makeStatBlock(
  overrides: Partial<MonsterStatBlock> = {}
): MonsterStatBlock {
  return {
    str: 10,
    dex: 14,
    con: 12,
    int: 8,
    wis: 15,
    cha: 10,
    saves: '',
    skills: '',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: '',
    passivePerception: 13,
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

describe('parseSavesString', () => {
  it('parses a typical loader-formatted string', () => {
    expect(parseSavesString('DEX +5, CON +8')).toEqual({
      dex: '+5',
      con: '+8',
    });
  });

  it('accepts lowercase and mixed-case ability keys', () => {
    expect(parseSavesString('Dex +6, con +15')).toEqual({
      dex: '+6',
      con: '+15',
    });
  });

  it('keeps negative values verbatim', () => {
    expect(parseSavesString('STR -1')).toEqual({ str: '-1' });
  });

  it('returns an empty map for an empty string', () => {
    expect(parseSavesString('')).toEqual({});
  });

  it('returns an empty map for undefined', () => {
    expect(parseSavesString(undefined)).toEqual({});
  });

  it('skips malformed tokens and keeps valid ones', () => {
    // "Wisdom +3" is not a 3-letter key; "CON" has no value.
    expect(parseSavesString('Wisdom +3, DEX +5, CON')).toEqual({ dex: '+5' });
  });

  it('skips unknown three-letter keys', () => {
    expect(parseSavesString('FOO +2')).toEqual({});
  });

  it('tolerates extra whitespace around tokens and values', () => {
    expect(parseSavesString('  dex   +5 ,  wis +2 ')).toEqual({
      dex: '+5',
      wis: '+2',
    });
  });
});

describe('removeSaveOverride', () => {
  it('removes only the selected ability and preserves other tokens', () => {
    expect(removeSaveOverride('STR +8, DEX +4, odd note', 'str')).toBe(
      'DEX +4, odd note'
    );
  });
});

describe('signed', () => {
  it('signs positive, negative, and zero values', () => {
    expect(signed(3)).toBe('+3');
    expect(signed(-1)).toBe('-1');
    expect(signed(0)).toBe('+0');
  });
});

describe('signedModifier', () => {
  it('computes the D&D ability modifier, signed', () => {
    expect(signedModifier(10)).toBe('+0');
    expect(signedModifier(14)).toBe('+2');
    expect(signedModifier(8)).toBe('-1');
  });
});

describe('computeSaveProficiencies', () => {
  it('infers proficiencies from the saves string when saveProficiencies is absent', () => {
    const sb = makeStatBlock({ saves: 'DEX +5, WIS +4' });
    const { proficiencies, saveByAbility } = computeSaveProficiencies(sb);
    expect(proficiencies.sort()).toEqual(['dex', 'wis']);
    expect(saveByAbility).toEqual({ dex: '+5', wis: '+4' });
  });

  it('prefers explicit saveProficiencies over inference', () => {
    const sb = makeStatBlock({
      saves: 'DEX +5',
      saveProficiencies: ['str', 'con'],
    });
    const { proficiencies } = computeSaveProficiencies(sb);
    expect(proficiencies).toEqual(['str', 'con']);
  });
});

describe('abilitySaveValue', () => {
  it('uses the explicit saves-string override verbatim when present', () => {
    const sb = makeStatBlock({ dex: 14, saves: 'DEX +99' });
    const { proficiencies, saveByAbility } = computeSaveProficiencies(sb);
    expect(abilitySaveValue(sb, 'dex', proficiencies, saveByAbility, 2)).toBe(
      '+99'
    );
  });

  it('calculates modifier + proficiency bonus when proficient with no override', () => {
    const sb = makeStatBlock({
      wis: 15,
      saves: '',
      saveProficiencies: ['wis'],
    });
    const { proficiencies, saveByAbility } = computeSaveProficiencies(sb);
    // mod +2, PB +3 => +5
    expect(abilitySaveValue(sb, 'wis', proficiencies, saveByAbility, 3)).toBe(
      '+5'
    );
  });

  it('calculates the bare modifier when not proficient', () => {
    const sb = makeStatBlock({ int: 8, saveProficiencies: [] });
    const { proficiencies, saveByAbility } = computeSaveProficiencies(sb);
    expect(abilitySaveValue(sb, 'int', proficiencies, saveByAbility, 3)).toBe(
      '-1'
    );
  });
});

describe('saveProficiencyPatch', () => {
  it('adds the ability to saveProficiencies and preserves saves when turning on', () => {
    const sb = makeStatBlock({ saves: 'DEX +5', saveProficiencies: ['dex'] });
    const patch = saveProficiencyPatch(sb, ['dex'], 'str', true);
    expect(patch.saveProficiencies?.sort()).toEqual(['dex', 'str'].sort());
    expect(patch.saves).toBe('DEX +5');
  });

  it('removes the ability and strips any override when turning off', () => {
    const sb = makeStatBlock({
      saves: 'DEX +5, STR +8',
      saveProficiencies: ['dex', 'str'],
    });
    const patch = saveProficiencyPatch(sb, ['dex', 'str'], 'str', false);
    expect(patch.saveProficiencies).toEqual(['dex']);
    expect(patch.saves).toBe('DEX +5');
  });
});

describe('resetSavePatch', () => {
  it('keeps the current proficiencies but strips the override for the ability', () => {
    const sb = makeStatBlock({
      saves: 'DEX +5, STR +99',
      saveProficiencies: ['dex', 'str'],
    });
    const patch = resetSavePatch(sb, ['dex', 'str'], 'str');
    expect(patch.saveProficiencies).toEqual(['dex', 'str']);
    expect(patch.saves).toBe('DEX +5');
  });
});
