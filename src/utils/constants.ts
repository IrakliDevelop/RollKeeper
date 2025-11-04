import {
  AbilityName,
  SkillName,
  RichTextContent,
  Weapon,
  Spell,
  TrackableTrait,
  ExtendedFeature,
  MagicItem,
  ArmorItem,
  InventoryItem,
} from '@/types/character';

// D&D 5e skill to ability mappings
export const SKILL_ABILITY_MAP: Record<SkillName, AbilityName> = {
  acrobatics: 'dexterity',
  animalHandling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleightOfHand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
};

// Skill display names
export const SKILL_NAMES: Record<SkillName, string> = {
  acrobatics: 'Acrobatics',
  animalHandling: 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleightOfHand: 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
};

// Ability score display names
export const ABILITY_NAMES: Record<AbilityName, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};

// Ability score abbreviations
export const ABILITY_ABBREVIATIONS: Record<AbilityName, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

// Proficiency bonus by level (D&D 5e)
export const PROFICIENCY_BONUS_BY_LEVEL: Record<number, number> = {
  1: 2,
  2: 2,
  3: 2,
  4: 2,
  5: 3,
  6: 3,
  7: 3,
  8: 3,
  9: 4,
  10: 4,
  11: 4,
  12: 4,
  13: 5,
  14: 5,
  15: 5,
  16: 5,
  17: 6,
  18: 6,
  19: 6,
  20: 6,
};

// Experience points required for each level (D&D 5e)
export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

// Common D&D races
export const COMMON_RACES = [
  'Human',
  'Elf',
  'Dwarf',
  'Halfling',
  'Dragonborn',
  'Gnome',
  'Half-Elf',
  'Half-Orc',
  'Tiefling',
  'Aarakocra',
  'Aasimar',
  'Bugbear',
  'Centaur',
  'Changeling',
  'Firbolg',
  'Genasi',
  'Githyanki',
  'Githzerai',
  'Goblin',
  'Goliath',
  'Hobgoblin',
  'Kenku',
  'Kobold',
  'Lizardfolk',
  'Minotaur',
  'Orc',
  'Satyr',
  'Tabaxi',
  'Triton',
  'Warforged',
  'Yuan-Ti',
];

// Fallback race options for autocomplete when API fails
export const FALLBACK_RACE_OPTIONS = [
  { value: 'Human', label: 'Human' },
  { value: 'Elf', label: 'Elf' },
  { value: 'Dwarf', label: 'Dwarf' },
  { value: 'Halfling', label: 'Halfling' },
  { value: 'Dragonborn', label: 'Dragonborn' },
  { value: 'Gnome', label: 'Gnome' },
  { value: 'Half-Elf', label: 'Half-Elf' },
  { value: 'Half-Orc', label: 'Half-Orc' },
  { value: 'Tiefling', label: 'Tiefling' },
];

// Hit dice for each D&D 5e class
export const CLASS_HIT_DICE: Record<string, number> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Artificer: 8,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
  'Blood Hunter': 10, // Critical Role homebrew class
};

// Common D&D classes with spellcaster and hit die information
export const COMMON_CLASSES: Array<{
  name: string;
  spellcaster: 'full' | 'half' | 'third' | 'warlock' | 'none';
  hitDie: number;
}> = [
  { name: 'Barbarian', spellcaster: 'none', hitDie: 12 },
  { name: 'Bard', spellcaster: 'full', hitDie: 8 },
  { name: 'Cleric', spellcaster: 'full', hitDie: 8 },
  { name: 'Druid', spellcaster: 'full', hitDie: 8 },
  { name: 'Fighter', spellcaster: 'third', hitDie: 10 }, // Eldritch Knight
  { name: 'Monk', spellcaster: 'none', hitDie: 8 },
  { name: 'Paladin', spellcaster: 'half', hitDie: 10 },
  { name: 'Ranger', spellcaster: 'half', hitDie: 10 },
  { name: 'Rogue', spellcaster: 'third', hitDie: 8 }, // Arcane Trickster
  { name: 'Sorcerer', spellcaster: 'full', hitDie: 6 },
  { name: 'Warlock', spellcaster: 'warlock', hitDie: 8 },
  { name: 'Wizard', spellcaster: 'full', hitDie: 6 },
  { name: 'Artificer', spellcaster: 'half', hitDie: 8 },
  { name: 'Blood Hunter', spellcaster: 'none', hitDie: 10 },
];

// Spell slots by level for full casters
export const FULL_CASTER_SPELL_SLOTS: Record<number, Record<number, number>> = {
  1: { 1: 2 },
  2: { 1: 3 },
  3: { 1: 4, 2: 2 },
  4: { 1: 4, 2: 3 },
  5: { 1: 4, 2: 3, 3: 2 },
  6: { 1: 4, 2: 3, 3: 3 },
  7: { 1: 4, 2: 3, 3: 3, 4: 1 },
  8: { 1: 4, 2: 3, 3: 3, 4: 2 },
  9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
};

// Spell slots by level for half casters (Paladin, Ranger, Artificer)
export const HALF_CASTER_SPELL_SLOTS: Record<number, Record<number, number>> = {
  1: {},
  2: { 1: 2 },
  3: { 1: 3 },
  4: { 1: 3 },
  5: { 1: 4, 2: 2 },
  6: { 1: 4, 2: 2 },
  7: { 1: 4, 2: 3 },
  8: { 1: 4, 2: 3 },
  9: { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};

// Spell slots by level for third casters (Eldritch Knight, Arcane Trickster)
export const THIRD_CASTER_SPELL_SLOTS: Record<
  number,
  Record<number, number>
> = {
  1: {},
  2: {},
  3: { 1: 2 },
  4: { 1: 3 },
  5: {},
  6: {},
  7: { 1: 4, 2: 2 },
  8: { 1: 4, 2: 2 },
  9: {},
  10: { 1: 4, 2: 3 },
  11: { 1: 4, 2: 3 },
  12: {},
  13: { 1: 4, 2: 3, 3: 2 },
  14: { 1: 4, 2: 3, 3: 2 },
  15: {},
  16: { 1: 4, 2: 3, 3: 3 },
  17: {},
  18: {},
  19: { 1: 4, 2: 3, 3: 3, 4: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 1 },
};

// Warlock pact magic slots
export const WARLOCK_PACT_SLOTS: Record<
  number,
  { slots: number; level: number }
> = {
  1: { slots: 1, level: 1 },
  2: { slots: 2, level: 1 },
  3: { slots: 2, level: 2 },
  4: { slots: 2, level: 2 },
  5: { slots: 2, level: 3 },
  6: { slots: 2, level: 3 },
  7: { slots: 2, level: 4 },
  8: { slots: 2, level: 4 },
  9: { slots: 2, level: 5 },
  10: { slots: 2, level: 5 },
  11: { slots: 3, level: 5 },
  12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 },
  14: { slots: 3, level: 5 },
  15: { slots: 3, level: 5 },
  16: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 },
  18: { slots: 4, level: 5 },
  19: { slots: 4, level: 5 },
  20: { slots: 4, level: 5 },
};

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
];

// Common backgrounds
export const BACKGROUNDS = [
  'Acolyte',
  'Criminal',
  'Folk Hero',
  'Noble',
  'Sage',
  'Soldier',
  'Charlatan',
  'Entertainer',
  'Guild Artisan',
  'Hermit',
  'Outlander',
  'Sailor',
];

// Default character state
export const DEFAULT_CHARACTER_STATE = {
  name: '',
  race: '',
  class: {
    name: '',
    isCustom: false,
    spellcaster: 'none' as const,
    hitDie: 8, // Default to d8 for unknown/empty classes
  },
  level: 1,
  experience: 0,
  background: '',
  alignment: '',
  playerName: '',

  abilities: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },

  skills: {
    acrobatics: { proficient: false, expertise: false },
    animalHandling: { proficient: false, expertise: false },
    arcana: { proficient: false, expertise: false },
    athletics: { proficient: false, expertise: false },
    deception: { proficient: false, expertise: false },
    history: { proficient: false, expertise: false },
    insight: { proficient: false, expertise: false },
    intimidation: { proficient: false, expertise: false },
    investigation: { proficient: false, expertise: false },
    medicine: { proficient: false, expertise: false },
    nature: { proficient: false, expertise: false },
    perception: { proficient: false, expertise: false },
    performance: { proficient: false, expertise: false },
    persuasion: { proficient: false, expertise: false },
    religion: { proficient: false, expertise: false },
    sleightOfHand: { proficient: false, expertise: false },
    stealth: { proficient: false, expertise: false },
    survival: { proficient: false, expertise: false },
  },

  hitPoints: {
    current: 8,
    max: 8,
    temporary: 0,
    calculationMode: 'auto' as const,
    manualMaxOverride: undefined,
    deathSaves: undefined,
  },

  deathSavingThrows: {
    successes: 0,
    failures: 0,
    isStabilized: false,
  },

  armorClass: 10,
  tempArmorClass: 0,
  isWearingShield: false,
  shieldBonus: 2,
  initiative: {
    value: 0,
    isOverridden: false,
  },
  reaction: {
    hasUsedReaction: false,
  },
  speed: 30,
  hitDice: '1d8',

  savingThrows: {
    strength: { proficient: false },
    dexterity: { proficient: false },
    constitution: { proficient: false },
    intelligence: { proficient: false },
    wisdom: { proficient: false },
    charisma: { proficient: false },
  },

  spellSlots: {
    1: { max: 0, used: 0 },
    2: { max: 0, used: 0 },
    3: { max: 0, used: 0 },
    4: { max: 0, used: 0 },
    5: { max: 0, used: 0 },
    6: { max: 0, used: 0 },
    7: { max: 0, used: 0 },
    8: { max: 0, used: 0 },
    9: { max: 0, used: 0 },
  },

  heroicInspiration: {
    count: 0,
    maxCount: undefined,
  },

  trackableTraits: [] as TrackableTrait[],

  extendedFeatures: [] as ExtendedFeature[],

  features: [] as RichTextContent[],
  traits: [] as RichTextContent[],
  notes: [] as RichTextContent[],
  characterBackground: {
    backstory: '',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },

  weapons: [] as Weapon[],
  magicItems: [] as MagicItem[],
  armorItems: [] as ArmorItem[],
  inventoryItems: [] as InventoryItem[],
  currency: {
    copper: 0,
    silver: 0,
    electrum: 0,
    gold: 0,
    platinum: 0,
  },
  attunementSlots: {
    used: 0,
    max: 3,
  },
  weaponProficiencies: {
    simpleWeapons: false,
    martialWeapons: false,
    specificWeapons: [],
  },

  spells: [] as Spell[],
  spellcastingStats: {
    spellcastingAbility: null,
    isAbilityOverridden: false,
    customSpellcastingAbility: null,
    spellAttackBonus: undefined,
    spellSaveDC: undefined,
  },

  concentration: {
    isConcentrating: false,
    spellName: undefined,
    spellId: undefined,
    castAt: undefined,
    startedAt: undefined,
  },

  // Spellbook system
  spellbook: {
    knownSpells: [],
    preparedSpells: [],
    favoriteSpells: [],
    customSpells: [],
    spellbookSettings: {
      showOnlyClassSpells: true,
      showOnlyKnownSpells: false,
      preferredSources: ['PHB', 'XGE', 'TCE'],
      spellbookName: 'My Spellbook',
      theme: 'classic' as const,
    },
  },

  // Conditions and diseases
  conditionsAndDiseases: {
    activeConditions: [],
    activeDiseases: [],
    exhaustionVariant: '2024' as const, // Default to 2024 rules
  },

  // Class Features
  jackOfAllTrades: false, // Bard feature: add half proficiency to non-proficient skills
  languages: [], // Known languages
  toolProficiencies: [], // Tool proficiencies with levels
};

// spell source books and colors mapping, key should be SPELL_SOURCE_BOOKS keys
export const SPELL_SOURCE_COLORS: Record<string, string> = {
  PHB: 'bg-blue-500',
  PHB2024: 'bg-indigo-500',
  XPHB: 'bg-violet-500',
  XGE: 'bg-green-500',
  TCE: 'bg-red-500',
  ERLW: 'bg-amber-500',
  AI: 'bg-cyan-500',
  AAG: 'bg-teal-500',
  EEPC: 'bg-emerald-500',
  EGW: 'bg-sky-500',
  RMR: 'bg-purple-500',
  FTD: 'bg-fuchsia-500',
  GGR: 'bg-rose-500',
  IDRotF: 'bg-orange-500',
  MOTF: 'bg-yellow-500',
  MTG: 'bg-lime-500',
  SatO: 'bg-pink-500',
  SCC: 'bg-slate-500',
  SCAG: 'bg-zinc-500',
  TDCSR: 'bg-emerald-600',
  BMT: 'bg-violet-600',
  BoET: 'bg-indigo-600',
  DoDk: 'bg-blue-600',
  GHLoE: 'bg-cyan-600',
  VG: 'bg-teal-600',
  'AitFR-AVT': 'bg-green-600',
};

export const SPELL_SOURCE_BOOKS: Record<string, string> = {
  PHB: "Player's Handbook",
  PHB2024: "Player's Handbook 2024",
  XPHB: "Player's Handbook 2024",
  XGE: "Xanathar's Guide to Everything",
  TCE: "Tasha's Cauldron of Everything",
  ERLW: 'Eberron: Rising from the Last War',
  AI: 'Acquisitions Incorporated',
  AAG: `Astral Adventurers Guild`,
  EEPC: `Elemental Evil Player's Companion`,
  EGW: `Explorer's Guide to Wildemount`,
  RMR: `Dungeons & Dragons vs Rick & Morty`,
  FTD: `Fizban's Treasury of Dragons`,
  GGR: `Guildmasters' Guide to Ravnica`,
  IDRotF: `Icewind Dale: Rime of the Frostmaiden`,
  MOTF: `Mythic Odysseys of Theros`,
  MTG: `Magic: The Gathering`,
  SatO: 'Sigil and the Outlands',
  SCC: 'Strixhaven: A Curriculum of Chaos',
  SCAG: "Sword Coast Adventurer's Guide",
  TDCSR: `Tal'Dorei Campaign Setting Reborn`,
  BMT: 'The Book of Many Things',
  BoET: 'Book of Ebon Tides',
  DoDk: 'Dungeons of Drakkenheim',
  GHLoE: 'Grim Hollow: Lairs of Etharis',
  VG: "Volo's Guide to Monsters",
  'AitFR-AVT': `Adventures in the Forgotten Realms: A Verdant Tomb`,
  'AitFR-FCD': `Adventures in the Forgotten Realms: From Cyan Depths`,
  LLK: 'Lost Laboratory of Kwalish',
  DMG: "Dungeon Master's Guide",
  DMG2024: "Dungeon Master's Guide 2024",
  XDMG: "Dungeon Master's Guide 2024",
};

// Auto-save settings
export const AUTOSAVE_DELAY = 500; // ms
export const STORAGE_KEY = 'rollkeeper-character';
export const APP_VERSION = '1.0.0';

// Avatar upload settings
export const MAX_AVATAR_SIZE_MB = 5; // Maximum avatar file size in megabytes
export const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;
