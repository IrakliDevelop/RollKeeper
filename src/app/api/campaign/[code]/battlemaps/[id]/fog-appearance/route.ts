import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignFogAppearanceKey,
  SLIDING_TTL_SECONDS,
  refreshCampaignTTL,
} from '@/lib/redis';
import { authorizeBattleMapSession } from '@/lib/battleMapSessionAuth';
import { sendBattleMapPokeToRoom } from '@/lib/relayPoke';
import {
  downgradeFogAppearanceForGate,
  isFogAppearanceV1,
  isFogPresetLibraryEnabled,
  isProceduralFogAppearanceEnabled,
  parseBattleMapFogAppearanceProjection,
  parseProjectedFogAppearance,
  type BattleMapFogAppearanceProjection,
} from '@/lib/fogOfWar';
import type { ProjectedFogAppearance } from '@/types/battlemap';

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
    if (!isProceduralFogAppearanceEnabled()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!isValidBattleMapId(id)) {
      return NextResponse.json({ error: 'Invalid map id' }, { status: 400 });
    }

    const redis = getRedis();
    const body = Object.fromEntries(new URL(request.url).searchParams);
    const session = await authorizeBattleMapSession(
      redis,
      code,
      request,
      {
        role: (body.role as 'dm' | 'player' | 'display') ?? undefined,
        dmId: body.dmId,
        playerId: body.playerId,
        displayKey: body.displayKey,
      },
      { mutation: false }
    );
    if (!session.authorized) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status }
      );
    }

    let fogAppearance: ProjectedFogAppearance = 'solid';
    let updatedAt: string | null = null;
    const raw = await redis.get<BattleMapFogAppearanceProjection>(
      campaignFogAppearanceKey(code, id)
    );
    const projection = parseBattleMapFogAppearanceProjection(raw);
    if (projection) {
      fogAppearance = downgradeFogAppearanceForGate(
        projection.appearance,
        isFogPresetLibraryEnabled()
      );
      updatedAt = projection.updatedAt;
    }

    return NextResponse.json({ fogAppearance, updatedAt });
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
    if (!isProceduralFogAppearanceEnabled()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
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

    let appearance: ProjectedFogAppearance;
    if (isFogAppearanceV1(body.appearance)) {
      appearance = body.appearance;
    } else if (
      isFogPresetLibraryEnabled() &&
      typeof body.appearance === 'object' &&
      body.appearance !== null &&
      parseProjectedFogAppearance(body.appearance) !== 'solid'
    ) {
      appearance = parseProjectedFogAppearance(body.appearance);
    } else {
      return NextResponse.json(
        {
          error: isFogPresetLibraryEnabled()
            ? 'appearance must be solid, cloudy, or a valid custom material'
            : 'appearance must be solid or cloudy',
        },
        { status: 400 }
      );
    }

    const redis = getRedis();
    const session = await authorizeBattleMapSession(
      redis,
      code,
      request,
      {
        role: 'dm',
        dmId: body.dmId,
      },
      { mutation: true }
    );
    if (!session.authorized) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status }
      );
    }

    const updatedAt = new Date().toISOString();
    const projection: BattleMapFogAppearanceProjection =
      typeof appearance === 'string'
        ? { v: 1, appearance, updatedAt }
        : { v: 2, appearance, updatedAt };
    await redis.set(campaignFogAppearanceKey(code, id), projection, {
      ex: SLIDING_TTL_SECONDS,
    });
    await refreshCampaignTTL(redis, code);

    await sendBattleMapPokeToRoom(code, id, 'fog-appearance');

    return NextResponse.json({
      fogAppearance: appearance,
      updatedAt: projection.updatedAt,
    });
  } catch (error) {
    console.error('Failed to write fog appearance:', error);
    return NextResponse.json(
      { error: 'Failed to write fog appearance' },
      { status: 500 }
    );
  }
}
