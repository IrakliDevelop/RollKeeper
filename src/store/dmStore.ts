import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CampaignInfo } from '@/types/campaign';

const DM_STORAGE_KEY = 'rollkeeper-dm-data';

interface DmStoreState {
  dmId: string;
  campaigns: CampaignInfo[];

  addCampaign: (campaign: CampaignInfo) => void;
  removeCampaign: (code: string) => void;
  getCampaign: (code: string) => CampaignInfo | undefined;
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
    }),
    {
      name: DM_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

export default useDmStore;
