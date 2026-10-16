import {
  MAX_ASSET_UPLOAD_SIZE_BYTES,
  MAX_ASSET_UPLOAD_SIZE_MB,
} from '@/utils/constants';
import { uploadAsset } from '@/utils/uploadAsset';

import { isSceneImageUrl } from './sceneCommands';

/**
 * PR06 W6: client-side admission of a scene map image. The upload route also
 * allows SVG and video, so the Table refuses them here; an image must decode
 * with a positive natural size within the limit. Uploads go through the
 * existing `uploadAsset`; any failure or a non-https result is an error —
 * never a `data:` fallback.
 */
export const SCENE_IMAGE_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];
export const SCENE_IMAGE_MAX_DIMENSION = 16_384;

export type SceneImageSize = { w: number; h: number };
export type SceneImageDecoder = (file: File) => Promise<SceneImageSize>;
export type SceneImageUploader = (
  file: Blob,
  assetId: string
) => Promise<string>;

/** Natural size of an image file, decoded by the browser. */
export const decodeSceneImage: SceneImageDecoder = file =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('undecodable'));
    };
    image.src = url;
  });

export async function validateSceneImageFile(
  file: File,
  decode: SceneImageDecoder = decodeSceneImage
): Promise<
  { ok: true; size: SceneImageSize } | { ok: false; message: string }
> {
  if (!SCENE_IMAGE_TYPES.includes(file.type))
    return { ok: false, message: 'Choose a PNG, JPEG, WebP or GIF image' };
  if (file.size > MAX_ASSET_UPLOAD_SIZE_BYTES)
    return {
      ok: false,
      message: `Image must not exceed ${MAX_ASSET_UPLOAD_SIZE_MB} MB`,
    };
  let size: SceneImageSize;
  try {
    size = await decode(file);
  } catch {
    return { ok: false, message: "Couldn't read this image." };
  }
  const within = (value: number) =>
    Number.isFinite(value) && value >= 1 && value <= SCENE_IMAGE_MAX_DIMENSION;
  if (!within(size.w) || !within(size.h))
    return {
      ok: false,
      message: `Image must be between 1 and ${SCENE_IMAGE_MAX_DIMENSION} pixels on each side`,
    };
  return { ok: true, size: { w: size.w, h: size.h } };
}

/** Validate, then upload; returns the https URL and natural size. */
export async function prepareSceneImage(
  file: File,
  options: {
    assetId: string;
    decode?: SceneImageDecoder;
    upload?: SceneImageUploader;
  }
): Promise<
  | { ok: true; url: string; size: SceneImageSize }
  | { ok: false; message: string }
> {
  const valid = await validateSceneImageFile(file, options.decode);
  if (!valid.ok) return valid;
  let url: string;
  try {
    url = await (options.upload ?? uploadAsset)(file, options.assetId);
  } catch (error) {
    return {
      ok: false,
      message: `Upload failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
  if (!url || !isSceneImageUrl(url))
    return {
      ok: false,
      message: "The upload didn't return a usable image link. Try again.",
    };
  return { ok: true, url, size: valid.size };
}
