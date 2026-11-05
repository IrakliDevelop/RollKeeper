import type { NextRequest } from 'next/server';
import { getRedis } from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';
import {
  GUEST_SESSION_COOKIE,
  isHybridGuestServerEnabled,
} from '@/lib/guestSessionSecurity';
import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { authorizeCampaignMembershipRoute } from '@/lib/supabase/campaignMembershipServer';
import type { TablePrincipal } from './control';

export type TableAuthorization =
  | { ok: true; principal: TablePrincipal }
  | { ok: false; status: number; error: string };

export async function authorizeTableDm(
  request: NextRequest,
  code: string,
  dmId: unknown,
  mutation: boolean
): Promise<TableAuthorization> {
  if (!/^[a-zA-Z0-9_-]{1,64}$/u.test(code)) {
    return { ok: false, status: 400, error: 'Invalid campaign code' };
  }
  if (typeof dmId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/u.test(dmId)) {
    return { ok: false, status: 400, error: 'Valid dmId is required' };
  }
  const membership = await authorizeCampaignMembershipRoute(code, mutation);
  if (membership.mode === 'denied') {
    return {
      ok: false,
      status: membership.status,
      error: 'Account membership is required',
    };
  }
  if (
    membership.mode === 'legacy' &&
    isHybridGuestServerEnabled() &&
    request.cookies.has(GUEST_SESSION_COOKIE)
  ) {
    return { ok: false, status: 403, error: 'Guest cannot control the table' };
  }
  if (mutation) {
    const security = validateCampaignMembershipMutation(request);
    if (!security.ok)
      return { ok: false, status: security.status, error: security.error };
  }
  if (
    membership.mode === 'account' &&
    membership.principal.role !== 'owner' &&
    membership.principal.role !== 'dm'
  ) {
    return { ok: false, status: 403, error: 'DM membership is required' };
  }
  if ((await verifyDmAuthority(getRedis(), code, dmId)) !== 'ok') {
    return {
      ok: false,
      status: 403,
      error: 'dmId is not authorized for this campaign',
    };
  }
  return {
    ok: true,
    principal: {
      campaignCode: code,
      role:
        membership.mode === 'account' && membership.principal.role === 'owner'
          ? 'owner'
          : 'dm',
      id:
        membership.mode === 'account'
          ? `account:${membership.principal.accountId}`
          : `legacy:${dmId}`,
    },
  };
}
