'use client';

import { useEffect, useState } from 'react';
import { Link2, UserCheck, UserX } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';
import { isCampaignMembershipUiEnabled } from '@/lib/campaignMembershipSecurity';

export function MembershipInvitationPage() {
  const enabled = isCampaignMembershipUiEnabled();
  const [token, setToken] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [legacyPlayerId, setLegacyPlayerId] = useState('');
  const [legacyCharacterId, setLegacyCharacterId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void fetch('/api/campaign/membership-links', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return;
        const data = (await response.json()) as {
          memberships?: Array<{ campaignId?: string }>;
        };
        const restoredCampaignId = data.memberships?.[0]?.campaignId;
        if (current && restoredCampaignId) setCampaignId(restoredCampaignId);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [enabled]);

  if (!enabled) return null;

  const respond = async (decision: 'accepted' | 'refused') => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        '/api/campaign/membership-invitations/respond',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rollkeeper-csrf': '1',
          },
          body: JSON.stringify({
            invitationToken: token,
            mutationId: crypto.randomUUID(),
            decision,
          }),
        }
      );
      if (!response.ok) throw new Error('denied');
      const data = (await response.json()) as { campaignId?: string };
      setToken('');
      if (decision === 'accepted' && data.campaignId) {
        setCampaignId(data.campaignId);
        setStatus(
          'Membership accepted. No character was uploaded, claimed, hidden, or linked.'
        );
      } else {
        setStatus('Membership invitation refused.');
      }
    } catch {
      setError(
        'Invitation is invalid, expired, revoked, exhausted, or belongs to another account.'
      );
    } finally {
      setBusy(false);
    }
  };

  const linkCharacter = async () => {
    if (!campaignId || !characterId.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/campaign/membership-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        },
        body: JSON.stringify({
          mutationId: crypto.randomUUID(),
          campaignId,
          characterId: characterId.trim(),
          legacyPlayerId: legacyPlayerId.trim() || null,
          legacyCharacterId: legacyCharacterId.trim() || null,
          guestSubjectId: null,
        }),
      });
      if (!response.ok) throw new Error('denied');
      setStatus(
        'Cloud character explicitly linked. Local character data was not uploaded or transferred.'
      );
    } catch {
      setError(
        'Character link was denied. The character must already be owned by this account.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="bg-surface flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl" padding="lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck size={20} /> Campaign membership
          </CardTitle>
          <CardDescription>
            Acceptance is account-bound. It never uploads a local character or
            transfers ownership.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-5 space-y-4">
          {!campaignId && (
            <div className="space-y-3">
              <Input
                id="membership-invitation-secret"
                label="Invitation secret"
                type="password"
                autoComplete="off"
                value={token}
                onChange={event => setToken(event.target.value.trim())}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="success"
                  leftIcon={<UserCheck size={15} />}
                  loading={busy}
                  disabled={!token}
                  onClick={() => respond('accepted')}
                >
                  Accept membership
                </Button>
                <Button
                  variant="danger"
                  leftIcon={<UserX size={15} />}
                  disabled={busy || !token}
                  onClick={() => respond('refused')}
                >
                  Refuse invitation
                </Button>
              </div>
            </div>
          )}
          {campaignId && (
            <div className="border-divider space-y-3 border-t pt-4">
              <p className="text-body text-sm">
                Accepted campaign {campaignId}
              </p>
              <p className="text-body text-sm">
                Linking is a separate explicit step and accepts only an existing
                cloud character owned by this account.
              </p>
              <Input
                id="membership-cloud-character"
                label="Cloud character ID"
                value={characterId}
                onChange={event => setCharacterId(event.target.value)}
              />
              <Input
                id="membership-legacy-player"
                label="Legacy player ID"
                value={legacyPlayerId}
                onChange={event => setLegacyPlayerId(event.target.value)}
              />
              <Input
                id="membership-legacy-character"
                label="Legacy character ID"
                value={legacyCharacterId}
                onChange={event => setLegacyCharacterId(event.target.value)}
              />
              <Button
                variant="primary"
                leftIcon={<Link2 size={15} />}
                loading={busy}
                disabled={!characterId.trim()}
                onClick={linkCharacter}
              >
                Link this cloud character
              </Button>
            </div>
          )}
          {status && (
            <p role="status" className="text-body text-sm">
              {status}
            </p>
          )}
          {error && (
            <p role="alert" className="text-accent-red-text text-sm">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
