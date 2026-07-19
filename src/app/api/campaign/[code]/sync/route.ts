import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignPlayersKey,
  campaignPlayerKey,
  campaignRemovedKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { CampaignPlayerData } from '@/types/campaign';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId, playerName, characterId, characterName, characterData } =
      body;

    if (!playerId || !characterData) {
      return NextResponse.json(
        { error: 'playerId and characterData are required' },
        { status: 400 }
      );
    }

    const redis = getRedis();

    const removed = await redis.exists(campaignRemovedKey(code, playerId));
    if (removed) {
      return NextResponse.json({ error: 'removed' }, { status: 410 });
    }

    // Revision gate: a stale tab must not clobber a newer snapshot.
    const existingRaw = await redis.get<string>(
      campaignPlayerKey(code, playerId)
    );
    if (existingRaw) {
      const existing: CampaignPlayerData =
        typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
      const storedRevision = existing.characterData?.revision ?? 0;
      const incomingRevision = characterData.revision ?? 0;
      if (incomingRevision < storedRevision) {
        return NextResponse.json(
          { error: 'stale', current: existing },
          { status: 409 }
        );
      }
    }

    const playerData: CampaignPlayerData = {
      playerId,
      playerName: playerName || 'Unknown Player',
      characterId: characterId || characterData.id,
      characterName: characterName || characterData.name || 'Unknown',
      characterData,
      lastSynced: new Date().toISOString(),
    };

    await Promise.all([
      redis.sadd(campaignPlayersKey(code), playerId),
      redis.expire(campaignPlayersKey(code), SLIDING_TTL_SECONDS),
      redis.set(campaignPlayerKey(code, playerId), JSON.stringify(playerData), {
        ex: SLIDING_TTL_SECONDS,
      }),
      refreshCampaignTTL(redis, code),
    ]);

    return NextResponse.json({
      success: true,
      lastSynced: playerData.lastSynced,
    });
  } catch (error) {
    console.error('Error syncing player data:', error);
    return NextResponse.json(
      { error: 'Failed to sync player data' },
      { status: 500 }
    );
  }
}
