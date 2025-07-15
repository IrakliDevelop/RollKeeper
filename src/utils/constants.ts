import { AbilityName, SkillName, ClassInfo, RichTextContent } from '@/types/character';

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
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 3, 6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4,
  13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6,
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
  'Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Gnome', 'Half-Elf', 
  'Half-Orc', 'Tiefling', 'Aarakocra', 'Aasimar', 'Bugbear', 'Centaur', 
  'Changeling', 'Firbolg', 'Genasi', 'Githyanki', 'Githzerai', 'Goblin', 
  'Goliath', 'Hobgoblin', 'Kenku', 'Kobold', 'Lizardfolk', 'Minotaur', 
  'Orc', 'Satyr', 'Tabaxi', 'Triton', 'Warforged', 'Yuan-Ti'
];

// Common D&D classes with spellcaster information
export const COMMON_CLASSES: Array<{ name: string; spellcaster: 'full' | 'half' | 'third' | 'warlock' | 'none' }> = [
  { name: 'Barbarian', spellcaster: 'none' },
  { name: 'Bard', spellcaster: 'full' },
  { name: 'Cleric', spellcaster: 'full' },
  { name: 'Druid', spellcaster: 'full' },
  { name: 'Fighter', spellcaster: 'third' }, // Eldritch Knight
  { name: 'Monk', spellcaster: 'none' },
  { name: 'Paladin', spellcaster: 'half' },
  { name: 'Ranger', spellcaster: 'half' },
  { name: 'Rogue', spellcaster: 'third' }, // Arcane Trickster
  { name: 'Sorcerer', spellcaster: 'full' },
  { name: 'Warlock', spellcaster: 'warlock' },
  { name: 'Wizard', spellcaster: 'full' },
  { name: 'Artificer', spellcaster: 'half' },
  { name: 'Blood Hunter', spellcaster: 'none' }
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
export const THIRD_CASTER_SPELL_SLOTS: Record<number, Record<number, number>> = {
  1: {}, 2: {}, 3: { 1: 2 }, 4: { 1: 3 }, 5: {}, 6: {}, 7: { 1: 4, 2: 2 }, 8: { 1: 4, 2: 2 },
  9: {}, 10: { 1: 4, 2: 3 }, 11: { 1: 4, 2: 3 }, 12: {}, 13: { 1: 4, 2: 3, 3: 2 }, 14: { 1: 4, 2: 3, 3: 2 },
  15: {}, 16: { 1: 4, 2: 3, 3: 3 }, 17: {}, 18: {}, 19: { 1: 4, 2: 3, 3: 3, 4: 1 }, 20: { 1: 4, 2: 3, 3: 3, 4: 1 },
};

// Warlock pact magic slots
export const WARLOCK_PACT_SLOTS: Record<number, { slots: number; level: number }> = {
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
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'
];

// Common backgrounds
export const BACKGROUNDS = [
  'Acolyte', 'Criminal', 'Folk Hero', 'Noble', 'Sage', 'Soldier', 'Charlatan',
  'Entertainer', 'Guild Artisan', 'Hermit', 'Outlander', 'Sailor'
];

// Default character state
export const DEFAULT_CHARACTER_STATE = {
  name: '',
  race: '',
  class: {
    name: '',
    isCustom: false,
    spellcaster: 'none' as const,
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
  },
  
  armorClass: 10,
  initiative: {
    value: 0,
    isOverridden: false
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

  features: [] as RichTextContent[],
  traits: [] as RichTextContent[],
  characterBackground: {
    backstory: '',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
};

// Auto-save settings
export const AUTOSAVE_DELAY = 500; // ms
export const STORAGE_KEY = 'rollkeeper-character';
export const APP_VERSION = '1.0.0'; 