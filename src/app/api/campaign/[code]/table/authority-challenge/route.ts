import { NextRequest, NextResponse } from 'next/server';
import { authorizeTableDm } from '@/lib/tableServer/auth';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import { proveRelayAuthority } from '@/lib/tableServer/authorityProof';
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
  const verified = await proveRelayAuthority(code);
  if (!verified)
    return NextResponse.json(
      { error: 'Relay authority proof failed' },
      { status: 503 }
    );
  return NextResponse.json({ verified: true, expiresInSeconds: 30 });
}
