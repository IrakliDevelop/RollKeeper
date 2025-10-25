import { create } from 'zustand';
import { CombatParticipant } from '@/types/combat';
import { CharacterState } from '@/types/character';

interface CombatEncounter {
  id: string;
  name: string;
  campaignId: string;
  participants: CombatParticipant[];
  currentRound: number;
  currentTurn: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RealtimeCombatState {
  // Combat Data
  activeEncounter: CombatEncounter | null;
  campaignId: string | null;
  connectedPlayers: Set<string>;
  isConnected: boolean;
  connectionError: string | null;
  characterData: Map<string, CharacterState>;
  
  // Actions - Combat Management
  startRealtimeCombat: (campaignId: string, encounter: CombatEncounter) => Promise<void>;
  endRealtimeCombat: () => Promise<void>;
  updateParticipant: (participantId: string, updates: Partial<CombatParticipant>) => Promise<void>;
  
  // Actions - Character Updates
  updateCharacterHP: (characterId: string, newHP: number, tempHP?: number) => Promise<void>;
  updateCharacterAC: (characterId: string, newAC: number) => Promise<void>;
  
  // Getters
  getParticipantById: (participantId: string) => CombatParticipant | null;
  getCharacterData: (characterId: string) => CharacterState | null;
  isPlayerConnected: (userId: string) => boolean;
}

export const useRealtimeCombatStore = create<RealtimeCombatState>((set, get) => ({
  // Initial state
  activeEncounter: null,
  campaignId: null,
  connectedPlayers: new Set(),
  isConnected: false,
  connectionError: null,
  characterData: new Map(),

  // Combat Management
  startRealtimeCombat: async (campaignId: string, encounter: CombatEncounter) => {
    set({ 
      activeEncounter: encounter, 
      campaignId,
      connectionError: null,
      isConnected: true,
    });
  },

  endRealtimeCombat: async () => {
    const { campaignId } = get();
    
    // Notify server that combat has ended
    if (campaignId) {
      try {
        const token = localStorage.getItem('rollkeeper-auth');
        if (token) {
          const authData = JSON.parse(token);
          await fetch(`/api/campaigns/${campaignId}/combat/end`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authData.accessToken}`,
            },
          });
        }
      } catch (error) {
        console.error('Error ending combat:', error);
      }
    }
    
    set({
      activeEncounter: null,
      campaignId: null,
      connectedPlayers: new Set(),
      isConnected: false,
      characterData: new Map(),
    });
  },

  updateParticipant: async (participantId: string, updates: Partial<CombatParticipant>) => {
    const { activeEncounter, campaignId } = get();
    if (!activeEncounter || !campaignId) return;

    // Update local state
    const updatedParticipants = activeEncounter.participants.map(p =>
      p.id === participantId ? { ...p, ...updates } : p
    );

    set({
      activeEncounter: {
        ...activeEncounter,
        participants: updatedParticipants,
      },
    });

    // Send update to server
    try {
      const token = localStorage.getItem('rollkeeper-auth');
      if (token) {
        const authData = JSON.parse(token);
        await fetch(`/api/campaigns/${campaignId}/combat/participants/${participantId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.accessToken}`,
          },
          body: JSON.stringify(updates),
        });
      }
    } catch (error) {
      console.error('Error updating participant:', error);
    }
  },

  // Character Updates
  updateCharacterHP: async (characterId: string, newHP: number, tempHP = 0) => {
    // For now, just log the update
    console.log('Character HP update:', { characterId, newHP, tempHP });
  },

  updateCharacterAC: async (characterId: string, newAC: number) => {
    // For now, just log the update
    console.log('Character AC update:', { characterId, newAC });
  },

  // Getters
  getParticipantById: (participantId: string) => {
    const { activeEncounter } = get();
    return activeEncounter?.participants.find(p => p.id === participantId) || null;
  },

  getCharacterData: (characterId: string) => {
    return get().characterData.get(characterId) || null;
  },

  isPlayerConnected: (userId: string) => {
    return get().connectedPlayers.has(userId);
  },
}));