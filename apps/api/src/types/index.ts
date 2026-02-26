import { Request } from 'express';

/**
 * Extended Express Request with authenticated user
 */
export interface AuthRequest extends Request {
  user?: {
    id: string; // Our own user_profiles.id
    supabaseUid: string; // Supabase Auth user ID
    email: string;
    role?: string;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * User Profile (our own table, linked to Supabase Auth via supabase_uid)
 */
export interface UserProfile {
  id: string;
  supabase_uid: string;
  username?: string;
  display_name?: string;
  email?: string;
  role: 'player' | 'dm' | 'both';
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Campaign
 */
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  dm_id: string;
  invite_code: string;
  settings: CampaignSettings;
  status: 'active' | 'paused' | 'archived';
  current_day: number;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignSettings {
  ruleSet: '2014' | '2024';
  allowPlayerInvites: boolean;
  publicViewEncounters: boolean;
  xpSharing: 'manual' | 'auto-split';
}

/**
 * Campaign with joined DM profile info (for list views)
 */
export interface CampaignWithDm extends Campaign {
  dm_display_name?: string;
  dm_username?: string;
}

/**
 * Campaign Member
 */
export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: 'player' | 'co_dm';
  status: 'invited' | 'active' | 'left';
  joined_at: Date;
}

/**
 * Campaign member with user profile info (for member lists)
 */
export interface CampaignMemberWithProfile extends CampaignMember {
  username?: string;
  display_name?: string;
  email?: string;
}

/**
 * Character Reference (snapshot in campaign)
 */
export interface CharacterReference {
  id: string;
  campaign_id: string;
  player_id: string;
  character_id: string;
  character_snapshot: Record<string, unknown>;
  is_active: boolean;
  last_synced_at: Date;
  created_at: Date;
}

/**
 * Character summary (extracted from snapshot for quick display)
 */
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
  last_synced_at: Date;
}

/**
 * Encounter
 */
export interface Encounter {
  id: string;
  campaign_id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  round_number: number;
  current_turn_index: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Encounter Participant
 */
export interface EncounterParticipant {
  id: string;
  encounter_id: string;
  type: 'player_character' | 'npc' | 'monster';
  character_ref_id?: string;
  name: string;
  stats: ParticipantStats;
  initiative: number;
  initiative_bonus: number;
  position: number;
  is_active: boolean;
  is_hidden: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ParticipantStats {
  hp: {
    current: number;
    max: number;
    temp: number;
  };
  ac: number;
  conditions: string[];
  monster_id?: string;
  cr?: number;
  abilities?: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  notes?: string;
}

/**
 * Database query result helpers
 */
export type DbResult<T> = {
  rows: T[];
  rowCount: number;
};

/**
 * Pagination params
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Request body types
 */
export interface CreateCampaignBody {
  name: string;
  description?: string;
  settings?: Partial<CampaignSettings>;
}

export interface JoinCampaignBody {
  invite_code: string;
}

export interface SyncCharacterBody {
  character_id: string;
  character_snapshot: Record<string, unknown>;
}

/**
 * Socket.io event types
 */
export interface ServerToClientEvents {
  // Campaign events
  campaign_character_synced: (data: {
    campaignId: string;
    characterSummary: CharacterSummary;
  }) => void;
  campaign_member_joined: (data: {
    campaignId: string;
    member: CampaignMemberWithProfile;
  }) => void;

  // Encounter events
  encounter_state_updated: (data: Encounter) => void;
  participant_added: (data: EncounterParticipant) => void;
  participant_updated: (data: EncounterParticipant) => void;
  participant_removed: (data: { participantId: string }) => void;
  initiative_rolled: (data: { participants: EncounterParticipant[] }) => void;
  turn_advanced: (data: { currentTurnIndex: number }) => void;
  round_completed: (data: { roundNumber: number }) => void;
}

export interface ClientToServerEvents {
  // Campaign rooms
  join_campaign: (data: { campaignId: string }) => void;
  leave_campaign: (data: { campaignId: string }) => void;
  sync_character: (data: {
    campaignId: string;
    characterId: string;
    characterSnapshot: Record<string, unknown>;
  }) => void;

  // Encounter rooms
  join_encounter: (data: { encounterId: string }) => void;
  leave_encounter: (data: { encounterId: string }) => void;
  update_hp: (data: { participantId: string; newHp: number }) => void;
  add_condition: (data: { participantId: string; condition: string }) => void;
  remove_condition: (data: {
    participantId: string;
    condition: string;
  }) => void;
  roll_initiative: (data: { participantId: string; result: number }) => void;
  advance_turn: (data: { encounterId: string }) => void;
}
