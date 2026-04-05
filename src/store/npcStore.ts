import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CampaignNPC } from '@/types/encounter';
import { Spell } from '@/types/character';
import {
  getNPCSpellSlots,
  resetNPCSpellcasting,
} from '@/utils/npcSpellcasting';

const NPC_STORAGE_KEY = 'rollkeeper-npc-data';

function generateId(): string {
  return (
    'npc-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
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
}

export const useNPCStore = create<NPCStoreState>()(
  persist(
    (set, get) => ({
      npcsByCampaign: {},

      createNPC: (campaignCode, npcData) => {
        const id = generateId();
        const now = new Date().toISOString();
        const npc: CampaignNPC = {
          ...npcData,
          id,
          campaignCode,
          createdAt: now,
          updatedAt: now,
        };
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

      updateNPC: (campaignCode, id, updates) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc =>
                npc.id === id
                  ? { ...npc, ...updates, updatedAt: new Date().toISOString() }
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
                  updatedAt: new Date().toISOString(),
                };
              }),
            },
          };
        });
      },
    }),
    {
      name: NPC_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        if (version < 2) {
          const old = persisted as { npcs?: CampaignNPC[] } | null;
          const legacyNpcs = old?.npcs ?? [];
          const npcsByCampaign: Record<string, CampaignNPC[]> = {};

          for (const npc of legacyNpcs) {
            const code =
              (npc as CampaignNPC & { campaignCode?: string }).campaignCode ??
              '_legacy';
            if (!npcsByCampaign[code]) npcsByCampaign[code] = [];
            npcsByCampaign[code].push({ ...npc, campaignCode: code });
          }

          return { npcsByCampaign };
        }
        return persisted as NPCStoreState;
      },
    }
  )
);

export default useNPCStore;
