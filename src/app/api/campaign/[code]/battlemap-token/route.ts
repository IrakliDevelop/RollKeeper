import { NextRequest, NextResponse } from 'next/server';
import { getRedis, campaignFogAppearanceKey } from '@/lib/redis';
import { signBattleMapToken } from '@/lib/battlemapToken';
import { authorizeBattleMapSession } from '@/lib/battleMapSessionAuth';
import { recordLiveMapRoom } from '@/lib/liveMapRooms';
import {
  parseBattleMapFogAppearanceProjection,
  type BattleMapFogAppearanceProjection,
} from '@/lib/fogOfWar';
import type { ProjectedFogAppearance } from '@/types/battlemap';

const TOKEN_TTL_MS = 5 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const secret = process.env.BATTLEMAP_RELAY_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Live battle map relay is not configured' },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      role?: 'dm' | 'player' | 'display';
      battleMapId?: string;
      dmId?: string;
      playerId?: string;
      displayKey?: string;
      protocols?: { fog?: number };
    };
    const { battleMapId, protocols } = body;
    if (!battleMapId) {
      return NextResponse.json(
        { error: 'role and battleMapId are required' },
        { status: 400 }
      );
    }

    if (process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED === 'true') {
      if (!protocols || typeof protocols !== 'object' || protocols.fog !== 1) {
        return NextResponse.json(
          { error: 'Client upgrade required — please refresh your browser' },
          { status: 426 }
        );
      }
    }

    const redis = getRedis();
    const session = await authorizeBattleMapSession(
      redis,
      code,
      request,
      body,
      {
        mutation: true,
      }
    );
    if (!session.authorized) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status }
      );
    }

    // Best-effort: record that this campaign/battle-map pair has a live
    // client, so a later poke can fan out to every live room instead of
    // only the campaign's activeBattleMapId. Runs only after authorization
    // succeeds — an unauthorized caller must never write into the registry.
    // recordLiveMapRoom swallows its own errors, so awaiting it here cannot
    // fail the mint; it's awaited only for deterministic ordering in tests.
    await recordLiveMapRoom(redis, code, battleMapId);

    const token = signBattleMapToken(
      {
        userId: session.userId,
        role: session.role,
        room: `${code}:${battleMapId}`,
        exp: Date.now() + TOKEN_TTL_MS,
      },
      secret
    );

    let fogAppearance: ProjectedFogAppearance = 'solid';
    let fogAppearanceUpdatedAt: string | null = null;
    try {
      const raw = await redis.get<BattleMapFogAppearanceProjection>(
        campaignFogAppearanceKey(code, battleMapId)
      );
      const projection = parseBattleMapFogAppearanceProjection(raw);
      if (projection) {
        fogAppearance = projection.appearance;
        fogAppearanceUpdatedAt = projection.updatedAt;
      }
    } catch {
      // Default to solid on read failure.
    }

    return NextResponse.json({
      token,
      fogAppearance,
      fogAppearanceUpdatedAt,
    });
  } catch (error) {
    console.error('Error minting battle map token:', error);
    return NextResponse.json(
      { error: 'Failed to mint token' },
      { status: 500 }
    );
  }
}
