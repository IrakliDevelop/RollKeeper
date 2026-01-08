/**
 * Avatar Delete API Route
 * Handles avatar image deletion from S3
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteAvatarFromS3 } from '@/utils/s3Upload';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'No URL provided' },
        { status: 400 }
      );
    }

    // Delete from S3
    await deleteAvatarFromS3(url);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Avatar deletion error:', error);
    // Return success even on error - we don't want deletion failures to break the app
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

