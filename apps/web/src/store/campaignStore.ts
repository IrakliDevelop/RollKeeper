import { create } from 'zustand';
import { campaignApi, characterApi } from '@/lib/api';

/**
 * Types matching the backend API responses
 */
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  dm_id: string;
  invite_code: string;
  settings: {
    ruleSet: '2014' | '2024';
    allowPlayerInvites: boolean;
    publicViewEncounters: boolean;
    xpSharing: 'manual' | 'auto-split';
  };
  status: 'active' | 'paused' | 'archived';
  current_day: number;
  dm_display_name?: string;
  dm_username?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: 'player' | 'co_dm';
  status: 'invited' | 'active' | 'left';
  joined_at: string;
  username?: string;
  display_name?: string;
  email?: string;
}

export interface CharacterSummary {
  character_id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  hp_current: number;
  hp_max: number;
  ac: number;
  player_name?: string;
  last_synced_at: string;
}

interface CampaignStoreState {
  // Data
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  activeMembers: CampaignMember[];
  activeCharacters: CharacterSummary[];
  isDm: boolean;

  // UI state
  loading: boolean;
  error: string | null;

  // Actions
  fetchCampaigns: () => Promise<void>;
  createCampaign: (
    name: string,
    description?: string
  ) => Promise<Campaign | null>;
  fetchCampaignDetail: (id: string) => Promise<void>;
  updateCampaign: (
    id: string,
    updates: Record<string, unknown>
  ) => Promise<void>;
  deleteCampaign: (id: string) => Promise<boolean>;
  joinCampaign: (
    inviteCode: string
  ) => Promise<{ campaign?: Campaign; error?: string }>;
  leaveCampaign: (id: string) => Promise<void>;
  fetchCharacters: (campaignId: string) => Promise<void>;
  updateCharacterSummary: (summary: CharacterSummary) => void;
  clearActive: () => void;
  clearError: () => void;
}

export const useCampaignStore = create<CampaignStoreState>()((set, get) => ({
  campaigns: [],
  activeCampaign: null,
  activeMembers: [],
  activeCharacters: [],
  isDm: false,
  loading: false,
  error: null,

  fetchCampaigns: async () => {
    set({ loading: true, error: null });
    try {
      const result = await campaignApi.list();
      if (result.success) {
        const data = result.data as { campaigns: Campaign[] };
        set({ campaigns: data.campaigns, loading: false });
      } else {
        set({
          error: result.error?.message || 'Failed to load campaigns',
          loading: false,
        });
      }
    } catch {
      set({ error: 'Network error', loading: false });
    }
  },

  createCampaign: async (name, description) => {
    set({ loading: true, error: null });
    try {
      const result = await campaignApi.create({ name, description });
      if (result.success) {
        const data = result.data as { campaign: Campaign };
        set(state => ({
          campaigns: [data.campaign, ...state.campaigns],
          loading: false,
        }));
        return data.campaign;
      } else {
        set({
          error: result.error?.message || 'Failed to create campaign',
          loading: false,
        });
        return null;
      }
    } catch {
      set({ error: 'Network error', loading: false });
      return null;
    }
  },

  fetchCampaignDetail: async id => {
    set({ loading: true, error: null });
    try {
      const result = await campaignApi.get(id);
      if (result.success) {
        const data = result.data as {
          campaign: Campaign;
          members: CampaignMember[];
          isDm: boolean;
        };
        set({
          activeCampaign: data.campaign,
          activeMembers: data.members,
          isDm: data.isDm,
          loading: false,
        });
        // Also fetch characters
        get().fetchCharacters(id);
      } else {
        set({
          error: result.error?.message || 'Failed to load campaign',
          loading: false,
        });
      }
    } catch {
      set({ error: 'Network error', loading: false });
    }
  },

  updateCampaign: async (id, updates) => {
    try {
      const result = await campaignApi.update(id, updates);
      if (result.success) {
        const data = result.data as { campaign: Campaign };
        set(state => ({
          activeCampaign: data.campaign,
          campaigns: state.campaigns.map(c =>
            c.id === id ? data.campaign : c
          ),
        }));
      }
    } catch {
      set({ error: 'Failed to update campaign' });
    }
  },

  deleteCampaign: async id => {
    try {
      const result = await campaignApi.delete(id);
      if (result.success) {
        set(state => ({
          campaigns: state.campaigns.filter(c => c.id !== id),
          activeCampaign:
            state.activeCampaign?.id === id ? null : state.activeCampaign,
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  joinCampaign: async inviteCode => {
    set({ loading: true, error: null });
    try {
      const result = await campaignApi.join(inviteCode);
      if (result.success) {
        const data = result.data as { campaign: Campaign };
        set(state => ({
          campaigns: [
            data.campaign,
            ...state.campaigns.filter(c => c.id !== data.campaign.id),
          ],
          loading: false,
        }));
        return { campaign: data.campaign };
      } else {
        const errorMsg = result.error?.message || 'Failed to join campaign';
        set({ error: errorMsg, loading: false });
        return { error: errorMsg };
      }
    } catch {
      set({ error: 'Network error', loading: false });
      return { error: 'Network error' };
    }
  },

  leaveCampaign: async id => {
    try {
      const result = await campaignApi.leave(id);
      if (result.success) {
        set(state => ({
          campaigns: state.campaigns.filter(c => c.id !== id),
          activeCampaign:
            state.activeCampaign?.id === id ? null : state.activeCampaign,
        }));
      }
    } catch {
      set({ error: 'Failed to leave campaign' });
    }
  },

  fetchCharacters: async campaignId => {
    try {
      const result = await characterApi.listForCampaign(campaignId);
      if (result.success) {
        const data = result.data as { characters: CharacterSummary[] };
        set({ activeCharacters: data.characters });
      }
    } catch {
      console.error('Failed to fetch characters');
    }
  },

  updateCharacterSummary: summary => {
    set(state => {
      const existing = state.activeCharacters.findIndex(
        c => c.character_id === summary.character_id
      );
      if (existing >= 0) {
        const updated = [...state.activeCharacters];
        updated[existing] = summary;
        return { activeCharacters: updated };
      }
      return { activeCharacters: [...state.activeCharacters, summary] };
    });
  },

  clearActive: () => {
    set({
      activeCampaign: null,
      activeMembers: [],
      activeCharacters: [],
      isDm: false,
    });
  },

  clearError: () => set({ error: null }),
}));
