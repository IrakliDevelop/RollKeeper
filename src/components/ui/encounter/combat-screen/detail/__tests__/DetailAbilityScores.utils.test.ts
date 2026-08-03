import { describe, it, expect } from 'vitest';
import { parseSavesString } from '@/components/ui/encounter/combat-screen/detail/DetailAbilityScores.utils';

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
