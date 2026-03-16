import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignKey,
  campaignSharedKey,
  campaignMessagesKey,
  campaignEffectsKey,
  campaignPlayersKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import type { CampaignData } from '@/types/campaign';
import type {
  DmMessage,
  DmEffect,
  SharedCalendar,
  SharedCalendarPlayer,
  SharedCampaignState,
  SharedCustomCounter,
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

    if (playerId) {
      const [messagesRaw, effectsRaw, countersRaw] = await Promise.all([
        redis.get<string>(campaignMessagesKey(code, playerId)),
        redis.get<string>(campaignEffectsKey(code, playerId)),
        redis.get<string>(campaignSharedKey(code, 'counters')),
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
    }

    await refreshCampaignTTL(redis, code);

    const state: SharedCampaignState = {
      calendar,
      messages,
      dmEffects,
      customCounter,
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
    const body = await request.json();
    const { feature, data, dmId } = body;

    if (!feature || !data || !dmId) {
      return NextResponse.json(
        { error: 'feature, data, and dmId are required' },
        { status: 400 }
      );
    }

    const redis = getRedis();

    // Check campaign exists — if the dmId drifted (e.g. localStorage reset),
    // update the campaign record to the caller's dmId. The campaign code
    // itself is the access boundary; only DM pages call this endpoint.
    const campaignRaw = await redis.get<string>(campaignKey(code));

    if (campaignRaw) {
      const campaign: CampaignData =
        typeof campaignRaw === 'string' ? JSON.parse(campaignRaw) : campaignRaw;

      if (campaign.dmId !== dmId) {
        await redis.set(
          campaignKey(code),
          JSON.stringify({ ...campaign, dmId }),
          { ex: SLIDING_TTL_SECONDS }
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
    const body = await request.json();
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
