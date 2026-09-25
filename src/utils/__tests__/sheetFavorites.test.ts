import { describe, it, expect } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { resolveSheetFavorites, isSheetFavorite } from '@/utils/sheetFavorites';
import type { CharacterState } from '@/types/character';

const base = () => useCharacterStore.getState().character;
const make = (o: Partial<CharacterState>): CharacterState =>
  ({ ...base(), ...o }) as CharacterState;

describe('resolveSheetFavorites', () => {
  it('derives from legacy flags when sheetFavorites is undefined', () => {
    const c = make({
      sheetFavorites: undefined,
      favoriteFeatureIds: ['f1'],
      spellbook: { ...base().spellbook, favoriteSpells: ['s1'] },
    });
    expect(resolveSheetFavorites(c)).toEqual([
      { kind: 'feature', id: 'f1' },
      { kind: 'spell', id: 's1' },
    ]);
  });

  it('keeps pinned order, keeps items, drops spells/features unpinned in legacy, appends new legacy pins', () => {
    const c = make({
      sheetFavorites: [
        { kind: 'item', id: 'i1' },
        { kind: 'spell', id: 's-gone' },
        { kind: 'feature', id: 'f1' },
      ],
      favoriteFeatureIds: ['f1', 'f2'],
      spellbook: { ...base().spellbook, favoriteSpells: [] },
    });
    expect(resolveSheetFavorites(c)).toEqual([
      { kind: 'item', id: 'i1' },
      { kind: 'feature', id: 'f1' },
      { kind: 'feature', id: 'f2' },
    ]);
  });

  it('dedupes repeated entries', () => {
    const c = make({
      sheetFavorites: [
        { kind: 'item', id: 'i1' },
        { kind: 'item', id: 'i1' },
      ],
      favoriteFeatureIds: ['f1', 'f1'],
      spellbook: { ...base().spellbook, favoriteSpells: [] },
    });
    expect(resolveSheetFavorites(c)).toEqual([
      { kind: 'item', id: 'i1' },
      { kind: 'feature', id: 'f1' },
    ]);
  });

  it('isSheetFavorite checks the resolved list', () => {
    const c = make({ sheetFavorites: [{ kind: 'item', id: 'i1' }] });
    expect(isSheetFavorite(c, 'item', 'i1')).toBe(true);
    expect(isSheetFavorite(c, 'item', 'i2')).toBe(false);
  });
});
