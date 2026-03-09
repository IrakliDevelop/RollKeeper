import { NextResponse } from 'next/server';
import { loadAllArmors } from '@/utils/armorDataLoader';

export async function GET() {
  try {
    const items = await loadAllArmors();
    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error('Error loading armors:', error);
    return NextResponse.json(
      { error: 'Failed to load armor data' },
      { status: 500 }
    );
  }
}
