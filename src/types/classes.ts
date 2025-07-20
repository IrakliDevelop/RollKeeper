// D&D 5e Class and Subclass Types

export type SpellcastingType = 'full' | 'half' | 'third' | 'warlock' | 'none';
export type SpellcastingAbility = 'int' | 'wis' | 'cha';
export type ProficiencyType = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

// Raw class data from JSON files
export interface RawClassData {
  name: string;
  source: string;
  page?: number;
  srd?: boolean;
  basicRules?: boolean;
  reprintedAs?: string[];
  edition?: string;
  hd?: {
    number: number;
    faces: number;
  };
  proficiency?: ProficiencyType[];
  spellcastingAbility?: SpellcastingAbility;
  casterProgression?: SpellcastingType;
  preparedSpells?: string;
  cantripProgression?: number[];
  spellsKnownProgressionFixed?: number[];
  spellsKnownProgressionFixedAllowLowerLevel?: boolean;
  startingProficiencies?: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
    skills?: Array<{
      choose?: {
        from: string[];
        count: number;
      };
    } | string>;
  };
  startingEquipment?: {
    additionalFromBackground?: boolean;
    default?: string[];
    goldAlternative?: string;
  };
  multiclassing?: {
    requirements?: Record<string, number>;
    proficienciesGained?: {
      armor?: string[];
      weapons?: string[];
      tools?: string[];
    };
  };
  classTableGroups?: Array<{
    title?: string;
    colLabels?: string[];
    rows?: Array<Array<string | number>>;
    rowsSpellProgression?: number[][];
  }>;
  classFeatures?: string[];
  hasFluffImages?: boolean;
}

// Raw subclass data from JSON files
export interface RawSubclassData {
  name: string;
  shortName: string;
  source: string;
  className: string;
  classSource: string;
  page?: number;
  reprintedAs?: string[];
  edition?: string;
  subclassFeatures: string[];
  _copy?: {
    name: string;
    source: string;
    shortName?: string;
    className: string;
    classSource: string;
    _preserve?: Record<string, boolean>;
  };
}

// Class feature with description
export interface ClassFeature {
  name: string;
  level: number;
  source: string;
  className?: string;
  entries?: string[]; // Parsed description entries
  isSubclassFeature: boolean;
  subclassShortName?: string;
  original: string; // Original feature reference
}

// Processed class data for our application
export interface ProcessedClass {
  id: string;
  name: string;
  source: string;
  page?: number;
  hitDie: string; // e.g., "d6", "d8", "d10", "d12"
  primaryAbilities: ProficiencyType[];
  spellcasting: {
    type: SpellcastingType;
    ability?: SpellcastingAbility;
    preparedSpellsFormula?: string;
    cantripProgression?: number[];
    spellsKnownProgression?: number[];
  };
  proficiencies: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
    savingThrows: ProficiencyType[];
    skillChoices?: {
      from: string[];
      count: number;
    };
  };
  startingEquipment: string[];
  multiclassing?: {
    requirements: Record<string, number>;
    proficienciesGained: {
      armor?: string[];
      weapons?: string[];
      tools?: string[];
    };
  };
  features: ClassFeature[];
  spellSlotProgression?: Record<number, Record<number, number>>; // level -> spell level -> slots
  subclasses: ProcessedSubclass[];
  description?: string;
  isSrd: boolean;
  tags: string[];
}

// Processed subclass data
export interface ProcessedSubclass {
  id: string;
  name: string;
  shortName: string;
  source: string;
  page?: number;
  parentClassName: string;
  parentClassSource: string;
  features: ClassFeature[];
  description?: string;
  tags: string[];
}

// Filter options for class browsing
export interface ClassFilters {
  sources?: string[];
  spellcastingTypes?: SpellcastingType[];
  spellcastingAbilities?: SpellcastingAbility[];
  hitDiceTypes?: string[];
  primaryAbilities?: ProficiencyType[];
  searchQuery?: string;
}

// Complete class data structure from JSON files
export interface ClassDataFile {
  _meta?: {
    internalCopies?: string[];
  };
  class: RawClassData[];
  subclass: RawSubclassData[];
  subclassFeature?: unknown[]; // Features data if needed later
  classFeature?: unknown[]; // Features data if needed later
} 