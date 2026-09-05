import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignFogAppearanceKey,
  SLIDING_TTL_SECONDS,
  refreshCampaignTTL,
} from '@/lib/redis';
import { authorizeBattleMapSession } from '@/lib/battleMapSessionAuth';
import { parseFogAppearance } from '@/components/ui/campaign/location-map/fog/fogAppearance';
import { sendBattleMapPokeToRoom } from '@/lib/relayPoke';
import type { BattleMapFogAppearanceProjectionV1 } from '@/lib/fogOfWar';
import type { FogAppearanceV1 } from '@/types/battlemap';

const MAX_BATTLE_MAP_ID_LENGTH = 200;

function isValidBattleMapId(id: string): boolean {
  return id.length >= 1 && id.length <= MAX_BATTLE_MAP_ID_LENGTH;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await params;
    if (!isValidBattleMapId(id)) {
      return NextResponse.json({ error: 'Invalid map id' }, { status: 400 });
    }

    const redis = getRedis();
    const body = Object.fromEntries(new URL(request.url).searchParams);
    const session = await authorizeBattleMapSession(redis, code, request, {
      role: (body.role as 'dm' | 'player' | 'display') ?? undefined,
      dmId: body.dmId,
      playerId: body.playerId,
      displayKey: body.displayKey,
    });
    if (!session.authorized) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status }
      );
    }

    let fogAppearance: FogAppearanceV1 = 'solid';
    const projection = await redis.get<BattleMapFogAppearanceProjectionV1>(
      campaignFogAppearanceKey(code, id)
    );
    if (projection && typeof projection === 'object') {
      fogAppearance = parseFogAppearance(projection.appearance);
    }

    return NextResponse.json({ fogAppearance });
  } catch (error) {
    console.error('Failed to read fog appearance:', error);
    return NextResponse.json(
      { error: 'Failed to read fog appearance' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await params;
    if (!isValidBattleMapId(id)) {
      return NextResponse.json({ error: 'Invalid map id' }, { status: 400 });
    }

    const body = (await request.json()) as {
      dmId?: string;
      appearance?: unknown;
    };
    if (!body.dmId) {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }

    const appearance = parseFogAppearance(body.appearance);

    const redis = getRedis();
    const session = await authorizeBattleMapSession(redis, code, request, {
      role: 'dm',
      dmId: body.dmId,
    });
    if (!session.authorized) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status }
      );
    }

    const projection: BattleMapFogAppearanceProjectionV1 = {
      v: 1,
      appearance,
      updatedAt: new Date().toISOString(),
    };
    await redis.set(campaignFogAppearanceKey(code, id), projection, {
      ex: SLIDING_TTL_SECONDS,
    });
    await refreshCampaignTTL(redis, code);

    void sendBattleMapPokeToRoom(code, id, 'fog-appearance');

    return NextResponse.json({ fogAppearance: appearance });
  } catch (error) {
    console.error('Failed to write fog appearance:', error);
    return NextResponse.json(
      { error: 'Failed to write fog appearance' },
      { status: 500 }
    );
  }
}
