import { describe, it, expect } from 'vitest';
import {
  resolvePriceCopper,
  MAGIC_ITEM_RARITY_DEFAULT_COPPER,
} from '@/utils/itemPricing';
import type { NPCInventoryItem } from '@/types/encounter';
import type { MagicItem, MagicItemRarity } from '@/types/character';

const inventoryItem = (
  overrides: Partial<NPCInventoryItem> = {}
): NPCInventoryItem => ({
  id: 'item-1',
  name: 'Test Item',
  quantity: 1,
  ...overrides,
});

const magicItem = (overrides: Partial<MagicItem> = {}): MagicItem => ({
  id: 'magic-1',
  name: 'Test Magic Item',
  category: 'wondrous',
  rarity: 'rare',
  description: '',
  properties: [],
  requiresAttunement: false,
  isAttuned: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('MAGIC_ITEM_RARITY_DEFAULT_COPPER', () => {
  it('has exactly the six MagicItemRarity keys, all positive integers', () => {
    expect(Object.keys(MAGIC_ITEM_RARITY_DEFAULT_COPPER).sort()).toEqual(
      [
        'artifact',
        'common',
        'legendary',
        'rare',
        'uncommon',
        'very rare',
      ].sort()
    );
    for (const value of Object.values(MAGIC_ITEM_RARITY_DEFAULT_COPPER)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('pins the exact guideline values (in copper)', () => {
    expect(MAGIC_ITEM_RARITY_DEFAULT_COPPER).toEqual({
      common: 10_000,
      uncommon: 50_000,
      rare: 500_000,
      'very rare': 5_000_000,
      legendary: 50_000_000,
      artifact: 100_000_000,
    });
  });

  it('is strictly increasing by rarity tier', () => {
    const order: MagicItemRarity[] = [
      'common',
      'uncommon',
      'rare',
      'very rare',
      'legendary',
      'artifact',
    ];
    for (let i = 1; i < order.length; i++) {
      expect(MAGIC_ITEM_RARITY_DEFAULT_COPPER[order[i]]).toBeGreaterThan(
        MAGIC_ITEM_RARITY_DEFAULT_COPPER[order[i - 1]]
      );
    }
  });
});

describe('resolvePriceCopper', () => {
  it('prefers the explicit priceCopper override over value', () => {
    const item = inventoryItem({ priceCopper: 42, value: 999 });
    expect(resolvePriceCopper(item)).toBe(42);
  });

  it('prefers the explicit priceCopper override over a magic-item rarity default', () => {
    const item = inventoryItem({
      priceCopper: 42,
      magicItem: magicItem({ rarity: 'legendary' }),
    });
    expect(resolvePriceCopper(item)).toBe(42);
  });

  it('falls back to item.value when priceCopper is absent', () => {
    const item = inventoryItem({ value: 250 });
    expect(resolvePriceCopper(item)).toBe(250);
  });

  it('prefers item.value over a magic-item rarity default', () => {
    const item = inventoryItem({
      value: 250,
      magicItem: magicItem({ rarity: 'legendary' }),
    });
    expect(resolvePriceCopper(item)).toBe(250);
  });

  it('a priceCopper of exactly 0 resolves to 0, not a fall-through to value', () => {
    const item = inventoryItem({ priceCopper: 0, value: 500 });
    expect(resolvePriceCopper(item)).toBe(0);
  });

  it('a value of exactly 0 resolves to 0, not a fall-through to the rarity default', () => {
    const item = inventoryItem({
      value: 0,
      magicItem: magicItem({ rarity: 'legendary' }),
    });
    expect(resolvePriceCopper(item)).toBe(0);
  });

  it('falls back to the magic-item rarity default when magicItem is present and value/priceCopper are absent', () => {
    const item = inventoryItem({ magicItem: magicItem({ rarity: 'rare' }) });
    expect(resolvePriceCopper(item)).toBe(
      MAGIC_ITEM_RARITY_DEFAULT_COPPER.rare
    );
  });

  it.each(
    Object.entries(MAGIC_ITEM_RARITY_DEFAULT_COPPER) as [
      MagicItemRarity,
      number,
    ][]
  )(
    'resolves the %s default for a magic item of that rarity',
    (rarity, expected) => {
      const item = inventoryItem({ magicItem: magicItem({ rarity }) });
      expect(resolvePriceCopper(item)).toBe(expected);
    }
  );

  it('falls back to the rarity default for a mundane row carrying a recognised rarity string (no magicItem)', () => {
    const item = inventoryItem({ rarity: 'uncommon' });
    expect(resolvePriceCopper(item)).toBe(
      MAGIC_ITEM_RARITY_DEFAULT_COPPER.uncommon
    );
  });

  it('prefers magicItem.rarity over item.rarity when both are present and disagree', () => {
    const item = inventoryItem({
      rarity: 'common',
      magicItem: magicItem({ rarity: 'legendary' }),
    });
    expect(resolvePriceCopper(item)).toBe(
      MAGIC_ITEM_RARITY_DEFAULT_COPPER.legendary
    );
  });

  it('resolves the "none" rarity sentinel to null, not a crash or a default price', () => {
    const item = inventoryItem({ rarity: 'none' });
    expect(resolvePriceCopper(item)).toBeNull();
  });

  it('resolves an unrecognised rarity string to null', () => {
    const item = inventoryItem({ rarity: 'super-duper-rare' });
    expect(resolvePriceCopper(item)).toBeNull();
  });

  it('resolves a mundane row with no value, no priceCopper, and no rarity to null', () => {
    const item = inventoryItem();
    expect(resolvePriceCopper(item)).toBeNull();
  });

  it('resolves to null when magicItem is absent and rarity is unrecognised, even with other fields set', () => {
    const item = inventoryItem({ rarity: 'none', quantity: 5 });
    expect(resolvePriceCopper(item)).toBeNull();
  });
});
