import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function resetStore(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: { enableDeathAnimation: false, enableLevelUpAnimation: false },
    lastSelectedCharacterId: null,
  });
}

const sword = {
  name: 'Longsword',
  category: 'martial' as const,
  weaponType: ['melee'] as string[],
  damage: [{ dice: '1d8', type: 'slashing' as const, label: 'Slashing' }],
  enhancementBonus: 0,
  isEquipped: true,
  properties: [],
};

const dagger = {
  name: 'Dagger',
  category: 'simple' as const,
  weaponType: ['melee', 'thrown', 'finesse'] as string[],
  damage: [{ dice: '1d4', type: 'piercing' as const, label: 'Piercing' }],
  enhancementBonus: 0,
  isEquipped: false,
  properties: [],
};

const chainmail = {
  name: 'Chain Mail',
  category: 'heavy' as const,
  type: 'chain-mail' as const,
  baseAC: 16,
  stealthDisadvantage: true,
  strengthRequirement: 13,
  enhancementBonus: 0,
  isEquipped: false,
};

const leatherArmor = {
  name: 'Leather Armor',
  category: 'light' as const,
  type: 'leather' as const,
  baseAC: 11,
  stealthDisadvantage: false,
  enhancementBonus: 0,
  isEquipped: false,
};

const ringOfProtection = {
  name: 'Ring of Protection',
  category: 'ring' as const,
  rarity: 'uncommon' as const,
  description: '+1 AC and saving throws',
  properties: [],
  requiresAttunement: true,
  isAttuned: false,
};

const cloakOfElvenkind = {
  name: 'Cloak of Elvenkind',
  category: 'wondrous' as const,
  rarity: 'uncommon' as const,
  description: 'Advantage on Stealth checks',
  properties: [],
  requiresAttunement: true,
  isAttuned: false,
};

const healingPotion = {
  name: 'Potion of Healing',
  category: 'consumable',
  quantity: 3,
  tags: [],
};

const rope = {
  name: 'Rope, Hempen (50 feet)',
  category: 'misc',
  quantity: 1,
  tags: ['adventuring gear'],
};

// ─── Weapons ──────────────────────────────────────────────────────────────────

describe('characterStore — weapons', () => {
  beforeEach(() => resetStore());

  describe('addWeapon', () => {
    it('adds a weapon and generates an id', () => {
      useCharacterStore.getState().addWeapon(sword);
      const { weapons } = useCharacterStore.getState().character;
      expect(weapons).toHaveLength(1);
      expect(weapons[0].id).toBeDefined();
      expect(weapons[0].name).toBe('Longsword');
    });

    it('sets createdAt and updatedAt timestamps', () => {
      useCharacterStore.getState().addWeapon(sword);
      const weapon = useCharacterStore.getState().character.weapons[0];
      expect(weapon.createdAt).toBeDefined();
      expect(weapon.updatedAt).toBeDefined();
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addWeapon(sword);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('adds multiple weapons independently', () => {
      useCharacterStore.getState().addWeapon(sword);
      useCharacterStore.getState().addWeapon(dagger);
      const { weapons } = useCharacterStore.getState().character;
      expect(weapons).toHaveLength(2);
      expect(weapons[0].name).toBe('Longsword');
      expect(weapons[1].name).toBe('Dagger');
    });
  });

  describe('updateWeapon', () => {
    it('updates a weapon by id', () => {
      useCharacterStore.getState().addWeapon(sword);
      const id = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().updateWeapon(id, { name: 'Holy Longsword' });
      const weapon = useCharacterStore.getState().character.weapons[0];
      expect(weapon.name).toBe('Holy Longsword');
    });

    it('preserves other fields when updating', () => {
      useCharacterStore.getState().addWeapon(sword);
      const id = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().updateWeapon(id, { enhancementBonus: 2 });
      const weapon = useCharacterStore.getState().character.weapons[0];
      expect(weapon.category).toBe('martial');
      expect(weapon.enhancementBonus).toBe(2);
    });

    it('does not affect other weapons', () => {
      useCharacterStore.getState().addWeapon(sword);
      useCharacterStore.getState().addWeapon(dagger);
      const swordId = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore
        .getState()
        .updateWeapon(swordId, { name: 'Holy Longsword' });
      const { weapons } = useCharacterStore.getState().character;
      expect(weapons[1].name).toBe('Dagger');
    });
  });

  describe('deleteWeapon', () => {
    it('removes the weapon by id', () => {
      useCharacterStore.getState().addWeapon(sword);
      const id = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().deleteWeapon(id);
      expect(useCharacterStore.getState().character.weapons).toHaveLength(0);
    });

    it('only removes the targeted weapon', () => {
      useCharacterStore.getState().addWeapon(sword);
      useCharacterStore.getState().addWeapon(dagger);
      const swordId = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().deleteWeapon(swordId);
      const { weapons } = useCharacterStore.getState().character;
      expect(weapons).toHaveLength(1);
      expect(weapons[0].name).toBe('Dagger');
    });
  });

  describe('equipWeapon', () => {
    it('sets isEquipped to true', () => {
      useCharacterStore.getState().addWeapon(dagger); // dagger starts unequipped
      const id = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().equipWeapon(id, true);
      expect(useCharacterStore.getState().character.weapons[0].isEquipped).toBe(
        true
      );
    });

    it('sets isEquipped to false', () => {
      useCharacterStore.getState().addWeapon(sword); // sword starts equipped
      const id = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().equipWeapon(id, false);
      expect(useCharacterStore.getState().character.weapons[0].isEquipped).toBe(
        false
      );
    });
  });

  describe('reorderWeapons', () => {
    it('reorders weapons by moving from sourceIndex to destinationIndex', () => {
      useCharacterStore.getState().addWeapon(sword);
      useCharacterStore.getState().addWeapon(dagger);
      useCharacterStore.getState().reorderWeapons(0, 1);
      const { weapons } = useCharacterStore.getState().character;
      expect(weapons[0].name).toBe('Dagger');
      expect(weapons[1].name).toBe('Longsword');
    });

    it('reordering does not change the number of weapons', () => {
      useCharacterStore.getState().addWeapon(sword);
      useCharacterStore.getState().addWeapon(dagger);
      useCharacterStore.getState().reorderWeapons(1, 0);
      expect(useCharacterStore.getState().character.weapons).toHaveLength(2);
    });
  });

  describe('expendWeaponCharge', () => {
    it('increments usedCharges for the matching charge', () => {
      const weaponWithCharges = {
        ...sword,
        charges: [
          {
            id: 'charge-1',
            name: 'Divine Smite',
            maxCharges: 3,
            usedCharges: 0,
            restType: 'long' as const,
          },
        ],
      };
      useCharacterStore.getState().addWeapon(weaponWithCharges);
      const weaponId = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().expendWeaponCharge(weaponId, 'charge-1');
      const charge =
        useCharacterStore.getState().character.weapons[0].charges![0];
      expect(charge.usedCharges).toBe(1);
    });

    it('does not exceed maxCharges', () => {
      const weaponWithCharges = {
        ...sword,
        charges: [
          {
            id: 'charge-1',
            name: 'Divine Smite',
            maxCharges: 1,
            usedCharges: 1,
            restType: 'long' as const,
          },
        ],
      };
      useCharacterStore.getState().addWeapon(weaponWithCharges);
      const weaponId = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().expendWeaponCharge(weaponId, 'charge-1');
      const charge =
        useCharacterStore.getState().character.weapons[0].charges![0];
      expect(charge.usedCharges).toBe(1);
    });
  });

  describe('restoreWeaponCharge', () => {
    it('decrements usedCharges', () => {
      const weaponWithCharges = {
        ...sword,
        charges: [
          {
            id: 'charge-1',
            name: 'Divine Smite',
            maxCharges: 3,
            usedCharges: 2,
            restType: 'long' as const,
          },
        ],
      };
      useCharacterStore.getState().addWeapon(weaponWithCharges);
      const weaponId = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().restoreWeaponCharge(weaponId, 'charge-1');
      const charge =
        useCharacterStore.getState().character.weapons[0].charges![0];
      expect(charge.usedCharges).toBe(1);
    });

    it('does not go below 0', () => {
      const weaponWithCharges = {
        ...sword,
        charges: [
          {
            id: 'charge-1',
            name: 'Divine Smite',
            maxCharges: 3,
            usedCharges: 0,
            restType: 'long' as const,
          },
        ],
      };
      useCharacterStore.getState().addWeapon(weaponWithCharges);
      const weaponId = useCharacterStore.getState().character.weapons[0].id;
      useCharacterStore.getState().restoreWeaponCharge(weaponId, 'charge-1');
      const charge =
        useCharacterStore.getState().character.weapons[0].charges![0];
      expect(charge.usedCharges).toBe(0);
    });
  });
});

// ─── Armor ────────────────────────────────────────────────────────────────────

describe('characterStore — armor', () => {
  beforeEach(() => resetStore());

  describe('addArmorItem', () => {
    it('adds an armor item with generated id', () => {
      useCharacterStore.getState().addArmorItem(chainmail);
      const { armorItems } = useCharacterStore.getState().character;
      expect(armorItems).toHaveLength(1);
      expect(armorItems[0].id).toBeDefined();
      expect(armorItems[0].name).toBe('Chain Mail');
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addArmorItem(chainmail);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('adds multiple armor items independently', () => {
      useCharacterStore.getState().addArmorItem(chainmail);
      useCharacterStore.getState().addArmorItem(leatherArmor);
      expect(useCharacterStore.getState().character.armorItems).toHaveLength(2);
    });
  });

  describe('updateArmorItem', () => {
    it('updates an armor item by id', () => {
      useCharacterStore.getState().addArmorItem(chainmail);
      const id = useCharacterStore.getState().character.armorItems[0].id;
      useCharacterStore.getState().updateArmorItem(id, { enhancementBonus: 1 });
      expect(
        useCharacterStore.getState().character.armorItems[0].enhancementBonus
      ).toBe(1);
    });

    it('preserves other fields', () => {
      useCharacterStore.getState().addArmorItem(chainmail);
      const id = useCharacterStore.getState().character.armorItems[0].id;
      useCharacterStore.getState().updateArmorItem(id, { enhancementBonus: 2 });
      expect(useCharacterStore.getState().character.armorItems[0].baseAC).toBe(
        16
      );
    });
  });

  describe('deleteArmorItem', () => {
    it('removes armor by id', () => {
      useCharacterStore.getState().addArmorItem(chainmail);
      const id = useCharacterStore.getState().character.armorItems[0].id;
      useCharacterStore.getState().deleteArmorItem(id);
      expect(useCharacterStore.getState().character.armorItems).toHaveLength(0);
    });

    it('only removes the targeted armor item', () => {
      useCharacterStore.getState().addArmorItem(chainmail);
      useCharacterStore.getState().addArmorItem(leatherArmor);
      const chainmailId =
        useCharacterStore.getState().character.armorItems[0].id;
      useCharacterStore.getState().deleteArmorItem(chainmailId);
      const { armorItems } = useCharacterStore.getState().character;
      expect(armorItems).toHaveLength(1);
      expect(armorItems[0].name).toBe('Leather Armor');
    });
  });

  describe('equipArmorItem', () => {
    it('sets isEquipped to true', () => {
      useCharacterStore.getState().addArmorItem(chainmail);
      const id = useCharacterStore.getState().character.armorItems[0].id;
      useCharacterStore.getState().equipArmorItem(id, true);
      expect(
        useCharacterStore.getState().character.armorItems[0].isEquipped
      ).toBe(true);
    });

    it('sets isEquipped to false', () => {
      useCharacterStore
        .getState()
        .addArmorItem({ ...chainmail, isEquipped: true });
      const id = useCharacterStore.getState().character.armorItems[0].id;
      useCharacterStore.getState().equipArmorItem(id, false);
      expect(
        useCharacterStore.getState().character.armorItems[0].isEquipped
      ).toBe(false);
    });
  });
});

// ─── Magic Items ──────────────────────────────────────────────────────────────

describe('characterStore — magic items', () => {
  beforeEach(() => resetStore());

  describe('addMagicItem', () => {
    it('adds a magic item with generated id', () => {
      useCharacterStore.getState().addMagicItem(ringOfProtection);
      const { magicItems } = useCharacterStore.getState().character;
      expect(magicItems).toHaveLength(1);
      expect(magicItems[0].id).toBeDefined();
      expect(magicItems[0].name).toBe('Ring of Protection');
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addMagicItem(ringOfProtection);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('adds multiple magic items independently', () => {
      useCharacterStore.getState().addMagicItem(ringOfProtection);
      useCharacterStore.getState().addMagicItem(cloakOfElvenkind);
      expect(useCharacterStore.getState().character.magicItems).toHaveLength(2);
    });
  });

  describe('updateMagicItem', () => {
    it('updates a magic item by id', () => {
      useCharacterStore.getState().addMagicItem(ringOfProtection);
      const id = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore.getState().updateMagicItem(id, { rarity: 'rare' });
      expect(useCharacterStore.getState().character.magicItems[0].rarity).toBe(
        'rare'
      );
    });

    it('preserves other fields', () => {
      useCharacterStore.getState().addMagicItem(ringOfProtection);
      const id = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore.getState().updateMagicItem(id, { rarity: 'rare' });
      expect(
        useCharacterStore.getState().character.magicItems[0].category
      ).toBe('ring');
    });
  });

  describe('deleteMagicItem', () => {
    it('removes magic item by id', () => {
      useCharacterStore.getState().addMagicItem(ringOfProtection);
      const id = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore.getState().deleteMagicItem(id);
      expect(useCharacterStore.getState().character.magicItems).toHaveLength(0);
    });

    it('only removes the targeted magic item', () => {
      useCharacterStore.getState().addMagicItem(ringOfProtection);
      useCharacterStore.getState().addMagicItem(cloakOfElvenkind);
      const ringId = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore.getState().deleteMagicItem(ringId);
      const { magicItems } = useCharacterStore.getState().character;
      expect(magicItems).toHaveLength(1);
      expect(magicItems[0].name).toBe('Cloak of Elvenkind');
    });
  });

  describe('attuneMagicItem', () => {
    it('sets isAttuned to true', () => {
      useCharacterStore.getState().addMagicItem(ringOfProtection);
      const id = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore.getState().attuneMagicItem(id, true);
      expect(
        useCharacterStore.getState().character.magicItems[0].isAttuned
      ).toBe(true);
    });

    it('sets isAttuned to false', () => {
      useCharacterStore
        .getState()
        .addMagicItem({ ...ringOfProtection, isAttuned: true });
      const id = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore.getState().attuneMagicItem(id, false);
      expect(
        useCharacterStore.getState().character.magicItems[0].isAttuned
      ).toBe(false);
    });
  });

  describe('expendMagicItemCharge', () => {
    it('increments usedCharges for the matching charge', () => {
      const wand = {
        ...ringOfProtection,
        name: 'Wand of Fireballs',
        category: 'wand' as const,
        charges: [
          {
            id: 'fireball-charge',
            name: 'Cast Fireball',
            maxCharges: 7,
            usedCharges: 0,
            restType: 'dawn' as const,
          },
        ],
      };
      useCharacterStore.getState().addMagicItem(wand);
      const itemId = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore
        .getState()
        .expendMagicItemCharge(itemId, 'fireball-charge');
      const charge =
        useCharacterStore.getState().character.magicItems[0].charges![0];
      expect(charge.usedCharges).toBe(1);
    });

    it('does not exceed maxCharges', () => {
      const wand = {
        ...ringOfProtection,
        name: 'Wand of Fireballs',
        category: 'wand' as const,
        charges: [
          {
            id: 'fireball-charge',
            name: 'Cast Fireball',
            maxCharges: 1,
            usedCharges: 1,
            restType: 'dawn' as const,
          },
        ],
      };
      useCharacterStore.getState().addMagicItem(wand);
      const itemId = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore
        .getState()
        .expendMagicItemCharge(itemId, 'fireball-charge');
      const charge =
        useCharacterStore.getState().character.magicItems[0].charges![0];
      expect(charge.usedCharges).toBe(1);
    });
  });

  describe('restoreMagicItemCharge', () => {
    it('decrements usedCharges', () => {
      const wand = {
        ...ringOfProtection,
        name: 'Wand of Fireballs',
        category: 'wand' as const,
        charges: [
          {
            id: 'fireball-charge',
            name: 'Cast Fireball',
            maxCharges: 7,
            usedCharges: 3,
            restType: 'dawn' as const,
          },
        ],
      };
      useCharacterStore.getState().addMagicItem(wand);
      const itemId = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore
        .getState()
        .restoreMagicItemCharge(itemId, 'fireball-charge');
      const charge =
        useCharacterStore.getState().character.magicItems[0].charges![0];
      expect(charge.usedCharges).toBe(2);
    });

    it('does not go below 0', () => {
      const wand = {
        ...ringOfProtection,
        name: 'Wand of Fireballs',
        category: 'wand' as const,
        charges: [
          {
            id: 'fireball-charge',
            name: 'Cast Fireball',
            maxCharges: 7,
            usedCharges: 0,
            restType: 'dawn' as const,
          },
        ],
      };
      useCharacterStore.getState().addMagicItem(wand);
      const itemId = useCharacterStore.getState().character.magicItems[0].id;
      useCharacterStore
        .getState()
        .restoreMagicItemCharge(itemId, 'fireball-charge');
      const charge =
        useCharacterStore.getState().character.magicItems[0].charges![0];
      expect(charge.usedCharges).toBe(0);
    });
  });
});

// ─── Inventory Items ──────────────────────────────────────────────────────────

describe('characterStore — inventory items', () => {
  beforeEach(() => resetStore());

  describe('addInventoryItem', () => {
    it('adds an inventory item with generated id', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      const { inventoryItems } = useCharacterStore.getState().character;
      expect(inventoryItems).toHaveLength(1);
      expect(inventoryItems[0].id).toBeDefined();
      expect(inventoryItems[0].name).toBe('Potion of Healing');
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('adds multiple items independently', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      useCharacterStore.getState().addInventoryItem(rope);
      expect(
        useCharacterStore.getState().character.inventoryItems
      ).toHaveLength(2);
    });
  });

  describe('updateInventoryItem', () => {
    it('updates an inventory item by id', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      const id = useCharacterStore.getState().character.inventoryItems[0].id;
      useCharacterStore.getState().updateInventoryItem(id, { quantity: 5 });
      expect(
        useCharacterStore.getState().character.inventoryItems[0].quantity
      ).toBe(5);
    });

    it('preserves other fields', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      const id = useCharacterStore.getState().character.inventoryItems[0].id;
      useCharacterStore.getState().updateInventoryItem(id, { quantity: 5 });
      expect(
        useCharacterStore.getState().character.inventoryItems[0].category
      ).toBe('consumable');
    });

    it('does not affect other items', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      useCharacterStore.getState().addInventoryItem(rope);
      const potionId =
        useCharacterStore.getState().character.inventoryItems[0].id;
      useCharacterStore
        .getState()
        .updateInventoryItem(potionId, { quantity: 10 });
      expect(
        useCharacterStore.getState().character.inventoryItems[1].quantity
      ).toBe(1);
    });
  });

  describe('deleteInventoryItem', () => {
    it('removes inventory item by id', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      const id = useCharacterStore.getState().character.inventoryItems[0].id;
      useCharacterStore.getState().deleteInventoryItem(id);
      expect(
        useCharacterStore.getState().character.inventoryItems
      ).toHaveLength(0);
    });

    it('only removes the targeted item', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      useCharacterStore.getState().addInventoryItem(rope);
      const potionId =
        useCharacterStore.getState().character.inventoryItems[0].id;
      useCharacterStore.getState().deleteInventoryItem(potionId);
      const { inventoryItems } = useCharacterStore.getState().character;
      expect(inventoryItems).toHaveLength(1);
      expect(inventoryItems[0].name).toBe('Rope, Hempen (50 feet)');
    });
  });

  describe('updateItemQuantity', () => {
    it('sets the quantity directly', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      const id = useCharacterStore.getState().character.inventoryItems[0].id;
      useCharacterStore.getState().updateItemQuantity(id, 10);
      expect(
        useCharacterStore.getState().character.inventoryItems[0].quantity
      ).toBe(10);
    });

    it('sets quantity to 0', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      const id = useCharacterStore.getState().character.inventoryItems[0].id;
      useCharacterStore.getState().updateItemQuantity(id, 0);
      expect(
        useCharacterStore.getState().character.inventoryItems[0].quantity
      ).toBe(0);
    });

    it('does not affect other items', () => {
      useCharacterStore.getState().addInventoryItem(healingPotion);
      useCharacterStore.getState().addInventoryItem(rope);
      const potionId =
        useCharacterStore.getState().character.inventoryItems[0].id;
      useCharacterStore.getState().updateItemQuantity(potionId, 99);
      expect(
        useCharacterStore.getState().character.inventoryItems[1].quantity
      ).toBe(1);
    });
  });
});

// ─── Currency ─────────────────────────────────────────────────────────────────

describe('characterStore — currency', () => {
  beforeEach(() => resetStore());

  describe('updateCurrency', () => {
    it('sets gold directly', () => {
      useCharacterStore.getState().updateCurrency({ gold: 100 });
      expect(useCharacterStore.getState().character.currency.gold).toBe(100);
    });

    it('sets multiple denominations at once', () => {
      useCharacterStore
        .getState()
        .updateCurrency({ gold: 50, silver: 10, copper: 5 });
      const { currency } = useCharacterStore.getState().character;
      expect(currency.gold).toBe(50);
      expect(currency.silver).toBe(10);
      expect(currency.copper).toBe(5);
    });

    it('preserves unmodified denominations', () => {
      useCharacterStore.getState().updateCurrency({ platinum: 3 });
      const { currency } = useCharacterStore.getState().character;
      expect(currency.gold).toBe(0);
      expect(currency.platinum).toBe(3);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().updateCurrency({ gold: 1 });
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('addCurrency', () => {
    it('increases gold by the specified amount', () => {
      useCharacterStore.getState().addCurrency('gold', 10);
      expect(useCharacterStore.getState().character.currency.gold).toBe(10);
    });

    it('accumulates additions', () => {
      useCharacterStore.getState().addCurrency('gold', 10);
      useCharacterStore.getState().addCurrency('gold', 5);
      expect(useCharacterStore.getState().character.currency.gold).toBe(15);
    });

    it('adds to silver independently from gold', () => {
      useCharacterStore.getState().addCurrency('gold', 10);
      useCharacterStore.getState().addCurrency('silver', 20);
      const { currency } = useCharacterStore.getState().character;
      expect(currency.gold).toBe(10);
      expect(currency.silver).toBe(20);
    });

    it('adds platinum correctly', () => {
      useCharacterStore.getState().addCurrency('platinum', 2);
      expect(useCharacterStore.getState().character.currency.platinum).toBe(2);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addCurrency('gold', 1);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('subtractCurrency', () => {
    it('decreases gold by the specified amount', () => {
      useCharacterStore.getState().updateCurrency({ gold: 20 });
      useCharacterStore.getState().subtractCurrency('gold', 5);
      expect(useCharacterStore.getState().character.currency.gold).toBe(15);
    });

    it('does not go below 0', () => {
      useCharacterStore.getState().updateCurrency({ gold: 3 });
      useCharacterStore.getState().subtractCurrency('gold', 10);
      expect(useCharacterStore.getState().character.currency.gold).toBe(0);
    });

    it('clamps to 0 when already at 0', () => {
      useCharacterStore.getState().subtractCurrency('gold', 5);
      expect(useCharacterStore.getState().character.currency.gold).toBe(0);
    });

    it('subtracts from the correct denomination', () => {
      useCharacterStore.getState().updateCurrency({ gold: 10, silver: 50 });
      useCharacterStore.getState().subtractCurrency('silver', 20);
      const { currency } = useCharacterStore.getState().character;
      expect(currency.silver).toBe(30);
      expect(currency.gold).toBe(10);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().updateCurrency({ gold: 10 });
      useCharacterStore.setState({ hasUnsavedChanges: false });
      useCharacterStore.getState().subtractCurrency('gold', 1);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });
});
