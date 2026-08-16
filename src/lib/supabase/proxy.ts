import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/types/database.generated';

import { getPublicAuthConfig } from './authConfig';

export async function refreshAuthSession(
  request: NextRequest,
  initialResponse: NextResponse
): Promise<NextResponse> {
  const config = getPublicAuthConfig();
  if (!config) return initialResponse;

  let response = initialResponse;
  const supabase = createServerClient<Database>(
    config.url,
    config.publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    }
  );

  await supabase.auth.getClaims();
  return response;
}
