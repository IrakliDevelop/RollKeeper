export interface GuestInvitationRecord {
  invitationId: string;
  campaignId: string;
  displayCode: string;
  legacyPlayerId: string | null;
  scopes: string[];
  expiresAt: string;
  maxUses: number;
  useCount: number;
}

export interface GuestSessionPrincipal {
  sessionId: string;
  campaignId: string;
  subjectId: string;
  legacyPlayerId: string | null;
  scopes: string[];
  expiresAt: string;
}

export interface GuestSessionRecord extends GuestSessionPrincipal {
  invitationId: string;
  displayCode: string;
}

interface RpcResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

export interface GuestRpcClient {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
}

export class GuestSessionGatewayError extends Error {
  constructor(
    message: string,
    readonly category: 'denied' | 'rate-limited' | 'failed'
  ) {
    super(message);
    this.name = 'GuestSessionGatewayError';
  }
}

function bytea(hex: string): string {
  if (!/^[a-f0-9]{64}$/u.test(hex)) {
    throw new GuestSessionGatewayError('Invalid secret hash', 'failed');
  }
  return `\\x${hex}`;
}

function throwForError(error: RpcResult['error']): void {
  if (!error) return;
  const denied = error.code === '42501';
  const rateLimited = /rate limit/iu.test(error.message);
  throw new GuestSessionGatewayError(
    denied ? 'Guest capability was denied' : error.message,
    rateLimited ? 'rate-limited' : denied ? 'denied' : 'failed'
  );
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GuestSessionGatewayError(
      'Cloud returned an invalid guest authority response',
      'failed'
    );
  }
  return value as Record<string, unknown>;
}

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
    ? value
    : null;
}

function nullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === 'string' ? value : undefined;
}

function invitationRecord(value: unknown): GuestInvitationRecord {
  const row = object(value);
  const scopes = strings(row.scopes);
  const legacyPlayerId = nullableString(row.legacyPlayerId);
  if (
    typeof row.invitationId !== 'string' ||
    typeof row.campaignId !== 'string' ||
    typeof row.displayCode !== 'string' ||
    !/^[A-F0-9]{12}$/u.test(row.displayCode) ||
    legacyPlayerId === undefined ||
    !scopes ||
    typeof row.expiresAt !== 'string' ||
    typeof row.maxUses !== 'number' ||
    typeof row.useCount !== 'number'
  ) {
    throw new GuestSessionGatewayError(
      'Cloud returned an invalid guest invitation response',
      'failed'
    );
  }
  return {
    invitationId: row.invitationId,
    campaignId: row.campaignId,
    displayCode: row.displayCode,
    legacyPlayerId,
    scopes,
    expiresAt: row.expiresAt,
    maxUses: row.maxUses,
    useCount: row.useCount,
  };
}

function principal(value: unknown): GuestSessionPrincipal {
  const row = object(value);
  const scopes = strings(row.scopes);
  const legacyPlayerId = nullableString(row.legacyPlayerId);
  if (
    typeof row.sessionId !== 'string' ||
    typeof row.campaignId !== 'string' ||
    typeof row.subjectId !== 'string' ||
    legacyPlayerId === undefined ||
    !scopes ||
    typeof row.expiresAt !== 'string'
  ) {
    throw new GuestSessionGatewayError(
      'Cloud returned an invalid guest authority response',
      'failed'
    );
  }
  return {
    sessionId: row.sessionId,
    campaignId: row.campaignId,
    subjectId: row.subjectId,
    legacyPlayerId,
    scopes,
    expiresAt: row.expiresAt,
  };
}

function sessionRecord(value: unknown): GuestSessionRecord {
  const row = object(value);
  const base = principal(row);
  if (
    typeof row.invitationId !== 'string' ||
    typeof row.displayCode !== 'string' ||
    !/^[A-F0-9]{12}$/u.test(row.displayCode)
  ) {
    throw new GuestSessionGatewayError(
      'Cloud returned an invalid guest session response',
      'failed'
    );
  }
  return {
    ...base,
    invitationId: row.invitationId,
    displayCode: row.displayCode,
  };
}

async function rpc(
  client: GuestRpcClient,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const response = await client.rpc(name, args);
  throwForError(response.error);
  return response.data;
}

export function createGuestOwnerGateway(client: GuestRpcClient) {
  return {
    async issue(input: {
      mutationId: string;
      campaignId: string;
      tokenHash: string;
      expiresAt: string;
      maxUses: number;
      legacyPlayerId: string | null;
    }) {
      return invitationRecord(
        await rpc(client, 'issue_campaign_guest_invitation', {
          p_mutation_id: input.mutationId,
          p_campaign_id: input.campaignId,
          p_token_hash: bytea(input.tokenHash),
          p_expires_at: input.expiresAt,
          p_max_uses: input.maxUses,
          p_legacy_player_id: input.legacyPlayerId,
        })
      );
    },
  };
}

export function createGuestApplicationGateway(client: GuestRpcClient) {
  return {
    async redeem(input: {
      mutationId: string;
      tokenHash: string;
      requestHash: string;
      subjectId: string;
      sessionTokenHash: string;
      sessionExpiresAt: string;
    }) {
      return sessionRecord(
        await rpc(client, 'redeem_campaign_guest_invitation', {
          p_mutation_id: input.mutationId,
          p_token_hash: bytea(input.tokenHash),
          p_request_hash: input.requestHash,
          p_subject_id: input.subjectId,
          p_session_token_hash: bytea(input.sessionTokenHash),
          p_session_expires_at: input.sessionExpiresAt,
        })
      );
    },
    async authorize(input: {
      sessionTokenHash: string;
      displayCode: string;
      requiredScope: string;
    }) {
      return principal(
        await rpc(client, 'authorize_campaign_guest_session', {
          p_session_token_hash: bytea(input.sessionTokenHash),
          p_display_code: input.displayCode,
          p_required_scope: input.requiredScope,
        })
      );
    },
    async rotate(input: {
      mutationId: string;
      currentTokenHash: string;
      requestHash: string;
      newTokenHash: string;
      newExpiresAt: string;
    }) {
      return sessionRecord(
        await rpc(client, 'rotate_campaign_guest_session', {
          p_mutation_id: input.mutationId,
          p_current_token_hash: bytea(input.currentTokenHash),
          p_request_hash: input.requestHash,
          p_new_token_hash: bytea(input.newTokenHash),
          p_new_expires_at: input.newExpiresAt,
        })
      );
    },
    async consumeRateLimit(input: {
      keyHash: string;
      action: 'issue' | 'redeem' | 'rotate' | 'invalid';
      limit: number;
      windowSeconds: number;
    }) {
      const data = await rpc(client, 'consume_guest_rate_limit', {
        p_key_hash: bytea(input.keyHash),
        p_action: input.action,
        p_limit: input.limit,
        p_window_seconds: input.windowSeconds,
      });
      if (typeof data !== 'boolean') {
        throw new GuestSessionGatewayError(
          'Cloud returned an invalid rate limit response',
          'failed'
        );
      }
      return data;
    },
  };
}
