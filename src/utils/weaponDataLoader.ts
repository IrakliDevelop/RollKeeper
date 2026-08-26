import { promises as fs } from 'fs';
import path from 'path';
import { ProcessedWeapon } from '@/types/items';
import { stripTags, parseEntriesToHtml } from '@/utils/parseEntriesToHtml';

let cachedWeapons: ProcessedWeapon[] | null = null;

const PREFERRED_SOURCES = new Set(['XDMG', 'XPHB', 'DMG', 'PHB']);

const DAMAGE_TYPE_NAMES: Record<string, string> = {
  S: 'slashing',
  P: 'piercing',
  B: 'bludgeoning',
  A: 'acid',
  C: 'cold',
  F: 'fire',
  O: 'force',
  L: 'lightning',
  N: 'necrotic',
  I: 'poison',
  Y: 'psychic',
  R: 'radiant',
  T: 'thunder',
};

function generateId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}

function getBaseType(rawType: string): string {
  return rawType.split('|')[0];
}

function parseBonus(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const num = parseInt(value.replace('+', ''), 10);
    return isNaN(num) ? undefined : num;
  }
  if (typeof value === 'number') return value;
  return undefined;
}

interface RawWeaponItem {
  name: string;
  source: string;
  type?: string;
  rarity?: string;
  weight?: number;
  value?: number;
  reqAttune?: boolean | string;
  weaponCategory?: string;
  dmg1?: string;
  dmg2?: string;
  dmgType?: string;
  property?: string[];
  range?: string;
  bonusWeapon?: string;
  bonusWeaponAttack?: string;
  bonusSpellAttack?: string;
  bonusSpellSaveDc?: string;
  charges?: number;
  recharge?: string;
  rechargeAmount?: unknown;
  attachedSpells?: Record<string, unknown> | unknown[];
  entries?: unknown[];
  additionalEntries?: unknown[];
  [key: string]: unknown;
}

function processWeapon(raw: RawWeaponItem): ProcessedWeapon {
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
    ? { _flat: raw.attachedSpells }
    : (raw.attachedSpells as Record<string, unknown> | undefined);

  const dmgType = raw.dmgType
    ? DAMAGE_TYPE_NAMES[raw.dmgType] || raw.dmgType
    : undefined;

  return {
    id: generateId(raw.name, raw.source),
    name: raw.name,
    source: raw.source,
    type: raw.type ? getBaseType(raw.type) : 'M',
    weaponCategory: raw.weaponCategory || 'simple',
    rarity: raw.rarity || 'none',
    weight: raw.weight,
    value: raw.value,
    description,
    requiresAttunement,
    attunementRequirement,
    dmg1: raw.dmg1,
    dmgType,
    dmg2: raw.dmg2,
    property: raw.property,
    range: raw.range,
    bonusWeapon: parseBonus(raw.bonusWeapon || raw.bonusWeaponAttack),
    bonusSpellAttack: parseBonus(raw.bonusSpellAttack),
    bonusSpellSaveDc: parseBonus(raw.bonusSpellSaveDc),
    charges: raw.charges,
    recharge: raw.recharge,
    rechargeAmount:
      typeof raw.rechargeAmount === 'string'
        ? stripTags(raw.rechargeAmount)
        : typeof raw.rechargeAmount === 'number'
          ? String(raw.rechargeAmount)
          : undefined,
    attachedSpells,
  };
}

function addWeaponToResults(
  rawItem: RawWeaponItem,
  seen: Map<string, { source: string; index: number }>,
  results: ProcessedWeapon[]
) {
  const baseType = rawItem.type ? getBaseType(rawItem.type) : '';
  if (baseType !== 'M' && baseType !== 'R') return;
  if (!rawItem.weaponCategory || !rawItem.dmg1) return;

  const key = rawItem.name.toLowerCase();
  const existing = seen.get(key);

  if (existing) {
    const existingPreferred = PREFERRED_SOURCES.has(existing.source);
    const newPreferred = PREFERRED_SOURCES.has(rawItem.source);

    if (newPreferred && !existingPreferred) {
      results[existing.index] = processWeapon(rawItem);
      seen.set(key, { source: rawItem.source, index: existing.index });
    }
    return;
  }

  const index = results.length;
  results.push(processWeapon(rawItem));
  seen.set(key, { source: rawItem.source, index });
}

export async function loadAllWeapons(): Promise<ProcessedWeapon[]> {
  if (cachedWeapons) return cachedWeapons;

  try {
    const seen = new Map<string, { source: string; index: number }>();
    const results: ProcessedWeapon[] = [];

    // Load base/mundane weapons from items-base.json first
    const baseFilePath = path.join(process.cwd(), 'json', 'items-base.json');
    try {
      const baseRaw = await fs.readFile(baseFilePath, 'utf-8');
      const baseData = JSON.parse(baseRaw);
      if (baseData.baseitem && Array.isArray(baseData.baseitem)) {
        for (const rawItem of baseData.baseitem as RawWeaponItem[]) {
          if (!rawItem.weapon) continue;
          addWeaponToResults(rawItem, seen, results);
        }
      }
    } catch {
      console.warn('Could not load items-base.json for weapons');
    }

    // Load magic/special weapons from items.json (overrides base items)
    const filePath = path.join(process.cwd(), 'json', 'items.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (data.item && Array.isArray(data.item)) {
      for (const rawItem of data.item as RawWeaponItem[]) {
        addWeaponToResults(rawItem, seen, results);
      }
    }

    cachedWeapons = results.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`Loaded ${cachedWeapons.length} processed weapons`);
    return cachedWeapons;
  } catch (error) {
    console.error('Error loading weapons:', error);
    return [];
  }
}
