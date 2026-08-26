import { describe, it, expect } from 'vitest';
import { convertProcessedWeaponToFormData } from '@/utils/weaponConversion';
import type { ProcessedWeapon } from '@/types/items';

// =============================================
// Helpers
// =============================================

const makeProcessedWeapon = (
  overrides: Partial<ProcessedWeapon> = {}
): ProcessedWeapon => ({
  id: 'longsword-phb',
  name: 'Longsword',
  source: 'PHB',
  type: 'M',
  weaponCategory: 'martial',
  rarity: 'none',
  description: 'A versatile martial weapon.',
  requiresAttunement: false,
  dmg1: '1d8',
  dmgType: 'slashing',
  dmg2: '1d10',
  property: ['V'],
  ...overrides,
});

// =============================================
// convertProcessedWeaponToFormData
// =============================================
describe('convertProcessedWeaponToFormData', () => {
  it('maps name, category, and basic fields', () => {
    const weapon = makeProcessedWeapon();
    const result = convertProcessedWeaponToFormData(weapon);

    expect(result.name).toBe('Longsword');
    expect(result.category).toBe('martial');
    expect(result.isEquipped).toBe(false);
    expect(result.isAttuned).toBe(false);
    expect(result.requiresAttunement).toBe(false);
  });

  it('sets isEquipped to false by default', () => {
    const result = convertProcessedWeaponToFormData(makeProcessedWeapon());
    expect(result.isEquipped).toBe(false);
  });

  it('maps damage dice and type', () => {
    const result = convertProcessedWeaponToFormData(makeProcessedWeapon());
    expect(result.damage).toHaveLength(1);
    expect(result.damage[0].dice).toBe('1d8');
    expect(result.damage[0].type).toBe('slashing');
  });

  it('includes versatile dice in damage entry', () => {
    const result = convertProcessedWeaponToFormData(makeProcessedWeapon());
    expect(result.damage[0].versatiledice).toBe('1d10');
  });

  it('falls back to 1d6 bludgeoning when no dmg1 provided', () => {
    const weapon = makeProcessedWeapon({ dmg1: undefined, dmgType: undefined });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.damage).toHaveLength(1);
    expect(result.damage[0].dice).toBe('1d6');
    expect(result.damage[0].type).toBe('bludgeoning');
  });

  it('maps melee type for type M', () => {
    const result = convertProcessedWeaponToFormData(
      makeProcessedWeapon({ type: 'M' })
    );
    expect(result.weaponType).toContain('melee');
  });

  it('maps ranged type for type R', () => {
    const result = convertProcessedWeaponToFormData(
      makeProcessedWeapon({ type: 'R' })
    );
    expect(result.weaponType).toContain('ranged');
  });

  it('includes finesse when property F is present', () => {
    const weapon = makeProcessedWeapon({ property: ['F', 'L'] });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.weaponType).toContain('finesse');
    expect(result.weaponType).toContain('light');
  });

  it('includes versatile when property V is present', () => {
    const result = convertProcessedWeaponToFormData(
      makeProcessedWeapon({ property: ['V'] })
    );
    expect(result.weaponType).toContain('versatile');
  });

  it('uses magic category when bonusWeapon > 0', () => {
    const weapon = makeProcessedWeapon({
      bonusWeapon: 2,
      weaponCategory: 'martial',
    });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.category).toBe('magic');
    expect(result.enhancementBonus).toBe(2);
  });

  it('sets enhancementBonus to 0 when bonusWeapon is absent', () => {
    const result = convertProcessedWeaponToFormData(
      makeProcessedWeapon({ bonusWeapon: undefined })
    );
    expect(result.enhancementBonus).toBe(0);
  });

  it('parses range string into normal and long parts', () => {
    const weapon = makeProcessedWeapon({ range: '80/320' });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.range).toEqual({ normal: 80, long: 320 });
  });

  it('parses range with only normal distance', () => {
    const weapon = makeProcessedWeapon({ range: '30' });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.range).toEqual({ normal: 30, long: undefined });
  });

  it('returns undefined range when not provided', () => {
    const weapon = makeProcessedWeapon({ range: undefined });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.range).toBeUndefined();
  });

  it('passes through weight and value', () => {
    const weapon = makeProcessedWeapon({ weight: 3, value: 1500 });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.weight).toBe(3);
    expect(result.value).toBe(1500);
  });

  it('passes through description', () => {
    const weapon = makeProcessedWeapon({ description: 'Ornate blade.' });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.description).toBe('Ornate blade.');
  });

  it('adds attunement requirement to properties array', () => {
    const weapon = makeProcessedWeapon({
      requiresAttunement: true,
      attunementRequirement: 'by a spellcaster',
    });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.properties).toContain('Requires attunement by a spellcaster');
  });

  it('has empty properties when no attunement requirement', () => {
    const result = convertProcessedWeaponToFormData(
      makeProcessedWeapon({ attunementRequirement: undefined })
    );
    expect(result.properties).toEqual([]);
  });

  it('maps bonusSpellAttack and bonusSpellSaveDc', () => {
    const weapon = makeProcessedWeapon({
      bonusSpellAttack: 1,
      bonusSpellSaveDc: 1,
    });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.bonusSpellAttack).toBe(1);
    expect(result.bonusSpellSaveDc).toBe(1);
  });

  it('maps simple category for simple weapons', () => {
    const weapon = makeProcessedWeapon({ weaponCategory: 'simple' });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.category).toBe('simple');
  });

  it('handles unknown dmgType by defaulting to bludgeoning', () => {
    const weapon = makeProcessedWeapon({ dmgType: 'unknown_type' });
    const result = convertProcessedWeaponToFormData(weapon);
    expect(result.damage[0].type).toBe('bludgeoning');
  });

  it('handles all known damage types', () => {
    const types = [
      'slashing',
      'piercing',
      'bludgeoning',
      'acid',
      'cold',
      'fire',
      'force',
      'lightning',
      'necrotic',
      'poison',
      'psychic',
      'radiant',
      'thunder',
    ];
    for (const dmgType of types) {
      const weapon = makeProcessedWeapon({ dmg1: '1d6', dmgType });
      const result = convertProcessedWeaponToFormData(weapon);
      expect(result.damage[0].type).toBe(dmgType);
    }
  });
});
