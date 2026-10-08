import { NextRequest, NextResponse } from 'next/server';

import { getRawRedis } from '@/lib/redis';
import { authorizeTableDm } from '@/lib/tableServer/auth';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import { readDisplayStatus } from '@/lib/tableServer/displayCapability';

type Context = { params: Promise<{ code: string }> };

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

/**
 * PR05 E13: DM-only display status computed server-side with Redis TIME
 * against current control. Never returns the capability, its hash, the
 * session nonce or the display generation.
 */
export async function GET(request: NextRequest, { params }: Context) {
  if (!isTableProtocolRequired())
    return reply({ error: 'Table v1 is disabled' }, 503);
  const { code } = await params;
  const auth = await authorizeTableDm(
    request,
    code,
    request.nextUrl.searchParams.get('dmId'),
    false
  );
  if (!auth.ok) return reply({ error: auth.error }, auth.status);
  let rawRedis: ReturnType<typeof getRawRedis>;
  try {
    rawRedis = getRawRedis();
  } catch {
    return reply({ error: 'Display status is unavailable' }, 503);
  }
  const result = await readDisplayStatus(rawRedis, code);
  if (result.status !== 'ok')
    return reply({ error: 'Display status is unavailable' }, 503);
  return reply(result.display);
}
