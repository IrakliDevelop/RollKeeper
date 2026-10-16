import { NextRequest, NextResponse } from 'next/server';
import { authorizeTableDm } from '@/lib/tableServer/auth';
import { TableControlService } from '@/lib/tableServer/control';

/** The DM-only scene registry read is never cached (review B7). */
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const auth = await authorizeTableDm(
    request,
    code,
    request.nextUrl.searchParams.get('dmId'),
    false
  );
  if (!auth.ok)
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: NO_STORE }
    );
  try {
    return NextResponse.json(
      { scenes: await new TableControlService().registry(auth.principal) },
      { headers: NO_STORE }
    );
  } catch {
    // Same answer as the control GET: a Redis failure is a formatted 503.
    return NextResponse.json(
      { error: 'Table control is unavailable' },
      { status: 503, headers: NO_STORE }
    );
  }
}
