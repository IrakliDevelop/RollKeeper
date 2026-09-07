import { NextRequest, NextResponse } from 'next/server';

import { verifyDmAuthority } from '@/lib/dmAuth';
import { rejectHybridGuestPrivilegeEscalation } from '@/lib/guestRouteResponses';
import {
  campaignShopKey,
  campaignShopLedgerKey,
  getRedis,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import {
  applyCanonicalShopRemaining,
  buildPublicShop,
  buildShopLedger,
} from '@/lib/shopProjection';
import { seedShopLedger } from '@/lib/shopPurchases';
import type { CampaignNPC } from '@/types/encounter';

/** Generous but bounded — a shop realistically maps to a handful of tokens.
 *  Matches `MAX_ENTITY_IDS` in shopProjection.ts's `sanitizePublicShop`. */
const MAX_ENTITY_IDS = 50;

/**
 * DM publishes (or unpublishes) a merchant NPC's shop (VTT merchants Slice 3,
 * Task 5). The DM's client is the only place that knows both `CampaignNPC`
 * (npcStore, client-only) and the current encounter's entities
 * (encounterStore, client-only), so it sends the full `npc` plus the
 * `entityIds` it resolved from encounter entities whose `npcSourceId`
 * matches this NPC — that resolution is what lets a player's later token tap
 * find the shop without the shop payload ever naming NPC internals.
 *
 * `npc.shop.open !== true` deletes the projection and ledger keys outright
 * (unpublish). Otherwise this builds the public projection and a fresh
 * ledger seed from the trusted `npc` object (never a client-supplied
 * projection — the explicit-field-pick security boundary lives in
 * `buildPublicShop`/`buildShopLedger`, not here), seeds the ledger through
 * `SHOP_SEED_SCRIPT` (which validates the seed BEFORE writing — see
 * `seedShopLedger`), and only then writes the public projection, overlaid
 * with the ledger's canonical post-sales `remainingQuantity` so a republish
 * never shows players stale pre-sale stock counts.
 *
 * Both keys get their OWN `{ ex: SLIDING_TTL_SECONDS }` on write — shop keys
 * are deliberately NOT part of `refreshCampaignTTL` (Task 1).
 */
export async function PUT(
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

    const npc = body.npc;
    if (
      !npc ||
      typeof npc !== 'object' ||
      (npc as { id?: unknown }).id !== npcId
    ) {
      return NextResponse.json(
        { error: 'npc is required and must match npcId' },
        { status: 400 }
      );
    }

    const entityIds = body.entityIds;
    if (
      !Array.isArray(entityIds) ||
      entityIds.length > MAX_ENTITY_IDS ||
      !entityIds.every(id => typeof id === 'string')
    ) {
      return NextResponse.json(
        { error: 'entityIds must be an array of strings' },
        { status: 400 }
      );
    }

    const redis = getRedis();
    const dmAuth = await verifyDmAuthority(redis, code, body.dmId);
    if (dmAuth !== 'ok') {
      return NextResponse.json(
        { error: 'dmId is not authorized for this campaign' },
        { status: 403 }
      );
    }

    const shopKey = campaignShopKey(code, npcId);
    const ledgerKey = campaignShopLedgerKey(code, npcId);
    const typedNpc = npc as CampaignNPC;

    // Unpublish: shop absent or explicitly closed deletes both keys. This is
    // the read for `buildPublicShop`'s own null case, checked here first so
    // a closed shop never even attempts a ledger seed.
    if (typedNpc.shop?.open !== true) {
      await Promise.all([redis.del(shopKey), redis.del(ledgerKey)]);
      return NextResponse.json({ success: true, shop: null });
    }

    const publicShop = buildPublicShop(typedNpc, entityIds);
    // Unreachable given the open check above, but keeps this branch honest
    // about buildPublicShop's actual contract rather than asserting past it.
    if (!publicShop) {
      await Promise.all([redis.del(shopKey), redis.del(ledgerKey)]);
      return NextResponse.json({ success: true, shop: null });
    }

    const seed = buildShopLedger(typedNpc);

    let ledger;
    try {
      // Validates the seed BEFORE writing anything (Task 3 review, Critical):
      // an out-of-bounds row is rejected here, before either key is touched.
      ledger = await seedShopLedger(
        redis,
        ledgerKey,
        seed,
        SLIDING_TTL_SECONDS
      );
    } catch {
      return NextResponse.json(
        { error: 'Invalid shop ledger' },
        { status: 400 }
      );
    }

    const merged = applyCanonicalShopRemaining(publicShop, ledger);
    await redis.set(shopKey, JSON.stringify(merged), {
      ex: SLIDING_TTL_SECONDS,
    });

    return NextResponse.json({ success: true, shop: merged });
  } catch (error) {
    console.error('Failed to publish shop:', error);
    return NextResponse.json(
      { error: 'Failed to publish shop' },
      { status: 500 }
    );
  }
}
