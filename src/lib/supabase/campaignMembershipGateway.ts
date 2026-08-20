import type {
  CampaignMembershipAuthority,
  CampaignMembershipPrincipal,
} from '@/lib/campaignMembershipAuthority';
import type { MembershipInvitationInput } from '@/lib/campaignMembershipService';

interface RpcResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

export interface CampaignMembershipRpcClient {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
}

export class CampaignMembershipGatewayError extends Error {
  constructor(
    message: string,
    readonly category: 'denied' | 'not-managed' | 'rate-limited' | 'failed'
  ) {
    super(message);
    this.name = 'CampaignMembershipGatewayError';
  }
}

function bytea(hex: string): string {
  if (!/^[a-f0-9]{64}$/u.test(hex)) {
    throw new CampaignMembershipGatewayError(
      'Invalid membership secret hash',
      'failed'
    );
  }
  return `\\x${hex}`;
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CampaignMembershipGatewayError(
      'Cloud returned an invalid membership authority response',
      'failed'
    );
  }
  return value as Record<string, unknown>;
}

async function rpc(
  client: CampaignMembershipRpcClient,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw new CampaignMembershipGatewayError(
      error.code === '42501' ? 'Campaign membership was denied' : error.message,
      /rate limit/iu.test(error.message)
        ? 'rate-limited'
        : error.code === '42501'
          ? 'denied'
          : 'failed'
    );
  }
  return data;
}

function nullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === 'string' ? value : undefined;
}

function invitation(value: unknown) {
  const row = object(value);
  const legacyPlayerId = nullableString(row.legacyPlayerId);
  const guestSubjectId = nullableString(row.guestSubjectId);
  if (
    typeof row.invitationId !== 'string' ||
    typeof row.campaignId !== 'string' ||
    typeof row.invitedAccountId !== 'string' ||
    (row.role !== 'dm' && row.role !== 'player') ||
    legacyPlayerId === undefined ||
    guestSubjectId === undefined ||
    typeof row.expiresAt !== 'string' ||
    typeof row.maxUses !== 'number' ||
    typeof row.useCount !== 'number' ||
    typeof row.status !== 'string'
  ) {
    throw new CampaignMembershipGatewayError(
      'Cloud returned an invalid membership invitation response',
      'failed'
    );
  }
  return {
    invitationId: row.invitationId,
    campaignId: row.campaignId,
    invitedAccountId: row.invitedAccountId,
    role: row.role,
    legacyPlayerId,
    guestSubjectId,
    expiresAt: row.expiresAt,
    maxUses: row.maxUses,
    useCount: row.useCount,
    status: row.status,
  };
}

function authority(value: unknown): CampaignMembershipAuthority {
  const row = object(value);
  if (row.managed === false) {
    throw new CampaignMembershipGatewayError(
      'Campaign is not managed by cloud membership',
      'not-managed'
    );
  }
  if (
    typeof row.campaignId !== 'string' ||
    typeof row.ownerId !== 'string' ||
    typeof row.displayCode !== 'string' ||
    !/^[A-F0-9]{12}$/u.test(row.displayCode) ||
    (row.authority !== 'legacy' && row.authority !== 'postgres') ||
    typeof row.epoch !== 'number' ||
    ![
      'open',
      'freezing',
      'postgres',
      'rollback_freezing',
      'legacy_restored',
    ].includes(String(row.freezeState))
  ) {
    throw new CampaignMembershipGatewayError(
      'Cloud returned an invalid membership authority response',
      'failed'
    );
  }
  return row as unknown as CampaignMembershipAuthority;
}

function principal(value: unknown): CampaignMembershipPrincipal {
  const row = object(value);
  const legacyPlayerId = nullableString(row.legacyPlayerId);
  const legacyCharacterId = nullableString(row.legacyCharacterId);
  const characterId = nullableString(row.characterId);
  if (
    typeof row.campaignId !== 'string' ||
    typeof row.accountId !== 'string' ||
    !['owner', 'dm', 'player'].includes(String(row.role)) ||
    row.status !== 'active' ||
    typeof row.epoch !== 'number' ||
    legacyPlayerId === undefined ||
    legacyCharacterId === undefined ||
    characterId === undefined
  ) {
    throw new CampaignMembershipGatewayError(
      'Cloud returned an invalid account membership response',
      'failed'
    );
  }
  return {
    campaignId: row.campaignId,
    accountId: row.accountId,
    role: row.role as CampaignMembershipPrincipal['role'],
    status: 'active',
    epoch: row.epoch,
    legacyPlayerId,
    legacyCharacterId,
    characterId,
  };
}

function memberships(value: unknown) {
  const result = object(value);
  if (!Array.isArray(result.memberships)) {
    throw new CampaignMembershipGatewayError(
      'Cloud returned an invalid membership list response',
      'failed'
    );
  }
  return {
    memberships: result.memberships.map(value => {
      const row = object(value);
      if (
        typeof row.campaignId !== 'string' ||
        !['dm', 'player'].includes(String(row.role)) ||
        row.status !== 'active' ||
        typeof row.epoch !== 'number'
      ) {
        throw new CampaignMembershipGatewayError(
          'Cloud returned an invalid membership list response',
          'failed'
        );
      }
      return {
        campaignId: row.campaignId,
        role: row.role as 'dm' | 'player',
        status: 'active' as const,
        epoch: row.epoch,
      };
    }),
  };
}

export function createCampaignMembershipUserGateway(
  client: CampaignMembershipRpcClient
) {
  return {
    async listMine() {
      return memberships(await rpc(client, 'list_my_campaign_memberships', {}));
    },
    async issue(input: MembershipInvitationInput) {
      return invitation(
        await rpc(client, 'issue_campaign_membership_invitation', {
          p_mutation_id: input.mutationId,
          p_campaign_id: input.campaignId,
          p_invited_account_id: input.invitedAccountId,
          p_token_hash: bytea(input.tokenHash),
          p_expires_at: input.expiresAt,
          p_max_uses: input.maxUses,
          p_role: input.role,
          p_legacy_player_id: input.legacyPlayerId,
          p_guest_subject_id: input.guestSubjectId,
        })
      );
    },
    accept: (input: {
      mutationId: string;
      tokenHash: string;
      decision: 'accepted' | 'refused';
    }) =>
      rpc(client, 'accept_campaign_membership_invitation', {
        p_mutation_id: input.mutationId,
        p_token_hash: bytea(input.tokenHash),
        p_decision: input.decision,
      }),
    revoke: (input: { mutationId: string; invitationId: string }) =>
      rpc(client, 'revoke_campaign_membership_invitation', {
        p_mutation_id: input.mutationId,
        p_invitation_id: input.invitationId,
      }),
    linkCharacter: (input: {
      mutationId: string;
      campaignId: string;
      characterId: string;
      legacyPlayerId: string | null;
      legacyCharacterId: string | null;
      guestSubjectId: string | null;
    }) =>
      rpc(client, 'link_campaign_character', {
        p_mutation_id: input.mutationId,
        p_campaign_id: input.campaignId,
        p_character_id: input.characterId,
        p_legacy_player_id: input.legacyPlayerId,
        p_legacy_character_id: input.legacyCharacterId,
        p_guest_subject_id: input.guestSubjectId,
      }),
    unlinkCharacter: (input: {
      mutationId: string;
      campaignId: string;
      characterId: string;
    }) =>
      rpc(client, 'unlink_campaign_character', {
        p_mutation_id: input.mutationId,
        p_campaign_id: input.campaignId,
        p_character_id: input.characterId,
      }),
    async authorize(campaignId: string, expectedEpoch: number) {
      return principal(
        await rpc(client, 'authorize_campaign_membership', {
          p_campaign_id: campaignId,
          p_expected_epoch: expectedEpoch,
        })
      );
    },
  };
}

export function createCampaignMembershipApplicationGateway(
  client: CampaignMembershipRpcClient
) {
  return {
    async resolveAuthority(displayCode: string) {
      return authority(
        await rpc(client, 'resolve_campaign_membership_authority', {
          p_display_code: displayCode,
        })
      );
    },
  };
}
