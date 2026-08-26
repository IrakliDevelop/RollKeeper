import { NextResponse } from 'next/server';
import { loadAllSenses } from '@/utils/sensesDataLoader';

export async function GET() {
  try {
    const senses = await loadAllSenses();

    return NextResponse.json({
      senses,
      total: senses.length,
    });
  } catch (error) {
    console.error('Error loading senses:', error);
    return NextResponse.json(
      { error: 'Failed to load senses data' },
      { status: 500 }
    );
  }
}
