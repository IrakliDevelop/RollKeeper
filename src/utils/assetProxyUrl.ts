/**
 * Route an S3 URL through our own proxy to avoid CORS canvas tainting.
 * Non-S3 URLs (e.g. blob: or data:) are returned as-is. Shared by the setup
 * editor, player tokens and the Table map image (PR06 C6-1).
 */
export function assetProxyUrl(url: string): string {
  // Earlier checkpoints contain the unversioned proxy URL. Give them the
  // current render URL too, so a cached full-resolution image is not reused.
  if (url.startsWith('/api/assets/proxy?')) {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.searchParams.has('url')) {
      parsed.searchParams.set('v', '2');
      return `${parsed.pathname}${parsed.search}`;
    }
  }
  if (url.includes('.s3.') && url.includes('.amazonaws.com')) {
    return `/api/assets/proxy?url=${encodeURIComponent(url)}&v=2`;
  }
  return url;
}
