import { NextRequest, NextResponse } from 'next/server';

import { authorizeTableDm } from '@/lib/tableServer/auth';
import {
  authorityAdminContext,
  captureAuthorityCheckpoint,
  readAuthorityRequest,
} from '@/lib/tableServer/authorityAdmin';
import { isTableProtocolRequired } from '@/lib/tableServer/control';

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
  let body: Record<string, unknown>;
  try {
    body = await readAuthorityRequest(request);
  } catch {
    return NextResponse.json(
      { error: 'Invalid or oversized body' },
      { status: 400 }
    );
  }
  const auth = await authorizeTableDm(request, code, body.dmId, true);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const context = await authorityAdminContext(
    code,
    body.sceneId,
    auth.principal.id
  );
  if (!context?.roomGeneration)
    return NextResponse.json(
      { error: 'Current live control is required' },
      { status: 403 }
    );
  const response = await captureAuthorityCheckpoint(context);
  if (!response)
    return NextResponse.json(
      { error: 'Authority relay unavailable' },
      { status: 503 }
    );
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
