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
      claim_campaign_workspace: {
        Args: {
          p_authorization_token: string;
          p_legacy_source_fingerprint: string;
          p_mutation_id: string;
          p_name: string;
        };
        Returns: Json;
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
      restore_character: {
        Args: {
          p_character_id: string;
          p_expected_server_version: number;
          p_mutation_id: string;
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
