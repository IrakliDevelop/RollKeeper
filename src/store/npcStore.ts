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
  npcs: CampaignNPC[];

  createNPC: (
    npc: Omit<CampaignNPC, 'id' | 'createdAt' | 'updatedAt'>
  ) => string;
  updateNPC: (id: string, updates: Partial<CampaignNPC>) => void;
  deleteNPC: (id: string) => void;
  getNPC: (id: string) => CampaignNPC | undefined;
}

export const useNPCStore = create<NPCStoreState>()(
  persist(
    (set, get) => ({
      npcs: [],

      createNPC: npcData => {
        const id = generateId();
        const now = new Date().toISOString();
        const npc: CampaignNPC = {
          ...npcData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set(state => ({ npcs: [...state.npcs, npc] }));
        return id;
      },

      updateNPC: (id, updates) => {
        set(state => ({
          npcs: state.npcs.map(npc =>
            npc.id === id
              ? { ...npc, ...updates, updatedAt: new Date().toISOString() }
              : npc
          ),
        }));
      },

      deleteNPC: id => {
        set(state => ({
          npcs: state.npcs.filter(npc => npc.id !== id),
        }));
      },

      getNPC: id => {
        return get().npcs.find(npc => npc.id === id);
      },
    }),
    {
      name: NPC_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

export default useNPCStore;
