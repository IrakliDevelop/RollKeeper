import {
  calculateCarryingCapacity,
  calculateMagicItemChargeMax,
  calculateWeaponChargeMax,
  getCharacterTotalLevel,
  getWeaponAttackString,
  getWeaponDamageString,
} from '@/utils/calculations';
import { calculateTotalWeight } from '@/utils/encumbrance';

import type {
  ArmorItem,
  CharacterState,
  ChargePool,
  Currency,
  InventoryItem,
  MagicItem,
  MagicItemRarity,
  Weapon,
} from '@/types/character';

import type {
  InventoryChargeView,
  InventoryEntryView,
  InventoryGroupKey,
  InventoryGroupView,
  InventorySummaryView,
} from './SheetDrawer.types';

const GROUP_LABELS: Record<InventoryGroupKey, string> = {
  weapons: 'Weapons',
  armor: 'Armor & worn',
  magic: 'Magic items',
  consumables: 'Consumables',
  gear: 'Gear',
};

const CURRENCY_ORDER: { key: keyof Currency; label: string }[] = [
  { key: 'platinum', label: 'PP' },
  { key: 'gold', label: 'GP' },
  { key: 'electrum', label: 'EP' },
  { key: 'silver', label: 'SP' },
  { key: 'copper', label: 'CP' },
];

const RARITY_VARIANTS: Record<
  MagicItemRarity,
  'neutral' | 'success' | 'info' | 'warning' | 'danger'
> = {
  common: 'neutral',
  uncommon: 'success',
  rare: 'info',
  'very rare': 'warning',
  legendary: 'warning',
  artifact: 'danger',
};

function formatWeight(weight: number): string {
  const rounded = Math.round(weight * 10) / 10;
  return `${rounded} lb`;
}

function metaFromCategory(category: string, properties?: string[]): string {
  if (properties && properties.length > 0) {
    return `${category} · ${properties.join(', ')}`;
  }
  return category;
}

function isConsumableMagicItem(item: MagicItem): boolean {
  return item.category === 'potion' || item.category === 'scroll';
}

function isConsumableInventoryItem(item: InventoryItem): boolean {
  return (
    item.category === 'consumable' ||
    item.type === 'potion' ||
    item.type === 'scroll'
  );
}

interface ChargeLike {
  id: string;
  name: string;
  usedCharges: number;
}

function buildCharges<T extends ChargeLike>(
  charges: T[] | undefined,
  level: number,
  maxFn: (charge: T, level: number) => number
): InventoryChargeView[] {
  return (charges ?? []).map(charge => ({
    chargeId: charge.id,
    name: charge.name,
    max: maxFn(charge, level),
    used: charge.usedCharges,
  }));
}

function poolTextFor(pool: ChargePool | undefined): string | null {
  if (!pool) return null;
  return `Charges ${pool.maxCharges - pool.usedCharges} / ${pool.maxCharges}`;
}

function weaponToEntry(
  c: CharacterState,
  w: Weapon,
  level: number
): InventoryEntryView {
  return {
    id: w.id,
    kind: 'weapon',
    name: w.name,
    meta: metaFromCategory(w.category, w.properties),
    rarity: null,
    quantity: null,
    weightText: w.weight != null ? formatWeight(w.weight) : null,
    equippable: true,
    equipped: !!w.isEquipped,
    attunable: !!w.requiresAttunement,
    attuned: !!w.isAttuned,
    consumable: false,
    attackText: `${getWeaponAttackString(c, w)} · ${getWeaponDamageString(c, w)}`,
    charges: buildCharges(w.charges, level, calculateWeaponChargeMax),
    poolText: poolTextFor(w.chargePool),
  };
}

function armorToEntry(a: ArmorItem): InventoryEntryView {
  const bonus = a.enhancementBonus ? ` +${a.enhancementBonus}` : '';
  return {
    id: a.id,
    kind: 'armor',
    name: a.name,
    meta: `${a.category} · AC ${a.baseAC}${bonus}`,
    rarity: null,
    quantity: null,
    weightText: a.weight != null ? formatWeight(a.weight) : null,
    equippable: true,
    equipped: !!a.isEquipped,
    attunable: !!a.requiresAttunement,
    attuned: !!a.isAttuned,
    consumable: false,
    attackText: null,
    charges: [],
    poolText: null,
  };
}

function magicItemToEntry(m: MagicItem, level: number): InventoryEntryView {
  // Potion/scroll magic items are grouped into Consumables (see kind: 'magic'
  // distinguishing them from InventoryItem-backed consumables), but they carry
  // no `quantity` and adjustItemQuantity only targets inventoryItems, so they
  // must never claim to be quantity-consumable — that would let a Use control
  // silently no-op.
  return {
    id: m.id,
    kind: 'magic',
    name: m.name,
    meta: metaFromCategory(m.category, m.properties),
    rarity: m.rarity,
    quantity: null,
    weightText: null,
    equippable: true,
    equipped: !!m.isEquipped,
    attunable: !!m.requiresAttunement,
    attuned: !!m.isAttuned,
    consumable: false,
    attackText: null,
    charges: buildCharges(m.charges, level, calculateMagicItemChargeMax),
    poolText: poolTextFor(m.chargePool),
  };
}

function inventoryItemToEntry(
  item: InventoryItem,
  consumable: boolean
): InventoryEntryView {
  const totalWeight = item.weight != null ? item.weight * item.quantity : null;
  return {
    id: item.id,
    kind: 'item',
    name: item.name,
    meta: metaFromCategory(item.category),
    rarity: item.rarity ?? null,
    quantity: item.quantity,
    weightText: totalWeight != null ? formatWeight(totalWeight) : null,
    equippable: false,
    equipped: false,
    attunable: false,
    attuned: false,
    consumable,
    attackText: null,
    charges: [],
    poolText: null,
  };
}

export function buildInventoryGroups(
  c: CharacterState,
  query: string
): InventoryGroupView[] {
  const q = query.trim().toLowerCase();
  const level = getCharacterTotalLevel(c);
  const matches = (name: string) => !q || name.toLowerCase().includes(q);

  const weaponsEntries = (c.weapons ?? [])
    .filter(w => matches(w.name))
    .map(w => weaponToEntry(c, w, level));

  const armorEntries = (c.armorItems ?? [])
    .filter(a => matches(a.name))
    .map(armorToEntry);

  const magicEntries = (c.magicItems ?? [])
    .filter(m => !isConsumableMagicItem(m))
    .filter(m => matches(m.name))
    .map(m => magicItemToEntry(m, level));

  const consumableMagicEntries = (c.magicItems ?? [])
    .filter(isConsumableMagicItem)
    .filter(m => matches(m.name))
    .map(m => magicItemToEntry(m, level));

  const consumableItemEntries = (c.inventoryItems ?? [])
    .filter(isConsumableInventoryItem)
    .filter(item => matches(item.name))
    .map(item => inventoryItemToEntry(item, true));

  const gearEntries = (c.inventoryItems ?? [])
    .filter(item => !isConsumableInventoryItem(item))
    .filter(item => matches(item.name))
    .map(item => inventoryItemToEntry(item, false));

  const groups: InventoryGroupView[] = [
    { key: 'weapons', label: GROUP_LABELS.weapons, entries: weaponsEntries },
    { key: 'armor', label: GROUP_LABELS.armor, entries: armorEntries },
    { key: 'magic', label: GROUP_LABELS.magic, entries: magicEntries },
    {
      key: 'consumables',
      label: GROUP_LABELS.consumables,
      entries: [...consumableMagicEntries, ...consumableItemEntries],
    },
    { key: 'gear', label: GROUP_LABELS.gear, entries: gearEntries },
  ];

  return groups
    .filter(g => g.entries.length > 0)
    .map(g => ({
      ...g,
      entries: [...g.entries].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function buildInventorySummary(c: CharacterState): InventorySummaryView {
  const currency = CURRENCY_ORDER.map(({ key, label }) => ({
    key,
    label,
    value: c.currency?.[key] ?? 0,
  }));

  const weight = calculateTotalWeight(c);
  const capacity = calculateCarryingCapacity(c);
  const weightPercent =
    capacity > 0 ? Math.min(100, Math.round((weight / capacity) * 100)) : 0;

  const attuned =
    (c.magicItems ?? []).filter(i => i.isAttuned).length +
    (c.weapons ?? []).filter(w => w.isAttuned).length +
    (c.armorItems ?? []).filter(a => a.isAttuned).length;

  return {
    currency,
    weight,
    capacity,
    weightPercent,
    attuned,
    attunementMax: c.attunementSlots?.max ?? 3,
  };
}

export function rarityBadgeVariant(
  rarity: MagicItemRarity
): 'neutral' | 'success' | 'info' | 'warning' | 'danger' {
  return RARITY_VARIANTS[rarity] ?? 'neutral';
}
