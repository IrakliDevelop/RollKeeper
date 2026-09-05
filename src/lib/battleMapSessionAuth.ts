import type { NextRequest } from 'next/server';
import type { Redis } from '@upstash/redis';
import { campaignPlayersKey, campaignDisplayKeyKey } from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';
import type { BattleMapRole } from '@/lib/battlemapToken';
import {
  GUEST_SESSION_COOKIE,
  isHybridGuestServerEnabled,
} from '@/lib/guestSessionSecurity';
import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { authorizeCampaignMembershipRoute } from '@/lib/supabase/campaignMembershipServer';

export type BattleMapSessionResult =
  | { authorized: true; role: BattleMapRole; userId: string }
  | { authorized: false; error: string; status: number };

export async function authorizeBattleMapSession(
  redis: Redis,
  code: string,
  request: NextRequest,
  body: {
    role?: BattleMapRole;
    dmId?: string;
    playerId?: string;
    displayKey?: string;
  }
): Promise<BattleMapSessionResult> {
  const { role, dmId, playerId, displayKey } = body;
  if (!role) {
    return { authorized: false, error: 'role is required', status: 400 };
  }

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
  if (membership.mode === 'account') {
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
    return { authorized: true, role: 'dm', userId: dmId };
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
