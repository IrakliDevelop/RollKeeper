'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/forms/button';

import { signOutWithoutTouchingLegacyStorage } from '@/lib/supabase/authService';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

interface SignOutClient {
  signOut(): Promise<{ error: { message: string } | null }>;
}

interface AccountControlsProps {
  email: string;
  auth?: SignOutClient;
  onSessionChanged?: (destination: string) => void;
}

export function AccountControls({
  email,
  auth,
  onSessionChanged,
}: AccountControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async (destination: string) => {
    const client = auth ?? createSupabaseBrowserClient()?.auth;
    if (!client || pending) return;

    setPending(true);
    setError(null);
    try {
      await signOutWithoutTouchingLegacyStorage(client);
      if (onSessionChanged) {
        onSessionChanged(destination);
      } else {
        router.push(destination);
        router.refresh();
      }
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : 'Could not sign out.'
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted text-sm">Signed in as</p>
        <p className="text-heading font-medium break-all">{email}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/player/backup">Character backups</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={pending}
          onClick={() => handleSignOut('/')}
        >
          Sign out
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => handleSignOut('/account')}
        >
          Switch account
        </Button>
      </div>
      <p className="text-muted text-sm">
        Signing out leaves every character right where it is.
      </p>
      {error && (
        <p role="alert" className="text-accent-red-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
