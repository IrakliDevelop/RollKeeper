import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignSharedKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import type { InitiativeSubmission } from '@/types/sharedState';

const KEY_FEATURE = 'initiativeSubmissions';

type SubmissionRecord = Record<string, InitiativeSubmission>;

async function readRecord(
  redis: ReturnType<typeof getRedis>,
  code: string
): Promise<SubmissionRecord> {
  const raw = await redis.get<string>(campaignSharedKey(code, KEY_FEATURE));
  if (!raw) return {};
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// Player submits (or resubmits) their initiative total for the active request.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = (await request.json()) as InitiativeSubmission;
    if (!body.requestId || !body.playerId || typeof body.value !== 'number') {
      return NextResponse.json(
        { error: 'requestId, playerId and numeric value are required' },
        { status: 400 }
      );
    }
    const redis = getRedis();
    const record = await readRecord(redis, code);
    record[body.playerId] = {
      requestId: body.requestId,
      playerId: body.playerId,
      value: body.value,
      submittedAt: Date.now(),
    };
    await redis.set(
      campaignSharedKey(code, KEY_FEATURE),
      JSON.stringify(record),
      { ex: SLIDING_TTL_SECONDS }
    );
    await refreshCampaignTTL(redis, code);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing initiative submission:', error);
    return NextResponse.json(
      { error: 'Failed to store initiative submission' },
      { status: 500 }
    );
  }
}

// DM reads all pending submissions.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const submissions = await readRecord(getRedis(), code);
    return NextResponse.json({ submissions });
  } catch (error) {
    console.error('Error reading initiative submissions:', error);
    return NextResponse.json(
      { error: 'Failed to read initiative submissions' },
      { status: 500 }
    );
  }
}

// DM deletes one applied submission (?playerId=...) or clears them all.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const playerId = request.nextUrl.searchParams.get('playerId');
    const redis = getRedis();
    if (!playerId) {
      await redis.del(campaignSharedKey(code, KEY_FEATURE));
    } else {
      const record = await readRecord(redis, code);
      if (playerId in record) {
        delete record[playerId];
        await redis.set(
          campaignSharedKey(code, KEY_FEATURE),
          JSON.stringify(record),
          { ex: SLIDING_TTL_SECONDS }
        );
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing initiative submissions:', error);
    return NextResponse.json(
      { error: 'Failed to clear initiative submissions' },
      { status: 500 }
    );
  }
}
