import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  getRawRedis,
  campaignBattleMapsKey,
  campaignMarkerLootKey,
  campaignBattleMapKey,
  campaignFogAppearanceKey,
  campaignSharedKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';
import { shouldClearActiveBattleMap } from '@/lib/activeBattleMap';
import type { BattleMapMetadata, SyncedBattleMap } from '@/types/battlemap';
import type { SharedBattleMapState } from '@/types/sharedState';
import {
  GUEST_SESSION_COOKIE,
  isHybridGuestServerEnabled,
} from '@/lib/guestSessionSecurity';
import { rejectHybridGuestPrivilegeEscalation } from '@/lib/guestRouteResponses';
import {
  isTableProtocolRequired,
  tableRegistryKey,
} from '@/lib/tableServer/control';
import { authorizeTableDm } from '@/lib/tableServer/auth';
import {
  authorizeTableResourceAccess,
  credentialFromQuery,
  notFoundResponse,
} from '@/lib/tableServer/presentationAccess';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    if (
      isHybridGuestServerEnabled() &&
      request.cookies.has(GUEST_SESSION_COOKIE)
    ) {
      return NextResponse.json(
        { error: 'Guest battle-map access is not enabled' },
        { status: 403 }
      );
    }
    const { code, id } = await params;
    if (isTableProtocolRequired()) {
      const access = await authorizeTableResourceAccess({
        request,
        code,
        id,
        credential: credentialFromQuery(request),
      });
      if (access.status === 'denied') return access.response;
      // Q8: the audience gets registry-safe fields of the presented scene.
      if (access.status === 'allowed' && access.role !== 'dm') {
        if (access.resource.kind !== 'scene') return notFoundResponse();
        return NextResponse.json({
          battleMap: {
            id: access.resource.sceneId,
            sourceMapId: access.resource.sourceMapId,
            name: access.resource.safeLabel,
          },
        });
      }
    }
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
  // PR04 P6: legacy map publication is disabled under Table v1 (no client
  // uses it; Table scenes publish through the control service).
  if (isTableProtocolRequired()) {
    return NextResponse.json(
      { error: 'Table v1 control is required to publish battle maps' },
      { status: 426 }
    );
  }
  const guestDenied = rejectHybridGuestPrivilegeEscalation(request);
  if (guestDenied) return guestDenied;
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
    // The detail key uses the path id and the metadata the payload id: they
    // must name the same map.
    if (battleMap.id !== id) {
      return NextResponse.json(
        { error: 'battleMap.id must match the route id' },
        { status: 400 }
      );
    }

    const redis = getRedis();
    const dmAuth = await verifyDmAuthority(redis, code, dmId);
    if (dmAuth !== 'ok') {
      return NextResponse.json(
        { error: 'dmId is not authorized for this campaign' },
        { status: 403 }
      );
    }
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
  if (isTableProtocolRequired()) return deleteUnderTableV1(request, params);
  const guestDenied = rejectHybridGuestPrivilegeEscalation(request);
  if (guestDenied) return guestDenied;
  try {
    const { code, id } = await params;
    const body = await request.json();
    const { dmId } = body as { dmId: string };

    if (!dmId) {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }

    const redis = getRedis();
    const dmAuth = await verifyDmAuthority(redis, code, dmId);
    if (dmAuth !== 'ok') {
      return NextResponse.json(
        { error: 'dmId is not authorized for this campaign' },
        { status: 403 }
      );
    }
    await redis.del(campaignBattleMapKey(code, id));
    await redis.del(campaignFogAppearanceKey(code, id));

    // The shared "live map" pointer is sticky — never cleared by a relink or
    // delete. If it still references the map being deleted, clear it so players
    // don't get stranded opening a dead map (they'd see the old/removed one).
    const sharedRaw = await redis.get<string | SharedBattleMapState>(
      campaignSharedKey(code, 'battlemap')
    );
    if (shouldClearActiveBattleMap(sharedRaw, id)) {
      await redis.del(campaignSharedKey(code, 'battlemap'));
    }

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

/**
 * PR04 P6/Q9: under Table v1 a battle map DELETE needs full DM mutation
 * authority, answers 404 for any registry scene id (scenes leave only
 * through the control service), and otherwise removes only the legacy
 * map-keyed records of that id — never a tagged key, the registry or a
 * reserved projection.
 */
async function deleteUnderTableV1(
  request: NextRequest,
  params: Promise<{ code: string; id: string }>
) {
  const { code, id } = await params;
  const body = (await request.json().catch(() => null)) as {
    dmId?: unknown;
  } | null;
  const auth = await authorizeTableDm(request, code, body?.dmId, true);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  let registered: unknown;
  try {
    registered = await getRawRedis().hget(tableRegistryKey(code), id);
  } catch {
    return NextResponse.json(
      { error: 'Live authority is unavailable' },
      { status: 503 }
    );
  }
  if (registered !== null && registered !== undefined)
    return notFoundResponse();
  try {
    const redis = getRedis();
    await redis.del(
      campaignBattleMapKey(code, id),
      campaignFogAppearanceKey(code, id),
      campaignSharedKey(code, `battlemap-markers:${id}`),
      campaignMarkerLootKey(code, id)
    );
    const existingRaw = await redis.get<BattleMapMetadata[]>(
      campaignBattleMapsKey(code)
    );
    if (existingRaw) {
      const existing: BattleMapMetadata[] = Array.isArray(existingRaw)
        ? existingRaw
        : (JSON.parse(existingRaw as unknown as string) as BattleMapMetadata[]);
      const filtered = existing.filter(entry => entry.id !== id);
      if (filtered.length === 0) await redis.del(campaignBattleMapsKey(code));
      else
        await redis.set(campaignBattleMapsKey(code), filtered, {
          ex: SLIDING_TTL_SECONDS,
        });
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
