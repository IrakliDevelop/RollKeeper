'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogIn, LogOut, RefreshCw, Shield } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';

import { getPublicAuthConfig } from '@/lib/supabase/authConfig';
import { signOutWithoutTouchingLegacyStorage } from '@/lib/supabase/authService';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

import { SignInDialog } from './SignInDialog';

interface AccountFeedback {
  message: string;
  tone: 'success' | 'error';
}

export function accountInitials(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

export function AccountHeaderEntry() {
  if (getPublicAuthConfig() === null) return null;
  return <AccountHeaderSession />;
}

function AccountHeaderSession() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<AccountFeedback | null>(null);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) {
      setReady(true);
      return;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  if (!ready) return <div className="h-9 w-24" aria-hidden="true" />;

  const handleSignOut = async (switchAccount: boolean) => {
    const client = createSupabaseBrowserClient()?.auth;
    if (!client || pending) return;

    setPending(true);
    setMenuOpen(false);
    setFeedback(null);
    try {
      await signOutWithoutTouchingLegacyStorage(client);
      setEmail(null);
      router.refresh();
      if (switchAccount) {
        setSignInOpen(true);
      } else {
        setFeedback({
          message: 'Signed out. All your characters are still here.',
          tone: 'success',
        });
      }
    } catch {
      setFeedback({
        message:
          'RollKeeper could not confirm sign-out with the account service. Check your connection before continuing.',
        tone: 'error',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {email ? (
        <>
          <button
            type="button"
            className="border-divider bg-surface-raised text-heading hover:bg-surface-hover inline-flex h-9 items-center gap-2 rounded-full border py-0 pr-2 pl-1 text-sm font-medium"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(open => !open)}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 text-xs font-bold text-white">
              {accountInitials(email)}
            </span>
            <span className="max-w-[168px] truncate">{email}</span>
            <ChevronDown
              className={`text-muted mr-1 h-4 w-4 transition-transform duration-150 ${
                menuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="border-divider bg-surface-raised absolute top-[52px] right-0 z-50 w-[292px] rounded-xl border p-2 shadow-xl"
            >
              <div className="border-divider flex items-center gap-2.5 border-b px-2.5 pt-2.5 pb-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 text-[13px] font-bold text-white">
                  {accountInitials(email)}
                </span>
                <div className="min-w-0">
                  <p className="text-heading truncate text-[13px] font-semibold">
                    {email}
                  </p>
                  <p className="text-accent-emerald-text mt-0.5 flex items-center gap-1.5 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Signed in on this browser
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-0.5 pt-1.5">
                <Link
                  href="/player/backup"
                  role="menuitem"
                  className="text-heading hover:bg-surface-hover flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  <Shield className="text-muted h-4 w-4" />
                  Character backups
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="text-heading hover:bg-surface-hover flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium"
                  disabled={pending}
                  onClick={() => void handleSignOut(true)}
                >
                  <RefreshCw className="text-muted h-4 w-4" />
                  Switch account
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="text-accent-red-text hover:bg-accent-red-bg flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium"
                  disabled={pending}
                  onClick={() => void handleSignOut(false)}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
                <p className="text-muted mx-2.5 mt-1.5 mb-1 text-xs leading-snug">
                  Signing out leaves every character right where it is.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="rounded-full"
          leftIcon={<LogIn className="h-4 w-4" />}
          onClick={() => setSignInOpen(true)}
        >
          Sign in
        </Button>
      )}

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />

      {feedback && (
        <div
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-label={feedback.message}
          className={`pointer-events-none fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2.5 rounded-full border px-[18px] py-2.5 shadow-xl ${
            feedback.tone === 'error'
              ? 'border-accent-red-border bg-accent-red-bg text-accent-red-text'
              : 'border-divider bg-heading text-surface'
          }`}
        >
          <span className="text-[13px]">{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
