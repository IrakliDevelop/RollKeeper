import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Encounter,
  EncounterEntity,
  EncounterCondition,
} from '@/types/encounter';

const ENCOUNTER_STORAGE_KEY = 'rollkeeper-encounter-data';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

interface EncounterStoreState {
  encounters: Encounter[];
  activeEncounterId: string | null;

  // Encounter CRUD
  createEncounter: (name: string, campaignCode?: string) => string;
  deleteEncounter: (id: string) => void;
  updateEncounter: (id: string, updates: Partial<Encounter>) => void;
  getEncounter: (id: string) => Encounter | undefined;
  setActiveEncounter: (id: string | null) => void;

  // Entity management
  addEntity: (
    encounterId: string,
    entity: Omit<EncounterEntity, 'id'>
  ) => string;
  removeEntity: (encounterId: string, entityId: string) => void;
  updateEntity: (
    encounterId: string,
    entityId: string,
    updates: Partial<EncounterEntity>
  ) => void;

  // Combat flow
  startCombat: (encounterId: string) => void;
  endCombat: (encounterId: string) => void;
  nextTurn: (encounterId: string) => void;
  prevTurn: (encounterId: string) => void;
  setTurn: (encounterId: string, entityId: string) => void;

  // Initiative
  setInitiative: (encounterId: string, entityId: string, value: number) => void;
  rollInitiative: (encounterId: string, entityId: string) => number;
  rollAllInitiatives: (encounterId: string) => void;
  reorderEntities: (encounterId: string, entityIds: string[]) => void;

  // HP management
  damageEntity: (encounterId: string, entityId: string, amount: number) => void;
  healEntity: (encounterId: string, entityId: string, amount: number) => void;
  setEntityHp: (
    encounterId: string,
    entityId: string,
    current: number,
    max?: number
  ) => void;
  addTempHp: (encounterId: string, entityId: string, amount: number) => void;

  // Conditions
  addCondition: (
    encounterId: string,
    entityId: string,
    condition: Omit<EncounterCondition, 'id'>
  ) => void;
  removeCondition: (
    encounterId: string,
    entityId: string,
    conditionId: string
  ) => void;
  updateCondition: (
    encounterId: string,
    entityId: string,
    conditionId: string,
    updates: Partial<EncounterCondition>
  ) => void;

  // Abilities/Charges
  useAbility: (
    encounterId: string,
    entityId: string,
    abilityId: string
  ) => void;
  restoreAbility: (
    encounterId: string,
    entityId: string,
    abilityId: string
  ) => void;
  useLegendaryAction: (
    encounterId: string,
    entityId: string,
    actionId: string
  ) => void;
  resetLegendaryActions: (encounterId: string, entityId: string) => void;

  // Concentration
  setConcentration: (
    encounterId: string,
    entityId: string,
    spellName: string | null
  ) => void;

  // Lair actions
  useLairAction: (
    encounterId: string,
    entityId: string,
    actionId: string
  ) => void;
  resetLairActions: (encounterId: string, entityId: string) => void;
}

// Helper to update an entity within an encounter
function updateEntityInEncounter(
  encounters: Encounter[],
  encounterId: string,
  entityId: string,
  updater: (entity: EncounterEntity) => EncounterEntity
): Encounter[] {
  return encounters.map(enc => {
    if (enc.id !== encounterId) return enc;
    return {
      ...enc,
      updatedAt: new Date().toISOString(),
      entities: enc.entities.map(e => (e.id === entityId ? updater(e) : e)),
    };
  });
}

function updateEncounterById(
  encounters: Encounter[],
  encounterId: string,
  updater: (enc: Encounter) => Encounter
): Encounter[] {
  return encounters.map(enc => (enc.id === encounterId ? updater(enc) : enc));
}

// Sort entities by initiative (descending), with lair actions losing ties
function getSortedEntities(entities: EncounterEntity[]): EncounterEntity[] {
  return [...entities].sort((a, b) => {
    const aInit = a.initiative ?? -Infinity;
    const bInit = b.initiative ?? -Infinity;
    if (aInit !== bInit) return bInit - aInit;
    // Lair actions lose ties
    if (a.type === 'lair' && b.type !== 'lair') return 1;
    if (b.type === 'lair' && a.type !== 'lair') return -1;
    // Higher dex modifier wins ties
    return b.initiativeModifier - a.initiativeModifier;
  });
}

export const useEncounterStore = create<EncounterStoreState>()(
  persist(
    (set, get) => ({
      encounters: [],
      activeEncounterId: null,

      createEncounter: (name, campaignCode) => {
        const id = generateId();
        const encounter: Encounter = {
          id,
          name,
          campaignCode,
          entities: [],
          currentTurn: 0,
          round: 0,
          isActive: false,
          sortOrder: 'initiative',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set(state => ({
          encounters: [...state.encounters, encounter],
          activeEncounterId: id,
        }));
        return id;
      },

      deleteEncounter: id => {
        set(state => ({
          encounters: state.encounters.filter(e => e.id !== id),
          activeEncounterId:
            state.activeEncounterId === id ? null : state.activeEncounterId,
        }));
      },

      updateEncounter: (id, updates) => {
        set(state => ({
          encounters: updateEncounterById(state.encounters, id, enc => ({
            ...enc,
            ...updates,
            updatedAt: new Date().toISOString(),
          })),
        }));
      },

      getEncounter: id => {
        return get().encounters.find(e => e.id === id);
      },

      setActiveEncounter: id => {
        set({ activeEncounterId: id });
      },

      // Entity management

      addEntity: (encounterId, entityData) => {
        const entityId = generateId();
        const entity: EncounterEntity = { ...entityData, id: entityId };
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => ({
              ...enc,
              entities: [...enc.entities, entity],
              updatedAt: new Date().toISOString(),
            })
          ),
        }));
        return entityId;
      },

      removeEntity: (encounterId, entityId) => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => ({
              ...enc,
              entities: enc.entities.filter(e => e.id !== entityId),
              updatedAt: new Date().toISOString(),
            })
          ),
        }));
      },

      updateEntity: (encounterId, entityId, updates) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({ ...e, ...updates })
          ),
        }));
      },

      // Combat flow

      startCombat: encounterId => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => {
              const sorted = getSortedEntities(enc.entities);
              return {
                ...enc,
                entities: sorted,
                isActive: true,
                round: 1,
                currentTurn: 0,
                updatedAt: new Date().toISOString(),
              };
            }
          ),
        }));
      },

      endCombat: encounterId => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => ({
              ...enc,
              isActive: false,
              updatedAt: new Date().toISOString(),
            })
          ),
        }));
      },

      nextTurn: encounterId => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => {
              if (!enc.isActive || enc.entities.length === 0) return enc;
              const nextTurn = enc.currentTurn + 1;
              const isNewRound = nextTurn >= enc.entities.length;
              let entities = enc.entities;

              // Reset lair actions at start of new round
              if (isNewRound) {
                entities = entities.map(e => {
                  if (e.type === 'lair' && e.lairActions) {
                    return {
                      ...e,
                      lairActions: e.lairActions.map(la => ({
                        ...la,
                        usedThisRound: false,
                      })),
                    };
                  }
                  return e;
                });
              }

              // Reset reaction for the entity whose turn is starting
              const incomingTurn = isNewRound ? 0 : nextTurn;
              const incomingEntity = entities[incomingTurn];
              if (incomingEntity?.hasUsedReaction) {
                entities = entities.map((e, i) =>
                  i === incomingTurn ? { ...e, hasUsedReaction: false } : e
                );
              }

              return {
                ...enc,
                entities,
                currentTurn: incomingTurn,
                round: isNewRound ? enc.round + 1 : enc.round,
                updatedAt: new Date().toISOString(),
              };
            }
          ),
        }));
      },

      prevTurn: encounterId => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => {
              if (!enc.isActive || enc.entities.length === 0) return enc;
              const isFirstTurn = enc.currentTurn === 0;
              return {
                ...enc,
                currentTurn: isFirstTurn
                  ? enc.entities.length - 1
                  : enc.currentTurn - 1,
                round: isFirstTurn ? Math.max(1, enc.round - 1) : enc.round,
                updatedAt: new Date().toISOString(),
              };
            }
          ),
        }));
      },

      setTurn: (encounterId, entityId) => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => {
              const idx = enc.entities.findIndex(e => e.id === entityId);
              if (idx === -1) return enc;
              return {
                ...enc,
                currentTurn: idx,
                updatedAt: new Date().toISOString(),
              };
            }
          ),
        }));
      },

      // Initiative

      setInitiative: (encounterId, entityId, value) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({ ...e, initiative: value })
          ),
        }));
      },

      rollInitiative: (encounterId, entityId) => {
        const roll = rollD20();
        const enc = get().encounters.find(e => e.id === encounterId);
        const entity = enc?.entities.find(e => e.id === entityId);
        const total = roll + (entity?.initiativeModifier ?? 0);
        get().setInitiative(encounterId, entityId, total);
        return total;
      },

      rollAllInitiatives: encounterId => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => ({
              ...enc,
              entities: enc.entities.map(e => {
                // Don't roll for lair actions (always 20) or players (DM enters manually)
                if (e.type === 'lair') return { ...e, initiative: 20 };
                if (e.type === 'player') return e;
                const roll = rollD20();
                return { ...e, initiative: roll + e.initiativeModifier };
              }),
              updatedAt: new Date().toISOString(),
            })
          ),
        }));
      },

      reorderEntities: (encounterId, entityIds) => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => {
              const entityMap = new Map(enc.entities.map(e => [e.id, e]));
              const reordered = entityIds
                .map(id => entityMap.get(id))
                .filter((e): e is EncounterEntity => e !== undefined);
              return {
                ...enc,
                entities: reordered,
                sortOrder: 'manual' as const,
                updatedAt: new Date().toISOString(),
              };
            }
          ),
        }));
      },

      // HP management

      damageEntity: (encounterId, entityId, amount) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => {
              let remaining = amount;
              let tempHp = e.tempHp;
              let currentHp = e.currentHp;

              // Temp HP absorbs damage first
              if (tempHp > 0) {
                if (remaining <= tempHp) {
                  tempHp -= remaining;
                  remaining = 0;
                } else {
                  remaining -= tempHp;
                  tempHp = 0;
                }
              }

              currentHp = Math.max(0, currentHp - remaining);
              return { ...e, currentHp, tempHp };
            }
          ),
        }));
      },

      healEntity: (encounterId, entityId, amount) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              currentHp: Math.min(e.maxHp, e.currentHp + amount),
            })
          ),
        }));
      },

      setEntityHp: (encounterId, entityId, current, max) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              currentHp: Math.max(0, Math.min(max ?? e.maxHp, current)),
              ...(max !== undefined ? { maxHp: max } : {}),
            })
          ),
        }));
      },

      addTempHp: (encounterId, entityId, amount) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              // Temp HP doesn't stack — take the higher value
              tempHp: Math.max(e.tempHp, amount),
            })
          ),
        }));
      },

      // Conditions

      addCondition: (encounterId, entityId, condition) => {
        const conditionId = generateId();
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              conditions: [...e.conditions, { ...condition, id: conditionId }],
            })
          ),
        }));
      },

      removeCondition: (encounterId, entityId, conditionId) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              conditions: e.conditions.filter(c => c.id !== conditionId),
            })
          ),
        }));
      },

      updateCondition: (encounterId, entityId, conditionId, updates) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              conditions: e.conditions.map(c =>
                c.id === conditionId ? { ...c, ...updates } : c
              ),
            })
          ),
        }));
      },

      // Abilities/Charges

      useAbility: (encounterId, entityId, abilityId) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              abilities: e.abilities?.map(a =>
                a.id === abilityId
                  ? {
                      ...a,
                      usedUses: Math.min(a.usedUses + 1, a.maxUses ?? Infinity),
                    }
                  : a
              ),
            })
          ),
        }));
      },

      restoreAbility: (encounterId, entityId, abilityId) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              abilities: e.abilities?.map(a =>
                a.id === abilityId
                  ? { ...a, usedUses: Math.max(0, a.usedUses - 1) }
                  : a
              ),
            })
          ),
        }));
      },

      useLegendaryAction: (encounterId, entityId, actionId) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => {
              if (!e.legendaryActions) return e;
              const action = e.legendaryActions.actions.find(
                a => a.id === actionId
              );
              if (!action) return e;
              const newUsed = e.legendaryActions.usedActions + action.cost;
              if (newUsed > e.legendaryActions.maxActions) return e;
              return {
                ...e,
                legendaryActions: {
                  ...e.legendaryActions,
                  usedActions: newUsed,
                },
              };
            }
          ),
        }));
      },

      resetLegendaryActions: (encounterId, entityId) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              legendaryActions: e.legendaryActions
                ? { ...e.legendaryActions, usedActions: 0 }
                : undefined,
            })
          ),
        }));
      },

      // Concentration

      setConcentration: (encounterId, entityId, spellName) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              concentrationSpell: spellName ?? undefined,
            })
          ),
        }));
      },

      // Lair actions

      useLairAction: (encounterId, entityId, actionId) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              lairActions: e.lairActions?.map(la =>
                la.id === actionId ? { ...la, usedThisRound: true } : la
              ),
            })
          ),
        }));
      },

      resetLairActions: (encounterId, entityId) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              lairActions: e.lairActions?.map(la => ({
                ...la,
                usedThisRound: false,
              })),
            })
          ),
        }));
      },
    }),
    {
      name: ENCOUNTER_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

export { getSortedEntities };
export default useEncounterStore;
