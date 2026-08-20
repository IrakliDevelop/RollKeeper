import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignKey,
  campaignPlayersKey,
  campaignPlayerKey,
  campaignMessagesKey,
  campaignEffectsKey,
  campaignTransfersKey,
  campaignRemovedKey,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';
import {
  guestDeniedResponse,
  requireGuestPlayerBinding,
} from '@/lib/guestRouteResponses';
import { authorizeHybridGuestRoute } from '@/lib/supabase/guestSessionServer';
import { projectGuestPlayer } from '@/lib/guestPlayerProjection';
import type { CampaignPlayerData } from '@/types/campaign';
import { authorizeCampaignMembershipRoute } from '@/lib/supabase/campaignMembershipServer';
import { createCampaignMembershipContextForRequest } from '@/lib/supabase/campaignMembershipServer';
import type { CampaignMembershipRpcClient } from '@/lib/supabase/campaignMembershipGateway';
import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; playerId: string }> }
) {
  try {
    const { code, playerId } = await params;
    const membership = await authorizeCampaignMembershipRoute(code, false);
    if (membership.mode === 'denied') {
      return NextResponse.json(
        { error: 'Account membership is required' },
        { status: membership.status }
      );
    }
    if (
      membership.mode === 'account' &&
      membership.principal.role !== 'owner' &&
      membership.principal.role !== 'dm' &&
      membership.principal.legacyPlayerId !== playerId
    ) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    const guest =
      membership.mode === 'legacy'
        ? await authorizeHybridGuestRoute(request, code, 'player:read')
        : ({ mode: 'legacy' } as const);
    if (membership.mode === 'account') {
      const redis = getRedis();
      const raw = await redis.get(campaignPlayerKey(code, playerId));
      if (!raw)
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 }
        );
      const player: CampaignPlayerData =
        typeof raw === 'string' ? JSON.parse(raw) : (raw as CampaignPlayerData);
      return NextResponse.json(
        { player: projectGuestPlayer(player) },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (guest.mode === 'legacy') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (guest.mode === 'denied') return guestDeniedResponse(guest);
    const bound = requireGuestPlayerBinding(guest, [playerId]);
    if (!bound) {
      return NextResponse.json(
        { error: 'Guest player binding does not match' },
        { status: 403 }
      );
    }
    const redis = getRedis();
    const raw = await redis.get(campaignPlayerKey(code, bound));
    if (!raw) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    const player: CampaignPlayerData =
      typeof raw === 'string' ? JSON.parse(raw) : (raw as CampaignPlayerData);
    return NextResponse.json(
      { player: projectGuestPlayer(player) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch guest player' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; playerId: string }> }
) {
  try {
    const { code, playerId } = await params;

    let body: {
      dmId?: string;
      playerId?: string;
      memberAccountId?: string;
      mutationId?: string;
    } = {};
    try {
      body = await request.json();
    } catch {
      // missing/invalid body falls through to the 400 below
    }
    const { dmId, playerId: bodyPlayerId } = body;

    const membership = await authorizeCampaignMembershipRoute(code, true);
    if (membership.mode === 'denied') {
      return NextResponse.json(
        {
          error:
            membership.status === 409
              ? 'Membership changes are temporarily frozen'
              : 'Account membership is required',
        },
        { status: membership.status }
      );
    }
    if (membership.mode === 'account') {
      const security = validateCampaignMembershipMutation(request);
      if (!security.ok) {
        return NextResponse.json(
          { error: security.error },
          { status: security.status }
        );
      }
      if (
        (membership.principal.role !== 'owner' &&
          membership.principal.role !== 'dm') ||
        !body.memberAccountId ||
        !body.mutationId
      ) {
        return NextResponse.json(
          { error: 'Owner removal confirmation is required' },
          { status: 403 }
        );
      }
      const context = await createCampaignMembershipContextForRequest();
      if (!context?.userClient) {
        return NextResponse.json(
          { error: 'Account membership is required' },
          { status: 401 }
        );
      }
      const { error } = await (
        context.userClient as unknown as CampaignMembershipRpcClient
      ).rpc('remove_campaign_member', {
        p_mutation_id: body.mutationId,
        p_campaign_id: membership.principal.campaignId,
        p_member_id: body.memberAccountId,
        p_expected_legacy_player_id: playerId,
        p_expected_epoch: membership.principal.epoch,
      });
      if (error) {
        return NextResponse.json(
          { error: 'Member removal was denied' },
          { status: 403 }
        );
      }
    }

    const guest =
      membership.mode === 'legacy'
        ? await authorizeHybridGuestRoute(request, code, 'player:leave', true)
        : ({ mode: 'legacy' } as const);
    if (guest.mode === 'denied') return guestDeniedResponse(guest);
    if (
      guest.mode === 'guest' &&
      !requireGuestPlayerBinding(guest, [playerId, bodyPlayerId])
    ) {
      return NextResponse.json(
        { error: 'Guest player binding does not match' },
        { status: 403 }
      );
    }

    if (
      membership.mode === 'legacy' &&
      guest.mode !== 'guest' &&
      !dmId &&
      !bodyPlayerId
    ) {
      return NextResponse.json(
        { error: 'dmId or playerId is required' },
        { status: 400 }
      );
    }

    const redis = getRedis();

    if (membership.mode === 'account') {
      const exists = await redis.exists(campaignKey(code));
      if (!exists) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        );
      }
    } else if (guest.mode === 'guest') {
      const exists = await redis.exists(campaignKey(code));
      if (!exists) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        );
      }
    } else if (dmId) {
      const auth = await verifyDmAuthority(redis, code, dmId);
      if (auth === 'missing') {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        );
      }
      if (auth === 'mismatch') {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    } else {
      if (bodyPlayerId !== playerId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      const exists = await redis.exists(campaignKey(code));
      if (!exists) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        );
      }
    }

    // Marker first: this closes most of the kick-vs-sync race — a concurrent
    // player sync either lands before it (its write is deleted just below)
    // or sees it and gets 410. A narrow interleaving remains: a sync that
    // passed its marker check but writes after our deletes below can briefly
    // resurrect the entry until TTL. The client's self-DELETE on 410 cleans
    // that up.
    await redis.set(campaignRemovedKey(code, playerId), '1', {
      ex: SLIDING_TTL_SECONDS,
    });

    await Promise.all([
      redis.srem(campaignPlayersKey(code), playerId),
      redis.del(campaignPlayerKey(code, playerId)),
      redis.del(campaignMessagesKey(code, playerId)),
      redis.del(campaignEffectsKey(code, playerId)),
      redis.del(campaignTransfersKey(code, playerId)),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing player from campaign:', error);
    return NextResponse.json(
      { error: 'Failed to remove player' },
      { status: 500 }
    );
  }
}
