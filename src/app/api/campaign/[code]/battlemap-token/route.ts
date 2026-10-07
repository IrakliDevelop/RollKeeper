import { NextRequest, NextResponse } from 'next/server';
import { getRedis, getRawRedis, campaignFogAppearanceKey } from '@/lib/redis';
import { signBattleMapToken } from '@/lib/battlemapToken';
import { battleMapRelayRoom } from '@/lib/battlemapRoom';
import { authorizeBattleMapSession } from '@/lib/battleMapSessionAuth';
import { recordLiveMapRoom, type LiveMapRoomKind } from '@/lib/liveMapRooms';
import {
  parseBattleMapFogAppearanceProjection,
  type BattleMapFogAppearanceProjection,
} from '@/lib/fogOfWar';
import type { ProjectedFogAppearance } from '@/types/battlemap';
import { proveRelayAuthority } from '@/lib/tableServer/authorityProof';
import {
  isTableProtocolRequired,
  tableControlKey,
  tableRegistryKey,
} from '@/lib/tableServer/control';
import { tableAuthorityRoomKeys } from '@/lib/tableServer/keys';
import { resolvePresentedTableScene } from '@/lib/tableServer/presentation';
import {
  isSafeResourceId,
  resolveVerifiedLocation,
} from '@/lib/tableServer/resourceKind';

const TOKEN_TTL_MS = 5 * 60 * 1000;

function decodeRecord(value: unknown): Record<string, unknown> | null {
  try {
    const decoded =
      typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Fog-appearance projection of a map/scene id; solid on absence or error. */
async function readFogAppearance(
  redis: ReturnType<typeof getRedis>,
  code: string,
  id: string
): Promise<{
  fogAppearance: ProjectedFogAppearance;
  updatedAt: string | null;
}> {
  try {
    const projection = parseBattleMapFogAppearanceProjection(
      await redis.get<BattleMapFogAppearanceProjection>(
        campaignFogAppearanceKey(code, id)
      )
    );
    if (projection)
      return {
        fogAppearance: projection.appearance,
        updatedAt: projection.updatedAt,
      };
  } catch {
    // Default to solid on read failure.
  }
  return { fogAppearance: 'solid', updatedAt: null };
}

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
      sceneId?: string;
      protocols?: { fog?: number; authority?: number };
      kind?: string;
    };
    const { battleMapId, protocols } = body;
    if (!battleMapId) {
      return NextResponse.json(
        { error: 'role and battleMapId are required' },
        { status: 400 }
      );
    }
    const tableRequired = isTableProtocolRequired();
    const sceneIdPresent = Object.prototype.hasOwnProperty.call(
      body,
      'sceneId'
    );
    if (
      tableRequired &&
      (!isSafeResourceId(battleMapId) ||
        (sceneIdPresent && !isSafeResourceId(body.sceneId)))
    ) {
      return NextResponse.json(
        { error: 'Invalid scene or battle map identifier' },
        { status: 400 }
      );
    }
    // Under Table v1, only a no-scene location hint is eligible for legacy
    // resolution. A present valid scene ID always selects scene authority.
    const locationClaim =
      tableRequired && !sceneIdPresent && body.kind === 'location';
    const tableV1 = tableRequired && !locationClaim;
    let legacyRoom: string | null = null;
    if (!tableV1) {
      try {
        legacyRoom = battleMapRelayRoom(code, battleMapId);
      } catch {
        return NextResponse.json(
          { error: 'Invalid campaign or battle map identifier' },
          { status: 400 }
        );
      }
    }

    if (process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED === 'true') {
      if (!protocols || typeof protocols !== 'object' || protocols.fog !== 1) {
        return NextResponse.json(
          { error: 'Client upgrade required — please refresh your browser' },
          { status: 426 }
        );
      }
    }
    if (
      tableV1 &&
      (!protocols ||
        typeof protocols !== 'object' ||
        protocols.fog !== 1 ||
        protocols.authority !== 1)
    ) {
      return NextResponse.json(
        { error: 'Client upgrade required — please refresh your browser' },
        { status: 426 }
      );
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

    let resolvedLegacyKind: LiveMapRoomKind =
      body.kind === 'location' ? 'location' : 'battlemap';
    if (locationClaim) {
      let registryRedis: ReturnType<typeof getRawRedis>;
      try {
        registryRedis = getRawRedis();
      } catch {
        return NextResponse.json(
          { error: 'Location authority is unavailable' },
          { status: 503 }
        );
      }
      const resolution = await resolveVerifiedLocation({
        redis,
        registryRedis,
        campaign: code,
        battleMapId,
        registryKey: tableRegistryKey(code),
      });
      if (resolution.status === 'unavailable') {
        return NextResponse.json(
          { error: 'Location authority is unavailable' },
          { status: 503 }
        );
      }
      if (resolution.status !== 'verified') {
        return NextResponse.json(
          { error: 'Location is unavailable' },
          { status: 409 }
        );
      }
      resolvedLegacyKind = 'location';
    }

    if (tableV1 && session.role !== 'dm') {
      // R4: map-pinned player/display surfaces open the source map URL and
      // reach only the current, unblanked presentation adopted from it.
      // Every availability miss is one uniform answer (no registry probing).
      let rawRedis: ReturnType<typeof getRawRedis>;
      try {
        rawRedis = getRawRedis();
      } catch {
        return NextResponse.json(
          { error: 'Live authority is unavailable' },
          { status: 503 }
        );
      }
      const resolution = await resolvePresentedTableScene({
        rawRedis,
        campaign: code,
        battleMapId,
        requestedSceneId: body.sceneId,
        role: session.role,
      });
      if (resolution.status === 'error') {
        return NextResponse.json(
          { error: 'Live authority is unavailable' },
          { status: 503 }
        );
      }
      if (resolution.status !== 'resolved') {
        return NextResponse.json(
          { error: 'Scene is unavailable' },
          { status: 403 }
        );
      }
      if (!(await proveRelayAuthority(code))) {
        return NextResponse.json(
          { error: 'Live authority is unavailable' },
          { status: 503 }
        );
      }
      const common = {
        v: 1 as const,
        userId: session.userId,
        room: resolution.room,
        exp: Date.now() + TOKEN_TTL_MS,
        campaign: code,
        resourceKind: 'scene' as const,
        sceneId: resolution.sceneId,
        epoch: resolution.epoch,
        roomGeneration: resolution.roomGeneration,
      };
      const token = signBattleMapToken(
        session.role === 'player'
          ? {
              ...common,
              role: 'player' as const,
              playerPrincipal: session.userId,
            }
          : {
              ...common,
              role: 'display' as const,
              displayGeneration: resolution.displayGeneration as number,
            },
        secret
      );
      // PR04 P6: the companion fog appearance is the RESOLVED scene's
      // projection (scene-keyed side channel), never the source map's.
      const fog = await readFogAppearance(redis, code, resolution.sceneId);
      return NextResponse.json({
        token,
        authority: 1,
        room: resolution.room,
        roomGeneration: resolution.roomGeneration,
        sceneId: resolution.sceneId,
        fogAppearance: fog.fogAppearance,
        fogAppearanceUpdatedAt: fog.updatedAt,
      });
    }

    if (tableV1) {
      if (!body.sceneId) {
        return NextResponse.json(
          { error: 'sceneId is required' },
          { status: 400 }
        );
      }
      const rawRedis = getRawRedis();
      const [registryValue, controlValue] = await Promise.all([
        rawRedis.hget(tableRegistryKey(code), body.sceneId),
        rawRedis.get(tableControlKey(code)),
      ]);
      const registry = decodeRecord(registryValue);
      const control = decodeRecord(controlValue);
      const room = registry?.roomId;
      if (
        registry?.v !== 1 ||
        registry.sceneId !== body.sceneId ||
        registry.sourceMapId !== battleMapId ||
        registry.deleted === true ||
        typeof room !== 'string' ||
        control?.v !== 1 ||
        typeof control.epoch !== 'string'
      ) {
        return NextResponse.json(
          { error: 'Scene is unavailable' },
          { status: 409 }
        );
      }
      let roomKeys: ReturnType<typeof tableAuthorityRoomKeys>;
      try {
        roomKeys = tableAuthorityRoomKeys(code, room);
      } catch {
        return NextResponse.json(
          { error: 'Scene is unavailable' },
          { status: 409 }
        );
      }
      const meta = decodeRecord(await rawRedis.get(roomKeys.meta));
      if (meta?.v !== 1 || typeof meta.generation !== 'string') {
        return NextResponse.json(
          { error: 'Scene authority is not initialized' },
          { status: 409 }
        );
      }
      const presentation = decodeRecord(control.presentation);
      if (session.role === 'dm') {
        if (
          typeof control.writerFence !== 'number' ||
          typeof control.leaseUntil !== 'number' ||
          control.leaseUntil <= Date.now() ||
          control.holderPrincipal !== session.authorityPrincipal
        )
          return NextResponse.json(
            { error: 'Live control is required' },
            { status: 403 }
          );
      } else if (
        !presentation ||
        presentation.sceneId !== body.sceneId ||
        presentation.blanked === true
      ) {
        return NextResponse.json(
          { error: 'Scene is not presented' },
          { status: 403 }
        );
      }
      if (
        session.role === 'display' &&
        typeof control.displayGeneration !== 'number'
      ) {
        return NextResponse.json(
          { error: 'Display authority is unavailable' },
          { status: 403 }
        );
      }
      if (!(await proveRelayAuthority(code))) {
        return NextResponse.json(
          { error: 'Live authority is unavailable' },
          { status: 503 }
        );
      }
      const common = {
        v: 1 as const,
        userId: session.userId,
        role: session.role,
        room,
        exp: Date.now() + TOKEN_TTL_MS,
        campaign: code,
        resourceKind: 'scene' as const,
        sceneId: body.sceneId,
        epoch: control.epoch,
        roomGeneration: meta.generation,
      };
      const payload =
        session.role === 'dm'
          ? {
              ...common,
              role: 'dm' as const,
              writerFence: control.writerFence as number,
            }
          : session.role === 'player'
            ? {
                ...common,
                role: 'player' as const,
                playerPrincipal: session.userId,
              }
            : {
                ...common,
                role: 'display' as const,
                displayGeneration: control.displayGeneration as number,
              };
      const token = signBattleMapToken(payload, secret);
      return NextResponse.json({
        token,
        authority: 1,
        room,
        roomGeneration: meta.generation,
        sceneId: body.sceneId,
        fogAppearance: 'solid',
        fogAppearanceUpdatedAt: null,
      });
    }

    const room = legacyRoom!;

    // Best-effort: record that this campaign/battle-map pair has a live
    // client, so a later poke can fan out to every live room instead of
    // only the campaign's activeBattleMapId. Runs only after authorization
    // succeeds — an unauthorized caller must never write into the registry.
    // recordLiveMapRoom swallows its own errors, so awaiting it here cannot
    // fail the mint; it's awaited only for deterministic ordering in tests.
    await recordLiveMapRoom(redis, code, battleMapId, {
      kind: resolvedLegacyKind,
    });

    const token = signBattleMapToken(
      {
        userId: session.userId,
        role: session.role,
        room,
        exp: Date.now() + TOKEN_TTL_MS,
      },
      secret
    );

    const fog = await readFogAppearance(redis, code, battleMapId);
    return NextResponse.json({
      token,
      fogAppearance: fog.fogAppearance,
      fogAppearanceUpdatedAt: fog.updatedAt,
    });
  } catch (error) {
    console.error('Error minting battle map token:', error);
    return NextResponse.json(
      { error: 'Failed to mint token' },
      { status: 500 }
    );
  }
}
