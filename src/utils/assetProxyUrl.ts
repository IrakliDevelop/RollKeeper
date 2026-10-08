/**
 * Route an S3 URL through our own proxy to avoid CORS canvas tainting.
 * Non-S3 URLs (e.g. blob: or data:) are returned as-is. Shared by the setup
 * editor, player tokens and the Table map image (PR06 C6-1).
 */
export function assetProxyUrl(url: string): string {
  if (url.includes('.s3.') && url.includes('.amazonaws.com')) {
    return `/api/assets/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}
