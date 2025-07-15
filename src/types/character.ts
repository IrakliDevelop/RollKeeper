// Core ability scores
export type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

// Character abilities with scores
export interface CharacterAbilities {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

// Skill proficiency data
export interface SkillProficiency {
  proficient: boolean;
  expertise: boolean;
  customModifier?: number;
}

// Saving throw proficiency
export interface SavingThrowProficiency {
  proficient: boolean;
  customModifier?: number;
}

// Hit points tracking
export interface HitPoints {
  current: number;
  max: number;
  temporary: number;
}

// Main character state interface
export interface CharacterState {
  // Basic Information
  name: string;
  race: string;
  class: string;
  level: number;
  experience: number;
  background: string;
  alignment: string;
  playerName: string;
  
  // Ability Scores
  abilities: CharacterAbilities;
  
  // Skills (all 18 D&D skills)
  skills: {
    acrobatics: SkillProficiency;
    animalHandling: SkillProficiency;
    arcana: SkillProficiency;
    athletics: SkillProficiency;
    deception: SkillProficiency;
    history: SkillProficiency;
    insight: SkillProficiency;
    intimidation: SkillProficiency;
    investigation: SkillProficiency;
    medicine: SkillProficiency;
    nature: SkillProficiency;
    perception: SkillProficiency;
    performance: SkillProficiency;
    persuasion: SkillProficiency;
    religion: SkillProficiency;
    sleightOfHand: SkillProficiency;
    stealth: SkillProficiency;
    survival: SkillProficiency;
  };
  
  // Combat Stats
  hitPoints: HitPoints;
  armorClass: number;
  initiative: number;
  speed: number;
  hitDice: string; // e.g., "1d8", "2d6"
  
  // Saving Throws
  savingThrows: {
    strength: SavingThrowProficiency;
    dexterity: SavingThrowProficiency;
    constitution: SavingThrowProficiency;
    intelligence: SavingThrowProficiency;
    wisdom: SavingThrowProficiency;
    charisma: SavingThrowProficiency;
  };
}

// UI state for managing application state
export interface UIState {
  activeTab: string;
  saveStatus: 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
}

// Export/Import data structure
export interface CharacterExport {
  version: string;
  exportDate: string;
  character: CharacterState;
}

// Skill name type for type safety
export type SkillName = keyof CharacterState['skills'];

// Save state type
export type SaveStatus = 'saving' | 'saved' | 'error'; 