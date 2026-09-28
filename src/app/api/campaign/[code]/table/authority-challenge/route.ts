import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRawRedis } from '@/lib/redis';
import { authorizeTableDm } from '@/lib/tableServer/auth';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import { readBoundedJson } from '@/lib/tableServer/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!isTableProtocolRequired())
    return NextResponse.json(
      { error: 'Table v1 is disabled' },
      { status: 503 }
    );
  const { code } = await params;
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch {
    return NextResponse.json(
      { error: 'Invalid or oversized JSON body' },
      { status: 400 }
    );
  }
  const record =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const auth = await authorizeTableDm(request, code, record?.dmId, true);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const challengeId = randomUUID();
  const nonce = randomBytes(32).toString('hex');
  // One bounded slot per campaign: repeated authenticated requests replace the
  // prior challenge instead of allocating unlimited nonce keys.
  await getRawRedis().set(
    `campaign:${code}:table-authority-challenge`,
    JSON.stringify({ challengeId, nonce }),
    { ex: 30 }
  );
  return NextResponse.json({
    challengeId,
    sha256: createHash('sha256').update(nonce).digest('hex'),
    expiresInSeconds: 30,
  });
}
