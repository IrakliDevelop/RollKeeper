import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignLocationsKey,
  refreshCampaignTTL,
} from '@/lib/redis';
import type { LocationMetadata } from '@/types/location';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const redis = getRedis();
    const raw = await redis.get<LocationMetadata[]>(campaignLocationsKey(code));
    await refreshCampaignTTL(redis, code);
    return NextResponse.json({ locations: raw ?? [] });
  } catch (error) {
    console.error('Failed to fetch locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}
