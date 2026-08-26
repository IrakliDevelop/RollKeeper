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
  from?(table: 'campaigns' | 'campaign_workspace_claim_provenance'): {
    select(columns: string): Promise<SupabaseResult>;
  };
}

export interface DiscoveredDmWorkspace {
  campaignId: string;
  displayCode: string;
  name: string;
  creationKind: 'new_workspace' | 'import_fork';
  sourceFingerprint: string | null;
  createdAt: string;
  membershipAuthority: 'legacy';
  familyAuthorities: 'legacy';
  liveRuntimeAuthority: 'redis_relay';
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
): DmWorkspaceGateway & { discover(): Promise<DiscoveredDmWorkspace[]> } {
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
    async discover() {
      if (!client.from)
        throw new DmWorkspaceGatewayError(
          'Owner workspace discovery is unavailable',
          'failed'
        );
      const [campaigns, provenance] = await Promise.all([
        client
          .from('campaigns')
          .select('id,display_code,name,membership_authority,created_at'),
        client
          .from('campaign_workspace_claim_provenance')
          .select('campaign_id,claim_kind,source_fingerprint'),
      ]);
      throwForError(campaigns.error);
      throwForError(provenance.error);
      if (!Array.isArray(campaigns.data) || !Array.isArray(provenance.data)) {
        throw new DmWorkspaceGatewayError(
          'Owner workspace discovery returned an invalid response',
          'failed'
        );
      }
      const claims = new Map(
        provenance.data.flatMap(value => {
          if (typeof value !== 'object' || value === null) return [];
          const row = value as Record<string, unknown>;
          if (
            typeof row.campaign_id !== 'string' ||
            !['new_workspace', 'import_fork'].includes(
              String(row.claim_kind)
            ) ||
            (row.source_fingerprint !== null &&
              (typeof row.source_fingerprint !== 'string' ||
                !/^[a-f0-9]{64}$/u.test(row.source_fingerprint)))
          )
            return [];
          return [[row.campaign_id, row] as const];
        })
      );
      return campaigns.data
        .flatMap(value => {
          if (typeof value !== 'object' || value === null) return [];
          const row = value as Record<string, unknown>;
          const claim =
            typeof row.id === 'string' ? claims.get(row.id) : undefined;
          if (
            typeof row.id !== 'string' ||
            typeof row.display_code !== 'string' ||
            !/^[A-F0-9]{12}$/u.test(row.display_code) ||
            typeof row.name !== 'string' ||
            row.name.length < 1 ||
            row.name.length > 255 ||
            row.membership_authority !== 'legacy' ||
            typeof row.created_at !== 'string' ||
            !claim
          )
            return [];
          return [
            {
              campaignId: row.id,
              displayCode: row.display_code,
              name: row.name,
              creationKind: claim.claim_kind as 'new_workspace' | 'import_fork',
              sourceFingerprint: claim.source_fingerprint as string | null,
              createdAt: row.created_at,
              membershipAuthority: 'legacy' as const,
              familyAuthorities: 'legacy' as const,
              liveRuntimeAuthority: 'redis_relay' as const,
            },
          ];
        })
        .sort((left, right) => left.campaignId.localeCompare(right.campaignId));
    },
  };
}
