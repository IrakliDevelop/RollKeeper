import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { isIndexedDbMigrationEnabled } from '@/lib/indexeddb/persistenceBootstrap';
import { createSafeStorage } from '@/lib/safeStorage';
import { CampaignNPC } from '@/types/encounter';
import { Spell } from '@/types/character';
import {
  getNPCSpellSlots,
  resetNPCSpellcasting,
} from '@/utils/npcSpellcasting';
import { detectSpellAoe } from '@/utils/spellAoeDetection';
import {
  applyShortRest,
  applyLongRest,
  isValidResourceAmount,
} from '@/utils/npcResources';
import {
  ensureStatBlockEntryIds,
  getEntryAbilityConfig,
  findEntryById,
} from '@/utils/statBlockAbilities';

const NPC_STORAGE_KEY = 'rollkeeper-npc-data';

function generateId(): string {
  return (
    'npc-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
}

function getDuplicateName(name: string, existingNpcs: CampaignNPC[]): string {
  const baseName = name.replace(/ \(Copy(?: \d+)?\)$/, '');
  const existingNames = new Set(existingNpcs.map(npc => npc.name));
  const firstCopyName = `${baseName} (Copy)`;

  if (!existingNames.has(firstCopyName)) return firstCopyName;

  let copyNumber = 2;
  while (existingNames.has(`${baseName} (Copy ${copyNumber})`)) {
    copyNumber += 1;
  }
  return `${baseName} (Copy ${copyNumber})`;
}

/**
 * Ids are a store invariant: any stat block entering the store is normalized,
 * and abilityUsage is pruned to live entry ids and clamped to current maxima.
 */
function normalizeNpcWrite(npc: CampaignNPC): CampaignNPC {
  if (!npc.monsterStatBlock) {
    // No stat block → no entries → any remaining usage keys are orphans.
    return npc.abilityUsage ? { ...npc, abilityUsage: undefined } : npc;
  }
  const statBlock = ensureStatBlockEntryIds(npc.monsterStatBlock);
  let abilityUsage = npc.abilityUsage;
  if (abilityUsage) {
    const next: Record<string, number> = {};
    for (const [entryId, used] of Object.entries(abilityUsage)) {
      const entry = findEntryById(statBlock, entryId);
      if (!entry) continue; // orphan — entry deleted
      const config = getEntryAbilityConfig(entry);
      if (!config) continue; // no longer trackable
      next[entryId] = Math.min(Math.max(0, used), config.maxUses);
    }
    abilityUsage = next;
  }
  return { ...npc, monsterStatBlock: statBlock, abilityUsage };
}

function arrayMove<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...arr];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

interface NPCStoreState {
  npcsByCampaign: Record<string, CampaignNPC[]>;

  createNPC: (
    campaignCode: string,
    npc: Omit<CampaignNPC, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt'>
  ) => string;
  duplicateNPC: (campaignCode: string, id: string) => string | undefined;
  updateNPC: (
    campaignCode: string,
    id: string,
    updates: Partial<CampaignNPC>
  ) => void;
  deleteNPC: (campaignCode: string, id: string) => void;
  getNPC: (campaignCode: string, id: string) => CampaignNPC | undefined;
  getNPCsForCampaign: (campaignCode: string) => CampaignNPC[];
  /** Reorder NPCs that appear in `orderedMemberIds` (subset, e.g. one group); persists new order in the campaign list. */
  reorderNPCsSubset: (
    campaignCode: string,
    orderedMemberIds: string[],
    fromIndex: number,
    toIndex: number
  ) => void;
  updateDeathSaves: (
    campaignCode: string,
    id: string,
    deathSaves: { successes: number; failures: number }
  ) => void;
  addSpellToNPC: (campaignCode: string, npcId: string, spell: Spell) => void;
  updateSpellOnNPC: (
    campaignCode: string,
    npcId: string,
    spellId: string,
    updates: Partial<Spell>
  ) => void;
  removeSpellFromNPC: (
    campaignCode: string,
    npcId: string,
    spellId: string
  ) => void;
  setNPCSpellSlotUsed: (
    campaignCode: string,
    npcId: string,
    level: number,
    used: number
  ) => void;
  useNPCFreeCast: (
    campaignCode: string,
    npcId: string,
    spellId: string
  ) => void;
  longRestNPC: (campaignCode: string, npcId: string) => void;
  /** Atomic all-or-nothing spend; false = insufficient uses or unknown id (no mutation). */
  spendNpcResource: (
    campaignCode: string,
    npcId: string,
    resourceId: string,
    amount: number
  ) => boolean;
  restoreNpcResource: (
    campaignCode: string,
    npcId: string,
    resourceId: string,
    amount: number
  ) => void;
  /** Restores class resources per their shortRestReset rule. Touches nothing else. */
  shortRestNPC: (campaignCode: string, npcId: string) => void;
  /** Atomic ability use: increments abilityUsage AND spends the entry's resourceCost (if any) — or neither. */
  useNpcAbility: (
    campaignCode: string,
    npcId: string,
    entryId: string
  ) => boolean;
  /** Ability counter only — never refunds the resource. */
  restoreNpcAbility: (
    campaignCode: string,
    npcId: string,
    entryId: string
  ) => void;
}

export function migrateNpcPersistedState(
  persisted: unknown,
  version: number
): NPCStoreState {
  const migrationInput =
    persisted == null ? persisted : structuredClone(persisted);
  let state: { npcsByCampaign: Record<string, CampaignNPC[]> };

  if (version < 2) {
    const old = migrationInput as { npcs?: CampaignNPC[] } | null;
    const legacyNpcs = old?.npcs ?? [];
    const npcsByCampaign: Record<string, CampaignNPC[]> = {};

    for (const npc of legacyNpcs) {
      const code =
        (npc as CampaignNPC & { campaignCode?: string }).campaignCode ??
        '_legacy';
      if (!npcsByCampaign[code]) npcsByCampaign[code] = [];
      npcsByCampaign[code].push({ ...npc, campaignCode: code });
    }

    state = { npcsByCampaign };
  } else {
    // Harden against a null persisted value (the old code blind-cast it)
    state = (migrationInput ?? { npcsByCampaign: {} }) as {
      npcsByCampaign: Record<string, CampaignNPC[]>;
    };
  }

  if (version < 3) {
    // Back-fill AoE template metadata for NPC spells saved before the aoe
    // field existed (same undefined/null contract as character spells).
    for (const npcs of Object.values(state.npcsByCampaign ?? {})) {
      for (const npc of npcs) {
        if (!npc.spellcasting) continue;
        for (const spell of npc.spellcasting.spells) {
          if (spell.aoe === undefined) {
            spell.aoe = detectSpellAoe(spell.description, spell.range);
          }
        }
      }
    }
  }

  if (version < 4) {
    // Backfill stable entry ids (idempotent, collision-safe, repairs duplicates).
    for (const npcs of Object.values(state.npcsByCampaign ?? {})) {
      for (const npc of npcs) {
        if (npc.monsterStatBlock) {
          npc.monsterStatBlock = ensureStatBlockEntryIds(npc.monsterStatBlock);
        }
      }
    }
  }

  return state as NPCStoreState;
}

export const useNPCStore = create<NPCStoreState>()(
  persist(
    (set, get) => ({
      npcsByCampaign: {},

      createNPC: (campaignCode, npcData) => {
        const id = generateId();
        const now = new Date().toISOString();
        const npc: CampaignNPC = normalizeNpcWrite({
          ...npcData,
          id,
          campaignCode,
          createdAt: now,
          updatedAt: now,
        });
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: [...existing, npc],
            },
          };
        });
        return id;
      },

      duplicateNPC: (campaignCode, id) => {
        const existing = get().npcsByCampaign[campaignCode] ?? [];
        const source = existing.find(npc => npc.id === id);
        if (!source) return undefined;

        const duplicateId = generateId();
        const now = new Date().toISOString();
        const duplicate = normalizeNpcWrite({
          ...structuredClone(source),
          id: duplicateId,
          name: getDuplicateName(source.name, existing),
          createdAt: now,
          updatedAt: now,
        });

        set(state => ({
          npcsByCampaign: {
            ...state.npcsByCampaign,
            [campaignCode]: [
              ...(state.npcsByCampaign[campaignCode] ?? []),
              duplicate,
            ],
          },
        }));
        return duplicateId;
      },

      updateNPC: (campaignCode, id, updates) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc =>
                npc.id === id
                  ? normalizeNpcWrite({
                      ...npc,
                      ...updates,
                      updatedAt: new Date().toISOString(),
                    })
                  : npc
              ),
            },
          };
        });
      },

      deleteNPC: (campaignCode, id) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.filter(npc => npc.id !== id),
            },
          };
        });
      },

      getNPC: (campaignCode, id) => {
        return (get().npcsByCampaign[campaignCode] ?? []).find(
          npc => npc.id === id
        );
      },

      getNPCsForCampaign: campaignCode => {
        return get().npcsByCampaign[campaignCode] ?? [];
      },

      reorderNPCsSubset: (
        campaignCode,
        orderedMemberIds,
        fromIndex,
        toIndex
      ) => {
        if (fromIndex === toIndex) return;
        const idSet = new Set(orderedMemberIds);
        const newIds = arrayMove(orderedMemberIds, fromIndex, toIndex);

        set(state => {
          const npcs = state.npcsByCampaign[campaignCode] ?? [];
          const globalIndices: number[] = [];
          npcs.forEach((n, i) => {
            if (idSet.has(n.id)) globalIndices.push(i);
          });
          if (globalIndices.length !== orderedMemberIds.length) {
            return state;
          }

          const idToNpc = new Map(npcs.map(n => [n.id, n]));
          const result = [...npcs];
          newIds.forEach((id, j) => {
            const npc = idToNpc.get(id);
            if (npc) result[globalIndices[j]] = npc;
          });

          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: result,
            },
          };
        });
      },

      updateDeathSaves: (campaignCode, id, deathSaves) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc =>
                npc.id === id
                  ? { ...npc, deathSaves, updatedAt: new Date().toISOString() }
                  : npc
              ),
            },
          };
        });
      },

      addSpellToNPC: (campaignCode, npcId, spell) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc => {
                if (npc.id !== npcId || !npc.spellcasting) return npc;
                return {
                  ...npc,
                  spellcasting: {
                    ...npc.spellcasting,
                    spells: [...npc.spellcasting.spells, spell],
                  },
                  updatedAt: new Date().toISOString(),
                };
              }),
            },
          };
        });
      },

      updateSpellOnNPC: (campaignCode, npcId, spellId, updates) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc => {
                if (npc.id !== npcId || !npc.spellcasting) return npc;
                return {
                  ...npc,
                  spellcasting: {
                    ...npc.spellcasting,
                    spells: npc.spellcasting.spells.map(s =>
                      s.id === spellId
                        ? {
                            ...s,
                            ...updates,
                            updatedAt: new Date().toISOString(),
                          }
                        : s
                    ),
                  },
                  updatedAt: new Date().toISOString(),
                };
              }),
            },
          };
        });
      },

      removeSpellFromNPC: (campaignCode, npcId, spellId) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc => {
                if (npc.id !== npcId || !npc.spellcasting) return npc;
                return {
                  ...npc,
                  spellcasting: {
                    ...npc.spellcasting,
                    spells: npc.spellcasting.spells.filter(
                      s => s.id !== spellId
                    ),
                  },
                  updatedAt: new Date().toISOString(),
                };
              }),
            },
          };
        });
      },

      setNPCSpellSlotUsed: (campaignCode, npcId, level, used) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc => {
                if (npc.id !== npcId || !npc.spellcasting) return npc;
                const maxSlots = getNPCSpellSlots(
                  npc.spellcasting.casterLevel,
                  npc.spellcasting.slotOverrides
                );
                const max = maxSlots[level] ?? 0;
                const clamped = Math.max(0, Math.min(used, max));
                return {
                  ...npc,
                  spellcasting: {
                    ...npc.spellcasting,
                    slotsUsed: {
                      ...npc.spellcasting.slotsUsed,
                      [level]: clamped,
                    },
                  },
                  updatedAt: new Date().toISOString(),
                };
              }),
            },
          };
        });
      },

      useNPCFreeCast: (campaignCode, npcId, spellId) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc => {
                if (npc.id !== npcId || !npc.spellcasting) return npc;
                return {
                  ...npc,
                  spellcasting: {
                    ...npc.spellcasting,
                    spells: npc.spellcasting.spells.map(s =>
                      s.id === spellId
                        ? { ...s, freeCastsUsed: (s.freeCastsUsed ?? 0) + 1 }
                        : s
                    ),
                  },
                  updatedAt: new Date().toISOString(),
                };
              }),
            },
          };
        });
      },

      longRestNPC: (campaignCode, npcId) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc => {
                if (npc.id !== npcId) return npc;
                return {
                  ...npc,
                  currentHp: npc.maxHp,
                  tempHp: 0,
                  deathSaves: undefined,
                  ...(npc.hitDice
                    ? {
                        hitDice: {
                          ...npc.hitDice,
                          current: npc.hitDice.max,
                        },
                      }
                    : {}),
                  ...(npc.spellcasting
                    ? {
                        spellcasting: resetNPCSpellcasting(npc.spellcasting),
                      }
                    : {}),
                  ...(npc.resources
                    ? { resources: applyLongRest(npc.resources) }
                    : {}),
                  ...(npc.abilityUsage
                    ? {
                        abilityUsage: Object.fromEntries(
                          Object.keys(npc.abilityUsage).map(k => [k, 0])
                        ),
                      }
                    : {}),
                  updatedAt: new Date().toISOString(),
                };
              }),
            },
          };
        });
      },

      spendNpcResource: (campaignCode, npcId, resourceId, amount) => {
        if (!isValidResourceAmount(amount)) return false;
        const npc = get().getNPC(campaignCode, npcId);
        const resource = npc?.resources?.find(r => r.id === resourceId);
        if (!resource) return false;
        if (resource.maxUses - resource.usesExpended < amount) return false; // no expenditure mutation
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(n =>
                n.id === npcId
                  ? {
                      ...n,
                      resources: n.resources?.map(r =>
                        r.id === resourceId
                          ? { ...r, usesExpended: r.usesExpended + amount }
                          : r
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : n
              ),
            },
          };
        });
        return true;
      },

      restoreNpcResource: (campaignCode, npcId, resourceId, amount) => {
        if (!isValidResourceAmount(amount)) return; // negative restore must not raise expenditure
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(n =>
                n.id === npcId
                  ? {
                      ...n,
                      resources: n.resources?.map(r =>
                        r.id === resourceId
                          ? {
                              ...r,
                              usesExpended: Math.max(
                                0,
                                r.usesExpended - amount
                              ),
                            }
                          : r
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : n
              ),
            },
          };
        });
      },

      useNpcAbility: (campaignCode, npcId, entryId) => {
        const npc = get().getNPC(campaignCode, npcId);
        if (!npc) return false;
        const entry = findEntryById(npc.monsterStatBlock, entryId);
        if (!entry) return false;
        const config = getEntryAbilityConfig(entry);
        if (!config) return false; // untrackable → no-op
        const used = npc.abilityUsage?.[entryId] ?? 0;
        if (used >= config.maxUses) return false; // at max — no expenditure mutation

        // Atomic combined cost: validate and resolve BEFORE mutating anything.
        const cost = entry.resourceCost;
        let nextResources = npc.resources;
        if (cost) {
          if (!isValidResourceAmount(cost.amount)) return false; // malformed cost — atomic rejection
          const resource = npc.resources?.find(r => r.id === cost.resourceId);
          if (!resource) return false; // missing resource — neither counter moves
          if (resource.maxUses - resource.usesExpended < cost.amount) {
            return false; // insufficient — neither counter moves
          }
          nextResources = npc.resources!.map(r =>
            r.id === cost.resourceId
              ? { ...r, usesExpended: r.usesExpended + cost.amount }
              : r
          );
        }

        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(n =>
                n.id === npcId
                  ? {
                      ...n,
                      abilityUsage: {
                        ...(n.abilityUsage ?? {}),
                        [entryId]: used + 1,
                      },
                      resources: nextResources,
                      updatedAt: new Date().toISOString(),
                    }
                  : n
              ),
            },
          };
        });
        return true;
      },

      restoreNpcAbility: (campaignCode, npcId, entryId) => {
        const npc = get().getNPC(campaignCode, npcId);
        if (!npc) return;
        // Unknown/untrackable no-op rule: an orphaned usage key must not be
        // mutated when the entry was deleted or is no longer trackable.
        const entry = findEntryById(npc.monsterStatBlock, entryId);
        if (!entry || !getEntryAbilityConfig(entry)) return;
        const used = npc.abilityUsage?.[entryId] ?? 0;
        if (used <= 0) return;
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(n =>
                n.id === npcId
                  ? {
                      ...n,
                      abilityUsage: {
                        ...(n.abilityUsage ?? {}),
                        [entryId]: used - 1,
                      },
                      updatedAt: new Date().toISOString(),
                    }
                  : n
              ),
            },
          };
        });
      },

      shortRestNPC: (campaignCode, npcId) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(n =>
                n.id === npcId && (n.resources || n.abilityUsage)
                  ? {
                      ...n,
                      ...(n.resources
                        ? { resources: applyShortRest(n.resources) }
                        : {}),
                      ...(n.abilityUsage
                        ? {
                            abilityUsage: Object.fromEntries(
                              Object.entries(n.abilityUsage).map(
                                ([entryId, used]) => {
                                  const entry = findEntryById(
                                    n.monsterStatBlock,
                                    entryId
                                  );
                                  const config = entry
                                    ? getEntryAbilityConfig(entry)
                                    : null;
                                  return config?.restType === 'short'
                                    ? [entryId, 0]
                                    : [entryId, used];
                                }
                              )
                            ),
                          }
                        : {}),
                      updatedAt: new Date().toISOString(),
                    }
                  : n
              ),
            },
          };
        });
      },
    }),
    {
      name: NPC_STORAGE_KEY,
      skipHydration: isIndexedDbMigrationEnabled(),
      storage: createJSONStorage(() => createSafeStorage()),
      version: 4,
      migrate: migrateNpcPersistedState,
    }
  )
);

export default useNPCStore;
