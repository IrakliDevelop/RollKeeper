import { ProcessedMagicItem } from '@/types/items';
import type { ChargePool } from '@/types/character';
import { parseAttachedSpells, buildChargePool } from './attachedSpellsParser';
import type { MagicItemChargeFormData } from '@/components/ui/game/equipment/MagicItemForm';

export interface ChargePoolFormData {
  maxCharges: number;
  usedCharges: number;
  rechargeType: ChargePool['rechargeType'];
  rechargeAmount?: string;
  abilities: Array<{
    id?: string;
    name: string;
    description?: string;
    cost: number;
    isSpell?: boolean;
    spellLevel?: number;
  }>;
}

export interface MagicItemAutoFillData {
  name: string;
  category: ProcessedMagicItem['category'];
  rarity: ProcessedMagicItem['rarity'];
  description: string;
  properties: string[];
  requiresAttunement: boolean;
  isAttuned: boolean;
  charges?: MagicItemChargeFormData[];
  chargePool?: ChargePoolFormData;
  bonusSpellAttack?: number;
  bonusSpellSaveDc?: number;
}

export function convertProcessedMagicItemToFormData(
  item: ProcessedMagicItem
): MagicItemAutoFillData {
  let chargePoolData: ChargePoolFormData | undefined;
  let individualCharges: MagicItemChargeFormData[] | undefined;

  if (item.attachedSpells) {
    const parsed = parseAttachedSpells(
      item.attachedSpells,
      item.charges,
      item.recharge
    );

    const pool = buildChargePool(
      parsed,
      item.charges,
      item.recharge,
      item.rechargeAmount
    );

    if (pool) {
      chargePoolData = {
        maxCharges: pool.maxCharges,
        usedCharges: 0,
        rechargeType: pool.rechargeType,
        rechargeAmount: pool.rechargeAmount,
        abilities: pool.abilities,
      };
    }

    if (parsed.individualCharges.length > 0) {
      individualCharges = parsed.individualCharges.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        maxCharges: c.maxCharges,
        usedCharges: 0,
        restType: c.restType,
      }));
    }

    // At-will/ritual abilities without a charge pool go as individual charges with unlimited uses
    if (!pool) {
      const freeAbilities = parsed.poolAbilities.filter(a => a.cost === 0);
      if (freeAbilities.length > 0) {
        const extras: MagicItemChargeFormData[] = freeAbilities.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          maxCharges: 0,
          usedCharges: 0,
          restType: 'long' as const,
        }));
        individualCharges = [...(individualCharges || []), ...extras];
      }
    }
  }

  const properties: string[] = [];
  if (item.attunementRequirement) {
    properties.push(`Requires attunement ${item.attunementRequirement}`);
  }
  if (item.bonusWeapon) {
    properties.push(`+${item.bonusWeapon} weapon bonus`);
  }

  return {
    name: item.name,
    category: item.category,
    rarity: item.rarity,
    description: item.description,
    properties,
    requiresAttunement: item.requiresAttunement,
    isAttuned: false,
    charges: individualCharges,
    chargePool: chargePoolData,
    bonusSpellAttack: item.bonusSpellAttack,
    bonusSpellSaveDc: item.bonusSpellSaveDc,
  };
}
