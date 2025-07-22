// Spell data types based on the JSON structure from 5e Tools

export type SpellSchool = 'A' | 'C' | 'D' | 'E' | 'I' | 'N' | 'T' | 'V';

export type SpellClass = 
  | 'artificer' | 'bard' | 'cleric' | 'druid' | 'paladin' | 'ranger' 
  | 'sorcerer' | 'warlock' | 'wizard' | 'eldritch knight' | 'arcane trickster';

export interface SpellTime {
  number: number;
  unit: 'action' | 'bonus' | 'reaction' | 'minute' | 'hour';
  condition?: string;
}

export interface SpellRange {
  type: 'point' | 'line' | 'cone' | 'cube' | 'sphere' | 'hemisphere' | 'cylinder' | 'self' | 'sight' | 'unlimited' | 'touch' | 'special';
  distance?: {
    type: 'feet' | 'miles' | 'self' | 'touch' | 'sight' | 'unlimited';
    amount?: number;
  };
}

export interface SpellComponents {
  v?: boolean; // Verbal
  s?: boolean; // Somatic
  m?: string | boolean; // Material (string if specific component, boolean if generic)
}

export interface SpellDuration {
  type: 'instant' | 'timed' | 'permanent' | 'special';
  duration?: {
    type: 'minute' | 'hour' | 'day' | 'year' | 'round' | 'turn';
    amount?: number;
  };
  ends?: string[];
  concentration?: boolean;
}

export interface SpellMeta {
  ritual?: boolean;
}

export interface SpellEntryHigherLevel {
  type: 'entries';
  name: string;
  entries: string[];
}

export interface SpellScalingLevelDice {
  label: string;
  scaling: Record<string, string>;
}

// Raw spell data from JSON files
export interface RawSpellData {
  name: string;
  source: string;
  page?: number;
  srd?: boolean;
  basicRules?: boolean;
  otherSources?: Array<{
    source: string;
    page: number;
  }>;
  reprintedAs?: string[];
  level: number; // 0-9, where 0 is cantrip
  school: SpellSchool;
  time: SpellTime[];
  range: SpellRange;
  components: SpellComponents;
  duration: SpellDuration[];
  meta?: SpellMeta;
  entries: (string | SpellEntry)[];
  entriesHigherLevel?: SpellEntryHigherLevel[];
  scalingLevelDice?: SpellScalingLevelDice;
  damageInflict?: string[];
  conditionInflict?: string[];
  savingThrow?: string[];
  abilityCheck?: string[];
  spellAttack?: string[];
  miscTags?: string[];
  areaTags?: string[];
  hasFluffImages?: boolean;
}

// Spell entry objects that can appear in entries array
export interface SpellEntry {
  type: string;
  name?: string;
  entries?: string[];
  style?: string;
  items?: SpellEntryItem[];
}

export interface SpellEntryItem {
  type: string;
  name: string;
  entries: string[];
}

// Processed spell data for our application
export interface ProcessedSpell {
  id: string; // Generated unique identifier
  name: string;
  level: number;
  school: SpellSchool;
  schoolName: string; // Full school name
  source: string;
  page?: number;
  isRitual: boolean;
  concentration: boolean;
  castingTime: string; // Human-readable casting time
  range: string; // Human-readable range
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialComponent?: string;
  };
  duration: string; // Human-readable duration
  description: string; // Main description
  higherLevelDescription?: string; // At higher levels description
  classes: SpellClass[]; // Classes that can cast this spell
  tags: string[]; // Searchable tags
  damage?: string[]; // Damage types
  saves?: string[]; // Saving throws
  isCantrip: boolean;
  isSrd: boolean;
}

// Spellbook state for character
export interface SpellbookState {
  knownSpells: string[]; // Spell IDs the character knows
  preparedSpells: string[]; // Currently prepared spells
  favoriteSpells: string[]; // Bookmarked spells
  customSpells: ProcessedSpell[]; // User-created spells
  spellbookSettings: {
    showOnlyClassSpells: boolean;
    showOnlyKnownSpells: boolean;
    preferredSources: string[];
    spellbookName: string;
    theme: 'classic' | 'arcane' | 'divine' | 'nature' | 'dark';
  };
}

// Filtering and search options
export interface SpellFilters {
  levels: number[];
  schools: SpellSchool[];
  classes: SpellClass[];
  sources: string[];
  components: ('v' | 's' | 'm')[];
  concentration?: boolean;
  ritual?: boolean;
  searchQuery: string;
  castingTime?: string[];
  duration?: string[];
}

// School mappings
export const SPELL_SCHOOLS: Record<SpellSchool, string> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
  V: 'Evocation'
};

// Class spell lists mapping (we'll populate this based on D&D 5e SRD data)
export const CLASS_SPELL_LISTS: Record<SpellClass, string[]> = {
  artificer: [],
  bard: [],
  cleric: [],
  druid: [],
  paladin: [],
  ranger: [],
  sorcerer: [],
  warlock: [],
  wizard: [],
  'eldritch knight': [],
  'arcane trickster': []
}; 