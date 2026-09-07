import { NextRequest, NextResponse } from 'next/server';

import {
  guestDeniedResponse,
  requireGuestPlayerBinding,
} from '@/lib/guestRouteResponses';
import {
  campaignPlayersKey,
  campaignShopKey,
  campaignShopLedgerKey,
  campaignShopReceiptKey,
  campaignShopSalesKey,
  campaignTransfersKey,
  getRawRedis,
  getRedis,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { sendBattleMapPokeToLiveRooms } from '@/lib/relayPoke';
import { sanitizePublicShop } from '@/lib/shopProjection';
import { purchaseFromShop } from '@/lib/shopPurchases';
import { authorizeHybridGuestRoute } from '@/lib/supabase/guestSessionServer';

const MAX_QUANTITY = 999;
const MAX_ID_LENGTH = 200;

/** Stamped onto an enqueued transfer's `fromCharacterName` when the public
 *  projection can't be read back (missing/expired/corrupt) — mirrors the
 *  `fromPlayerName: 'Shop'` constant `PURCHASE_SCRIPT` itself writes, so a
 *  purchase is never blocked on this cosmetic field. `purchaseFromShop`
 *  still resolves 'shop-closed' on its own if the LEDGER (the actual
 *  source of truth for "is this shop open") is missing — this fallback
 *  only covers the narrow case where the two independently-TTL'd keys
 *  (Task 1) have drifted out of sync.
 */
const FALLBACK_MERCHANT_NAME = 'Shop';

function isValidId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

/**
 * Player (or hybrid guest) purchases an item from a merchant NPC's published
 * shop (VTT merchants Slice 3, Task 6) — the money path. All the real work
 * (guard order, server-side pricing, the magic-item fan-out clamp, the
 * idempotent receipt) lives in `PURCHASE_SCRIPT`/`purchaseFromShop`
 * (`shopPurchases.ts`); this route is auth, request validation, status
 * mapping, and a best-effort poke.
 *
 * Defects found and fixed elsewhere in this slice that apply here verbatim:
 *
 * 1. `purchaseFromShop` must receive `getRawRedis()` (`automaticDeserialization:
 *    false`), never the default `getRedis()` — identical to the
 *    `seedShopLedger`/`PUT` hazard this file's sibling `route.ts` documents
 *    at length: the EVAL reply is the literal JSON string
 *    `PURCHASE_SCRIPT` returns, and `purchaseFromShop` calls
 *    `JSON.parse(String(raw))` on it directly. The default client would
 *    auto-parse it into an object first, `String(...)` would produce
 *    `"[object Object]"`, and the parse would fail — AFTER the Lua already
 *    committed the sale.
 * 2. The receipt key (`campaignShopReceiptKey(code, npcId, requestId)`) is
 *    NOT player-scoped, so a second player replaying another player's
 *    `requestId` gets `ok: true` back with the FIRST player's
 *    `entryId`/`playerId`/`costCopper` echoed (nothing is granted or
 *    charged to the replayer — no transfer reaches their queue — so this is
 *    an information leak, not a double-spend). `ok: true` is therefore
 *    never trusted alone: both `receipt.playerId` AND `receipt.entryId`
 *    must match what the caller actually asked for before anything is
 *    echoed back — a client reusing a `requestId` across two different
 *    items must not silently get the old item's receipt back either.
 * 3. A non-finite/non-integer `quantity` must be rejected here, before it
 *    reaches the Lua. `PURCHASE_SCRIPT`'s `tonumber(ARGV[4]) or 1` plus its
 *    `< 1`/`math.floor` guards let a `NaN` slip through (every comparison
 *    against `NaN` is false), and `cjson` then refuses to encode the
 *    result, aborting the whole EVAL atomically — nothing is corrupted, but
 *    the failure is opaque. Validated the same way marker loot's claim
 *    route validates its own `quantity` (integer, 1-999).
 * 4. **Campaign membership.** `authorizedPlayerId` is either the client's
 *    OWN asserted `playerId` (legacy mode — `SUPABASE_HYBRID_GUEST_ENABLED
 *    !== 'true'`, which resolves every request to `{ mode: 'legacy' }`
 *    unconditionally) or a guest's bound id — neither is proof the id names
 *    an actual member of THIS campaign. Campaign codes are party-shared,
 *    not secret, so without this check anyone holding `code` + `npcId`
 *    could POST an arbitrary `playerId`, decrement stock, write sale-log
 *    rows, and enqueue `costCopper`-carrying transfers against a victim who
 *    took no action at all. Mirrors
 *    `battlemaps/[id]/markers/route.ts`'s POST exactly (the only other
 *    `sismember` check in `src/app/api/campaign/`, guarding the identical
 *    shape of "client names the player whose queue gets written").
 *
 * The last requirement is structural rather than a guard: the request
 * body's `quantity`/`requestId` are the only fields that matter. Nothing
 * else the client asserts (a `costCopper` in the body, say) is ever read —
 * `purchaseFromShop`'s input has no cost field at all, so there is nothing
 * for a forged one to influence.
 *
 * **`requestId` stability contract (binding on any caller, including the
 * player dialog task):** `PURCHASE_SCRIPT`'s receipt-first guard makes a
 * lost reply fully recoverable, but ONLY if the retry reuses the exact same
 * `requestId`. If the EVAL commits (stock decremented, transfer enqueued,
 * receipt written) but the HTTP reply never reaches the client — a timeout,
 * a connection reset — this route throws and returns 500 while the sale has
 * already happened. A caller that mints a fresh `requestId` per attempt
 * turns that lost reply into a genuine double purchase (two decrements, two
 * sale rows, two transfers); a caller that retries with the SAME
 * `requestId` gets the original receipt back idempotently, exactly as
 * designed. The reverse failure (charged with nothing committed) cannot
 * happen: the debit rides a transfer that only exists once the Lua has
 * actually committed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; npcId: string }> }
) {
  const { code, npcId } = await params;
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (
      !body ||
      !['playerId', 'entryId', 'requestId'].every(key => isValidId(body[key]))
    ) {
      return NextResponse.json(
        { error: 'Invalid purchase request' },
        { status: 400 }
      );
    }

    // Defect 3: reject a non-finite/non-integer/out-of-range quantity here,
    // before it ever reaches PURCHASE_SCRIPT. `Number.isInteger` is false
    // for NaN, +/-Infinity, and any fractional value, so this single check
    // covers "non-finite" and "non-integer" together. Matches
    // battlemaps/[id]/markers/route.ts's claim quantity validation (1-999,
    // missing defaults to 1).
    const quantity = body.quantity === undefined ? 1 : body.quantity;
    if (
      !Number.isInteger(quantity) ||
      (quantity as number) < 1 ||
      (quantity as number) > MAX_QUANTITY
    ) {
      return NextResponse.json(
        { error: 'Invalid purchase quantity' },
        { status: 400 }
      );
    }

    const playerId = body.playerId as string;
    // Auth pairing per the brief — identical shape to shared/route.ts's
    // DELETE (line ~557) and battlemaps/[id]/markers/route.ts's POST: a
    // hybrid guest must be bound to the exact playerId it asserts. No new
    // guest scope exists for shop purchases (the campaign_guest_invitations
    // migration's allowlist is already at its 11-entry cap — see
    // task-5a-report.md's identical judgment call for the shop GET route).
    // 'marker:claim' is the closest existing scope in spirit — a guest
    // consuming a shared, DM-authored resource and receiving a transfer —
    // flagged here for the controller in case a dedicated `shop:purchase`
    // scope is wanted later.
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
    const rawRedis = getRawRedis();

    // Defect 4 (Critical): `authorizedPlayerId` above is only an identity
    // check (does it match a guest's binding, if any) — it is never proof
    // the id names an actual member of THIS campaign. Campaign codes are
    // party-shared, not secret, so without this a caller could name any
    // player, decrement someone else's shop stock, and enqueue a
    // debit-carrying transfer into an arbitrary player's queue. Mirrors
    // `battlemaps/[id]/markers/route.ts`'s POST exactly.
    if (
      !(await redis.sismember(campaignPlayersKey(code), authorizedPlayerId))
    ) {
      return NextResponse.json(
        { error: 'Player is not a member of this campaign' },
        { status: 403 }
      );
    }

    // merchantName lives only on the PUBLIC projection (PublicShop.merchantName
    // — a ShopLedgerEntry has no such field, only per-item `name`), so it must
    // be read back here to stamp onto the enqueued transfer's
    // `fromCharacterName`. Read via the DEFAULT client, exactly like this
    // file's sibling GET (`../route.ts`) reads the same key — `PUT` writes it
    // via `redis.set(shopKey, JSON.stringify(merged), ...)` on the default
    // client, so the read side must match. The parse is wrapped locally: a
    // corrupt/non-JSON projection is exactly the "corrupt" case
    // `FALLBACK_MERCHANT_NAME`'s doc comment already claims to cover, and
    // must fall through to that fallback rather than 500ing the whole
    // purchase over a cosmetic display name.
    const projectionRaw = await redis.get<unknown>(
      campaignShopKey(code, npcId)
    );
    let projection: ReturnType<typeof sanitizePublicShop> = null;
    try {
      const projectionParsed =
        typeof projectionRaw === 'string'
          ? JSON.parse(projectionRaw)
          : projectionRaw;
      projection = sanitizePublicShop(projectionParsed);
    } catch {
      projection = null;
    }
    const merchantName = projection?.merchantName ?? FALLBACK_MERCHANT_NAME;

    const entryId = body.entryId as string;
    const requestId = body.requestId as string;

    // Defect 1: purchaseFromShop MUST receive the raw client — see the doc
    // comment above.
    const result = await purchaseFromShop(
      rawRedis,
      {
        ledger: campaignShopLedgerKey(code, npcId),
        transfers: campaignTransfersKey(code, authorizedPlayerId),
        sales: campaignShopSalesKey(code, npcId),
        receipt: campaignShopReceiptKey(code, npcId, requestId),
      },
      {
        npcId,
        entryId,
        playerId: authorizedPlayerId,
        requestId,
        merchantName,
        quantity: quantity as number,
        now: new Date().toISOString(),
      },
      SLIDING_TTL_SECONDS
    );

    if (!result.ok) {
      const status = result.error === 'entry-not-found' ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }

    // Defect 2: the receipt key is not player-scoped, so `ok: true` alone
    // is not proof this purchase belongs to the caller — it could be a
    // replayed `requestId` from a different player's earlier purchase, OR
    // (same key, different intent) this player's own `requestId` reused
    // against a different `entryId`. Either way, the receipt reflects
    // whatever the FIRST call with this `requestId` actually did — reject
    // rather than echo it back as if it matched the current request.
    if (
      result.receipt.playerId !== authorizedPlayerId ||
      result.receipt.entryId !== entryId
    ) {
      return NextResponse.json(
        { error: 'Purchase request does not match this player/item' },
        { status: 403 }
      );
    }

    // Best-effort poke — never allowed to fail the sale. Polling remains
    // the source of truth (Task 7). Wrapped defensively even though
    // `sendBattleMapPokeToLiveRooms` never throws by its own contract, since
    // this is the money path and the sale must not depend on that contract
    // holding forever.
    try {
      await sendBattleMapPokeToLiveRooms(code, redis, 'shop');
    } catch (error) {
      console.warn(
        '[shop purchase] poke failed (poll remains fallback):',
        error
      );
    }

    return NextResponse.json({
      success: true,
      entryId: result.receipt.entryId,
      grantedQuantity: result.receipt.grantedQuantity,
      costCopper: result.receipt.costCopper,
      remainingQuantity: result.receipt.remainingQuantity,
    });
  } catch (error) {
    console.error('Failed to purchase from shop:', error);
    return NextResponse.json(
      { error: 'Failed to purchase from shop' },
      { status: 500 }
    );
  }
}
