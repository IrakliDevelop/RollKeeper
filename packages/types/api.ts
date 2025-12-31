import { Request } from 'express';

/**
 * Extended Express Request with authenticated user
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
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
 * User Profile
 */
export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
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
  character_ref_id?: string; // Reference to character (if player_character)
  name: string;
  stats: ParticipantStats;
  initiative: number;
  initiative_bonus: number;
  position: number; // Order in initiative
  is_active: boolean;
  is_hidden: boolean; // DM can hide enemies
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
 * Socket.io event types
 */
export interface SocketEvents {
  // Client → Server
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

  // Server → Client
  encounter_state_updated: (data: Encounter) => void;
  participant_added: (data: EncounterParticipant) => void;
  participant_updated: (data: EncounterParticipant) => void;
  participant_removed: (data: { participantId: string }) => void;
  initiative_rolled: (data: { participants: EncounterParticipant[] }) => void;
  turn_advanced: (data: { currentTurnIndex: number }) => void;
  round_completed: (data: { roundNumber: number }) => void;
}
