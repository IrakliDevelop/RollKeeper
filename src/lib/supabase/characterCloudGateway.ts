import type { Json } from '@/types/database.generated';

import type { CharacterCloudRow } from './characterCloudCodec';
import type {
  CharacterCloudGateway,
  CharacterMutationRequest,
  CharacterMutationResult,
  PutCharacterRequest,
} from './manualCharacterCloudService';

interface SupabaseErrorShape {
  code?: string;
  message: string;
}

interface SupabaseResult {
  data: unknown;
  error: SupabaseErrorShape | null;
}

interface SingleCharacterQuery {
  maybeSingle(): Promise<SupabaseResult>;
}

interface SelectedCharacterQuery {
  eq(column: string, value: string): SingleCharacterQuery;
  order(
    column: string,
    options: { ascending: boolean }
  ): Promise<SupabaseResult>;
}

interface CharacterTableQuery {
  select(columns: string): SelectedCharacterQuery;
}

export interface SupabaseCharacterClient {
  rpc(
    name: string,
    args: Record<string, Json | undefined>
  ): Promise<SupabaseResult>;
  from(table: 'characters'): CharacterTableQuery;
}

export class CharacterCloudGatewayError extends Error {
  constructor(
    message: string,
    readonly category: 'auth-required' | 'offline' | 'failed'
  ) {
    super(message);
    this.name = 'CharacterCloudGatewayError';
  }
}

const CHARACTER_COLUMNS =
  'id,legacy_client_id,name,payload,schema_version,client_revision,server_version,deleted_at,created_at,updated_at';

function throwForError(error: SupabaseErrorShape | null): void {
  if (!error) return;
  const authExpired =
    error.code === 'PGRST301' || /jwt|auth|session/i.test(error.message);
  const offline =
    !authExpired &&
    /failed to fetch|network(?:error| request failed)|load failed/i.test(
      error.message
    );
  throw new CharacterCloudGatewayError(
    authExpired
      ? 'Your session expired. Sign in and retry.'
      : offline
        ? 'Network unavailable'
        : error.message,
    authExpired ? 'auth-required' : offline ? 'offline' : 'failed'
  );
}

function mutationResult(data: unknown): CharacterMutationResult {
  if (typeof data !== 'object' || data === null) {
    throw new CharacterCloudGatewayError(
      'Cloud mutation returned an invalid response',
      'failed'
    );
  }
  const value = data as Record<string, unknown>;
  if (
    !['success', 'conflict', 'tombstoned'].includes(String(value.status)) ||
    typeof value.characterId !== 'string' ||
    typeof value.serverVersion !== 'number'
  ) {
    throw new CharacterCloudGatewayError(
      'Cloud mutation returned an invalid response',
      'failed'
    );
  }
  return value as unknown as CharacterMutationResult;
}

function row(data: unknown): CharacterCloudRow | null {
  if (data === null) return null;
  if (typeof data !== 'object') {
    throw new CharacterCloudGatewayError(
      'Cloud character returned an invalid row',
      'failed'
    );
  }
  return data as CharacterCloudRow;
}

async function callCharacterMutation(
  client: SupabaseCharacterClient,
  rpc: 'soft_delete_character' | 'restore_character',
  request: CharacterMutationRequest
): Promise<CharacterMutationResult> {
  const { data, error } = await client.rpc(rpc, {
    p_mutation_id: request.mutationId,
    p_character_id: request.cloudId,
    p_expected_server_version: request.expectedServerVersion,
  });
  throwForError(error);
  return mutationResult(data);
}

export function createSupabaseCharacterCloudGateway(
  client: SupabaseCharacterClient
): CharacterCloudGateway {
  return {
    async put(request: PutCharacterRequest) {
      const { data, error } = await client.rpc('put_character', {
        p_mutation_id: request.mutationId,
        p_character_id: request.cloudId,
        p_legacy_client_id: request.legacyId,
        p_name: request.name,
        p_payload: request.payload,
        p_schema_version: request.schemaVersion,
        p_client_revision: request.clientRevision,
        p_expected_server_version: request.expectedServerVersion,
      });
      throwForError(error);
      return mutationResult(data);
    },
    async fetch(cloudId) {
      const { data, error } = await client
        .from('characters')
        .select(CHARACTER_COLUMNS)
        .eq('id', cloudId)
        .maybeSingle();
      throwForError(error);
      return row(data);
    },
    async list() {
      const { data, error } = await client
        .from('characters')
        .select(CHARACTER_COLUMNS)
        .order('updated_at', { ascending: false });
      throwForError(error);
      if (!Array.isArray(data)) {
        throw new CharacterCloudGatewayError(
          'Cloud character list returned an invalid response',
          'failed'
        );
      }
      return data.map(item => row(item) as CharacterCloudRow);
    },
    archive(request) {
      return callCharacterMutation(client, 'soft_delete_character', request);
    },
    restore(request) {
      return callCharacterMutation(client, 'restore_character', request);
    },
  };
}
