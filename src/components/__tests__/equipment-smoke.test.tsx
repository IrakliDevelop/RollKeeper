import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeaponCard } from '@/components/ui/game/equipment/WeaponCard';
import { MagicItemRow } from '@/components/ui/character/equipment/MagicItemRow';
import { ItemCard } from '@/components/ui/game/inventory/ItemCard';
import { ChargePoolDisplay } from '@/components/ui/character/equipment/ChargePoolDisplay';
import { MagicItemCard } from '@/components/ui/game/equipment/MagicItemCard';
import type {
  Weapon,
  MagicItem,
  InventoryItem,
  ChargePool,
} from '@/types/character';

const mockWeapon: Weapon = {
  id: 'w1',
  name: 'Longsword +1',
  category: 'martial',
  weaponType: ['melee'],
  damage: [{ dice: '1d8', type: 'slashing', label: 'Weapon Damage' }],
  enhancementBonus: 1,
  properties: ['versatile'],
  isEquipped: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMagicItem: MagicItem = {
  id: 'm1',
  name: 'Cloak of Protection',
  category: 'wondrous',
  rarity: 'uncommon',
  description: 'A fine garment that protects the wearer.',
  properties: [],
  requiresAttunement: true,
  isAttuned: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockInventoryItem: InventoryItem = {
  id: 'i1',
  name: 'Rope (50 ft)',
  category: 'misc',
  quantity: 1,
  weight: 10,
  value: 100,
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockChargePool: ChargePool = {
  maxCharges: 7,
  usedCharges: 2,
  rechargeType: 'dawn',
  rechargeAmount: '1d4+3',
  abilities: [
    { id: 'a1', name: 'Lightning Bolt', cost: 3, isSpell: true },
    { id: 'a2', name: 'Shield', cost: 1, isSpell: true },
  ],
};

describe('WeaponCard', () => {
  const defaultProps = {
    weapon: mockWeapon,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleEquip: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<WeaponCard {...defaultProps} />);
  });

  it('displays weapon name and damage', () => {
    render(<WeaponCard {...defaultProps} />);
    expect(screen.getAllByText('Longsword +1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1d8').length).toBeGreaterThan(0);
  });

  it('shows equipped status', () => {
    render(<WeaponCard {...defaultProps} />);
    expect(screen.getAllByText('Equipped').length).toBeGreaterThan(0);
  });
});

describe('MagicItemRow', () => {
  const defaultProps = {
    item: mockMagicItem,
    characterLevel: 5,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleAttunement: vi.fn(),
    onExpendCharge: vi.fn(),
    onRestoreCharge: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<MagicItemRow {...defaultProps} />);
  });

  it('displays item name and rarity', () => {
    render(<MagicItemRow {...defaultProps} />);
    expect(screen.getAllByText('Cloak of Protection').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('uncommon').length).toBeGreaterThan(0);
  });

  it('shows attunement status', () => {
    render(<MagicItemRow {...defaultProps} />);
    expect(screen.getAllByText('Attuned').length).toBeGreaterThan(0);
  });
});

describe('ItemCard', () => {
  it('renders without crashing', () => {
    render(<ItemCard item={mockInventoryItem} />);
  });

  it('displays item name and quantity', () => {
    render(<ItemCard item={mockInventoryItem} />);
    expect(screen.getAllByText('Rope (50 ft)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('shows weight and category', () => {
    render(<ItemCard item={mockInventoryItem} />);
    expect(screen.getAllByText('10 lbs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('misc').length).toBeGreaterThan(0);
  });
});

describe('ChargePoolDisplay', () => {
  const defaultProps = {
    pool: mockChargePool,
    onExpendAbility: vi.fn(),
    onRestorePool: vi.fn(),
    onSetPoolUsed: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<ChargePoolDisplay {...defaultProps} />);
  });

  it('displays charge count and abilities', () => {
    render(<ChargePoolDisplay {...defaultProps} />);
    expect(screen.getAllByText('5/7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shield').length).toBeGreaterThan(0);
  });

  it('shows recharge info', () => {
    render(<ChargePoolDisplay {...defaultProps} />);
    expect(screen.getAllByText(/1d4\+3/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dawn/).length).toBeGreaterThan(0);
  });

  it('renders compact mode', () => {
    render(<ChargePoolDisplay {...defaultProps} compact />);
    expect(screen.getAllByText('5/7').length).toBeGreaterThan(0);
  });
});

describe('MagicItemCard', () => {
  const defaultProps = {
    item: mockMagicItem,
    characterLevel: 5,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleAttunement: vi.fn(),
    onExpendCharge: vi.fn(),
    onRestoreCharge: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<MagicItemCard {...defaultProps} />);
  });

  it('displays item name and rarity', () => {
    render(<MagicItemCard {...defaultProps} />);
    expect(screen.getAllByText('Cloak of Protection').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('uncommon').length).toBeGreaterThan(0);
  });

  it('shows description', () => {
    render(<MagicItemCard {...defaultProps} />);
    expect(
      screen.getAllByText('A fine garment that protects the wearer.').length
    ).toBeGreaterThan(0);
  });

  it('shows attunement button', () => {
    render(<MagicItemCard {...defaultProps} />);
    expect(screen.getAllByText('Unattune').length).toBeGreaterThan(0);
  });
});
