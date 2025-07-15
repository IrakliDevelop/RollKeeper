import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CharacterState, SaveStatus, CharacterExport, ClassInfo, SpellSlots, PactMagic, RichTextContent, CharacterBackground } from '@/types/character';
import { DEFAULT_CHARACTER_STATE, STORAGE_KEY, APP_VERSION, COMMON_CLASSES } from '@/utils/constants';
import { 
  calculateSpellSlots, 
  calculatePactMagic, 
  updateSpellSlotsPreservingUsed,
  calculateModifier,
  calculateLevelFromXP,
  shouldLevelUp 
} from '@/utils/calculations';

// Migration function to handle old character data
function migrateCharacterData(character: unknown): CharacterState {
  // Type guard to check if character is an object
  if (!character || typeof character !== 'object') {
    return DEFAULT_CHARACTER_STATE;
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
    // Ensure characterBackground exists
    if (!result.characterBackground || typeof result.characterBackground !== 'object' || !('backstory' in result.characterBackground)) {
      result.characterBackground = DEFAULT_CHARACTER_STATE.characterBackground;
    }
    return result;
  }

  // Migrate old character with string class to new format
  const migratedCharacter: CharacterState = {
    ...DEFAULT_CHARACTER_STATE,
    ...(characterObj as Partial<CharacterState>),
    class: {
      name: (characterObj.class && typeof characterObj.class === 'string') ? characterObj.class : '',
      isCustom: false,
      spellcaster: 'none' as const
    },
    spellSlots: DEFAULT_CHARACTER_STATE.spellSlots,
    pactMagic: undefined,
    features: Array.isArray(characterObj.features) ? characterObj.features : DEFAULT_CHARACTER_STATE.features,
    traits: Array.isArray(characterObj.traits) ? characterObj.traits : DEFAULT_CHARACTER_STATE.traits,
    characterBackground: (characterObj.characterBackground && 
      typeof characterObj.characterBackground === 'object' &&
      'backstory' in characterObj.characterBackground) 
      ? characterObj.characterBackground as CharacterState['characterBackground']
      : DEFAULT_CHARACTER_STATE.characterBackground
  };

  // Try to detect spellcaster type from class name
  if (characterObj.class && typeof characterObj.class === 'string') {
    const className = characterObj.class;
    const matchingClass = COMMON_CLASSES.find(c => 
      c.name.toLowerCase() === className.toLowerCase()
    );
    if (matchingClass) {
      migratedCharacter.class = {
        name: matchingClass.name,
        isCustom: false,
        spellcaster: matchingClass.spellcaster
      };
      
      // Calculate initial spell slots
      const level = (characterObj.level && typeof characterObj.level === 'number') ? characterObj.level : 1;
      migratedCharacter.spellSlots = calculateSpellSlots(migratedCharacter.class, level);
      
      // Add pact magic for warlocks
      if (matchingClass.spellcaster === 'warlock') {
        migratedCharacter.pactMagic = calculatePactMagic(level);
      }
          } else {
        // Unknown class, mark as custom
        migratedCharacter.class = {
          name: typeof characterObj.class === 'string' ? characterObj.class : '',
          isCustom: true,
          spellcaster: 'none'
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
  
  // Actions
  updateCharacter: (updates: Partial<CharacterState>) => void;
  updateAbilityScore: (ability: keyof CharacterState['abilities'], value: number) => void;
  updateSkillProficiency: (skill: keyof CharacterState['skills'], proficient: boolean) => void;
  updateSkillExpertise: (skill: keyof CharacterState['skills'], expertise: boolean) => void;
  updateSavingThrowProficiency: (ability: keyof CharacterState['savingThrows'], proficient: boolean) => void;
  updateHitPoints: (updates: Partial<CharacterState['hitPoints']>) => void;
  updateInitiative: (value: number, isOverride: boolean) => void;
  resetInitiativeToDefault: () => void;
  
  // Class and spell management
  updateClass: (classInfo: ClassInfo) => void;
  updateLevel: (level: number) => void;
  updateSpellSlot: (level: keyof SpellSlots, used: number) => void;
  updatePactMagicSlot: (used: number) => void;
  resetSpellSlots: () => void;
  resetPactMagicSlots: () => void;
  
  // XP management
  addExperience: (xpToAdd: number) => void;
  setExperience: (newXP: number) => void;

  // Rich text content management
  addFeature: (feature: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateFeature: (id: string, updates: Partial<RichTextContent>) => void;
  deleteFeature: (id: string) => void;
  addTrait: (trait: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTrait: (id: string, updates: Partial<RichTextContent>) => void;
  deleteTrait: (id: string) => void;
  updateCharacterBackground: (updates: Partial<CharacterBackground>) => void;
  
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
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set, get) => ({
      // Initial state
      character: DEFAULT_CHARACTER_STATE,
      saveStatus: 'saved',
      lastSaved: null,
      hasUnsavedChanges: false,

      // Character update actions
      updateCharacter: (updates) => {
        set((state) => ({
          character: { ...state.character, ...updates },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      updateAbilityScore: (ability, value) => {
        set((state) => {
          const newAbilities = {
            ...state.character.abilities,
            [ability]: Math.max(1, Math.min(30, value))
          };

          // Auto-update initiative if it's not overridden and dexterity changed
          let initiative = state.character.initiative;
          if (ability === 'dexterity' && !initiative.isOverridden) {
            initiative = {
              ...initiative,
              value: calculateModifier(newAbilities.dexterity)
            };
          }

          return {
            character: {
              ...state.character,
              abilities: newAbilities,
              initiative
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      updateSkillProficiency: (skill, proficient) => {
        set((state) => ({
          character: {
            ...state.character,
            skills: {
              ...state.character.skills,
              [skill]: {
                ...state.character.skills[skill],
                proficient
              }
            }
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      updateSkillExpertise: (skill, expertise) => {
        set((state) => ({
          character: {
            ...state.character,
            skills: {
              ...state.character.skills,
              [skill]: {
                ...state.character.skills[skill],
                expertise
              }
            }
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      updateSavingThrowProficiency: (ability, proficient) => {
        set((state) => ({
          character: {
            ...state.character,
            savingThrows: {
              ...state.character.savingThrows,
              [ability]: {
                ...state.character.savingThrows[ability],
                proficient
              }
            }
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      updateHitPoints: (updates) => {
        set((state) => ({
          character: {
            ...state.character,
            hitPoints: {
              ...state.character.hitPoints,
              ...updates
            }
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      updateInitiative: (value, isOverride) => {
        set((state) => ({
          character: {
            ...state.character,
            initiative: {
              value,
              isOverridden: isOverride
            }
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      resetInitiativeToDefault: () => {
        set((state) => ({
          character: {
            ...state.character,
            initiative: {
              value: calculateModifier(state.character.abilities.dexterity),
              isOverridden: false
            }
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      // Class and spell management
      updateClass: (classInfo) => {
        set((state) => {
          const newSpellSlots = calculateSpellSlots(classInfo, state.character.level);
          const preservedSpellSlots = updateSpellSlotsPreservingUsed(newSpellSlots, state.character.spellSlots);
          
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
              pactMagic
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      updateLevel: (level) => {
        set((state) => {
          const clampedLevel = Math.max(1, Math.min(20, level));
          const newSpellSlots = calculateSpellSlots(state.character.class, clampedLevel);
          const preservedSpellSlots = updateSpellSlotsPreservingUsed(newSpellSlots, state.character.spellSlots);
          
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
              pactMagic
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      updateSpellSlot: (level, used) => {
        set((state) => ({
          character: {
            ...state.character,
            spellSlots: {
              ...state.character.spellSlots,
              [level]: {
                ...state.character.spellSlots[level],
                used: Math.max(0, Math.min(used, state.character.spellSlots[level].max))
              }
            }
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      updatePactMagicSlot: (used) => {
        set((state) => {
          if (!state.character.pactMagic) return state;
          
          return {
            character: {
              ...state.character,
              pactMagic: {
                ...state.character.pactMagic,
                slots: {
                  ...state.character.pactMagic.slots,
                  used: Math.max(0, Math.min(used, state.character.pactMagic.slots.max))
                }
              }
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      resetSpellSlots: () => {
        set((state) => {
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
              spellSlots: resetSlots
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      resetPactMagicSlots: () => {
        set((state) => {
          if (!state.character.pactMagic) return state;
          
          return {
            character: {
              ...state.character,
              pactMagic: {
                ...state.character.pactMagic,
                slots: {
                  ...state.character.pactMagic.slots,
                  used: 0
                }
              }
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      // XP management
      addExperience: (xpToAdd) => {
        set((state) => {
          const newXP = state.character.experience + xpToAdd;
          const newLevel = calculateLevelFromXP(newXP);
          const newSpellSlots = calculateSpellSlots(state.character.class, newLevel);
          const preservedSpellSlots = updateSpellSlotsPreservingUsed(newSpellSlots, state.character.spellSlots);

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
              pactMagic
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      setExperience: (newXP) => {
        set((state) => {
          const newLevel = calculateLevelFromXP(newXP);
          const newSpellSlots = calculateSpellSlots(state.character.class, newLevel);
          const preservedSpellSlots = updateSpellSlotsPreservingUsed(newSpellSlots, state.character.spellSlots);

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
              pactMagic
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      // Rich text content management
      addFeature: (feature) => {
        set((state) => {
          const newFeature: RichTextContent = {
            ...feature,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              features: [...state.character.features, newFeature]
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      updateFeature: (id, updates) => {
        set((state) => ({
          character: {
            ...state.character,
            features: state.character.features.map(feature =>
              feature.id === id
                ? { ...feature, ...updates, updatedAt: new Date().toISOString() }
                : feature
            )
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      deleteFeature: (id) => {
        set((state) => ({
          character: {
            ...state.character,
            features: state.character.features.filter(feature => feature.id !== id)
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      addTrait: (trait) => {
        set((state) => {
          const newTrait: RichTextContent = {
            ...trait,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            character: {
              ...state.character,
              traits: [...state.character.traits, newTrait]
            },
            hasUnsavedChanges: true,
            saveStatus: 'saving'
          };
        });
      },

      updateTrait: (id, updates) => {
        set((state) => ({
          character: {
            ...state.character,
            traits: state.character.traits.map(trait =>
              trait.id === id
                ? { ...trait, ...updates, updatedAt: new Date().toISOString() }
                : trait
            )
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      deleteTrait: (id) => {
        set((state) => ({
          character: {
            ...state.character,
            traits: state.character.traits.filter(trait => trait.id !== id)
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      updateCharacterBackground: (updates) => {
        set((state) => ({
          character: {
            ...state.character,
            characterBackground: {
              ...state.character.characterBackground,
              ...updates
            }
          },
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        }));
      },

      // Persistence actions
      saveCharacter: () => {
        const state = get();
        try {
          // Save to localStorage (handled by persist middleware)
          set({
            saveStatus: 'saved',
            lastSaved: new Date(),
            hasUnsavedChanges: false
          });
        } catch (error) {
          console.error('Failed to save character:', error);
          set({ saveStatus: 'error' });
        }
      },

      loadCharacter: (character) => {
        set({
          character,
          saveStatus: 'saved',
          lastSaved: new Date(),
          hasUnsavedChanges: false
        });
      },

      resetCharacter: () => {
        set({
          character: DEFAULT_CHARACTER_STATE,
          saveStatus: 'saved',
          lastSaved: new Date(),
          hasUnsavedChanges: false
        });
      },

      exportCharacter: () => {
        const state = get();
        return {
          version: APP_VERSION,
          exportDate: new Date().toISOString(),
          character: state.character
        };
      },

      importCharacter: (exportData) => {
        try {
          // Basic validation
          if (!exportData.character || typeof exportData.character !== 'object') {
            throw new Error('Invalid character data');
          }

          // Version compatibility check (for future use)
          if (exportData.version && exportData.version !== APP_VERSION) {
            console.warn(`Version mismatch: expected ${APP_VERSION}, got ${exportData.version}`);
          }

          set({
            character: exportData.character,
            saveStatus: 'saved',
            lastSaved: new Date(),
            hasUnsavedChanges: false
          });

          return true;
        } catch (error) {
          console.error('Failed to import character:', error);
          set({ saveStatus: 'error' });
          return false;
        }
      },

      // Auto-save control
      setSaveStatus: (status) => {
        set({ saveStatus: status });
      },

      markSaved: () => {
        set({
          saveStatus: 'saved',
          lastSaved: new Date(),
          hasUnsavedChanges: false
        });
      },

      markUnsaved: () => {
        set({
          hasUnsavedChanges: true,
          saveStatus: 'saving'
        });
      }
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist the character data and save metadata
      partialize: (state) => ({
        character: state.character,
        lastSaved: state.lastSaved
      }),
      // Handle rehydration and migration
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Migrate character data if needed
          state.character = migrateCharacterData(state.character);
          state.saveStatus = 'saved';
          state.hasUnsavedChanges = false;
        }
      }
    }
  )
); 