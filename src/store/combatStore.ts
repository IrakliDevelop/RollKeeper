import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Encounter,
  CombatParticipant,
  CombatLogEntry,
  CombatCanvasState,
  CombatLayoutMode,
} from '@/types/combat';

import { useDMStore } from './dmStore';
import {
  applyDamage as calculateDamage,
  applyHealing as calculateHealing,
  addTemporaryHP as calculateTemporaryHP,
  makeDeathSave as calculateDeathSave,
  resetDeathSaves as calculateResetDeathSaves,
} from '@/utils/hpCalculations';

interface CombatState {
  // Current encounter
  activeEncounter: Encounter | null;

  // Combat log for current encounter
  combatLog: CombatLogEntry[];

  // Canvas/UI state
  canvasState: CombatCanvasState;

  // Historical encounters
  encounterHistory: Encounter[];

  // Actions - Encounter Management
  startEncounter: (
    campaignId: string,
    participants: CombatParticipant[],
    name?: string
  ) => void;
  endEncounter: () => void;
  pauseEncounter: () => void;
  resumeEncounter: () => void;

  // Actions - Participant Management
  addParticipant: (
    participant: Omit<CombatParticipant, 'id' | 'turnOrder'>
  ) => void;
  removeParticipant: (participantId: string) => void;
  updateParticipant: (
    participantId: string,
    updates: Partial<CombatParticipant>
  ) => void;

  // Actions - Turn Management
  advanceTurn: () => void;
  setCurrentTurn: (participantIndex: number) => void;
  rollInitiative: (participantId?: string) => void;
  reorderInitiative: (newOrder: string[]) => void;

  // Actions - Combat Actions
  applyDamage: (participantId: string, damage: number, source?: string) => void;
  applyHealing: (
    participantId: string,
    healing: number,
    source?: string
  ) => void;
  addTemporaryHP: (
    participantId: string,
    tempHP: number,
    source?: string
  ) => void;
  makeDeathSave: (participantId: string, roll: number) => void;
  resetDeathSaves: (participantId: string) => void;

  // Actions - Combat Log
  addLogEntry: (entry: Omit<CombatLogEntry, 'id' | 'timestamp'>) => void;
  clearCombatLog: () => void;

  // Actions - Canvas State
  setLayoutMode: (mode: CombatLayoutMode) => void;
  selectParticipant: (participantId: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  updateParticipantPosition: (
    participantId: string,
    position: { x: number; y: number }
  ) => void;

  // Utility Functions
  getCurrentParticipant: () => CombatParticipant | null;
  getParticipantById: (participantId: string) => CombatParticipant | null;
  getInitiativeOrder: () => CombatParticipant[];

  // Character sync (for end of combat)
  syncCharacterChanges: () => void;
}

// Utility functions
const generateId = () => Math.random().toString(36).substr(2, 9);

const rollD20 = () => Math.floor(Math.random() * 20) + 1;

const createLogEntry = (
  type: CombatLogEntry['type'],
  actor: string,
  description: string,
  round: number,
  turn?: number,
  target?: string,
  amount?: number
): Omit<CombatLogEntry, 'id' | 'timestamp'> => ({
  type,
  actor,
  description,
  round,
  turn,
  target,
  amount,
});

export const useCombatStore = create<CombatState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeEncounter: null,
      combatLog: [],
      canvasState: {
        layoutMode: 'initiative',
        selectedParticipants: [],
        showInitiativeOrder: true,
        compactCards: false,
      },
      encounterHistory: [],

      // Encounter Management
      startEncounter: (campaignId, participants, name = 'New Encounter') => {
        const participantsWithInitiative = participants.map((p, index) => ({
          ...p,
          id: p.id || generateId(),
          initiative: p.initiative || rollD20() + p.dexterityModifier,
          hasReaction: true,
          hasBonusAction: true,
          hasActed: false,
          turnOrder: index,
          position: { x: index * 320 + 20, y: 20 }, // Default card positions
        }));

        // Sort by initiative (highest first)
        const sortedParticipants = participantsWithInitiative.sort((a, b) => {
          if (a.initiative !== b.initiative) {
            return b.initiative - a.initiative;
          }
          // Tiebreaker: higher dex modifier goes first
          if (a.dexterityModifier !== b.dexterityModifier) {
            return b.dexterityModifier - a.dexterityModifier;
          }
          // Final tiebreaker: players go before monsters
          return a.type === 'player' && b.type === 'monster' ? -1 : 1;
        });

        const encounter: Encounter = {
          id: generateId(),
          campaignId,
          participants: sortedParticipants,
          currentTurn: 0,
          currentRound: 1,
          name,
          startedAt: new Date(),
          isActive: true,
          logEntries: [],
        };

        set({
          activeEncounter: encounter,
          combatLog: [
            {
              id: generateId(),
              timestamp: new Date(),
              ...createLogEntry(
                'initiative',
                'DM',
                `Combat started: ${name}`,
                1
              ),
            },
          ],
        });
      },

      endEncounter: () => {
        const state = get();
        if (!state.activeEncounter) return;

        // Sync character changes back to DM store
        state.syncCharacterChanges();

        const finishedEncounter: Encounter = {
          ...state.activeEncounter,
          endedAt: new Date(),
          isActive: false,
          logEntries: state.combatLog,
        };

        set({
          encounterHistory: [...state.encounterHistory, finishedEncounter],
          activeEncounter: null,
          combatLog: [],
        });
      },

      pauseEncounter: () => {
        set(state => ({
          activeEncounter: state.activeEncounter
            ? {
                ...state.activeEncounter,
                isActive: false,
              }
            : null,
        }));
      },

      resumeEncounter: () => {
        set(state => ({
          activeEncounter: state.activeEncounter
            ? {
                ...state.activeEncounter,
                isActive: true,
              }
            : null,
        }));
      },

      // Participant Management
      addParticipant: participantData => {
        const state = get();
        if (!state.activeEncounter) return;

        const newParticipant: CombatParticipant = {
          ...participantData,
          id: generateId(),
          initiative:
            participantData.initiative ||
            rollD20() + participantData.dexterityModifier,
          hasReaction: true,
          hasBonusAction: true,
          hasActed: false,
          turnOrder: state.activeEncounter.participants.length,
          position: {
            x: state.activeEncounter.participants.length * 320 + 20,
            y: 20,
          },
        };

        const updatedParticipants = [
          ...state.activeEncounter.participants,
          newParticipant,
        ].sort((a, b) => b.initiative - a.initiative);

        set({
          activeEncounter: {
            ...state.activeEncounter,
            participants: updatedParticipants,
          },
        });

        get().addLogEntry(
          createLogEntry(
            'action',
            'DM',
            `${newParticipant.name} joined the combat`,
            state.activeEncounter.currentRound
          )
        );
      },

      removeParticipant: participantId => {
        const state = get();
        if (!state.activeEncounter) return;

        const participant = state.activeEncounter.participants.find(
          p => p.id === participantId
        );
        if (!participant) return;

        const updatedParticipants = state.activeEncounter.participants.filter(
          p => p.id !== participantId
        );
        let newCurrentTurn = state.activeEncounter.currentTurn;

        // Adjust current turn if necessary
        if (newCurrentTurn >= updatedParticipants.length) {
          newCurrentTurn = 0;
        }

        set({
          activeEncounter: {
            ...state.activeEncounter,
            participants: updatedParticipants,
            currentTurn: newCurrentTurn,
          },
        });

        get().addLogEntry(
          createLogEntry(
            'action',
            'DM',
            `${participant.name} left the combat`,
            state.activeEncounter.currentRound
          )
        );
      },

      updateParticipant: (participantId, updates) => {
        const state = get();
        if (!state.activeEncounter) return;

        const updatedParticipants = state.activeEncounter.participants.map(p =>
          p.id === participantId ? { ...p, ...updates } : p
        );

        set({
          activeEncounter: {
            ...state.activeEncounter,
            participants: updatedParticipants,
          },
        });
      },

      // Turn Management
      advanceTurn: () => {
        const state = get();
        if (!state.activeEncounter) return;

        let nextTurn = state.activeEncounter.currentTurn + 1;
        let nextRound = state.activeEncounter.currentRound;

        // Check if we've completed the round
        if (nextTurn >= state.activeEncounter.participants.length) {
          nextTurn = 0;
          nextRound++;

          // Reset round-based resources
          const updatedParticipants = state.activeEncounter.participants.map(
            p => ({
              ...p,
              hasReaction: true,
              hasBonusAction: true,
              hasActed: false,
              usedLegendaryActions: 0,
            })
          );

          set({
            activeEncounter: {
              ...state.activeEncounter,
              participants: updatedParticipants,
              currentTurn: nextTurn,
              currentRound: nextRound,
            },
          });

          get().addLogEntry(
            createLogEntry(
              'round',
              'DM',
              `Round ${nextRound} begins`,
              nextRound
            )
          );
        } else {
          set({
            activeEncounter: {
              ...state.activeEncounter,
              currentTurn: nextTurn,
            },
          });
        }

        const currentParticipant = state.activeEncounter.participants[nextTurn];
        if (currentParticipant) {
          get().addLogEntry(
            createLogEntry(
              'turn',
              'DM',
              `${currentParticipant.name}'s turn`,
              nextRound,
              nextTurn
            )
          );
        }
      },

      setCurrentTurn: participantIndex => {
        const state = get();
        if (!state.activeEncounter) return;

        if (
          participantIndex >= 0 &&
          participantIndex < state.activeEncounter.participants.length
        ) {
          set({
            activeEncounter: {
              ...state.activeEncounter,
              currentTurn: participantIndex,
            },
          });
        }
      },

      rollInitiative: participantId => {
        const state = get();
        if (!state.activeEncounter) return;

        if (participantId) {
          // Roll for specific participant
          const updatedParticipants = state.activeEncounter.participants.map(
            p => {
              if (p.id === participantId) {
                const newInitiative = rollD20() + p.dexterityModifier;
                return { ...p, initiative: newInitiative };
              }
              return p;
            }
          );

          // Re-sort by initiative
          const sortedParticipants = updatedParticipants.sort(
            (a, b) => b.initiative - a.initiative
          );

          set({
            activeEncounter: {
              ...state.activeEncounter,
              participants: sortedParticipants,
              currentTurn: 0, // Reset to first participant
            },
          });
        } else {
          // Roll for all participants
          const updatedParticipants = state.activeEncounter.participants.map(
            p => ({
              ...p,
              initiative: rollD20() + p.dexterityModifier,
            })
          );

          const sortedParticipants = updatedParticipants.sort(
            (a, b) => b.initiative - a.initiative
          );

          set({
            activeEncounter: {
              ...state.activeEncounter,
              participants: sortedParticipants,
              currentTurn: 0,
            },
          });

          get().addLogEntry(
            createLogEntry(
              'initiative',
              'DM',
              'Initiative rerolled for all participants',
              state.activeEncounter.currentRound
            )
          );
        }
      },

      reorderInitiative: newOrder => {
        const state = get();
        if (!state.activeEncounter) return;

        const reorderedParticipants = newOrder
          .map(id => state.activeEncounter!.participants.find(p => p.id === id))
          .filter(Boolean) as CombatParticipant[];

        set({
          activeEncounter: {
            ...state.activeEncounter,
            participants: reorderedParticipants,
            currentTurn: 0, // Reset to first participant
          },
        });
      },

      // Combat Actions (reusing existing HP calculation logic)
      applyDamage: (participantId, damage, source = 'Unknown') => {
        const state = get();
        if (!state.activeEncounter) return;

        const participant = state.activeEncounter.participants.find(
          p => p.id === participantId
        );
        if (!participant) return;

        // Use existing damage calculation logic
        const newHitPoints = calculateDamage(participant.hitPoints, damage);

        get().updateParticipant(participantId, { hitPoints: newHitPoints });
        get().addLogEntry(
          createLogEntry(
            'damage',
            source,
            `${participant.name} takes ${damage} damage`,
            state.activeEncounter.currentRound,
            state.activeEncounter.currentTurn,
            participant.name,
            damage
          )
        );

        // Check for death/unconsciousness
        if (newHitPoints.current <= 0 && participant.hitPoints.current > 0) {
          get().addLogEntry(
            createLogEntry(
              'death',
              source,
              `${participant.name} falls unconscious`,
              state.activeEncounter.currentRound,
              state.activeEncounter.currentTurn,
              participant.name
            )
          );
        }
      },

      applyHealing: (participantId, healing, source = 'Unknown') => {
        const state = get();
        if (!state.activeEncounter) return;

        const participant = state.activeEncounter.participants.find(
          p => p.id === participantId
        );
        if (!participant) return;

        const newHitPoints = calculateHealing(participant.hitPoints, healing);

        get().updateParticipant(participantId, { hitPoints: newHitPoints });
        get().addLogEntry(
          createLogEntry(
            'healing',
            source,
            `${participant.name} heals ${healing} HP`,
            state.activeEncounter.currentRound,
            state.activeEncounter.currentTurn,
            participant.name,
            healing
          )
        );
      },

      addTemporaryHP: (participantId, tempHP, source = 'Unknown') => {
        const state = get();
        if (!state.activeEncounter) return;

        const participant = state.activeEncounter.participants.find(
          p => p.id === participantId
        );
        if (!participant) return;

        const newHitPoints = calculateTemporaryHP(
          participant.hitPoints,
          tempHP
        );

        get().updateParticipant(participantId, { hitPoints: newHitPoints });
        get().addLogEntry(
          createLogEntry(
            'healing',
            source,
            `${participant.name} gains ${tempHP} temporary HP`,
            state.activeEncounter.currentRound,
            state.activeEncounter.currentTurn,
            participant.name,
            tempHP
          )
        );
      },

      makeDeathSave: (participantId, roll) => {
        const state = get();
        if (!state.activeEncounter) return;

        const participant = state.activeEncounter.participants.find(
          p => p.id === participantId
        );
        if (!participant) return;

        const isSuccess = roll >= 10;
        const isCritical = roll === 20;
        const newHitPoints = calculateDeathSave(
          participant.hitPoints,
          isSuccess,
          isCritical
        );

        get().updateParticipant(participantId, { hitPoints: newHitPoints });

        const result = isCritical
          ? 'critical success'
          : isSuccess
            ? 'success'
            : 'failure';
        get().addLogEntry(
          createLogEntry(
            'action',
            participant.name,
            `Death saving throw: ${roll} (${result})`,
            state.activeEncounter.currentRound,
            state.activeEncounter.currentTurn
          )
        );
      },

      resetDeathSaves: participantId => {
        const state = get();
        if (!state.activeEncounter) return;

        const participant = state.activeEncounter.participants.find(
          p => p.id === participantId
        );
        if (!participant) return;

        const newHitPoints = calculateResetDeathSaves(participant.hitPoints);

        get().updateParticipant(participantId, { hitPoints: newHitPoints });
        get().addLogEntry(
          createLogEntry(
            'action',
            'DM',
            `${participant.name}'s death saves reset`,
            state.activeEncounter.currentRound
          )
        );
      },

      // Combat Log
      addLogEntry: entry => {
        set(state => ({
          combatLog: [
            ...state.combatLog,
            {
              ...entry,
              id: generateId(),
              timestamp: new Date(),
            },
          ],
        }));
      },

      clearCombatLog: () => {
        set({ combatLog: [] });
      },

      // Canvas State
      setLayoutMode: mode => {
        set(state => ({
          canvasState: { ...state.canvasState, layoutMode: mode },
        }));
      },

      selectParticipant: (participantId, multiSelect = false) => {
        set(state => {
          const currentSelection = state.canvasState.selectedParticipants;
          let newSelection: string[];

          if (multiSelect) {
            newSelection = currentSelection.includes(participantId)
              ? currentSelection.filter(id => id !== participantId)
              : [...currentSelection, participantId];
          } else {
            newSelection = [participantId];
          }

          return {
            canvasState: {
              ...state.canvasState,
              selectedParticipants: newSelection,
            },
          };
        });
      },

      clearSelection: () => {
        set(state => ({
          canvasState: { ...state.canvasState, selectedParticipants: [] },
        }));
      },

      updateParticipantPosition: (participantId, position) => {
        get().updateParticipant(participantId, { position });
      },

      // Utility Functions
      getCurrentParticipant: () => {
        const state = get();
        if (!state.activeEncounter) return null;
        return (
          state.activeEncounter.participants[
            state.activeEncounter.currentTurn
          ] || null
        );
      },

      getParticipantById: participantId => {
        const state = get();
        if (!state.activeEncounter) return null;
        return (
          state.activeEncounter.participants.find(
            p => p.id === participantId
          ) || null
        );
      },

      getInitiativeOrder: () => {
        const state = get();
        if (!state.activeEncounter) return [];
        return [...state.activeEncounter.participants].sort(
          (a, b) => b.initiative - a.initiative
        );
      },

      // Character sync
      syncCharacterChanges: () => {
        const state = get();
        if (!state.activeEncounter) return;

        const { updatePlayerCharacter } = useDMStore.getState();

        // Update all player characters with their final HP
        state.activeEncounter.participants
          .filter(p => p.type === 'player' && p.characterReference)
          .forEach(participant => {
            if (participant.characterReference) {
              updatePlayerCharacter(
                participant.characterReference.campaignId,
                participant.characterReference.characterId,
                {
                  characterData: {
                    ...participant.characterReference.characterData,
                    hitPoints: participant.hitPoints,
                  },
                }
              );
            }
          });
      },
    }),
    {
      name: 'combat-store',
      partialize: state => ({
        encounterHistory: state.encounterHistory,
        canvasState: state.canvasState,
      }),
    }
  )
);
