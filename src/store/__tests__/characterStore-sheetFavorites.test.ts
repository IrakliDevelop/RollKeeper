import { describe, it, expect } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { CharacterState, InventoryItem } from '@/types/character';

const store = () => useCharacterStore.getState();
const char = () => useCharacterStore.getState().character;

const seed = (overrides: Partial<CharacterState>) => {
  store().loadCharacterState({
    ...DEFAULT_CHARACTER_STATE,
    id: 'sheet-favorites-char',
    revision: 1,
    classes: [
      {
        className: 'Fighter',
        level: 1,
        hitDie: 10,
        isCustom: false,
        spellcaster: 'none',
      },
    ],
    ...overrides,
  } as unknown as CharacterState);
};

const item = (o: Partial<InventoryItem> & { id: string }): InventoryItem => ({
  name: 'Potion of Healing',
  category: 'consumable',
  quantity: 1,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});

const qty = (id: string) =>
  char().inventoryItems.find(i => i.id === id)?.quantity;

describe('setSheetFavorite', () => {
  it('pins an item and appends it after legacy-derived favorites', () => {
    seed({ favoriteFeatureIds: ['f1'] });
    store().setSheetFavorite('item', 'i1', true);
    expect(char().sheetFavorites).toEqual([
      { kind: 'feature', id: 'f1' },
      { kind: 'item', id: 'i1' },
    ]);
  });

  it('unpins an item', () => {
    seed({ sheetFavorites: [{ kind: 'item', id: 'i1' }] });
    store().setSheetFavorite('item', 'i1', false);
    expect(char().sheetFavorites).toEqual([]);
  });

  it('mirrors spell and feature pins to the legacy flags', () => {
    seed({});
    store().setSheetFavorite('spell', 's1', true);
    store().setSheetFavorite('feature', 'f1', true);
    expect(char().spellbook.favoriteSpells).toContain('s1');
    expect(char().favoriteFeatureIds).toContain('f1');
    store().setSheetFavorite('spell', 's1', false);
    expect(char().spellbook.favoriteSpells).not.toContain('s1');
    store().setSheetFavorite('feature', 'f1', false);
    expect(char().favoriteFeatureIds).not.toContain('f1');
    expect(char().sheetFavorites).toEqual([]);
  });

  it('is a no-op (no revision bump) when already in the requested state', () => {
    seed({ sheetFavorites: [{ kind: 'item', id: 'i1' }] });
    const rev = char().revision;
    store().setSheetFavorite('item', 'i1', true);
    store().setSheetFavorite('item', 'i2', false);
    expect(char().revision).toBe(rev);
  });
});

describe('adjustItemQuantity', () => {
  it('adds and subtracts, clamping at zero and keeping the item', () => {
    seed({ inventoryItems: [item({ id: 'p1', quantity: 2 })] });
    store().adjustItemQuantity('p1', 1);
    expect(qty('p1')).toBe(3);
    store().adjustItemQuantity('p1', -5);
    expect(qty('p1')).toBe(0);
    expect(char().inventoryItems).toHaveLength(1);
  });

  it('two deltas accumulate', () => {
    seed({ inventoryItems: [item({ id: 'p1', quantity: 2 })] });
    store().adjustItemQuantity('p1', -1);
    store().adjustItemQuantity('p1', -1);
    expect(qty('p1')).toBe(0);
  });

  it('is a no-op for unknown ids, zero/non-finite delta and at-floor decrements', () => {
    seed({ inventoryItems: [item({ id: 'p1', quantity: 0 })] });
    const rev = char().revision;
    store().adjustItemQuantity('nope', 1);
    store().adjustItemQuantity('p1', 0);
    store().adjustItemQuantity('p1', Number.NaN);
    store().adjustItemQuantity('p1', 0.5);
    store().adjustItemQuantity('p1', -1);
    expect(char().revision).toBe(rev);
    expect(qty('p1')).toBe(0);
  });
});
