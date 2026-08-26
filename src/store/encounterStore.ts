import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createEncounterAwareStorage } from '@/lib/durableDm/encounterAwareStorage';
import { isIndexedDbMigrationEnabled } from '@/lib/indexeddb/persistenceBootstrap';
import {
  Encounter,
  EncounterEntity,
  EncounterCondition,
  CombatConfig,
  DEFAULT_COMBAT_CONFIG,
  MonsterStatBlock,
  MonsterAbility,
} from '@/types/encounter';
import { useNPCStore } from './npcStore';
import { initCrossTabEncounterSync } from '@/lib/crossTabEncounterSync';
import { exposeStoreForE2E } from '@/lib/e2eStoreHandles';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';
import {
  applyShortRest,
  applyLongRest,
  isValidResourceAmount,
} from '@/utils/npcResources';
import {
  ensureStatBlockEntryIds,
  buildAbilitiesFromNormalizedBlock,
  reconcileEntityAbilities,
  findEntryById,
  getEntryAbilityConfig,
} from '@/utils/statBlockAbilities';
import { parseRechargeFromName } from '@/utils/encounterConverter';
import type { NpcResource } from '@/types/encounter';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/** A cross-device stable identity, so cloud documents keep one legacy ID. */
function generateEncounterId(): string {
  return crypto.randomUUID();
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

// Sync NPC entity HP/deathSaves back to persistent npcStore
function syncNPCEntityToStore(
  encounters: Encounter[],
  encounterId: string,
  entityId: string
) {
  const enc = encounters.find(e => e.id === encounterId);
  const entity = enc?.entities.find(e => e.id === entityId);
  if (entity?.type === 'npc' && entity.npcSourceId && entity.campaignCode) {
    useNPCStore.getState().updateNPC(entity.campaignCode, entity.npcSourceId, {
      currentHp: entity.currentHp,
      tempHp: entity.tempHp,
      // tempAc is intentionally not synced back: the NPC's temp AC is
      // free text (with source annotation) and must not be overwritten by
      // the entity's numeric combat value.
      deathSaves: entity.deathSaves
        ? {
            successes: entity.deathSaves.successes,
            failures: entity.deathSaves.failures,
          }
        : undefined,
    });
  }
}

interface EncounterStoreState {
  encounters: Encounter[];
  encounterTombstones: Record<string, EncounterDeletionTombstone>;
  activeEncounterId: string | null;

  // Global combat settings (shared across encounters)
  combatConfig: CombatConfig;
  setCombatConfig: (updates: Partial<CombatConfig>) => void;

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
  setPendingInitiativeRequest: (
    encounterId: string,
    req: { requestId: string; requestedAt: number } | null
  ) => void;

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
  setConditionRounds: (
    encounterId: string,
    entityId: string,
    conditionId: string,
    rounds: number | null
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

  // Class resources
  /** Atomic all-or-nothing resource spend (NPC-authoritative when linked). */
  spendEntityResource: (
    encounterId: string,
    entityId: string,
    resourceId: string,
    amount: number
  ) => boolean;
  restoreEntityResource: (
    encounterId: string,
    entityId: string,
    resourceId: string,
    amount: number
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

  // Long rest
  longRestEntity: (encounterId: string, entityId: string) => void;

  // Short rest
  /** Restores resources per shortRestReset + resets restType==='short' abilities. */
  shortRestEntity: (encounterId: string, entityId: string) => void;

  // Queries
  getEncountersByCampaign: (campaignCode: string) => Encounter[];
}

export interface EncounterDeletionTombstone {
  id: string;
  deletedAt: string;
  beforeImage: Encounter;
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
  // First pass: standard initiative sort
  const sorted = [...entities].sort((a, b) => {
    const aInit = a.initiative ?? -Infinity;
    const bInit = b.initiative ?? -Infinity;
    if (aInit !== bInit) return bInit - aInit;
    // Lair actions lose ties
    if (a.type === 'lair' && b.type !== 'lair') return 1;
    if (b.type === 'lair' && a.type !== 'lair') return -1;
    // Summons sort after their owner (non-summons first at same initiative)
    if (a.summonOwnerId && !b.summonOwnerId) return 1;
    if (b.summonOwnerId && !a.summonOwnerId) return -1;
    // Ties: preserve current order
    return 0;
  });

  // Second pass: move summons directly after their owner
  const result: EncounterEntity[] = [];
  const summonsByOwner = new Map<string, EncounterEntity[]>();

  // Group summons by owner
  for (const e of sorted) {
    if (e.summonOwnerId) {
      const list = summonsByOwner.get(e.summonOwnerId) ?? [];
      list.push(e);
      summonsByOwner.set(e.summonOwnerId, list);
    }
  }

  // Build result: each non-summon entity followed by its summons
  for (const e of sorted) {
    if (e.summonOwnerId) continue; // handled below their owner
    result.push(e);
    const ownerKey = e.playerCharacterId;
    if (ownerKey && summonsByOwner.has(ownerKey)) {
      result.push(...summonsByOwner.get(ownerKey)!);
      summonsByOwner.delete(ownerKey);
    }
  }

  // Append any orphaned summons (owner not in encounter)
  for (const summons of summonsByOwner.values()) {
    result.push(...summons);
  }

  return result;
}

function applyTurnStart(
  entities: EncounterEntity[],
  incomingTurn: number
): EncounterEntity[] {
  return entities.map((e, i) => {
    if (i !== incomingTurn) return e;
    let next = e;
    if (next.hasUsedReaction) next = { ...next, hasUsedReaction: false };
    if (next.legendaryActions && next.legendaryActions.usedActions > 0) {
      next = {
        ...next,
        legendaryActions: { ...next.legendaryActions, usedActions: 0 },
      };
    }
    if (next.conditions.some(c => typeof c.rounds === 'number')) {
      next = {
        ...next,
        conditions: next.conditions
          .map(c =>
            typeof c.rounds === 'number' ? { ...c, rounds: c.rounds - 1 } : c
          )
          .filter(c => !(typeof c.rounds === 'number' && c.rounds <= 0)),
      };
    }
    return next;
  });
}

/**
 * True when `id` still resolves to a trackable entry on the linked NPC's
 * stat block — used to decide whether an 'npc'-sourced ability survives a
 * rest. An entry that was deleted, or whose config became untrackable
 * (e.g. its uses/recharge markup was edited away), is not "live".
 */
function isLiveNpcEntry(
  npcBlock: MonsterStatBlock | undefined,
  id: string
): boolean {
  const entry = findEntryById(npcBlock, id);
  return entry != null && getEntryAbilityConfig(entry) != null;
}

/**
 * Resolves the authoritative NPC for a linked entity. Returns:
 * - { npc } when the entity is NPC-linked and the NPC exists
 * - { npc: null } when the entity is linked but the NPC is gone (entity-only fallback)
 * - null when the entity is not linked at all
 */
function resolveLinkedNpc(
  entity: EncounterEntity
): { npc: import('@/types/encounter').CampaignNPC | null } | null {
  if (entity.type !== 'npc' || !entity.npcSourceId || !entity.campaignCode) {
    return null;
  }
  const npc =
    useNPCStore.getState().getNPC(entity.campaignCode, entity.npcSourceId) ??
    null;
  return { npc };
}

interface PersistedEncounterState {
  encounters: Encounter[];
  activeEncounterId: string | null;
  encounterTombstones?: Record<string, EncounterDeletionTombstone>;
}

export function migrateEncounterPersistedState(
  persisted: unknown,
  version: number
): PersistedEncounterState {
  const state = structuredClone(
    persisted ?? {
      encounters: [],
      activeEncounterId: null,
    }
  ) as PersistedEncounterState;
  state.encounterTombstones ??= {};

  if (version < 2) {
    for (const enc of state.encounters ?? []) {
      enc.entities = enc.entities.map(entity => {
        if (!entity.monsterStatBlock) return entity;
        const statBlock = ensureStatBlockEntryIds(entity.monsterStatBlock);
        const rebuilt = buildAbilitiesFromNormalizedBlock(statBlock); // source 'entity'
        const old = entity.abilities ?? [];
        // Preserve usedUses on an unambiguous clean-name match (exactly one
        // old and one new ability with that name); otherwise reset to 0.
        const oldByName = new Map<string, MonsterAbility[]>();
        for (const a of old) {
          const key = parseRechargeFromName(a.name).cleanName;
          oldByName.set(key, [...(oldByName.get(key) ?? []), a]);
        }
        const newNameCounts = new Map<string, number>();
        for (const a of rebuilt) {
          newNameCounts.set(a.name, (newNameCounts.get(a.name) ?? 0) + 1);
        }
        const abilities = rebuilt.map(a => {
          const candidates = oldByName.get(a.name) ?? [];
          if (candidates.length === 1 && newNameCounts.get(a.name) === 1) {
            return {
              ...a,
              usedUses: Math.min(candidates[0].usedUses, a.maxUses ?? 1),
            };
          }
          return a;
        });
        return { ...entity, monsterStatBlock: statBlock, abilities };
      });
    }
  }

  return state;
}

export const useEncounterStore = create<EncounterStoreState>()(
  persist(
    (set, get) => ({
      encounters: [],
      encounterTombstones: {},
      activeEncounterId: null,
      combatConfig: DEFAULT_COMBAT_CONFIG,

      setCombatConfig: updates => {
        set(state => ({
          combatConfig: { ...state.combatConfig, ...updates },
        }));
      },

      createEncounter: (name, campaignCode) => {
        const id = generateEncounterId();
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
        set(state => {
          const encounter = state.encounters.find(e => e.id === id);
          return {
            encounters: state.encounters.filter(e => e.id !== id),
            encounterTombstones: encounter
              ? {
                  ...state.encounterTombstones,
                  [id]: {
                    id,
                    deletedAt: new Date().toISOString(),
                    beforeImage: structuredClone(encounter),
                  },
                }
              : state.encounterTombstones,
            activeEncounterId:
              state.activeEncounterId === id ? null : state.activeEncounterId,
          };
        });
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
            e => {
              if (!updates.monsterStatBlock) return { ...e, ...updates };
              // Stat-block edits: normalize ids, then rebuild abilities
              // preserving usedUses (NPC config wins for linked entries).
              const normalized = ensureStatBlockEntryIds(
                updates.monsterStatBlock
              );
              const linkedNpc =
                e.type === 'npc' && e.npcSourceId && e.campaignCode
                  ? useNPCStore.getState().getNPC(e.campaignCode, e.npcSourceId)
                  : undefined;
              const abilities = reconcileEntityAbilities(
                normalized,
                e.abilities ?? [],
                linkedNpc
                  ? id => findEntryById(linkedNpc.monsterStatBlock, id)
                  : undefined
              );
              return {
                ...e,
                ...updates,
                monsterStatBlock: normalized,
                abilities,
              };
            }
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

              // Apply turn-start effects (reaction reset, legendary reset, condition decrement)
              const incomingTurn = isNewRound ? 0 : nextTurn;
              entities = applyTurnStart(entities, incomingTurn);

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
              const incomingTurn = isFirstTurn
                ? enc.entities.length - 1
                : enc.currentTurn - 1;

              // Reset reaction for the entity whose turn is starting, mirroring
              // nextTurn so backing up the tracker keeps reaction state correct.
              let entities = enc.entities;
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
          encounters: state.encounters.map(enc => {
            if (enc.id !== encounterId) return enc;

            // Update the entity's initiative
            const updated = enc.entities.map(e =>
              e.id === entityId ? { ...e, initiative: value } : e
            );

            // Re-sort if combat is active and not manually ordered
            if (enc.isActive && enc.sortOrder !== 'manual') {
              // Remember whose turn it is so we can preserve it
              const currentEntityId = enc.entities[enc.currentTurn]?.id;
              const sorted = getSortedEntities(updated);
              const newTurnIndex = currentEntityId
                ? sorted.findIndex(e => e.id === currentEntityId)
                : enc.currentTurn;

              return {
                ...enc,
                entities: sorted,
                currentTurn: newTurnIndex >= 0 ? newTurnIndex : enc.currentTurn,
                updatedAt: new Date().toISOString(),
              };
            }

            return {
              ...enc,
              entities: updated,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      setPendingInitiativeRequest: (encounterId, req) => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => ({
              ...enc,
              pendingInitiativeRequest: req,
              updatedAt: new Date().toISOString(),
            })
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
                // Don't roll for lair actions (always 20), players (DM enters manually),
                // or summons (they follow their owner's initiative via sync)
                if (e.type === 'lair') return { ...e, initiative: 20 };
                if (e.type === 'player') return e;
                if (e.summonOwnerId) return e;
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

              const prevHp = currentHp;
              currentHp = Math.max(0, currentHp - remaining);

              // Init death saves for NPCs when HP drops to 0
              let deathSaves = e.deathSaves;
              if (currentHp <= 0 && prevHp > 0 && e.type === 'npc') {
                const excessDamage = remaining - prevHp;
                if (excessDamage >= e.maxHp) {
                  // Massive damage = instant death
                  deathSaves = {
                    successes: 0,
                    failures: 3,
                    isStabilized: false,
                  };
                } else {
                  deathSaves = {
                    successes: 0,
                    failures: 0,
                    isStabilized: false,
                  };
                }
              }

              return { ...e, currentHp, tempHp, deathSaves };
            }
          ),
        }));
        syncNPCEntityToStore(get().encounters, encounterId, entityId);
      },

      healEntity: (encounterId, entityId, amount) => {
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => {
              const newHp = Math.min(e.maxHp, e.currentHp + amount);
              // Clear death saves when healed from 0 HP (NPCs)
              const deathSaves =
                e.currentHp <= 0 && newHp > 0 && e.type === 'npc'
                  ? undefined
                  : e.deathSaves;
              return { ...e, currentHp: newHp, deathSaves };
            }
          ),
        }));
        syncNPCEntityToStore(get().encounters, encounterId, entityId);
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
        syncNPCEntityToStore(get().encounters, encounterId, entityId);
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

      setConditionRounds: (encounterId, entityId, conditionId, rounds) => {
        set(state => ({
          encounters: updateEncounterById(
            state.encounters,
            encounterId,
            enc => ({
              ...enc,
              entities: enc.entities.map(e =>
                e.id !== entityId
                  ? e
                  : {
                      ...e,
                      conditions:
                        rounds === 0
                          ? e.conditions.filter(c => c.id !== conditionId)
                          : e.conditions.map(c =>
                              c.id === conditionId ? { ...c, rounds } : c
                            ),
                    }
              ),
              updatedAt: new Date().toISOString(),
            })
          ),
        }));
      },

      // Abilities/Charges

      useAbility: (encounterId, entityId, abilityId) => {
        const enc = get().encounters.find(e => e.id === encounterId);
        const entity = enc?.entities.find(e => e.id === entityId);
        const target = entity?.abilities?.find(a => a.id === abilityId);
        if (!entity || !target) return;

        // Routing by provenance: only 'npc'-sourced abilities take the
        // authoritative path; 'entity'-sourced (combat-added, monsters,
        // legacy without source) always mutate entity-locally.
        const linked =
          target.source === 'npc' ? resolveLinkedNpc(entity) : null;
        if (linked?.npc) {
          const npc = linked.npc;
          const npcEntry = findEntryById(npc.monsterStatBlock, abilityId);
          if (!npcEntry || !getEntryAbilityConfig(npcEntry)) {
            // Deletion is authoritative: drop the ability from the entity.
            set(state => ({
              encounters: updateEntityInEncounter(
                state.encounters,
                encounterId,
                entityId,
                e => ({
                  ...e,
                  abilities: e.abilities?.filter(a => a.id !== abilityId),
                })
              ),
            }));
            return;
          }
          // Single atomic mutation (ability + optional resource cost) in npcStore.
          useNPCStore
            .getState()
            .useNpcAbility(npc.campaignCode, npc.id, abilityId);
          // Success or rejection: resync counter (and resource snapshot) from the NPC.
          const fresh = useNPCStore.getState().getNPC(npc.campaignCode, npc.id);
          const freshUsed = fresh?.abilityUsage?.[abilityId] ?? 0;
          const freshResources = fresh?.resources;
          set(state => ({
            encounters: updateEntityInEncounter(
              state.encounters,
              encounterId,
              entityId,
              e => ({
                ...e,
                abilities: e.abilities?.map(a =>
                  a.id === abilityId ? { ...a, usedUses: freshUsed } : a
                ),
                ...(npcEntry.resourceCost && freshResources && e.resources
                  ? {
                      resources: e.resources.map(r => {
                        const nr = freshResources.find(n => n.id === r.id);
                        return nr ? { ...r, usesExpended: nr.usesExpended } : r;
                      }),
                    }
                  : {}),
              })
            ),
          }));
          return;
        }

        // Entity-local path (entity-sourced ability, unlinked entity, or NPC
        // deleted). Combined cost stays atomic against the entity's own
        // resource snapshot; malformed amounts are atomic rejections.
        const max = target.maxUses ?? Infinity;
        if (target.usedUses >= max) return;
        const entry = findEntryById(entity.monsterStatBlock, abilityId);
        const cost = entry?.resourceCost;
        let nextResources = entity.resources;
        if (cost) {
          if (!isValidResourceAmount(cost.amount)) return; // atomic rejection
          const resource = entity.resources?.find(
            r => r.id === cost.resourceId
          );
          if (!resource) return;
          if (resource.maxUses - resource.usesExpended < cost.amount) return;
          nextResources = entity.resources!.map(r =>
            r.id === cost.resourceId
              ? { ...r, usesExpended: r.usesExpended + cost.amount }
              : r
          );
        }
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              abilities: e.abilities?.map(a =>
                a.id === abilityId ? { ...a, usedUses: a.usedUses + 1 } : a
              ),
              resources: nextResources,
            })
          ),
        }));
      },

      restoreAbility: (encounterId, entityId, abilityId) => {
        const enc = get().encounters.find(e => e.id === encounterId);
        const entity = enc?.entities.find(e => e.id === entityId);
        const target = entity?.abilities?.find(a => a.id === abilityId);
        if (!entity || !target) return;

        const linked =
          target.source === 'npc' ? resolveLinkedNpc(entity) : null;
        if (linked?.npc) {
          const npc = linked.npc;
          const npcEntry = findEntryById(npc.monsterStatBlock, abilityId);
          if (!npcEntry || !getEntryAbilityConfig(npcEntry)) {
            // Deletion is authoritative: drop the ability from the entity.
            set(state => ({
              encounters: updateEntityInEncounter(
                state.encounters,
                encounterId,
                entityId,
                e => ({
                  ...e,
                  abilities: e.abilities?.filter(a => a.id !== abilityId),
                })
              ),
            }));
            return;
          }
          useNPCStore
            .getState()
            .restoreNpcAbility(npc.campaignCode, npc.id, abilityId);
          const freshUsed =
            useNPCStore.getState().getNPC(npc.campaignCode, npc.id)
              ?.abilityUsage?.[abilityId] ?? 0;
          set(state => ({
            encounters: updateEntityInEncounter(
              state.encounters,
              encounterId,
              entityId,
              e => ({
                ...e,
                abilities: e.abilities?.map(a =>
                  a.id === abilityId ? { ...a, usedUses: freshUsed } : a
                ),
              })
            ),
          }));
          return;
        }

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

      spendEntityResource: (encounterId, entityId, resourceId, amount) => {
        if (!isValidResourceAmount(amount)) return false;
        const enc = get().encounters.find(e => e.id === encounterId);
        const entity = enc?.entities.find(e => e.id === entityId);
        const snapshot = entity?.resources?.find(r => r.id === resourceId);
        if (!entity || !snapshot) return false;

        const linked = resolveLinkedNpc(entity);
        if (linked?.npc) {
          const npc = linked.npc;
          const npcRes = npc.resources?.find(r => r.id === resourceId);
          if (!npcRes) {
            // Deletion is authoritative: drop from the acting entity snapshot.
            set(state => ({
              encounters: updateEntityInEncounter(
                state.encounters,
                encounterId,
                entityId,
                e => ({
                  ...e,
                  resources: e.resources?.filter(r => r.id !== resourceId),
                })
              ),
            }));
            return false;
          }
          const ok = npcRes.maxUses - npcRes.usesExpended >= amount;
          const newExpended = ok
            ? npcRes.usesExpended + amount
            : npcRes.usesExpended;
          if (ok) {
            useNPCStore.getState().updateNPC(npc.campaignCode, npc.id, {
              resources: npc.resources!.map(r =>
                r.id === resourceId ? { ...r, usesExpended: newExpended } : r
              ),
            });
          }
          // Success or rejection: resync the acting entity snapshot from the NPC.
          set(state => ({
            encounters: updateEntityInEncounter(
              state.encounters,
              encounterId,
              entityId,
              e => ({
                ...e,
                resources: e.resources?.map(r =>
                  r.id === resourceId
                    ? { ...npcRes, usesExpended: newExpended }
                    : r
                ),
              })
            ),
          }));
          return ok;
        }

        // Unlinked, or NPC deleted entirely: entity-only with the same atomic check.
        if (snapshot.maxUses - snapshot.usesExpended < amount) return false; // no expenditure mutation
        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              resources: e.resources?.map(r =>
                r.id === resourceId
                  ? { ...r, usesExpended: r.usesExpended + amount }
                  : r
              ),
            })
          ),
        }));
        return true;
      },

      restoreEntityResource: (encounterId, entityId, resourceId, amount) => {
        if (!isValidResourceAmount(amount)) return; // negative restore must not raise expenditure
        const enc = get().encounters.find(e => e.id === encounterId);
        const entity = enc?.entities.find(e => e.id === entityId);
        if (!entity?.resources?.some(r => r.id === resourceId)) return;

        const linked = resolveLinkedNpc(entity);
        if (linked?.npc) {
          const npc = linked.npc;
          const npcRes = npc.resources?.find(r => r.id === resourceId);
          if (!npcRes) {
            set(state => ({
              encounters: updateEntityInEncounter(
                state.encounters,
                encounterId,
                entityId,
                e => ({
                  ...e,
                  resources: e.resources?.filter(r => r.id !== resourceId),
                })
              ),
            }));
            return;
          }
          const newExpended = Math.max(0, npcRes.usesExpended - amount);
          useNPCStore.getState().updateNPC(npc.campaignCode, npc.id, {
            resources: npc.resources!.map(r =>
              r.id === resourceId ? { ...r, usesExpended: newExpended } : r
            ),
          });
          set(state => ({
            encounters: updateEntityInEncounter(
              state.encounters,
              encounterId,
              entityId,
              e => ({
                ...e,
                resources: e.resources?.map(r =>
                  r.id === resourceId
                    ? { ...npcRes, usesExpended: newExpended }
                    : r
                ),
              })
            ),
          }));
          return;
        }

        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              resources: e.resources?.map(r =>
                r.id === resourceId
                  ? { ...r, usesExpended: Math.max(0, r.usesExpended - amount) }
                  : r
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

      // Long rest

      shortRestEntity: (encounterId, entityId) => {
        const enc = get().encounters.find(e => e.id === encounterId);
        const entity = enc?.entities.find(e => e.id === entityId);
        if (!entity) return;

        // Single-calculation rule: when linked, npcStore.shortRestNPC is the
        // one place the resource math runs; the entity copies the results.
        let npcResources: NpcResource[] | null = null;
        let npcUsage: Record<string, number> | null = null;
        let npcBlock: MonsterStatBlock | undefined;
        const linked = resolveLinkedNpc(entity);
        if (linked?.npc) {
          const npc = linked.npc;
          useNPCStore.getState().shortRestNPC(npc.campaignCode, npc.id);
          const fresh = useNPCStore.getState().getNPC(npc.campaignCode, npc.id);
          npcResources = fresh?.resources ?? [];
          npcUsage = fresh?.abilityUsage ?? {};
          npcBlock = fresh?.monsterStatBlock;
        }

        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              ...(e.resources
                ? {
                    resources:
                      npcResources !== null
                        ? // Copy authoritative results; deletion is authoritative,
                          // so ids missing on the NPC are dropped, not rested.
                          e.resources
                            .filter(r =>
                              npcResources!.some(nr => nr.id === r.id)
                            )
                            .map(r => {
                              const nr = npcResources!.find(
                                n => n.id === r.id
                              )!;
                              return { ...r, usesExpended: nr.usesExpended };
                            })
                        : applyShortRest(e.resources),
                  }
                : {}),
              ...(e.abilities
                ? {
                    abilities:
                      npcUsage !== null
                        ? e.abilities
                            // Provenance decides: an 'npc'-sourced ability whose
                            // entry vanished from the NPC was deleted → dropped.
                            // 'entity'-sourced (combat-added) abilities survive.
                            .filter(
                              a =>
                                a.source !== 'npc' ||
                                isLiveNpcEntry(npcBlock, a.id)
                            )
                            .map(a => {
                              if (
                                a.source === 'npc' &&
                                isLiveNpcEntry(npcBlock, a.id)
                              ) {
                                return { ...a, usedUses: npcUsage![a.id] ?? 0 };
                              }
                              return a.restType === 'short'
                                ? { ...a, usedUses: 0 }
                                : a;
                            })
                        : e.abilities.map(a =>
                            a.restType === 'short' ? { ...a, usedUses: 0 } : a
                          ),
                  }
                : {}),
            })
          ),
        }));
      },

      longRestEntity: (encounterId, entityId) => {
        const encBefore = get().encounters.find(e => e.id === encounterId);
        const entityBefore = encBefore?.entities.find(e => e.id === entityId);
        if (!entityBefore) return;

        // Mirror first — longRestNPC is where NPC-side math (incl. resources) runs.
        let npcResources: NpcResource[] | null = null;
        let npcBlockForLongRest: MonsterStatBlock | undefined;
        const linked = resolveLinkedNpc(entityBefore);
        if (linked?.npc) {
          const npc = linked.npc;
          useNPCStore.getState().longRestNPC(npc.campaignCode, npc.id);
          const fresh = useNPCStore.getState().getNPC(npc.campaignCode, npc.id);
          npcResources = fresh?.resources ?? [];
          npcBlockForLongRest = fresh?.monsterStatBlock;
        }

        set(state => ({
          encounters: updateEntityInEncounter(
            state.encounters,
            encounterId,
            entityId,
            e => ({
              ...e,
              currentHp: e.maxHp,
              tempHp: 0,
              deathSaves: undefined,
              hasUsedReaction: false,
              concentrationSpell: undefined,
              ...(e.spellcasting
                ? {
                    spellcasting: {
                      ...e.spellcasting,
                      slots: e.spellcasting.slots
                        ? Object.fromEntries(
                            Object.entries(e.spellcasting.slots).map(
                              ([level, slot]) => [level, { ...slot, used: 0 }]
                            )
                          )
                        : undefined,
                      usedSpells: {},
                    },
                  }
                : {}),
              ...(e.hitDice
                ? { hitDice: { ...e.hitDice, current: e.hitDice.max } }
                : {}),
              ...(e.abilities
                ? {
                    abilities: (npcBlockForLongRest !== undefined
                      ? e.abilities.filter(
                          a =>
                            a.source !== 'npc' ||
                            isLiveNpcEntry(npcBlockForLongRest, a.id)
                        )
                      : e.abilities
                    ).map(a => ({ ...a, usedUses: 0 })),
                  }
                : {}),
              ...(e.legendaryActions
                ? {
                    legendaryActions: {
                      ...e.legendaryActions,
                      usedActions: 0,
                    },
                  }
                : {}),
              ...(e.resources
                ? {
                    resources:
                      npcResources !== null
                        ? e.resources
                            .filter(r =>
                              npcResources!.some(nr => nr.id === r.id)
                            )
                            .map(r => {
                              const nr = npcResources!.find(
                                n => n.id === r.id
                              )!;
                              return { ...r, usesExpended: nr.usesExpended };
                            })
                        : applyLongRest(e.resources),
                  }
                : {}),
            })
          ),
        }));
      },

      // Queries

      getEncountersByCampaign: campaignCode => {
        return get().encounters.filter(e => e.campaignCode === campaignCode);
      },
    }),
    {
      name: ENCOUNTER_STORAGE_KEY,
      skipHydration: isIndexedDbMigrationEnabled(),
      storage: createJSONStorage(() => createEncounterAwareStorage()),
      version: 2,
      migrate: migrateEncounterPersistedState,
    }
  )
);

exposeStoreForE2E('encounter', useEncounterStore);

initCrossTabEncounterSync(useEncounterStore);

export { getSortedEntities };
export default useEncounterStore;
