// Basic character types for D&D 5e character sheet
export type AbilityName =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma';
export type SkillName =
  | 'acrobatics'
  | 'animalHandling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleightOfHand'
  | 'stealth'
  | 'survival';

import type { SpellbookState } from './spells';

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

// Tool proficiency levels
export type ToolProficiencyLevel = 'none' | 'proficient' | 'expertise';

// Tool proficiency tracking
export interface ToolProficiency {
  id: string;
  name: string; // e.g., "Thieves' Tools", "Smith's Tools", "Lute"
  proficiencyLevel: ToolProficiencyLevel;
  createdAt: string;
  updatedAt: string;
}

// Language tracking
export interface Language {
  id: string;
  name: string; // e.g., "Common", "Elvish", "Draconic"
  script?: string; // e.g., "Common", "Elvish", "Draconic" (optional)
  createdAt: string;
  updatedAt: string;
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
  failures: number; // 0-3
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

// Reaction tracking for combat
export interface ReactionData {
  hasUsedReaction: boolean; // Whether reaction has been used this turn/round
}

// Heroic Inspiration tracking (stackable)
export interface HeroicInspiration {
  count: number; // Number of inspiration dice available
  maxCount?: number; // Optional maximum (some DMs set limits)
}

// Rich text content for character information
export interface RichTextContent {
  id: string;
  title: string;
  content: string; // HTML content from WYSIWYG editor
  category: 'feature' | 'trait' | 'background' | 'note' | 'spell';
  order?: number; // For ordering notes
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

// Trackable trait/feature with limited uses
export interface TrackableTrait {
  id: string;
  name: string;
  description?: string;
  maxUses: number;
  usedUses: number;
  restType: 'short' | 'long'; // Recharges on short or long rest
  source?: string; // e.g., "Racial", "Feat", "Class Feature", etc.
  scaleWithProficiency?: boolean; // If true, maxUses scales with proficiency bonus
  proficiencyMultiplier?: number; // Multiplier for proficiency bonus (default 1)
  isPassive?: boolean; // If true, this is a passive ability (no usage tracking needed)
  createdAt: string;
  updatedAt: string;
}

// Extended feature source types
export type FeatureSourceType = 
  | 'class'        // Class features (e.g., Action Surge, Sneak Attack)
  | 'race'         // Racial features (e.g., Darkvision, Breath Weapon)
  | 'feat'         // Feat abilities (e.g., Great Weapon Master, Lucky)
  | 'background'   // Background features (e.g., Criminal Contact)
  | 'magic-item'   // Magic item abilities
  | 'other';       // Custom/miscellaneous features

// Extended feature interface that builds upon TrackableTrait
export interface ExtendedFeature extends TrackableTrait {
  sourceType: FeatureSourceType;
  sourceDetail?: string; // e.g., "Fighter Level 2", "Hill Dwarf", "Winged Boots"
  category?: string; // Custom categorization within source type
  displayOrder: number; // For drag & drop ordering within categories
  isPassive?: boolean; // True for passive abilities (no usage tracking)
}

// Feature category grouping for UI organization
export interface FeatureCategory {
  sourceType: FeatureSourceType;
  label: string;
  description: string;
  features: ExtendedFeature[];
  isCollapsed?: boolean;
}

// Constants for feature source types
export const FEATURE_SOURCE_LABELS: Record<FeatureSourceType, string> = {
  class: 'Class Features',
  race: 'Racial Features', 
  feat: 'Feats',
  background: 'Background Features',
  'magic-item': 'Magic Items',
  other: 'Other/Custom',
};

export const FEATURE_SOURCE_DESCRIPTIONS: Record<FeatureSourceType, string> = {
  class: 'Abilities gained from your character class and level',
  race: 'Traits and abilities from your character\'s race and subrace',
  feat: 'Special abilities gained from feats',
  background: 'Features from your character\'s background',
  'magic-item': 'Abilities granted by magic items and equipment',
  other: 'Custom or miscellaneous abilities',
};

// Warlock pact magic slots
export interface PactMagic {
  slots: SpellSlot;
  level: number; // Pact slot level (1-5)
}

// Spellcasting ability types
export type SpellcastingAbility = 'intelligence' | 'wisdom' | 'charisma';

// Spell action types
export type SpellActionType = 'attack' | 'save' | 'utility';

// Concentration tracking state
export interface ConcentrationState {
  isConcentrating: boolean;
  spellName?: string; // Name of the spell being concentrated on
  spellId?: string; // ID of the spell being concentrated on (for user spells)
  castAt?: number; // What level the concentration spell was cast at
  startedAt?: string; // ISO timestamp when concentration started
}

// Spell information
export interface Spell {
  id: string;
  name: string;
  level: number; // 0 for cantrips, 1-9 for spells
  school: string; // Divination, Evocation, etc.
  castingTime: string; // "1 action", "1 bonus action", "1 minute", etc.
  range: string; // "Touch", "30 feet", "Self", etc.
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialDescription?: string; // e.g., "a handful of clay"
  };
  duration: string; // "Instantaneous", "1 minute", "Concentration, up to 1 hour", etc.
  description: string;
  higherLevel?: string; // Description of what happens when cast at higher levels
  ritual?: boolean; // Can be cast as a ritual
  concentration?: boolean; // Requires concentration
  isPrepared?: boolean; // For classes that prepare spells
  isAlwaysPrepared?: boolean; // For domain spells, patron spells, etc.
  actionType?: SpellActionType; // Whether spell requires attack roll, saving throw, or is utility
  savingThrow?: string; // Which saving throw (if actionType is 'save'): "Dexterity", "Constitution", etc.
  damage?: string; // Damage dice (if applicable): "1d10", "3d6", etc.
  damageType?: string; // Type of damage: "fire", "cold", "psychic", etc.
  source?: string; // PHB, XGE, etc.
  createdAt: string;
  updatedAt: string;
}

// Spellcasting statistics with override capability
export interface SpellcastingStats {
  spellcastingAbility: SpellcastingAbility | null; // null for non-spellcasters
  isAbilityOverridden: boolean; // If true, use manual override instead of class-based
  spellAttackBonus?: number; // Manual override for spell attack bonus
  spellSaveDC?: number; // Manual override for spell save DC
}

// Class information with custom support
export interface ClassInfo {
  name: string;
  isCustom: boolean;
  spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none';
  hitDie: number; // d6, d8, d10, d12 - the size of the hit die for this class
}

// Multiclass information for individual classes
export interface MulticlassInfo {
  className: string;
  level: number;
  isCustom: boolean;
  spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none';
  hitDie: number; // d6, d8, d10, d12 - the size of the hit die for this class
  subclass?: string; // Optional subclass name
}

// Multiclass validation result
export interface MulticlassValidation {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}


// Weapon and magic item types
export type WeaponCategory = 'simple' | 'martial' | 'magic' | 'artifact';
export type WeaponType =
  | 'melee'
  | 'ranged'
  | 'finesse'
  | 'versatile'
  | 'light'
  | 'heavy'
  | 'reach'
  | 'thrown'
  | 'ammunition'
  | 'loading'
  | 'special';
export type DamageType =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder';

// Weapon damage entry for multiple damage types
export interface WeaponDamage {
  dice: string; // e.g., "1d8", "2d6"
  type: DamageType;
  versatiledice?: string; // For versatile weapons (e.g., "1d10")
  label?: string; // Optional label like "Cold Damage", "Fire Damage", etc.
}

// Individual weapon/magic item
export interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  weaponType: WeaponType[];
  // Updated to support multiple damage types
  damage: WeaponDamage[]; // Array of damage entries
  // Legacy single damage support for backward compatibility
  legacyDamage?: {
    dice: string;
    type: DamageType;
    versatiledice?: string;
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
  requiresAttunement?: boolean; // Whether this weapon requires attunement
  isAttuned?: boolean; // Whether character is attuned to this item
  createdAt: string;
  updatedAt: string;
}

// Magic item categories and types
export type MagicItemCategory =
  | 'wondrous'
  | 'armor'
  | 'shield'
  | 'ring'
  | 'staff'
  | 'wand'
  | 'rod'
  | 'scroll'
  | 'potion'
  | 'artifact'
  | 'other';
export type MagicItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'very rare'
  | 'legendary'
  | 'artifact';

// Magic item interface
export interface MagicItem {
  id: string;
  name: string;
  category: MagicItemCategory;
  rarity: MagicItemRarity;
  description: string;
  properties: string[]; // Special properties or abilities
  requiresAttunement: boolean;
  isAttuned: boolean;
  isEquipped?: boolean; // For wearable items
  charges?: {
    current: number;
    max: number;
    rechargeRule?: string; // e.g., "1d6+1 at dawn", "all at dawn"
  };
  createdAt: string;
  updatedAt: string;
}

// Attunement tracking
export interface AttunementSlots {
  used: number;
  max: number; // Usually 3, but can be modified by features
}

// Armor types and interfaces
export type ArmorCategory = 'light' | 'medium' | 'heavy' | 'shield';
export type ArmorType =
  | 'padded'
  | 'leather'
  | 'studded-leather'
  | 'hide'
  | 'chain-shirt'
  | 'scale-mail'
  | 'breastplate'
  | 'half-plate'
  | 'ring-mail'
  | 'chain-mail'
  | 'splint'
  | 'plate'
  | 'shield'
  | 'custom';

export interface ArmorItem {
  id: string;
  name: string;
  category: ArmorCategory;
  type: ArmorType;
  baseAC: number; // Base AC provided by armor
  maxDexBonus?: number; // Max dex bonus (null = unlimited)
  stealthDisadvantage: boolean;
  strengthRequirement?: number;
  enhancementBonus: number; // +0, +1, +2, +3
  isEquipped: boolean;
  requiresAttunement?: boolean;
  isAttuned?: boolean;
  description?: string;
  weight?: number;
  value?: number; // In copper pieces
  createdAt: string;
  updatedAt: string;
}

// General inventory item
export interface InventoryItem {
  id: string;
  name: string;
  category: string; // "weapon", "armor", "tool", "consumable", "treasure", "misc"
  location?: string; // Custom location like "backpack", "bag of holding", "pocket", etc.
  rarity?: MagicItemRarity; // Item rarity (common, uncommon, rare, etc.)
  type?: MagicItemCategory; // Item type (wondrous, ring, potion, etc.)
  quantity: number;
  weight?: number; // Per item
  value?: number; // Per item, in copper pieces
  description?: string;
  tags: string[]; // For filtering/organization
  createdAt: string;
  updatedAt: string;
}

// Currency tracking
export interface Currency {
  copper: number;
  silver: number;
  electrum: number;
  gold: number;
  platinum: number;
}

// Main character state interface
export interface CharacterState {
  id: string;
  // Basic Information
  name: string;
  race: string;
  
  // Multiclass Support (new)
  classes?: MulticlassInfo[]; // Array of classes for multiclass characters
  totalLevel?: number; // Sum of all class levels
  hitDicePools?: HitDicePools; // Hit dice pools by die type
  
  // Backwards Compatibility (deprecated but maintained)
  class: ClassInfo; // Single class info (for backwards compatibility)
  level: number; // Total character level (for backwards compatibility)
  
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
  tempArmorClass: number; // Temporary AC bonuses from spells, effects, etc.
  isWearingShield: boolean; // Whether character is currently wearing/using a shield
  shieldBonus: number; // AC bonus from shield (default +2, but can be +1, +3, etc.)
  initiative: InitiativeData;
  reaction: ReactionData;
  speed: number;
  hitDice: string; // e.g., "1d8", "2d6" (for backwards compatibility)

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

  // Heroic Inspiration
  heroicInspiration: HeroicInspiration;

  // Trackable Traits
  trackableTraits: TrackableTrait[];

  // Extended Features (new system)
  extendedFeatures: ExtendedFeature[];

  // Rich Text Content
  features: RichTextContent[];
  traits: RichTextContent[];
  notes: RichTextContent[];
  characterBackground: CharacterBackground;

  // Weapons and Equipment
  weapons: Weapon[];
  magicItems: MagicItem[];
  armorItems: ArmorItem[];
  inventoryItems: InventoryItem[];
  currency: Currency;
  attunementSlots: AttunementSlots;
  weaponProficiencies: {
    simpleWeapons: boolean;
    martialWeapons: boolean;
    specificWeapons: string[]; // Array of specific weapon names
  };

  // Spellcasting
  spells: Spell[]; // All spells and cantrips known/prepared
  spellcastingStats: SpellcastingStats;
  concentration: ConcentrationState; // Active concentration tracking

  // Death saving throws
  deathSavingThrows: DeathSavingThrows;

  // Spellbook and grimoire system
  spellbook: SpellbookState;

  // Conditions and diseases
  conditionsAndDiseases: ConditionsDiseasesState;

  // Class Features
  jackOfAllTrades: boolean; // Bard feature: add half proficiency to non-proficient skills

  // Languages and Tool Proficiencies
  languages: Language[];
  toolProficiencies: ToolProficiency[];

  // Miscellaneous
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

// Save state type
export type SaveStatus = 'saving' | 'saved' | 'error';

// Exhaustion variants (2014 vs 2024)
export type ExhaustionVariant = '2014' | '2024';

// Active condition tracking
export interface ActiveCondition {
  id: string;
  name: string;
  source: string; // PHB, XPHB, etc.
  description: string;
  stackable: boolean;
  count: number; // For stackable conditions like exhaustion
  appliedAt: string; // ISO date string
  notes?: string; // Optional player notes
}

// Active disease tracking
export interface ActiveDisease {
  id: string;
  name: string;
  source: string;
  description: string;
  onsetTime?: string; // When symptoms started
  appliedAt: string; // ISO date string
  notes?: string;
}

// Conditions and diseases state
export interface ConditionsDiseasesState {
  activeConditions: ActiveCondition[];
  activeDiseases: ActiveDisease[];
  exhaustionVariant: ExhaustionVariant; // Player's preference for exhaustion rules
}

// Raw JSON data types for conditions/diseases
export interface RawConditionEntry {
  type?: string;
  name?: string;
  entries?: (string | RawConditionEntry)[];
  items?: (string | RawConditionEntry)[];
  entry?: string; // Single entry field (used in item objects)
}

export interface RawCondition {
  name: string;
  source: string;
  page?: number;
  srd?: boolean;
  basicRules?: boolean;
  srd52?: boolean;
  basicRules2024?: boolean;
  reprintedAs?: string[];
  entries: (string | RawConditionEntry)[];
  hasFluffImages?: boolean;
}

export interface RawDisease {
  name: string;
  source: string;
  page?: number;
  type?: string;
  entries: string[];
}

export interface RawStatus {
  name: string;
  source: string;
  page?: number;
  srd?: boolean;
  basicRules?: boolean;
  srd52?: boolean;
  basicRules2024?: boolean;
  reprintedAs?: string[];
  entries: (string | RawConditionEntry)[];
}

export interface RawConditionsDiseasesData {
  condition: RawCondition[];
  disease: RawDisease[];
  status: RawStatus[];
}

// Processed condition/disease data
export interface ProcessedCondition {
  id: string;
  name: string;
  source: string;
  description: string;
  isExhaustion: boolean;
  stackable: boolean;
  variant?: '2014' | '2024'; // For conditions that have multiple versions
}

export interface ProcessedDisease {
  id: string;
  name: string;
  source: string;
  description: string;
  type?: string;
}

export interface ProcessedStatus {
  id: string;
  name: string;
  source: string;
  description: string;
}

// Utility functions for extended features
export function migrateTraitToExtendedFeature(trait: TrackableTrait, index: number): ExtendedFeature {
  return {
    ...trait,
    sourceType: 'other' as const,
    sourceDetail: trait.source || undefined,
    displayOrder: index,
    isPassive: trait.maxUses === 0,
  };
}

export function groupFeaturesBySource(features: ExtendedFeature[]): FeatureCategory[] {
  const grouped = features.reduce((acc, feature) => {
    if (!acc[feature.sourceType]) {
      acc[feature.sourceType] = [];
    }
    acc[feature.sourceType].push(feature);
    return acc;
  }, {} as Record<FeatureSourceType, ExtendedFeature[]>);

  return Object.entries(grouped).map(([sourceType, features]) => ({
    sourceType: sourceType as FeatureSourceType,
    label: FEATURE_SOURCE_LABELS[sourceType as FeatureSourceType],
    description: FEATURE_SOURCE_DESCRIPTIONS[sourceType as FeatureSourceType],
    features: features.sort((a, b) => a.displayOrder - b.displayOrder),
    isCollapsed: false,
  }));
}

export function createDefaultExtendedFeature(
  sourceType: FeatureSourceType = 'other'
): Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    description: '',
    maxUses: 1,
    usedUses: 0,
    restType: 'long',
    source: '',
    sourceType,
    sourceDetail: '',
    category: '',
    displayOrder: 0,
    isPassive: false,
    scaleWithProficiency: false,
    proficiencyMultiplier: 1,
  };
}

// Multiclassing types
export interface MulticlassInfo {
  className: string;
  level: number;
  isCustom: boolean;
  spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none';
  hitDie: number;
  subclass?: string;
}

export interface HitDicePools {
  [key: string]: {
    max: number;
    used: number;
  };
}

export interface MulticlassValidation {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}
