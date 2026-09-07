import { NextRequest, NextResponse } from 'next/server';

import { verifyDmAuthority } from '@/lib/dmAuth';
import { rejectHybridGuestPrivilegeEscalation } from '@/lib/guestRouteResponses';
import {
  campaignShopSalesKey,
  getRawRedis,
  getRedis,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import {
  MAX_SALES_LOG_ENTRIES,
  parseStoredShopSales,
} from '@/lib/shopPurchases';

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
 * This GET handler is deliberately read-only: nothing here deletes or trims
 * the stored log. `PURCHASE_SCRIPT` (`shopPurchases.ts`) caps it at
 * `MAX_SALES_LOG_ENTRIES` (500) FIFO on every purchase — a real ceiling, not
 * just headroom, since nothing acknowledged applied sales until the `DELETE`
 * handler below was added (Task 12a: a merchant popular enough to rack up
 * 500+ un-reconciled sales while the DM was away used to lose the oldest
 * ones silently, before the drain ever saw them). `useDmShopSalesSync`'s
 * idempotency ledger (keyed by `ShopSale.id`, persisted on `npcStore`) is
 * what keeps re-reading the same window on every poll safe: every sale
 * still in the log gets re-fetched every time, but only a NEW one is ever
 * applied — and `DELETE` below is what keeps that window small in normal
 * operation instead of relying on the 500-entry cap never being reached.
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

/**
 * DM acknowledges (removes) sales `useDmShopSalesSync` has already applied
 * to `npc.currency`/`NPCInventoryItem.quantity` and recorded in its
 * `appliedShopSaleIds` ledger (Task 12a — closes the hole Task 12 left
 * open: nothing ever trimmed the log before this, so `PURCHASE_SCRIPT`'s
 * 500-entry FIFO cap in `shopPurchases.ts` was a real ceiling a popular
 * merchant could hit while the DM was away, silently and irreversibly
 * losing the oldest un-drained sales server-side).
 *
 * Modelled directly on `shared/route.ts`'s `DELETE type: 'transfers'`
 * batch-ack branch — same shape, same reason: `saleIds` is always
 * acknowledged as ONE batch, never one `DELETE` per id. This does a
 * non-atomic read-filter-write; N concurrent single-id calls would each
 * write "log minus MY id" against the same starting snapshot, and the last
 * writer's result would silently resurrect every other call's id (the
 * exact double-charge-shaped bug that batch ack's own doc comment
 * describes for transfers — here it would resurrect a sale that already
 * happened, not double-charge one, but the log would never shrink).
 *
 * An empty `saleIds` array is explicitly a no-op, not "clear the log" —
 * `useDmShopSalesSync` never intends to send one (it only calls this with
 * ids it just applied or previously applied-but-unacked), but the batch
 * transfer route's own empty-array special case ("no ids -> delete
 * everything") is exactly the footgun a `DELETE` route on an
 * apply-then-acknowledge queue must not repeat: an empty array here must
 * never be able to drop sales the caller never actually applied.
 *
 * Auth mirrors `GET` above exactly (`rejectHybridGuestPrivilegeEscalation`
 * then `verifyDmAuthority`) — a sale row is DM-only data, and dropping rows
 * from the log is at least as sensitive as reading them. `dmId` travels in
 * the body here (unlike `GET`'s query param) because a `DELETE` request, in
 * this codebase, is not restricted to a body-less shape — `shared/route.ts`'s
 * `DELETE` already reads `playerId`/`type`/ids from the body the same way.
 *
 * `getRawRedis()` for both the read AND the write: the read must return the
 * literal JSON string `PURCHASE_SCRIPT`'s `cjson.encode` persisted (same
 * reason as `GET`, above), and the write re-persists that same key in the
 * same Lua-owned representation — using the auto-deserializing default
 * client for just the write would leave the key's read/write path split
 * across two clients for no reason, and every other write to a `cjson`-owned
 * key in this codebase (`SHOP_SEED_SCRIPT`, `PURCHASE_SCRIPT` themselves)
 * goes through the raw client's `EVAL`, never the default client's `set`.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; npcId: string }> }
) {
  const guestDenied = rejectHybridGuestPrivilegeEscalation(request);
  if (guestDenied) return guestDenied;

  const { code, npcId } = await params;
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!body || typeof body.dmId !== 'string') {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }

    const redis = getRedis();
    const dmAuth = await verifyDmAuthority(redis, code, body.dmId);
    if (dmAuth !== 'ok') {
      return NextResponse.json(
        { error: 'dmId is not authorized for this campaign' },
        { status: 403 }
      );
    }

    const saleIds = body.saleIds;
    if (
      !Array.isArray(saleIds) ||
      saleIds.length > MAX_SALES_LOG_ENTRIES ||
      !saleIds.every(id => typeof id === 'string')
    ) {
      return NextResponse.json(
        { error: 'saleIds must be an array of strings' },
        { status: 400 }
      );
    }

    // An empty batch acknowledges nothing — never treated as "clear the
    // log" (see doc comment above). Short-circuits before the read so an
    // empty ack (which the client never intends to send) can't even race
    // a concurrent purchase's append.
    if (saleIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    const key = campaignShopSalesKey(code, npcId);
    const rawRedis = getRawRedis();
    const salesRaw = await rawRedis.get<string>(key);
    const sales = parseStoredShopSales(salesRaw);
    const idSet = new Set(saleIds);
    const filtered = sales.filter(sale => !idSet.has(sale.id));

    if (filtered.length !== sales.length) {
      if (filtered.length === 0) {
        await rawRedis.del(key);
      } else {
        await rawRedis.set(key, JSON.stringify(filtered), {
          ex: SLIDING_TTL_SECONDS,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to acknowledge shop sales:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge shop sales' },
      { status: 500 }
    );
  }
}
