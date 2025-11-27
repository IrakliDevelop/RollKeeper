import { NextResponse } from 'next/server';
import {
  loadAllBackgrounds,
  loadAllBackgroundFeatures,
} from '@/utils/backgroundDataLoader';

export async function GET() {
  try {
    const [backgrounds, features] = await Promise.all([
      loadAllBackgrounds(),
      loadAllBackgroundFeatures(),
    ]);

    return NextResponse.json({
      backgrounds,
      features,
      total: backgrounds.length,
    });
  } catch (error) {
    console.error('Error loading backgrounds:', error);
    return NextResponse.json(
      { error: 'Failed to load background data' },
      { status: 500 }
    );
  }
}
