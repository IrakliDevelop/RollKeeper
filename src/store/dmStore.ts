import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { isIndexedDbMigrationEnabled } from '@/lib/indexeddb/persistenceBootstrap';
import { CampaignInfo } from '@/types/campaign';
import { createCampaignSettingsAwareDmStorage } from '@/lib/durableDm/campaignSettingsAwareStorage';

const DM_STORAGE_KEY = 'rollkeeper-dm-data';

interface DmStoreState {
  dmId: string;
  campaigns: CampaignInfo[];

  addCampaign: (campaign: CampaignInfo) => void;
  removeCampaign: (code: string) => void;
  getCampaign: (code: string) => CampaignInfo | undefined;
  updateCampaign: (code: string, updates: Partial<CampaignInfo>) => void;
  setCustomCounterLabel: (code: string, label: string | undefined) => void;
  adjustPlayerCounter: (code: string, playerId: string, delta: number) => void;
  setPlayerCounter: (code: string, playerId: string, value: number) => void;
  setPlayerColor: (
    code: string,
    playerCharacterId: string,
    color: string | undefined
  ) => void;
  getPlayerColor: (
    code: string,
    playerCharacterId: string
  ) => string | undefined;
  /** Merge-persist DM dashboard section state on the campaign page. */
  setDmDashboardUi: (
    code: string,
    partial: Partial<{
      playersSectionOpen: boolean;
      houseRulesSectionOpen: boolean;
      npcSectionOpen: boolean;
      magicItemLibrarySectionOpen: boolean;
      npcCollapsedGroupNames: string[];
      npcInlineSpellSlots: boolean;
      npcSeparateSpellSlotTracker: boolean;
    }>
  ) => void;
}

function generateDmId(): string {
  return 'dm-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export const useDmStore = create<DmStoreState>()(
  persist(
    (set, get) => ({
      dmId: generateDmId(),
      campaigns: [],

      addCampaign: (campaign: CampaignInfo) => {
        set(state => ({
          campaigns: [...state.campaigns, campaign],
        }));
      },

      removeCampaign: (code: string) => {
        set(state => ({
          campaigns: state.campaigns.filter(c => c.code !== code),
        }));
      },

      getCampaign: (code: string) => {
        return get().campaigns.find(c => c.code === code);
      },

      updateCampaign: (code, updates) => {
        set(state => ({
          campaigns: state.campaigns.map(c =>
            c.code === code ? { ...c, ...updates } : c
          ),
        }));
      },

      setCustomCounterLabel: (code, label) => {
        set(state => ({
          campaigns: state.campaigns.map(c =>
            c.code === code ? { ...c, customCounterLabel: label } : c
          ),
        }));
      },

      adjustPlayerCounter: (code, playerId, delta) => {
        set(state => ({
          campaigns: state.campaigns.map(c => {
            if (c.code !== code) return c;
            const current = c.playerCounters?.[playerId] ?? 0;
            return {
              ...c,
              playerCounters: {
                ...c.playerCounters,
                [playerId]: Math.max(0, current + delta),
              },
            };
          }),
        }));
      },

      setPlayerCounter: (code, playerId, value) => {
        set(state => ({
          campaigns: state.campaigns.map(c => {
            if (c.code !== code) return c;
            return {
              ...c,
              playerCounters: {
                ...c.playerCounters,
                [playerId]: Math.max(0, value),
              },
            };
          }),
        }));
      },

      setPlayerColor: (code, playerCharacterId, color) => {
        set(state => ({
          campaigns: state.campaigns.map(c => {
            if (c.code !== code) return c;
            const colors = { ...c.playerColors };
            if (color) {
              colors[playerCharacterId] = color;
            } else {
              delete colors[playerCharacterId];
            }
            return { ...c, playerColors: colors };
          }),
        }));
      },

      getPlayerColor: (code, playerCharacterId) => {
        const campaign = get().campaigns.find(c => c.code === code);
        return campaign?.playerColors?.[playerCharacterId];
      },

      setDmDashboardUi: (code, partial) => {
        set(state => ({
          campaigns: state.campaigns.map(c => {
            if (c.code !== code) return c;
            return {
              ...c,
              dmDashboardUi: {
                ...c.dmDashboardUi,
                ...partial,
              },
            };
          }),
        }));
      },
    }),
    {
      name: DM_STORAGE_KEY,
      skipHydration: isIndexedDbMigrationEnabled(),
      storage: createJSONStorage(() => createCampaignSettingsAwareDmStorage()),
      version: 1,
    }
  )
);

export default useDmStore;
