import { NextRequest, NextResponse } from 'next/server';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import {
  fiveEToolsTokenUrl,
  isValidTokenSource,
  tokenS3Key,
} from '@/utils/bestiaryTokenUrl';

const IMAGE_HEADERS = {
  'Content-Type': 'image/webp',
  'Cache-Control': 'public, max-age=31536000, immutable',
};

function getS3() {
  const region = process.env.AWS_S3_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.AWS_S3_BUCKET_NAME;

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    client: new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
}

/**
 * Serves a monster token image. S3 is a lazy cache: on miss the image is
 * fetched from 5e.tools, written to S3 (bestiary-tokens/{SOURCE}/{Name}.webp),
 * and streamed back. Without S3 config this degrades to a pure proxy.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ source: string; name: string }> }
) {
  const { source, name } = await params;

  if (!isValidTokenSource(source) || name.trim() === '') {
    return NextResponse.json({ error: 'Invalid token path' }, { status: 400 });
  }

  const s3 = getS3();

  if (s3) {
    try {
      const cached = await s3.client.send(
        new GetObjectCommand({
          Bucket: s3.bucket,
          Key: tokenS3Key(source, name),
        })
      );
      if (cached.Body) {
        const bytes = await cached.Body.transformToByteArray();
        return new NextResponse(Buffer.from(bytes), {
          status: 200,
          headers: IMAGE_HEADERS,
        });
      }
    } catch {
      // NoSuchKey or any S3 read error — fall through to upstream fetch.
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(fiveEToolsTokenUrl(source, name));
  } catch (error) {
    console.error('Bestiary token upstream fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token image' },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Token not found upstream (${upstream.status})` },
      { status: upstream.status }
    );
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());

  if (s3) {
    try {
      await s3.client.send(
        new PutObjectCommand({
          Bucket: s3.bucket,
          Key: tokenS3Key(source, name),
          Body: buffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
    } catch (error) {
      // Cache-write failure must not break the response.
      console.error('Failed to cache bestiary token in S3:', error);
    }
  }

  return new NextResponse(buffer, { status: 200, headers: IMAGE_HEADERS });
}
