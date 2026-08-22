import { NextRequest, NextResponse } from 'next/server';

import {
  drainCalendarProjectionQueue,
  validCalendarProjectionDispatcherSecret,
} from '@/lib/durableDm/calendarProjectionServer';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (
    !validCalendarProjectionDispatcherSecret(
      request.headers.get('authorization')
    )
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const result = await drainCalendarProjectionQueue(25);
  if (result.status !== 'drained') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
