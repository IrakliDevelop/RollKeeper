import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Dev/demo routes that should never be reachable in production. They exist as
 * internal tooling (design-system showcase, dice playgrounds, error-boundary
 * test) and stay available during local development.
 */
const DEV_ONLY_PREFIXES = [
  '/dice-test',
  '/dice-components-demo',
  '/design-system',
  '/test-error',
];

export function middleware(request: NextRequest): NextResponse {
  if (process.env.NODE_ENV === 'production') {
    const { pathname } = request.nextUrl;
    const isDevOnly = DEV_ONLY_PREFIXES.some(
      prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (isDevOnly) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dice-test/:path*',
    '/dice-components-demo/:path*',
    '/design-system/:path*',
    '/test-error/:path*',
  ],
};
