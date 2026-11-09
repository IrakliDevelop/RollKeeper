import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

import { GET } from '../route';

describe('GET /api/assets/proxy', () => {
  beforeEach(() => {
    process.env.AWS_S3_BUCKET_NAME = 'rollkeeper-test';
    process.env.AWS_S3_REGION = 'us-west-2';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AWS_S3_BUCKET_NAME;
    delete process.env.AWS_S3_REGION;
  });

  it('proxies an image from the configured bucket and region', async () => {
    const upstream = new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/png' },
    });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal('fetch', fetchMock);
    const assetUrl =
      'https://rollkeeper-test.s3.us-west-2.amazonaws.com/notes-assets/map.png';
    const request = new NextRequest(
      `http://localhost/api/assets/proxy?url=${encodeURIComponent(assetUrl)}`
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(fetchMock).toHaveBeenCalledWith(assetUrl);
  });

  it('bounds the decoded map raster while preserving its image format', async () => {
    const original = await sharp({
      create: {
        width: 3640,
        height: 4760,
        channels: 3,
        background: '#513b2d',
      },
    })
      .jpeg()
      .toBuffer();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array(original), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )
    );
    const assetUrl =
      'https://rollkeeper-test.s3.us-west-2.amazonaws.com/notes-assets/map.jpg';
    const response = await GET(
      new NextRequest(
        `http://localhost/api/assets/proxy?url=${encodeURIComponent(assetUrl)}&v=2`
      )
    );
    const metadata = await sharp(
      Buffer.from(await response.arrayBuffer())
    ).metadata();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width! * metadata.height!).toBeLessThanOrEqual(8_000_000);
  });

  it('rejects a URL from a different region', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const assetUrl =
      'https://rollkeeper-test.s3.eu-central-1.amazonaws.com/map.png';
    const request = new NextRequest(
      `http://localhost/api/assets/proxy?url=${encodeURIComponent(assetUrl)}`
    );

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a lookalike hostname', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const assetUrl =
      'https://rollkeeper-test.s3.us-west-2.amazonaws.com.attacker.test/map.png';
    const request = new NextRequest(
      `http://localhost/api/assets/proxy?url=${encodeURIComponent(assetUrl)}`
    );

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
