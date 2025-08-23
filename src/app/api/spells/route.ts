import { NextRequest, NextResponse } from 'next/server';
import { loadAllSpells } from '@/utils/spellDataLoader';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    
    // Load all spell data
    const spells = await loadAllSpells();
    
    // Apply pagination if requested
    if (limit && offset) {
      const limitNum = parseInt(limit, 10);
      const offsetNum = parseInt(offset, 10);
      const paginatedSpells = spells.slice(offsetNum, offsetNum + limitNum);
      
      return NextResponse.json({
        spells: paginatedSpells,
        total: spells.length,
        hasMore: offsetNum + limitNum < spells.length
      });
    }
    
    // Return all spells
    return NextResponse.json({
      spells,
      total: spells.length,
      hasMore: false
    });
    
  } catch (error) {
    console.error('Error loading spells:', error);
    return NextResponse.json(
      { error: 'Failed to load spell data' },
      { status: 500 }
    );
  }
}
