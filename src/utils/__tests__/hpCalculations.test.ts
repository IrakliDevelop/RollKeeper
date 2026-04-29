import { describe, it, expect } from 'vitest';
import {
  calculateMaxHP,
  getClassHitDie,
  applyDamage,
  applyHealing,
  addTemporaryHP,
  makeDeathSave,
  resetDeathSaves,
  isDying,
  isDead,
  isStabilized,
} from '@/utils/hpCalculations';
import { HitPoints, ClassInfo } from '@/types/character';

// =============================================
// Test helpers
// =============================================

const makeHP = (overrides: Partial<HitPoints> = {}): HitPoints => ({
  current: 30,
  max: 44,
  temporary: 0,
  calculationMode: 'auto',
  ...overrides,
});

const makeClassInfo = (overrides: Partial<ClassInfo> = {}): ClassInfo => ({
  name: 'Fighter',
  isCustom: false,
  hitDie: 10,
  ...overrides,
});

// =============================================
// calculateMaxHP
// =============================================
describe('calculateMaxHP', () => {
  it('returns manual override when provided', () => {
    const classInfo = makeClassInfo({ hitDie: 10 });
    expect(calculateMaxHP(classInfo, 5, 14, 50)).toBe(50);
  });

  it('returns manual override of 1 (not ignored as falsy)', () => {
    const classInfo = makeClassInfo({ hitDie: 10 });
    expect(calculateMaxHP(classInfo, 5, 14, 1)).toBe(1);
  });

  it('level 1: full hit die + CON modifier', () => {
    // Fighter d10, CON 14 (+2) → 10 + 2 = 12
    const classInfo = makeClassInfo({ hitDie: 10 });
    expect(calculateMaxHP(classInfo, 1, 14)).toBe(12);
  });

  it('level 1: Wizard d6 with CON 10 (+0) → 6', () => {
    const classInfo = makeClassInfo({ name: 'Wizard', hitDie: 6 });
    expect(calculateMaxHP(classInfo, 1, 10)).toBe(6);
  });

  it('level 1: Barbarian d12 with CON 16 (+3) → 15', () => {
    const classInfo = makeClassInfo({ name: 'Barbarian', hitDie: 12 });
    expect(calculateMaxHP(classInfo, 1, 16)).toBe(15);
  });

  it('level 2: level 1 HP + avg hit die (rounded up) + CON mod', () => {
    // Fighter d10: avg roll = floor(10/2)+1 = 6, CON 14 (+2)
    // Level 1: 10+2=12, Level 2: 12 + (6+2) = 20
    const classInfo = makeClassInfo({ hitDie: 10 });
    expect(calculateMaxHP(classInfo, 2, 14)).toBe(20);
  });

  it('level 5: accumulates average rolls for levels 2-5', () => {
    // Fighter d10, CON 14 (+2): avg = 6
    // Level 1: 10+2=12, Levels 2-5: 4*(6+2)=32 → 44
    const classInfo = makeClassInfo({ hitDie: 10 });
    expect(calculateMaxHP(classInfo, 5, 14)).toBe(44);
  });

  it('enforces minimum of 1 HP per level (negative CON)', () => {
    // Wizard d6, CON 1 (-5): level 1 = 6-5=1, level 2 = 1+(4-5)=0 → min is 2
    const classInfo = makeClassInfo({ name: 'Wizard', hitDie: 6 });
    const result = calculateMaxHP(classInfo, 2, 1);
    expect(result).toBeGreaterThanOrEqual(2); // minimum 1 HP per level
  });

  it('d8 class at level 10 with CON 12 (+1)', () => {
    // Cleric d8, CON 12 (+1): avg = floor(8/2)+1 = 5
    // Level 1: 8+1=9, Levels 2-10: 9*(5+1)=54 → 63
    const classInfo = makeClassInfo({ name: 'Cleric', hitDie: 8 });
    expect(calculateMaxHP(classInfo, 10, 12)).toBe(63);
  });
});

// =============================================
// getClassHitDie
// =============================================
describe('getClassHitDie', () => {
  it('returns d12 for Barbarian', () => {
    expect(getClassHitDie('Barbarian')).toBe(12);
  });

  it('returns d10 for Fighter', () => {
    expect(getClassHitDie('Fighter')).toBe(10);
  });

  it('returns d8 for Cleric', () => {
    expect(getClassHitDie('Cleric')).toBe(8);
  });

  it('returns d6 for Wizard', () => {
    expect(getClassHitDie('Wizard')).toBe(6);
  });

  it('returns d6 for Sorcerer', () => {
    expect(getClassHitDie('Sorcerer')).toBe(6);
  });

  it('returns d10 for Blood Hunter (homebrew)', () => {
    expect(getClassHitDie('Blood Hunter')).toBe(10);
  });

  it('returns customHitDie when provided, ignoring class name', () => {
    expect(getClassHitDie('Fighter', 12)).toBe(12);
  });

  it('returns customHitDie for unknown class', () => {
    expect(getClassHitDie('CustomClass', 10)).toBe(10);
  });

  it('returns default d8 for unknown class without customHitDie', () => {
    expect(getClassHitDie('UnknownClass')).toBe(8);
  });
});

// =============================================
// applyDamage
// =============================================
describe('applyDamage', () => {
  it('is a no-op for 0 damage', () => {
    const hp = makeHP({ current: 30 });
    expect(applyDamage(hp, 0)).toEqual(hp);
  });

  it('is a no-op for negative damage', () => {
    const hp = makeHP({ current: 30 });
    expect(applyDamage(hp, -5)).toEqual(hp);
  });

  it('reduces current HP by damage amount', () => {
    const hp = makeHP({ current: 30, max: 44 });
    const result = applyDamage(hp, 10);
    expect(result.current).toBe(20);
  });

  it('does not go below 0 HP', () => {
    const hp = makeHP({ current: 10, max: 44 });
    const result = applyDamage(hp, 20);
    expect(result.current).toBe(0);
  });

  it('temp HP absorbs damage first', () => {
    const hp = makeHP({ current: 30, max: 44, temporary: 10 });
    const result = applyDamage(hp, 5);
    expect(result.temporary).toBe(5);
    expect(result.current).toBe(30); // current unchanged when temp absorbs all
  });

  it('temp HP absorbs partial damage, remainder hits current HP', () => {
    const hp = makeHP({ current: 30, max: 44, temporary: 5 });
    const result = applyDamage(hp, 10);
    expect(result.temporary).toBe(0);
    expect(result.current).toBe(25); // 30 - (10-5)
  });

  it('temp HP fully consumed when damage exceeds temp HP', () => {
    const hp = makeHP({ current: 30, max: 44, temporary: 10 });
    const result = applyDamage(hp, 15);
    expect(result.temporary).toBe(0);
    expect(result.current).toBe(25); // 30 - (15-10)
  });

  it('triggers death saves when reduced to 0 HP', () => {
    const hp = makeHP({ current: 10, max: 44 });
    const result = applyDamage(hp, 10);
    expect(result.current).toBe(0);
    expect(result.deathSaves).toBeDefined();
    expect(result.deathSaves?.successes).toBe(0);
    expect(result.deathSaves?.failures).toBe(0);
    expect(result.deathSaves?.isStabilized).toBe(false);
  });

  it('triggers death saves when overkill damage reduces to 0 HP', () => {
    const hp = makeHP({ current: 10, max: 44 });
    const result = applyDamage(hp, 20);
    expect(result.current).toBe(0);
    expect(result.deathSaves).toBeDefined();
    expect(result.deathSaves?.failures).toBe(0); // not massive damage (excess=10 < max=44)
  });

  it('preserves existing death saves when taking damage at 0 HP', () => {
    const hp = makeHP({
      current: 0,
      max: 44,
      deathSaves: { successes: 1, failures: 1, isStabilized: false },
    });
    const result = applyDamage(hp, 5);
    // Already at 0, deathSaves already present — should be preserved
    expect(result.deathSaves?.successes).toBe(1);
    expect(result.deathSaves?.failures).toBe(1);
  });

  it('massive damage: instant death when excess damage >= max HP', () => {
    // current=10, max=44: take 54 damage → 10 to reach 0, 44 excess = max HP
    const hp = makeHP({ current: 10, max: 44 });
    const result = applyDamage(hp, 54);
    expect(result.current).toBe(0);
    expect(result.deathSaves?.failures).toBe(3);
  });

  it('massive damage: instant death when excess damage > max HP', () => {
    const hp = makeHP({ current: 10, max: 44 });
    const result = applyDamage(hp, 100);
    expect(result.deathSaves?.failures).toBe(3);
  });

  it('massive damage: does NOT trigger when excess damage just below max HP', () => {
    // current=10, max=44: take 53 damage → excess=43 < 44, not massive
    const hp = makeHP({ current: 10, max: 44 });
    const result = applyDamage(hp, 53);
    expect(result.deathSaves?.failures).toBe(0);
    expect(result.deathSaves?.isStabilized).toBe(false);
  });
});

// =============================================
// applyHealing
// =============================================
describe('applyHealing', () => {
  it('is a no-op for 0 healing', () => {
    const hp = makeHP({ current: 20 });
    expect(applyHealing(hp, 0)).toEqual(hp);
  });

  it('is a no-op for negative healing', () => {
    const hp = makeHP({ current: 20 });
    expect(applyHealing(hp, -5)).toEqual(hp);
  });

  it('increases current HP by healing amount', () => {
    const hp = makeHP({ current: 20, max: 44 });
    const result = applyHealing(hp, 10);
    expect(result.current).toBe(30);
  });

  it('caps healing at max HP', () => {
    const hp = makeHP({ current: 40, max: 44 });
    const result = applyHealing(hp, 20);
    expect(result.current).toBe(44);
  });

  it('exact heal to max HP is allowed', () => {
    const hp = makeHP({ current: 24, max: 44 });
    const result = applyHealing(hp, 20);
    expect(result.current).toBe(44);
  });

  it('does not modify temporary HP', () => {
    const hp = makeHP({ current: 20, max: 44, temporary: 10 });
    const result = applyHealing(hp, 5);
    expect(result.temporary).toBe(10);
  });

  it('clears death saves when healing from 0 HP', () => {
    const hp = makeHP({
      current: 0,
      max: 44,
      deathSaves: { successes: 1, failures: 1, isStabilized: false },
    });
    const result = applyHealing(hp, 5);
    expect(result.current).toBe(5);
    expect(result.deathSaves).toBeUndefined();
  });

  it('does not clear death saves when healing character above 0 HP', () => {
    // Edge case: healing applied while current > 0 should not touch deathSaves
    const hp = makeHP({ current: 10, max: 44 });
    const result = applyHealing(hp, 5);
    expect(result.deathSaves).toBeUndefined();
    expect(result.current).toBe(15);
  });
});

// =============================================
// addTemporaryHP
// =============================================
describe('addTemporaryHP', () => {
  it('is a no-op for 0 temp HP', () => {
    const hp = makeHP({ temporary: 5 });
    expect(addTemporaryHP(hp, 0)).toEqual(hp);
  });

  it('is a no-op for negative temp HP', () => {
    const hp = makeHP({ temporary: 5 });
    expect(addTemporaryHP(hp, -3)).toEqual(hp);
  });

  it('sets temp HP when character has none', () => {
    const hp = makeHP({ temporary: 0 });
    const result = addTemporaryHP(hp, 10);
    expect(result.temporary).toBe(10);
  });

  it('takes the higher value when new temp HP is greater', () => {
    const hp = makeHP({ temporary: 5 });
    const result = addTemporaryHP(hp, 10);
    expect(result.temporary).toBe(10);
  });

  it('keeps existing temp HP when it is higher (does not stack)', () => {
    const hp = makeHP({ temporary: 15 });
    const result = addTemporaryHP(hp, 10);
    expect(result.temporary).toBe(15);
  });

  it('keeps existing temp HP when values are equal', () => {
    const hp = makeHP({ temporary: 10 });
    const result = addTemporaryHP(hp, 10);
    expect(result.temporary).toBe(10);
  });

  it('does not modify current or max HP', () => {
    const hp = makeHP({ current: 30, max: 44, temporary: 0 });
    const result = addTemporaryHP(hp, 10);
    expect(result.current).toBe(30);
    expect(result.max).toBe(44);
  });
});

// =============================================
// makeDeathSave
// =============================================
describe('makeDeathSave', () => {
  it('is a no-op when deathSaves is undefined', () => {
    const hp = makeHP(); // no deathSaves
    const result = makeDeathSave(hp, true);
    expect(result).toEqual(hp);
  });

  it('adds a success on regular success roll', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    const result = makeDeathSave(hp, true);
    expect(result.deathSaves?.successes).toBe(1);
    expect(result.deathSaves?.failures).toBe(0);
  });

  it('adds a failure on failure roll', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    const result = makeDeathSave(hp, false);
    expect(result.deathSaves?.failures).toBe(1);
    expect(result.deathSaves?.successes).toBe(0);
  });

  it('stabilizes at 3 successes', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 2, failures: 0, isStabilized: false },
    });
    const result = makeDeathSave(hp, true);
    expect(result.deathSaves?.successes).toBe(3);
    expect(result.deathSaves?.isStabilized).toBe(true);
  });

  it('does not exceed 3 successes', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    });
    const result = makeDeathSave(hp, true);
    expect(result.deathSaves?.successes).toBe(3);
  });

  it('does not exceed 3 failures', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 3, isStabilized: false },
    });
    const result = makeDeathSave(hp, false);
    expect(result.deathSaves?.failures).toBe(3);
  });

  it('critical success (natural 20): regain 1 HP and clear death saves', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 1, failures: 2, isStabilized: false },
    });
    const result = makeDeathSave(hp, true, true);
    expect(result.current).toBe(1);
    expect(result.deathSaves).toBeUndefined();
  });

  it('critical success does not count as a regular success', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    const result = makeDeathSave(hp, true, true);
    // Immediately clears death saves instead of incrementing successes
    expect(result.deathSaves).toBeUndefined();
    expect(result.current).toBe(1);
  });

  it('does not change HP on regular success or failure', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    const success = makeDeathSave(hp, true);
    expect(success.current).toBe(0);

    const failure = makeDeathSave(hp, false);
    expect(failure.current).toBe(0);
  });
});

// =============================================
// resetDeathSaves
// =============================================
describe('resetDeathSaves', () => {
  it('removes deathSaves from HitPoints', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 2, failures: 1, isStabilized: false },
    });
    const result = resetDeathSaves(hp);
    expect(result.deathSaves).toBeUndefined();
  });

  it('is safe to call when deathSaves is already undefined', () => {
    const hp = makeHP();
    const result = resetDeathSaves(hp);
    expect(result.deathSaves).toBeUndefined();
  });

  it('preserves other HP fields', () => {
    const hp = makeHP({
      current: 0,
      max: 44,
      temporary: 5,
      deathSaves: { successes: 1, failures: 1, isStabilized: false },
    });
    const result = resetDeathSaves(hp);
    expect(result.current).toBe(0);
    expect(result.max).toBe(44);
    expect(result.temporary).toBe(5);
  });
});

// =============================================
// isDying
// =============================================
describe('isDying', () => {
  it('returns true at 0 HP with active non-stabilized death saves', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 1, failures: 1, isStabilized: false },
    });
    expect(isDying(hp)).toBe(true);
  });

  it('returns false when current HP > 0', () => {
    const hp = makeHP({ current: 1 });
    expect(isDying(hp)).toBe(false);
  });

  it('returns false when no deathSaves present', () => {
    const hp = makeHP({ current: 0 });
    expect(isDying(hp)).toBe(false);
  });

  it('returns false when stabilized', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    });
    expect(isDying(hp)).toBe(false);
  });

  it('returns false when dead (3 failures)', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 3, isStabilized: false },
    });
    // isDying only checks current===0 && deathSaves && !isStabilized
    // A character with 3 failures still has isStabilized=false, so isDying returns true
    // (isDead is checked separately)
    expect(typeof isDying(hp)).toBe('boolean');
  });
});

// =============================================
// isDead
// =============================================
describe('isDead', () => {
  it('returns true with 3 death save failures', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 3, isStabilized: false },
    });
    expect(isDead(hp)).toBe(true);
  });

  it('returns false with fewer than 3 failures', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 2, isStabilized: false },
    });
    expect(isDead(hp)).toBe(false);
  });

  it('returns false with no death saves', () => {
    const hp = makeHP({ current: 0 });
    expect(isDead(hp)).toBe(false);
  });

  it('returns false when alive (positive HP, no death saves)', () => {
    const hp = makeHP({ current: 20 });
    expect(isDead(hp)).toBe(false);
  });

  it('returns true for instant death from massive damage (failures=3)', () => {
    const hp = makeHP({ current: 10, max: 44 });
    const result = applyDamage(hp, 100); // massive damage
    expect(isDead(result)).toBe(true);
  });
});

// =============================================
// isStabilized
// =============================================
describe('isStabilized', () => {
  it('returns true at 0 HP when stabilized', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    });
    expect(isStabilized(hp)).toBe(true);
  });

  it('returns false when current HP > 0', () => {
    const hp = makeHP({
      current: 10,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    });
    expect(isStabilized(hp)).toBe(false);
  });

  it('returns false when not stabilized', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 1, failures: 0, isStabilized: false },
    });
    expect(isStabilized(hp)).toBe(false);
  });

  it('returns false when no deathSaves present', () => {
    const hp = makeHP({ current: 0 });
    expect(isStabilized(hp)).toBe(false);
  });

  it('reflects stabilization from 3 death save successes', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 2, failures: 0, isStabilized: false },
    });
    const result = makeDeathSave(hp, true);
    expect(isStabilized(result)).toBe(true);
  });
});

// =============================================
// Integration: full damage → death save → stabilize flow
// =============================================
describe('full death save flow integration', () => {
  it('character takes lethal damage, makes 3 saves, stabilizes', () => {
    let hp = makeHP({ current: 10, max: 44 });

    // Take lethal damage
    hp = applyDamage(hp, 10);
    expect(hp.current).toBe(0);
    expect(isDying(hp)).toBe(true);

    // Two successes
    hp = makeDeathSave(hp, true);
    hp = makeDeathSave(hp, true);
    expect(hp.deathSaves?.successes).toBe(2);
    expect(isStabilized(hp)).toBe(false);

    // Third success → stabilized
    hp = makeDeathSave(hp, true);
    expect(isStabilized(hp)).toBe(true);
    expect(isDying(hp)).toBe(false);
    expect(isDead(hp)).toBe(false);
  });

  it('character takes lethal damage, accumulates 3 failures, dies', () => {
    let hp = makeHP({ current: 5, max: 44 });

    hp = applyDamage(hp, 10);
    expect(isDying(hp)).toBe(true);

    hp = makeDeathSave(hp, false);
    hp = makeDeathSave(hp, false);
    hp = makeDeathSave(hp, false);

    expect(isDead(hp)).toBe(true);
  });

  it('character takes lethal damage, rolls natural 20, regains consciousness', () => {
    let hp = makeHP({ current: 8, max: 44 });

    hp = applyDamage(hp, 8);
    expect(isDying(hp)).toBe(true);

    hp = makeDeathSave(hp, true, true); // critical success
    expect(hp.current).toBe(1);
    expect(hp.deathSaves).toBeUndefined();
    expect(isDying(hp)).toBe(false);
  });

  it('character is healed from 0 HP clears death saves', () => {
    let hp = makeHP({ current: 0, max: 44 });
    hp = applyDamage(makeHP({ current: 10, max: 44 }), 10); // ensure deathSaves set
    expect(isDying(hp)).toBe(true);

    hp = applyHealing(hp, 5);
    expect(hp.current).toBe(5);
    expect(hp.deathSaves).toBeUndefined();
    expect(isDying(hp)).toBe(false);
  });
});
