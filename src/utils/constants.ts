import { AbilityName, SkillName } from '@/types/character';

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

// Common D&D races
export const COMMON_RACES = [
  'Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Gnome', 'Half-Elf', 
  'Half-Orc', 'Tiefling', 'Aarakocra', 'Aasimar', 'Bugbear', 'Centaur', 
  'Changeling', 'Firbolg', 'Genasi', 'Githyanki', 'Githzerai', 'Goblin', 
  'Goliath', 'Hobgoblin', 'Kenku', 'Kobold', 'Lizardfolk', 'Minotaur', 
  'Orc', 'Satyr', 'Tabaxi', 'Triton', 'Warforged', 'Yuan-Ti'
];

// Common D&D classes
export const COMMON_CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 
  'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard', 'Artificer', 
  'Blood Hunter'
];

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
  class: '',
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
  initiative: 0,
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
} as const;

// Auto-save settings
export const AUTOSAVE_DELAY = 500; // ms
export const STORAGE_KEY = 'rollkeeper-character';
export const APP_VERSION = '1.0.0'; 