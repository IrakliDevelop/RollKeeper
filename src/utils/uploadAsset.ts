import {
  MAX_ASSET_UPLOAD_SIZE_BYTES,
  MAX_ASSET_UPLOAD_SIZE_MB,
} from '@/utils/constants';

interface PresignedAssetUpload {
  uploadUrl: string;
  url: string;
  error?: string;
}

/** Uploads a shared asset directly to S3 so large files bypass function limits. */
export async function uploadAsset(
  file: Blob,
  assetId: string
): Promise<string> {
  if (file.size > MAX_ASSET_UPLOAD_SIZE_BYTES) {
    throw new Error(`File size must not exceed ${MAX_ASSET_UPLOAD_SIZE_MB}MB`);
  }

  const fileName = file instanceof File ? file.name : `${assetId}.bin`;
  const contentType = file.type || 'application/octet-stream';
  const signingResponse = await fetch('/api/assets/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assetId,
      fileName,
      fileSize: file.size,
      contentType,
    }),
  });
  const signingResult = (await signingResponse.json().catch(() => ({}))) as
    | Partial<PresignedAssetUpload>
    | undefined;

  if (!signingResponse.ok || !signingResult?.uploadUrl || !signingResult.url) {
    throw new Error(signingResult?.error || 'Failed to prepare asset upload');
  }

  const uploadResponse = await fetch(signingResult.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error('Failed to upload asset to S3');
  }

  return signingResult.url;
}
