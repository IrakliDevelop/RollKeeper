import { describe, it, expect } from 'vitest';
import { convertProcessedMagicItemToFormData } from '@/utils/magicItemConversion';
import type { ProcessedMagicItem } from '@/types/items';

// =============================================
// Helpers
// =============================================

const makeProcessedMagicItem = (
  overrides: Partial<ProcessedMagicItem> = {}
): ProcessedMagicItem => ({
  id: 'cloak-of-protection-phb',
  name: 'Cloak of Protection',
  source: 'DMG',
  type: 'Wondrous Item',
  category: 'wondrous',
  rarity: 'uncommon',
  description:
    'You gain a +1 bonus to AC and saving throws while you wear this cloak.',
  requiresAttunement: true,
  isWeaponLike: false,
  ...overrides,
});

// =============================================
// convertProcessedMagicItemToFormData
// =============================================
describe('convertProcessedMagicItemToFormData', () => {
  it('maps name, category, and rarity', () => {
    const item = makeProcessedMagicItem();
    const result = convertProcessedMagicItemToFormData(item);

    expect(result.name).toBe('Cloak of Protection');
    expect(result.category).toBe('wondrous');
    expect(result.rarity).toBe('uncommon');
  });

  it('maps description', () => {
    const result = convertProcessedMagicItemToFormData(
      makeProcessedMagicItem()
    );
    expect(result.description).toContain('+1 bonus to AC');
  });

  it('sets isAttuned to false by default', () => {
    const result = convertProcessedMagicItemToFormData(
      makeProcessedMagicItem()
    );
    expect(result.isAttuned).toBe(false);
  });

  it('maps requiresAttunement', () => {
    const result = convertProcessedMagicItemToFormData(
      makeProcessedMagicItem()
    );
    expect(result.requiresAttunement).toBe(true);
  });

  it('adds attunement requirement text to properties', () => {
    const item = makeProcessedMagicItem({
      requiresAttunement: true,
      attunementRequirement: 'by a paladin',
    });
    const result = convertProcessedMagicItemToFormData(item);
    expect(result.properties).toContain('Requires attunement by a paladin');
  });

  it('adds weapon bonus to properties when bonusWeapon is set', () => {
    const item = makeProcessedMagicItem({ bonusWeapon: 2 });
    const result = convertProcessedMagicItemToFormData(item);
    expect(result.properties).toContain('+2 weapon bonus');
  });

  it('has empty properties when no attunement requirement or weapon bonus', () => {
    const item = makeProcessedMagicItem({
      attunementRequirement: undefined,
      bonusWeapon: undefined,
    });
    const result = convertProcessedMagicItemToFormData(item);
    expect(result.properties).toEqual([]);
  });

  it('returns undefined charges when no attachedSpells', () => {
    const result = convertProcessedMagicItemToFormData(
      makeProcessedMagicItem({ attachedSpells: undefined })
    );
    expect(result.charges).toBeUndefined();
    expect(result.chargePool).toBeUndefined();
  });

  it('passes bonusSpellAttack through', () => {
    const item = makeProcessedMagicItem({ bonusSpellAttack: 2 });
    const result = convertProcessedMagicItemToFormData(item);
    expect(result.bonusSpellAttack).toBe(2);
  });

  it('passes bonusSpellSaveDc through', () => {
    const item = makeProcessedMagicItem({ bonusSpellSaveDc: 2 });
    const result = convertProcessedMagicItemToFormData(item);
    expect(result.bonusSpellSaveDc).toBe(2);
  });

  it('handles item without requiresAttunement', () => {
    const item = makeProcessedMagicItem({ requiresAttunement: false });
    const result = convertProcessedMagicItemToFormData(item);
    expect(result.requiresAttunement).toBe(false);
  });

  it('handles all rarity tiers', () => {
    const rarities = [
      'common',
      'uncommon',
      'rare',
      'very rare',
      'legendary',
      'artifact',
    ] as const;
    for (const rarity of rarities) {
      const item = makeProcessedMagicItem({ rarity });
      const result = convertProcessedMagicItemToFormData(item);
      expect(result.rarity).toBe(rarity);
    }
  });

  it('handles all magic item categories', () => {
    const categories = [
      'weapon',
      'armor',
      'shield',
      'wondrous',
      'ring',
      'rod',
      'staff',
      'wand',
      'potion',
      'scroll',
      'other',
    ] as const;
    for (const category of categories) {
      const item = makeProcessedMagicItem({ category });
      const result = convertProcessedMagicItemToFormData(item);
      expect(result.category).toBe(category);
    }
  });

  it('includes both attunement and weapon bonus in properties when both present', () => {
    const item = makeProcessedMagicItem({
      attunementRequirement: 'by a fighter',
      bonusWeapon: 1,
    });
    const result = convertProcessedMagicItemToFormData(item);
    expect(result.properties).toHaveLength(2);
    expect(result.properties).toContain('Requires attunement by a fighter');
    expect(result.properties).toContain('+1 weapon bonus');
  });

  it('maps empty attachedSpells without crashing', () => {
    const item = makeProcessedMagicItem({ attachedSpells: {} });
    // Should not throw; just return no charges/pool
    expect(() => convertProcessedMagicItemToFormData(item)).not.toThrow();
  });
});
