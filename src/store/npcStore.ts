import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CampaignNPC } from '@/types/encounter';

const NPC_STORAGE_KEY = 'rollkeeper-npc-data';

function generateId(): string {
  return (
    'npc-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
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
