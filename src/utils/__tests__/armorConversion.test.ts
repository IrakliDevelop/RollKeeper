import { describe, it, expect } from 'vitest';
import { convertProcessedArmorToFormData } from '@/utils/armorConversion';
import type { ProcessedArmor } from '@/types/items';

// =============================================
// Helpers
// =============================================

const makeProcessedArmor = (
  overrides: Partial<ProcessedArmor> = {}
): ProcessedArmor => ({
  id: 'chain-mail-phb',
  name: 'Chain Mail',
  source: 'PHB',
  type: 'HA',
  category: 'heavy',
  rarity: 'none',
  ac: 16,
  stealthDisadvantage: true,
  strengthRequirement: 13,
  requiresAttunement: false,
  description: 'Made of interlocking metal rings.',
  ...overrides,
});

// =============================================
// convertProcessedArmorToFormData
// =============================================
describe('convertProcessedArmorToFormData', () => {
  it('maps name, category, and basic fields', () => {
    const armor = makeProcessedArmor();
    const result = convertProcessedArmorToFormData(armor);

    expect(result.name).toBe('Chain Mail');
    expect(result.category).toBe('heavy');
    expect(result.stealthDisadvantage).toBe(true);
    expect(result.strengthRequirement).toBe(13);
    expect(result.isEquipped).toBe(false);
    expect(result.isAttuned).toBe(false);
  });

  it('sets isEquipped and isAttuned to false by default', () => {
    const result = convertProcessedArmorToFormData(makeProcessedArmor());
    expect(result.isEquipped).toBe(false);
    expect(result.isAttuned).toBe(false);
  });

  it('infers chain-mail type from name', () => {
    const result = convertProcessedArmorToFormData(makeProcessedArmor());
    expect(result.type).toBe('chain-mail');
    expect(result.baseAC).toBe(16);
  });

  it('infers leather armor type from name', () => {
    const armor = makeProcessedArmor({
      name: 'Leather Armor',
      category: 'light',
      ac: 11,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('leather');
    expect(result.baseAC).toBe(11);
  });

  it('infers studded leather via AC-based category lookup when name has no keyword', () => {
    const armor = makeProcessedArmor({
      name: 'Mystic Studded Scale',
      category: 'light',
      ac: 12,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('studded-leather');
    expect(result.baseAC).toBe(12);
  });

  it('infers studded leather from name (longest pattern matches first)', () => {
    const armor = makeProcessedArmor({
      name: 'Studded Leather Armor',
      category: 'light',
      ac: 12,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('studded-leather');
    expect(result.baseAC).toBe(12);
  });

  it('infers plate from name', () => {
    const armor = makeProcessedArmor({
      name: 'Plate Armor',
      category: 'heavy',
      ac: 18,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('plate');
    expect(result.baseAC).toBe(18);
  });

  it('infers shield from name', () => {
    const armor = makeProcessedArmor({
      name: 'Shield',
      category: 'shield',
      ac: 2,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('shield');
    expect(result.baseAC).toBe(2);
  });

  it('infers type from baseItem when available', () => {
    const armor = makeProcessedArmor({
      name: '+1 Breastplate',
      baseItem: 'breastplate',
      category: 'medium',
      ac: 14,
      bonusAc: 1,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('breastplate');
  });

  it('falls back to custom type when name is unrecognized', () => {
    const armor = makeProcessedArmor({
      name: 'Exotic Dragon Scale Armor',
      category: 'light',
      ac: 13,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('custom');
    // BASE_AC_MAP['custom'] is 10, so that is used as baseAC (not item.ac)
    expect(result.baseAC).toBe(10);
  });

  it('sets maxDexBonus for medium armor types', () => {
    const armor = makeProcessedArmor({
      name: 'Breastplate',
      category: 'medium',
      ac: 14,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.maxDexBonus).toBe(2);
  });

  it('sets maxDexBonus to undefined for heavy armor', () => {
    const result = convertProcessedArmorToFormData(makeProcessedArmor());
    expect(result.maxDexBonus).toBeUndefined();
  });

  it('sets maxDexBonus to undefined for light armor', () => {
    const armor = makeProcessedArmor({
      name: 'Leather',
      category: 'light',
      ac: 11,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.maxDexBonus).toBeUndefined();
  });

  it('applies enhancement bonus from bonusAc', () => {
    const armor = makeProcessedArmor({ bonusAc: 2 });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.enhancementBonus).toBe(2);
  });

  it('defaults enhancementBonus to 0 when bonusAc is absent', () => {
    const armor = makeProcessedArmor({ bonusAc: undefined });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.enhancementBonus).toBe(0);
  });

  it('passes through weight', () => {
    const armor = makeProcessedArmor({ weight: 55 });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.weight).toBe(55);
  });

  it('maps description', () => {
    const armor = makeProcessedArmor({
      description: 'Ancient dwarven craftsmanship.',
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.description).toBe('Ancient dwarven craftsmanship.');
  });

  it('defaults description to empty string when not provided', () => {
    const armor = makeProcessedArmor({ description: undefined });
    const result = convertProcessedArmorToFormData(armor as ProcessedArmor);
    expect(result.description).toBe('');
  });

  it('passes requiresAttunement flag', () => {
    const armor = makeProcessedArmor({ requiresAttunement: true });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.requiresAttunement).toBe(true);
  });

  it('handles half-plate correctly', () => {
    const armor = makeProcessedArmor({
      name: 'Half Plate',
      category: 'medium',
      ac: 15,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('half-plate');
    expect(result.maxDexBonus).toBe(2);
  });

  it('handles scale mail correctly', () => {
    const armor = makeProcessedArmor({
      name: 'Scale Mail',
      category: 'medium',
      ac: 14,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('scale-mail');
    expect(result.maxDexBonus).toBe(2);
  });

  it('handles padded armor (light, no max dex)', () => {
    const armor = makeProcessedArmor({
      name: 'Padded',
      category: 'light',
      ac: 11,
    });
    const result = convertProcessedArmorToFormData(armor);
    expect(result.type).toBe('padded');
    expect(result.maxDexBonus).toBeUndefined();
  });
});
