import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  getRawRedis,
  campaignBattleMapsKey,
  refreshCampaignTTL,
} from '@/lib/redis';
import type { BattleMapMetadata } from '@/types/battlemap';
import {
  GUEST_SESSION_COOKIE,
  isHybridGuestServerEnabled,
} from '@/lib/guestSessionSecurity';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import { readPresentedTableScene } from '@/lib/tableServer/presentation';
import {
  credentialFromQuery,
  verifyTableCredential,
} from '@/lib/tableServer/presentationAccess';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
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
    const { code } = await params;
    if (isTableProtocolRequired()) {
      // PR04 P6/Q8: the DM keeps the library; an authenticated audience
      // sees at most the presented, unblanked scene's safe metadata.
      const identity = await verifyTableCredential(
        request,
        code,
        credentialFromQuery(request),
        false
      );
      if (!identity.ok) return identity.response;
      if (identity.role !== 'dm') {
        const presented = await readPresentedTableScene({
          rawRedis: getRawRedis(),
          campaign: code,
        });
        if (presented.status === 'error')
          return NextResponse.json(
            { error: 'Live authority is unavailable' },
            { status: 503 }
          );
        return NextResponse.json({
          battlemaps:
            presented.status === 'presented' && presented.sourceMapId
              ? [
                  {
                    id: presented.sceneId,
                    sourceMapId: presented.sourceMapId,
                    name: presented.safeLabel,
                  },
                ]
              : [],
        });
      }
    }
    const redis = getRedis();
    const raw = await redis.get<BattleMapMetadata[]>(
      campaignBattleMapsKey(code)
    );
    await refreshCampaignTTL(redis, code);
    return NextResponse.json({ battlemaps: raw ?? [] });
  } catch (error) {
    console.error('Failed to fetch battle maps:', error);
    return NextResponse.json(
      { error: 'Failed to fetch battle maps' },
      { status: 500 }
    );
  }
}
