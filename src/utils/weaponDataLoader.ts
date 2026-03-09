import { promises as fs } from 'fs';
import path from 'path';
import { ProcessedWeapon } from '@/types/items';

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

function stripTags(text: string): string {
  return text
    .replace(/\{@\w+\s+([^|}]+?)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@\w+\s+([^}]+)\}/g, '$1');
}

function parseEntries(entries: unknown[]): string {
  return entries
    .map(entry => {
      if (typeof entry === 'string') return stripTags(entry);

      if (typeof entry === 'object' && entry !== null) {
        const obj = entry as Record<string, unknown>;

        if (obj.type === 'list' && Array.isArray(obj.items)) {
          return obj.items
            .map((item: unknown) => {
              if (typeof item === 'string') return `- ${stripTags(item)}`;
              if (
                typeof item === 'object' &&
                item !== null &&
                (item as Record<string, unknown>).type === 'item'
              ) {
                const i = item as Record<string, unknown>;
                const name = i.name ? `**${i.name}.** ` : '';
                const sub = Array.isArray(i.entries)
                  ? parseEntries(i.entries)
                  : (i.entry as string) || '';
                return `- ${name}${stripTags(sub)}`;
              }
              return '';
            })
            .filter(Boolean)
            .join('\n');
        }

        if (obj.type === 'entries' && Array.isArray(obj.entries)) {
          const heading = obj.name ? `**${obj.name}**\n\n` : '';
          return heading + parseEntries(obj.entries);
        }

        if (obj.type === 'table') {
          return obj.caption
            ? `**${obj.caption}** _(See table in source material)_`
            : '_(See table in source material)_';
        }

        if (Array.isArray(obj.entries)) {
          return parseEntries(obj.entries);
        }
      }

      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

interface RawWeaponItem {
  name: string;
  source: string;
  type?: string;
  rarity?: string;
  weight?: number;
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
    ...(raw.entries ? [parseEntries(raw.entries)] : []),
    ...(raw.additionalEntries ? [parseEntries(raw.additionalEntries)] : []),
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

export async function loadAllWeapons(): Promise<ProcessedWeapon[]> {
  if (cachedWeapons) return cachedWeapons;

  try {
    const filePath = path.join(process.cwd(), 'json', 'items.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (!data.item || !Array.isArray(data.item)) {
      console.error('Invalid items.json structure');
      return [];
    }

    const seen = new Map<string, { source: string; index: number }>();
    const results: ProcessedWeapon[] = [];

    for (const rawItem of data.item as RawWeaponItem[]) {
      const baseType = rawItem.type ? getBaseType(rawItem.type) : '';
      if (baseType !== 'M' && baseType !== 'R') continue;
      if (!rawItem.weaponCategory || !rawItem.dmg1) continue;

      const key = rawItem.name.toLowerCase();
      const existing = seen.get(key);

      if (existing) {
        const existingPreferred = PREFERRED_SOURCES.has(existing.source);
        const newPreferred = PREFERRED_SOURCES.has(rawItem.source);

        if (newPreferred && !existingPreferred) {
          results[existing.index] = processWeapon(rawItem);
          seen.set(key, { source: rawItem.source, index: existing.index });
        }
        continue;
      }

      const index = results.length;
      results.push(processWeapon(rawItem));
      seen.set(key, { source: rawItem.source, index });
    }

    cachedWeapons = results.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`Loaded ${cachedWeapons.length} processed weapons`);
    return cachedWeapons;
  } catch (error) {
    console.error('Error loading weapons:', error);
    return [];
  }
}
