import type { NextRequest } from 'next/server';
import type { Redis } from '@upstash/redis';
import {
  campaignPlayersKey,
  campaignDisplayKeyKey,
  getRawRedis,
} from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';
import type { BattleMapRole } from '@/lib/battlemapToken';
import {
  GUEST_SESSION_COOKIE,
  isHybridGuestServerEnabled,
} from '@/lib/guestSessionSecurity';
import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { authorizeCampaignMembershipRoute } from '@/lib/supabase/campaignMembershipServer';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import { verifyDisplayCapability } from '@/lib/tableServer/displayCapability';
import {
  DISPLAY_CAPABILITY_HEADER,
  DISPLAY_SESSION_HEADER,
} from '@/components/ui/campaign/table/sideChannelRequests';

export type BattleMapSessionResult =
  | {
      authorized: true;
      role: BattleMapRole;
      userId: string;
      authorityPrincipal?: string;
      /** Table v1 display: the generation the capability was verified at. */
      displayGeneration?: number;
    }
  | { authorized: false; error: string; status: number };

const ORIGIN_FAILED = 'Request origin or CSRF validation failed';

/**
 * Same-origin check for a capability-authenticated GET (C5-5). Browsers
 * omit `Origin` on same-origin GETs, so a present `Origin` must equal the
 * request origin, a present `Sec-Fetch-Site` must be `same-origin`, and the
 * custom CSRF header must be set (which a cross-origin page cannot send
 * without a preflight this app never grants).
 */
export function validateSameOriginRead(
  request: Pick<Request, 'url' | 'headers'>
): { ok: true } | { ok: false; status: 403; error: string } {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const url = new URL(request.url);
  const requestOrigin = host ? `${url.protocol}//${host}` : url.origin;
  const site = request.headers.get('sec-fetch-site');
  if (
    (origin !== null && origin !== requestOrigin) ||
    (site !== null && site !== 'same-origin') ||
    request.headers.get('x-rollkeeper-csrf') !== '1'
  )
    return { ok: false, status: 403, error: ORIGIN_FAILED };
  return { ok: true };
}

/**
 * PR05 E5: under Table v1 the display credential is the campaign display
 * capability plus its bound session nonce (body fields on the token mint,
 * headers on side-channel GETs). The capability is the credential: no
 * membership or guest-cookie check applies, but same-origin is required.
 */
async function authorizeTableDisplay(
  code: string,
  request: NextRequest,
  body: { displayCapability?: string; displaySession?: string },
  mutation: boolean
): Promise<BattleMapSessionResult> {
  const security = mutation
    ? validateCampaignMembershipMutation(request)
    : validateSameOriginRead(request);
  if (!security.ok)
    return { authorized: false, error: ORIGIN_FAILED, status: 403 };
  let rawRedis: ReturnType<typeof getRawRedis>;
  try {
    rawRedis = getRawRedis();
  } catch {
    return {
      authorized: false,
      error: 'Live authority is unavailable',
      status: 503,
    };
  }
  const verified = await verifyDisplayCapability({
    rawRedis,
    code,
    capability:
      body.displayCapability ??
      request.headers.get(DISPLAY_CAPABILITY_HEADER) ??
      undefined,
    nonce:
      body.displaySession ??
      request.headers.get(DISPLAY_SESSION_HEADER) ??
      undefined,
    bind: false,
  });
  if (verified.status === 'ok')
    return {
      authorized: true,
      role: 'display',
      userId: `display-${code}`,
      displayGeneration: verified.displayGeneration,
    };
  if (verified.status === 'denied')
    return {
      authorized: false,
      error: verified.error,
      status: verified.httpStatus,
    };
  if (verified.status === 'stale')
    return { authorized: false, error: 'stale', status: 409 };
  return {
    authorized: false,
    error: 'Live authority is unavailable',
    status: 503,
  };
}

export async function authorizeBattleMapSession(
  redis: Redis,
  code: string,
  request: NextRequest,
  body: {
    role?: BattleMapRole;
    dmId?: string;
    playerId?: string;
    displayKey?: string;
    displayCapability?: string;
    displaySession?: string;
  },
  options: { mutation: boolean } = { mutation: true }
): Promise<BattleMapSessionResult> {
  const { role, dmId, playerId, displayKey } = body;
  if (!role) {
    return { authorized: false, error: 'role is required', status: 400 };
  }
  if (role === 'display' && isTableProtocolRequired())
    return authorizeTableDisplay(code, request, body, options.mutation);

  const membership =
    role === 'display'
      ? ({ mode: 'legacy' } as const)
      : await authorizeCampaignMembershipRoute(code, false);
  if (membership.mode === 'denied') {
    return {
      authorized: false,
      error: 'Account membership is required',
      status: membership.status,
    };
  }
  if (
    membership.mode === 'legacy' &&
    isHybridGuestServerEnabled() &&
    request.cookies.has(GUEST_SESSION_COOKIE)
  ) {
    return {
      authorized: false,
      error: 'Guest sessions cannot access relay',
      status: 403,
    };
  }
  if (membership.mode === 'account' && options.mutation) {
    const security = validateCampaignMembershipMutation(request);
    if (!security.ok) {
      return {
        authorized: false,
        error: security.error,
        status: security.status,
      };
    }
  }

  if (role === 'dm') {
    if (!dmId) {
      return { authorized: false, error: 'dmId is required', status: 400 };
    }
    const dmAuth = await verifyDmAuthority(redis, code, dmId);
    if (
      dmAuth !== 'ok' ||
      (membership.mode === 'account' &&
        membership.principal.role !== 'owner' &&
        membership.principal.role !== 'dm')
    ) {
      return { authorized: false, error: 'Not the campaign DM', status: 403 };
    }
    return {
      authorized: true,
      role: 'dm',
      userId: dmId,
      authorityPrincipal:
        membership.mode === 'account'
          ? `account:${membership.principal.accountId}`
          : `legacy:${dmId}`,
    };
  }

  if (role === 'player') {
    if (!playerId) {
      return { authorized: false, error: 'playerId is required', status: 400 };
    }
    const isMember =
      membership.mode === 'account'
        ? membership.principal.role === 'player' &&
          membership.principal.legacyPlayerId === playerId
        : await redis.sismember(campaignPlayersKey(code), playerId);
    if (!isMember) {
      return {
        authorized: false,
        error: 'Player is not in this campaign',
        status: 403,
      };
    }
    return { authorized: true, role: 'player', userId: playerId };
  }

  if (role === 'display') {
    if (!displayKey) {
      return {
        authorized: false,
        error: 'displayKey is required',
        status: 400,
      };
    }
    const stored = await redis.get<string>(campaignDisplayKeyKey(code));
    if (!stored || stored !== displayKey) {
      return { authorized: false, error: 'Invalid display key', status: 403 };
    }
    return { authorized: true, role: 'display', userId: `display-${code}` };
  }

  return { authorized: false, error: 'Unknown role', status: 400 };
}
