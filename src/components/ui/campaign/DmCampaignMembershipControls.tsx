'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';

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
import { isCampaignMembershipUiEnabled } from '@/lib/campaignMembershipSecurity';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';

interface Props {
  workspaces: DmWorkspaceDocument[];
}

interface ManifestEntry {
  invitationId?: string;
  kind?: string;
  sourceId?: string;
  label?: string;
  accountId?: string;
  characterId?: string;
  status?: string;
  classification?: string | null;
}

interface Readiness {
  version: number;
  fingerprint: string;
  blockerCount: number;
  manifest: {
    legacyRoster?: ManifestEntry[];
    guestSubjects?: ManifestEntry[];
    invitations?: ManifestEntry[];
    acceptedMembers?: ManifestEntry[];
    characterLinks?: ManifestEntry[];
    classifications?: ManifestEntry[];
    removals?: ManifestEntry[];
    blockers?: ManifestEntry[];
  };
}

interface PendingInvitation {
  formKey: string;
  mutationId: string;
  secret: string;
  tokenHash: string;
  expiresAt: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'x-rollkeeper-csrf': '1',
};

export function DmCampaignMembershipControls({ workspaces }: Props) {
  const available = useMemo(
    () =>
      workspaces.filter(
        workspace => workspace.cloudId && workspace.displayCode
      ),
    [workspaces]
  );
  const [workspaceId, setWorkspaceId] = useState(available[0]?.cloudId ?? '');
  const workspace = available.find(item => item.cloudId === workspaceId);
  const [accountId, setAccountId] = useState('');
  const [legacyPlayerId, setLegacyPlayerId] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const [invitationSecret, setInvitationSecret] = useState('');
  const [pendingInvitation, setPendingInvitation] =
    useState<PendingInvitation | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [epoch, setEpoch] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!available.some(item => item.cloudId === workspaceId)) {
      setWorkspaceId(available[0]?.cloudId ?? '');
    }
  }, [available, workspaceId]);

  if (!isCampaignMembershipUiEnabled() || !workspace) return null;

  const post = async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('denied');
    return response.json() as Promise<Record<string, unknown>>;
  };

  const issue = async () => {
    setBusy('issue');
    setMessage('');
    try {
      const formKey = JSON.stringify({
        workspaceId,
        accountId: accountId.trim(),
        legacyPlayerId: legacyPlayerId.trim() || null,
      });
      let pending =
        pendingInvitation?.formKey === formKey ? pendingInvitation : null;
      if (!pending) {
        const secretBytes = crypto.getRandomValues(new Uint8Array(32));
        const secret = Array.from(secretBytes, value =>
          value.toString(16).padStart(2, '0')
        ).join('');
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(secret)
        );
        const tokenHash = Array.from(new Uint8Array(digest), value =>
          value.toString(16).padStart(2, '0')
        ).join('');
        pending = {
          formKey,
          mutationId: crypto.randomUUID(),
          secret,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        };
        setPendingInvitation(pending);
      }
      const data = await post('/api/campaign/membership-invitations', {
        mutationId: pending.mutationId,
        tokenHash: pending.tokenHash,
        campaignId: workspace.cloudId,
        invitedAccountId: accountId.trim(),
        legacyPlayerId: legacyPlayerId.trim() || null,
        guestSubjectId: null,
        expiresAt: pending.expiresAt,
        maxUses: 1,
        role: 'player',
      });
      setInvitationLink(
        new URL(String(data.acceptancePath), window.location.origin).href
      );
      setInvitationSecret(pending.secret);
      setPendingInvitation(null);
      setMessage(
        'Account-bound invitation issued. Acceptance will not upload or link a character.'
      );
    } catch {
      setMessage('Membership invitation could not be issued.');
    } finally {
      setBusy('');
    }
  };

  const refresh = async () => {
    setBusy('refresh');
    setMessage('');
    try {
      await post('/api/campaign/membership-readiness', {
        action: 'refresh',
        campaignId: workspace.cloudId,
        displayCode: workspace.displayCode,
      });
      const data = await post('/api/campaign/membership-readiness', {
        action: 'prepare',
        campaignId: workspace.cloudId,
        mutationId: crypto.randomUUID(),
      });
      setReadiness(data as unknown as Readiness);
      setConfirmation('');
      setMessage(
        Number(data.blockerCount) === 0
          ? 'Readiness manifest is complete and current.'
          : `${String(data.blockerCount)} readiness blocker(s) remain.`
      );
    } catch {
      setMessage('Readiness refresh was denied or changed concurrently.');
    } finally {
      setBusy('');
    }
  };

  const classify = async (
    entry: ManifestEntry,
    classification: 'abandoned' | 'duplicate'
  ) => {
    if (!entry.kind || !entry.sourceId) return;
    setBusy(`${entry.kind}:${entry.sourceId}`);
    try {
      await post('/api/campaign/membership-readiness', {
        action: 'classify',
        campaignId: workspace.cloudId,
        mutationId: crypto.randomUUID(),
        entryKind: entry.kind,
        sourceId: entry.sourceId,
        classification,
      });
      await refresh();
    } catch {
      setMessage('Classification was denied or stale.');
      setBusy('');
    }
  };

  const revoke = async (entry: ManifestEntry) => {
    if (!entry.invitationId) return;
    setBusy(`revoke:${entry.invitationId}`);
    setMessage('');
    try {
      const response = await fetch('/api/campaign/membership-invitations', {
        method: 'DELETE',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          mutationId: crypto.randomUUID(),
          invitationId: entry.invitationId,
        }),
      });
      if (!response.ok) throw new Error('denied');
      await refresh();
    } catch {
      setMessage('Membership invitation revocation was denied.');
      setBusy('');
    }
  };

  const cutover = async () => {
    if (!readiness || confirmation !== readiness.fingerprint) return;
    setBusy('cutover');
    try {
      const data = await post('/api/campaign/membership-readiness', {
        action: 'cutover',
        campaignId: workspace.cloudId,
        mutationId: crypto.randomUUID(),
        fingerprint: readiness.fingerprint,
        version: readiness.version,
      });
      setEpoch(Number(data.epoch));
      setMessage(
        `Membership authority is Postgres at epoch ${String(data.epoch)}. Redis live runtime and every DM family are unchanged.`
      );
    } catch {
      setMessage(
        'Cutover failed before commit or the manifest became stale. Hybrid access remains available.'
      );
    } finally {
      setBusy('');
    }
  };

  const rollback = async () => {
    if (!readiness || epoch === null) return;
    setBusy('rollback');
    try {
      const data = await post('/api/campaign/membership-readiness', {
        action: 'rollback',
        campaignId: workspace.cloudId,
        mutationId: crypto.randomUUID(),
        expectedEpoch: epoch,
        generation: readiness.manifest,
        generationFingerprint: readiness.fingerprint,
      });
      setEpoch(Number(data.epoch));
      setMessage(
        `Verified rollback created legacy authority epoch ${String(data.epoch)}. No source was deleted.`
      );
    } catch {
      setMessage(
        'Rollback was denied because the generation was not verified and complete.'
      );
    } finally {
      setBusy('');
    }
  };

  const sections: Array<[string, ManifestEntry[]]> = readiness
    ? [
        [
          'Legacy roster and shadow entries',
          readiness.manifest.legacyRoster ?? [],
        ],
        ['Guest subjects', readiness.manifest.guestSubjects ?? []],
        ['Invitations', readiness.manifest.invitations ?? []],
        ['Accepted members', readiness.manifest.acceptedMembers ?? []],
        ['Character links', readiness.manifest.characterLinks ?? []],
        ['Classifications', readiness.manifest.classifications ?? []],
        ['Removals and tombstones', readiness.manifest.removals ?? []],
        ['Blockers', readiness.manifest.blockers ?? []],
      ]
    : [];

  return (
    <Card className="mb-8" padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck size={20} /> Optional campaign membership
        </CardTitle>
        <CardDescription>
          Default-off account membership. One unready participant keeps this
          campaign hybrid indefinitely.
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-5 space-y-5">
        <SelectField
          label="Cloud workspace"
          value={workspaceId}
          onValueChange={setWorkspaceId}
        >
          {available.map(item => (
            <SelectItem key={item.cloudId!} value={item.cloudId!}>
              {item.name} — {item.displayCode}
            </SelectItem>
          ))}
        </SelectField>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            id="membership-account-id"
            label="Invited account ID"
            value={accountId}
            onChange={event => setAccountId(event.target.value)}
          />
          <Input
            id="membership-legacy-player-id"
            label="Intended legacy player ID"
            value={legacyPlayerId}
            onChange={event => setLegacyPlayerId(event.target.value)}
          />
        </div>
        <Button
          variant="primary"
          leftIcon={<UserPlus size={15} />}
          loading={busy === 'issue'}
          disabled={!accountId.trim()}
          onClick={issue}
        >
          Issue account invitation
        </Button>
        {invitationLink && (
          <Input
            id="membership-invitation-link"
            label="Account invitation page (contains no secret)"
            value={invitationLink}
            readOnly
          />
        )}
        {invitationSecret && (
          <Input
            id="membership-invitation-secret"
            label="One-time invitation secret (share separately)"
            value={invitationSecret}
            readOnly
          />
        )}
        <div className="border-divider border-t pt-4">
          <Button
            variant="outline"
            leftIcon={<RefreshCw size={15} />}
            loading={busy === 'refresh'}
            onClick={refresh}
          >
            Refresh exact readiness manifest
          </Button>
        </div>
        {sections.map(([label, entries]) => (
          <section
            key={label}
            aria-label={label}
            className="bg-surface-subtle rounded-lg p-3"
          >
            <h3 className="text-heading text-sm font-semibold">
              {label} ({entries.length})
            </h3>
            {entries.map((entry, index) => (
              <div
                key={`${entry.kind ?? label}:${entry.invitationId ?? entry.sourceId ?? entry.accountId ?? entry.characterId ?? index}`}
                className="text-body mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span>
                  {entry.label ??
                    entry.sourceId ??
                    entry.accountId ??
                    entry.characterId ??
                    entry.status ??
                    'Recorded entry'}
                </span>
                {(label === 'Legacy roster and shadow entries' ||
                  label === 'Guest subjects') &&
                  entry.classification == null &&
                  entry.kind &&
                  entry.sourceId && (
                    <span className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => classify(entry, 'abandoned')}
                      >
                        Classify abandoned
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => classify(entry, 'duplicate')}
                      >
                        Classify duplicate
                      </Button>
                    </span>
                  )}
                {label === 'Invitations' &&
                  entry.status === 'pending' &&
                  entry.invitationId && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busy === `revoke:${entry.invitationId}`}
                      onClick={() => revoke(entry)}
                    >
                      Revoke invitation
                    </Button>
                  )}
              </div>
            ))}
          </section>
        ))}
        {readiness && epoch === null && (
          <div className="border-divider space-y-3 border-t pt-4">
            <p className="text-body text-xs break-all">
              Manifest fingerprint: {readiness.fingerprint}
            </p>
            <Input
              id="membership-manifest-confirmation"
              label="Confirm exact manifest fingerprint"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
            />
            <Button
              variant="warning"
              loading={busy === 'cutover'}
              disabled={
                readiness.blockerCount !== 0 ||
                confirmation !== readiness.fingerprint
              }
              onClick={cutover}
            >
              Confirm atomic membership cutover
            </Button>
          </div>
        )}
        {epoch !== null && readiness && (
          <Button
            variant="danger"
            loading={busy === 'rollback'}
            onClick={rollback}
          >
            Create verified rollback epoch
          </Button>
        )}
        {message && (
          <p role="status" className="text-body text-sm">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
