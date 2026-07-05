import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  getRedis,
  campaignDisplayKeyKey,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (!process.env.BATTLEMAP_RELAY_SECRET) {
      return NextResponse.json(
        { error: 'Live battle map relay is not configured' },
        { status: 503 }
      );
    }
    const { dmId } = (await request.json()) as { dmId?: string };
    if (!dmId) {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }
    const redis = getRedis();
    const dmAuth = await verifyDmAuthority(redis, code, dmId);
    if (dmAuth !== 'ok') {
      return NextResponse.json(
        { error: 'Not the campaign DM' },
        { status: 403 }
      );
    }
    // Re-minting rotates the key: old display URLs stop working (one table monitor).
    const displayKey = randomUUID();
    await redis.set(campaignDisplayKeyKey(code), displayKey, {
      ex: SLIDING_TTL_SECONDS,
    });
    return NextResponse.json({ displayKey });
  } catch (error) {
    console.error('Error minting display key:', error);
    return NextResponse.json(
      { error: 'Failed to mint display key' },
      { status: 500 }
    );
  }
}
