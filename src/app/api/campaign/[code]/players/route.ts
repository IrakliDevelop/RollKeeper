import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignKey,
  campaignPlayersKey,
  campaignPlayerKey,
  refreshCampaignTTL,
} from '@/lib/redis';
import { CampaignData, CampaignPlayerData } from '@/types/campaign';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const redis = getRedis();

    const campaignRaw = await redis.get<string>(campaignKey(code));

    let campaignInfo: { code: string; name: string; createdAt: string } | null =
      null;

    if (campaignRaw) {
      const campaign: CampaignData =
        typeof campaignRaw === 'string' ? JSON.parse(campaignRaw) : campaignRaw;
      campaignInfo = {
        code,
        name: campaign.campaignName,
        createdAt: campaign.createdAt,
      };
    }

    const playerIds = await redis.smembers(campaignPlayersKey(code));
    const realPlayerIds = playerIds.filter(id => id !== '__init__');

    const players: CampaignPlayerData[] = [];

    if (realPlayerIds.length > 0) {
      const pipeline = redis.pipeline();
      for (const pid of realPlayerIds) {
        pipeline.get(campaignPlayerKey(code, pid));
      }
      const results = await pipeline.exec();

      for (const raw of results) {
        if (raw) {
          const parsed: CampaignPlayerData =
            typeof raw === 'string' ? JSON.parse(raw) : raw;
          players.push(parsed);
        }
      }

      players.sort((a, b) => a.playerId.localeCompare(b.playerId));
    }

    if (campaignRaw) {
      await refreshCampaignTTL(redis, code);
    }

    return NextResponse.json({
      campaign: campaignInfo,
      players,
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 500 }
    );
  }
}
