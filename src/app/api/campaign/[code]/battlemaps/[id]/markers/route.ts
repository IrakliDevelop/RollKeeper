import { NextRequest, NextResponse } from 'next/server';

import { verifyDmAuthority } from '@/lib/dmAuth';
import {
  claimMarkerLoot,
  parseStoredMarkerLootLedger,
  seedMarkerLoot,
  validateMarkerLootSeed,
} from '@/lib/markerLootClaims';
import {
  campaignMarkerClaimKey,
  campaignMarkerLootKey,
  campaignPlayersKey,
  campaignSharedKey,
  campaignTransfersKey,
  getRawRedis,
  getRedis,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import {
  applyCanonicalRemaining,
  sanitizePublicMarkers,
} from '@/lib/sanitizePublicMarkers';
import type { PublicMarkerDetail } from '@/types/battlemap';
import { sendBattleMapPokeToRoom } from '@/lib/relayPoke';
import {
  guestDeniedResponse,
  rejectHybridGuestPrivilegeEscalation,
  requireGuestPlayerBinding,
} from '@/lib/guestRouteResponses';
import { authorizeHybridGuestRoute } from '@/lib/supabase/guestSessionServer';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import {
  authorizeTableAudienceWrite,
  authorizeTableResourceAccess,
  authorizeTableSceneWrite,
  credentialFromQuery,
} from '@/lib/tableServer/presentationAccess';

const markerDetailsKey = (code: string, mapId: string) =>
  campaignSharedKey(code, `battlemap-markers:${mapId}`);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  const { code, id } = await params;
  try {
    // PR04 P5: scene ids are readable by the audience only while presented;
    // a verified location keeps its existing authorization below.
    const access = isTableProtocolRequired()
      ? await authorizeTableResourceAccess({
          request,
          code,
          id,
          credential: credentialFromQuery(request),
        })
      : null;
    if (access?.status === 'denied') return access.response;
    const guest = await authorizeHybridGuestRoute(request, code, 'shared:read');
    if (guest.mode === 'denied') return guestDeniedResponse(guest);
    const redis = getRedis();
    const [markers, ledgerRaw] = await Promise.all([
      redis.get<PublicMarkerDetail[]>(markerDetailsKey(code, id)),
      getRawRedis().get<string>(campaignMarkerLootKey(code, id)),
    ]);
    await refreshCampaignTTL(redis, code);
    const ledger = parseStoredMarkerLootLedger(ledgerRaw);
    return NextResponse.json({
      markers: applyCanonicalRemaining(markers ?? [], ledger),
    });
  } catch (error) {
    console.error('Failed to fetch battle-map markers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marker details' },
      { status: 500 }
    );
  }
}

/** DM publishes safe details plus private transferable definitions. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  const guestDenied = rejectHybridGuestPrivilegeEscalation(request);
  if (guestDenied) return guestDenied;
  const { code, id } = await params;
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body.dmId !== 'string')
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    const markers = sanitizePublicMarkers(body.markers);
    const ledger = validateMarkerLootSeed(body.loot);
    if (!markers || !ledger)
      return NextResponse.json(
        { error: 'Invalid marker data' },
        { status: 400 }
      );

    const redis = getRedis();
    // PR04 C4-2: a scene id needs campaign DM mutation authority and a
    // registered, non-deleted scene; other ids keep the existing check.
    const sceneWrite = isTableProtocolRequired()
      ? await authorizeTableSceneWrite({ request, code, id, dmId: body.dmId })
      : ({ status: 'legacy' } as const);
    if (sceneWrite.status === 'denied') return sceneWrite.response;
    if (
      sceneWrite.status === 'legacy' &&
      (await verifyDmAuthority(redis, code, body.dmId)) !== 'ok'
    )
      return NextResponse.json(
        { error: 'dmId is not authorized for this campaign' },
        { status: 403 }
      );

    const canonical = await seedMarkerLoot(
      getRawRedis(),
      campaignMarkerLootKey(code, id),
      ledger,
      SLIDING_TTL_SECONDS
    );
    const publicMarkers = applyCanonicalRemaining(markers, canonical);
    await redis.set(markerDetailsKey(code, id), publicMarkers, {
      ex: SLIDING_TTL_SECONDS,
    });
    await refreshCampaignTTL(redis, code);
    await sendBattleMapPokeToRoom(code, id, 'markers');
    return NextResponse.json({ success: true, markers: publicMarkers });
  } catch (error) {
    console.error('Failed to publish battle-map markers:', error);
    return NextResponse.json(
      { error: 'Failed to publish marker details' },
      { status: 500 }
    );
  }
}

/** Player atomically claims one unit and queues one idempotent transfer. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  const { code, id } = await params;
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (
      !body ||
      !['playerId', 'markerId', 'entryId', 'requestId'].every(
        key =>
          typeof body[key] === 'string' &&
          (body[key] as string).length > 0 &&
          (body[key] as string).length <= 200
      )
    )
      return NextResponse.json(
        { error: 'Invalid claim request' },
        { status: 400 }
      );

    const quantity = body.quantity === undefined ? 1 : body.quantity;
    if (
      !Number.isInteger(quantity) ||
      (quantity as number) < 1 ||
      (quantity as number) > 999
    )
      return NextResponse.json(
        { error: 'Invalid claim quantity' },
        { status: 400 }
      );

    const playerId = body.playerId as string;
    const guest = await authorizeHybridGuestRoute(
      request,
      code,
      'marker:claim',
      true
    );
    if (guest.mode === 'denied') return guestDeniedResponse(guest);
    const authorizedPlayerId =
      guest.mode === 'guest'
        ? requireGuestPlayerBinding(guest, [playerId])
        : playerId;
    if (!authorizedPlayerId) {
      return NextResponse.json(
        { error: 'Guest player binding does not match' },
        { status: 403 }
      );
    }
    const redis = getRedis();
    if (!(await redis.sismember(campaignPlayersKey(code), authorizedPlayerId)))
      return NextResponse.json(
        { error: 'Player is not a member of this campaign' },
        { status: 403 }
      );
    // PR04 P6: under Table v1 only the presented, unblanked scene accepts a
    // claim; the ledger logic below is unchanged.
    if (isTableProtocolRequired()) {
      const audience = await authorizeTableAudienceWrite({ code, id });
      if (audience.status === 'denied') return audience.response;
    }

    const requestId = body.requestId as string;
    const result = await claimMarkerLoot(
      getRawRedis(),
      {
        ledger: campaignMarkerLootKey(code, id),
        transfers: campaignTransfersKey(code, authorizedPlayerId),
        receipt: campaignMarkerClaimKey(
          code,
          id,
          authorizedPlayerId,
          requestId
        ),
      },
      {
        markerId: body.markerId as string,
        entryId: body.entryId as string,
        requestId,
        transferIdPrefix: `transfer-loot-${requestId}`,
        quantity: quantity as number,
        now: new Date().toISOString(),
      },
      SLIDING_TTL_SECONDS
    );
    if (!result.ok) {
      const status =
        result.error === 'depleted'
          ? 409
          : result.error === 'locked'
            ? 403
            : 404;
      return NextResponse.json({ error: result.error }, { status });
    }

    const [stored, ledgerRaw] = await Promise.all([
      redis.get<PublicMarkerDetail[]>(markerDetailsKey(code, id)),
      getRawRedis().get<string>(campaignMarkerLootKey(code, id)),
    ]);
    const updated = applyCanonicalRemaining(
      stored ?? [],
      parseStoredMarkerLootLedger(ledgerRaw)
    );
    await refreshCampaignTTL(redis, code);
    await sendBattleMapPokeToRoom(code, id, 'markers');
    return NextResponse.json({
      success: true,
      claim: result.claim,
      markers: updated,
    });
  } catch (error) {
    console.error('Failed to claim marker loot:', error);
    return NextResponse.json(
      { error: 'Failed to claim loot' },
      { status: 500 }
    );
  }
}
