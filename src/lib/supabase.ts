import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client for browser/client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We'll handle auth with JWT
  },
});

// Admin client for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          username: string;
          password_hash: string;
          display_name: string | null;
          avatar_url: string | null;
          is_dm: boolean;
          preferences: any;
          created_at: string;
          updated_at: string;
          last_login: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          username: string;
          password_hash: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_dm?: boolean;
          preferences?: any;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          username?: string;
          password_hash?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_dm?: boolean;
          preferences?: any;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
        };
      };
      campaigns: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          dm_user_id: string;
          settings: any;
          is_active: boolean;
          invite_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          dm_user_id: string;
          settings?: any;
          is_active?: boolean;
          invite_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          dm_user_id?: string;
          settings?: any;
          is_active?: boolean;
          invite_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      characters: {
        Row: {
          id: string;
          name: string;
          owner_user_id: string;
          campaign_id: string | null;
          character_data: any;
          is_public: boolean;
          sync_status: string;
          last_synced: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_user_id: string;
          campaign_id?: string | null;
          character_data: any;
          is_public?: boolean;
          sync_status?: string;
          last_synced?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_user_id?: string;
          campaign_id?: string | null;
          character_data?: any;
          is_public?: boolean;
          sync_status?: string;
          last_synced?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      campaign_members: {
        Row: {
          id: string;
          campaign_id: string;
          user_id: string;
          character_id: string | null;
          role: string;
          joined_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          user_id: string;
          character_id?: string | null;
          role?: string;
          joined_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          user_id?: string;
          character_id?: string | null;
          role?: string;
          joined_at?: string;
          is_active?: boolean;
        };
      };
      realtime_sessions: {
        Row: {
          id: string;
          campaign_id: string;
          session_type: string;
          session_data: any;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          session_type: string;
          session_data?: any;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          session_type?: string;
          session_data?: any;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      character_updates: {
        Row: {
          id: string;
          character_id: string;
          campaign_id: string;
          update_type: string;
          update_data: any;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          character_id: string;
          campaign_id: string;
          update_type: string;
          update_data: any;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          character_id?: string;
          campaign_id?: string;
          update_type?: string;
          update_data?: any;
          created_by?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

export type User = Database['public']['Tables']['users']['Row'];
export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type Character = Database['public']['Tables']['characters']['Row'];
export type CampaignMember = Database['public']['Tables']['campaign_members']['Row'];
export type RealtimeSession = Database['public']['Tables']['realtime_sessions']['Row'];
export type CharacterUpdate = Database['public']['Tables']['character_updates']['Row'];
