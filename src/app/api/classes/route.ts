import { NextRequest, NextResponse } from 'next/server';
import { loadAllClasses } from '@/utils/classDataLoader';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    
    // Load all class data
    const classes = await loadAllClasses();
    
    // Apply pagination if requested
    if (limit && offset) {
      const limitNum = parseInt(limit, 10);
      const offsetNum = parseInt(offset, 10);
      const paginatedClasses = classes.slice(offsetNum, offsetNum + limitNum);
      
      return NextResponse.json({
        classes: paginatedClasses,
        total: classes.length,
        hasMore: offsetNum + limitNum < classes.length
      });
    }
    
    // Return all classes
    return NextResponse.json({
      classes,
      total: classes.length,
      hasMore: false
    });
    
  } catch (error) {
    console.error('Error loading classes:', error);
    return NextResponse.json(
      { error: 'Failed to load class data' },
      { status: 500 }
    );
  }
}
