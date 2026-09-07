import { NextRequest, NextResponse } from 'next/server';

import { guestDeniedResponse } from '@/lib/guestRouteResponses';
import { campaignShopKey, campaignShopsIndexKey, getRedis } from '@/lib/redis';
import { sanitizePublicShop } from '@/lib/shopProjection';
import { authorizeHybridGuestRoute } from '@/lib/supabase/guestSessionServer';
import type { PublicShopIndexEntry } from '@/types/shop';

/**
 * Player (or guest) reads the campaign's INDEX of currently-open shops
 * (VTT merchants Slice 3, Task 11 — controller ruling R16, replacing the
 * rejected token-stamp approach). This is how a player's token tap resolves
 * a tapped `entityId` to an `npcId` without the token itself ever carrying
 * that mapping: no DM-side stamping step, no staleness when a DM moves or
 * replaces a token, and exactly one fact (the server's own open-shops
 * record) instead of two that must independently agree.
 *
 * Deliberately minimal per entry (`npcId`, `merchantName`, `entityIds` —
 * see `PublicShopIndexEntry`): this is a LOOKUP, not an authority, and
 * never carries items/stock. The caller MUST still confirm a match against
 * that specific shop's own live projection
 * (`GET /api/campaign/[code]/shops/[npcId]`) before treating it as open —
 * this route's data can be momentarily stale (a shop closed or a ledger TTL
 * expired between publish and this read) and must never gate anything on
 * its own.
 *
 * `campaignShopsIndexKey` is a SET of npcIds, maintained by the publish
 * `PUT` (`sadd` on open, `srem` on close) with its own sliding TTL — never
 * part of `refreshCampaignTTL`, matching every other shop key. A member
 * whose own `campaignShopKey` no longer resolves to a valid `PublicShop`
 * (expired independently, or corrupted) is dropped from the RESPONSE and
 * lazily `srem`'d from the index itself (best-effort, never blocking the
 * response) — the same self-healing-by-omission the singular shop `GET`
 * already applies to a missing ledger.
 *
 * Auth: same `'shared:read'` guest scope the singular shop `GET` already
 * uses — this is equally non-player-scoped public campaign state (any
 * campaign member may window-shop), so there is no
 * `requireGuestPlayerBinding` check here either.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  try {
    const guest = await authorizeHybridGuestRoute(request, code, 'shared:read');
    if (guest.mode === 'denied') return guestDeniedResponse(guest);

    const redis = getRedis();
    const indexKey = campaignShopsIndexKey(code);
    const npcIds = await redis.smembers(indexKey);

    if (npcIds.length === 0) {
      return NextResponse.json({ shops: [] });
    }

    const pipeline = redis.pipeline();
    for (const npcId of npcIds) {
      pipeline.get(campaignShopKey(code, npcId));
    }
    const results = await pipeline.exec();

    const shops: PublicShopIndexEntry[] = [];
    const staleNpcIds: string[] = [];

    npcIds.forEach((npcId, i) => {
      const raw = results[i];
      // Wrapped locally (Slice 3 final review, Minor finding): one corrupt
      // projection must drop only ITS OWN entry from the index, never crash
      // the whole listing — the sibling purchase route
      // (`shops/[npcId]/purchases/route.ts`) already wraps the identical
      // parse for the identical reason.
      let shop: ReturnType<typeof sanitizePublicShop> = null;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        shop = parsed ? sanitizePublicShop(parsed) : null;
      } catch {
        shop = null;
      }
      if (!shop) {
        staleNpcIds.push(npcId);
        return;
      }
      shops.push({
        npcId: shop.npcId,
        merchantName: shop.merchantName,
        entityIds: shop.entityIds,
      });
    });

    if (staleNpcIds.length > 0) {
      // Best-effort cleanup — never awaited into the response path, and a
      // failure here can never turn a good response into an error.
      void redis.srem(indexKey, ...staleNpcIds).catch(() => {});
    }

    return NextResponse.json({ shops });
  } catch (error) {
    console.error('Failed to list shops:', error);
    return NextResponse.json(
      { error: 'Failed to list shops' },
      { status: 500 }
    );
  }
}
