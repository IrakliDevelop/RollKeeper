import { NextRequest, NextResponse } from 'next/server';

import { verifyDmAuthority } from '@/lib/dmAuth';
import { rejectHybridGuestPrivilegeEscalation } from '@/lib/guestRouteResponses';
import { campaignShopSalesKey, getRawRedis, getRedis } from '@/lib/redis';
import { parseStoredShopSales } from '@/lib/shopPurchases';

/**
 * DM reads a merchant NPC's un-drained sales log (VTT merchants Slice 3,
 * Task 12) — the source `useDmShopSalesSync` polls to credit `npc.currency`
 * and decrement matching `NPCInventoryItem.quantity` client-side.
 *
 * DM-only, unlike this NPC's sibling `../route.ts` GET (any campaign member
 * may window-shop the public projection): a sale row carries `playerId` and
 * `copper`, neither of which is public-shop data, so this mirrors the PUT
 * publish route's `rejectHybridGuestPrivilegeEscalation` gate rather than
 * `shared:read`. `dmId` travels as a query param (this is a GET, so there is
 * no body) — the same shape `shared/route.ts`'s GET already uses for
 * `playerId`.
 *
 * Deliberately read-only: nothing here deletes or trims the stored log.
 * `PURCHASE_SCRIPT` (`shopPurchases.ts`) already caps it at
 * `MAX_SALES_LOG_ENTRIES` (500) FIFO on every purchase, and that file's own
 * comment on the append step already accepts this as the traded-off ceiling
 * — "Task 12's drain-on-reconnect should poll often enough that this is
 * generous headroom, not a real ceiling" — rather than asking this route to
 * own trimming. `useDmShopSalesSync`'s idempotency ledger (keyed by
 * `ShopSale.id`, persisted on `npcStore`) is what keeps re-reading the same
 * window on every poll safe: every sale still in the log gets re-fetched
 * every time, but only a NEW one is ever applied.
 *
 * `getRawRedis()` (not `getRedis()`) is required here for the same reason
 * `../route.ts` reads the ledger key with it: `PURCHASE_SCRIPT` persists the
 * sales log via `redis.call('SET', KEYS[3], cjson.encode(sales), ...)`, so
 * `parseStoredShopSales` needs the literal JSON string back, not an
 * already-auto-deserialized object.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; npcId: string }> }
) {
  const guestDenied = rejectHybridGuestPrivilegeEscalation(request);
  if (guestDenied) return guestDenied;

  const { code, npcId } = await params;
  try {
    const dmId = request.nextUrl.searchParams.get('dmId');
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

    const salesRaw = await getRawRedis().get<string>(
      campaignShopSalesKey(code, npcId)
    );
    const sales = parseStoredShopSales(salesRaw);

    return NextResponse.json({ sales });
  } catch (error) {
    console.error('Failed to fetch shop sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop sales' },
      { status: 500 }
    );
  }
}
