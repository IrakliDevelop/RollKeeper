import { NextResponse } from 'next/server';
import { loadAllWeapons } from '@/utils/weaponDataLoader';

export async function GET() {
  try {
    const items = await loadAllWeapons();
    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error('Error loading weapons:', error);
    return NextResponse.json(
      { error: 'Failed to load weapon data' },
      { status: 500 }
    );
  }
}
