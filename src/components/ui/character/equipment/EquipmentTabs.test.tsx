import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { MagicItem } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { SheetModeProvider } from '@/components/ui/character/SheetMode';
import { WeaponsTab } from './WeaponsTab';
import { MagicItemsTab } from './MagicItemsTab';
import { ArmorTab } from './ArmorTab';
import {
  cancelAllDialogs,
  ConfirmDialogHost,
} from '@/components/ui/feedback/confirm-dialog';

vi.mock('@/hooks/useMagicItemsData', () => ({
  useMagicItemsData: () => ({ items: [], loading: false }),
}));
vi.mock('@/hooks/useItemsData', () => ({
  useItemsData: () => ({ items: [], loading: false }),
}));

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
  cancelAllDialogs();
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
  category: 'ring' as const,
  rarity: 'rare' as const,
  description: '',
  properties: [],
  requiresAttunement: false,
  isAttuned: false,
  createdAt: '2026-10-31T00:00:00.000Z',
  updatedAt: '2026-10-31T00:00:00.000Z',
};
const armor = {
  category: 'heavy',
  type: 'plate',
  baseAC: 18,
  enhancementBonus: 0,
  isEquipped: false,
};

describe('equipment deletion', () => {
  it.each([
    ['weapons', WeaponsTab, 'deleteWeapon', weapon, 'Add weapon'],
    ['magicItems', MagicItemsTab, 'deleteMagicItem', magic, 'Add magic item'],
    ['armorItems', ArmorTab, 'deleteArmorItem', armor, 'Add armor'],
  ] as const)(
    '%s cancels safely and focuses Add after confirmed row removal',
    async (field, Component, deleteAction, base, addName) => {
      const deleted = vi.fn((id: string) => {
        useCharacterStore.setState(state => ({
          character: {
            ...state.character!,
            [field]: state.character![field].filter(item => item.id !== id),
          },
        }));
      });
      useCharacterStore.setState({
        character: makeCharacter({
          [field]: [{ ...base, id: 'delete-me', name: 'Old item' }],
        }),
        [deleteAction]: deleted,
      });
      render(
        <>
          <ConfirmDialogHost />
          <SheetModeProvider value={{ editing: false, setEditing: vi.fn() }}>
            <Component />
          </SheetModeProvider>
        </>
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Details: Old item' })
      );
      const deleteButton = screen.getByRole('button', {
        name: 'Delete Old item',
      });
      deleteButton.focus();
      fireEvent.click(deleteButton);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(deleted).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      );
      fireEvent.click(deleteButton);
      fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
      await waitFor(() => expect(deleted).toHaveBeenCalledWith('delete-me'));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: addName })).toHaveFocus()
      );
    }
  );
});

describe('magic item attunement cap', () => {
  it('keeps the row action blocked at the current slot limit', () => {
    const attuneMagicItem = vi.fn();
    useCharacterStore.setState({
      character: makeCharacter({
        attunementSlots: { max: 1, used: 1 },
        magicItems: [
          { ...magic, id: 'one', name: 'One', isAttuned: true },
          {
            ...magic,
            id: 'two',
            name: 'Two',
            requiresAttunement: true,
            isAttuned: false,
          },
        ] as MagicItem[],
      }),
      attuneMagicItem,
    });
    render(
      <>
        <ConfirmDialogHost />
        <SheetModeProvider value={{ editing: false, setEditing: vi.fn() }}>
          <MagicItemsTab />
        </SheetModeProvider>
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Attune' }));
    expect(attuneMagicItem).not.toHaveBeenCalled();
    expect(
      screen.getByRole('alertdialog', { name: 'No attunement slots left' })
    ).toBeVisible();
  });
});

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
      expect(
        screen.getAllByRole('button', { name: 'Move down' })[1]
      ).toBeDisabled();
      reorder.mockClear();
      fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[1]);
      expect(reorder).toHaveBeenCalledWith('visible-b', 'visible-a');
    }
  );
});
