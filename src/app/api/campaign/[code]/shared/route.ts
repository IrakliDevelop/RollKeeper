import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignKey,
  campaignSharedKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import type { CampaignData } from '@/types/campaign';
import type {
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

    await refreshCampaignTTL(redis, code);

    const state: SharedCampaignState = { calendar };
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
    const { feature, data, dmId } = await request.json();

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
        // Update the campaign record to the current DM's id
        await redis.set(
          campaignKey(code),
          JSON.stringify({ ...campaign, dmId }),
          { ex: SLIDING_TTL_SECONDS }
        );
      }
    }

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
