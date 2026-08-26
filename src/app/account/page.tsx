import Link from 'next/link';

import { AccountControls } from '@/components/auth/AccountControls';
import { AuthPageClient } from '@/components/auth/AuthPageClient';
import { Button } from '@/components/ui/forms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';

import { isAuthEnabled } from '@/lib/supabase/authConfig';
import { getServerAuthClaims } from '@/lib/supabase/server';

const PLAYER_BACKUP_RETURN_PATH = '/player/backup';

export function safeAccountReturnTo(value: unknown): string | null {
  return value === PLAYER_BACKUP_RETURN_PATH ? PLAYER_BACKUP_RETURN_PATH : null;
}

export default async function AccountPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
} = {}) {
  const returnTo = safeAccountReturnTo((await searchParams).returnTo);
  const claims = isAuthEnabled() ? await getServerAuthClaims() : null;
  const email = typeof claims?.email === 'string' ? claims.email : null;

  return (
    <main className="bg-surface min-h-screen px-4 py-12">
      <div className="mx-auto max-w-lg space-y-5">
        <Button variant="ghost" asChild>
          <Link href={returnTo ?? '/'}>
            {returnTo ? 'Back to character backup' : 'Back to RollKeeper'}
          </Link>
        </Button>
        <Card padding="lg">
          <CardHeader>
            <CardTitle>RollKeeper account</CardTitle>
            <CardDescription>
              Signing in changes only your account session. Your local
              characters, campaigns, maps, and recovery data stay on this
              browser and are never uploaded or claimed here.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-6">
            {email ? (
              <AccountControls email={email} />
            ) : (
              <AuthPageClient returnTo={returnTo} />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
