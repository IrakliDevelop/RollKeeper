import Link from 'next/link';

import { isAuthEnabled } from '@/lib/supabase/authConfig';
import { getServerAuthClaims } from '@/lib/supabase/server';

export async function AccountIndicator() {
  if (!isAuthEnabled()) return null;

  const claims = await getServerAuthClaims();
  const email = typeof claims?.email === 'string' ? claims.email : null;

  return (
    <div className="fixed right-3 bottom-3 z-50 max-w-[min(20rem,calc(100vw-1.5rem))]">
      <Link
        href="/account"
        className="border-divider bg-surface-raised text-heading hover:bg-surface-secondary block truncate rounded-full border px-4 py-2 text-sm shadow-lg transition-colors"
      >
        {email ?? 'Sign in'}
      </Link>
    </div>
  );
}
