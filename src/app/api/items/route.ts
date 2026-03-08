import { NextRequest, NextResponse } from 'next/server';
import { loadAllItems } from '@/utils/itemDataLoader';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const items = await loadAllItems();

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
    console.error('Error loading items:', error);
    return NextResponse.json(
      { error: 'Failed to load item data' },
      { status: 500 }
    );
  }
}
