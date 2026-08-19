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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; playerId: string }> }
) {
  try {
    const { code, playerId } = await params;
    const guest = await authorizeHybridGuestRoute(request, code, 'player:read');
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

    let body: { dmId?: string; playerId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // missing/invalid body falls through to the 400 below
    }
    const { dmId, playerId: bodyPlayerId } = body;

    const guest = await authorizeHybridGuestRoute(
      request,
      code,
      'player:leave',
      true
    );
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

    if (guest.mode !== 'guest' && !dmId && !bodyPlayerId) {
      return NextResponse.json(
        { error: 'dmId or playerId is required' },
        { status: 400 }
      );
    }

    const redis = getRedis();

    if (guest.mode === 'guest') {
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
