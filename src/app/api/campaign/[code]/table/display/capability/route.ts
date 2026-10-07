import { NextRequest, NextResponse } from 'next/server';

import { getRawRedis } from '@/lib/redis';
import { authorizeTableDm } from '@/lib/tableServer/auth';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import { rotateDisplayCapability } from '@/lib/tableServer/displayCapability';
import { readBoundedJson } from '@/lib/tableServer/validation';

type Context = { params: Promise<{ code: string }> };

const HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
} as const;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: HEADERS });

/**
 * PR05 E3/M2: Open display. Any campaign DM (account owner/DM membership +
 * existing DM authority + origin/CSRF; the documented legacy membership
 * branch keeps `verifyDmAuthority`) rotates the single display capability.
 * No lease is required and the fenced command revision is untouched. The
 * plaintext capability exists only in this response.
 */
export async function POST(request: NextRequest, { params }: Context) {
  if (!isTableProtocolRequired())
    return reply({ error: 'Table v1 is disabled' }, 503);
  const { code } = await params;
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch {
    return reply({ error: 'Invalid or oversized JSON body' }, 400);
  }
  const dmId =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).dmId
      : undefined;
  const auth = await authorizeTableDm(request, code, dmId, true);
  if (!auth.ok) return reply({ error: auth.error }, auth.status);
  let rawRedis: ReturnType<typeof getRawRedis>;
  try {
    rawRedis = getRawRedis();
  } catch {
    return reply({ error: 'Live authority is unavailable' }, 503);
  }
  const result = await rotateDisplayCapability(rawRedis, code);
  if (result.status === 'not-initialized')
    return reply(
      { error: 'Live table is not initialized — open a Table scene first' },
      409
    );
  if (result.status !== 'rotated')
    return reply({ error: 'Live authority is unavailable' }, 503);
  return reply({
    capability: result.capability,
    displayGeneration: result.displayGeneration,
  });
}
