export interface ProcessedTrait {
  name: string;
  text: string;
}

export interface ProcessedMonster {
  id: string;
  name: string;
  size: string[];
  type: string | { type: string; tags?: string[] };
  alignment: string;
  ac: string;
  hp: string;
  speed: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  saves: string;
  skills: string;
  resistances: string;
  immunities: string;
  vulnerabilities: string;
  senses: string;
  passivePerception: number;
  languages: string;
  cr: string;
  traits?: ProcessedTrait[];
  actions?: ProcessedTrait[];
  legendaryActions?: ProcessedTrait[];
  source: string;
  page: number;
}

export interface RawMonsterData {
  name: string;
  size?: string;
  type?: string | { type: string; tags: string[] };
  alignment?: (
    | string
    | { alignment: string; chance?: number; entry?: string }
  )[];
  ac?: (number | { ac: number; from: string[] })[];
  hp?: { average: number; formula: string };
  speed?: {
    [key: string]: number | boolean | { number: number; condition: string };
  };
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  save?: { [ability: string]: string };
  skill?: { [name: string]: string };
  resist?: (
    | string
    | { resist: (string | { resist: string[]; note: string })[]; note: string }
    | { special: string }
  )[];
  immune?: (
    | string
    | { immune: string[]; note: string }
    | { special: string }
  )[];
  vulnerable?: (
    | string
    | { vulnerable: string[]; note: string }
    | { special: string }
  )[];
  senses?: unknown[];
  passive?: number;
  languages?: string[];
  cr?: unknown;
  trait?: { name: string; entries: string[] }[];
  action?: { name: string; entries: string[] }[];
  legendary?: { name: string; entries: string[] }[];
  source: string;
  page?: number;
}

// Bestiary filtering and search options
export interface BestiaryFilters {
  sizes: string[];
  types: string[];
  alignments: string[];
  crRange: {
    min?: number;
    max?: number;
  };
  sources: string[];
  searchQuery: string;
  hasLegendaryActions?: boolean;
  hasSpellcasting?: boolean;
  hasConditionImmunities?: boolean;
  hasDamageResistances?: boolean;
}

// Common creature types
export const CREATURE_TYPES = [
  'Aberration',
  'Beast',
  'Celestial',
  'Construct',
  'Dragon',
  'Elemental',
  'Fey',
  'Fiend',
  'Giant',
  'Humanoid',
  'Monstrosity',
  'Ooze',
  'Plant',
  'Undead',
];

// Common alignments
export const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
  'Unaligned',
];

// Size categories
export const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
