import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database.generated';

import { getPublicAuthConfig } from './authConfig';

export function createSupabaseBrowserClient() {
  const config = getPublicAuthConfig();
  if (!config) return null;

  return createBrowserClient<Database>(config.url, config.publishableKey);
}
