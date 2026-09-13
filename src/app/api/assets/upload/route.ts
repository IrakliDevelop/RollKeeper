import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  MAX_ASSET_UPLOAD_SIZE_BYTES,
  MAX_ASSET_UPLOAD_SIZE_MB,
} from '@/utils/constants';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
];

function getS3Client() {
  const region = process.env.AWS_S3_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function POST(request: NextRequest) {
  try {
    const s3 = getS3Client();
    const bucket = process.env.AWS_S3_BUCKET_NAME;

    if (!s3 || !bucket) {
      return NextResponse.json(
        {
          error:
            'S3 is not configured. Set AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME.',
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      assetId?: string;
      fileName?: string;
      fileSize?: number;
      contentType?: string;
    };
    const { assetId, fileName, fileSize, contentType } = body;

    if (!fileName || typeof fileSize !== 'number' || !contentType) {
      return NextResponse.json(
        { error: 'File name, size, and content type are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${contentType}` },
        { status: 400 }
      );
    }

    if (fileSize <= 0 || fileSize > MAX_ASSET_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size must not exceed ${MAX_ASSET_UPLOAD_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
    const timestamp = Date.now();
    const sanitizedId = (assetId || 'unknown').replace(/[^a-zA-Z0-9_:-]/g, '_');
    const key = `notes-assets/${sanitizedId}-${timestamp}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize,
      CacheControl: 'public, max-age=31536000, immutable',
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    const region = process.env.AWS_S3_REGION;
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({ uploadUrl, url }, { status: 200 });
  } catch (error) {
    console.error('Asset upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload asset' },
      { status: 500 }
    );
  }
}
