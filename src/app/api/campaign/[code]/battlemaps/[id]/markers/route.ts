import { NextRequest, NextResponse } from 'next/server';

import { verifyDmAuthority } from '@/lib/dmAuth';
import {
  claimMarkerLoot,
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
import type {
  MarkerLootLedgerEntry,
  MarkerStatus,
  PublicMarkerDetail,
} from '@/types/battlemap';
import { sendBattleMapPoke } from '@/lib/relayPoke';
import {
  guestDeniedResponse,
  rejectHybridGuestPrivilegeEscalation,
  requireGuestPlayerBinding,
} from '@/lib/guestRouteResponses';
import { authorizeHybridGuestRoute } from '@/lib/supabase/guestSessionServer';

const markerDetailsKey = (code: string, mapId: string) =>
  campaignSharedKey(code, `battlemap-markers:${mapId}`);

const STATUSES = new Set<MarkerStatus>([
  'closed',
  'open',
  'locked',
  'armed',
  'triggered',
  'disarmed',
  'available',
  'claimed',
  'active',
  'defeated',
  'hidden',
  'revealed',
  'resolved',
]);

function sanitizePublicMarkers(value: unknown): PublicMarkerDetail[] | null {
  if (!Array.isArray(value) || value.length > 500) return null;
  const result: PublicMarkerDetail[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const marker = raw as Record<string, unknown>;
    if (
      typeof marker.id !== 'string' ||
      marker.id.length === 0 ||
      marker.id.length > 200 ||
      typeof marker.title !== 'string' ||
      marker.title.length > 20_000 ||
      typeof marker.body !== 'string' ||
      marker.body.length > 100_000 ||
      (marker.status !== undefined &&
        !STATUSES.has(marker.status as MarkerStatus))
    )
      return null;
    result.push({
      id: marker.id,
      title: marker.title,
      body: marker.body,
      ...(marker.status === undefined
        ? {}
        : { status: marker.status as MarkerStatus }),
      ...(Array.isArray(marker.loot)
        ? {
            loot: marker.loot.flatMap(item => {
              if (!item || typeof item !== 'object') return [];
              const entry = item as Record<string, unknown>;
              if (
                typeof entry.id !== 'string' ||
                typeof entry.name !== 'string' ||
                (entry.itemKind !== 'inventory' &&
                  entry.itemKind !== 'magic') ||
                !Number.isInteger(entry.quantity) ||
                !Number.isInteger(entry.remainingQuantity)
              )
                return [];
              return [
                {
                  id: entry.id,
                  name: entry.name,
                  itemKind: entry.itemKind,
                  quantity: entry.quantity as number,
                  remainingQuantity: entry.remainingQuantity as number,
                  ...(typeof entry.description === 'string'
                    ? { description: entry.description }
                    : {}),
                  ...(typeof entry.rarity === 'string'
                    ? { rarity: entry.rarity }
                    : {}),
                },
              ];
            }),
          }
        : {}),
    });
  }
  return result;
}

function applyCanonicalRemaining(
  markers: PublicMarkerDetail[],
  ledger: MarkerLootLedgerEntry[]
): PublicMarkerDetail[] {
  const remaining = new Map(
    ledger.map(entry => [
      `${entry.markerId}:${entry.id}`,
      Math.max(0, entry.quantity - entry.claimedQuantity),
    ])
  );
  return markers.map(marker => ({
    id: marker.id,
    title: marker.title,
    body: marker.body,
    ...(marker.status === undefined ? {} : { status: marker.status }),
    ...(marker.loot === undefined
      ? {}
      : {
          loot: marker.loot.map(entry => ({
            ...entry,
            remainingQuantity: remaining.get(`${marker.id}:${entry.id}`) ?? 0,
          })),
        }),
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  const { code, id } = await params;
  try {
    const guest = await authorizeHybridGuestRoute(request, code, 'shared:read');
    if (guest.mode === 'denied') return guestDeniedResponse(guest);
    const redis = getRedis();
    const [markers, ledgerRaw] = await Promise.all([
      redis.get<PublicMarkerDetail[]>(markerDetailsKey(code, id)),
      getRawRedis().get<string>(campaignMarkerLootKey(code, id)),
    ]);
    await refreshCampaignTTL(redis, code);
    const ledger = ledgerRaw
      ? (JSON.parse(ledgerRaw) as MarkerLootLedgerEntry[])
      : [];
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
    if ((await verifyDmAuthority(redis, code, body.dmId)) !== 'ok')
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
        transferId: `transfer-loot-${requestId}`,
        now: new Date().toISOString(),
      },
      SLIDING_TTL_SECONDS
    );
    if (!result.ok) {
      const status = result.error === 'depleted' ? 409 : 404;
      return NextResponse.json({ error: result.error }, { status });
    }

    const [stored, ledgerRaw] = await Promise.all([
      redis.get<PublicMarkerDetail[]>(markerDetailsKey(code, id)),
      getRawRedis().get<string>(campaignMarkerLootKey(code, id)),
    ]);
    const updated = applyCanonicalRemaining(
      stored ?? [],
      ledgerRaw ? (JSON.parse(ledgerRaw) as MarkerLootLedgerEntry[]) : []
    );
    await refreshCampaignTTL(redis, code);
    await sendBattleMapPoke(code, redis, 'markers');
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
