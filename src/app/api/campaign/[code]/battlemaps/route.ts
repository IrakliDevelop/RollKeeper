import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignBattleMapsKey,
  refreshCampaignTTL,
} from '@/lib/redis';
import type { BattleMapMetadata } from '@/types/battlemap';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
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
