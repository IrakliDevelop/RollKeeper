import { NextRequest, NextResponse } from 'next/server';

const MAX_PROXY_SIZE = 50 * 1024 * 1024; // 50 MB

function configuredS3Hostname(): string | null {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_S3_REGION;

  if (!bucket || !region) return null;
  return `${bucket}.s3.${region}.amazonaws.com`;
}

/**
 * Proxies an S3 image through our own origin so the browser never
 * runs into CORS issues when drawing it on a <canvas>.
 *
 * Usage: GET /api/assets/proxy?url=https://bucket.s3.eu-central-1.amazonaws.com/key.png
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400 }
    );
  }

  // Only proxy our own S3 bucket to prevent SSRF
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const allowedHostname = configuredS3Hostname();
  if (!allowedHostname) {
    return NextResponse.json(
      { error: 'S3 is not configured' },
      { status: 503 }
    );
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHostname) {
    return NextResponse.json(
      { error: 'URL not allowed — only configured S3 images can be proxied' },
      { status: 403 }
    );
  }

  try {
    const upstream = await fetch(url);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentLength = upstream.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PROXY_SIZE) {
      return NextResponse.json(
        { error: 'Image too large to proxy' },
        { status: 413 }
      );
    }

    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream';
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Asset proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upstream image' },
      { status: 502 }
    );
  }
}
