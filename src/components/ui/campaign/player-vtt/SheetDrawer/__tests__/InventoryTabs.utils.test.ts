import { describe, it, expect } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import type {
  ArmorItem,
  CharacterState,
  InventoryItem,
  MagicItem,
  Weapon,
} from '@/types/character';

import {
  buildInventoryGroups,
  buildInventorySummary,
  rarityBadgeVariant,
} from '../InventoryTabs.utils';

function fixture(overrides: Partial<CharacterState> = {}): CharacterState {
  const base = useCharacterStore.getState().character;
  return {
    ...base,
    name: 'Kaelen Voss',
    race: 'Half-Elf',
    background: 'Outlander',
    level: 5,
    totalLevel: 5,
    classes: [{ className: 'Fighter', level: 5, isCustom: false, hitDie: 10 }],
    abilities: {
      strength: 14,
      dexterity: 16,
      constitution: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 8,
    },
    ...overrides,
  } as CharacterState;
}

function weapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: 'w1',
    name: 'Longsword',
    category: 'martial',
    weaponType: ['melee'],
    damage: [{ dice: '1d8', type: 'slashing' }],
    enhancementBonus: 0,
    properties: ['versatile'],
    isEquipped: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Weapon;
}

function armorItem(overrides: Partial<ArmorItem> = {}): ArmorItem {
  return {
    id: 'a1',
    name: 'Breastplate',
    category: 'medium',
    type: 'breastplate',
    baseAC: 14,
    stealthDisadvantage: false,
    enhancementBonus: 0,
    isEquipped: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as ArmorItem;
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
    isAttuned: false,
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
    quantity: 1,
    weight: 10,
    tags: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as InventoryItem;
}

describe('buildInventoryGroups', () => {
  it('assigns a weapon to the Weapons group with attack text', () => {
    const c = fixture({ weapons: [weapon()] });
    const groups = buildInventoryGroups(c, '');
    const weapons = groups.find(g => g.key === 'weapons')!;
    expect(weapons.label).toBe('Weapons');
    expect(weapons.entries).toHaveLength(1);
    const entry = weapons.entries[0];
    expect(entry.kind).toBe('weapon');
    expect(entry.quantity).toBeNull();
    expect(entry.attackText).toMatch(/to hit/);
    expect(entry.attackText).toMatch(/slashing/);
  });

  it('assigns armor to the Armor & worn group', () => {
    const c = fixture({ armorItems: [armorItem()] });
    const groups = buildInventoryGroups(c, '');
    const armor = groups.find(g => g.key === 'armor')!;
    expect(armor.entries).toHaveLength(1);
    expect(armor.entries[0].meta).toBe('medium · AC 14');
    expect(armor.entries[0].equippable).toBe(true);
  });

  it('assigns a non-potion/scroll magic item to the Magic items group', () => {
    const c = fixture({ magicItems: [magicItem()] });
    const groups = buildInventoryGroups(c, '');
    expect(groups.find(g => g.key === 'magic')!.entries).toHaveLength(1);
    expect(groups.find(g => g.key === 'consumables')).toBeUndefined();
  });

  it('routes a potion magic item to Consumables, not Magic items', () => {
    const c = fixture({
      magicItems: [
        magicItem({ id: 'p1', name: 'Potion of Healing', category: 'potion' }),
      ],
    });
    const groups = buildInventoryGroups(c, '');
    expect(groups.find(g => g.key === 'magic')).toBeUndefined();
    const consumables = groups.find(g => g.key === 'consumables')!;
    expect(consumables.entries).toHaveLength(1);
    // Potion/scroll magic items have no `quantity` and are not tracked by
    // adjustItemQuantity, so they must never report consumable: true — that
    // would let a Use control target a quantity that doesn't exist.
    expect(consumables.entries[0].consumable).toBe(false);
    expect(consumables.entries[0].kind).toBe('magic');
    expect(consumables.entries[0].equippable).toBe(false);
  });

  it('keeps non-consumable magic items equippable and marks scrolls not equippable', () => {
    const c = fixture({
      magicItems: [
        magicItem(),
        magicItem({ id: 's1', name: 'Scroll of Fireball', category: 'scroll' }),
      ],
    });
    const groups = buildInventoryGroups(c, '');
    expect(groups.find(g => g.key === 'magic')!.entries[0].equippable).toBe(
      true
    );
    expect(
      groups.find(g => g.key === 'consumables')!.entries[0].equippable
    ).toBe(false);
  });

  it('routes an inventory item with category consumable to Consumables', () => {
    const c = fixture({
      inventoryItems: [
        inventoryItem({
          id: 'c1',
          name: 'Alchemist Fire',
          category: 'consumable',
          quantity: 3,
        }),
      ],
    });
    const groups = buildInventoryGroups(c, '');
    const consumables = groups.find(g => g.key === 'consumables')!;
    expect(consumables.entries).toHaveLength(1);
    expect(consumables.entries[0].quantity).toBe(3);
    expect(consumables.entries[0].kind).toBe('item');
  });

  it('routes remaining inventory items to Gear with weight = qty * unit weight', () => {
    const c = fixture({
      inventoryItems: [inventoryItem({ quantity: 3, weight: 0.5 })],
    });
    const groups = buildInventoryGroups(c, '');
    const gear = groups.find(g => g.key === 'gear')!;
    expect(gear.entries).toHaveLength(1);
    expect(gear.entries[0].weightText).toBe('1.5 lb');
  });

  it('filters entries by case-insensitive name query and drops empty groups', () => {
    const c = fixture({
      weapons: [weapon({ name: 'Longsword' })],
      armorItems: [armorItem({ name: 'Breastplate' })],
    });
    const groups = buildInventoryGroups(c, 'long');
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('weapons');
    expect(groups[0].entries[0].name).toBe('Longsword');
  });

  it('sorts entries by name within a group', () => {
    const c = fixture({
      weapons: [
        weapon({ id: 'w2', name: 'Zweihander' }),
        weapon({ id: 'w1', name: 'Dagger' }),
      ],
    });
    const groups = buildInventoryGroups(c, '');
    const weapons = groups.find(g => g.key === 'weapons')!;
    expect(weapons.entries.map(e => e.name)).toEqual(['Dagger', 'Zweihander']);
  });

  it('drops empty groups entirely when the character has no inventory', () => {
    const c = fixture({
      weapons: [],
      armorItems: [],
      magicItems: [],
      inventoryItems: [],
    });
    expect(buildInventoryGroups(c, '')).toEqual([]);
  });
});

describe('buildInventorySummary', () => {
  it('orders currency pp, gp, ep, sp, cp with labels', () => {
    const c = fixture({
      currency: { platinum: 1, gold: 2, electrum: 3, silver: 4, copper: 5 },
    });
    const summary = buildInventorySummary(c);
    expect(summary.currency.map(row => row.key)).toEqual([
      'platinum',
      'gold',
      'electrum',
      'silver',
      'copper',
    ]);
    expect(summary.currency.map(row => row.label)).toEqual([
      'PP',
      'GP',
      'EP',
      'SP',
      'CP',
    ]);
    expect(summary.currency.map(row => row.value)).toEqual([1, 2, 3, 4, 5]);
  });

  it('computes weight percent capped at 100, 0 when capacity is 0', () => {
    const c = fixture({
      abilities: {
        strength: 0,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      inventoryItems: [inventoryItem({ weight: 5, quantity: 1 })],
    });
    const summary = buildInventorySummary(c);
    expect(summary.capacity).toBe(0);
    expect(summary.weightPercent).toBe(0);
  });

  it('caps weight percent at 100 when overloaded', () => {
    const c = fixture({
      abilities: {
        strength: 1,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      inventoryItems: [inventoryItem({ weight: 100, quantity: 1 })],
    });
    const summary = buildInventorySummary(c);
    expect(summary.capacity).toBe(15);
    expect(summary.weightPercent).toBe(100);
  });

  it('counts attuned items across weapons, armor and magic items', () => {
    const c = fixture({
      weapons: [weapon({ isAttuned: true, requiresAttunement: true })],
      armorItems: [armorItem({ isAttuned: true, requiresAttunement: true })],
      magicItems: [magicItem({ isAttuned: true })],
    });
    const summary = buildInventorySummary(c);
    expect(summary.attuned).toBe(3);
  });

  it('defaults attunementMax to 3 when unset, else uses attunementSlots.max', () => {
    const c = fixture({ attunementSlots: { used: 0, max: 5 } });
    expect(buildInventorySummary(c).attunementMax).toBe(5);
  });

  it('defaults attunementMax to 3 when attunementSlots is missing entirely', () => {
    const c = fixture({ attunementSlots: undefined });
    expect(buildInventorySummary(c).attunementMax).toBe(3);
  });
});

describe('rarityBadgeVariant', () => {
  it('maps every rarity to its badge variant', () => {
    expect(rarityBadgeVariant('common')).toBe('neutral');
    expect(rarityBadgeVariant('uncommon')).toBe('success');
    expect(rarityBadgeVariant('rare')).toBe('info');
    expect(rarityBadgeVariant('very rare')).toBe('warning');
    expect(rarityBadgeVariant('legendary')).toBe('warning');
    expect(rarityBadgeVariant('artifact')).toBe('danger');
  });
});
