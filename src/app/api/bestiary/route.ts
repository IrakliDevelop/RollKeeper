import { NextRequest, NextResponse } from 'next/server';
import { loadAllBestiary } from '@/utils/bestiaryDataLoader';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Load all bestiary data
    const monsters = await loadAllBestiary();

    // Apply pagination if requested
    if (limit && offset) {
      const limitNum = parseInt(limit, 10);
      const offsetNum = parseInt(offset, 10);
      const paginatedMonsters = monsters.slice(offsetNum, offsetNum + limitNum);

      return NextResponse.json({
        monsters: paginatedMonsters,
        total: monsters.length,
        hasMore: offsetNum + limitNum < monsters.length,
      });
    }

    // Return all monsters
    return NextResponse.json({
      monsters,
      total: monsters.length,
      hasMore: false,
    });
  } catch (error) {
    console.error('Error loading bestiary:', error);
    return NextResponse.json(
      { error: 'Failed to load bestiary data' },
      { status: 500 }
    );
  }
}
