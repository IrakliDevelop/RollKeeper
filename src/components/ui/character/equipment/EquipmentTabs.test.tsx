import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import { useCharacterStore } from '@/store/characterStore';
import { SheetModeProvider } from '@/components/ui/character/SheetMode';
import { WeaponsTab } from './WeaponsTab';
import { MagicItemsTab } from './MagicItemsTab';
import { ArmorTab } from './ArmorTab';

vi.mock('@/components/ui/layout/DragDropList', () => ({
  default: ({
    items,
    onReorder,
    renderItem,
  }: {
    items: Array<{ id: string }>;
    onReorder: (from: number, to: number) => void;
    renderItem: (
      item: { id: string },
      index: number,
      dragging: boolean
    ) => React.ReactNode;
  }) => (
    <div>
      {items.map((item, index) => (
        <div key={item.id}>{renderItem(item, index, false)}</div>
      ))}
      {items.length > 1 && (
        <button onClick={() => onReorder(0, 1)}>Drag first to second</button>
      )}
    </div>
  ),
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const weapon = {
  category: 'martial',
  weaponType: ['melee'],
  damage: [],
  enhancementBonus: 0,
  isEquipped: false,
  properties: [],
};
const magic = {
  category: 'ring',
  rarity: 'rare',
  properties: [],
  requiresAttunement: false,
  isAttuned: false,
};
const armor = {
  category: 'heavy',
  type: 'plate',
  baseAC: 18,
  enhancementBonus: 0,
  isEquipped: false,
};

describe('filtered equipment reorder boundaries', () => {
  it.each([
    ['weapons', WeaponsTab, 'reorderWeapons', weapon],
    ['magicItems', MagicItemsTab, 'reorderMagicItems', magic],
    ['armorItems', ArmorTab, 'reorderArmorItems', armor],
  ] as const)(
    '%s forwards stored IDs for drag and edit-mode moves',
    (field, Component, action, base) => {
      const reorder = vi.fn();
      useCharacterStore.setState({
        character: makeCharacter({
          [field]: [
            { ...base, id: 'visible-a', name: 'Magic Alpha' },
            { ...base, id: 'hidden', name: 'Plain Hidden' },
            { ...base, id: 'visible-b', name: 'Magic Beta' },
          ],
        }),
        [action]: reorder,
      });
      render(
        <SheetModeProvider value={{ editing: true, setEditing: vi.fn() }}>
          <Component />
        </SheetModeProvider>
      );
      fireEvent.change(screen.getByPlaceholderText('Search by name'), {
        target: { value: 'Magic' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Drag first to second' })
      );
      expect(reorder).toHaveBeenCalledWith('visible-a', 'visible-b');
      reorder.mockClear();
      const moveDown = screen.getAllByRole('button', { name: 'Move down' })[0];
      expect(moveDown).toHaveAccessibleDescription('Magic Alpha');
      fireEvent.click(moveDown);
      expect(reorder).toHaveBeenCalledWith('visible-a', 'visible-b');
      expect(
        screen.getAllByRole('button', { name: 'Move up' })[0]
      ).toBeDisabled();
    }
  );
});
