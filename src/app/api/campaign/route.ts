import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignKey,
  campaignPlayersKey,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { CampaignData } from '@/types/campaign';

function generateCampaignCode(): string {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dmId, campaignName } = body;

    if (!dmId || !campaignName) {
      return NextResponse.json(
        { error: 'dmId and campaignName are required' },
        { status: 400 }
      );
    }

    const redis = getRedis();

    let code = generateCampaignCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await redis.exists(campaignKey(code));
      if (!exists) break;
      code = generateCampaignCode();
      attempts++;
    }

    if (attempts >= 10) {
      return NextResponse.json(
        { error: 'Failed to generate unique campaign code' },
        { status: 500 }
      );
    }

    const campaignData: CampaignData = {
      dmId,
      campaignName,
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      redis.set(campaignKey(code), JSON.stringify(campaignData), {
        ex: SLIDING_TTL_SECONDS,
      }),
      redis.sadd(campaignPlayersKey(code), '__init__'),
      redis.expire(campaignPlayersKey(code), SLIDING_TTL_SECONDS),
    ]);

    return NextResponse.json({ code, campaign: campaignData }, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
