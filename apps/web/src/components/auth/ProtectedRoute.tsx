'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/forms/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/layout/card';
import { Shield, LogIn, UserPlus, ArrowLeft } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Where to send the user if they choose to sign in */
  signInRedirect?: string;
  /** If true, shows a friendly prompt instead of auto-redirecting */
  softGuard?: boolean;
}

/**
 * Wraps pages that require authentication.
 *
 * - Default behavior: shows a friendly "sign in to continue" screen
 *   with options to go back, sign in, or sign up.
 * - Does NOT auto-redirect — the user chose a local-first experience,
 *   so we respect that and let them decide.
 */
export function ProtectedRoute({
  children,
  signInRedirect,
  softGuard = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuthContext();
  const router = useRouter();

  const returnTo =
    signInRedirect ??
    (typeof window !== 'undefined' ? window.location.pathname : '/dm');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-amber-400" />
          <p className="text-sm text-slate-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md border-slate-700 bg-slate-800/80 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
              <Shield size={28} className="text-amber-400" />
            </div>
            <CardTitle className="text-xl font-bold text-white">
              Account Required
            </CardTitle>
            <CardDescription className="text-slate-400">
              You need to sign in to access campaign and DM features. Character
              sheets work without an account!
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              <Link
                href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
                className="block"
              >
                <Button variant="primary" className="w-full">
                  <LogIn size={16} className="mr-2" />
                  Sign In
                </Button>
              </Link>
              <Link
                href={`/auth/signup?returnTo=${encodeURIComponent(returnTo)}`}
                className="block"
              >
                <Button variant="outline" className="w-full">
                  <UserPlus size={16} className="mr-2" />
                  Create Account
                </Button>
              </Link>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center pt-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-300"
            >
              <ArrowLeft size={14} />
              Go back
            </button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
