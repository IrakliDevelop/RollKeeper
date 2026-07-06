import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignSharedKey,
  campaignMessagesKey,
  campaignEffectsKey,
  campaignTransfersKey,
  campaignPlayersKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';
import type {
  DmMessage,
  DmEffect,
  SharedCalendar,
  SharedCalendarPlayer,
  SharedCampaignState,
  SharedCustomCounter,
  ItemTransfer,
  SharedInitiativeState,
  SharedBattleMapState,
} from '@/types/sharedState';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const role = request.nextUrl.searchParams.get('role') ?? 'player';
    const playerId = request.nextUrl.searchParams.get('playerId');
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

    let calendar: SharedCalendarPlayer | null = null;

    if (calendarRaw) {
      const parsed: SharedCalendar =
        typeof calendarRaw === 'string' ? JSON.parse(calendarRaw) : calendarRaw;

      if (role === 'dm') {
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

    if (!feature || !data) {
      return NextResponse.json(
        { error: 'feature and data are required' },
        { status: 400 }
      );
    }

    if (feature !== 'item_transfer' && !dmId) {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }

    const redis = getRedis();

    // Strict DM check — a mismatched dmId must never take over the campaign
    // (it would let anyone mint DM battle-map tokens and see hidden elements).
    if (dmId) {
      const dmAuth = await verifyDmAuthority(redis, code, dmId);
      if (dmAuth === 'mismatch') {
        return NextResponse.json(
          { error: 'dmId does not match campaign owner' },
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

    // Default: store as shared feature key (calendar, etc.)
    await Promise.all([
      redis.set(campaignSharedKey(code, feature), JSON.stringify(data), {
        ex: SLIDING_TTL_SECONDS,
      }),
      refreshCampaignTTL(redis, code),
    ]);

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

    const { playerId, type } = body;

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
