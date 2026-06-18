import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignSharedKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import type { TurnEndRequest } from '@/types/sharedState';

const KEY_FEATURE = 'turnRequest';

// Player submits a request to end their turn.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = (await request.json()) as TurnEndRequest;
    if (!body.encounterId || !body.entityId || !body.playerId) {
      return NextResponse.json(
        { error: 'encounterId, entityId and playerId are required' },
        { status: 400 }
      );
    }
    const redis = getRedis();
    await redis.set(
      campaignSharedKey(code, KEY_FEATURE),
      JSON.stringify(body),
      {
        ex: SLIDING_TTL_SECONDS,
      }
    );
    await refreshCampaignTTL(redis, code);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing turn request:', error);
    return NextResponse.json(
      { error: 'Failed to store turn request' },
      { status: 500 }
    );
  }
}

// DM reads the pending request (if any).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const redis = getRedis();
    const raw = await redis.get<string>(campaignSharedKey(code, KEY_FEATURE));
    const requestData: TurnEndRequest | null = raw
      ? typeof raw === 'string'
        ? JSON.parse(raw)
        : raw
      : null;
    return NextResponse.json({ request: requestData });
  } catch (error) {
    console.error('Error reading turn request:', error);
    return NextResponse.json(
      { error: 'Failed to read turn request' },
      { status: 500 }
    );
  }
}

// DM clears the request after applying or rejecting it.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const redis = getRedis();
    await redis.del(campaignSharedKey(code, KEY_FEATURE));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing turn request:', error);
    return NextResponse.json(
      { error: 'Failed to clear turn request' },
      { status: 500 }
    );
  }
}
