/**
 * URL and S3-key builders for bestiary monster token images.
 *
 * 5etools serves token art at
 *   https://5e.tools/img/bestiary/tokens/{SOURCE}/{Name}.webp
 * using the RAW source code (XMM, FTD, RHW…). Our API route mirrors that
 * layout in S3 under bestiary-tokens/ and proxies/caches lazily.
 */

/** Root-relative URL for a monster's token, served by our caching route. */
export function bestiaryTokenUrl(tokenSource: string, name: string): string {
  return `/api/bestiary/token/${encodeURIComponent(tokenSource)}/${encodeURIComponent(name)}`;
}

/** Upstream 5e.tools token image URL. */
export function fiveEToolsTokenUrl(source: string, name: string): string {
  return `https://5e.tools/img/bestiary/tokens/${encodeURIComponent(source)}/${encodeURIComponent(name)}.webp`;
}

/** S3 object key mirroring the 5etools layout (keys may contain spaces). */
export function tokenS3Key(source: string, name: string): string {
  return `bestiary-tokens/${source}/${name}.webp`;
}

/** Source codes are alphanumeric with hyphens (e.g. XMM, AitFR-DN). */
export function isValidTokenSource(source: string): boolean {
  return /^[A-Za-z0-9-]+$/.test(source);
}
