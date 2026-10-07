import { NextRequest, NextResponse } from 'next/server';
import { authorizeTableDm } from '@/lib/tableServer/auth';
import {
  isTableProtocolRequired,
  TableControlService,
} from '@/lib/tableServer/control';
import {
  parseTableCommand,
  readBoundedJson,
} from '@/lib/tableServer/validation';
import { sendInitiativePoke } from '@/lib/relayPoke';
import { getRedis } from '@/lib/redis';

type Context = { params: Promise<{ code: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { code } = await params;
  const auth = await authorizeTableDm(
    request,
    code,
    request.nextUrl.searchParams.get('dmId'),
    false
  );
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const service = new TableControlService();
    const [current, registry] = await Promise.all([
      service.read(code),
      service.registry(auth.principal),
    ]);
    return NextResponse.json({ current, registry });
  } catch {
    return NextResponse.json(
      { error: 'Table control is unavailable' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  if (!isTableProtocolRequired()) {
    return NextResponse.json(
      { error: 'Table v1 is disabled' },
      { status: 503 }
    );
  }
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
  const command = parseTableCommand(record?.command);
  if (!command)
    return NextResponse.json(
      { error: 'Invalid table command' },
      { status: 400 }
    );
  const auth = await authorizeTableDm(request, code, record?.dmId, true);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await new TableControlService().execute(
    auth.principal,
    command
  );
  if (
    result.status === 'committed' &&
    (command.type === 'publishInitiative' ||
      command.type === 'endInitiative' ||
      command.type === 'publishInitiativeRequest')
  ) {
    await sendInitiativePoke(code, getRedis());
  }
  const status =
    result.status === 'committed'
      ? 200
      : result.status === 'conflict'
        ? 409
        : result.status === 'denied'
          ? 403
          : 503;
  return NextResponse.json(result, { status });
}
