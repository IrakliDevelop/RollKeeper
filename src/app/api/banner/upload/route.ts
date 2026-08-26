/**
 * Banner Upload API Route
 * Handles campaign banner image uploads to S3
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadBannerToS3, generateBannerFileName } from '@/utils/s3Upload';
import { MAX_BANNER_SIZE_MB, MAX_BANNER_SIZE_BYTES } from '@/utils/constants';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const campaignCode = formData.get('campaignCode') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!campaignCode) {
      return NextResponse.json(
        { error: 'Campaign code is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_BANNER_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size must be less than ${MAX_BANNER_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const fileName = generateBannerFileName(campaignCode, file.name);

    // Upload to S3
    const url = await uploadBannerToS3(buffer, fileName, file.type);

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error('Banner upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload banner' },
      { status: 500 }
    );
  }
}
