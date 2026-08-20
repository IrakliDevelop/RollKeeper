'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Cloud, GitFork } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';

import {
  createBrowserDmWorkspace,
  type BrowserDmWorkspaceContext,
} from '@/lib/supabase/browserDmWorkspace';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import {
  type DmWorkspaceCreateResult,
  isDmWorkspaceCloudEnabled,
} from '@/lib/supabase/dmWorkspaceService';
import type { CampaignInfo } from '@/types/campaign';
import { DmGuestInvitationControls } from './DmGuestInvitationControls';
import { DmCampaignMembershipControls } from './DmCampaignMembershipControls';

interface DmCloudWorkspaceControlsProps {
  campaigns: CampaignInfo[];
  dmId: string;
  cloud?: BrowserDmWorkspaceContext;
}

interface DisplayedResult {
  result: DmWorkspaceCreateResult;
  legacyCode?: string;
}

export function DmCloudWorkspaceControls({
  campaigns,
  dmId,
  cloud,
}: DmCloudWorkspaceControlsProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [displayed, setDisplayed] = useState<DisplayedResult | null>(null);
  const [workspaces, setWorkspaces] = useState<DmWorkspaceDocument[]>([]);
  const ownedContext = useRef<BrowserDmWorkspaceContext | null>(null);

  useEffect(
    () => () => {
      ownedContext.current?.close();
    },
    []
  );

  if (!isDmWorkspaceCloudEnabled()) return null;

  const resolveContext = async () => {
    if (cloud) return cloud;
    ownedContext.current ??= await createBrowserDmWorkspace();
    return ownedContext.current;
  };

  const handleResult = (
    result: DmWorkspaceCreateResult,
    legacyCode?: string
  ) => {
    setDisplayed({ result, legacyCode });
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy('create');
    try {
      const context = await resolveContext();
      handleResult(
        context ? await context.create(trimmed) : { status: 'disabled' }
      );
    } catch {
      handleResult({ status: 'local-failed' });
    } finally {
      setBusy(null);
    }
  };

  const handleLoad = async () => {
    setBusy('load');
    try {
      const context = await resolveContext();
      if (!context) {
        handleResult({ status: 'disabled' });
        return;
      }
      setWorkspaces(await context.list());
    } catch {
      handleResult({ status: 'local-failed' });
    } finally {
      setBusy(null);
    }
  };

  const handleFork = async (campaign: CampaignInfo) => {
    setBusy(campaign.code);
    try {
      const context = await resolveContext();
      handleResult(
        context
          ? await context.forkLegacy(campaign, dmId)
          : { status: 'disabled' },
        campaign.code
      );
    } catch {
      handleResult({ status: 'local-failed' }, campaign.code);
    } finally {
      setBusy(null);
    }
  };

  const created =
    displayed?.result.status === 'created' ? displayed.result.workspace : null;
  const legacyCode = displayed?.legacyCode;

  return (
    <>
      <Card className="mb-8" padding="lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud size={20} /> DM cloud workspace
          </CardTitle>
          <CardDescription>
            Owner-only preview. Creating or forking a workspace changes no
            player, membership, durable-family, Redis, or relay authority.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-5 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                id="dm-cloud-workspace-name"
                label="Cloud workspace name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="e.g. Northwatch"
              />
            </div>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={busy === 'create'}
              disabled={!name.trim()}
            >
              Create cloud workspace
            </Button>
          </div>

          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoad}
              loading={busy === 'load'}
            >
              Load local cloud workspaces
            </Button>
            <p className="text-muted mt-1 text-xs">
              Reads only this signed-in account&apos;s durable local workspace
              records.
            </p>
          </div>

          {workspaces.some(workspace => workspace.displayCode) && (
            <div className="border-divider space-y-2 border-t pt-4">
              <p className="text-heading text-sm font-semibold">
                Local cloud workspaces
              </p>
              {workspaces
                .filter(workspace => workspace.displayCode)
                .map(workspace => (
                  <div
                    key={workspace.localId}
                    className="bg-surface-subtle rounded-lg px-3 py-2"
                  >
                    <p className="text-heading text-sm font-medium">
                      {workspace.name}
                    </p>
                    <p className="text-body font-mono text-sm tracking-widest">
                      {workspace.displayCode}
                    </p>
                  </div>
                ))}
            </div>
          )}

          {campaigns.length > 0 && (
            <div className="border-divider space-y-3 border-t pt-4">
              <p className="text-body text-sm">
                Fork a legacy campaign into a separate owner workspace. The
                original local and Redis campaign stays untouched.
              </p>
              <div className="flex flex-wrap gap-2">
                {campaigns.map(campaign => (
                  <Button
                    key={campaign.code}
                    variant="outline"
                    size="sm"
                    leftIcon={<GitFork size={15} />}
                    loading={busy === campaign.code}
                    onClick={() => handleFork(campaign)}
                  >
                    Fork {campaign.name} to cloud
                  </Button>
                ))}
              </div>
            </div>
          )}

          {created && (
            <div className="border-accent-emerald-border bg-accent-emerald-bg rounded-lg border p-4">
              <p className="text-heading text-sm font-semibold">
                New workspace code
              </p>
              <p className="text-accent-emerald-text mt-1 font-mono text-xl font-bold tracking-widest">
                {created.displayCode}
              </p>
              <p className="text-body mt-2 text-sm">
                Membership remains legacy. Every durable family remains legacy;
                Redis and relay remain unchanged.
              </p>
              {legacyCode && (
                <p className="text-body mt-1 text-sm">
                  Legacy campaign {legacyCode} was not changed. Invitations are
                  not part of this slice.
                </p>
              )}
            </div>
          )}

          {displayed?.result.status === 'queued' && (
            <p role="status" className="text-accent-amber-text text-sm">
              The local request is durable in the outbox. No cloud workspace was
              acknowledged; transmission retry remains disabled in this slice.
            </p>
          )}
          {displayed?.result.status === 'local-failed' && (
            <p role="alert" className="text-accent-red-text text-sm">
              The local transaction failed, so no cloud workspace was created.
            </p>
          )}
          {displayed?.result.status === 'disabled' && (
            <p role="status" className="text-body text-sm">
              <Link href="/account" className="text-link underline">
                Sign in
              </Link>{' '}
              before creating a cloud workspace.
            </p>
          )}
        </CardContent>
      </Card>
      <DmGuestInvitationControls workspaces={workspaces} />
      <DmCampaignMembershipControls workspaces={workspaces} />
    </>
  );
}
