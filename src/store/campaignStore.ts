import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  dm_user_id: string;
  settings: Record<string, unknown>;
  is_active: boolean;
  invite_code: string | null;
  created_at: string;
  updated_at: string;
  // Extended data from joins
  campaign_members?: CampaignMember[];
  memberCount?: number;
  userRole?: 'dm' | 'player' | 'co_dm';
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  character_id: string | null;
  role: string;
  joined_at: string;
  is_active: boolean;
  users?: {
    id: string;
    username: string;
    display_name: string | null;
    is_dm: boolean;
  };
  characters?: {
    id: string;
    name: string;
    character_data: Record<string, unknown>;
  };
}

export interface CampaignInvite {
  campaignId: string;
  inviteCode: string;
  characterId?: string;
}

interface CampaignState {
  // Data
  campaigns: Campaign[];
  activeCampaignId: string | null;
  isLoading: boolean;
  error: string | null;

  // Computed getters
  getActiveCampaign: () => Campaign | null;
  getCampaignById: (id: string) => Campaign | null;
  getUserCampaigns: () => Campaign[];
  getDMCampaigns: () => Campaign[];
  getPlayerCampaigns: () => Campaign[];

  // Actions - Campaign Management
  fetchCampaigns: () => Promise<void>;
  createCampaign: (name: string, description?: string, settings?: Record<string, unknown>) => Promise<Campaign | null>;
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<Campaign | null>;
  deleteCampaign: (id: string) => Promise<boolean>;

  // Actions - Membership
  joinCampaign: (invite: CampaignInvite) => Promise<boolean>;
  leaveCampaign: (campaignId: string) => Promise<boolean>;
  removeMember: (campaignId: string, memberId: string) => Promise<boolean>;
  
  // Actions - UI State
  setActiveCampaign: (campaignId: string | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;

  // Actions - Real-time updates
  updateCampaignFromRealtime: (campaign: Campaign) => void;
  addMemberFromRealtime: (campaignId: string, member: CampaignMember) => void;
  removeMemberFromRealtime: (campaignId: string, userId: string) => void;
}

export const useCampaignStore = create<CampaignState>()(
  persist(
    (set, get) => ({
      // Initial state
      campaigns: [],
      activeCampaignId: null,
      isLoading: false,
      error: null,

      // Computed getters
      getActiveCampaign: () => {
        const { campaigns, activeCampaignId } = get();
        return activeCampaignId 
          ? campaigns.find(c => c.id === activeCampaignId) || null
          : null;
      },

      getCampaignById: (id: string) => {
        return get().campaigns.find(c => c.id === id) || null;
      },

      getUserCampaigns: () => {
        return get().campaigns.filter(c => c.is_active);
      },

      getDMCampaigns: () => {
        return get().campaigns.filter(c => c.userRole === 'dm' && c.is_active);
      },

      getPlayerCampaigns: () => {
        return get().campaigns.filter(c => c.userRole === 'player' && c.is_active);
      },

      // Campaign Management
      fetchCampaigns: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const token = localStorage.getItem('rollkeeper-auth');
          if (!token) {
            throw new Error('Not authenticated');
          }

          const authData = JSON.parse(token);
          const response = await fetch('/api/campaigns', {
            headers: {
              'Authorization': `Bearer ${authData.accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch campaigns');
          }

          const data = await response.json();
          
          // Add user role to each campaign
          // Use the JWT payload userId, not the user object id
          const currentUserId = authData.user.id; // This is the correct user ID
          const campaignsWithRole = data.campaigns.map((campaign: Campaign) => {
            const userRole = campaign.dm_user_id === currentUserId ? 'dm' : 'player';
            
            return {
              ...campaign,
              userRole,
              memberCount: campaign.campaign_members?.length || 0,
            };
          });

          set({ 
            campaigns: campaignsWithRole,
            isLoading: false 
          });

        } catch (error) {
          console.error('Error fetching campaigns:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch campaigns',
            isLoading: false 
          });
        }
      },

      createCampaign: async (name: string, description?: string, settings?: Record<string, unknown>) => {
        set({ isLoading: true, error: null });

        try {
          const token = localStorage.getItem('rollkeeper-auth');
          if (!token) {
            throw new Error('Not authenticated');
          }

          const authData = JSON.parse(token);
          const response = await fetch('/api/campaigns', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.accessToken}`,
            },
            body: JSON.stringify({ name, description, settings }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create campaign');
          }

          const data = await response.json();
          const newCampaign = {
            ...data.campaign,
            userRole: 'dm' as const,
            memberCount: 0,
          };

          set(state => ({
            campaigns: [...state.campaigns, newCampaign],
            activeCampaignId: newCampaign.id,
            isLoading: false,
          }));

          return newCampaign;

        } catch (error) {
          console.error('Error creating campaign:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create campaign',
            isLoading: false 
          });
          return null;
        }
      },

      updateCampaign: async (id: string, updates: Partial<Campaign>) => {
        set({ isLoading: true, error: null });

        try {
          const token = localStorage.getItem('rollkeeper-auth');
          if (!token) {
            throw new Error('Not authenticated');
          }

          const authData = JSON.parse(token);
          const response = await fetch(`/api/campaigns/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.accessToken}`,
            },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update campaign');
          }

          const data = await response.json();

          set(state => ({
            campaigns: state.campaigns.map(c => 
              c.id === id ? { ...c, ...data.campaign } : c
            ),
            isLoading: false,
          }));

          return data.campaign;

        } catch (error) {
          console.error('Error updating campaign:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update campaign',
            isLoading: false 
          });
          return null;
        }
      },

      deleteCampaign: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          const token = localStorage.getItem('rollkeeper-auth');
          if (!token) {
            throw new Error('Not authenticated');
          }

          const authData = JSON.parse(token);
          const response = await fetch(`/api/campaigns/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${authData.accessToken}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete campaign');
          }

          set(state => ({
            campaigns: state.campaigns.filter(c => c.id !== id),
            activeCampaignId: state.activeCampaignId === id ? null : state.activeCampaignId,
            isLoading: false,
          }));

          return true;

        } catch (error) {
          console.error('Error deleting campaign:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete campaign',
            isLoading: false 
          });
          return false;
        }
      },

      // Membership
      joinCampaign: async (invite: CampaignInvite) => {
        set({ isLoading: true, error: null });

        try {
          const token = localStorage.getItem('rollkeeper-auth');
          if (!token) {
            throw new Error('Not authenticated');
          }

          const authData = JSON.parse(token);
          // Use 'temp' as campaignId since we're finding by invite code
          const response = await fetch(`/api/campaigns/temp/join`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.accessToken}`,
            },
            body: JSON.stringify({
              inviteCode: invite.inviteCode,
              characterId: invite.characterId || null,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to join campaign');
          }

          const data = await response.json();
          const joinedCampaign = {
            ...data.campaign,
            userRole: 'player' as const,
            memberCount: (data.campaign.campaign_members?.length || 0) + 1,
          };

          set(state => ({
            campaigns: [...state.campaigns, joinedCampaign],
            activeCampaignId: joinedCampaign.id,
            isLoading: false,
          }));

          return true;

        } catch (error) {
          console.error('Error joining campaign:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to join campaign',
            isLoading: false 
          });
          return false;
        }
      },

      leaveCampaign: async (campaignId: string) => {
        set({ isLoading: true, error: null });

        try {
          const token = localStorage.getItem('rollkeeper-auth');
          if (!token) {
            throw new Error('Not authenticated');
          }

          const authData = JSON.parse(token);
          const response = await fetch(`/api/campaigns/${campaignId}/join`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${authData.accessToken}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to leave campaign');
          }

          set(state => ({
            campaigns: state.campaigns.filter(c => c.id !== campaignId),
            activeCampaignId: state.activeCampaignId === campaignId ? null : state.activeCampaignId,
            isLoading: false,
          }));

          return true;

        } catch (error) {
          console.error('Error leaving campaign:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to leave campaign',
            isLoading: false 
          });
          return false;
        }
      },

      removeMember: async (campaignId: string, memberId: string) => {
        set({ isLoading: true, error: null });

        try {
          const token = localStorage.getItem('rollkeeper-auth');
          if (!token) {
            throw new Error('Not authenticated');
          }

          const authData = JSON.parse(token);
          const response = await fetch(`/api/campaigns/${campaignId}/members/${memberId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${authData.accessToken}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to remove member');
          }

          await response.json(); // Consume the response

          // Update local campaign state to remove the member
          set(state => ({
            campaigns: state.campaigns.map(campaign => 
              campaign.id === campaignId
                ? {
                    ...campaign,
                    campaign_members: (campaign.campaign_members || []).filter(m => m.id !== memberId),
                    memberCount: Math.max(0, (campaign.memberCount || 0) - 1),
                  }
                : campaign
            ),
            isLoading: false,
          }));

          return true;
        } catch (error) {
          console.error('Error removing member:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to remove member',
            isLoading: false 
          });
          return false;
        }
      },

      // UI State
      setActiveCampaign: (campaignId: string | null) => {
        set({ activeCampaignId: campaignId });
      },

      clearError: () => {
        set({ error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      // Real-time updates
      updateCampaignFromRealtime: (campaign: Campaign) => {
        set(state => ({
          campaigns: state.campaigns.map(c => 
            c.id === campaign.id ? { ...c, ...campaign } : c
          ),
        }));
      },

      addMemberFromRealtime: (campaignId: string, member: CampaignMember) => {
        set(state => ({
          campaigns: state.campaigns.map(c => 
            c.id === campaignId 
              ? { 
                  ...c, 
                  campaign_members: [...(c.campaign_members || []), member],
                  memberCount: (c.memberCount || 0) + 1
                }
              : c
          ),
        }));
      },

      removeMemberFromRealtime: (campaignId: string, userId: string) => {
        set(state => ({
          campaigns: state.campaigns.map(c => 
            c.id === campaignId 
              ? { 
                  ...c, 
                  campaign_members: (c.campaign_members || []).filter(m => m.user_id !== userId),
                  memberCount: Math.max(0, (c.memberCount || 0) - 1)
                }
              : c
          ),
        }));
      },
    }),
    {
      name: 'rollkeeper-campaigns',
      partialize: (state) => ({
        campaigns: state.campaigns,
        activeCampaignId: state.activeCampaignId,
      }),
    }
  )
);
