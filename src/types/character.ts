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

// Hit Points calculation mode
export type HPCalculationMode = 'auto' | 'manual';

// Death Saving Throws
export interface DeathSavingThrows {
  successes: number; // 0-3
  failures: number;  // 0-3
  isStabilized: boolean;
}

// Hit points tracking
export interface HitPoints {
  current: number;
  max: number;
  temporary: number;
  calculationMode: HPCalculationMode;
  manualMaxOverride?: number; // Used when calculationMode is 'manual'
  deathSaves?: DeathSavingThrows; // Only present when at 0 HP
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
  hitDie: number; // d6, d8, d10, d12 - the size of the hit die for this class
}

// Weapon and magic item types
export type WeaponCategory = 'simple' | 'martial' | 'magic' | 'artifact';
export type WeaponType = 'melee' | 'ranged' | 'finesse' | 'versatile' | 'light' | 'heavy' | 'reach' | 'thrown' | 'ammunition' | 'loading' | 'special';
export type DamageType = 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic' | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder';

// Individual weapon/magic item
export interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  weaponType: WeaponType[];
  damage: {
    dice: string; // e.g., "1d8", "2d6"
    type: DamageType;
    versatiledice?: string; // For versatile weapons (e.g., "1d10")
  };
  enhancementBonus: number; // +0, +1, +2, +3 (enhancement bonus)
  attackBonus?: number; // Additional custom attack bonus beyond enhancement
  damageBonus?: number; // Additional custom damage bonus beyond enhancement
  properties: string[]; // Custom properties like "magical", "silvered", etc.
  description?: string; // Optional description for magic items
  range?: {
    normal: number;
    long?: number;
  };
  isEquipped: boolean; // Whether this weapon is currently equipped/ready
  manualProficiency?: boolean; // Manual override for proficiency (undefined = use auto calculation)
  createdAt: string;
  updatedAt: string;
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

  // Weapons and Equipment
  weapons: Weapon[];
  weaponProficiencies: {
    simpleWeapons: boolean;
    martialWeapons: boolean;
    specificWeapons: string[]; // Array of specific weapon names
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