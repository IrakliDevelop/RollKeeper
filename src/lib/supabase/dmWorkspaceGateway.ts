import type { Json } from '@/types/database.generated';

import type {
  DmWorkspaceCreateRequest,
  DmWorkspaceGateway,
} from './dmWorkspaceService';

interface SupabaseErrorShape {
  code?: string;
  message: string;
}

interface SupabaseResult {
  data: unknown;
  error: SupabaseErrorShape | null;
}

export interface SupabaseDmWorkspaceClient {
  rpc(
    name: 'create_campaign_workspace',
    args: Record<string, Json | undefined>
  ): Promise<SupabaseResult>;
}

export class DmWorkspaceGatewayError extends Error {
  constructor(
    message: string,
    readonly category: 'auth-required' | 'offline' | 'failed'
  ) {
    super(message);
    this.name = 'DmWorkspaceGatewayError';
  }
}

function throwForError(error: SupabaseErrorShape | null): void {
  if (!error) return;
  const authRequired =
    error.code === 'PGRST301' || /jwt|auth|session/i.test(error.message);
  const offline =
    !authRequired &&
    /failed to fetch|network(?:error| request failed)|load failed/i.test(
      error.message
    );
  throw new DmWorkspaceGatewayError(
    authRequired
      ? 'Your session expired. Sign in and retry.'
      : offline
        ? 'Network unavailable'
        : error.message,
    authRequired ? 'auth-required' : offline ? 'offline' : 'failed'
  );
}

function validateResponse(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    throw new DmWorkspaceGatewayError(
      'Cloud workspace returned an invalid response',
      'failed'
    );
  }
  const value = data as Record<string, unknown>;
  if (
    typeof value.campaignId !== 'string' ||
    typeof value.displayCode !== 'string' ||
    !/^[A-F0-9]{12}$/u.test(value.displayCode) ||
    value.membershipAuthority !== 'legacy' ||
    value.familyAuthorities !== 'legacy' ||
    value.liveRuntimeAuthority !== 'redis_relay'
  ) {
    throw new DmWorkspaceGatewayError(
      'Cloud workspace returned an invalid authority response',
      'failed'
    );
  }
  return {
    campaignId: value.campaignId,
    displayCode: value.displayCode,
    membershipAuthority: 'legacy' as const,
    familyAuthorities: 'legacy' as const,
    liveRuntimeAuthority: 'redis_relay' as const,
  };
}

export function createSupabaseDmWorkspaceGateway(
  client: SupabaseDmWorkspaceClient
): DmWorkspaceGateway {
  return {
    async create(request: DmWorkspaceCreateRequest) {
      const { data, error } = await client.rpc('create_campaign_workspace', {
        p_mutation_id: request.mutationId,
        p_name: request.name,
        p_creation_kind: request.creationKind,
        p_source_fingerprint: request.sourceFingerprint,
      });
      throwForError(error);
      return validateResponse(data);
    },
  };
}
