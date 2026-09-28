import { NextResponse } from 'next/server';
import { isTableProtocolRequired } from '@/lib/tableServer/control';

export async function GET() {
  return NextResponse.json({
    protocol: 'table-v1',
    required: isTableProtocolRequired(),
  });
}
