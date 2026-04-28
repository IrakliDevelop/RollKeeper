import { describe, it, expect } from 'vitest';
import {
  cleanSpellName,
  parseChooseFilter,
  grantTypeLabel,
  parseAdditionalSpells,
  type GrantType,
} from '@/utils/additionalSpellsParser';

describe('cleanSpellName', () => {
  it('returns plain name unchanged', () => {
    expect(cleanSpellName('fireball')).toEqual({
      name: 'fireball',
      level: undefined,
    });
  });

  it('strips source suffix after pipe', () => {
    expect(cleanSpellName('misty step|xphb')).toEqual({
      name: 'misty step',
      level: undefined,
    });
  });

  it('extracts cantrip marker as level 0', () => {
    expect(cleanSpellName('prestidigitation#c')).toEqual({
      name: 'prestidigitation',
      level: 0,
    });
  });

  it('extracts numeric cast level', () => {
    expect(cleanSpellName('searing smite#2')).toEqual({
      name: 'searing smite',
      level: 2,
    });
  });

  it('strips source when source contains hash (pipe wins over hash)', () => {
    // The pipe index is found first, so everything after | is discarded,
    // meaning the #c in "phb#c" is never seen as a level marker.
    expect(cleanSpellName('detect magic|phb#c')).toEqual({
      name: 'detect magic',
      level: undefined,
    });
  });

  it('trims whitespace from name', () => {
    expect(cleanSpellName('  sleep  ')).toEqual({
      name: 'sleep',
      level: undefined,
    });
  });

  it('handles name with no special markers', () => {
    expect(cleanSpellName('Cure Wounds')).toEqual({
      name: 'Cure Wounds',
      level: undefined,
    });
  });
});

describe('parseChooseFilter', () => {
  it('parses level filter', () => {
    expect(parseChooseFilter('level=1')).toEqual({ level: 1 });
  });

  it('parses level 0 (cantrip)', () => {
    expect(parseChooseFilter('level=0')).toEqual({ level: 0 });
  });

  it('parses class filter', () => {
    expect(parseChooseFilter('class=Wizard')).toEqual({ className: 'Wizard' });
  });

  it('parses combined level and class filter', () => {
    expect(parseChooseFilter('level=1|class=Wizard')).toEqual({
      level: 1,
      className: 'Wizard',
    });
  });

  it('parses school filter with abbreviation', () => {
    const result = parseChooseFilter('school=V');
    expect(result.schools).toContain('Evocation');
  });

  it('parses multiple school abbreviations separated by semicolons', () => {
    const result = parseChooseFilter('school=V;N');
    expect(result.schools).toContain('Evocation');
    expect(result.schools).toContain('Necromancy');
  });

  it('parses ritual filter', () => {
    const result = parseChooseFilter('components & miscellaneous=ritual');
    expect(result.ritual).toBe(true);
  });

  it('returns empty object for empty string', () => {
    expect(parseChooseFilter('')).toEqual({});
  });

  it('ignores unknown keys', () => {
    const result = parseChooseFilter('unknownkey=value');
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('grantTypeLabel', () => {
  it('returns "Always Prepared" for prepared', () => {
    expect(grantTypeLabel('prepared')).toBe('Always Prepared');
  });

  it('returns "At Will" for innate_will', () => {
    expect(grantTypeLabel('innate_will')).toBe('At Will');
  });

  it('returns "Ritual Only" for innate_ritual', () => {
    expect(grantTypeLabel('innate_ritual')).toBe('Ritual Only');
  });

  it('returns "Added to Known Spells" for known', () => {
    expect(grantTypeLabel('known')).toBe('Added to Known Spells');
  });

  it('returns "1/Long Rest (free)" for innate_daily with freeCastMax=1', () => {
    expect(grantTypeLabel('innate_daily', 1)).toBe('1/Long Rest (free)');
  });

  it('returns "3/Long Rest (free)" for innate_daily with freeCastMax=3', () => {
    expect(grantTypeLabel('innate_daily', 3)).toBe('3/Long Rest (free)');
  });

  it('returns "1/Short Rest (free)" for innate_rest with freeCastMax=1', () => {
    expect(grantTypeLabel('innate_rest', 1)).toBe('1/Short Rest (free)');
  });

  it('returns "2/Short Rest (free)" for innate_rest with freeCastMax=2', () => {
    expect(grantTypeLabel('innate_rest', 2)).toBe('2/Short Rest (free)');
  });
});

describe('parseAdditionalSpells', () => {
  it('returns null for empty array', () => {
    expect(parseAdditionalSpells([])).toBeNull();
  });

  it('returns null for null input', () => {
    // @ts-expect-error testing edge case
    expect(parseAdditionalSpells(null)).toBeNull();
  });

  it('parses a simple prepared spell block', () => {
    const raw = [
      {
        prepared: {
          _: ['misty step', 'fly'],
        },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result).not.toBeNull();
    expect(result!.concrete).toHaveLength(2);
    expect(result!.concrete[0].spellName).toBe('misty step');
    expect(result!.concrete[0].grantType).toBe('prepared');
    expect(result!.concrete[0].isAlwaysPrepared).toBe(true);
    expect(result!.concrete[1].spellName).toBe('fly');
  });

  it('parses innate daily spells', () => {
    const raw = [
      {
        innate: {
          _: {
            daily: {
              '1': ['darkness'],
            },
          },
        },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result).not.toBeNull();
    expect(result!.concrete).toHaveLength(1);
    expect(result!.concrete[0].grantType).toBe('innate_daily');
    expect(result!.concrete[0].freeCastMax).toBe(1);
    expect(result!.concrete[0].restType).toBe('long');
  });

  it('parses innate at-will spells', () => {
    const raw = [
      {
        innate: {
          _: {
            will: ['dancing lights'],
          },
        },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result).not.toBeNull();
    const spell = result!.concrete[0];
    expect(spell.grantType).toBe('innate_will');
    expect(spell.freeCastMax).toBe(0);
  });

  it('parses known spells', () => {
    const raw = [
      {
        known: {
          _: ['charm person'],
        },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result).not.toBeNull();
    expect(result!.concrete[0].grantType).toBe('known');
  });

  it('parses choose-type entries into choices array', () => {
    const raw = [
      {
        prepared: {
          _: [{ choose: 'level=1|class=Wizard', count: 2 }],
        },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result).not.toBeNull();
    expect(result!.choices).toHaveLength(1);
    expect(result!.choices[0].filter).toBe('level=1|class=Wizard');
    expect(result!.choices[0].count).toBe(2);
  });

  it('extracts ability when present', () => {
    const raw = [
      {
        ability: 'int',
        prepared: { _: ['identify'] },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result!.ability).toBe('int');
  });

  it('parses named groups (Magic Initiate style) into groups array', () => {
    const raw = [
      {
        name: 'Bard Spells',
        known: { _: [{ choose: 'level=0|class=Bard' }] },
      },
      {
        name: 'Cleric Spells',
        known: { _: [{ choose: 'level=0|class=Cleric' }] },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result).not.toBeNull();
    expect(result!.groups).toHaveLength(2);
    expect(result!.groups![0].name).toBe('Bard Spells');
    expect(result!.groups![1].name).toBe('Cleric Spells');
    // Flat arrays are empty for named groups
    expect(result!.concrete).toHaveLength(0);
    expect(result!.choices).toHaveLength(0);
  });

  it('strips source suffix from spell names', () => {
    const raw = [
      {
        prepared: { _: ['misty step|xphb'] },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result!.concrete[0].spellName).toBe('misty step');
    expect(result!.concrete[0].sourceRef).toBe('misty step|xphb');
  });

  it('parses innate rest spells with short rest type', () => {
    const raw = [
      {
        innate: {
          _: {
            rest: { '1': ['misty step'] },
          },
        },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result!.concrete[0].grantType).toBe('innate_rest');
    expect(result!.concrete[0].restType).toBe('short');
  });

  it('parses ritual spells', () => {
    const raw = [
      {
        innate: {
          _: {
            ritual: ['detect magic'],
          },
        },
      },
    ];
    const result = parseAdditionalSpells(raw);
    expect(result!.concrete[0].grantType).toBe('innate_ritual');
  });
});
