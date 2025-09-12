import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CharacterState, CharacterExport } from '@/types/character';
import { DEFAULT_CHARACTER_STATE, STORAGE_KEY } from '@/utils/constants';

// Storage configuration
const PLAYER_STORAGE_KEY = 'rollkeeper-player-data';

// Player character interface - contains full CharacterState
export interface PlayerCharacter {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  createdAt: Date;
  updatedAt: Date;
  lastPlayed: Date;
  characterData: CharacterState;
  thumbnail?: string; // Future: character portrait
  tags: string[];
  isArchived: boolean;
}

// Store state interface
interface PlayerStoreState {
  // Core data
  characters: PlayerCharacter[];
  activeCharacterId: string | null;

  // UI state
  lastSelectedCharacterId: string | null;

  // Computed getters
  getActiveCharacter: () => PlayerCharacter | null;
  getCharacterById: (id: string) => PlayerCharacter | null;
  getActiveCharacters: () => PlayerCharacter[];
  getArchivedCharacters: () => PlayerCharacter[];

  // Character management
  createCharacter: (
    name: string,
    characterData?: Partial<CharacterState>
  ) => string;
  updateCharacter: (
    characterId: string,
    updates: Partial<PlayerCharacter>
  ) => void;
  updateCharacterData: (
    characterId: string,
    characterData: CharacterState
  ) => void;
  deleteCharacter: (characterId: string) => void;
  archiveCharacter: (characterId: string) => void;
  restoreCharacter: (characterId: string) => void;
  duplicateCharacter: (characterId: string, newName: string) => string;

  // Character selection
  setActiveCharacter: (characterId: string | null) => void;

  // Migration and utility
  migrateFromOldStorage: () => boolean;
  exportCharacter: (characterId: string) => PlayerCharacter | null;
  importCharacter: (
    data: CharacterState | CharacterExport,
    name?: string
  ) => string;

  // Reset and cleanup
  resetStore: () => void;
}

// Utility functions
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const createPlayerCharacter = (
  name: string,
  characterData: CharacterState
): PlayerCharacter => {
  const now = new Date();
  const playerId = generateId();
  
  // Ensure characterData has the same ID as the PlayerCharacter
  const characterDataWithId: CharacterState = {
    ...characterData,
    id: playerId,
  };
  
  return {
    id: playerId,
    name,
    race: characterData.race || 'Human',
    class: characterData.class?.name || 'Fighter',
    level: characterData.level || 1,
    createdAt: now,
    updatedAt: now,
    lastPlayed: now,
    characterData: characterDataWithId,
    tags: [],
    isArchived: false,
  };
};

// Migration function
const migrateOldCharacterData = (): PlayerCharacter | null => {
  try {
    // Check for old character data
    const oldCharacterData = localStorage.getItem(STORAGE_KEY);
    console.log('Checking for old character data with key:', STORAGE_KEY);
    console.log('Found old character data:', oldCharacterData ? 'YES' : 'NO');

    if (!oldCharacterData) {
      // Also check for any other rollkeeper keys
      const allKeys = Object.keys(localStorage);
      const rollkeeperKeys = allKeys.filter(key => key.includes('rollkeeper'));
      console.log('All rollkeeper keys in localStorage:', rollkeeperKeys);
      return null;
    }

    const parsedData = JSON.parse(oldCharacterData);
    console.log(
      'Parsed old character data structure:',
      Object.keys(parsedData)
    );

    // Handle different data structures
    let characterState: CharacterState;

    if (parsedData.state) {
      // Zustand persist format
      characterState = parsedData.state as CharacterState;
      console.log('Using Zustand persist format');
    } else if (parsedData.character) {
      // Direct character format
      characterState = parsedData.character as CharacterState;
      console.log('Using direct character format');
    } else if (
      parsedData.characterName ||
      parsedData.race ||
      parsedData.classInfo
    ) {
      // Direct character state
      characterState = parsedData as CharacterState;
      console.log('Using direct character state format');
    } else {
      console.log('Unrecognized old character data format');
      return null;
    }

    // Create new character from old data
    const characterName = characterState.name || 'Migrated Character';
    const playerCharacter = createPlayerCharacter(
      characterName,
      characterState
    );

    // Mark as migrated
    playerCharacter.tags = ['migrated'];

    console.log('Successfully migrated character:', characterName);
    return playerCharacter;
  } catch (error) {
    console.error('Failed to migrate old character data:', error);
    console.error('Error details:', error);
    return null;
  }
};

// Store implementation
export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      characters: [],
      activeCharacterId: null,
      lastSelectedCharacterId: null,

      // Computed getters
      getActiveCharacter: () => {
        const { characters, activeCharacterId } = get();
        return activeCharacterId
          ? characters.find(c => c.id === activeCharacterId) || null
          : null;
      },

      getCharacterById: (id: string) => {
        const character = get().characters.find(c => c.id === id) || null;
        
        // Ensure characterData has the correct ID (migration for existing characters)
        if (character && !character.characterData.id) {
          character.characterData.id = character.id;
        }
        
        return character;
      },

      getActiveCharacters: () => {
        return get().characters.filter(c => !c.isArchived);
      },

      getArchivedCharacters: () => {
        return get().characters.filter(c => c.isArchived);
      },

      // Character management
      createCharacter: (name, partialCharacterData = {}) => {
        const characterData: CharacterState = {
          ...DEFAULT_CHARACTER_STATE,
          ...partialCharacterData,
          name: name,
          id: generateId(),
        };

        const playerCharacter = createPlayerCharacter(name, characterData);

        set(state => ({
          characters: [...state.characters, playerCharacter],
          activeCharacterId: playerCharacter.id,
          lastSelectedCharacterId: playerCharacter.id,
        }));

        return playerCharacter.id;
      },

      updateCharacter: (characterId, updates) => {
        set(state => ({
          characters: state.characters.map(char =>
            char.id === characterId
              ? {
                  ...char,
                  ...updates,
                  updatedAt: new Date(),
                  lastPlayed:
                    char.id === state.activeCharacterId
                      ? new Date()
                      : char.lastPlayed,
                }
              : char
          ),
        }));
      },

      updateCharacterData: (characterId, characterData) => {
        set(state => ({
          characters: state.characters.map(char =>
            char.id === characterId
              ? {
                  ...char,
                  characterData,
                  name: characterData.name || char.name,
                  race: characterData.race || char.race,
                  class: characterData.class?.name || char.class,
                  level: characterData.totalLevel || characterData.level || char.level,
                  updatedAt: new Date(),
                  lastPlayed: new Date(),
                }
              : char
          ),
        }));
      },

      deleteCharacter: characterId => {
        set(state => ({
          characters: state.characters.filter(c => c.id !== characterId),
          activeCharacterId:
            state.activeCharacterId === characterId
              ? null
              : state.activeCharacterId,
          lastSelectedCharacterId:
            state.lastSelectedCharacterId === characterId
              ? null
              : state.lastSelectedCharacterId,
        }));
      },

      archiveCharacter: characterId => {
        set(state => ({
          characters: state.characters.map(char =>
            char.id === characterId
              ? { ...char, isArchived: true, updatedAt: new Date() }
              : char
          ),
          activeCharacterId:
            state.activeCharacterId === characterId
              ? null
              : state.activeCharacterId,
        }));
      },

      restoreCharacter: characterId => {
        set(state => ({
          characters: state.characters.map(char =>
            char.id === characterId
              ? { ...char, isArchived: false, updatedAt: new Date() }
              : char
          ),
        }));
      },

      duplicateCharacter: (characterId, newName) => {
        const originalCharacter = get().getCharacterById(characterId);
        if (!originalCharacter) return '';

        const duplicatedCharacterData = {
          ...originalCharacter.characterData,
          id: generateId(),
          name: newName,
        };

        const newPlayerCharacter = createPlayerCharacter(
          newName,
          duplicatedCharacterData
        );
        newPlayerCharacter.tags = [...originalCharacter.tags, 'duplicate'];

        set(state => ({
          characters: [...state.characters, newPlayerCharacter],
        }));

        return newPlayerCharacter.id;
      },

      // Character selection
      setActiveCharacter: characterId => {
        // Update last played time when setting active
        if (characterId) {
          get().updateCharacter(characterId, { lastPlayed: new Date() });
        }

        set({
          activeCharacterId: characterId,
          lastSelectedCharacterId: characterId || get().lastSelectedCharacterId,
        });
      },

      // Migration and utility
      migrateFromOldStorage: () => {
        const migratedCharacter = migrateOldCharacterData();
        if (!migratedCharacter) return false;

        set(state => ({
          characters: [...state.characters, migratedCharacter],
          activeCharacterId: migratedCharacter.id,
          lastSelectedCharacterId: migratedCharacter.id,
        }));

        // Clean up old storage after successful migration
        try {
          localStorage.removeItem(STORAGE_KEY);
          console.log('Cleaned up old character storage');
        } catch (error) {
          console.warn('Failed to clean up old storage:', error);
        }

        return true;
      },

      exportCharacter: characterId => {
        return get().getCharacterById(characterId);
      },

      importCharacter: (data, name) => {
        let characterState: CharacterState;
        let playerCharacter: PlayerCharacter | undefined;

        // Determine if it's CharacterExport or CharacterState
        if ('character' in data && 'version' in data) {
          // It's a CharacterExport
          characterState = data.character;
        } else if ('characterData' in data) {
          // It's already a PlayerCharacter - extract characterData and rebuild
          const existingPC = data as unknown as PlayerCharacter;
          const characterName = name || existingPC.name || 'Imported Character';
          playerCharacter = createPlayerCharacter(
            characterName,
            existingPC.characterData
          );
          playerCharacter.tags = existingPC.tags || ['imported'];
          playerCharacter.isArchived = existingPC.isArchived || false;
        } else {
          // It's raw CharacterState
          characterState = data as CharacterState;
        }

        // Create PlayerCharacter from CharacterState if needed
        if (!playerCharacter) {
          const characterName =
            name || characterState!.name || 'Imported Character';
          playerCharacter = createPlayerCharacter(
            characterName,
            characterState!
          );
          playerCharacter.tags = ['imported'];
        }

        set(state => ({
          characters: [...state.characters, playerCharacter],
        }));

        return playerCharacter.id;
      },

      resetStore: () => {
        set({
          characters: [],
          activeCharacterId: null,
          lastSelectedCharacterId: null,
        });
      },
    }),
    {
      name: PLAYER_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Migration function for future versions
      migrate: (persistedState: unknown) => {
        // Handle data migrations here when we update the schema
        return persistedState;
      },
      onRehydrateStorage: () => {
        return (state: PlayerStoreState | undefined) => {
          // Auto-migrate on store initialization if needed
          if (state && state.characters.length === 0) {
            const migrated = state.migrateFromOldStorage();
            if (migrated) {
              console.log(
                'Auto-migrated character from old storage on initialization'
              );
            }
          }
        };
      },
    }
  )
);

export default usePlayerStore;
