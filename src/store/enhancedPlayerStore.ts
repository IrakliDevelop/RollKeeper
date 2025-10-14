import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CharacterState, CharacterExport } from '@/types/character';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import { generateCharacterId } from '@/utils/uuid';

// Storage configuration
const PLAYER_STORAGE_KEY = 'rollkeeper-player-data';

// Enhanced player character interface with backend sync
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
  thumbnail?: string;
  tags: string[];
  isArchived: boolean;
  
  // Backend sync fields
  backendId?: string; // ID in the backend database
  campaignId?: string; // Associated campaign
  syncStatus: 'local' | 'synced' | 'pending' | 'conflict' | 'error';
  lastSynced?: Date;
  isPublic?: boolean;
}

// Sync configuration
interface SyncConfig {
  autoSync: boolean;
  syncInterval: number; // minutes
  conflictResolution: 'local' | 'remote' | 'manual';
}

// Store state interface
interface PlayerStoreState {
  // Core data
  characters: PlayerCharacter[];
  activeCharacterId: string | null;
  
  // Sync state
  syncConfig: SyncConfig;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncAttempt: Date | null;
  
  // UI state
  lastSelectedCharacterId: string | null;

  // Computed getters
  getActiveCharacter: () => PlayerCharacter | null;
  getCharacterById: (id: string) => PlayerCharacter | null;
  getActiveCharacters: () => PlayerCharacter[];
  getArchivedCharacters: () => PlayerCharacter[];
  getSyncedCharacters: () => PlayerCharacter[];
  getLocalOnlyCharacters: () => PlayerCharacter[];
  getPendingSyncCharacters: () => PlayerCharacter[];

  // Character management
  createCharacter: (
    name: string,
    characterData?: Partial<CharacterState>,
    campaignId?: string
  ) => Promise<string>;
  updateCharacter: (
    characterId: string,
    updates: Partial<PlayerCharacter>
  ) => Promise<void>;
  updateCharacterData: (
    characterId: string,
    updates: Partial<CharacterState>
  ) => Promise<void>;
  duplicateCharacter: (characterId: string, newName: string) => Promise<string>;
  deleteCharacter: (characterId: string) => Promise<void>;
  archiveCharacter: (characterId: string) => Promise<void>;
  restoreCharacter: (characterId: string) => Promise<void>;

  // Backend sync operations
  syncCharacter: (characterId: string, force?: boolean) => Promise<void>;
  syncAllCharacters: () => Promise<void>;
  pushCharacterToBackend: (characterId: string) => Promise<void>;
  pullCharacterFromBackend: (backendId: string) => Promise<void>;
  resolveConflict: (characterId: string, resolution: 'local' | 'remote') => Promise<void>;
  
  // Bulk operations
  importCharacter: (characterExport: CharacterExport) => Promise<string>;
  exportCharacter: (characterId: string) => CharacterExport | null;
  exportAllCharacters: () => CharacterExport[];
  
  // Navigation
  setActiveCharacter: (characterId: string | null) => void;
  
  // Sync configuration
  updateSyncConfig: (config: Partial<SyncConfig>) => void;
  clearSyncError: () => void;
  
  // Utility
  getTotalPlayTime: () => number;
  getCharacterStats: () => {
    total: number;
    active: number;
    archived: number;
    synced: number;
    localOnly: number;
    pending: number;
  };
}

const createDefaultCharacter = (
  name: string,
  characterData?: Partial<CharacterState>,
  campaignId?: string
): PlayerCharacter => {
  const now = new Date();
  const fullCharacterData = { ...DEFAULT_CHARACTER_STATE, ...characterData };
  
  return {
    id: generateCharacterId(),
    name,
    race: fullCharacterData.race || 'Unknown',
    class: fullCharacterData.classes?.[0]?.className || 'Unknown',
    level: fullCharacterData.totalLevel || fullCharacterData.level || 1,
    createdAt: now,
    updatedAt: now,
    lastPlayed: now,
    characterData: { ...fullCharacterData, id: generateCharacterId() },
    tags: [],
    isArchived: false,
    campaignId,
    syncStatus: 'local',
    isPublic: false,
  };
};

// API helper functions
const getAuthToken = () => {
  const authData = localStorage.getItem('rollkeeper-auth');
  return authData ? JSON.parse(authData).accessToken : null;
};

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      characters: [],
      activeCharacterId: null,
      syncConfig: {
        autoSync: true,
        syncInterval: 5, // 5 minutes
        conflictResolution: 'manual',
      },
      isSyncing: false,
      syncError: null,
      lastSyncAttempt: null,
      lastSelectedCharacterId: null,

      // Computed getters
      getActiveCharacter: () => {
        const { characters, activeCharacterId } = get();
        return activeCharacterId 
          ? characters.find(c => c.id === activeCharacterId) || null
          : null;
      },

      getCharacterById: (id: string) => {
        return get().characters.find(c => c.id === id) || null;
      },

      getActiveCharacters: () => {
        return get().characters.filter(c => !c.isArchived);
      },

      getArchivedCharacters: () => {
        return get().characters.filter(c => c.isArchived);
      },

      getSyncedCharacters: () => {
        return get().characters.filter(c => c.syncStatus === 'synced');
      },

      getLocalOnlyCharacters: () => {
        return get().characters.filter(c => c.syncStatus === 'local');
      },

      getPendingSyncCharacters: () => {
        return get().characters.filter(c => c.syncStatus === 'pending');
      },

      // Character management
      createCharacter: async (name: string, characterData?: Partial<CharacterState>, campaignId?: string) => {
        const character = createDefaultCharacter(name, characterData, campaignId);
        
        set(state => ({
          characters: [...state.characters, character],
          activeCharacterId: character.id,
          lastSelectedCharacterId: character.id,
        }));

        // Auto-sync if enabled and user is authenticated
        if (get().syncConfig.autoSync && getAuthToken()) {
          try {
            await get().pushCharacterToBackend(character.id);
          } catch (error) {
            console.error('Auto-sync failed:', error);
            // Don't throw - character is still created locally
          }
        }

        return character.id;
      },

      updateCharacter: async (characterId: string, updates: Partial<PlayerCharacter>) => {
        const now = new Date();
        
        set(state => ({
          characters: state.characters.map(c =>
            c.id === characterId
              ? { 
                  ...c, 
                  ...updates, 
                  updatedAt: now,
                  syncStatus: c.backendId ? 'pending' : 'local'
                }
              : c
          ),
        }));

        // Auto-sync if enabled
        if (get().syncConfig.autoSync && getAuthToken()) {
          try {
            await get().syncCharacter(characterId);
          } catch (error) {
            console.error('Auto-sync failed:', error);
          }
        }
      },

      updateCharacterData: async (characterId: string, updates: Partial<CharacterState>) => {
        const character = get().getCharacterById(characterId);
        if (!character) return;

        const updatedCharacterData = { ...character.characterData, ...updates };
        await get().updateCharacter(characterId, { 
          characterData: updatedCharacterData,
          lastPlayed: new Date(),
        });
      },

      duplicateCharacter: async (characterId: string, newName: string) => {
        const character = get().getCharacterById(characterId);
        if (!character) throw new Error('Character not found');

        return await get().createCharacter(newName, character.characterData);
      },

      deleteCharacter: async (characterId: string) => {
        const character = get().getCharacterById(characterId);
        if (!character) return;

        // Delete from backend if synced
        if (character.backendId && getAuthToken()) {
          try {
            await apiCall(`/api/characters/${character.backendId}`, {
              method: 'DELETE',
            });
          } catch (error) {
            console.error('Failed to delete from backend:', error);
            // Continue with local deletion
          }
        }

        set(state => ({
          characters: state.characters.filter(c => c.id !== characterId),
          activeCharacterId: state.activeCharacterId === characterId ? null : state.activeCharacterId,
        }));
      },

      archiveCharacter: async (characterId: string) => {
        await get().updateCharacter(characterId, { isArchived: true });
      },

      restoreCharacter: async (characterId: string) => {
        await get().updateCharacter(characterId, { isArchived: false });
      },

      // Backend sync operations
      syncCharacter: async (characterId: string, force = false) => {
        const character = get().getCharacterById(characterId);
        if (!character) throw new Error('Character not found');

        if (!getAuthToken()) {
          throw new Error('Not authenticated');
        }

        // Skip if already synced and not forced
        if (character.syncStatus === 'synced' && !force) {
          return;
        }

        set(state => ({
          characters: state.characters.map(c =>
            c.id === characterId ? { ...c, syncStatus: 'pending' } : c
          ),
          isSyncing: true,
          syncError: null,
        }));

        try {
          if (character.backendId) {
            // Update existing character
            await apiCall(`/api/characters/${character.backendId}/sync`, {
              method: 'POST',
              body: JSON.stringify({
                character_data: character.characterData,
                sync_type: 'manual',
              }),
            });

            set(state => ({
              characters: state.characters.map(c =>
                c.id === characterId
                  ? { 
                      ...c, 
                      syncStatus: 'synced',
                      lastSynced: new Date(),
                    }
                  : c
              ),
            }));
          } else {
            // Create new character in backend
            await get().pushCharacterToBackend(characterId);
          }
        } catch (error) {
          console.error('Sync failed:', error);
          set(state => ({
            characters: state.characters.map(c =>
              c.id === characterId ? { ...c, syncStatus: 'error' } : c
            ),
            syncError: error instanceof Error ? error.message : 'Sync failed',
          }));
          throw error;
        } finally {
          set({ isSyncing: false, lastSyncAttempt: new Date() });
        }
      },

      syncAllCharacters: async () => {
        const characters = get().getLocalOnlyCharacters().concat(get().getPendingSyncCharacters());
        
        for (const character of characters) {
          try {
            await get().syncCharacter(character.id);
          } catch (error) {
            console.error(`Failed to sync character ${character.name}:`, error);
            // Continue with other characters
          }
        }
      },

      pushCharacterToBackend: async (characterId: string) => {
        const character = get().getCharacterById(characterId);
        if (!character) throw new Error('Character not found');

        const response = await apiCall('/api/characters', {
          method: 'POST',
          body: JSON.stringify({
            name: character.name,
            character_data: character.characterData,
            campaign_id: character.campaignId,
            is_public: character.isPublic,
          }),
        });

        set(state => ({
          characters: state.characters.map(c =>
            c.id === characterId
              ? { 
                  ...c, 
                  backendId: response.character.id,
                  syncStatus: 'synced',
                  lastSynced: new Date(),
                }
              : c
          ),
        }));
      },

      pullCharacterFromBackend: async (backendId: string) => {
        const response = await apiCall(`/api/characters/${backendId}`);
        const backendCharacter = response.character;

        // Check if we already have this character locally
        const existingCharacter = get().characters.find(c => c.backendId === backendId);

        if (existingCharacter) {
          // Update existing character
          set(state => ({
            characters: state.characters.map(c =>
              c.backendId === backendId
                ? {
                    ...c,
                    name: backendCharacter.name,
                    characterData: backendCharacter.character_data,
                    campaignId: backendCharacter.campaign_id,
                    isPublic: backendCharacter.is_public,
                    syncStatus: 'synced',
                    lastSynced: new Date(),
                    updatedAt: new Date(backendCharacter.updated_at),
                  }
                : c
            ),
          }));
        } else {
          // Create new local character
          const character = createDefaultCharacter(
            backendCharacter.name,
            backendCharacter.character_data,
            backendCharacter.campaign_id
          );

          character.backendId = backendCharacter.id;
          character.syncStatus = 'synced';
          character.lastSynced = new Date();
          character.isPublic = backendCharacter.is_public;
          character.updatedAt = new Date(backendCharacter.updated_at);
          character.createdAt = new Date(backendCharacter.created_at);

          set(state => ({
            characters: [...state.characters, character],
          }));
        }
      },

      resolveConflict: async (characterId: string, resolution: 'local' | 'remote') => {
        const character = get().getCharacterById(characterId);
        if (!character || !character.backendId) return;

        if (resolution === 'remote') {
          await get().pullCharacterFromBackend(character.backendId);
        } else {
          await get().syncCharacter(characterId, true);
        }
      },

      // Bulk operations
      importCharacter: async (characterExport: CharacterExport) => {
        return await get().createCharacter(
          characterExport.character.name,
          characterExport.character
        );
      },

      exportCharacter: (characterId: string) => {
        const character = get().getCharacterById(characterId);
        if (!character) return null;

        return {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          character: character.characterData,
        };
      },

      exportAllCharacters: () => {
        return get().characters
          .filter(c => !c.isArchived)
          .map(c => get().exportCharacter(c.id))
          .filter(Boolean) as CharacterExport[];
      },

      // Navigation
      setActiveCharacter: (characterId: string | null) => {
        set({ 
          activeCharacterId: characterId,
          lastSelectedCharacterId: characterId,
        });
      },

      // Sync configuration
      updateSyncConfig: (config: Partial<SyncConfig>) => {
        set(state => ({
          syncConfig: { ...state.syncConfig, ...config },
        }));
      },

      clearSyncError: () => {
        set({ syncError: null });
      },

      // Utility
      getTotalPlayTime: () => {
        // This would require tracking play time - placeholder for now
        return 0;
      },

      getCharacterStats: () => {
        const characters = get().characters;
        return {
          total: characters.length,
          active: characters.filter(c => !c.isArchived).length,
          archived: characters.filter(c => c.isArchived).length,
          synced: characters.filter(c => c.syncStatus === 'synced').length,
          localOnly: characters.filter(c => c.syncStatus === 'local').length,
          pending: characters.filter(c => c.syncStatus === 'pending').length,
        };
      },
    }),
    {
      name: PLAYER_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist essential data, not computed values or temporary state
      partialize: (state) => ({
        characters: state.characters,
        activeCharacterId: state.activeCharacterId,
        syncConfig: state.syncConfig,
        lastSelectedCharacterId: state.lastSelectedCharacterId,
      }),
    }
  )
);
