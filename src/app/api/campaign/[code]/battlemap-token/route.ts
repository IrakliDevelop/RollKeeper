import { NextRequest, NextResponse } from 'next/server';
import { getRedis, campaignFogAppearanceKey } from '@/lib/redis';
import { signBattleMapToken } from '@/lib/battlemapToken';
import { authorizeBattleMapSession } from '@/lib/battleMapSessionAuth';
import { parseFogAppearance } from '@/components/ui/campaign/location-map/fog/fogAppearance';
import type { BattleMapFogAppearanceProjectionV1 } from '@/lib/fogOfWar';
import type { FogAppearanceV1 } from '@/types/battlemap';

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
    const session = await authorizeBattleMapSession(redis, code, request, body);
    if (!session.authorized) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status }
      );
    }

    const token = signBattleMapToken(
      {
        userId: session.userId,
        role: session.role,
        room: `${code}:${battleMapId}`,
        exp: Date.now() + TOKEN_TTL_MS,
      },
      secret
    );

    let fogAppearance: FogAppearanceV1 = 'solid';
    try {
      const projection = await redis.get<BattleMapFogAppearanceProjectionV1>(
        campaignFogAppearanceKey(code, battleMapId)
      );
      if (projection && typeof projection === 'object') {
        fogAppearance = parseFogAppearance(projection.appearance);
      }
    } catch {
      // Default to solid on read failure.
    }

    return NextResponse.json({ token, fogAppearance });
  } catch (error) {
    console.error('Error minting battle map token:', error);
    return NextResponse.json(
      { error: 'Failed to mint token' },
      { status: 500 }
    );
  }
}
