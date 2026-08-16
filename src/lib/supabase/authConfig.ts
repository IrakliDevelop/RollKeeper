export interface PublicAuthConfig {
  url: string;
  publishableKey: string;
  turnstileSiteKey?: string;
}

export function getPublicAuthConfig(): PublicAuthConfig | null {
  if (process.env.NEXT_PUBLIC_SUPABASE_AUTH_ENABLED !== 'true') return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;

  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;

  return { url, publishableKey, turnstileSiteKey };
}

export function isAuthEnabled(): boolean {
  return getPublicAuthConfig() !== null;
}
