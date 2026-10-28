import { describe, expect, it, vi } from 'vitest';

import { MAX_ASSET_UPLOAD_SIZE_BYTES } from '@/utils/constants';

import {
  SCENE_IMAGE_MAX_DIMENSION,
  prepareSceneImage,
  validateSceneImageFile,
} from './sceneImage';

const file = (type: string, size = 1_000, name = 'map.png') => {
  const blob = new File([new Uint8Array(Math.min(size, 16))], name, { type });
  if (size !== blob.size) Object.defineProperty(blob, 'size', { value: size });
  return blob;
};

const decodes = (w: number, h: number) => vi.fn(async () => ({ w, h }));
const undecodable = vi.fn(async () => {
  throw new Error('decode failed');
});

describe('W6 scene image validation (sceneImage.ts)', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])(
    'accepts %s with its decoded natural size',
    async type => {
      await expect(
        validateSceneImageFile(file(type), decodes(2048, 1024))
      ).resolves.toEqual({ ok: true, size: { w: 2048, h: 1024 } });
    }
  );

  it.each([
    [
      'video',
      file('video/mp4', 1_000, 'map.mp4'),
      'Choose a PNG, JPEG, WebP or GIF image',
    ],
    [
      'webm video',
      file('video/webm', 1_000, 'map.webm'),
      'Choose a PNG, JPEG, WebP or GIF image',
    ],
    [
      'SVG',
      file('image/svg+xml', 1_000, 'map.svg'),
      'Choose a PNG, JPEG, WebP or GIF image',
    ],
    [
      'an untyped file',
      file('', 1_000, 'map'),
      'Choose a PNG, JPEG, WebP or GIF image',
    ],
    [
      'an oversized file',
      file('image/png', MAX_ASSET_UPLOAD_SIZE_BYTES + 1),
      'Image must not exceed 200 MB',
    ],
  ])('rejects %s before decoding', async (_label, input, message) => {
    const decode = decodes(100, 100);
    await expect(validateSceneImageFile(input, decode)).resolves.toEqual({
      ok: false,
      message,
    });
    expect(decode).not.toHaveBeenCalled();
  });

  it('rejects an undecodable image', async () => {
    await expect(
      validateSceneImageFile(file('image/png'), undecodable)
    ).resolves.toEqual({
      ok: false,
      message: "Couldn't read this image.",
    });
  });

  it.each([
    [0, 100],
    [100, 0],
    [SCENE_IMAGE_MAX_DIMENSION + 1, 100],
    [100, SCENE_IMAGE_MAX_DIMENSION + 1],
  ])('rejects a %i × %i image', async (w, h) => {
    await expect(
      validateSceneImageFile(file('image/webp'), decodes(w, h))
    ).resolves.toEqual({
      ok: false,
      message: `Image must be between 1 and ${SCENE_IMAGE_MAX_DIMENSION} pixels on each side`,
    });
  });
});

describe('W6 scene image upload (never a data: fallback)', () => {
  it('uploads a valid image and returns its https URL and size', async () => {
    const upload = vi.fn(
      async () => 'https://bucket.s3.eu-west-1.amazonaws.com/maps/a.webp'
    );
    await expect(
      prepareSceneImage(file('image/webp'), {
        decode: decodes(640, 480),
        upload,
        assetId: 'scene-1',
      })
    ).resolves.toEqual({
      ok: true,
      url: 'https://bucket.s3.eu-west-1.amazonaws.com/maps/a.webp',
      size: { w: 640, h: 480 },
    });
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('reports the upload failure text and never falls back', async () => {
    const upload = vi.fn(async () => {
      throw new Error('Asset uploads are not configured');
    });
    await expect(
      prepareSceneImage(file('image/png'), {
        decode: decodes(10, 10),
        upload,
        assetId: 'scene-1',
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Upload failed: Asset uploads are not configured',
    });
  });

  it.each([
    'http://bucket.example.test/a.png',
    'data:image/png;base64,AAAA',
    '/local/a.png',
  ])('refuses a non-https upload result %s', async url => {
    await expect(
      prepareSceneImage(file('image/png'), {
        decode: decodes(10, 10),
        upload: vi.fn(async () => url),
        assetId: 'scene-1',
      })
    ).resolves.toEqual({
      ok: false,
      message: "The upload didn't return a usable image link. Try again.",
    });
  });

  it('never uploads an invalid file', async () => {
    const upload = vi.fn(async () => 'https://example.test/a.svg');
    await expect(
      prepareSceneImage(file('image/svg+xml'), {
        decode: decodes(10, 10),
        upload,
        assetId: 'scene-1',
      })
    ).resolves.toMatchObject({ ok: false });
    expect(upload).not.toHaveBeenCalled();
  });
});
