import { promises as fs } from 'fs';
import path from 'path';
import {
  RawMonsterData,
  ProcessedMonster,
  ProcessedTrait,
} from '@/types/bestiary';
import { formatSourceForDisplay } from './sourceUtils';
import { parseReferences } from './referenceParser';

// Types for data processing
type StringOrObjectItem =
  | string
  | {
      special?: string;
      note?: string;
      [key: string]: unknown;
    };

type MonsterEntry =
  | string
  | {
      type?: string;
      name?: string;
      entries?: MonsterEntry[];
      items?: MonsterEntry[];
      [key: string]: unknown;
    };

type ChallengeRating =
  | string
  | number
  | {
      cr?: string;
      coven?: string;
      lair?: string;
      [key: string]: unknown;
    };

type SenseEntry = string | { [key: string]: unknown };

let cachedBestiary: ProcessedMonster[] | null = null;

function generateMonsterId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}

function formatAc(ac?: (number | { ac: number; from?: string[] })[]): string {
  if (!ac || ac.length === 0) return 'N/A';
  const mainAc = ac[0];
  if (typeof mainAc === 'number') {
    return mainAc.toString();
  }
  if (typeof mainAc === 'object' && mainAc.ac) {
    let result = mainAc.ac.toString();
    if (mainAc.from) {
      result += ` (${mainAc.from.join(', ')})`;
    }
    return result;
  }
  return 'N/A';
}

function formatHp(hp?: { average: number; formula: string }): string {
  if (!hp) return 'N/A';
  return `${hp.average} (${hp.formula})`;
}

function formatSpeed(speed?: {
  [type: string]: number | boolean | { number: number; condition: string };
}): string {
  if (!speed) return 'N/A';
  return Object.entries(speed)
    .map(([type, value]) => {
      if (type === 'walk' && typeof value === 'number') {
        return `${value} ft.`;
      }
      if (typeof value === 'number') {
        return `${type} ${value} ft.`;
      }
      if (typeof value === 'object' && value.number) {
        return `${type} ${value.number} ft. ${value.condition || ''}`.trim();
      }
      if (type === 'canHover' && value === true) {
        return 'can hover';
      }
      return '';
    })
    .filter(s => s)
    .join(', ');
}

function formatStringOrObjectArray(
  items: StringOrObjectItem[] | undefined,
  key: string
): string {
  if (!items || items.length === 0) return 'None';
  return items
    .map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        if (item.special) return item.special;
        const itemKey = item[key];
        if (itemKey) {
          if (Array.isArray(itemKey)) {
            const subItems = itemKey
              .map(subItem => {
                if (typeof subItem === 'object' && subItem[key]) {
                  return `${subItem[key]} ${subItem.note || ''}`.trim();
                }
                return subItem;
              })
              .join(', ');
            return `${subItems} ${item.note || ''}`.trim();
          }
          return `${itemKey} ${item.note || ''}`.trim();
        }
      }
      return '';
    })
    .filter(Boolean)
    .join(', ');
}

function formatSenses(
  senses: SenseEntry[] | undefined,
  passivePerception: number
): string {
  if (!senses || senses.length === 0)
    return `passive Perception ${passivePerception}`;
  const sensesStr = senses
    .map(s => {
      if (typeof s === 'string') return s;
      return '';
    })
    .filter(Boolean)
    .join(', ');
  return `${sensesStr}, passive Perception ${passivePerception}`;
}

function formatCr(cr: ChallengeRating | undefined): string {
  if (!cr) return 'Unknown';
  if (typeof cr === 'object') {
    if (cr.cr) return cr.cr;
    if (cr.coven) return `Coven ${cr.coven}`;
    if (cr.lair) return `Lair ${cr.lair}`;
  }
  return cr.toString();
}

function processEntries(entries: MonsterEntry[]): string {
  return entries
    .map(entry => {
      if (typeof entry === 'string') {
        return parseReferences(entry).html;
      }
      if (typeof entry === 'object' && entry.type === 'list' && entry.items) {
        return `<ul>${entry.items.map((item: MonsterEntry) => `<li>${processEntries([item])}</li>`).join('')}</ul>`;
      }
      if (typeof entry === 'object' && entry.name && entry.entries) {
        return `<strong>${entry.name}.</strong> ${processEntries(entry.entries)}`;
      }
      if (
        typeof entry === 'object' &&
        entry.type === 'entries' &&
        entry.entries
      ) {
        return processEntries(entry.entries);
      }
      return '';
    })
    .join('<br>');
}

function processTraits(
  traits?: { name: string; entries: MonsterEntry[] }[]
): ProcessedTrait[] | undefined {
  if (!traits) return undefined;
  return traits.map(trait => ({
    name: trait.name,
    text: processEntries(trait.entries),
  }));
}

function processMonster(monster: RawMonsterData): ProcessedMonster {
  const id = generateMonsterId(monster.name, monster.source);
  const typeData =
    typeof monster.type === 'object'
      ? monster.type
      : { type: monster.type || 'unknown' };

  return {
    id,
    name: monster.name,
    size: Array.isArray(monster.size)
      ? monster.size
      : [monster.size ?? 'Unknown'],
    type: typeData.type,
    alignment:
      monster.alignment
        ?.map(a => (typeof a === 'object' ? a.alignment || a.entry : a))
        .join(', ') || 'Unaligned',
    ac: formatAc(monster.ac),
    hp: formatHp(monster.hp),
    speed: formatSpeed(monster.speed),
    str: monster.str || 10,
    dex: monster.dex || 10,
    con: monster.con || 10,
    int: monster.int || 10,
    wis: monster.wis || 10,
    cha: monster.cha || 10,
    saves: monster.save
      ? Object.entries(monster.save)
          .map(([key, val]) => `${key.toUpperCase()} ${val}`)
          .join(', ')
      : '',
    skills: monster.skill
      ? Object.entries(monster.skill)
          .map(
            ([key, val]) =>
              `${key.charAt(0).toUpperCase() + key.slice(1)} ${val}`
          )
          .join(', ')
      : '',
    resistances: formatStringOrObjectArray(monster.resist, 'resist'),
    immunities: formatStringOrObjectArray(monster.immune, 'immune'),
    vulnerabilities: formatStringOrObjectArray(
      monster.vulnerable,
      'vulnerable'
    ),
    senses: formatSenses(
      monster.senses as SenseEntry[] | undefined,
      monster.passive ?? 0
    ),
    passivePerception: monster.passive ?? 0,
    languages: monster.languages?.join(', ') || 'None',
    cr: formatCr(monster.cr as ChallengeRating | undefined),
    traits: processTraits(monster.trait),
    actions: processTraits(monster.action),
    legendaryActions: processTraits(monster.legendary),
    source: formatSourceForDisplay(monster.source),
    page: monster.page ?? 0,
  };
}

export async function loadAllBestiary(): Promise<ProcessedMonster[]> {
  if (cachedBestiary) {
    return cachedBestiary;
  }

  const bestiaryDir = path.join(process.cwd(), 'json', 'bestiary');
  const files = await fs.readdir(bestiaryDir);
  const jsonFiles = files.filter(file => file.endsWith('.json'));

  const allMonsters: ProcessedMonster[] = [];

  for (const file of jsonFiles) {
    try {
      const filePath = path.join(bestiaryDir, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      if (data.monster && Array.isArray(data.monster)) {
        for (const rawMonster of data.monster) {
          try {
            allMonsters.push(processMonster(rawMonster));
          } catch (error) {
            console.error(
              `Error processing monster "${rawMonster.name}" in ${file}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error(`Error loading or parsing ${file}:`, error);
    }
  }

  cachedBestiary = allMonsters.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Loaded ${cachedBestiary.length} monsters.`);
  return cachedBestiary;
}
