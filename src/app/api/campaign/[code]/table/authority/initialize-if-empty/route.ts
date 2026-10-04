import { NextRequest, NextResponse } from 'next/server';
import type { AuthorityCheckpointPayload } from '@fieldnotes/sync';

import { authorizeTableDm } from '@/lib/tableServer/auth';
import {
  authorityAdminContext,
  provisionAuthorityRoom,
  readAuthorityRequest,
  validateAuthorityState,
} from '@/lib/tableServer/authorityAdmin';
import { isTableProtocolRequired } from '@/lib/tableServer/control';

type AuthorityState = Omit<AuthorityCheckpointPayload, 'cursor' | 'casToken'>;

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
  if (!context)
    return NextResponse.json(
      { error: 'Current live control is required' },
      { status: 403 }
    );
  const expectedGeneration =
    typeof body.expectedGeneration === 'string'
      ? body.expectedGeneration
      : null;
  const expectedCasToken =
    typeof body.expectedCasToken === 'string' ? body.expectedCasToken : null;
  const initializing = expectedGeneration === null && expectedCasToken === null;
  if (
    initializing
      ? context.roomGeneration !== null
      : context.roomGeneration !== expectedGeneration ||
        context.casToken !== expectedCasToken
  )
    return NextResponse.json(
      { error: 'Authority state changed' },
      { status: 409 }
    );
  const state = await validateAuthorityState(body.state);
  if (!state)
    return NextResponse.json(
      { error: 'Invalid authority state' },
      { status: 400 }
    );
  const response = await provisionAuthorityRoom(
    context,
    state as AuthorityState,
    { generation: expectedGeneration, casToken: expectedCasToken }
  );
  if (!response)
    return NextResponse.json(
      { error: 'Authority relay unavailable' },
      { status: 503 }
    );
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
