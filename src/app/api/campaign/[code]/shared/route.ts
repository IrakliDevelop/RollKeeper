import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignKey,
  campaignSharedKey,
  campaignMessagesKey,
  campaignPlayersKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import type { CampaignData } from '@/types/campaign';
import type {
  DmMessage,
  SharedCalendar,
  SharedCalendarPlayer,
  SharedCampaignState,
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

    // Fetch pending messages for this player
    let messages: DmMessage[] = [];
    if (playerId) {
      const messagesRaw = await redis.get<string>(
        campaignMessagesKey(code, playerId)
      );
      if (messagesRaw) {
        messages =
          typeof messagesRaw === 'string'
            ? JSON.parse(messagesRaw)
            : messagesRaw;
      }
    }

    await refreshCampaignTTL(redis, code);

    const state: SharedCampaignState = { calendar, messages };
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

// DELETE — player acknowledges (removes) a message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { playerId, messageId } = await request.json();

    if (!playerId || !messageId) {
      return NextResponse.json(
        { error: 'playerId and messageId are required' },
        { status: 400 }
      );
    }

    const redis = getRedis();
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
    console.error('Error acknowledging message:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge message' },
      { status: 500 }
    );
  }
}
