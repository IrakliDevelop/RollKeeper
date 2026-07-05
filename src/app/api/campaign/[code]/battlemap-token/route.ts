import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignPlayersKey,
  campaignDisplayKeyKey,
} from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';
import { signBattleMapToken, type BattleMapRole } from '@/lib/battlemapToken';

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
      role?: BattleMapRole;
      battleMapId?: string;
      dmId?: string;
      playerId?: string;
      displayKey?: string;
    };
    const { role, battleMapId, dmId, playerId, displayKey } = body;
    if (!role || !battleMapId) {
      return NextResponse.json(
        { error: 'role and battleMapId are required' },
        { status: 400 }
      );
    }

    const redis = getRedis();
    let userId: string;

    if (role === 'dm') {
      if (!dmId) {
        return NextResponse.json(
          { error: 'dmId is required' },
          { status: 400 }
        );
      }
      const dmAuth = await verifyDmAuthority(redis, code, dmId);
      if (dmAuth !== 'ok') {
        return NextResponse.json(
          { error: 'Not the campaign DM' },
          { status: 403 }
        );
      }
      userId = dmId;
    } else if (role === 'player') {
      if (!playerId) {
        return NextResponse.json(
          { error: 'playerId is required' },
          { status: 400 }
        );
      }
      const isMember = await redis.sismember(
        campaignPlayersKey(code),
        playerId
      );
      if (!isMember) {
        return NextResponse.json(
          { error: 'Player is not in this campaign' },
          { status: 403 }
        );
      }
      userId = playerId;
    } else if (role === 'display') {
      if (!displayKey) {
        return NextResponse.json(
          { error: 'displayKey is required' },
          { status: 400 }
        );
      }
      const stored = await redis.get<string>(campaignDisplayKeyKey(code));
      if (!stored || stored !== displayKey) {
        return NextResponse.json(
          { error: 'Invalid display key' },
          { status: 403 }
        );
      }
      userId = `display-${code}`;
    } else {
      return NextResponse.json({ error: 'Unknown role' }, { status: 400 });
    }

    const token = signBattleMapToken(
      {
        userId,
        role,
        room: `${code}:${battleMapId}`,
        exp: Date.now() + TOKEN_TTL_MS,
      },
      secret
    );
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error minting battle map token:', error);
    return NextResponse.json(
      { error: 'Failed to mint token' },
      { status: 500 }
    );
  }
}
