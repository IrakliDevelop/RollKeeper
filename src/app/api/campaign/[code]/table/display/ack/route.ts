import { NextRequest, NextResponse } from 'next/server';

import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { getRawRedis } from '@/lib/redis';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import {
  parseDisplayAck,
  recordDisplayAck,
} from '@/lib/tableServer/displayCapability';
import { readBoundedJson } from '@/lib/tableServer/validation';

type Context = { params: Promise<{ code: string }> };

const HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
} as const;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: HEADERS });
const BODY_KEYS = ['ack', 'capability', 'nonce'];

/**
 * PR05 E7: display ACK/heartbeat. The body (≤ 2 KiB, exact keys) carries
 * the credential and a tuple the server checks against current control;
 * the server stamps the time. A mismatch or an unbound session is 409
 * `stale` (the display re-polls its descriptor), never a credential 403.
 */
export async function POST(request: NextRequest, { params }: Context) {
  if (!isTableProtocolRequired())
    return reply({ error: 'Table v1 is disabled' }, 503);
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok) return reply({ error: security.error }, security.status);
  const { code } = await params;
  let body: Record<string, unknown> | null = null;
  try {
    const value = await readBoundedJson(request, 2048);
    if (value && typeof value === 'object' && !Array.isArray(value))
      body = value as Record<string, unknown>;
  } catch {
    return reply({ error: 'Invalid or oversized JSON body' }, 400);
  }
  const keys = body ? Object.keys(body).sort() : [];
  const ack = body ? parseDisplayAck(body.ack) : null;
  if (
    !ack ||
    keys.length !== BODY_KEYS.length ||
    keys.some((key, index) => key !== BODY_KEYS[index])
  )
    return reply({ error: 'Invalid display ACK' }, 400);
  let rawRedis: ReturnType<typeof getRawRedis>;
  try {
    rawRedis = getRawRedis();
  } catch {
    return reply({ error: 'Live authority is unavailable' }, 503);
  }
  const result = await recordDisplayAck({
    rawRedis,
    code,
    capability: body!.capability,
    nonce: body!.nonce,
    ack,
  });
  if (result.status === 'recorded')
    return reply({ receivedAt: result.receivedAt });
  if (result.status === 'denied')
    return reply({ error: result.error }, result.httpStatus);
  if (result.status === 'stale') return reply({ error: 'stale' }, 409);
  return reply({ error: 'Live authority is unavailable' }, 503);
}
