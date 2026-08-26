import { NextResponse, type NextRequest } from 'next/server';

import { refreshAuthSession } from '@/lib/supabase/proxy';

const DEV_ONLY_PREFIXES = [
  '/dice-test',
  '/dice-components-demo',
  '/design-system',
  '/test-error',
];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    const { pathname } = request.nextUrl;
    const isDevOnly = DEV_ONLY_PREFIXES.some(
      prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (isDevOnly) return new NextResponse('Not Found', { status: 404 });
  }

  const response = NextResponse.next({ request });
  return refreshAuthSession(request, response);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)',
  ],
};
