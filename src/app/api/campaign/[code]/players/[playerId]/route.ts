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

    if (!dmId && !bodyPlayerId) {
      return NextResponse.json(
        { error: 'dmId or playerId is required' },
        { status: 400 }
      );
    }

    const redis = getRedis();

    if (dmId) {
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
