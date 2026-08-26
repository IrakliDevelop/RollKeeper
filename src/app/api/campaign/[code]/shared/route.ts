import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  getRawRedis,
  campaignSharedKey,
  campaignMessagesKey,
  campaignEffectsKey,
  campaignTransfersKey,
  campaignPlayersKey,
  campaignXpKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';
import { sendInitiativePoke } from '@/lib/relayPoke';
import {
  enqueueXpAward,
  readXpAwards,
  ackXpAward,
  validateDmXpAward,
} from '@/lib/xpAwardQueue';
import type {
  DmMessage,
  DmEffect,
  DmXpAward,
  DmXpAwardEnvelope,
  SharedCalendar,
  SharedCalendarPlayer,
  SharedCampaignState,
  SharedCustomCounter,
  ItemTransfer,
  SharedInitiativeState,
  SharedBattleMapState,
  InitiativeRollRequest,
} from '@/types/sharedState';
import {
  guestDeniedResponse,
  requireGuestPlayerBinding,
} from '@/lib/guestRouteResponses';
import {
  GUEST_SESSION_COOKIE,
  isHybridGuestServerEnabled,
} from '@/lib/guestSessionSecurity';
import { authorizeHybridGuestRoute } from '@/lib/supabase/guestSessionServer';
import { accountMembershipMatchesLegacyIds } from '@/lib/campaignMembershipAuthority';
import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { authorizeCampaignMembershipRoute } from '@/lib/supabase/campaignMembershipServer';
import { campaignSettingsProjectionWriteAllowed } from '@/lib/supabase/campaignSettingsServer';
import { calendarProjectionWriteAllowed } from '@/lib/supabase/calendarServer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    let role = request.nextUrl.searchParams.get('role') ?? 'player';
    let playerId = request.nextUrl.searchParams.get('playerId');
    const membership = await authorizeCampaignMembershipRoute(code, false);
    if (membership.mode === 'denied') {
      return NextResponse.json(
        { error: 'Account membership is required' },
        { status: membership.status }
      );
    }
    if (membership.mode === 'account') {
      if (membership.principal.role === 'player') {
        if (
          !accountMembershipMatchesLegacyIds(membership.principal, [playerId])
        ) {
          return NextResponse.json(
            { error: 'Private DM document access is denied' },
            { status: 403 }
          );
        }
        role = 'player';
        playerId = playerId ?? membership.principal.legacyPlayerId;
      }
    }
    const guest =
      membership.mode === 'legacy'
        ? await authorizeHybridGuestRoute(request, code, 'shared:read')
        : ({ mode: 'legacy' } as const);
    if (guest.mode === 'denied') return guestDeniedResponse(guest);
    if (guest.mode === 'guest') {
      role = 'player';
      playerId = guest.principal.legacyPlayerId;
    }
    const redis = getRedis();

    const calendarRaw = await redis.get<string>(
      campaignSharedKey(code, 'calendar')
    );
    const initiativeRaw = await redis.get<string>(
      campaignSharedKey(code, 'initiative')
    );
    let initiative: SharedInitiativeState | null = null;
    if (initiativeRaw) {
      initiative =
        typeof initiativeRaw === 'string'
          ? JSON.parse(initiativeRaw)
          : initiativeRaw;
    }

    const battleMapRaw = await redis.get<string>(
      campaignSharedKey(code, 'battlemap')
    );
    let battleMap: SharedBattleMapState | null = null;
    if (battleMapRaw) {
      battleMap =
        typeof battleMapRaw === 'string'
          ? JSON.parse(battleMapRaw)
          : battleMapRaw;
    }

    const settingsRaw = await redis.get<string>(
      campaignSharedKey(code, 'settings')
    );
    let settings: SharedCampaignState['settings'] = null;
    if (settingsRaw) {
      settings =
        typeof settingsRaw === 'string' ? JSON.parse(settingsRaw) : settingsRaw;
    }

    const initiativeRequestRaw = await redis.get<string>(
      campaignSharedKey(code, 'initiativeRequest')
    );
    let initiativeRequest: InitiativeRollRequest | null = null;
    if (initiativeRequestRaw) {
      initiativeRequest =
        typeof initiativeRequestRaw === 'string'
          ? JSON.parse(initiativeRequestRaw)
          : initiativeRequestRaw;
    }

    let calendar: SharedCalendarPlayer | null = null;

    if (calendarRaw) {
      const parsed: SharedCalendar & Partial<SharedCalendarPlayer> =
        typeof calendarRaw === 'string' ? JSON.parse(calendarRaw) : calendarRaw;

      if (parsed.codecVersion === 1) {
        // Postgres-primary values are already produced by the server-side
        // allowlist codec. Never add fields from a private document here.
        calendar = parsed as SharedCalendarPlayer;
      } else if (role === 'dm') {
        calendar = parsed;
      } else {
        // Strip moons for player view
        calendar = {
          ...parsed,
          config: {
            ...parsed.config,
            moons: [],
          },
        };
      }
    }

    // Fetch pending messages, DM effects, and custom counter for this player
    let messages: DmMessage[] = [];
    let dmEffects: DmEffect[] = [];
    let customCounter: SharedCampaignState['customCounter'] = null;
    let transfers: ItemTransfer[] = [];
    let xpAwards: DmXpAwardEnvelope[] = [];

    if (playerId) {
      const [messagesRaw, effectsRaw, countersRaw, transfersRaw] =
        await Promise.all([
          redis.get<string>(campaignMessagesKey(code, playerId)),
          redis.get<string>(campaignEffectsKey(code, playerId)),
          redis.get<string>(campaignSharedKey(code, 'counters')),
          redis.get<string>(campaignTransfersKey(code, playerId)),
        ]);
      if (messagesRaw) {
        messages =
          typeof messagesRaw === 'string'
            ? JSON.parse(messagesRaw)
            : messagesRaw;
      }
      if (effectsRaw) {
        dmEffects =
          typeof effectsRaw === 'string' ? JSON.parse(effectsRaw) : effectsRaw;
      }
      if (countersRaw) {
        const parsed: SharedCustomCounter =
          typeof countersRaw === 'string'
            ? JSON.parse(countersRaw)
            : countersRaw;
        const value = parsed.counters?.[playerId] ?? 0;
        if (parsed.label) {
          customCounter = { label: parsed.label, value };
        }
      }
      if (transfersRaw) {
        transfers =
          typeof transfersRaw === 'string'
            ? JSON.parse(transfersRaw)
            : transfersRaw;
      }

      xpAwards = await readXpAwards(
        getRawRedis(),
        campaignXpKey(code, playerId)
      );
    }

    await refreshCampaignTTL(redis, code);

    const state: SharedCampaignState = {
      calendar,
      messages,
      dmEffects,
      customCounter,
      transfers,
      initiative,
      battleMap,
      initiativeRequest,
      settings,
      xpAwards,
    };
    return NextResponse.json(state);
  } catch (error) {
    console.error('Error fetching shared state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared state' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid or empty request body' },
        { status: 400 }
      );
    }

    const { feature, data, dmId } = body;
    const membership = await authorizeCampaignMembershipRoute(code, true);
    if (membership.mode === 'denied') {
      return NextResponse.json(
        { error: 'Account membership is required' },
        { status: membership.status }
      );
    }
    if (
      membership.mode === 'legacy' &&
      isHybridGuestServerEnabled() &&
      request.cookies.has(GUEST_SESSION_COOKIE)
    ) {
      return NextResponse.json(
        { error: 'Guest sessions cannot publish shared or DM state' },
        { status: 403 }
      );
    }
    if (membership.mode === 'account') {
      const security = validateCampaignMembershipMutation(request);
      if (!security.ok) {
        return NextResponse.json(
          { error: security.error },
          { status: security.status }
        );
      }
      if (
        feature !== 'item_transfer' &&
        membership.principal.role !== 'owner' &&
        membership.principal.role !== 'dm'
      ) {
        return NextResponse.json(
          { error: 'Private DM document mutation is denied' },
          { status: 403 }
        );
      }
    }

    // null is a valid payload ONLY for initiativeRequest (it means "clear the
    // request"); every other feature requires a real object — a null would crash
    // the feature branches that destructure data. undefined is always missing.
    const allowsNullData = feature === 'initiativeRequest';
    if (!feature || data === undefined || (data === null && !allowsNullData)) {
      return NextResponse.json(
        { error: 'feature and data are required' },
        { status: 400 }
      );
    }

    if (feature !== 'item_transfer' && !dmId) {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }

    if (
      (feature === 'settings' || feature === 'counters') &&
      !(await campaignSettingsProjectionWriteAllowed(code))
    ) {
      return NextResponse.json(
        {
          error:
            'Campaign settings compatibility projection is server controlled',
        },
        { status: 409 }
      );
    }
    if (
      feature === 'calendar' &&
      !(await calendarProjectionWriteAllowed(code))
    ) {
      return NextResponse.json(
        { error: 'Calendar compatibility projection is server controlled' },
        { status: 409 }
      );
    }

    const redis = getRedis();

    // Strict DM check — a mismatched dmId must never take over the campaign
    // (it would let anyone mint DM battle-map tokens and see hidden elements).
    if (dmId) {
      const dmAuth = await verifyDmAuthority(redis, code, dmId);
      if (dmAuth !== 'ok') {
        return NextResponse.json(
          { error: 'dmId is not authorized for this campaign' },
          { status: 403 }
        );
      }
    }

    // Route by feature type
    if (feature === 'message') {
      // data: { message: DmMessage, playerIds: string[] }
      const { message, playerIds } = data as {
        message: DmMessage;
        playerIds: string[];
      };

      if (!message || !playerIds || playerIds.length === 0) {
        return NextResponse.json(
          { error: 'message and playerIds are required' },
          { status: 400 }
        );
      }

      // Append message to each target player's queue
      const pipeline = redis.pipeline();
      for (const pid of playerIds) {
        const key = campaignMessagesKey(code, pid);
        // We need to read-modify-write; use pipeline for reads first
        pipeline.get(key);
      }
      const results = await pipeline.exec();

      const writePipeline = redis.pipeline();
      for (let i = 0; i < playerIds.length; i++) {
        const key = campaignMessagesKey(code, playerIds[i]);
        const existing = results[i];
        let queue: DmMessage[] = [];
        if (existing) {
          queue =
            typeof existing === 'string' ? JSON.parse(existing) : existing;
        }
        queue.push(message);
        writePipeline.set(key, JSON.stringify(queue), {
          ex: SLIDING_TTL_SECONDS,
        });
      }
      await writePipeline.exec();

      await refreshCampaignTTL(redis, code);
      return NextResponse.json({ success: true });
    }

    if (feature === 'effects') {
      const { playerId: targetPlayerId, effects } = data as {
        playerId: string;
        effects: DmEffect[];
      };

      if (!targetPlayerId) {
        return NextResponse.json(
          { error: 'playerId is required for effects' },
          { status: 400 }
        );
      }

      const key = campaignEffectsKey(code, targetPlayerId);
      if (effects.length === 0) {
        await redis.del(key);
      } else {
        await redis.set(key, JSON.stringify(effects), {
          ex: SLIDING_TTL_SECONDS,
        });
      }

      await refreshCampaignTTL(redis, code);
      return NextResponse.json({ success: true });
    }

    if (feature === 'xp') {
      const { playerId: targetPlayerId, award } = data as {
        playerId: string;
        award: DmXpAward;
      };

      if (!targetPlayerId || typeof targetPlayerId !== 'string') {
        return NextResponse.json(
          { error: 'playerId is required for xp' },
          { status: 400 }
        );
      }

      const validationError = validateDmXpAward(award);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      // Never create queue keys for players who are not in the campaign
      const isMember = await redis.sismember(
        campaignPlayersKey(code),
        targetPlayerId
      );
      if (!isMember) {
        return NextResponse.json(
          { error: 'playerId is not a member of this campaign' },
          { status: 400 }
        );
      }

      const result = await enqueueXpAward(
        getRawRedis(),
        campaignXpKey(code, targetPlayerId),
        award
      );
      if (result === 'full') {
        return NextResponse.json(
          { error: 'XP award queue is full for this player' },
          { status: 409 }
        );
      }

      await refreshCampaignTTL(redis, code);
      return NextResponse.json({ success: true });
    }

    if (feature === 'item_transfer') {
      const { transfer, playerId: targetPlayerId } = data as {
        transfer: ItemTransfer;
        playerId: string;
      };

      if (!transfer || !targetPlayerId) {
        return NextResponse.json(
          { error: 'transfer and playerId are required' },
          { status: 400 }
        );
      }

      const key = campaignTransfersKey(code, targetPlayerId);
      const existing = await redis.get<string>(key);
      let queue: ItemTransfer[] = [];
      if (existing) {
        queue = typeof existing === 'string' ? JSON.parse(existing) : existing;
      }
      queue.push(transfer);
      await redis.set(key, JSON.stringify(queue), {
        ex: SLIDING_TTL_SECONDS,
      });

      await refreshCampaignTTL(redis, code);
      return NextResponse.json({ success: true });
    }

    // Default: store as shared feature key (calendar, initiative, etc.)
    await Promise.all([
      redis.set(campaignSharedKey(code, feature), JSON.stringify(data), {
        ex: SLIDING_TTL_SECONDS,
      }),
      refreshCampaignTTL(redis, code),
    ]);

    // Latency shave: nudge connected battle-map clients to refetch now.
    // Awaited (serverless may drop un-awaited work) but never throws; the
    // adaptive poll remains the guarantee.
    if (feature === 'initiative' || feature === 'initiativeRequest') {
      await sendInitiativePoke(code, redis);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating shared state:', error);
    return NextResponse.json(
      { error: 'Failed to update shared state' },
      { status: 500 }
    );
  }
}

// DELETE — player acknowledges (removes) a message or DM effects
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid or empty request body' },
        { status: 400 }
      );
    }

    const { playerId: assertedPlayerId, type } = body;
    let playerId = assertedPlayerId;

    const membership = await authorizeCampaignMembershipRoute(code, true);
    if (membership.mode === 'denied') {
      return NextResponse.json(
        { error: 'Account membership is required' },
        { status: membership.status }
      );
    }
    if (membership.mode === 'account') {
      const security = validateCampaignMembershipMutation(request);
      if (!security.ok) {
        return NextResponse.json(
          { error: security.error },
          { status: security.status }
        );
      }
      if (
        membership.principal.role === 'player' &&
        !accountMembershipMatchesLegacyIds(membership.principal, [playerId])
      ) {
        return NextResponse.json(
          { error: 'Explicit account character link is required' },
          { status: 403 }
        );
      }
      playerId = playerId ?? membership.principal.legacyPlayerId;
    }

    const guest =
      membership.mode === 'legacy'
        ? await authorizeHybridGuestRoute(request, code, 'shared:ack', true)
        : ({ mode: 'legacy' } as const);
    if (guest.mode === 'denied') return guestDeniedResponse(guest);
    if (guest.mode === 'guest') {
      const bound = requireGuestPlayerBinding(guest, [playerId]);
      if (!bound) {
        return NextResponse.json(
          { error: 'Guest player binding does not match' },
          { status: 403 }
        );
      }
      playerId = bound;
    }

    if (!playerId) {
      return NextResponse.json(
        { error: 'playerId is required' },
        { status: 400 }
      );
    }

    const redis = getRedis();

    // Acknowledge all DM effects for this player
    if (type === 'effects') {
      await redis.del(campaignEffectsKey(code, playerId));
      return NextResponse.json({ success: true });
    }

    if (type === 'transfers') {
      const { transferId } = body;
      if (!transferId) {
        await redis.del(campaignTransfersKey(code, playerId));
        return NextResponse.json({ success: true });
      }
      const key = campaignTransfersKey(code, playerId);
      const raw = await redis.get<string>(key);
      if (raw) {
        const transfers: ItemTransfer[] =
          typeof raw === 'string' ? JSON.parse(raw) : raw;
        const filtered = transfers.filter(t => t.id !== transferId);
        if (filtered.length === 0) {
          await redis.del(key);
        } else {
          await redis.set(key, JSON.stringify(filtered), {
            ex: SLIDING_TTL_SECONDS,
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    if (type === 'xp') {
      const { receipt } = body;
      if (!receipt || typeof receipt !== 'string') {
        return NextResponse.json(
          { error: 'receipt is required' },
          { status: 400 }
        );
      }
      await ackXpAward(getRawRedis(), campaignXpKey(code, playerId), receipt);
      return NextResponse.json({ success: true });
    }

    // Default: acknowledge a specific message
    const { messageId } = body;
    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    const key = campaignMessagesKey(code, playerId);
    const raw = await redis.get<string>(key);

    if (raw) {
      const messages: DmMessage[] =
        typeof raw === 'string' ? JSON.parse(raw) : raw;
      const filtered = messages.filter(m => m.id !== messageId);

      if (filtered.length === 0) {
        await redis.del(key);
      } else {
        await redis.set(key, JSON.stringify(filtered), {
          ex: SLIDING_TTL_SECONDS,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error acknowledging shared data:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge' },
      { status: 500 }
    );
  }
}
