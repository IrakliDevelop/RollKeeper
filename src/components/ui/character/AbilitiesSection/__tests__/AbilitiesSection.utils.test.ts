import { describe, expect, it } from 'vitest';
import type { ProficiencyLevel } from '@/components/ui/game/ProficiencyDot';
import {
  ABILITY_ORDER,
  SKILLS_BY_ABILITY,
  applySkillDotTap,
  skillLevel,
} from '../AbilitiesSection.utils';

describe('SKILLS_BY_ABILITY', () => {
  it('lists each ability’s skills alphabetically', () => {
    expect(SKILLS_BY_ABILITY.strength).toEqual(['athletics']);
    expect(SKILLS_BY_ABILITY.dexterity).toEqual([
      'acrobatics',
      'sleightOfHand',
      'stealth',
    ]);
    expect(SKILLS_BY_ABILITY.constitution).toEqual([]);
    expect(SKILLS_BY_ABILITY.wisdom).toEqual([
      'animalHandling',
      'insight',
      'medicine',
      'perception',
      'survival',
    ]);
  });

  it('places all 18 skills once', () => {
    const all = ABILITY_ORDER.flatMap(ability => SKILLS_BY_ABILITY[ability]);
    expect(all).toHaveLength(18);
    expect(new Set(all).size).toBe(18);
  });
});

describe('skillLevel', () => {
  it('reads proficiency and expertise', () => {
    expect(skillLevel({ proficient: false, expertise: false }, false)).toBe(
      'none'
    );
    expect(skillLevel({ proficient: true, expertise: false }, false)).toBe(
      'proficient'
    );
    expect(skillLevel({ proficient: true, expertise: true }, false)).toBe(
      'expertise'
    );
  });

  it('ignores expertise without proficiency, as the bonus does', () => {
    expect(skillLevel({ proficient: false, expertise: true }, false)).toBe(
      'none'
    );
  });

  it('gives Jack of All Trades a half dot on skills without proficiency', () => {
    expect(skillLevel({ proficient: false, expertise: false }, true)).toBe(
      'half'
    );
    expect(skillLevel({ proficient: true, expertise: false }, true)).toBe(
      'proficient'
    );
  });

  it('reads a missing skill as not proficient', () => {
    expect(skillLevel(undefined, false)).toBe('none');
  });
});

describe('applySkillDotTap', () => {
  function tap(level: ProficiencyLevel) {
    const calls: string[] = [];
    applySkillDotTap('stealth', level, {
      onUpdateSkillProficiency: (skill, on) =>
        calls.push(`proficiency ${skill} ${on}`),
      onUpdateSkillExpertise: (skill, on) =>
        calls.push(`expertise ${skill} ${on}`),
    });
    return calls;
  }

  it('makes a skill without proficiency proficient', () => {
    expect(tap('none')).toEqual(['proficiency stealth true']);
    expect(tap('half')).toEqual(['proficiency stealth true']);
  });

  it('adds expertise to a proficient skill', () => {
    expect(tap('proficient')).toEqual(['expertise stealth true']);
  });

  it('clears expertise first, then proficiency', () => {
    expect(tap('expertise')).toEqual([
      'expertise stealth false',
      'proficiency stealth false',
    ]);
  });
});
