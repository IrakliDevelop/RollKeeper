import { NextRequest, NextResponse } from 'next/server';
import { authorizeTableDm } from '@/lib/tableServer/auth';
import { TableControlService } from '@/lib/tableServer/control';

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
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({
    scenes: await new TableControlService().registry(auth.principal),
  });
}
