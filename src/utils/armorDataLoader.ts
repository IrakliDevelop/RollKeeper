import { promises as fs } from 'fs';
import path from 'path';
import { ProcessedArmor } from '@/types/items';
import type { ArmorCategory } from '@/types/character';
import { parseEntriesToHtml } from '@/utils/parseEntriesToHtml';

let cachedArmors: ProcessedArmor[] | null = null;

const PREFERRED_SOURCES = new Set(['XDMG', 'XPHB', 'DMG', 'PHB']);

const TYPE_TO_CATEGORY: Record<string, ArmorCategory> = {
  LA: 'light',
  MA: 'medium',
  HA: 'heavy',
  S: 'shield',
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

interface RawArmorItem {
  name: string;
  source: string;
  type?: string;
  rarity?: string;
  weight?: number;
  reqAttune?: boolean | string;
  ac?: number;
  bonusAc?: string | number;
  strength?: string;
  stealth?: boolean;
  baseItem?: string;
  entries?: unknown[];
  additionalEntries?: unknown[];
  [key: string]: unknown;
}

function processArmor(raw: RawArmorItem): ProcessedArmor {
  const baseType = raw.type ? getBaseType(raw.type) : 'LA';
  const category = TYPE_TO_CATEGORY[baseType] || 'light';

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

  return {
    id: generateId(raw.name, raw.source),
    name: raw.name,
    source: raw.source,
    type: baseType,
    category,
    rarity: raw.rarity || 'none',
    weight: raw.weight,
    description,
    requiresAttunement,
    attunementRequirement,
    ac: raw.ac || 0,
    bonusAc: parseBonus(raw.bonusAc),
    stealthDisadvantage: raw.stealth === true,
    strengthRequirement: raw.strength ? parseInt(raw.strength, 10) : undefined,
    baseItem: raw.baseItem
      ? raw.baseItem.split('|')[0].toLowerCase()
      : undefined,
  };
}

export async function loadAllArmors(): Promise<ProcessedArmor[]> {
  if (cachedArmors) return cachedArmors;

  try {
    const filePath = path.join(process.cwd(), 'json', 'items.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (!data.item || !Array.isArray(data.item)) {
      console.error('Invalid items.json structure');
      return [];
    }

    const seen = new Map<string, { source: string; index: number }>();
    const results: ProcessedArmor[] = [];

    for (const rawItem of data.item as RawArmorItem[]) {
      const baseType = rawItem.type ? getBaseType(rawItem.type) : '';
      if (!TYPE_TO_CATEGORY[baseType]) continue;

      const key = rawItem.name.toLowerCase();
      const existing = seen.get(key);

      if (existing) {
        const existingPreferred = PREFERRED_SOURCES.has(existing.source);
        const newPreferred = PREFERRED_SOURCES.has(rawItem.source);

        if (newPreferred && !existingPreferred) {
          results[existing.index] = processArmor(rawItem);
          seen.set(key, { source: rawItem.source, index: existing.index });
        }
        continue;
      }

      const index = results.length;
      results.push(processArmor(rawItem));
      seen.set(key, { source: rawItem.source, index });
    }

    cachedArmors = results.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`Loaded ${cachedArmors.length} processed armors`);
    return cachedArmors;
  } catch (error) {
    console.error('Error loading armors:', error);
    return [];
  }
}
