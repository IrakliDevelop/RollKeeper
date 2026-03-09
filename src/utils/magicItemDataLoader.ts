import { promises as fs } from 'fs';
import path from 'path';
import { ProcessedMagicItem } from '@/types/items';
import type { MagicItemCategory, MagicItemRarity } from '@/types/character';
import { stripTags, parseEntriesToHtml } from '@/utils/parseEntriesToHtml';

let cachedItems: ProcessedMagicItem[] | null = null;

const TYPE_TO_CATEGORY: Record<string, MagicItemCategory> = {
  WD: 'wand',
  RG: 'ring',
  RD: 'rod',
  S: 'staff',
  P: 'potion',
  SC: 'scroll',
  M: 'other',
  R: 'other',
  LA: 'armor',
  MA: 'armor',
  HA: 'armor',
  A: 'armor',
  SCF: 'other',
  OTH: 'other',
  G: 'other',
  FD: 'other',
  INS: 'other',
  T: 'other',
  TAH: 'other',
  GS: 'other',
  MNT: 'other',
  EXP: 'other',
  TB: 'other',
  TG: 'other',
  $G: 'other',
  $A: 'other',
  $C: 'other',
  AIR: 'other',
};

const RARITY_MAP: Record<string, MagicItemRarity> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  'very rare': 'very rare',
  legendary: 'legendary',
  artifact: 'artifact',
};

const PREFERRED_SOURCES = new Set(['XDMG', 'XPHB', 'DMG', 'PHB']);

function generateId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}

function getBaseType(rawType: string): string {
  return rawType.split('|')[0];
}

function mapCategory(
  rawType: string | undefined,
  isStaff: boolean,
  isWondrous: boolean
): MagicItemCategory {
  if (isStaff) return 'staff';
  if (isWondrous) return 'wondrous';
  if (!rawType) return 'other';
  const base = getBaseType(rawType);
  return TYPE_TO_CATEGORY[base] || 'other';
}

function mapRarity(raw: string | undefined): MagicItemRarity {
  if (!raw) return 'common';
  return RARITY_MAP[raw.toLowerCase()] || 'common';
}

function parseBonus(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const num = parseInt(value.replace('+', ''), 10);
    return isNaN(num) ? undefined : num;
  }
  if (typeof value === 'number') return value;
  return undefined;
}

interface RawMagicItem {
  name: string;
  source: string;
  type?: string;
  rarity?: string;
  weight?: number;
  value?: number;
  reqAttune?: boolean | string;
  reqAttuneTags?: unknown[];
  charges?: number;
  recharge?: string;
  rechargeAmount?: string;
  bonusSpellAttack?: string;
  bonusSpellSaveDc?: string;
  bonusWeapon?: string;
  bonusWeaponAttack?: string;
  attachedSpells?: Record<string, unknown> | unknown[];
  entries?: unknown[];
  additionalEntries?: unknown[];
  staff?: boolean;
  wondrous?: boolean;
  weaponCategory?: string;
  dmg1?: string;
  dmg2?: string;
  dmgType?: string;
  property?: string[];
  reprintedAs?: string[];
  [key: string]: unknown;
}

function isWeaponLike(raw: RawMagicItem): boolean {
  return !!(raw.weaponCategory || raw.dmg1);
}

function shouldInclude(raw: RawMagicItem): boolean {
  const baseType = raw.type ? getBaseType(raw.type) : '';

  // Exclude vehicles, ships, siege weapons
  if (['SHP', 'VEH', 'SPC', 'AIR'].includes(baseType)) return false;

  // Exclude pure ammunition
  if (['$A'].includes(baseType)) return false;

  // Exclude generic variant items ($G) - these are template entries
  if (['$G'].includes(baseType)) return false;

  // Exclude armor types -- these are handled by armorDataLoader
  if (['LA', 'MA', 'HA', 'S'].includes(baseType)) return false;

  // Include staffs (weapon-like but belong in magic items)
  if (raw.staff) return true;

  // Exclude pure melee/ranged weapons (type M or R) that aren't wondrous/staff
  if ((baseType === 'M' || baseType === 'R') && !raw.wondrous && !raw.staff) {
    return false;
  }

  return true;
}

function processMagicItem(raw: RawMagicItem): ProcessedMagicItem {
  const description = [
    ...(raw.entries ? [parseEntriesToHtml(raw.entries)] : []),
    ...(raw.additionalEntries
      ? [parseEntriesToHtml(raw.additionalEntries)]
      : []),
  ]
    .filter(Boolean)
    .join('\n\n');

  const reqAttune = raw.reqAttune;
  const requiresAttunement =
    reqAttune === true || typeof reqAttune === 'string';
  const attunementRequirement =
    typeof reqAttune === 'string' ? reqAttune : undefined;

  const attachedSpells = Array.isArray(raw.attachedSpells)
    ? undefined
    : (raw.attachedSpells as Record<string, unknown> | undefined);

  const flatAttachedSpells = Array.isArray(raw.attachedSpells)
    ? (raw.attachedSpells as unknown[])
    : undefined;

  const spellsRecord: Record<string, unknown> | undefined =
    attachedSpells ||
    (flatAttachedSpells ? { _flat: flatAttachedSpells } : undefined);

  return {
    id: generateId(raw.name, raw.source),
    name: raw.name,
    source: raw.source,
    type: raw.type || '',
    category: mapCategory(raw.type, !!raw.staff, !!raw.wondrous),
    rarity: mapRarity(raw.rarity),
    weight: raw.weight,
    value: raw.value,
    description,
    requiresAttunement,
    attunementRequirement,
    charges: raw.charges,
    recharge: raw.recharge,
    rechargeAmount:
      typeof raw.rechargeAmount === 'string'
        ? stripTags(raw.rechargeAmount)
        : undefined,
    bonusSpellAttack: parseBonus(raw.bonusSpellAttack),
    bonusSpellSaveDc: parseBonus(raw.bonusSpellSaveDc),
    bonusWeapon: parseBonus(raw.bonusWeapon || raw.bonusWeaponAttack),
    attachedSpells: spellsRecord,
    isWeaponLike: isWeaponLike(raw),
    weaponData: isWeaponLike(raw)
      ? {
          dmg1: raw.dmg1,
          dmgType: raw.dmgType,
          dmg2: raw.dmg2,
          weaponCategory: raw.weaponCategory,
          property: raw.property,
        }
      : undefined,
  };
}

export async function loadAllMagicItems(): Promise<ProcessedMagicItem[]> {
  if (cachedItems) return cachedItems;

  try {
    const filePath = path.join(process.cwd(), 'json', 'items.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (!data.item || !Array.isArray(data.item)) {
      console.error('Invalid items.json structure');
      return [];
    }

    const seen = new Map<string, { source: string; index: number }>();
    const results: ProcessedMagicItem[] = [];

    for (const rawItem of data.item as RawMagicItem[]) {
      if (!shouldInclude(rawItem)) continue;

      const key = rawItem.name.toLowerCase();
      const existing = seen.get(key);

      if (existing) {
        const existingPreferred = PREFERRED_SOURCES.has(existing.source);
        const newPreferred = PREFERRED_SOURCES.has(rawItem.source);

        if (newPreferred && !existingPreferred) {
          results[existing.index] = processMagicItem(rawItem);
          seen.set(key, { source: rawItem.source, index: existing.index });
        }
        continue;
      }

      const index = results.length;
      results.push(processMagicItem(rawItem));
      seen.set(key, { source: rawItem.source, index });
    }

    cachedItems = results.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`Loaded ${cachedItems.length} processed magic items`);
    return cachedItems;
  } catch (error) {
    console.error('Error loading magic items:', error);
    return [];
  }
}
