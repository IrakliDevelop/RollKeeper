import { describe, it, expect } from 'vitest';
import { convertProcessedItemToFormData } from '@/utils/itemConversion';
import type { ProcessedItem } from '@/types/items';

// =============================================
// Helpers
// =============================================

const makeProcessedItem = (
  overrides: Partial<ProcessedItem> = {}
): ProcessedItem => ({
  id: 'rope-phb',
  name: 'Rope, Hempen (50 feet)',
  source: 'PHB',
  category: 'misc',
  rarity: 'none',
  rawType: 'G',
  description: 'A 50-foot coil of hempen rope.',
  tags: ['rope', 'utility'],
  weight: 10,
  value: 100,
  ...overrides,
});

// =============================================
// convertProcessedItemToFormData
// =============================================
describe('convertProcessedItemToFormData', () => {
  it('maps name and category', () => {
    const item = makeProcessedItem();
    const result = convertProcessedItemToFormData(item);

    expect(result.name).toBe('Rope, Hempen (50 feet)');
    expect(result.category).toBe('misc');
  });

  it('sets default location to Backpack', () => {
    const result = convertProcessedItemToFormData(makeProcessedItem());
    expect(result.location).toBe('Backpack');
  });

  it('sets default quantity to 1', () => {
    const result = convertProcessedItemToFormData(makeProcessedItem());
    expect(result.quantity).toBe(1);
  });

  it('maps weight and value', () => {
    const result = convertProcessedItemToFormData(makeProcessedItem());
    expect(result.weight).toBe(10);
    expect(result.value).toBe(100);
  });

  it('maps description and tags', () => {
    const result = convertProcessedItemToFormData(makeProcessedItem());
    expect(result.description).toBe('A 50-foot coil of hempen rope.');
    expect(result.tags).toEqual(['rope', 'utility']);
  });

  it('maps valid rarity', () => {
    const item = makeProcessedItem({ rarity: 'uncommon' });
    const result = convertProcessedItemToFormData(item);
    expect(result.rarity).toBe('uncommon');
  });

  it('returns undefined rarity for invalid value', () => {
    const item = makeProcessedItem({ rarity: 'junk' });
    const result = convertProcessedItemToFormData(item);
    expect(result.rarity).toBeUndefined();
  });

  it('returns undefined rarity when rarity is "none"', () => {
    const item = makeProcessedItem({ rarity: 'none' });
    const result = convertProcessedItemToFormData(item);
    expect(result.rarity).toBeUndefined();
  });

  it('maps rawType A to armor magic category', () => {
    const item = makeProcessedItem({ rawType: 'A' });
    const result = convertProcessedItemToFormData(item);
    expect(result.type).toBe('armor');
  });

  it('maps rawType LA (light armor) to armor category', () => {
    const item = makeProcessedItem({ rawType: 'LA' });
    const result = convertProcessedItemToFormData(item);
    expect(result.type).toBe('armor');
  });

  it('maps rawType MA (medium armor) to armor category', () => {
    const item = makeProcessedItem({ rawType: 'MA' });
    const result = convertProcessedItemToFormData(item);
    expect(result.type).toBe('armor');
  });

  it('maps rawType HA (heavy armor) to armor category', () => {
    const item = makeProcessedItem({ rawType: 'HA' });
    const result = convertProcessedItemToFormData(item);
    expect(result.type).toBe('armor');
  });

  it('maps rawType S (shield) to shield category', () => {
    const item = makeProcessedItem({ rawType: 'S' });
    const result = convertProcessedItemToFormData(item);
    expect(result.type).toBe('shield');
  });

  it('returns undefined type for unknown rawType', () => {
    const item = makeProcessedItem({ rawType: 'G' });
    const result = convertProcessedItemToFormData(item);
    expect(result.type).toBeUndefined();
  });

  it('handles all valid rarities', () => {
    const validRarities = [
      'common',
      'uncommon',
      'rare',
      'very rare',
      'legendary',
      'artifact',
    ] as const;
    for (const rarity of validRarities) {
      const item = makeProcessedItem({ rarity });
      const result = convertProcessedItemToFormData(item);
      expect(result.rarity).toBe(rarity);
    }
  });

  it('handles missing weight gracefully', () => {
    const item = makeProcessedItem({ weight: undefined });
    const result = convertProcessedItemToFormData(item);
    expect(result.weight).toBeUndefined();
  });

  it('handles missing value gracefully', () => {
    const item = makeProcessedItem({ value: undefined });
    const result = convertProcessedItemToFormData(item);
    expect(result.value).toBeUndefined();
  });

  it('handles empty tags array', () => {
    const item = makeProcessedItem({ tags: [] });
    const result = convertProcessedItemToFormData(item);
    expect(result.tags).toEqual([]);
  });
});
