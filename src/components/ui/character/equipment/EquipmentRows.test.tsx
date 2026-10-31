import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ArmorItem, MagicItem, Weapon } from '@/types/character';
import { WeaponRow } from './WeaponRow';
import { MagicItemRow } from './MagicItemRow';
import { ArmorRow } from './ArmorRow';

afterEach(cleanup);

const longName =
  'A particularly long engraved inventory name that must wrap on a phone';

describe('equipment rows', () => {
  it('keeps the full weapon name and play actions outside the disclosure', () => {
    const onToggleEquip = vi.fn();
    const weapon = {
      id: 'weapon-a',
      name: longName,
      category: 'martial',
      damage: [{ dice: '1d8', type: 'slashing' }],
      enhancementBonus: 0,
      isEquipped: false,
      properties: [],
    } as unknown as Weapon;
    render(
      <WeaponRow
        weapon={weapon}
        characterLevel={5}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleEquip={onToggleEquip}
      />
    );
    const disclosure = screen.getByRole('button', {
      name: `Details: ${longName}`,
    });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(longName)).not.toHaveClass('truncate');
    fireEvent.click(screen.getByRole('button', { name: 'Equip' }));
    expect(onToggleEquip).toHaveBeenCalledWith('weapon-a', true);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(disclosure);
    expect(
      screen.getByRole('button', { name: `Edit ${longName}` })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: `Delete ${longName}` })
    ).toBeVisible();
  });

  it('keeps attunement available without expanding magic item details', () => {
    const onToggleAttunement = vi.fn();
    const item = {
      id: 'magic-a',
      name: longName,
      category: 'ring',
      rarity: 'very rare',
      isEquipped: true,
      requiresAttunement: true,
      isAttuned: true,
      properties: [],
    } as unknown as MagicItem;
    render(
      <MagicItemRow
        item={item}
        characterLevel={5}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleAttunement={onToggleAttunement}
        onExpendCharge={vi.fn()}
        onRestoreCharge={vi.fn()}
      />
    );
    expect(screen.getByText(longName)).not.toHaveClass('truncate');
    expect(screen.getByText('Very rare')).toBeVisible();
    expect(screen.getByText('Equipped')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'End attunement' }));
    expect(onToggleAttunement).toHaveBeenCalledWith(item, false);
    expect(
      screen.getByRole('button', { name: `Details: ${longName}` })
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps armor AC and equip action available in the summary', () => {
    const onToggleEquip = vi.fn();
    const armor = {
      id: 'armor-a',
      name: longName,
      category: 'heavy',
      type: 'plate',
      baseAC: 18,
      enhancementBonus: 0,
      isEquipped: true,
    } as unknown as ArmorItem;
    render(
      <ArmorRow
        armor={armor}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleEquip={onToggleEquip}
      />
    );
    expect(screen.getByText('AC 18')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Unequip' }));
    expect(onToggleEquip).toHaveBeenCalledWith('armor-a', false);
  });

  it('shows Attack only with a linked inventory cost and blocks it when stock is short', () => {
    const onUse = vi.fn();
    const weapon = {
      id: 'cost-weapon',
      name: 'Crossbow',
      category: 'martial',
      damage: [],
      enhancementBonus: 0,
      isEquipped: true,
      properties: [],
    } as unknown as Weapon;
    const props = {
      weapon,
      characterLevel: 5,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onToggleEquip: vi.fn(),
      onUse,
      inventoryItems: [{ id: 'bolts', name: 'Bolt', quantity: 1 }],
    };
    const { rerender } = render(<WeaponRow {...props} />);
    expect(screen.queryByRole('button', { name: /Attack/ })).toBeNull();
    rerender(
      <WeaponRow
        {...props}
        weapon={{
          ...weapon,
          inventoryCost: { inventoryItemId: 'bolts', quantity: 2 },
        }}
      />
    );
    expect(screen.getByRole('button', { name: /Attack/ })).toBeDisabled();
    rerender(
      <WeaponRow
        {...props}
        weapon={{
          ...weapon,
          inventoryCost: { inventoryItemId: 'bolts', quantity: 1 },
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Attack/ }));
    expect(onUse).toHaveBeenCalledWith('cost-weapon');
  });

  it('shows charge names without decorative Sparkles', () => {
    const charge = {
      id: 'charge-a',
      name: 'Moonbeam',
      maxCharges: 3,
      usedCharges: 1,
      restType: 'long',
    };
    const weapon = {
      id: 'weapon-c',
      name: 'Charged blade',
      category: 'martial',
      damage: [],
      enhancementBonus: 0,
      isEquipped: false,
      properties: [],
      charges: [charge],
    } as unknown as Weapon;
    const item = {
      id: 'magic-c',
      name: 'Charged ring',
      category: 'ring',
      rarity: 'rare',
      requiresAttunement: false,
      isAttuned: false,
      charges: [charge],
    } as unknown as MagicItem;
    const { container } = render(
      <>
        <WeaponRow
          weapon={weapon}
          characterLevel={5}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onToggleEquip={vi.fn()}
        />
        <MagicItemRow
          item={item}
          characterLevel={5}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onToggleAttunement={vi.fn()}
          onExpendCharge={vi.fn()}
          onRestoreCharge={vi.fn()}
        />
      </>
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Details: Charged blade' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Details: Charged ring' })
    );
    expect(screen.getAllByText('Moonbeam')).toHaveLength(2);
    expect(container.querySelector('.lucide-sparkles')).toBeNull();
  });
});
