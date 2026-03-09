import { NextRequest, NextResponse } from 'next/server';
import { loadAllMagicItems } from '@/utils/magicItemDataLoader';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const items = await loadAllMagicItems();

    if (limit && offset) {
      const limitNum = parseInt(limit, 10);
      const offsetNum = parseInt(offset, 10);
      const paginated = items.slice(offsetNum, offsetNum + limitNum);

      return NextResponse.json({
        items: paginated,
        total: items.length,
        hasMore: offsetNum + limitNum < items.length,
      });
    }

    return NextResponse.json({
      items,
      total: items.length,
      hasMore: false,
    });
  } catch (error) {
    console.error('Error loading magic items:', error);
    return NextResponse.json(
      { error: 'Failed to load magic item data' },
      { status: 500 }
    );
  }
}
