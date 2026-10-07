import { NextRequest, NextResponse } from 'next/server';

import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { getRawRedis } from '@/lib/redis';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import {
  projectDisplayTarget,
  verifyDisplayCapability,
} from '@/lib/tableServer/displayCapability';
import { readBoundedJson } from '@/lib/tableServer/validation';

type Context = { params: Promise<{ code: string }> };

const HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
} as const;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: HEADERS });

/**
 * PR05 E6: the campaign display's descriptor. POST so the capability and
 * session nonce travel in the body; same-origin + CSRF + JSON required. The
 * first valid use binds the nonce (compare-if-unbound). Only the visible
 * scene's `{sceneId, sourceMapId, label}` is ever disclosed.
 */
export async function POST(request: NextRequest, { params }: Context) {
  if (!isTableProtocolRequired())
    return reply({ error: 'Table v1 is disabled' }, 503);
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok) return reply({ error: security.error }, security.status);
  const { code } = await params;
  let body: Record<string, unknown> | null;
  try {
    const value = await readBoundedJson(request, 2048);
    body =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
  } catch {
    return reply({ error: 'Invalid or oversized JSON body' }, 400);
  }
  let rawRedis: ReturnType<typeof getRawRedis>;
  try {
    rawRedis = getRawRedis();
  } catch {
    return reply({ error: 'Live authority is unavailable' }, 503);
  }
  const verified = await verifyDisplayCapability({
    rawRedis,
    code,
    capability: body?.capability,
    nonce: body?.nonce,
    bind: true,
  });
  if (verified.status === 'denied')
    return reply({ error: verified.error }, verified.httpStatus);
  if (verified.status === 'stale') return reply({ error: 'stale' }, 409);
  if (verified.status !== 'ok')
    return reply({ error: 'Live authority is unavailable' }, 503);
  return reply(projectDisplayTarget(verified.control, verified.presentedEntry));
}
