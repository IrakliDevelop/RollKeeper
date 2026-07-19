import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignKey,
  campaignPlayersKey,
  campaignPlayerKey,
  campaignRemovedKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { CampaignData, CampaignPlayerData } from '@/types/campaign';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId, playerName, characterId, characterName, characterData } =
      body;

    if (!playerId || !playerName || !characterId || !characterData) {
      return NextResponse.json(
        {
          error:
            'playerId, playerName, characterId, and characterData are required',
        },
        { status: 400 }
      );
    }

    const redis = getRedis();

    const campaignRaw = await redis.get<string>(campaignKey(code));
    if (!campaignRaw) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const campaign: CampaignData =
      typeof campaignRaw === 'string' ? JSON.parse(campaignRaw) : campaignRaw;

    const playerData: CampaignPlayerData = {
      playerId,
      playerName,
      characterId,
      characterName: characterName || characterData.name || 'Unknown',
      characterData,
      lastSynced: new Date().toISOString(),
    };

    // Rejoin must not clobber a newer snapshot pushed by another tab:
    // keep whichever blob has the higher character revision.
    const existingRaw = await redis.get<string>(
      campaignPlayerKey(code, playerId)
    );
    let dataToStore = playerData;
    if (existingRaw) {
      const existing: CampaignPlayerData =
        typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
      const storedRevision = existing.characterData?.revision ?? 0;
      const incomingRevision = characterData.revision ?? 0;
      if (incomingRevision < storedRevision) {
        dataToStore = existing;
      }
    }

    await Promise.all([
      redis.sadd(campaignPlayersKey(code), playerId),
      redis.set(
        campaignPlayerKey(code, playerId),
        JSON.stringify(dataToStore),
        {
          ex: SLIDING_TTL_SECONDS,
        }
      ),
      redis.del(campaignRemovedKey(code, playerId)),
      refreshCampaignTTL(redis, code),
    ]);

    return NextResponse.json({
      success: true,
      campaignName: campaign.campaignName,
    });
  } catch (error) {
    console.error('Error joining campaign:', error);
    return NextResponse.json(
      { error: 'Failed to join campaign' },
      { status: 500 }
    );
  }
}
