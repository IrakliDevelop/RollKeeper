import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignKey,
  campaignPlayersKey,
  campaignPlayerKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { CampaignData } from '@/types/campaign';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const redis = getRedis();

    const data = await redis.get<string>(campaignKey(code));
    if (!data) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const campaign: CampaignData =
      typeof data === 'string' ? JSON.parse(data) : data;

    await refreshCampaignTTL(redis, code);

    return NextResponse.json({ code, campaign });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { dmId, campaignName, createdAt } = body;

    if (!dmId || !campaignName) {
      return NextResponse.json(
        { error: 'dmId and campaignName are required' },
        { status: 400 }
      );
    }

    const redis = getRedis();

    const campaignData: CampaignData = {
      dmId,
      campaignName,
      createdAt: createdAt || new Date().toISOString(),
    };

    await Promise.all([
      redis.set(campaignKey(code), JSON.stringify(campaignData), {
        ex: SLIDING_TTL_SECONDS,
      }),
      redis.sadd(campaignPlayersKey(code), '__init__'),
      redis.expire(campaignPlayersKey(code), SLIDING_TTL_SECONDS),
    ]);

    return NextResponse.json({ code, campaign: campaignData });
  } catch (error) {
    console.error('Error upserting campaign:', error);
    return NextResponse.json(
      { error: 'Failed to upsert campaign' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const redis = getRedis();

    const exists = await redis.exists(campaignKey(code));
    if (!exists) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const playerIds = await redis.smembers(campaignPlayersKey(code));
    const keysToDelete = [
      campaignKey(code),
      campaignPlayersKey(code),
      ...playerIds
        .filter(id => id !== '__init__')
        .map(id => campaignPlayerKey(code, id)),
    ];

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}
