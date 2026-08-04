import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignLocationsKey,
  campaignLocationKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
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
    const locations: LocationMetadata[] = raw
      ? Array.isArray(raw)
        ? raw
        : (JSON.parse(raw as unknown as string) as LocationMetadata[])
      : [];

    // The list and each full location are stored under separate keys. Keep the
    // detail keys alive whenever the player-facing list is active so the list
    // cannot outlive the records it points to.
    await Promise.all([
      refreshCampaignTTL(redis, code),
      ...locations.map(location =>
        redis.expire(
          campaignLocationKey(code, location.id),
          SLIDING_TTL_SECONDS
        )
      ),
    ]);
    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Failed to fetch locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}
