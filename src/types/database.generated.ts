export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      campaign_authority_records: {
        Row: {
          authority: string;
          axis: string;
          campaign_id: string;
          created_at: string;
          epoch: number;
          family: string;
          updated_at: string;
        };
        Insert: {
          authority: string;
          axis: string;
          campaign_id: string;
          created_at?: string;
          epoch: number;
          family: string;
          updated_at?: string;
        };
        Update: {
          authority?: string;
          axis?: string;
          campaign_id?: string;
          created_at?: string;
          epoch?: number;
          family?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_authority_records_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_character_links: {
        Row: {
          campaign_id: string;
          character_id: string;
          guest_subject_id: string | null;
          legacy_character_id: string | null;
          legacy_player_id: string | null;
          linked_at: string;
          member_id: string;
          status: string;
          unlinked_at: string | null;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          character_id: string;
          guest_subject_id?: string | null;
          legacy_character_id?: string | null;
          legacy_player_id?: string | null;
          linked_at?: string;
          member_id: string;
          status: string;
          unlinked_at?: string | null;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          character_id?: string;
          guest_subject_id?: string | null;
          legacy_character_id?: string | null;
          legacy_player_id?: string | null;
          linked_at?: string;
          member_id?: string;
          status?: string;
          unlinked_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_character_links_campaign_id_member_id_fkey';
            columns: ['campaign_id', 'member_id'];
            isOneToOne: false;
            referencedRelation: 'campaign_members';
            referencedColumns: ['campaign_id', 'user_id'];
          },
          {
            foreignKeyName: 'campaign_character_links_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_documents: {
        Row: {
          campaign_id: string;
          created_at: string;
          family: string;
          id: string;
          last_mutation_id: string;
          legacy_id: string;
          payload: Json | null;
          payload_fingerprint: string;
          schema_version: number;
          server_version: number;
          tombstoned: boolean;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          family: string;
          id?: string;
          last_mutation_id: string;
          legacy_id: string;
          payload?: Json | null;
          payload_fingerprint: string;
          schema_version: number;
          server_version: number;
          tombstoned?: boolean;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          family?: string;
          id?: string;
          last_mutation_id?: string;
          legacy_id?: string;
          payload?: Json | null;
          payload_fingerprint?: string;
          schema_version?: number;
          server_version?: number;
          tombstoned?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_documents_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_members: {
        Row: {
          campaign_id: string;
          created_at: string;
          joined_at: string;
          left_at: string | null;
          membership_epoch: number;
          removed_at: string | null;
          removed_by: string | null;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          joined_at?: string;
          left_at?: string | null;
          membership_epoch?: number;
          removed_at?: string | null;
          removed_by?: string | null;
          role: string;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          joined_at?: string;
          left_at?: string | null;
          membership_epoch?: number;
          removed_at?: string | null;
          removed_by?: string | null;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_members_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_workspace_claim_provenance: {
        Row: {
          authorization_id: string | null;
          campaign_id: string;
          claim_kind: string;
          claimant_id: string;
          claimed_at: string;
          proof_method: string;
          source_fingerprint: string | null;
        };
        Insert: {
          authorization_id?: string | null;
          campaign_id: string;
          claim_kind: string;
          claimant_id: string;
          claimed_at?: string;
          proof_method: string;
          source_fingerprint?: string | null;
        };
        Update: {
          authorization_id?: string | null;
          campaign_id?: string;
          claim_kind?: string;
          claimant_id?: string;
          claimed_at?: string;
          proof_method?: string;
          source_fingerprint?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_workspace_claim_provenance_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: true;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      campaigns: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_code: string;
          id: string;
          membership_authority: string;
          membership_cutover_epoch: number;
          name: string;
          owner_id: string;
          ownership_state: string;
          server_version: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_code: string;
          id: string;
          membership_authority?: string;
          membership_cutover_epoch?: number;
          name: string;
          owner_id: string;
          ownership_state?: string;
          server_version?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          display_code?: string;
          id?: string;
          membership_authority?: string;
          membership_cutover_epoch?: number;
          name?: string;
          owner_id?: string;
          ownership_state?: string;
          server_version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          client_revision: number;
          created_at: string;
          deleted_at: string | null;
          id: string;
          legacy_client_id: string;
          name: string;
          owner_id: string;
          payload: Json;
          schema_version: number;
          server_version: number;
          updated_at: string;
        };
        Insert: {
          client_revision: number;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          legacy_client_id: string;
          name: string;
          owner_id: string;
          payload: Json;
          schema_version: number;
          server_version: number;
          updated_at?: string;
        };
        Update: {
          client_revision?: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          legacy_client_id?: string;
          name?: string;
          owner_id?: string;
          payload?: Json;
          schema_version?: number;
          server_version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      mutation_receipts: {
        Row: {
          actor_id: string;
          character_id: string;
          created_at: string;
          mutation_id: string;
          operation: string;
          request_hash: string;
          result: Json;
        };
        Insert: {
          actor_id: string;
          character_id: string;
          created_at?: string;
          mutation_id: string;
          operation: string;
          request_hash: string;
          result: Json;
        };
        Update: {
          actor_id?: string;
          character_id?: string;
          created_at?: string;
          mutation_id?: string;
          operation?: string;
          request_hash?: string;
          result?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'mutation_receipts_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_campaign_membership_invitation: {
        Args: {
          p_decision: string;
          p_mutation_id: string;
          p_token_hash: string;
        };
        Returns: Json;
      };
      ack_campaign_document_projection_event: {
        Args: {
          p_event_id: string;
          p_projection_fingerprint: string;
          p_worker_id: string;
        };
        Returns: undefined;
      };
      authorize_campaign_guest_session: {
        Args: {
          p_display_code: string;
          p_required_scope: string;
          p_session_token_hash: string;
        };
        Returns: Json;
      };
      authorize_campaign_membership: {
        Args: { p_campaign_id: string; p_expected_epoch: number };
        Returns: Json;
      };
      begin_calendar_staging: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_record_count: number;
          p_recovery_manifest_hash: string;
          p_recovery_receipt_hash: string;
          p_total_bytes: number;
        };
        Returns: Json;
      };
      begin_campaign_membership_freeze: {
        Args: {
          p_campaign_id: string;
          p_manifest_fingerprint: string;
          p_manifest_version: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      begin_campaign_settings_staging: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_record_count: number;
          p_recovery_manifest_hash: string;
          p_recovery_receipt_hash: string;
          p_total_bytes: number;
        };
        Returns: Json;
      };
      begin_encounter_staging: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_record_count: number;
          p_recovery_manifest_hash: string;
          p_recovery_receipt_hash: string;
          p_total_bytes: number;
        };
        Returns: Json;
      };
      begin_magic_item_staging: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_record_count: number;
          p_recovery_manifest_hash: string;
          p_recovery_receipt_hash: string;
          p_total_bytes: number;
        };
        Returns: Json;
      };
      begin_npc_staging: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_record_count: number;
          p_recovery_manifest_hash: string;
          p_recovery_receipt_hash: string;
          p_total_bytes: number;
        };
        Returns: Json;
      };
      calendar_projection_status: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      campaign_document_projection_status: {
        Args: { p_campaign_id: string; p_family: string };
        Returns: Json;
      };
      cancel_campaign_membership_freeze: {
        Args: { p_campaign_id: string; p_mutation_id: string };
        Returns: Json;
      };
      claim_calendar_projection_events: {
        Args: { p_lease_seconds: number; p_limit: number; p_worker_id: string };
        Returns: {
          campaign_code: string;
          campaign_id: string;
          cutover_epoch: number;
          event_id: string;
          legacy_id: string;
          payload: Json;
          server_version: number;
          source_fingerprint: string;
          tombstoned: boolean;
        }[];
      };
      claim_campaign_document_projection_events: {
        Args: { p_lease_seconds: number; p_limit: number; p_worker_id: string };
        Returns: {
          campaign_code: string;
          campaign_id: string;
          cutover_epoch: number;
          event_id: string;
          legacy_id: string;
          payload: Json;
          server_version: number;
          source_fingerprint: string;
          tombstoned: boolean;
        }[];
      };
      claim_campaign_workspace: {
        Args: {
          p_authorization_token: string;
          p_legacy_source_fingerprint: string;
          p_mutation_id: string;
          p_name: string;
        };
        Returns: Json;
      };
      classify_campaign_membership_shadow: {
        Args: {
          p_campaign_id: string;
          p_classification: string;
          p_entry_kind: string;
          p_mutation_id: string;
          p_source_id: string;
        };
        Returns: Json;
      };
      compare_calendar_document_versions: {
        Args: {
          p_campaign_id: string;
          p_left: number;
          p_legacy_id: string;
          p_right: number;
        };
        Returns: Json;
      };
      compare_campaign_document_versions: {
        Args: {
          p_campaign_id: string;
          p_family: string;
          p_left: number;
          p_legacy_id: string;
          p_right: number;
        };
        Returns: Json;
      };
      compare_encounter_document_versions: {
        Args: {
          p_campaign_id: string;
          p_left: number;
          p_legacy_id: string;
          p_right: number;
        };
        Returns: Json;
      };
      compare_magic_item_document_versions: {
        Args: {
          p_campaign_id: string;
          p_left: number;
          p_legacy_id: string;
          p_right: number;
        };
        Returns: Json;
      };
      compare_npc_document_versions: {
        Args: {
          p_campaign_id: string;
          p_left: number;
          p_legacy_id: string;
          p_right: number;
        };
        Returns: Json;
      };
      confirm_calendar_cutover: {
        Args: {
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_run_id: string;
        };
        Returns: Json;
      };
      confirm_campaign_membership_cutover: {
        Args: {
          p_campaign_id: string;
          p_manifest_fingerprint: string;
          p_manifest_version: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      confirm_campaign_settings_cutover: {
        Args: {
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_run_id: string;
        };
        Returns: Json;
      };
      confirm_encounter_cutover: {
        Args: {
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_run_id: string;
        };
        Returns: Json;
      };
      confirm_magic_item_cutover: {
        Args: {
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_run_id: string;
        };
        Returns: Json;
      };
      confirm_npc_cutover: {
        Args: {
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_run_id: string;
        };
        Returns: Json;
      };
      consume_guest_rate_limit: {
        Args: {
          p_action: string;
          p_key_hash: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      create_campaign_workspace: {
        Args: {
          p_creation_kind: string;
          p_mutation_id: string;
          p_name: string;
          p_source_fingerprint: string;
        };
        Returns: Json;
      };
      enroll_calendar_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_legacy_candidate_fingerprint: string;
          p_mutation_id: string;
          p_preview_fingerprint: string;
        };
        Returns: Json;
      };
      enroll_campaign_settings_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_legacy_candidate_fingerprint: string;
          p_mutation_id: string;
          p_preview_fingerprint: string;
        };
        Returns: Json;
      };
      enroll_encounter_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_legacy_candidate_fingerprint: string;
          p_mutation_id: string;
          p_preview_fingerprint: string;
        };
        Returns: Json;
      };
      enroll_magic_item_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_legacy_candidate_fingerprint: string;
          p_mutation_id: string;
          p_preview_fingerprint: string;
        };
        Returns: Json;
      };
      enroll_npc_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_legacy_candidate_fingerprint: string;
          p_mutation_id: string;
          p_preview_fingerprint: string;
        };
        Returns: Json;
      };
      export_calendar_document_version: {
        Args: {
          p_campaign_id: string;
          p_legacy_id: string;
          p_server_version: number;
        };
        Returns: Json;
      };
      export_campaign_document_version: {
        Args: {
          p_campaign_id: string;
          p_family: string;
          p_legacy_id: string;
          p_server_version: number;
        };
        Returns: Json;
      };
      export_encounter_document_version: {
        Args: {
          p_campaign_id: string;
          p_legacy_id: string;
          p_server_version: number;
        };
        Returns: Json;
      };
      export_magic_item_document_version: {
        Args: {
          p_campaign_id: string;
          p_legacy_id: string;
          p_server_version: number;
        };
        Returns: Json;
      };
      export_npc_document_version: {
        Args: {
          p_campaign_id: string;
          p_legacy_id: string;
          p_server_version: number;
        };
        Returns: Json;
      };
      fail_calendar_projection_event: {
        Args: {
          p_error_code: string;
          p_event_id: string;
          p_incident_kind: string;
          p_worker_id: string;
        };
        Returns: undefined;
      };
      fail_campaign_document_projection_event: {
        Args: {
          p_error_code: string;
          p_event_id: string;
          p_incident_kind: string;
          p_worker_id: string;
        };
        Returns: undefined;
      };
      issue_campaign_guest_invitation: {
        Args: {
          p_campaign_id: string;
          p_expires_at: string;
          p_legacy_player_id: string;
          p_max_uses: number;
          p_mutation_id: string;
          p_token_hash: string;
        };
        Returns: Json;
      };
      issue_campaign_membership_invitation: {
        Args: {
          p_campaign_id: string;
          p_expires_at: string;
          p_guest_subject_id: string;
          p_invited_account_id: string;
          p_legacy_player_id: string;
          p_max_uses: number;
          p_mutation_id: string;
          p_role: string;
          p_token_hash: string;
        };
        Returns: Json;
      };
      link_campaign_character: {
        Args: {
          p_campaign_id: string;
          p_character_id: string;
          p_guest_subject_id: string;
          p_legacy_character_id: string;
          p_legacy_player_id: string;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      list_calendar_document_versions: {
        Args: { p_campaign_id: string; p_legacy_id: string };
        Returns: Json;
      };
      list_calendar_projection_incidents: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      list_campaign_document_projection_incidents: {
        Args: { p_campaign_id: string; p_family: string };
        Returns: Json;
      };
      list_campaign_document_versions: {
        Args: { p_campaign_id: string; p_family: string; p_legacy_id: string };
        Returns: Json;
      };
      list_campaign_guest_access: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      list_encounter_document_versions: {
        Args: { p_campaign_id: string; p_legacy_id: string };
        Returns: Json;
      };
      list_magic_item_document_versions: {
        Args: { p_campaign_id: string; p_legacy_id: string };
        Returns: Json;
      };
      list_my_campaign_memberships: { Args: never; Returns: Json };
      list_npc_document_versions: {
        Args: { p_campaign_id: string; p_legacy_id: string };
        Returns: Json;
      };
      prepare_campaign_membership_manifest: {
        Args: { p_campaign_id: string; p_mutation_id: string };
        Returns: Json;
      };
      preview_calendar_device_enrollment: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      preview_campaign_settings_device_enrollment: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      preview_encounter_device_enrollment: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      preview_magic_item_device_enrollment: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      preview_npc_device_enrollment: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      put_calendar_document: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_legacy_id: string;
          p_mutation_id: string;
          p_operation: string;
          p_payload: Json;
          p_payload_fingerprint: string;
          p_restore_source_version?: number;
          p_schema_version: number;
        };
        Returns: Json;
      };
      put_campaign_document: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_family: string;
          p_legacy_id: string;
          p_mutation_id: string;
          p_operation: string;
          p_payload: Json;
          p_payload_fingerprint: string;
          p_restore_source_version?: number;
          p_schema_version: number;
        };
        Returns: Json;
      };
      put_character: {
        Args: {
          p_character_id: string;
          p_client_revision: number;
          p_expected_server_version: number;
          p_legacy_client_id: string;
          p_mutation_id: string;
          p_name: string;
          p_payload: Json;
          p_schema_version: number;
        };
        Returns: Json;
      };
      put_encounter_document: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_legacy_id: string;
          p_mutation_id: string;
          p_operation: string;
          p_payload: Json;
          p_payload_fingerprint: string;
          p_restore_source_version?: number;
          p_schema_version: number;
        };
        Returns: Json;
      };
      put_magic_item_document: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_legacy_id: string;
          p_mutation_id: string;
          p_operation: string;
          p_payload: Json;
          p_payload_fingerprint: string;
          p_restore_source_version?: number;
          p_schema_version: number;
        };
        Returns: Json;
      };
      put_npc_document: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_legacy_id: string;
          p_mutation_id: string;
          p_operation: string;
          p_payload: Json;
          p_payload_fingerprint: string;
          p_restore_source_version?: number;
          p_schema_version: number;
        };
        Returns: Json;
      };
      redeem_campaign_guest_invitation: {
        Args: {
          p_mutation_id: string;
          p_request_hash: string;
          p_session_expires_at: string;
          p_session_token_hash: string;
          p_subject_id: string;
          p_token_hash: string;
        };
        Returns: Json;
      };
      remove_calendar_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      remove_campaign_member: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_legacy_player_id: string;
          p_member_id: string;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      remove_campaign_settings_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      remove_encounter_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      remove_magic_item_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      remove_npc_device: {
        Args: {
          p_campaign_id: string;
          p_device_id: string;
          p_expected_epoch: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      repair_campaign_document_current_from_history: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_latest_fingerprint: string;
          p_expected_latest_version: number;
          p_family: string;
          p_legacy_id: string;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      replace_campaign_membership_shadow: {
        Args: {
          p_campaign_id: string;
          p_entries: Json;
          p_mutation_id: string;
          p_owner_id: string;
        };
        Returns: Json;
      };
      replay_calendar_projection_event: {
        Args: {
          p_campaign_id: string;
          p_event_id: string;
          p_expected_epoch: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      replay_campaign_document_projection_event: {
        Args: {
          p_campaign_id: string;
          p_event_id: string;
          p_expected_epoch: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      replay_campaign_membership_cutover: {
        Args: {
          p_campaign_id: string;
          p_manifest_fingerprint: string;
          p_manifest_version: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      resolve_calendar_projection_authority: {
        Args: { p_campaign_code: string };
        Returns: Json;
      };
      resolve_campaign_membership_authority: {
        Args: { p_display_code: string };
        Returns: Json;
      };
      resolve_campaign_settings_projection_authority: {
        Args: { p_campaign_code: string };
        Returns: Json;
      };
      restore_calendar_document_version: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_legacy_id: string;
          p_mutation_id: string;
          p_source_version: number;
        };
        Returns: Json;
      };
      restore_campaign_document_version: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_family: string;
          p_legacy_id: string;
          p_mutation_id: string;
          p_source_version: number;
        };
        Returns: Json;
      };
      restore_character: {
        Args: {
          p_character_id: string;
          p_expected_server_version: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      restore_encounter_document_version: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_legacy_id: string;
          p_mutation_id: string;
          p_source_version: number;
        };
        Returns: Json;
      };
      restore_magic_item_document_version: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_legacy_id: string;
          p_mutation_id: string;
          p_source_version: number;
        };
        Returns: Json;
      };
      restore_npc_document_version: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_expected_server_version: number;
          p_legacy_id: string;
          p_mutation_id: string;
          p_source_version: number;
        };
        Returns: Json;
      };
      revoke_campaign_guest_invitation: {
        Args: { p_invitation_id: string; p_mutation_id: string };
        Returns: Json;
      };
      revoke_campaign_guest_session: {
        Args: { p_mutation_id: string; p_session_id: string };
        Returns: Json;
      };
      revoke_campaign_membership_invitation: {
        Args: { p_invitation_id: string; p_mutation_id: string };
        Returns: Json;
      };
      rollback_calendar_family: {
        Args: {
          p_campaign_id: string;
          p_current_generation: Json;
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_projection_journal_reconciled: boolean;
        };
        Returns: Json;
      };
      rollback_campaign_membership: {
        Args: {
          p_campaign_id: string;
          p_expected_epoch: number;
          p_generation: Json;
          p_generation_fingerprint: string;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      rollback_campaign_settings_family: {
        Args: {
          p_campaign_id: string;
          p_current_generation: Json;
          p_expected_epoch: number;
          p_manifest_fingerprint: string;
          p_mutation_id: string;
          p_projection_journal_reconciled: boolean;
        };
        Returns: Json;
      };
      rollback_encounter_family: {
        Args: {
          p_campaign_id: string;
          p_current_generation: Json;
          p_expected_epoch: number;
          p_mutation_id: string;
          p_preview_fingerprint: string;
        };
        Returns: Json;
      };
      rollback_magic_item_family: {
        Args: {
          p_campaign_id: string;
          p_current_generation: Json;
          p_expected_epoch: number;
          p_mutation_id: string;
          p_preview_fingerprint: string;
        };
        Returns: Json;
      };
      rollback_npc_family: {
        Args: {
          p_campaign_id: string;
          p_current_generation: Json;
          p_expected_epoch: number;
          p_mutation_id: string;
          p_preview_fingerprint: string;
        };
        Returns: Json;
      };
      rotate_campaign_guest_session: {
        Args: {
          p_current_token_hash: string;
          p_mutation_id: string;
          p_new_expires_at: string;
          p_new_token_hash: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      soft_delete_character: {
        Args: {
          p_character_id: string;
          p_expected_server_version: number;
          p_mutation_id: string;
        };
        Returns: Json;
      };
      stage_calendar_items: {
        Args: { p_items: Json; p_mutation_id: string; p_run_id: string };
        Returns: Json;
      };
      stage_campaign_settings_items: {
        Args: { p_items: Json; p_mutation_id: string; p_run_id: string };
        Returns: Json;
      };
      stage_encounter_items: {
        Args: { p_items: Json; p_mutation_id: string; p_run_id: string };
        Returns: Json;
      };
      stage_magic_item_items: {
        Args: { p_items: Json; p_mutation_id: string; p_run_id: string };
        Returns: Json;
      };
      stage_npc_items: {
        Args: { p_items: Json; p_mutation_id: string; p_run_id: string };
        Returns: Json;
      };
      unlink_campaign_character: {
        Args: {
          p_campaign_id: string;
          p_character_id: string;
          p_mutation_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
