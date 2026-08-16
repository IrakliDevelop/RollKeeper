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
import { sendBattleMapPoke } from '@/lib/relayPoke';
import { compareAndSetCampaignPlayer } from '@/lib/campaignPlayerCas';

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

    const playerData: CampaignPlayerData = {
      playerId,
      playerName: playerName || 'Unknown Player',
      characterId: characterId || characterData.id,
      characterName: characterName || characterData.name || 'Unknown',
      characterData,
      lastSynced: new Date().toISOString(),
    };

    const cas = await compareAndSetCampaignPlayer(
      redis,
      {
        player: campaignPlayerKey(code, playerId),
        players: campaignPlayersKey(code),
        removed: campaignRemovedKey(code, playerId),
      },
      playerData,
      SLIDING_TTL_SECONDS
    );
    if (cas.status === 'removed') {
      return NextResponse.json({ error: 'removed' }, { status: 410 });
    }
    if (cas.status === 'stale' || cas.status === 'conflict') {
      return NextResponse.json(
        { error: cas.status, current: cas.current },
        { status: 409 }
      );
    }
    await refreshCampaignTTL(redis, code);

    // Latency shave: nudge battle-map clients (other players' VTTs, the DM
    // VTT) to refetch player data now. Best-effort; polling is the fallback.
    await sendBattleMapPoke(code, redis, 'players');

    return NextResponse.json({
      success: true,
      lastSynced: cas.current?.lastSynced ?? playerData.lastSynced,
    });
  } catch (error) {
    console.error('Error syncing player data:', error);
    return NextResponse.json(
      { error: 'Failed to sync player data' },
      { status: 500 }
    );
  }
}
