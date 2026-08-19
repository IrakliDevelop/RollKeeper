'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, RefreshCw, ShieldX } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';

import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import { isHybridGuestUiEnabled } from '@/lib/guestSessionSecurity';

interface DmGuestInvitationControlsProps {
  workspaces: DmWorkspaceDocument[];
}

interface SafeGuestSession {
  sessionId: string;
  legacyPlayerId: string | null;
  expiresAt: string;
  revokedAt: string | null;
}

export function DmGuestInvitationControls({
  workspaces,
}: DmGuestInvitationControlsProps) {
  const available = useMemo(
    () =>
      workspaces.filter(
        workspace => workspace.cloudId && workspace.displayCode
      ),
    [workspaces]
  );
  const [workspaceId, setWorkspaceId] = useState(available[0]?.cloudId ?? '');
  const [playerId, setPlayerId] = useState('');
  const [guestLink, setGuestLink] = useState('');
  const [sessions, setSessions] = useState<SafeGuestSession[]>([]);
  const [busy, setBusy] = useState<'issue' | 'load' | string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (available.some(workspace => workspace.cloudId === workspaceId)) return;
    setWorkspaceId(available[0]?.cloudId ?? '');
  }, [available, workspaceId]);

  if (!isHybridGuestUiEnabled() || available.length === 0) return null;

  const issue = async () => {
    if (!workspaceId) return;
    setBusy('issue');
    setMessage('');
    try {
      const response = await fetch('/api/campaign/guest-invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        },
        body: JSON.stringify({
          campaignId: workspaceId,
          legacyPlayerId: playerId.trim() || null,
          expiresInMinutes: 30,
          maxUses: 1,
        }),
      });
      if (!response.ok) throw new Error('denied');
      const data = (await response.json()) as { redemptionPath: string };
      setGuestLink(new URL(data.redemptionPath, window.location.origin).href);
      setMessage('Invitation issued. Share this one-time link privately.');
    } catch {
      setMessage('Invitation could not be issued.');
    } finally {
      setBusy(null);
    }
  };

  const load = async () => {
    if (!workspaceId) return;
    setBusy('load');
    try {
      const response = await fetch(
        `/api/campaign/guest-invitations?campaignId=${encodeURIComponent(workspaceId)}`
      );
      if (!response.ok) throw new Error('denied');
      const data = (await response.json()) as { sessions?: SafeGuestSession[] };
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      setMessage('Guest access could not be loaded.');
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (sessionId: string) => {
    setBusy(sessionId);
    try {
      const response = await fetch(
        `/api/campaign/guest-sessions/${encodeURIComponent(sessionId)}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-rollkeeper-csrf': '1',
          },
          body: JSON.stringify({ mutationId: crypto.randomUUID() }),
        }
      );
      if (!response.ok) throw new Error('denied');
      setSessions(current =>
        current.map(session =>
          session.sessionId === sessionId
            ? { ...session, revokedAt: new Date().toISOString() }
            : session
        )
      );
      setMessage('Guest session revoked.');
    } catch {
      setMessage('Session revocation failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mb-8" padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound size={20} /> Hybrid guest access
        </CardTitle>
        <CardDescription>
          Issue an expiring, one-use capability. Campaign codes and legacy IDs
          remain identifiers, never credentials.
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-5 space-y-4">
        <SelectField
          label="Cloud workspace"
          value={workspaceId}
          onValueChange={setWorkspaceId}
        >
          {available.map(workspace => (
            <SelectItem key={workspace.cloudId!} value={workspace.cloudId!}>
              {workspace.name} — {workspace.displayCode}
            </SelectItem>
          ))}
        </SelectField>
        <Input
          id="hybrid-guest-player-id"
          label="Bound legacy player ID"
          value={playerId}
          onChange={event => setPlayerId(event.target.value)}
          placeholder="Optional; required for player-specific operations"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={issue} loading={busy === 'issue'}>
            Issue guest invitation
          </Button>
          <Button
            variant="outline"
            leftIcon={<RefreshCw size={15} />}
            onClick={load}
            loading={busy === 'load'}
          >
            Load guest access
          </Button>
        </div>
        {guestLink && (
          <Input
            id="hybrid-guest-link"
            label="One-time guest link"
            value={guestLink}
            readOnly
          />
        )}
        {message && (
          <p role="status" className="text-body text-sm">
            {message}
          </p>
        )}
        {sessions.length > 0 && (
          <div className="border-divider space-y-2 border-t pt-4">
            {sessions.map(session => (
              <div
                key={session.sessionId}
                className="bg-surface-subtle flex flex-wrap items-center justify-between gap-3 rounded-lg p-3"
              >
                <p className="text-body text-sm">
                  {session.legacyPlayerId ?? 'Unbound guest'} ·{' '}
                  {session.revokedAt ? 'revoked' : 'active'}
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<ShieldX size={15} />}
                  disabled={Boolean(session.revokedAt)}
                  loading={busy === session.sessionId}
                  onClick={() => revoke(session.sessionId)}
                >
                  Revoke session
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
