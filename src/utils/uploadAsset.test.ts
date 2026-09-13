import { beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadAsset } from '@/utils/uploadAsset';

describe('uploadAsset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests a signed URL and uploads the file directly to S3', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uploadUrl: 'https://bucket.s3.example.test/signed',
            url: 'https://bucket.s3.example.test/asset.png',
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const file = new File(['image'], 'map.png', { type: 'image/png' });

    await expect(uploadAsset(file, 'map-1')).resolves.toBe(
      'https://bucket.s3.example.test/asset.png'
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/assets/upload',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          assetId: 'map-1',
          fileName: 'map.png',
          fileSize: 5,
          contentType: 'image/png',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://bucket.s3.example.test/signed',
      expect.objectContaining({ method: 'PUT', body: file })
    );
  });

  it('rejects files larger than 200 MB before making a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const oversized = {
      size: 200 * 1024 * 1024 + 1,
      type: 'video/mp4',
    } as Blob;

    await expect(uploadAsset(oversized, 'video-1')).rejects.toThrow(
      'must not exceed 200MB'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
