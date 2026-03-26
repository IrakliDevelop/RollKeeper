import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignKey,
  campaignBattleMapsKey,
  campaignBattleMapKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import type { CampaignData } from '@/types/campaign';
import type { BattleMapMetadata, SyncedBattleMap } from '@/types/battlemap';

async function checkAndUpdateDmId(
  redis: ReturnType<typeof getRedis>,
  code: string,
  dmId: string
): Promise<void> {
  const campaignRaw = await redis.get<string>(campaignKey(code));
  if (campaignRaw) {
    const campaign: CampaignData =
      typeof campaignRaw === 'string' ? JSON.parse(campaignRaw) : campaignRaw;
    if (campaign.dmId !== dmId) {
      await redis.set(
        campaignKey(code),
        JSON.stringify({ ...campaign, dmId }),
        { ex: SLIDING_TTL_SECONDS }
      );
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await params;
    const redis = getRedis();
    const raw = await redis.get<SyncedBattleMap>(
      campaignBattleMapKey(code, id)
    );
    await refreshCampaignTTL(redis, code);
    if (!raw) {
      return NextResponse.json(
        { error: 'Battle map not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ battleMap: raw });
  } catch (error) {
    console.error('Failed to fetch battle map:', error);
    return NextResponse.json(
      { error: 'Failed to fetch battle map' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await params;
    const body = await request.json();
    const { dmId, battleMap } = body as {
      dmId: string;
      battleMap: SyncedBattleMap;
    };

    if (!dmId || !battleMap) {
      return NextResponse.json(
        { error: 'dmId and battleMap are required' },
        { status: 400 }
      );
    }

    const redis = getRedis();
    await checkAndUpdateDmId(redis, code, dmId);
    await redis.set(campaignBattleMapKey(code, id), battleMap, {
      ex: SLIDING_TTL_SECONDS,
    });

    const existingRaw = await redis.get<BattleMapMetadata[]>(
      campaignBattleMapsKey(code)
    );
    const existing: BattleMapMetadata[] = existingRaw
      ? Array.isArray(existingRaw)
        ? existingRaw
        : (JSON.parse(existingRaw as unknown as string) as BattleMapMetadata[])
      : [];

    const metadata: BattleMapMetadata = {
      id: battleMap.id,
      name: battleMap.name,
      mapImageUrl: battleMap.mapImageUrl,
      updatedAt: battleMap.updatedAt,
    };

    const updated = existing.filter(l => l.id !== id);
    updated.push(metadata);

    await redis.set(campaignBattleMapsKey(code), updated, {
      ex: SLIDING_TTL_SECONDS,
    });
    await refreshCampaignTTL(redis, code);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save battle map:', error);
    return NextResponse.json(
      { error: 'Failed to save battle map' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await params;
    const body = await request.json();
    const { dmId } = body as { dmId: string };

    if (!dmId) {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }

    const redis = getRedis();
    await checkAndUpdateDmId(redis, code, dmId);
    await redis.del(campaignBattleMapKey(code, id));

    const existingRaw = await redis.get<BattleMapMetadata[]>(
      campaignBattleMapsKey(code)
    );
    if (existingRaw) {
      const existing: BattleMapMetadata[] = Array.isArray(existingRaw)
        ? existingRaw
        : (JSON.parse(existingRaw as unknown as string) as BattleMapMetadata[]);
      const filtered = existing.filter(l => l.id !== id);
      if (filtered.length === 0) {
        await redis.del(campaignBattleMapsKey(code));
      } else {
        await redis.set(campaignBattleMapsKey(code), filtered, {
          ex: SLIDING_TTL_SECONDS,
        });
      }
    }

    await refreshCampaignTTL(redis, code);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete battle map:', error);
    return NextResponse.json(
      { error: 'Failed to delete battle map' },
      { status: 500 }
    );
  }
}
