'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, RefreshCw, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';

import { isHybridGuestUiEnabled } from '@/lib/guestSessionSecurity';

interface GuestSessionView {
  sessionId: string;
  displayCode: string;
  legacyPlayerId: string | null;
  scopes: string[];
  expiresAt: string;
}

export function GuestRedemptionPage() {
  const enabled = isHybridGuestUiEnabled();
  const [session, setSession] = useState<GuestSessionView | null>(null);
  const [playerState, setPlayerState] = useState('');
  const [status, setStatus] = useState(enabled ? 'Redeeming invitation…' : '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    const invitationToken = new URLSearchParams(url.hash.slice(1)).get(
      'invite'
    );
    window.history.replaceState(null, '', '/guest');
    if (!invitationToken) {
      setStatus('Open the invitation link supplied by your DM.');
      return;
    }
    const mutationId = crypto.randomUUID();
    void fetch('/api/campaign/guest-session/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rollkeeper-csrf': '1',
      },
      body: JSON.stringify({ invitationToken, mutationId }),
    })
      .then(async response => {
        if (!response.ok) throw new Error('denied');
        return (await response.json()) as { session: GuestSessionView };
      })
      .then(data => {
        setSession(data.session);
        setStatus('Guest session is active.');
      })
      .catch(() => {
        setError('Invitation is invalid, expired, used, or revoked.');
        setStatus('');
      });
  }, [enabled]);

  if (!enabled) return null;

  const viewPlayer = async () => {
    if (!session?.legacyPlayerId) return;
    const response = await fetch(
      `/api/campaign/${encodeURIComponent(session.displayCode)}/players/${encodeURIComponent(session.legacyPlayerId)}`
    );
    if (!response.ok) {
      setError('The bound player state is unavailable.');
      return;
    }
    const data = (await response.json()) as {
      player?: { characterName?: string; character?: { revision?: number } };
    };
    setPlayerState(
      `${data.player?.characterName ?? 'Bound player'} · revision ${data.player?.character?.revision ?? 0}`
    );
  };

  const rotate = async () => {
    if (!session) return;
    const response = await fetch('/api/campaign/guest-session/rotate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rollkeeper-csrf': '1',
      },
      body: JSON.stringify({
        displayCode: session.displayCode,
        mutationId: crypto.randomUUID(),
      }),
    });
    if (!response.ok) {
      setError('Session rotation was denied.');
      return;
    }
    const data = (await response.json()) as { session: GuestSessionView };
    setSession(data.session);
    setStatus('Session rotated; the prior cookie is invalid.');
  };

  return (
    <main className="bg-surface flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl" padding="lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound size={20} /> Guest campaign access
          </CardTitle>
          <CardDescription>
            This browser receives a scoped HttpOnly session. The invitation is
            removed from the address bar before redemption.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-5 space-y-4">
          {status && (
            <p role="status" className="text-accent-emerald-text text-sm">
              {status}
            </p>
          )}
          {error && (
            <p role="alert" className="text-accent-red-text text-sm">
              {error}
            </p>
          )}
          {session && (
            <div className="bg-surface-subtle space-y-2 rounded-lg p-4">
              <p className="text-heading font-semibold">
                Campaign {session.displayCode}
              </p>
              <p className="text-body text-sm">
                {session.legacyPlayerId
                  ? `Bound player: ${session.legacyPlayerId}`
                  : 'No player identity is bound to this session.'}
              </p>
              <p className="text-muted text-xs">
                {session.scopes.length} allowlisted operations · expires{' '}
                {new Date(session.expiresAt).toLocaleString()}
              </p>
            </div>
          )}
          {playerState && <p className="text-body text-sm">{playerState}</p>}
          <div className="flex flex-wrap gap-2">
            {session?.legacyPlayerId && (
              <Button
                variant="outline"
                leftIcon={<UserRound size={15} />}
                onClick={viewPlayer}
              >
                View safe player state
              </Button>
            )}
            {session && (
              <Button
                variant="secondary"
                leftIcon={<RefreshCw size={15} />}
                onClick={rotate}
              >
                Rotate guest session
              </Button>
            )}
            <Link href="/player">
              <Button variant="ghost">Continue to player area</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
