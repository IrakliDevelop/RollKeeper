import { promises as fs } from 'fs';
import path from 'path';
import { RawBaseItem, RawItemEntry, ProcessedItem } from '@/types/items';
import { formatSourceForDisplay } from './sourceUtils';

let cachedItems: ProcessedItem[] | null = null;

const TYPE_TO_CATEGORY: Record<string, string> = {
  M: 'weapon',
  R: 'weapon',
  LA: 'armor',
  MA: 'armor',
  HA: 'armor',
  A: 'armor',
  S: 'armor',
  AT: 'tool',
  INS: 'tool',
  SCF: 'misc',
  AF: 'misc',
};

const PROPERTY_NAMES: Record<string, string> = {
  V: 'Versatile',
  H: 'Heavy',
  '2H': 'Two-Handed',
  F: 'Finesse',
  L: 'Light',
  T: 'Thrown',
  A: 'Ammunition',
  R: 'Reach',
  LD: 'Loading',
  S: 'Special',
};

const DAMAGE_TYPE_NAMES: Record<string, string> = {
  S: 'Slashing',
  P: 'Piercing',
  B: 'Bludgeoning',
};

const ARMOR_TYPE_LABELS: Record<string, string> = {
  LA: 'Light Armor',
  MA: 'Medium Armor',
  HA: 'Heavy Armor',
  S: 'Shield',
};

function generateItemId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}

function getBaseType(rawType: string): string {
  return rawType.split('|')[0];
}

function mapCategory(rawType?: string): string {
  if (!rawType) return 'misc';
  const base = getBaseType(rawType);
  return TYPE_TO_CATEGORY[base] || 'misc';
}

function resolvePropertyName(prop: string): string | null {
  const base = prop.split('|')[0];
  return PROPERTY_NAMES[base] || null;
}

function parseItemEntries(entries: (string | RawItemEntry)[]): string {
  return entries
    .map(entry => {
      if (typeof entry === 'string') return entry;

      if (entry.type === 'list' && entry.items) {
        return entry.items
          .map(item => {
            if (typeof item === 'string') return item;
            if (item.type === 'item' && item.name && item.entries) {
              return `**${item.name}.** ${parseItemEntries(item.entries)}`;
            }
            if (item.entries) return parseItemEntries(item.entries);
            return '';
          })
          .filter(Boolean)
          .join('\n\n');
      }

      if (entry.type === 'entries' && entry.entries) {
        let result = '';
        if (entry.name) result += `**${entry.name}**\n\n`;
        result += parseItemEntries(entry.entries);
        return result;
      }

      if (entry.type === 'table') {
        let result = '';
        if (entry.caption) result += `**${entry.caption}**\n\n`;
        result += '_(See table in source material)_';
        return result;
      }

      if (entry.entries) return parseItemEntries(entry.entries);
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function buildDescription(raw: RawBaseItem): string {
  const parts: string[] = [];

  if (raw.weapon) {
    const details: string[] = [];
    if (raw.weaponCategory) details.push(`${raw.weaponCategory} weapon`);
    if (raw.dmg1) {
      const dmgLabel = raw.dmgType ? DAMAGE_TYPE_NAMES[raw.dmgType] : '';
      details.push(
        `Damage: ${raw.dmg1}${dmgLabel ? ` ${dmgLabel.toLowerCase()}` : ''}`
      );
    }
    if (raw.dmg2) details.push(`Versatile: ${raw.dmg2}`);
    if (raw.range) details.push(`Range: ${raw.range}`);
    if (details.length > 0) parts.push(details.join(' | '));
  }

  if (raw.armor) {
    const details: string[] = [];
    const baseType = getBaseType(raw.type || '');
    const label = ARMOR_TYPE_LABELS[baseType];
    if (label) details.push(label);
    if (raw.ac !== undefined) details.push(`AC ${raw.ac}`);
    if (raw.strength) details.push(`Str ${raw.strength} required`);
    if (raw.stealth) details.push('Stealth disadvantage');
    if (details.length > 0) parts.push(details.join(' | '));
  }

  if (raw.entries) parts.push(parseItemEntries(raw.entries));
  if (raw.additionalEntries)
    parts.push(parseItemEntries(raw.additionalEntries));

  return parts.join('\n\n');
}

function buildTags(raw: RawBaseItem): string[] {
  const tags: string[] = [];

  if (raw.weaponCategory) tags.push(raw.weaponCategory);

  if (raw.property) {
    for (const prop of raw.property) {
      const name = resolvePropertyName(prop);
      if (name) tags.push(name);
    }
  }

  if (raw.dmgType) {
    const label = DAMAGE_TYPE_NAMES[raw.dmgType];
    if (label) tags.push(label);
  }

  const baseType = getBaseType(raw.type || '');
  const armorLabel = ARMOR_TYPE_LABELS[baseType];
  if (armorLabel) tags.push(armorLabel);

  if (raw.stealth) tags.push('Stealth Disadvantage');
  if (raw.weapon) tags.push('Weapon');
  if (raw.armor) tags.push('Armor');

  if (baseType === 'AT') tags.push("Artisan's Tools");
  if (baseType === 'INS') tags.push('Musical Instrument');
  if (baseType === 'SCF') tags.push('Spellcasting Focus');
  if (baseType === 'AF') tags.push('Ammunition');

  return [...new Set(tags)];
}

function processItem(raw: RawBaseItem): ProcessedItem {
  const baseType = getBaseType(raw.type || '');
  return {
    id: generateItemId(raw.name, raw.source),
    name: raw.name,
    source: formatSourceForDisplay(raw.source),
    category: mapCategory(raw.type),
    rarity: raw.rarity || 'none',
    weight: raw.weight,
    value: raw.value,
    description: buildDescription(raw),
    tags: buildTags(raw),
    weaponCategory: raw.weaponCategory,
    damage: raw.dmg1,
    damageType: raw.dmgType ? DAMAGE_TYPE_NAMES[raw.dmgType] : undefined,
    ac: raw.ac,
    properties: raw.property
      ?.map(p => resolvePropertyName(p))
      .filter((p): p is string => p !== null),
    range: raw.range,
    rawType: baseType,
  };
}

export async function loadAllItems(): Promise<ProcessedItem[]> {
  if (cachedItems) return cachedItems;

  try {
    const filePath = path.join(process.cwd(), 'json', 'items-base.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (!data.baseitem || !Array.isArray(data.baseitem)) {
      console.error('Invalid items-base.json structure');
      return [];
    }

    const seen = new Map<string, { source: string; index: number }>();
    const results: ProcessedItem[] = [];

    for (const rawItem of data.baseitem as RawBaseItem[]) {
      const key = rawItem.name.toLowerCase();
      const existing = seen.get(key);

      if (existing) {
        // Prefer PHB over others; if current is XPHB and existing is PHB, skip
        if (rawItem.source === 'PHB' && existing.source !== 'PHB') {
          results[existing.index] = processItem(rawItem);
          seen.set(key, { source: rawItem.source, index: existing.index });
        }
        // Otherwise skip duplicate
        continue;
      }

      const index = results.length;
      results.push(processItem(rawItem));
      seen.set(key, { source: rawItem.source, index });
    }

    cachedItems = results.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`Loaded ${cachedItems.length} processed items`);
    return cachedItems;
  } catch (error) {
    console.error('Error loading items:', error);
    return [];
  }
}
