import { NextRequest, NextResponse } from 'next/server';

import { verifyDmAuthority } from '@/lib/dmAuth';
import {
  guestDeniedResponse,
  rejectHybridGuestPrivilegeEscalation,
} from '@/lib/guestRouteResponses';
import {
  campaignShopKey,
  campaignShopLedgerKey,
  getRawRedis,
  getRedis,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import {
  applyCanonicalShopRemaining,
  buildPublicShop,
  buildShopLedger,
  overlayLiveShopStock,
  sanitizePublicShop,
} from '@/lib/shopProjection';
import {
  INVALID_SHOP_LEDGER_SEED_ERROR,
  parseStoredShopLedger,
  seedShopLedger,
  SHOP_LEDGER_SEED_TOO_LARGE_ERROR,
} from '@/lib/shopPurchases';
import { authorizeHybridGuestRoute } from '@/lib/supabase/guestSessionServer';
import type { CampaignNPC } from '@/types/encounter';

/** Generous but bounded — a shop realistically maps to a handful of tokens.
 *  Matches `MAX_ENTITY_IDS` in shopProjection.ts's `sanitizePublicShop`. */
const MAX_ENTITY_IDS = 50;

/**
 * Player (or guest) reads a merchant NPC's published shop (VTT merchants
 * Slice 3, Task 5a — the gap the numbered plan missed: `PUT` above has
 * existed since Task 5, but nothing ever read it back for a player).
 *
 * `campaignShopKey` is written ONCE, at publish time. `PURCHASE_SCRIPT`
 * (shopPurchases.ts) decrements `campaignShopLedgerKey` on every sale and
 * NEVER touches the projection, so serving the projection alone would show
 * a player pre-sale stock. This overlays the ledger's live
 * `remainingQuantity` onto the projection (controller ruling R10) via
 * `overlayLiveShopStock`, which also enforces the drop rules: a projection
 * row absent from the ledger is removed (never shown with stale stock), and
 * the ledger is never a source of ROWS (only of counts) — see that
 * function's doc comment for why, and for why this can never spread or
 * return a ledger entry (a `ShopLedgerEntry` carries the full `item`
 * `PublicShopItem.item: never` exists to keep off the wire).
 *
 * A missing ledger (shop closed, or its independent TTL expired — shop keys
 * are deliberately NOT part of `refreshCampaignTTL`, see Task 1) is treated
 * as no shop at all, exactly like a missing projection: there is nothing
 * live to overlay, so nothing is safe to serve.
 *
 * Client choice per read (do not swap these — see `seedShopLedger`'s doc
 * comment in shopPurchases.ts for the exact failure mode of getting this
 * wrong): the projection was written via the DEFAULT client
 * (`redis.set(shopKey, JSON.stringify(merged), ...)` in `PUT` below), so
 * it's read back via `getRedis()` too, with the same defensive
 * string-or-object handling `shared/route.ts` uses for every
 * `JSON.stringify`-then-`redis.set` value in this codebase.
 * `sanitizePublicShop` re-validates it as the read-side boundary for a
 * stored/cached payload. The ledger, in contrast, is only ever consumed via
 * `parseStoredShopLedger(raw: string | null)`, which needs the LITERAL JSON
 * string `SHOP_SEED_SCRIPT`/`PURCHASE_SCRIPT` persist — so it must come from
 * `getRawRedis()` (`automaticDeserialization: false`); the default client
 * would auto-parse that string into an object first, and `parseStoredShopLedger`
 * would then hand `JSON.parse` an object instead of a string.
 *
 * Auth: no DM/player distinction here (any campaign member may window-shop),
 * and unlike a player's own private data (`players/[playerId]/route.ts`)
 * this response isn't scoped to one player, so there is no
 * `requireGuestPlayerBinding` check — mirroring the same shape at
 * `battlemaps/[id]/markers/route.ts`'s `GET`, which reads a public
 * projection overlaid with a live ledger under the same `'shared:read'`
 * scope. No new guest scope was added for Slice 3 (`shared:read` already
 * covers "read this campaign's public state" and the guest invitation
 * scope list in the DB migration is at its 11-scope cap).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; npcId: string }> }
) {
  const { code, npcId } = await params;
  try {
    const guest = await authorizeHybridGuestRoute(request, code, 'shared:read');
    if (guest.mode === 'denied') return guestDeniedResponse(guest);

    const shopKey = campaignShopKey(code, npcId);
    const ledgerKey = campaignShopLedgerKey(code, npcId);

    const [projectionRaw, ledgerRaw] = await Promise.all([
      getRedis().get<unknown>(shopKey),
      getRawRedis().get<string>(ledgerKey),
    ]);

    // No ledger at all (unpublished, or its own TTL expired) means there is
    // nothing live to overlay onto the projection — treated as no shop,
    // never as "serve the stale projection alone".
    if (!ledgerRaw) {
      return NextResponse.json({ shop: null });
    }

    const projectionParsed =
      typeof projectionRaw === 'string'
        ? JSON.parse(projectionRaw)
        : projectionRaw;
    const projection = sanitizePublicShop(projectionParsed);
    if (!projection) {
      return NextResponse.json({ shop: null });
    }

    const ledger = parseStoredShopLedger(ledgerRaw);
    const shop = overlayLiveShopStock(projection, ledger);

    return NextResponse.json({ shop });
  } catch (error) {
    console.error('Failed to fetch shop:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop' },
      { status: 500 }
    );
  }
}

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

    // buildPublicShop returns null only when `shop?.open !== true`, which
    // the branch above already handled — `typedNpc.shop.open === true` here
    // is therefore guaranteed non-null.
    const publicShop = buildPublicShop(typedNpc, entityIds)!;

    const seed = buildShopLedger(typedNpc);

    let ledger;
    try {
      // Validates the seed BEFORE writing anything (Task 3 review, Critical):
      // an out-of-bounds row is rejected here, before either key is touched.
      // `getRawRedis()` — NOT `redis` (`getRedis()`) — is required here:
      // `seedShopLedger` needs the literal JSON string EVAL returns
      // (`parseStoredShopLedger(String(raw))`), and the auto-deserializing
      // default client would JSON-parse it into an object array first,
      // making `String(...)` produce `"[object Object]"` instead. See
      // `seedShopLedger`'s doc comment in shopPurchases.ts.
      ledger = await seedShopLedger(
        getRawRedis(),
        ledgerKey,
        seed,
        SLIDING_TTL_SECONDS
      );
    } catch (error) {
      // Only a validation failure from seedShopLedger itself is a 400 — a
      // Redis outage, a serialization bug, or anything else unexpected must
      // fall through to the outer catch's 500, not be reported as "your
      // shop data is invalid".
      if (
        error instanceof Error &&
        (error.message === INVALID_SHOP_LEDGER_SEED_ERROR ||
          error.message === SHOP_LEDGER_SEED_TOO_LARGE_ERROR)
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
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
