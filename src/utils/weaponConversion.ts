import { ProcessedWeapon } from '@/types/items';
import type {
  WeaponCategory,
  WeaponType,
  WeaponDamage,
  DamageType,
  ChargePool,
} from '@/types/character';
import { parseAttachedSpells, buildChargePool } from './attachedSpellsParser';
import type { WeaponChargeFormData } from '@/components/ui/game/equipment/WeaponForm';
import type { ChargePoolFormData } from './magicItemConversion';

const DMG_TYPE_MAP: Record<string, DamageType> = {
  slashing: 'slashing',
  piercing: 'piercing',
  bludgeoning: 'bludgeoning',
  acid: 'acid',
  cold: 'cold',
  fire: 'fire',
  force: 'force',
  lightning: 'lightning',
  necrotic: 'necrotic',
  poison: 'poison',
  psychic: 'psychic',
  radiant: 'radiant',
  thunder: 'thunder',
};

const PROPERTY_TO_WEAPON_TYPE: Record<string, WeaponType> = {
  F: 'finesse',
  V: 'versatile',
  L: 'light',
  H: 'heavy',
  R: 'reach',
  T: 'thrown',
  A: 'ammunition',
  LD: 'loading',
  S: 'special',
  '2H': 'special',
};

export interface WeaponAutoFillData {
  name: string;
  category: WeaponCategory;
  weaponType: WeaponType[];
  damage: WeaponDamage[];
  enhancementBonus: number;
  attackBonus?: number;
  damageBonus?: number;
  properties: string[];
  description?: string;
  range?: { normal?: number; long?: number };
  isEquipped: boolean;
  requiresAttunement?: boolean;
  isAttuned?: boolean;
  charges?: WeaponChargeFormData[];
  chargePool?: ChargePoolFormData;
  bonusSpellAttack?: number;
  bonusSpellSaveDc?: number;
  weight?: number;
  value?: number;
}

function mapDamageType(raw: string | undefined): DamageType {
  if (!raw) return 'bludgeoning';
  return DMG_TYPE_MAP[raw.toLowerCase()] || 'bludgeoning';
}

function mapCategory(
  weaponCategory: string,
  bonusWeapon?: number
): WeaponCategory {
  if (bonusWeapon && bonusWeapon > 0) return 'magic';
  if (weaponCategory === 'martial') return 'martial';
  return 'simple';
}

function mapWeaponTypes(type: string, property?: string[]): WeaponType[] {
  const types: WeaponType[] = [];
  types.push(type === 'R' ? 'ranged' : 'melee');

  if (property) {
    for (const p of property) {
      const base = p.split('|')[0];
      const mapped = PROPERTY_TO_WEAPON_TYPE[base];
      if (mapped && !types.includes(mapped)) {
        types.push(mapped);
      }
    }
  }

  return types;
}

function parseRange(
  rangeStr?: string
): { normal?: number; long?: number } | undefined {
  if (!rangeStr) return undefined;
  const parts = rangeStr.split('/');
  const normal = parseInt(parts[0], 10);
  const long = parts[1] ? parseInt(parts[1], 10) : undefined;
  if (isNaN(normal)) return undefined;
  return { normal, long: long && !isNaN(long) ? long : undefined };
}

export function convertProcessedWeaponToFormData(
  item: ProcessedWeapon
): WeaponAutoFillData {
  const damage: WeaponDamage[] = [];
  if (item.dmg1) {
    damage.push({
      dice: item.dmg1,
      type: mapDamageType(item.dmgType),
      versatiledice: item.dmg2 || undefined,
      label: 'Weapon Damage',
    });
  }

  let chargePoolData: ChargePoolFormData | undefined;
  let individualCharges: WeaponChargeFormData[] | undefined;

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

    if (!pool) {
      const freeAbilities = parsed.poolAbilities.filter(a => a.cost === 0);
      if (freeAbilities.length > 0) {
        const extras: WeaponChargeFormData[] = freeAbilities.map(a => ({
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

  return {
    name: item.name,
    category: mapCategory(item.weaponCategory, item.bonusWeapon),
    weaponType: mapWeaponTypes(item.type, item.property),
    damage:
      damage.length > 0
        ? damage
        : [{ dice: '1d6', type: 'bludgeoning', label: 'Weapon Damage' }],
    enhancementBonus: item.bonusWeapon || 0,
    properties,
    description: item.description || undefined,
    range: parseRange(item.range),
    isEquipped: false,
    requiresAttunement: item.requiresAttunement,
    isAttuned: false,
    charges: individualCharges,
    chargePool: chargePoolData,
    bonusSpellAttack: item.bonusSpellAttack,
    bonusSpellSaveDc: item.bonusSpellSaveDc,
    weight: item.weight,
    value: item.value,
  };
}
