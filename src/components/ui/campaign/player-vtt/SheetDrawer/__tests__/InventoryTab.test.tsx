import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { useCharacterStore } from '@/store/characterStore';
import type {
  ArmorItem,
  CharacterState,
  InventoryItem,
  MagicItem,
  Weapon,
} from '@/types/character';

import { InventoryTab } from '../tabs/InventoryTab';
import { INVENTORY_VIEW_STORAGE_KEY } from '../SheetDrawer.types';

function weapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: 'w1',
    name: 'Longsword',
    category: 'martial',
    weaponType: ['melee'],
    damage: [{ dice: '1d8', type: 'slashing' }],
    enhancementBonus: 0,
    properties: ['versatile'],
    isEquipped: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Weapon;
}

function magicItem(overrides: Partial<MagicItem> = {}): MagicItem {
  return {
    id: 'm1',
    name: 'Ring of Protection',
    category: 'ring',
    rarity: 'rare',
    description: '',
    properties: [],
    requiresAttunement: true,
    isAttuned: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as MagicItem;
}

function inventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'i1',
    name: 'Rope, 50ft',
    category: 'gear',
    quantity: 2,
    tags: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as InventoryItem;
}

function seed(overrides: Partial<CharacterState> = {}) {
  const store = useCharacterStore.getState();
  const base = store.character;
  store.loadCharacterState({
    ...base,
    classes: [{ className: 'Fighter', level: 5, isCustom: false, hitDie: 10 }],
    level: 5,
    totalLevel: 5,
    weapons: [weapon()],
    armorItems: [] as ArmorItem[],
    magicItems: [magicItem()],
    inventoryItems: [
      inventoryItem(),
      inventoryItem({
        id: 'ration1',
        name: 'Ration',
        category: 'consumable',
        quantity: 3,
      }),
    ],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 10, platinum: 0 },
    attunementSlots: { max: 3, used: 1 },
    sheetFavorites: [],
    ...overrides,
  } as CharacterState);
}

const getChar = () => useCharacterStore.getState().character;

beforeEach(() => {
  seed();
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('InventoryTab', () => {
  it('renders inventory groups with entries', () => {
    render(<InventoryTab locked addToast={vi.fn()} />);
    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText('Ring of Protection')).toBeInTheDocument();
    expect(screen.getByText('Rope, 50ft')).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Weapons'),
        expect.stringContaining('Magic items'),
        expect.stringContaining('Gear'),
      ])
    );
  });

  it('adjusts an inventory item quantity with the +/- controls', () => {
    render(<InventoryTab locked addToast={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Increase Rope, 50ft' })
    );
    expect(getChar().inventoryItems.find(i => i.id === 'i1')!.quantity).toBe(3);

    fireEvent.click(
      screen.getByRole('button', { name: 'Decrease Rope, 50ft' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Decrease Rope, 50ft' })
    );
    expect(getChar().inventoryItems.find(i => i.id === 'i1')!.quantity).toBe(1);
  });

  it('uses a consumable item, decrementing quantity and toasting', () => {
    const addToast = vi.fn();
    render(<InventoryTab locked addToast={addToast} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use Ration' }));
    expect(
      getChar().inventoryItems.find(i => i.id === 'ration1')!.quantity
    ).toBe(2);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Used Ration', message: '2 left' })
    );
  });

  it('disables Use once a consumable is at 0', () => {
    seed({
      inventoryItems: [
        inventoryItem({
          id: 'ration1',
          name: 'Ration',
          category: 'consumable',
          quantity: 0,
        }),
      ],
    });
    render(<InventoryTab locked addToast={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Use Ration' })).toBeDisabled();
  });

  it('equips a weapon', () => {
    render(<InventoryTab locked addToast={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Equip Longsword' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    expect(getChar().weapons.find(w => w.id === 'w1')!.isEquipped).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Unequip Longsword' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables attune once attunement slots are full', () => {
    seed({
      attunementSlots: { max: 1, used: 1 },
      magicItems: [
        magicItem({ id: 'm1', name: 'Ring of Protection', isAttuned: true }),
        magicItem({ id: 'm2', name: 'Cloak of Elvenkind', isAttuned: false }),
      ],
    });
    render(<InventoryTab locked addToast={vi.fn()} />);
    const button = screen.getByRole('button', {
      name: 'Attune Cloak of Elvenkind',
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'All attunement slots are in use');
  });

  it('shows plain currency values when locked, and an editable field when unlocked', () => {
    const { rerender } = render(<InventoryTab locked addToast={vi.fn()} />);
    expect(screen.queryByLabelText('Gold pieces')).toBeNull();
    expect(screen.getByText('10')).toBeInTheDocument();

    rerender(<InventoryTab locked={false} addToast={vi.fn()} />);
    expect(screen.getByLabelText('Gold pieces')).toBeInTheDocument();
  });

  it('commits a currency change against live store state (10 -> 15 gold)', () => {
    render(<InventoryTab locked={false} addToast={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Gold pieces'), {
      target: { value: '15' },
    });
    expect(getChar().currency.gold).toBe(15);
  });

  it('commits a currency decrease against live store state (10 -> 4 gold)', () => {
    render(<InventoryTab locked={false} addToast={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Gold pieces'), {
      target: { value: '4' },
    });
    expect(getChar().currency.gold).toBe(4);
  });

  it('sends per-keystroke deltas against the last emitted value while the store is stale (0 -> 150 gold)', () => {
    seed({
      currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    });
    // Follower-tab simulation: the store does not update between keystrokes.
    const addSpy = vi
      .spyOn(useCharacterStore.getState(), 'addCurrency')
      .mockImplementation(() => {});
    const subtractSpy = vi
      .spyOn(useCharacterStore.getState(), 'subtractCurrency')
      .mockImplementation(() => {});
    render(<InventoryTab locked={false} addToast={vi.fn()} />);
    const input = screen.getByLabelText('Gold pieces');
    fireEvent.focus(input);
    for (const value of ['1', '15', '150']) {
      fireEvent.change(input, { target: { value } });
    }
    const summed = addSpy.mock.calls.reduce((sum, [, n]) => sum + n, 0);
    expect(addSpy.mock.calls.every(([key]) => key === 'gold')).toBe(true);
    expect(summed).toBe(150);
    expect(subtractSpy).not.toHaveBeenCalled();
  });

  it('filters entries by search', () => {
    render(<InventoryTab locked addToast={vi.fn()} />);
    fireEvent.change(
      screen.getByRole('searchbox', { name: /search inventory/i }),
      {
        target: { value: 'longsword' },
      }
    );
    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.queryByText('Rope, 50ft')).toBeNull();
  });

  it('shows a no-matches empty state on an unmatched search', () => {
    render(<InventoryTab locked addToast={vi.fn()} />);
    fireEvent.change(
      screen.getByRole('searchbox', { name: /search inventory/i }),
      {
        target: { value: 'nonexistent gizmo' },
      }
    );
    expect(
      screen.getByText(/no items match “nonexistent gizmo”/i)
    ).toBeInTheDocument();
  });

  it('shows no pin star on usable consumable grid tiles, even when pinned', () => {
    seed({ sheetFavorites: [{ kind: 'item', id: 'ration1' }] });
    render(<InventoryTab locked addToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
    const useTile = screen.getByRole('button', { name: 'Use Ration' });
    expect(useTile.querySelector('svg')).toBeNull();
    const pinTile = screen.getByRole('button', { name: 'Pin Rope, 50ft' });
    expect(pinTile.querySelector('svg')).not.toBeNull();
  });

  it('persists the view toggle to localStorage and grid Use works', () => {
    render(<InventoryTab locked addToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(window.localStorage.getItem(INVENTORY_VIEW_STORAGE_KEY)).toBe(
      'grid'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use Ration' }));
    expect(
      getChar().inventoryItems.find(i => i.id === 'ration1')!.quantity
    ).toBe(2);
  });
});
