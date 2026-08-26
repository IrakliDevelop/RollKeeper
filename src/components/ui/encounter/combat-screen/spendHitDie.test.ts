import { describe, it, expect, afterEach, vi } from 'vitest';
import { rollHitDie } from './spendHitDie';
import { createMockEncounterEntity } from '@/test/helpers';
import type { MonsterStatBlock } from '@/types/encounter';

function makeStatBlock(con: number): MonsterStatBlock {
  return {
    str: 10,
    dex: 10,
    con,
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
    cr: '1/4',
    type: 'humanoid',
    size: 'medium',
    languages: '',
    alignment: 'neutral',
    hpFormula: '2d8',
  };
}

describe('rollHitDie', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when entity has no hitDice field', () => {
    const entity = createMockEncounterEntity({ hitDice: undefined });
    expect(rollHitDie(entity)).toBeNull();
  });

  it('returns null when hitDice.current is 0', () => {
    const entity = createMockEncounterEntity({
      hitDice: { current: 0, max: 3, dieType: 'd8' },
    });
    expect(rollHitDie(entity)).toBeNull();
  });

  it('rolls the die, adds no CON mod when no stat block, and decrements hitDice', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // d8: floor(0.5 * 8) + 1 = 5
    const entity = createMockEncounterEntity({
      hitDice: { current: 2, max: 3, dieType: 'd8' },
    });
    const result = rollHitDie(entity);
    expect(result).not.toBeNull();
    expect(result?.healAmount).toBe(5);
    expect(result?.hitDice.current).toBe(1);
    expect(result?.hitDice.max).toBe(3);
    expect(result?.hitDice.dieType).toBe('d8');
  });

  it('applies positive CON modifier from monsterStatBlock', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // d6: floor(0 * 6) + 1 = 1; con=14 → mod=+2; total=3
    const entity = createMockEncounterEntity({
      hitDice: { current: 1, max: 1, dieType: 'd6' },
      monsterStatBlock: makeStatBlock(14),
    });
    const result = rollHitDie(entity);
    expect(result?.healAmount).toBe(3);
  });

  it('enforces minimum heal of 1 when CON mod makes total negative', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // d4: floor(0 * 4) + 1 = 1; con=4 → mod=-3; 1+(-3)=-2 → clamped to 1
    const entity = createMockEncounterEntity({
      hitDice: { current: 1, max: 2, dieType: 'd4' },
      monsterStatBlock: makeStatBlock(4),
    });
    const result = rollHitDie(entity);
    expect(result?.healAmount).toBe(1);
  });

  it('decrements hitDice.current by exactly 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const entity = createMockEncounterEntity({
      hitDice: { current: 5, max: 5, dieType: 'd10' },
    });
    const result = rollHitDie(entity);
    expect(result?.hitDice.current).toBe(4);
  });

  it('does not mutate the original entity hitDice', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const entity = createMockEncounterEntity({
      hitDice: { current: 3, max: 3, dieType: 'd8' },
    });
    rollHitDie(entity);
    expect(entity.hitDice?.current).toBe(3);
  });
});
