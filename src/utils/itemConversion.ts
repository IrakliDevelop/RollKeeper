import { ProcessedItem } from '@/types/items';
import { MagicItemRarity, MagicItemCategory } from '@/types/character';
import type { InventoryFormData } from '@/components/ui/game/inventory/ItemForm';

const VALID_RARITIES: MagicItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
];

const RAW_TYPE_TO_MAGIC_CATEGORY: Record<string, MagicItemCategory> = {
  A: 'armor',
  LA: 'armor',
  MA: 'armor',
  HA: 'armor',
  S: 'shield',
};

function mapRarity(raw: string): MagicItemRarity | undefined {
  if (VALID_RARITIES.includes(raw as MagicItemRarity)) {
    return raw as MagicItemRarity;
  }
  return undefined;
}

function mapMagicItemCategory(rawType: string): MagicItemCategory | undefined {
  return RAW_TYPE_TO_MAGIC_CATEGORY[rawType] || undefined;
}

export function convertProcessedItemToFormData(
  item: ProcessedItem
): InventoryFormData {
  return {
    name: item.name,
    category: item.category,
    location: 'Backpack',
    rarity: mapRarity(item.rarity),
    type: mapMagicItemCategory(item.rawType),
    quantity: 1,
    weight: item.weight,
    value: item.value,
    description: item.description,
    tags: item.tags,
  };
}
