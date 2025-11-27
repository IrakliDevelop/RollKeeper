import { NextResponse } from 'next/server';
import { loadAllFeats } from '@/utils/featDataLoader';

export async function GET() {
  try {
    const feats = await loadAllFeats();

    return NextResponse.json({
      feats,
      total: feats.length,
    });
  } catch (error) {
    console.error('Error loading feats:', error);
    return NextResponse.json(
      { error: 'Failed to load feat data' },
      { status: 500 }
    );
  }
}
