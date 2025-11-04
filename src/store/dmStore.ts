import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Campaign,
  CombatEncounter,
  PlayerCharacterReference,
  CombatParticipant,
  Session,
  CampaignNote,
  CharacterImportSource,
  CharacterSyncStatus,
  DEFAULT_CAMPAIGN_SETTINGS,
  DEFAULT_ENCOUNTER_SETTINGS,
  DEFAULT_CANVAS_DATA,
  CombatLogEntry,
  DMEntityBase,
} from '@/types/dm';
import { CharacterState } from '@/types/character';

// Version for data migration
const DM_STORE_VERSION = '1.0.0';
const DM_STORAGE_KEY = 'rollkeeper-dm-data';

// Store state interface
interface DMStoreState {
  // Core data
  campaigns: Campaign[];
  activeCampaignId: string | null;
  activeEncounterId: string | null;

  // UI state
  selectedParticipantIds: string[];
  isEncounterRunning: boolean;
  lastSaved: Date;

  // Settings and preferences
  dmPreferences: DMPreferences;

  // Computed getters
  getActiveCampaign: () => Campaign | null;
  getActiveEncounter: () => CombatEncounter | null;
  getCampaignById: (id: string) => Campaign | null;
  getEncounterById: (id: string) => CombatEncounter | null;
  getPlayerCharacterById: (
    campaignId: string,
    characterId: string
  ) => PlayerCharacterReference | null;

  // Campaign management
  createCampaign: (campaign: Omit<Campaign, keyof DMEntityBase>) => string;
  updateCampaign: (campaignId: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (campaignId: string) => void;
  setActiveCampaign: (campaignId: string | null) => void;

  // Character management
  importPlayerCharacter: (
    campaignId: string,
    characterData: CharacterState,
    importSource: CharacterImportSource
  ) => string;
  updatePlayerCharacter: (
    campaignId: string,
    characterId: string,
    updates: Partial<PlayerCharacterReference>
  ) => void;
  removePlayerCharacter: (campaignId: string, characterId: string) => void;
  syncPlayerCharacter: (
    campaignId: string,
    characterId: string,
    newCharacterData: CharacterState
  ) => void;

  // Encounter management
  createEncounter: (
    campaignId: string,
    encounter: Omit<CombatEncounter, keyof DMEntityBase | 'campaignId'>
  ) => string;
  updateEncounter: (
    encounterId: string,
    updates: Partial<CombatEncounter>
  ) => void;
  deleteEncounter: (encounterId: string) => void;
  setActiveEncounter: (encounterId: string | null) => void;

  // Combat participant management
  addParticipant: (
    encounterId: string,
    participant: Omit<CombatParticipant, 'id'>
  ) => string;
  updateParticipant: (
    encounterId: string,
    participantId: string,
    updates: Partial<CombatParticipant>
  ) => void;
  removeParticipant: (encounterId: string, participantId: string) => void;

  // Combat flow
  startCombat: (encounterId: string) => void;
  endCombat: (encounterId: string) => void;
  nextTurn: (encounterId: string) => void;
  rollInitiative: (encounterId: string, participantId?: string) => void;

  // Combat logging
  addCombatLogEntry: (
    encounterId: string,
    entry: Omit<CombatLogEntry, 'id' | 'timestamp'>
  ) => void;

  // Session management
  createSession: (
    campaignId: string,
    session: Omit<Session, keyof DMEntityBase | 'campaignId'>
  ) => string;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  deleteSession: (sessionId: string) => void;

  // Notes management
  createNote: (
    campaignId: string,
    note: Omit<CampaignNote, keyof DMEntityBase | 'campaignId'>
  ) => string;
  updateNote: (noteId: string, updates: Partial<CampaignNote>) => void;
  deleteNote: (noteId: string) => void;

  // Utility functions
  generateId: () => string;
  exportCampaign: (campaignId: string) => Campaign | null;
  importCampaign: (campaignData: Campaign) => string;

  // Reset and cleanup
  resetStore: () => void;
}

interface DMPreferences {
  // UI preferences
  defaultEncounterView: 'grid' | 'list' | 'cards';
  autoSaveInterval: number; // minutes
  showCombatAnimations: boolean;
  defaultGridSize: number;

  // Automation preferences
  autoRollInitiative: boolean;
  autoAdvanceTurns: boolean;
  autoCalculateXP: boolean;

  // Display preferences
  showPlayerHP: boolean;
  showEnemyDetails: boolean;
  compactParticipantCards: boolean;

  // Import/Export preferences
  defaultExportFormat: 'json' | 'pdf' | 'markdown';
  includePlayerDataInExport: boolean;
}

const DEFAULT_DM_PREFERENCES: DMPreferences = {
  defaultEncounterView: 'grid',
  autoSaveInterval: 5,
  showCombatAnimations: true,
  defaultGridSize: 5,
  autoRollInitiative: false,
  autoAdvanceTurns: false,
  autoCalculateXP: true,
  showPlayerHP: true,
  showEnemyDetails: false,
  compactParticipantCards: false,
  defaultExportFormat: 'json',
  includePlayerDataInExport: true,
};

// Utility functions
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const createDMEntity = (
  base: Omit<DMEntityBase, keyof DMEntityBase>
): DMEntityBase => ({
  ...base,
  id: generateId(),
  createdAt: new Date(),
  updatedAt: new Date(),
  version: DM_STORE_VERSION,
});

// Store implementation
export const useDMStore = create<DMStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      campaigns: [],
      activeCampaignId: null,
      activeEncounterId: null,
      selectedParticipantIds: [],
      isEncounterRunning: false,
      lastSaved: new Date(),
      dmPreferences: DEFAULT_DM_PREFERENCES,

      // Computed getters
      getActiveCampaign: () => {
        const { campaigns, activeCampaignId } = get();
        return activeCampaignId
          ? campaigns.find(c => c.id === activeCampaignId) || null
          : null;
      },

      // TODO: fix this
      // @ts-expect-error - TODO: fix this
      getActiveEncounter: () => {
        const { getActiveCampaign, activeEncounterId } = get();
        const campaign = getActiveCampaign();
        if (!campaign || !activeEncounterId) return null;
        return (
          campaign.encounters.find(e => e.id === activeEncounterId) || null
        );
      },

      getCampaignById: (id: string) => {
        return get().campaigns.find(c => c.id === id) || null;
      },

      // @ts-expect-error - TODO: fix this
      getEncounterById: (id: string) => {
        const { campaigns } = get();
        for (const campaign of campaigns) {
          const encounter = campaign.encounters.find(e => e.id === id);
          if (encounter) return encounter;
        }
        return null;
      },

      getPlayerCharacterById: (campaignId: string, characterId: string) => {
        const campaign = get().getCampaignById(campaignId);
        return (
          campaign?.playerCharacters.find(pc => pc.id === characterId) || null
        );
      },

      // Campaign management
      createCampaign: campaignData => {
        const campaign: Campaign = {
          ...createDMEntity(campaignData),
          ...campaignData,
          playerCharacters: [],
          sessions: [],
          encounters: [],
          notes: [],
          settings: { ...DEFAULT_CAMPAIGN_SETTINGS, ...campaignData.settings },
          tags: campaignData.tags || [],
          isArchived: false,
        };

        set(state => ({
          campaigns: [...state.campaigns, campaign],
          lastSaved: new Date(),
        }));

        return campaign.id;
      },

      updateCampaign: (campaignId, updates) => {
        set(state => ({
          campaigns: state.campaigns.map(campaign =>
            campaign.id === campaignId
              ? { ...campaign, ...updates, updatedAt: new Date() }
              : campaign
          ),
          lastSaved: new Date(),
        }));
      },

      deleteCampaign: campaignId => {
        set(state => ({
          campaigns: state.campaigns.filter(c => c.id !== campaignId),
          activeCampaignId:
            state.activeCampaignId === campaignId
              ? null
              : state.activeCampaignId,
          activeEncounterId: null,
          lastSaved: new Date(),
        }));
      },

      setActiveCampaign: campaignId => {
        set({ activeCampaignId: campaignId, activeEncounterId: null });
      },

      // Character management
      importPlayerCharacter: (campaignId, characterData, importSource) => {
        const characterRef: PlayerCharacterReference = {
          ...createDMEntity({}),
          characterId: characterData.id || generateId(),
          campaignId,
          characterName: characterData.name,
          playerName: characterData.playerName,
          class: characterData.class.name,
          level: characterData.level,
          race: characterData.race,
          importSource,
          importedAt: new Date(),
          lastSynced: new Date(),
          syncStatus: 'synced',
          isActive: true,
          isVisible: true,
          dmNotes: '',
          characterData,
          lastKnownHash: JSON.stringify(characterData).length.toString(),
          combatHistory: [],
        };

        set(state => ({
          campaigns: state.campaigns.map(campaign =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  playerCharacters: [
                    ...campaign.playerCharacters,
                    characterRef,
                  ],
                  updatedAt: new Date(),
                }
              : campaign
          ),
          lastSaved: new Date(),
        }));

        return characterRef.id;
      },

      updatePlayerCharacter: (campaignId, characterId, updates) => {
        set(state => ({
          campaigns: state.campaigns.map(campaign =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  playerCharacters: campaign.playerCharacters.map(pc =>
                    pc.id === characterId
                      ? { ...pc, ...updates, updatedAt: new Date() }
                      : pc
                  ),
                  updatedAt: new Date(),
                }
              : campaign
          ),
          lastSaved: new Date(),
        }));
      },

      removePlayerCharacter: (campaignId, characterId) => {
        set(state => ({
          campaigns: state.campaigns.map(campaign =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  playerCharacters: campaign.playerCharacters.filter(
                    pc => pc.id !== characterId
                  ),
                  updatedAt: new Date(),
                }
              : campaign
          ),
          lastSaved: new Date(),
        }));
      },

      syncPlayerCharacter: (campaignId, characterId, newCharacterData) => {
        const currentHash = JSON.stringify(newCharacterData).length.toString();

        set(state => ({
          campaigns: state.campaigns.map(campaign =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  playerCharacters: campaign.playerCharacters.map(pc =>
                    pc.id === characterId
                      ? {
                          ...pc,
                          characterData: newCharacterData,
                          lastSynced: new Date(),
                          lastKnownHash: currentHash,
                          syncStatus: 'synced' as CharacterSyncStatus,
                          updatedAt: new Date(),
                        }
                      : pc
                  ),
                  updatedAt: new Date(),
                }
              : campaign
          ),
          lastSaved: new Date(),
        }));
      },

      // Encounter management
      createEncounter: (campaignId, encounterData) => {
        const encounter: CombatEncounter = {
          ...createDMEntity(encounterData),
          campaignId,
          ...encounterData,
          isActive: false,
          roundNumber: 0,
          turnIndex: 0,
          participants: [],
          canvasData: { ...DEFAULT_CANVAS_DATA },
          settings: {
            ...DEFAULT_ENCOUNTER_SETTINGS,
            ...encounterData.settings,
          },
          combatLog: [],
          isTemplate: encounterData.isTemplate || false,
          templateTags: encounterData.templateTags || [],
        };

        // @ts-expect-error - TODO: fix this
        set(state => ({
          campaigns: state.campaigns.map(campaign =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  encounters: [...campaign.encounters, encounter],
                  updatedAt: new Date(),
                }
              : campaign
          ),
          lastSaved: new Date(),
        }));

        return encounter.id;
      },

      updateEncounter: (encounterId, updates) => {
        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            encounters: campaign.encounters.map(encounter =>
              encounter.id === encounterId
                ? { ...encounter, ...updates, updatedAt: new Date() }
                : encounter
            ),
            updatedAt: new Date(),
          })),
          lastSaved: new Date(),
        }));
      },

      deleteEncounter: encounterId => {
        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            encounters: campaign.encounters.filter(e => e.id !== encounterId),
            updatedAt: new Date(),
          })),
          activeEncounterId:
            state.activeEncounterId === encounterId
              ? null
              : state.activeEncounterId,
          lastSaved: new Date(),
        }));
      },

      setActiveEncounter: encounterId => {
        set({ activeEncounterId: encounterId });
      },

      // Combat participant management
      addParticipant: (encounterId, participantData) => {
        const participant: CombatParticipant = {
          ...participantData,
          id: generateId(),
          joinedRound: 0,
        };

        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            encounters: campaign.encounters.map(encounter =>
              encounter.id === encounterId
                ? {
                    ...encounter,
                    // @ts-expect-error - TODO: fix this
                    participants: [...encounter.participants, participant],
                    updatedAt: new Date(),
                  }
                : encounter
            ),
            updatedAt: new Date(),
          })),
          lastSaved: new Date(),
        }));

        return participant.id;
      },

      updateParticipant: (encounterId, participantId, updates) => {
        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            encounters: campaign.encounters.map(encounter =>
              encounter.id === encounterId
                ? {
                    ...encounter,
                    // @ts-expect-error - TODO: fix this
                    participants: encounter.participants.map(p =>
                      p.id === participantId ? { ...p, ...updates } : p
                    ),
                    updatedAt: new Date(),
                  }
                : encounter
            ),
            updatedAt: new Date(),
          })),
          lastSaved: new Date(),
        }));
      },

      removeParticipant: (encounterId, participantId) => {
        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            encounters: campaign.encounters.map(encounter =>
              encounter.id === encounterId
                ? {
                    ...encounter,
                    // @ts-expect-error - TODO: fix this
                    participants: encounter.participants.filter(
                      (                      p: { id: string; }) => p.id !== participantId
                    ),
                    updatedAt: new Date(),
                  }
                : encounter
            ),
            updatedAt: new Date(),
          })),
          selectedParticipantIds: state.selectedParticipantIds.filter(
            id => id !== participantId
          ),
          lastSaved: new Date(),
        }));
      },

      // Combat flow
      startCombat: encounterId => {
        set(state => {
          const encounter = state.getEncounterById(encounterId);
          if (!encounter) return state;

          return {
            campaigns: state.campaigns.map(campaign => ({
              ...campaign,
              encounters: campaign.encounters.map(e =>
                e.id === encounterId
                  ? {
                      ...e,
                      isActive: true,
                      roundNumber: 1,
                      turnIndex: 0,
                      startedAt: new Date(),
                      updatedAt: new Date(),
                    }
                  : e
              ),
              updatedAt: new Date(),
            })),
            isEncounterRunning: true,
            lastSaved: new Date(),
          };
        });
      },

      endCombat: encounterId => {
        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            encounters: campaign.encounters.map(e =>
              e.id === encounterId
                ? {
                    ...e,
                    isActive: false,
                    endedAt: new Date(),
                    updatedAt: new Date(),
                  }
                : e
            ),
            updatedAt: new Date(),
          })),
          isEncounterRunning: false,
          lastSaved: new Date(),
        }));
      },

      nextTurn: encounterId => {
        set(state => {
          const encounter = state.getEncounterById(encounterId);
          if (!encounter || !encounter.isActive) return state;

          const nextTurnIndex = encounter.turnIndex + 1;
          const shouldAdvanceRound =
            nextTurnIndex >= encounter.participants.length;

          return {
            campaigns: state.campaigns.map(campaign => ({
              ...campaign,
              encounters: campaign.encounters.map(e =>
                e.id === encounterId
                  ? {
                      ...e,
                      turnIndex: shouldAdvanceRound ? 0 : nextTurnIndex,
                      roundNumber: shouldAdvanceRound
                        ? e.roundNumber + 1
                        : e.roundNumber,
                      // @ts-expect-error - TODO: fix this
                      participants: e.participants.map(
                        (p: CombatParticipant) => ({
                          ...p,
                          isActive: shouldAdvanceRound
                            ? // @ts-expect-error - TODO: fix this
                              e.participants.indexOf(p) === 0
                            : // @ts-expect-error - TODO: fix this
                              e.participants.indexOf(p) === nextTurnIndex,
                          hasActed: shouldAdvanceRound ? false : p.hasActed,
                        })
                      ),
                      updatedAt: new Date(),
                    }
                  : e
              ),
              updatedAt: new Date(),
            })),
            lastSaved: new Date(),
          };
        });
      },

      rollInitiative: (encounterId, participantId) => {
        // Implementation for rolling initiative
        // For now, just mark that we need this functionality
        console.log('Rolling initiative for:', { encounterId, participantId });
      },

      // Combat logging
      addCombatLogEntry: (encounterId, entryData) => {
        const entry: CombatLogEntry = {
          ...entryData,
          id: generateId(),
          timestamp: new Date(),
        };

        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            encounters: campaign.encounters.map(encounter =>
              encounter.id === encounterId
                ? {
                    ...encounter,
                    // @ts-expect-error - TODO: fix this
                    combatLog: [...encounter.combatLog, entry],
                    updatedAt: new Date(),
                  }
                : encounter
            ),
            updatedAt: new Date(),
          })),
          lastSaved: new Date(),
        }));
      },

      // Session management - placeholder implementations
      createSession: (campaignId, sessionData) => {
        const session: Session = {
          ...createDMEntity(sessionData),
          campaignId,
          ...sessionData,
          notes: sessionData.notes || [],
          presentPlayers: sessionData.presentPlayers || [],
          absentPlayers: sessionData.absentPlayers || [],
          encounters: sessionData.encounters || [],
        };

        set(state => ({
          campaigns: state.campaigns.map(campaign =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  sessions: [...campaign.sessions, session],
                  updatedAt: new Date(),
                }
              : campaign
          ),
          lastSaved: new Date(),
        }));

        return session.id;
      },

      updateSession: (sessionId, updates) => {
        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            sessions: campaign.sessions.map(session =>
              session.id === sessionId
                ? { ...session, ...updates, updatedAt: new Date() }
                : session
            ),
            updatedAt: new Date(),
          })),
          lastSaved: new Date(),
        }));
      },

      deleteSession: sessionId => {
        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            sessions: campaign.sessions.filter(s => s.id !== sessionId),
            updatedAt: new Date(),
          })),
          lastSaved: new Date(),
        }));
      },

      // Notes management - placeholder implementations
      createNote: (campaignId, noteData) => {
        const note: CampaignNote = {
          ...createDMEntity(noteData),
          campaignId,
          ...noteData,
          linkedCharacters: noteData.linkedCharacters || [],
          linkedEncounters: noteData.linkedEncounters || [],
          linkedSessions: noteData.linkedSessions || [],
          connections: noteData.connections || [],
        };

        set(state => ({
          campaigns: state.campaigns.map(campaign =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  notes: [...campaign.notes, note],
                  updatedAt: new Date(),
                }
              : campaign
          ),
          lastSaved: new Date(),
        }));

        return note.id;
      },

      updateNote: (noteId, updates) => {
        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            notes: campaign.notes.map(note =>
              note.id === noteId
                ? { ...note, ...updates, updatedAt: new Date() }
                : note
            ),
            updatedAt: new Date(),
          })),
          lastSaved: new Date(),
        }));
      },

      deleteNote: noteId => {
        set(state => ({
          campaigns: state.campaigns.map(campaign => ({
            ...campaign,
            notes: campaign.notes.filter(n => n.id !== noteId),
            updatedAt: new Date(),
          })),
          lastSaved: new Date(),
        }));
      },

      // Utility functions
      generateId,

      exportCampaign: campaignId => {
        return get().getCampaignById(campaignId);
      },

      importCampaign: campaignData => {
        const importedCampaign: Campaign = {
          ...campaignData,
          id: generateId(), // Generate new ID to avoid conflicts
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set(state => ({
          campaigns: [...state.campaigns, importedCampaign],
          lastSaved: new Date(),
        }));

        return importedCampaign.id;
      },

      resetStore: () => {
        set({
          campaigns: [],
          activeCampaignId: null,
          activeEncounterId: null,
          selectedParticipantIds: [],
          isEncounterRunning: false,
          lastSaved: new Date(),
          dmPreferences: DEFAULT_DM_PREFERENCES,
        });
      },
    }),
    {
      name: DM_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Migrate function for future versions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persistedState: any) => {
        // Handle data migrations here when we update the schema
        return persistedState;
      },
    }
  )
);

export default useDMStore;
