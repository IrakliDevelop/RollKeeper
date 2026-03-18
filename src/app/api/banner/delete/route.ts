/**
 * Banner Delete API Route
 * Handles campaign banner image deletion from S3
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteAvatarFromS3 } from '@/utils/s3Upload';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    // Reuse the same S3 delete function — it works for any S3 object
    await deleteAvatarFromS3(url);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Banner deletion error:', error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
