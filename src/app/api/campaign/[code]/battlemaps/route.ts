import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignBattleMapsKey,
  refreshCampaignTTL,
} from '@/lib/redis';
import type { BattleMapMetadata } from '@/types/battlemap';
import {
  GUEST_SESSION_COOKIE,
  isHybridGuestServerEnabled,
} from '@/lib/guestSessionSecurity';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    if (
      isHybridGuestServerEnabled() &&
      request.cookies.has(GUEST_SESSION_COOKIE)
    ) {
      return NextResponse.json(
        { error: 'Guest battle-map access is not enabled' },
        { status: 403 }
      );
    }
    const { code } = await params;
    const redis = getRedis();
    const raw = await redis.get<BattleMapMetadata[]>(
      campaignBattleMapsKey(code)
    );
    await refreshCampaignTTL(redis, code);
    return NextResponse.json({ battlemaps: raw ?? [] });
  } catch (error) {
    console.error('Failed to fetch battle maps:', error);
    return NextResponse.json(
      { error: 'Failed to fetch battle maps' },
      { status: 500 }
    );
  }
}
