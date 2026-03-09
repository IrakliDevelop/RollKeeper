import { ProcessedArmor } from '@/types/items';
import type { ArmorCategory, ArmorType } from '@/types/character';

export interface ArmorAutoFillData {
  name: string;
  category: ArmorCategory;
  type: ArmorType;
  baseAC: number;
  maxDexBonus?: number;
  stealthDisadvantage: boolean;
  strengthRequirement?: number;
  enhancementBonus: number;
  isEquipped: boolean;
  requiresAttunement: boolean;
  isAttuned: boolean;
  description: string;
  weight?: number;
}

const CATEGORY_TYPE_MAP: Record<ArmorCategory, ArmorType[]> = {
  light: ['padded', 'leather', 'studded-leather'],
  medium: ['hide', 'chain-shirt', 'scale-mail', 'breastplate', 'half-plate'],
  heavy: ['ring-mail', 'chain-mail', 'splint', 'plate'],
  shield: ['shield'],
};

const BASE_AC_MAP: Record<ArmorType, number> = {
  padded: 11,
  leather: 11,
  'studded-leather': 12,
  hide: 12,
  'chain-shirt': 13,
  'scale-mail': 14,
  breastplate: 14,
  'half-plate': 15,
  'ring-mail': 14,
  'chain-mail': 16,
  splint: 17,
  plate: 18,
  shield: 2,
  custom: 10,
};

const MAX_DEX_MAP: Partial<Record<ArmorType, number>> = {
  hide: 2,
  'chain-shirt': 2,
  'scale-mail': 2,
  breastplate: 2,
  'half-plate': 2,
};

const NAME_TO_TYPE: Record<string, ArmorType> = {
  padded: 'padded',
  'padded armor': 'padded',
  leather: 'leather',
  'leather armor': 'leather',
  'studded leather': 'studded-leather',
  'studded leather armor': 'studded-leather',
  hide: 'hide',
  'hide armor': 'hide',
  'chain shirt': 'chain-shirt',
  'scale mail': 'scale-mail',
  'scale mail armor': 'scale-mail',
  breastplate: 'breastplate',
  'half plate': 'half-plate',
  'half plate armor': 'half-plate',
  'ring mail': 'ring-mail',
  'ring mail armor': 'ring-mail',
  'chain mail': 'chain-mail',
  splint: 'splint',
  'splint armor': 'splint',
  plate: 'plate',
  'plate armor': 'plate',
  shield: 'shield',
};

function inferArmorType(item: ProcessedArmor): ArmorType {
  if (item.baseItem) {
    for (const [pattern, armorType] of Object.entries(NAME_TO_TYPE)) {
      if (item.baseItem.includes(pattern)) {
        return armorType;
      }
    }
  }

  const nameLower = item.name.toLowerCase();
  for (const [pattern, armorType] of Object.entries(NAME_TO_TYPE)) {
    if (nameLower.includes(pattern)) {
      return armorType;
    }
  }

  const categoryTypes = CATEGORY_TYPE_MAP[item.category];
  if (categoryTypes) {
    for (const t of categoryTypes) {
      if (BASE_AC_MAP[t] === item.ac) {
        return t;
      }
    }
  }

  return 'custom';
}

export function convertProcessedArmorToFormData(
  item: ProcessedArmor
): ArmorAutoFillData {
  const armorType = inferArmorType(item);
  const baseAC = BASE_AC_MAP[armorType] ?? item.ac;
  const enhancementBonus = item.bonusAc || 0;

  return {
    name: item.name,
    category: item.category,
    type: armorType,
    baseAC,
    maxDexBonus: MAX_DEX_MAP[armorType],
    stealthDisadvantage: item.stealthDisadvantage,
    strengthRequirement: item.strengthRequirement,
    enhancementBonus,
    isEquipped: false,
    requiresAttunement: item.requiresAttunement,
    isAttuned: false,
    description: item.description || '',
    weight: item.weight,
  };
}
