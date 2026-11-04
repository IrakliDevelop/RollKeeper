import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type {
  ArmorItem,
  CharacterState,
  MagicItem,
  Weapon,
} from '@/types/character';
import { InventoryTab } from '../InventoryTab';

afterEach(cleanup);

const STAMP = '2026-01-01T00:00:00.000Z';

function weapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: 'w1',
    name: 'Quarterstaff',
    category: 'simple',
    weaponType: ['melee'],
    damage: [{ dice: '1d6', type: 'bludgeoning' }],
    enhancementBonus: 0,
    properties: [],
    isEquipped: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

function magicItem(overrides: Partial<MagicItem> = {}): MagicItem {
  return {
    id: 'm1',
    name: 'Cloak of Protection',
    category: 'wondrous',
    rarity: 'uncommon',
    description: '',
    properties: [],
    requiresAttunement: true,
    isAttuned: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  } as MagicItem;
}

function armor(overrides: Partial<ArmorItem> = {}): ArmorItem {
  return {
    id: 'a1',
    name: 'Chain Mail',
    category: 'heavy',
    type: 'chain-mail',
    baseAC: 16,
    stealthDisadvantage: true,
    enhancementBonus: 0,
    isEquipped: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  } as ArmorItem;
}

function character(overrides: Partial<CharacterState>): CharacterState {
  return makeCharacter({
    weapons: [],
    magicItems: [],
    armorItems: [],
    ...overrides,
  });
}

describe('InventoryTab', () => {
  it('lists weapons, magic items and armor under level 3 headings', () => {
    render(
      <InventoryTab
        char={character({
          weapons: [weapon()],
          magicItems: [magicItem()],
          armorItems: [armor()],
        })}
      />
    );
    for (const [name, item] of [
      ['Weapons', 'Quarterstaff'],
      ['Magic items', 'Cloak of Protection'],
      ['Armor', 'Chain Mail'],
    ]) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeVisible();
      const section = screen.getByRole('region', { name });
      const list = within(section).getByRole('list');
      const rows = within(list).getAllByRole('listitem');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent(item);
    }
  });

  it('tags equipped, attuned and rarity in neutral badges', () => {
    render(
      <InventoryTab
        char={character({
          weapons: [weapon({ isEquipped: true })],
          magicItems: [magicItem({ rarity: 'very rare', isAttuned: true })],
        })}
      />
    );
    for (const text of ['Equipped', 'Very rare', 'Attuned']) {
      expect(screen.getByText(text)).toHaveAttribute('data-variant', 'neutral');
    }
  });

  it('shows armor category and AC', () => {
    render(
      <InventoryTab
        char={character({
          armorItems: [
            armor({ category: 'heavy', baseAC: 16, enhancementBonus: 1 }),
          ],
        })}
      />
    );
    expect(screen.getByText('Heavy')).toBeVisible();
    expect(screen.getByText('AC 17')).toBeVisible();
  });

  it('says so when nothing is synced', () => {
    render(<InventoryTab char={character({})} />);
    expect(
      screen.getByText('No weapons, armor or magic items synced.')
    ).toBeVisible();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
