import { NextResponse } from 'next/server';
import { loadAllRaces } from '@/utils/raceDataLoader';

export async function GET() {
  try {
    const races = await loadAllRaces();
    return NextResponse.json(races);
  } catch (error) {
    console.error('Error loading races:', error);
    return NextResponse.json(
      { error: 'Failed to load races' },
      { status: 500 }
    );
  }
}

