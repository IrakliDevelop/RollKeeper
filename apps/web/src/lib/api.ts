import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * API client that automatically attaches the Supabase auth token
 */
async function apiFetch<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<{
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  return response.json();
}

/**
 * Campaign API
 */
export const campaignApi = {
  list: () => apiFetch('/api/campaigns'),

  create: (data: { name: string; description?: string }) =>
    apiFetch('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => apiFetch(`/api/campaigns/${id}`),

  update: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/api/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' }),

  join: (inviteCode: string) =>
    apiFetch('/api/campaigns/join', {
      method: 'POST',
      body: JSON.stringify({ invite_code: inviteCode }),
    }),

  leave: (id: string) =>
    apiFetch(`/api/campaigns/${id}/leave`, { method: 'POST' }),

  getMembers: (id: string) => apiFetch(`/api/campaigns/${id}/members`),

  removeMember: (campaignId: string, userId: string) =>
    apiFetch(`/api/campaigns/${campaignId}/members/${userId}`, {
      method: 'DELETE',
    }),

  regenerateCode: (id: string) =>
    apiFetch(`/api/campaigns/${id}/regenerate-code`, { method: 'POST' }),
};

/**
 * Character API (campaign-scoped)
 */
export const characterApi = {
  listForCampaign: (campaignId: string) =>
    apiFetch(`/api/campaigns/${campaignId}/characters`),

  getSnapshot: (campaignId: string, characterId: string) =>
    apiFetch(`/api/campaigns/${campaignId}/characters/${characterId}`),

  sync: (
    campaignId: string,
    characterId: string,
    characterSnapshot: Record<string, unknown>
  ) =>
    apiFetch(`/api/campaigns/${campaignId}/characters/sync`, {
      method: 'POST',
      body: JSON.stringify({
        character_id: characterId,
        character_snapshot: characterSnapshot,
      }),
    }),

  remove: (campaignId: string, characterId: string) =>
    apiFetch(`/api/campaigns/${campaignId}/characters/${characterId}`, {
      method: 'DELETE',
    }),
};

/**
 * Profile API
 */
export const profileApi = {
  get: () => apiFetch('/api/profile'),

  update: (data: { username?: string; display_name?: string; role?: string }) =>
    apiFetch('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
