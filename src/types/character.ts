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

// Initiative tracking with override capability
export interface InitiativeData {
  value: number;
  isOverridden: boolean; // If true, use custom value; if false, calculate from DEX
}

// Rich text content for character information
export interface RichTextContent {
  id: string;
  title: string;
  content: string; // HTML content from WYSIWYG editor
  category: 'feature' | 'trait' | 'background';
  createdAt: string;
  updatedAt: string;
}

// Character background and history
export interface CharacterBackground {
  backstory: string; // Rich text HTML content
  personality: string; // Rich text HTML content
  ideals: string; // Rich text HTML content
  bonds: string; // Rich text HTML content
  flaws: string; // Rich text HTML content
}

// Spell slot tracking for each level
export interface SpellSlot {
  max: number;
  used: number;
}

// Spell slot data structure
export interface SpellSlots {
  1: SpellSlot;
  2: SpellSlot;
  3: SpellSlot;
  4: SpellSlot;
  5: SpellSlot;
  6: SpellSlot;
  7: SpellSlot;
  8: SpellSlot;
  9: SpellSlot;
}

// Warlock pact magic slots
export interface PactMagic {
  slots: SpellSlot;
  level: number; // Pact slot level (1-5)
}

// Class information with custom support
export interface ClassInfo {
  name: string;
  isCustom: boolean;
  spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none';
}

// Main character state interface
export interface CharacterState {
  // Basic Information
  name: string;
  race: string;
  class: ClassInfo;
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
  initiative: InitiativeData;
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

  // Spell Slots
  spellSlots: SpellSlots;
  pactMagic?: PactMagic; // Only for warlocks

  // Rich Text Content
  features: RichTextContent[];
  traits: RichTextContent[];
  characterBackground: CharacterBackground;
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