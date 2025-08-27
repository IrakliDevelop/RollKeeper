import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  CharacterState,
  SaveStatus,
  CharacterExport,
  ClassInfo,
  SpellSlots,
  PactMagic,
  RichTextContent,
  CharacterBackground,
  Weapon,
  TrackableTrait,
  ExtendedFeature,
  HeroicInspiration,
  MagicItem,
  ArmorItem,
  InventoryItem,
  ActiveCondition,
  ActiveDisease,
  ExhaustionVariant,
  WeaponDamage,
  DamageType,
} from '@/types/character';
import { ProcessedSpell } from '@/types/spells';
import {
  DEFAULT_CHARACTER_STATE,
  STORAGE_KEY,
  APP_VERSION,
  COMMON_CLASSES,
} from '@/utils/constants';
import {
  calculateSpellSlots,
  calculatePactMagic,
  updateSpellSlotsPreservingUsed,
  calculateModifier,
  calculateLevelFromXP,
  calculateTraitMaxUses,
} from '@/utils/calculations';
import {
  applyDamage,
  applyHealing,
  addTemporaryHP,
  makeDeathSave,
  resetDeathSaves,
  calculateMaxHP,
  getClassHitDie,
} from '@/utils/hpCalculations';

// Function to migrate weapon damage from old format to new array format
function migrateWeaponDamage(weapon: Record<string, unknown>): Weapon {
  // If the weapon already has the new damage array format, return as-is
  if (Array.isArray(weapon.damage)) {
    return weapon as unknown as Weapon;
  }

  // If the weapon has the old damage object format, convert it
  const damage = weapon.damage as Record<string, unknown>;
  if (
    damage &&
    typeof damage === 'object' &&
    typeof damage.dice === 'string' &&
    typeof damage.type === 'string'
  ) {
    const newDamage: WeaponDamage = {
      dice: damage.dice,
      type: damage.type as DamageType,
      versatiledice: damage.versatiledice as string | undefined,
      label: 'Weapon Damage', // Default label for migrated weapons
    };

    return {
      ...weapon,
      damage: [newDamage],
      legacyDamage: damage, // Keep the old format for reference
    } as unknown as Weapon;
  }

  // If no damage is defined, create a default empty array
  return {
    ...weapon,
    damage: [],
  } as unknown as Weapon;
}

// Migration function to handle old character data
function migrateCharacterData(character: unknown): CharacterState {
  // Type guard to check if character is an object
  if (!character || typeof character !== 'object') {
    return {
      ...DEFAULT_CHARACTER_STATE,
      id: generateId(),
    };
  }

  const characterObj = character as Record<string, unknown>;

  // If it's already a new character with class object, return as-is
  if (characterObj.class && typeof characterObj.class === 'object') {
    const result = character as CharacterState;
    // Ensure spellSlots exist
    if (!result.spellSlots) {
      result.spellSlots = DEFAULT_CHARACTER_STATE.spellSlots;
    }
    // Ensure features and traits are arrays
    if (!Array.isArray(result.features)) {
      result.features = DEFAULT_CHARACTER_STATE.features;
    }
    if (!Array.isArray(result.traits)) {
      result.traits = DEFAULT_CHARACTER_STATE.traits;
    }
    if (!Array.isArray(result.notes)) {
      result.notes = DEFAULT_CHARACTER_STATE.notes;
    }
    // Ensure characterBackground exists
    if (
      !result.characterBackground ||
      typeof result.characterBackground !== 'object' ||
      !('backstory' in result.characterBackground)
    ) {
      result.characterBackground = DEFAULT_CHARACTER_STATE.characterBackground;
    }
    // Ensure weapons array exists
    if (!Array.isArray(result.weapons)) {
      result.weapons = DEFAULT_CHARACTER_STATE.weapons;
    }
    // Ensure weapon proficiencies exist
    if (
      !result.weaponProficiencies ||
      typeof result.weaponProficiencies !== 'object'
    ) {
      result.weaponProficiencies = DEFAULT_CHARACTER_STATE.weaponProficiencies;
    }
    // Ensure spells array exists
    if (!Array.isArray(result.spells)) {
      result.spells = DEFAULT_CHARACTER_STATE.spells;
    }
    // Ensure spellcasting stats exist
    if (
      !result.spellcastingStats ||
      typeof result.spellcastingStats !== 'object'
    ) {
      result.spellcastingStats = DEFAULT_CHARACTER_STATE.spellcastingStats;
    }
    // Ensure class has hitDie
    if (
      result.class &&
      typeof result.class === 'object' &&
      !('hitDie' in result.class)
    ) {
      (result.class as Record<string, unknown>).hitDie = 8; // Default to d8
    }
    // Ensure hitPoints has new properties
    if (result.hitPoints && typeof result.hitPoints === 'object') {
      if (!('calculationMode' in result.hitPoints)) {
        (result.hitPoints as Record<string, unknown>).calculationMode = 'auto';
      }
    }
    // Ensure reaction tracking exists
    if (!result.reaction || typeof result.reaction !== 'object') {
      result.reaction = DEFAULT_CHARACTER_STATE.reaction;
    }
    // Ensure heroic inspiration exists
    if (
      !result.heroicInspiration ||
      typeof result.heroicInspiration !== 'object'
    ) {
      result.heroicInspiration = DEFAULT_CHARACTER_STATE.heroicInspiration;
    }
    // Ensure temporary AC field exists
    if (typeof result.tempArmorClass !== 'number') {
      result.tempArmorClass = DEFAULT_CHARACTER_STATE.tempArmorClass;
    }
    // Ensure shield status exists
    if (typeof result.isWearingShield !== 'boolean') {
      result.isWearingShield = DEFAULT_CHARACTER_STATE.isWearingShield;
    }
    // Ensure shield bonus exists
    if (typeof result.shieldBonus !== 'number') {
      result.shieldBonus = DEFAULT_CHARACTER_STATE.shieldBonus;
    }
    // Ensure magic items exist
    if (!Array.isArray(result.magicItems)) {
      result.magicItems = DEFAULT_CHARACTER_STATE.magicItems;
    }
    // Ensure attunement slots exist
    if (!result.attunementSlots || typeof result.attunementSlots !== 'object') {
      result.attunementSlots = DEFAULT_CHARACTER_STATE.attunementSlots;
    }
    // Ensure armor items exist
    if (!Array.isArray(result.armorItems)) {
      result.armorItems = DEFAULT_CHARACTER_STATE.armorItems;
    }
    // Ensure inventory items exist
    if (!Array.isArray(result.inventoryItems)) {
      result.inventoryItems = DEFAULT_CHARACTER_STATE.inventoryItems;
    }
    // Ensure currency exists
    if (!result.currency || typeof result.currency !== 'object') {
      result.currency = DEFAULT_CHARACTER_STATE.currency;
    }
    // Ensure spellbook exists
    if (!result.spellbook || typeof result.spellbook !== 'object') {
      result.spellbook = DEFAULT_CHARACTER_STATE.spellbook;
    }
    // Ensure concentration tracking exists
    if (!result.concentration || typeof result.concentration !== 'object') {
      result.concentration = DEFAULT_CHARACTER_STATE.concentration;
    }
    // Ensure conditions and diseases tracking exists
    if (
      !result.conditionsAndDiseases ||
      typeof result.conditionsAndDiseases !== 'object'
    ) {
      result.conditionsAndDiseases =
        DEFAULT_CHARACTER_STATE.conditionsAndDiseases;
    }
    return result;
  }

  // Migrate old character with string class to new format
  const migratedCharacter: CharacterState = {
    id: generateId(),
    ...DEFAULT_CHARACTER_STATE,
    ...(characterObj as Partial<CharacterState>),
    class: {
      name:
        characterObj.class && typeof characterObj.class === 'string'
          ? characterObj.class
          : '',
      isCustom: false,
      spellcaster: 'none' as const,
      hitDie: 8, // Default to d8
    },
    spellSlots: DEFAULT_CHARACTER_STATE.spellSlots,
    pactMagic: undefined,
    features: Array.isArray(characterObj.features)
      ? characterObj.features
      : DEFAULT_CHARACTER_STATE.features,
    traits: Array.isArray(characterObj.traits)
      ? characterObj.traits
      : DEFAULT_CHARACTER_STATE.traits,
    characterBackground:
      characterObj.characterBackground &&
      typeof characterObj.characterBackground === 'object' &&
      'backstory' in characterObj.characterBackground
        ? (characterObj.characterBackground as CharacterState['characterBackground'])
        : DEFAULT_CHARACTER_STATE.characterBackground,
    weapons: Array.isArray(characterObj.weapons)
      ? (characterObj.weapons as Record<string, unknown>[]).map(
          migrateWeaponDamage
        )
      : DEFAULT_CHARACTER_STATE.weapons,
    weaponProficiencies:
      characterObj.weaponProficiencies &&
      typeof characterObj.weaponProficiencies === 'object'
        ? (characterObj.weaponProficiencies as CharacterState['weaponProficiencies'])
        : DEFAULT_CHARACTER_STATE.weaponProficiencies,
    jackOfAllTrades:
      characterObj.jackOfAllTrades &&
      typeof characterObj.jackOfAllTrades === 'boolean'
        ? characterObj.jackOfAllTrades
        : DEFAULT_CHARACTER_STATE.jackOfAllTrades,
  };

  // Try to detect spellcaster type from class name
  if (characterObj.class && typeof characterObj.class === 'string') {
    const className = characterObj.class;
    const matchingClass = COMMON_CLASSES.find(
      c => c.name.toLowerCase() === className.toLowerCase()
    );
    if (matchingClass) {
      migratedCharacter.class = {
        name: matchingClass.name,
        isCustom: false,
        spellcaster: matchingClass.spellcaster,
        hitDie: matchingClass.hitDie,
      };

      // Calculate initial spell slots
      const level =
        characterObj.level && typeof characterObj.level === 'number'
          ? characterObj.level
          : 1;
      migratedCharacter.spellSlots = calculateSpellSlots(
        migratedCharacter.class,
        level
      );

      // Add pact magic for warlocks
      if (matchingClass.spellcaster === 'warlock') {
        migratedCharacter.pactMagic = calculatePactMagic(level);
      }
    } else {
      // Unknown class, mark as custom
      migratedCharacter.class = {
        name: typeof characterObj.class === 'string' ? characterObj.class : '',
        isCustom: true,
        spellcaster: 'none',
        hitDie: 8, // Default to d8 for custom classes
      };
    }
  }

  return migratedCharacter;
}

interface CharacterStore {
  // Character data
  character: CharacterState;

  // UI state
  saveStatus: SaveStatus;
  lastSaved: Date | string | null; // Can be string when rehydrated from localStorage
  hasUnsavedChanges: boolean;
  hasHydrated: boolean;

  // Actions
  updateCharacter: (updates: Partial<CharacterState>) => void;
  loadCharacterState: (characterState: CharacterState) => void;
  updateAbilityScore: (
    ability: keyof CharacterState['abilities'],
    value: number
  ) => void;
  updateSkillProficiency: (
    skill: keyof CharacterState['skills'],
    proficient: boolean
  ) => void;
  updateSkillExpertise: (
    skill: keyof CharacterState['skills'],
    expertise: boolean
  ) => void;
  updateSavingThrowProficiency: (
    ability: keyof CharacterState['savingThrows'],
    proficient: boolean
  ) => void;
  updateHitPoints: (updates: Partial<CharacterState['hitPoints']>) => void;
  updateInitiative: (value: number, isOverride: boolean) => void;
  resetInitiativeToDefault: () => void;

  // Reaction management
  toggleReaction: () => void;
  resetReaction: () => void;

  // Class Features
  toggleJackOfAllTrades: () => void;

  // Heroic inspiration management
  updateHeroicInspiration: (updates: Partial<HeroicInspiration>) => void;
  addHeroicInspiration: (amount?: number) => void;
  useHeroicInspiration: () => void;
  resetHeroicInspiration: () => void;

  // Armor Class management
  updateTempArmorClass: (tempAC: number) => void;
  toggleShield: () => void;
  resetTempArmorClass: () => void;
  updateShieldBonus: (bonus: number) => void;

  // HP management actions
  applyDamageToCharacter: (damage: number) => void;
  applyHealingToCharacter: (healing: number) => void;
  addTemporaryHPToCharacter: (tempHP: number) => void;
  makeDeathSavingThrow: (isSuccess: boolean, isCritical?: boolean) => void;
  resetDeathSavingThrows: () => void;
  toggleHPCalculationMode: () => void;
  recalculateMaxHP: () => void;

  // Class and spell management
  updateClass: (classInfo: ClassInfo) => void;
  updateLevel: (level: number) => void;
  updateSpellSlot: (level: keyof SpellSlots, used: number) => void;
  updatePactMagicSlot: (used: number) => void;
  resetSpellSlots: () => void;
  resetPactMagicSlots: () => void;

  // Concentration management
  startConcentration: (
    spellName: string,
    spellId?: string,
    castAt?: number
  ) => void;
  stopConcentration: () => void;
  isConcentratingOn: (spellName: string) => boolean;

  // Conditions and diseases management
  addCondition: (
    conditionName: string,
    source: string,
    description: string,
    count?: number,
    notes?: string
  ) => void;
  updateCondition: (
    conditionId: string,
    updates: Partial<Pick<ActiveCondition, 'count' | 'notes'>>
  ) => void;
  removeCondition: (conditionId: string) => void;
  addDisease: (
    diseaseName: string,
    source: string,
    description: string,
    onsetTime?: string,
    notes?: string
  ) => void;
  updateDisease: (
    diseaseId: string,
    updates: Partial<Pick<ActiveDisease, 'onsetTime' | 'notes'>>
  ) => void;
  removeDisease: (diseaseId: string) => void;
  setExhaustionVariant: (variant: ExhaustionVariant) => void;
  clearAllConditions: () => void;
  clearAllDiseases: () => void;

  // XP management
  addExperience: (xpToAdd: number) => void;
  setExperience: (newXP: number) => void;

  // Rich text content management
  addFeature: (
    feature: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateFeature: (id: string, updates: Partial<RichTextContent>) => void;
  deleteFeature: (id: string) => void;
  addTrait: (
    trait: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateTrait: (id: string, updates: Partial<RichTextContent>) => void;
  deleteTrait: (id: string) => void;
  addNote: (
    note: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateNote: (id: string, updates: Partial<RichTextContent>) => void;
  deleteNote: (id: string) => void;
  reorderNotes: (sourceIndex: number, destinationIndex: number) => void;

  // Trackable trait management
  addTrackableTrait: (
    trait: Omit<TrackableTrait, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateTrackableTrait: (id: string, updates: Partial<TrackableTrait>) => void;
  deleteTrackableTrait: (id: string) => void;
  useTrackableTrait: (id: string) => void;
  resetTrackableTraits: (restType: 'short' | 'long') => void;

  // Extended feature management
  addExtendedFeature: (
    feature: Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateExtendedFeature: (id: string, updates: Partial<ExtendedFeature>) => void;
  deleteExtendedFeature: (id: string) => void;
  useExtendedFeature: (id: string) => void;
  resetExtendedFeatures: (restType: 'short' | 'long') => void;
  reorderExtendedFeatures: (
    sourceIndex: number, 
    destinationIndex: number, 
    sourceType?: string
  ) => void;
  migrateTraitsToExtendedFeatures: () => void;

  updateCharacterBackground: (updates: Partial<CharacterBackground>) => void;

  // Weapon management
  addWeapon: (weapon: Omit<Weapon, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateWeapon: (id: string, updates: Partial<Weapon>) => void;
  deleteWeapon: (id: string) => void;
  equipWeapon: (id: string, equipped: boolean) => void;
  reorderWeapons: (sourceIndex: number, destinationIndex: number) => void;

  // Magic item management
  addMagicItem: (
    item: Omit<MagicItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateMagicItem: (id: string, updates: Partial<MagicItem>) => void;
  deleteMagicItem: (id: string) => void;
  attuneMagicItem: (id: string, attuned: boolean) => void;
  updateAttunementSlots: (max: number) => void;
  reorderMagicItems: (sourceIndex: number, destinationIndex: number) => void;

  // Armor management
  addArmorItem: (
    item: Omit<ArmorItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateArmorItem: (id: string, updates: Partial<ArmorItem>) => void;
  deleteArmorItem: (id: string) => void;
  equipArmorItem: (id: string, equipped: boolean) => void;
  reorderArmorItems: (sourceIndex: number, destinationIndex: number) => void;

  // Inventory management
  addInventoryItem: (
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  reorderInventoryItems: (
    sourceIndex: number,
    destinationIndex: number
  ) => void;

  // Currency management
  updateCurrency: (
    updates: Partial<typeof DEFAULT_CHARACTER_STATE.currency>
  ) => void;
  addCurrency: (
    type: keyof typeof DEFAULT_CHARACTER_STATE.currency,
    amount: number
  ) => void;
  subtractCurrency: (
    type: keyof typeof DEFAULT_CHARACTER_STATE.currency,
    amount: number
  ) => void;

  // Spellbook management
  addSpellToSpellbook: (spellId: string) => void;
  removeSpellFromSpellbook: (spellId: string) => void;
  toggleSpellFavorite: (spellId: string) => void;
  prepareSpell: (spellId: string) => void;
  unprepareSpell: (spellId: string) => void;
  updateSpellbookSettings: (
    settings: Partial<
      typeof DEFAULT_CHARACTER_STATE.spellbook.spellbookSettings
    >
  ) => void;
  addCustomSpell: (spell: ProcessedSpell) => void; // We'll type this properly later
  removeCustomSpell: (spellId: string) => void;
  reorderPreparedSpells: (
    sourceIndex: number,
    destinationIndex: number
  ) => void;
  reorderSpells: (sourceIndex: number, destinationIndex: number) => void;

  // Persistence actions
  saveCharacter: () => void;
  loadCharacter: (character: CharacterState) => void;
  resetCharacter: () => void;
  exportCharacter: () => CharacterExport;
  importCharacter: (exportData: CharacterExport) => boolean;

  // Auto-save control
  setSaveStatus: (status: SaveStatus) => void;
  markSaved: () => void;
  markUnsaved: () => void;
}

// Utility function to generate unique IDs
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substr(2);

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set, get) => ({
      // Initial state
      character: {
        ...DEFAULT_CHARACTER_STATE,
        id: generateId(),
      },
      saveStatus: 'saved',
      lastSaved: null,
      hasUnsavedChanges: false,
      hasHydrated: false,

      // Character update actions
      updateCharacter: updates => {
        set(state => ({
          character: { ...state.character, ...updates },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      loadCharacterState: characterState => {
        const migratedCharacter = migrateCharacterData(characterState);
        set({
          character: migratedCharacter,
          hasUnsavedChanges: false,
          saveStatus: 'saved',
          lastSaved: new Date(),
        });
      },

      updateAbilityScore: (ability, value) => {
        set(state => {
          const newAbilities = {
            ...state.character.abilities,
            [ability]: Math.max(1, Math.min(30, value)),
          };

          // Auto-update initiative if it's not overridden and dexterity changed
          let initiative = state.character.initiative;
          if (ability === 'dexterity' && !initiative.isOverridden) {
            initiative = {
              ...initiative,
              value: calculateModifier(newAbilities.dexterity),
            };
          }

          return {
            character: {
              ...state.character,
              abilities: newAbilities,
              initiative,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateSkillProficiency: (skill, proficient) => {
        set(state => ({
          character: {
            ...state.character,
            skills: {
              ...state.character.skills,
              [skill]: {
                ...state.character.skills[skill],
                proficient,
              },
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      updateSkillExpertise: (skill, expertise) => {
        set(state => ({
          character: {
            ...state.character,
            skills: {
              ...state.character.skills,
              [skill]: {
                ...state.character.skills[skill],
                expertise,
              },
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      updateSavingThrowProficiency: (ability, proficient) => {
        set(state => ({
          character: {
            ...state.character,
            savingThrows: {
              ...state.character.savingThrows,
              [ability]: {
                ...state.character.savingThrows[ability],
                proficient,
              },
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      updateHitPoints: updates => {
        set(state => ({
          character: {
            ...state.character,
            hitPoints: {
              ...state.character.hitPoints,
              ...updates,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      updateInitiative: (value, isOverride) => {
        set(state => ({
          character: {
            ...state.character,
            initiative: {
              value,
              isOverridden: isOverride,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      resetInitiativeToDefault: () => {
        set(state => ({
          character: {
            ...state.character,
            initiative: {
              value: calculateModifier(state.character.abilities.dexterity),
              isOverridden: false,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      // Reaction management actions
      toggleReaction: () => {
        set(state => ({
          character: {
            ...state.character,
            reaction: {
              hasUsedReaction: !state.character.reaction.hasUsedReaction,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      resetReaction: () => {
        set(state => ({
          character: {
            ...state.character,
            reaction: {
              hasUsedReaction: false,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      // Class Features actions
      toggleJackOfAllTrades: () => {
        set(state => ({
          character: {
            ...state.character,
            jackOfAllTrades: !state.character.jackOfAllTrades,
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      // Heroic inspiration management actions
      updateHeroicInspiration: updates => {
        set(state => ({
          character: {
            ...state.character,
            heroicInspiration: {
              ...state.character.heroicInspiration,
              ...updates,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      addHeroicInspiration: (amount = 1) => {
        set(state => {
          const current = state.character.heroicInspiration.count;
          const max = state.character.heroicInspiration.maxCount;
          const newCount = max
            ? Math.min(current + amount, max)
            : current + amount;

          return {
            character: {
              ...state.character,
              heroicInspiration: {
                ...state.character.heroicInspiration,
                count: Math.max(0, newCount),
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      useHeroicInspiration: () => {
        set(state => ({
          character: {
            ...state.character,
            heroicInspiration: {
              ...state.character.heroicInspiration,
              count: Math.max(0, state.character.heroicInspiration.count - 1),
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      resetHeroicInspiration: () => {
        set(state => ({
          character: {
            ...state.character,
            heroicInspiration: {
              ...state.character.heroicInspiration,
              count: 0,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      // Armor Class management
      updateTempArmorClass: tempAC => {
        set(state => ({
          character: {
            ...state.character,
            tempArmorClass: tempAC,
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      toggleShield: () => {
        set(state => ({
          character: {
            ...state.character,
            isWearingShield: !state.character.isWearingShield,
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      resetTempArmorClass: () => {
        set(state => ({
          character: {
            ...state.character,
            tempArmorClass: 0,
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      updateShieldBonus: bonus => {
        set(state => ({
          character: {
            ...state.character,
            shieldBonus: bonus,
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      // HP management actions
      applyDamageToCharacter: damage => {
        set(state => ({
          character: {
            ...state.character,
            hitPoints: applyDamage(state.character.hitPoints, damage),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      applyHealingToCharacter: healing => {
        set(state => ({
          character: {
            ...state.character,
            hitPoints: applyHealing(state.character.hitPoints, healing),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      addTemporaryHPToCharacter: tempHP => {
        set(state => ({
          character: {
            ...state.character,
            hitPoints: addTemporaryHP(state.character.hitPoints, tempHP),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      makeDeathSavingThrow: (isSuccess, isCritical = false) => {
        set(state => ({
          character: {
            ...state.character,
            hitPoints: makeDeathSave(
              state.character.hitPoints,
              isSuccess,
              isCritical
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      resetDeathSavingThrows: () => {
        set(state => ({
          character: {
            ...state.character,
            hitPoints: resetDeathSaves(state.character.hitPoints),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      toggleHPCalculationMode: () => {
        set(state => {
          const newMode =
            state.character.hitPoints.calculationMode === 'auto'
              ? 'manual'
              : 'auto';
          let newMaxHP = state.character.hitPoints.max;

          // If switching to auto mode, recalculate max HP
          if (newMode === 'auto') {
            const hitDie = getClassHitDie(
              state.character.class.name,
              state.character.class.hitDie
            );
            newMaxHP = calculateMaxHP(
              { ...state.character.class, hitDie },
              state.character.level,
              state.character.abilities.constitution
            );
          }

          return {
            character: {
              ...state.character,
              hitPoints: {
                ...state.character.hitPoints,
                calculationMode: newMode,
                max: newMaxHP,
                manualMaxOverride:
                  newMode === 'manual'
                    ? state.character.hitPoints.max
                    : undefined,
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      recalculateMaxHP: () => {
        set(state => {
          if (state.character.hitPoints.calculationMode === 'manual') {
            return state; // Don't recalculate in manual mode
          }

          const hitDie = getClassHitDie(
            state.character.class.name,
            state.character.class.hitDie
          );
          const newMaxHP = calculateMaxHP(
            { ...state.character.class, hitDie },
            state.character.level,
            state.character.abilities.constitution
          );

          return {
            character: {
              ...state.character,
              hitPoints: {
                ...state.character.hitPoints,
                max: newMaxHP,
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      // Class and spell management
      updateClass: classInfo => {
        set(state => {
          const newSpellSlots = calculateSpellSlots(
            classInfo,
            state.character.level
          );
          const preservedSpellSlots = updateSpellSlotsPreservingUsed(
            newSpellSlots,
            state.character.spellSlots
          );

          let pactMagic: PactMagic | undefined = undefined;
          if (classInfo.spellcaster === 'warlock') {
            pactMagic = calculatePactMagic(state.character.level);
            // Preserve existing pact magic used slots if possible
            if (state.character.pactMagic && pactMagic) {
              pactMagic.slots.used = Math.min(
                state.character.pactMagic.slots.used,
                pactMagic.slots.max
              );
            }
          }

          return {
            character: {
              ...state.character,
              class: classInfo,
              spellSlots: preservedSpellSlots,
              pactMagic,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateLevel: level => {
        set(state => {
          const clampedLevel = Math.max(1, Math.min(20, level));
          const newSpellSlots = calculateSpellSlots(
            state.character.class,
            clampedLevel
          );
          const preservedSpellSlots = updateSpellSlotsPreservingUsed(
            newSpellSlots,
            state.character.spellSlots
          );

          let pactMagic: PactMagic | undefined = state.character.pactMagic;
          if (state.character.class.spellcaster === 'warlock') {
            pactMagic = calculatePactMagic(clampedLevel);
            // Preserve existing pact magic used slots if possible
            if (state.character.pactMagic && pactMagic) {
              pactMagic.slots.used = Math.min(
                state.character.pactMagic.slots.used,
                pactMagic.slots.max
              );
            }
          }

          return {
            character: {
              ...state.character,
              level: clampedLevel,
              spellSlots: preservedSpellSlots,
              pactMagic,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateSpellSlot: (level, used) => {
        set(state => ({
          character: {
            ...state.character,
            spellSlots: {
              ...state.character.spellSlots,
              [level]: {
                ...state.character.spellSlots[level],
                used: Math.max(
                  0,
                  Math.min(used, state.character.spellSlots[level].max)
                ),
              },
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      updatePactMagicSlot: used => {
        set(state => {
          if (!state.character.pactMagic) return state;

          return {
            character: {
              ...state.character,
              pactMagic: {
                ...state.character.pactMagic,
                slots: {
                  ...state.character.pactMagic.slots,
                  used: Math.max(
                    0,
                    Math.min(used, state.character.pactMagic.slots.max)
                  ),
                },
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      resetSpellSlots: () => {
        set(state => {
          const resetSlots: SpellSlots = {
            1: { ...state.character.spellSlots[1], used: 0 },
            2: { ...state.character.spellSlots[2], used: 0 },
            3: { ...state.character.spellSlots[3], used: 0 },
            4: { ...state.character.spellSlots[4], used: 0 },
            5: { ...state.character.spellSlots[5], used: 0 },
            6: { ...state.character.spellSlots[6], used: 0 },
            7: { ...state.character.spellSlots[7], used: 0 },
            8: { ...state.character.spellSlots[8], used: 0 },
            9: { ...state.character.spellSlots[9], used: 0 },
          };

          return {
            character: {
              ...state.character,
              spellSlots: resetSlots,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      resetPactMagicSlots: () => {
        set(state => {
          if (!state.character.pactMagic) return state;

          return {
            character: {
              ...state.character,
              pactMagic: {
                ...state.character.pactMagic,
                slots: {
                  ...state.character.pactMagic.slots,
                  used: 0,
                },
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      // Concentration management
      startConcentration: (spellName, spellId, castAt) => {
        set(state => ({
          character: {
            ...state.character,
            concentration: {
              isConcentrating: true,
              spellName,
              spellId,
              castAt,
              startedAt: new Date().toISOString(),
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      stopConcentration: () => {
        set(state => ({
          character: {
            ...state.character,
            concentration: {
              isConcentrating: false,
              spellName: undefined,
              spellId: undefined,
              castAt: undefined,
              startedAt: undefined,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      isConcentratingOn: spellName => {
        const state = get();
        return (
          state.character.concentration.isConcentrating &&
          state.character.concentration.spellName === spellName
        );
      },

      // Conditions and diseases management
      addCondition: (conditionName, source, description, count = 1, notes) => {
        set(state => {
          const newCondition: ActiveCondition = {
            id: `${conditionName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
            name: conditionName,
            source,
            description,
            stackable: conditionName.toLowerCase() === 'exhaustion',
            count,
            appliedAt: new Date().toISOString(),
            notes,
          };

          return {
            character: {
              ...state.character,
              conditionsAndDiseases: {
                ...state.character.conditionsAndDiseases,
                activeConditions: [
                  ...state.character.conditionsAndDiseases.activeConditions,
                  newCondition,
                ],
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateCondition: (conditionId, updates) => {
        set(state => {
          const updatedConditions =
            state.character.conditionsAndDiseases.activeConditions.map(
              condition =>
                condition.id === conditionId
                  ? { ...condition, ...updates }
                  : condition
            );

          return {
            character: {
              ...state.character,
              conditionsAndDiseases: {
                ...state.character.conditionsAndDiseases,
                activeConditions: updatedConditions,
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      removeCondition: conditionId => {
        set(state => {
          const filteredConditions =
            state.character.conditionsAndDiseases.activeConditions.filter(
              condition => condition.id !== conditionId
            );

          return {
            character: {
              ...state.character,
              conditionsAndDiseases: {
                ...state.character.conditionsAndDiseases,
                activeConditions: filteredConditions,
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      addDisease: (diseaseName, source, description, onsetTime, notes) => {
        set(state => {
          const newDisease: ActiveDisease = {
            id: `${diseaseName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
            name: diseaseName,
            source,
            description,
            onsetTime,
            appliedAt: new Date().toISOString(),
            notes,
          };

          return {
            character: {
              ...state.character,
              conditionsAndDiseases: {
                ...state.character.conditionsAndDiseases,
                activeDiseases: [
                  ...state.character.conditionsAndDiseases.activeDiseases,
                  newDisease,
                ],
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateDisease: (diseaseId, updates) => {
        set(state => {
          const updatedDiseases =
            state.character.conditionsAndDiseases.activeDiseases.map(disease =>
              disease.id === diseaseId ? { ...disease, ...updates } : disease
            );

          return {
            character: {
              ...state.character,
              conditionsAndDiseases: {
                ...state.character.conditionsAndDiseases,
                activeDiseases: updatedDiseases,
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      removeDisease: diseaseId => {
        set(state => {
          const filteredDiseases =
            state.character.conditionsAndDiseases.activeDiseases.filter(
              disease => disease.id !== diseaseId
            );

          return {
            character: {
              ...state.character,
              conditionsAndDiseases: {
                ...state.character.conditionsAndDiseases,
                activeDiseases: filteredDiseases,
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      setExhaustionVariant: variant => {
        set(state => ({
          character: {
            ...state.character,
            conditionsAndDiseases: {
              ...state.character.conditionsAndDiseases,
              exhaustionVariant: variant,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      clearAllConditions: () => {
        set(state => ({
          character: {
            ...state.character,
            conditionsAndDiseases: {
              ...state.character.conditionsAndDiseases,
              activeConditions: [],
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      clearAllDiseases: () => {
        set(state => ({
          character: {
            ...state.character,
            conditionsAndDiseases: {
              ...state.character.conditionsAndDiseases,
              activeDiseases: [],
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      // XP management
      addExperience: xpToAdd => {
        set(state => {
          const newXP = state.character.experience + xpToAdd;
          const newLevel = calculateLevelFromXP(newXP);
          const newSpellSlots = calculateSpellSlots(
            state.character.class,
            newLevel
          );
          const preservedSpellSlots = updateSpellSlotsPreservingUsed(
            newSpellSlots,
            state.character.spellSlots
          );

          let pactMagic: PactMagic | undefined = state.character.pactMagic;
          if (state.character.class.spellcaster === 'warlock') {
            pactMagic = calculatePactMagic(newLevel);
            // Preserve existing pact magic used slots if possible
            if (state.character.pactMagic && pactMagic) {
              pactMagic.slots.used = Math.min(
                state.character.pactMagic.slots.used,
                pactMagic.slots.max
              );
            }
          }

          return {
            character: {
              ...state.character,
              experience: newXP,
              level: newLevel,
              spellSlots: preservedSpellSlots,
              pactMagic,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      setExperience: newXP => {
        set(state => {
          const newLevel = calculateLevelFromXP(newXP);
          const newSpellSlots = calculateSpellSlots(
            state.character.class,
            newLevel
          );
          const preservedSpellSlots = updateSpellSlotsPreservingUsed(
            newSpellSlots,
            state.character.spellSlots
          );

          let pactMagic: PactMagic | undefined = state.character.pactMagic;
          if (state.character.class.spellcaster === 'warlock') {
            pactMagic = calculatePactMagic(newLevel);
            // Preserve existing pact magic used slots if possible
            if (state.character.pactMagic && pactMagic) {
              pactMagic.slots.used = Math.min(
                state.character.pactMagic.slots.used,
                pactMagic.slots.max
              );
            }
          }

          return {
            character: {
              ...state.character,
              experience: newXP,
              level: newLevel,
              spellSlots: preservedSpellSlots,
              pactMagic,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      // Rich text content management
      addFeature: feature => {
        set(state => {
          const newFeature: RichTextContent = {
            ...feature,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              features: [...state.character.features, newFeature],
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateFeature: (id, updates) => {
        set(state => ({
          character: {
            ...state.character,
            features: state.character.features.map(feature =>
              feature.id === id
                ? {
                    ...feature,
                    ...updates,
                    updatedAt: new Date().toISOString(),
                  }
                : feature
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      deleteFeature: id => {
        set(state => ({
          character: {
            ...state.character,
            features: state.character.features.filter(
              feature => feature.id !== id
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      addTrait: trait => {
        set(state => {
          const newTrait: RichTextContent = {
            ...trait,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              traits: [...state.character.traits, newTrait],
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateTrait: (id, updates) => {
        set(state => ({
          character: {
            ...state.character,
            traits: state.character.traits.map(trait =>
              trait.id === id
                ? { ...trait, ...updates, updatedAt: new Date().toISOString() }
                : trait
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      deleteTrait: id => {
        set(state => ({
          character: {
            ...state.character,
            traits: state.character.traits.filter(trait => trait.id !== id),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      addNote: (
        note: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
      ) => {
        set(state => {
          const newNote: RichTextContent = {
            ...note,
            id: generateId(),
            order: state.character.notes.length, // Set order to the end
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              notes: [...state.character.notes, newNote],
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateNote: (id: string, updates: Partial<RichTextContent>) => {
        set(state => ({
          character: {
            ...state.character,
            notes: state.character.notes.map(note =>
              note.id === id
                ? { ...note, ...updates, updatedAt: new Date().toISOString() }
                : note
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      deleteNote: (id: string) => {
        set(state => ({
          character: {
            ...state.character,
            notes: state.character.notes.filter(note => note.id !== id),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      reorderNotes: (sourceIndex: number, destinationIndex: number) => {
        set(state => {
          const notes = [...state.character.notes];
          const [removed] = notes.splice(sourceIndex, 1);
          notes.splice(destinationIndex, 0, removed);

          // Update order property
          const updatedNotes = notes.map((note, index) => ({
            ...note,
            order: index,
            updatedAt: new Date().toISOString(),
          }));

          return {
            character: {
              ...state.character,
              notes: updatedNotes,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      // Trackable trait management
      addTrackableTrait: trait => {
        set(state => {
          const newTrait: TrackableTrait = {
            ...trait,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              trackableTraits: [
                ...(state.character.trackableTraits || []),
                newTrait,
              ],
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateTrackableTrait: (id, updates) => {
        set(state => ({
          character: {
            ...state.character,
            trackableTraits: (state.character.trackableTraits || []).map(
              trait =>
                trait.id === id
                  ? {
                      ...trait,
                      ...updates,
                      updatedAt: new Date().toISOString(),
                    }
                  : trait
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      deleteTrackableTrait: id => {
        set(state => ({
          character: {
            ...state.character,
            trackableTraits: (state.character.trackableTraits || []).filter(
              trait => trait.id !== id
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      useTrackableTrait: id => {
        set(state => ({
          character: {
            ...state.character,
            trackableTraits: (state.character.trackableTraits || []).map(
              trait =>
                trait.id === id
                  ? {
                      ...trait,
                      usedUses: Math.min(
                        trait.usedUses + 1,
                        calculateTraitMaxUses(trait, state.character.level)
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : trait
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      resetTrackableTraits: restType => {
        set(state => ({
          character: {
            ...state.character,
            trackableTraits: (state.character.trackableTraits || []).map(
              trait =>
                trait.restType === restType || restType === 'long'
                  ? {
                      ...trait,
                      usedUses: 0,
                      updatedAt: new Date().toISOString(),
                    }
                  : trait
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      // Extended feature management actions
      addExtendedFeature: feature => {
        set(state => {
          const newFeature: ExtendedFeature = {
            ...feature,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              extendedFeatures: [
                ...(state.character.extendedFeatures || []),
                newFeature,
              ],
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateExtendedFeature: (id, updates) => {
        set(state => ({
          character: {
            ...state.character,
            extendedFeatures: (state.character.extendedFeatures || []).map(
              feature =>
                feature.id === id
                  ? {
                      ...feature,
                      ...updates,
                      updatedAt: new Date().toISOString(),
                    }
                  : feature
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      deleteExtendedFeature: id => {
        set(state => ({
          character: {
            ...state.character,
            extendedFeatures: (state.character.extendedFeatures || []).filter(
              feature => feature.id !== id
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      useExtendedFeature: id => {
        set(state => ({
          character: {
            ...state.character,
            extendedFeatures: (state.character.extendedFeatures || []).map(
              feature =>
                feature.id === id
                  ? {
                      ...feature,
                      usedUses: Math.min(
                        feature.usedUses + 1,
                        calculateTraitMaxUses(feature, state.character.level)
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : feature
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      resetExtendedFeatures: restType => {
        set(state => ({
          character: {
            ...state.character,
            extendedFeatures: (state.character.extendedFeatures || []).map(
              feature =>
                feature.restType === restType || restType === 'long'
                  ? {
                      ...feature,
                      usedUses: 0,
                      updatedAt: new Date().toISOString(),
                    }
                  : feature
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      reorderExtendedFeatures: (sourceIndex, destinationIndex, sourceType) => {
        set(state => {
          const features = [...(state.character.extendedFeatures || [])];
          
          if (sourceType) {
            // Reorder within a specific source type
            const filteredFeatures = features.filter(f => f.sourceType === sourceType);
            const otherFeatures = features.filter(f => f.sourceType !== sourceType);
            
            if (sourceIndex >= filteredFeatures.length || destinationIndex >= filteredFeatures.length) {
              return state;
            }
            
            const [movedFeature] = filteredFeatures.splice(sourceIndex, 1);
            filteredFeatures.splice(destinationIndex, 0, movedFeature);
            
            // Update display orders
            filteredFeatures.forEach((feature, index) => {
              feature.displayOrder = index;
              feature.updatedAt = new Date().toISOString();
            });
            
            return {
              character: {
                ...state.character,
                extendedFeatures: [...otherFeatures, ...filteredFeatures],
              },
              hasUnsavedChanges: true,
              saveStatus: 'saving',
            };
          } else {
            // Reorder all features
            if (sourceIndex >= features.length || destinationIndex >= features.length) {
              return state;
            }
            
            const [movedFeature] = features.splice(sourceIndex, 1);
            features.splice(destinationIndex, 0, movedFeature);
            
            // Update display orders
            features.forEach((feature, index) => {
              feature.displayOrder = index;
              feature.updatedAt = new Date().toISOString();
            });
            
            return {
              character: {
                ...state.character,
                extendedFeatures: features,
              },
              hasUnsavedChanges: true,
              saveStatus: 'saving',
            };
          }
        });
      },

      migrateTraitsToExtendedFeatures: () => {
        set(state => {
          const existingTraits = state.character.trackableTraits || [];
          const existingExtended = state.character.extendedFeatures || [];
          
          // Only migrate if there are traits and no extended features yet
          if (existingTraits.length === 0 || existingExtended.length > 0) {
            return state;
          }
          
          const migratedFeatures: ExtendedFeature[] = existingTraits.map((trait, index) => ({
            ...trait,
            sourceType: 'other' as const,
            sourceDetail: trait.source || undefined,
            displayOrder: index,
            isPassive: trait.maxUses === 0,
          }));
          
          return {
            character: {
              ...state.character,
              extendedFeatures: migratedFeatures,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateCharacterBackground: updates => {
        set(state => ({
          character: {
            ...state.character,
            characterBackground: {
              ...state.character.characterBackground,
              ...updates,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving' as SaveStatus,
        }));
      },

      // Weapon management actions
      addWeapon: weapon => {
        set(state => {
          const newWeapon: Weapon = {
            ...weapon,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              weapons: [...state.character.weapons, newWeapon],
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateWeapon: (id, updates) => {
        set(state => ({
          character: {
            ...state.character,
            weapons: state.character.weapons.map(weapon =>
              weapon.id === id
                ? { ...weapon, ...updates, updatedAt: new Date().toISOString() }
                : weapon
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      deleteWeapon: id => {
        set(state => ({
          character: {
            ...state.character,
            weapons: state.character.weapons.filter(weapon => weapon.id !== id),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      equipWeapon: (id, equipped) => {
        set(state => ({
          character: {
            ...state.character,
            weapons: state.character.weapons.map(weapon =>
              weapon.id === id
                ? {
                    ...weapon,
                    isEquipped: equipped,
                    updatedAt: new Date().toISOString(),
                  }
                : weapon
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      reorderWeapons: (sourceIndex: number, destinationIndex: number) => {
        set(state => {
          const weapons = [...state.character.weapons];
          const [removed] = weapons.splice(sourceIndex, 1);
          weapons.splice(destinationIndex, 0, removed);

          // Update all weapons with new timestamps
          const updatedWeapons = weapons.map(weapon => ({
            ...weapon,
            updatedAt: new Date().toISOString(),
          }));

          return {
            character: {
              ...state.character,
              weapons: updatedWeapons,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      // Magic item management actions
      addMagicItem: item => {
        set(state => {
          const newItem: MagicItem = {
            ...item,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              magicItems: [...(state.character.magicItems || []), newItem],
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateMagicItem: (id, updates) => {
        set(state => ({
          character: {
            ...state.character,
            magicItems: (state.character.magicItems || []).map(item =>
              item.id === id
                ? { ...item, ...updates, updatedAt: new Date().toISOString() }
                : item
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      deleteMagicItem: id => {
        set(state => ({
          character: {
            ...state.character,
            magicItems: (state.character.magicItems || []).filter(
              item => item.id !== id
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      attuneMagicItem: (id, attuned) => {
        set(state => ({
          character: {
            ...state.character,
            magicItems: (state.character.magicItems || []).map(item =>
              item.id === id
                ? {
                    ...item,
                    isAttuned: attuned,
                    updatedAt: new Date().toISOString(),
                  }
                : item
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      updateAttunementSlots: max => {
        set(state => ({
          character: {
            ...state.character,
            attunementSlots: {
              ...state.character.attunementSlots,
              max,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      reorderMagicItems: (sourceIndex: number, destinationIndex: number) => {
        set(state => {
          const magicItems = [...(state.character.magicItems || [])];
          const [removed] = magicItems.splice(sourceIndex, 1);
          magicItems.splice(destinationIndex, 0, removed);

          // Update all magic items with new timestamps
          const updatedMagicItems = magicItems.map(item => ({
            ...item,
            updatedAt: new Date().toISOString(),
          }));

          return {
            character: {
              ...state.character,
              magicItems: updatedMagicItems,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      // Armor management
      addArmorItem: item => {
        set(state => {
          const newItem: ArmorItem = {
            ...item,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              armorItems: [...(state.character.armorItems || []), newItem],
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateArmorItem: (id, updates) => {
        set(state => ({
          character: {
            ...state.character,
            armorItems: state.character.armorItems.map(item =>
              item.id === id
                ? { ...item, ...updates, updatedAt: new Date().toISOString() }
                : item
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      deleteArmorItem: id => {
        set(state => ({
          character: {
            ...state.character,
            armorItems: state.character.armorItems.filter(
              item => item.id !== id
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      equipArmorItem: (id, equipped) => {
        set(state => ({
          character: {
            ...state.character,
            armorItems: state.character.armorItems.map(item =>
              item.id === id
                ? {
                    ...item,
                    isEquipped: equipped,
                    updatedAt: new Date().toISOString(),
                  }
                : item
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      reorderArmorItems: (sourceIndex: number, destinationIndex: number) => {
        set(state => {
          const armorItems = [...state.character.armorItems];
          const [removed] = armorItems.splice(sourceIndex, 1);
          armorItems.splice(destinationIndex, 0, removed);

          // Update all armor items with new timestamps
          const updatedArmorItems = armorItems.map(item => ({
            ...item,
            updatedAt: new Date().toISOString(),
          }));

          return {
            character: {
              ...state.character,
              armorItems: updatedArmorItems,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      // Inventory management
      addInventoryItem: item => {
        set(state => {
          const newItem: InventoryItem = {
            ...item,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              inventoryItems: [
                ...(state.character.inventoryItems || []),
                newItem,
              ],
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      updateInventoryItem: (id, updates) => {
        set(state => ({
          character: {
            ...state.character,
            inventoryItems: state.character.inventoryItems.map(item =>
              item.id === id
                ? { ...item, ...updates, updatedAt: new Date().toISOString() }
                : item
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      deleteInventoryItem: id => {
        set(state => ({
          character: {
            ...state.character,
            inventoryItems: state.character.inventoryItems.filter(
              item => item.id !== id
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      updateItemQuantity: (id, quantity) => {
        set(state => ({
          character: {
            ...state.character,
            inventoryItems: state.character.inventoryItems.map(item =>
              item.id === id ? { ...item, quantity } : item
            ),
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      reorderInventoryItems: (
        sourceIndex: number,
        destinationIndex: number
      ) => {
        set(state => {
          const inventoryItems = [...state.character.inventoryItems];
          const [removed] = inventoryItems.splice(sourceIndex, 1);
          inventoryItems.splice(destinationIndex, 0, removed);

          // Update all inventory items with new timestamps
          const updatedInventoryItems = inventoryItems.map(item => ({
            ...item,
            updatedAt: new Date().toISOString(),
          }));

          return {
            character: {
              ...state.character,
              inventoryItems: updatedInventoryItems,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      // Currency management
      updateCurrency: updates => {
        set(state => ({
          character: {
            ...state.character,
            currency: {
              ...state.character.currency,
              ...updates,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      addCurrency: (type, amount) => {
        set(state => ({
          character: {
            ...state.character,
            currency: {
              ...state.character.currency,
              [type]: (state.character.currency[type] || 0) + amount,
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      subtractCurrency: (type, amount) => {
        set(state => ({
          character: {
            ...state.character,
            currency: {
              ...state.character.currency,
              [type]: Math.max(
                0,
                (state.character.currency[type] || 0) - amount
              ),
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      // Spellbook management
      addSpellToSpellbook: spellId => {
        set(state => {
          const isAlreadyKnown =
            state.character.spellbook.knownSpells.includes(spellId);
          if (!isAlreadyKnown) {
            return {
              character: {
                ...state.character,
                spellbook: {
                  ...state.character.spellbook,
                  knownSpells: [
                    ...state.character.spellbook.knownSpells,
                    spellId,
                  ],
                },
              },
              hasUnsavedChanges: true,
              saveStatus: 'saving',
            };
          }
          return state;
        });
      },

      removeSpellFromSpellbook: spellId => {
        set(state => ({
          character: {
            ...state.character,
            spellbook: {
              ...state.character.spellbook,
              knownSpells: state.character.spellbook.knownSpells.filter(
                id => id !== spellId
              ),
              preparedSpells: state.character.spellbook.preparedSpells.filter(
                id => id !== spellId
              ),
              favoriteSpells: state.character.spellbook.favoriteSpells.filter(
                id => id !== spellId
              ),
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      toggleSpellFavorite: spellId => {
        set(state => {
          const isFavorite =
            state.character.spellbook.favoriteSpells.includes(spellId);
          return {
            character: {
              ...state.character,
              spellbook: {
                ...state.character.spellbook,
                favoriteSpells: isFavorite
                  ? state.character.spellbook.favoriteSpells.filter(
                      id => id !== spellId
                    )
                  : [...state.character.spellbook.favoriteSpells, spellId],
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      prepareSpell: spellId => {
        set(state => {
          const isAlreadyPrepared =
            state.character.spellbook.preparedSpells.includes(spellId);
          if (!isAlreadyPrepared) {
            return {
              character: {
                ...state.character,
                spellbook: {
                  ...state.character.spellbook,
                  preparedSpells: [
                    ...state.character.spellbook.preparedSpells,
                    spellId,
                  ],
                },
              },
              hasUnsavedChanges: true,
              saveStatus: 'saving',
            };
          }
          return state;
        });
      },

      unprepareSpell: spellId => {
        set(state => ({
          character: {
            ...state.character,
            spellbook: {
              ...state.character.spellbook,
              preparedSpells: state.character.spellbook.preparedSpells.filter(
                id => id !== spellId
              ),
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      updateSpellbookSettings: settings => {
        set(state => ({
          character: {
            ...state.character,
            spellbook: {
              ...state.character.spellbook,
              spellbookSettings: {
                ...state.character.spellbook.spellbookSettings,
                ...settings,
              },
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      addCustomSpell: (spell: ProcessedSpell) => {
        set(state => ({
          character: {
            ...state.character,
            spellbook: {
              ...state.character.spellbook,
              customSpells: [
                ...(state.character.spellbook.customSpells || []),
                spell,
              ],
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      removeCustomSpell: spellId => {
        set(state => ({
          character: {
            ...state.character,
            spellbook: {
              ...state.character.spellbook,
              customSpells: (
                state.character.spellbook.customSpells || []
              ).filter(s => s.id !== spellId),
            },
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        }));
      },

      reorderPreparedSpells: (
        sourceIndex: number,
        destinationIndex: number
      ) => {
        set(state => {
          const preparedSpells = [...state.character.spellbook.preparedSpells];
          const [removed] = preparedSpells.splice(sourceIndex, 1);
          preparedSpells.splice(destinationIndex, 0, removed);

          return {
            character: {
              ...state.character,
              spellbook: {
                ...state.character.spellbook,
                preparedSpells,
              },
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      reorderSpells: (sourceIndex: number, destinationIndex: number) => {
        set(state => {
          const spells = [...state.character.spells];
          const [removed] = spells.splice(sourceIndex, 1);
          spells.splice(destinationIndex, 0, removed);

          return {
            character: {
              ...state.character,
              spells,
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving',
          };
        });
      },

      // Persistence actions
      saveCharacter: () => {
        try {
          // Save to localStorage (handled by persist middleware)
          set({
            saveStatus: 'saved',
            lastSaved: new Date(),
            hasUnsavedChanges: false,
          });
        } catch (error) {
          console.error('Failed to save character:', error);
          set({ saveStatus: 'error' });
        }
      },

      loadCharacter: character => {
        set({
          character,
          saveStatus: 'saved',
          lastSaved: new Date(),
          hasUnsavedChanges: false,
        });
      },

      resetCharacter: () => {
        set({
          character: {
            ...DEFAULT_CHARACTER_STATE,
            id: generateId(),
          },
          saveStatus: 'saved',
          lastSaved: new Date(),
          hasUnsavedChanges: false,
        });
      },

      exportCharacter: () => {
        const state = get();
        return {
          version: APP_VERSION,
          exportDate: new Date().toISOString(),
          character: state.character,
        };
      },

      importCharacter: exportData => {
        try {
          // Basic validation
          if (
            !exportData.character ||
            typeof exportData.character !== 'object'
          ) {
            throw new Error('Invalid character data');
          }

          // Version compatibility check (for future use)
          if (exportData.version && exportData.version !== APP_VERSION) {
            console.warn(
              `Version mismatch: expected ${APP_VERSION}, got ${exportData.version}`
            );
          }

          set({
            character: exportData.character,
            saveStatus: 'saved',
            lastSaved: new Date(),
            hasUnsavedChanges: false,
          });

          return true;
        } catch (error) {
          console.error('Failed to import character:', error);
          set({ saveStatus: 'error' });
          return false;
        }
      },

      // Auto-save control
      setSaveStatus: status => {
        set({ saveStatus: status });
      },

      markSaved: () => {
        set({
          saveStatus: 'saved',
          lastSaved: new Date(),
          hasUnsavedChanges: false,
        });
      },

      markUnsaved: () => {
        set({
          hasUnsavedChanges: true,
          saveStatus: 'saving',
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist the character data and save metadata
      partialize: state => ({
        character: state.character,
        lastSaved: state.lastSaved,
      }),
      // Handle rehydration and migration
      onRehydrateStorage: () => state => {
        if (state) {
          // Migrate character data if needed
          state.character = migrateCharacterData(state.character);
          state.saveStatus = 'saved';
          state.hasUnsavedChanges = false;
          state.hasHydrated = true;
        }
      },
    }
  )
);
