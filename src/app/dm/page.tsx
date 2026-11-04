'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Trash2, Download, CloudCog } from 'lucide-react';
import { useDmStore } from '@/store/dmStore';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Card } from '@/components/ui/layout/card';
import { AppHeader } from '@/components/ui/layout/AppHeader';
import { CopyCodeButton } from '@/components/ui/campaign/CopyCodeButton';
import { CreateCampaignDialog } from '@/components/ui/campaign/CreateCampaignDialog';
import { DmCloudWorkspaceControls } from '@/components/ui/campaign/DmCloudWorkspaceControls';
import { useHydration } from '@/hooks/useHydration';
import {
  campaignSettingsProjectionAuthorityKey,
  campaignSettingsUsesIndexedDbAuthority,
  parseProjectionAuthorityMarker,
} from '@/lib/durableDm/campaignSettingsLegacyProjection';
import { isMigrationWizardVisible } from '@/lib/durableDm/slice11gFlags';
import { CampaignInfo } from '@/types/campaign';
import {
  alertDialog,
  confirmDialog,
} from '@/components/ui/feedback/confirm-dialog';

/**
 * Spec R2b / R8.3: whether this campaign's `campaign_settings` family is
 * CURRENTLY routed off legacy storage (authority `indexedDB` or
 * `postgres`), regardless of whether the `campaign_settings` client flag
 * (`NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE`) happens to be on right now.
 *
 * Deliberately flag-independent, and note WHY.
 *
 * While the family flag is off, `campaignSettingsUsesIndexedDbAuthority`
 * reads through the flag-gated marker reader
 * (`readCampaignSettingsProjectionAuthority`), returns `false`, and the
 * aware storage passes writes through -- so legacy writes are NOT frozen
 * while the flag is off. That is the hazard, not the protection: those
 * writes land in the legacy envelope that the family no longer reads from,
 * and the moment the flag is re-enabled the campaign is authoritative from
 * IndexedDB again and the edits made in between are invisible. So this
 * dashboard must hide the unsafe controls for any campaign that is
 * CURRENTLY ROUTED, whatever the flag says.
 *
 * Currently routed means `indexedDB` or `postgres`; a rolled-back campaign
 * carries `legacy_restored` and is deliberately editable again -- rollback
 * exists to hand the family back to legacy storage. A campaign with no
 * marker at all is untouched.
 *
 * This reuses `campaignSettingsProjectionAuthorityKey` for the storage key
 * and `parseProjectionAuthorityMarker` for shape validation (fix round 1,
 * Minor 3 -- one validated parser, not a hand-rolled divergent copy) but
 * does NOT call `readCampaignSettingsProjectionAuthority` or
 * `campaignSettingsUsesIndexedDbAuthority` -- both are gated on
 * `isCampaignSettingsClientVisible()` and would silently disable this
 * hardening whenever that flag is off.
 */
function campaignSettingsRouted(campaignCode: string): boolean {
  if (typeof window === 'undefined') return false;
  const marker = parseProjectionAuthorityMarker(
    window.localStorage.getItem(
      campaignSettingsProjectionAuthorityKey(campaignCode)
    )
  );
  return marker?.authority === 'indexedDB' || marker?.authority === 'postgres';
}

export default function DmDashboardPage() {
  const { dmId, campaigns, addCampaign, removeCampaign } = useDmStore();
  const hasHydrated = useHydration();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!hasHydrated || campaigns.length === 0) return;

    const fetchPlayerCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        campaigns.map(async c => {
          try {
            const res = await fetch(`/api/campaign/${c.code}/players`);
            if (res.ok) {
              const data = await res.json();
              counts[c.code] = data.players?.length ?? 0;
            }
          } catch {
            // Campaign may have expired in Redis
          }
        })
      );
      setPlayerCounts(counts);
    };

    fetchPlayerCounts();
  }, [hasHydrated, campaigns]);

  const handleCampaignCreated = (code: string, name: string) => {
    addCampaign({
      code,
      name,
      createdAt: new Date().toISOString(),
    });
  };

  const handleDeleteCampaign = async (campaign: CampaignInfo) => {
    const confirmed = await confirmDialog({
      title: `Delete ${campaign.name}?`,
      message: 'It is removed from the server and from your campaign list.',
      confirmLabel: 'Delete campaign',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await fetch(`/api/campaign/${campaign.code}`, { method: 'DELETE' });
    } catch {
      // Redis data may already be gone
    }

    removeCampaign(campaign.code);
  };

  const handleExportCampaign = async (campaign: CampaignInfo) => {
    try {
      const res = await fetch(`/api/campaign/${campaign.code}/players`);
      if (!res.ok) throw new Error('Campaign data not available');
      const data = await res.json();

      const exportData = {
        campaign: {
          code: campaign.code,
          name: campaign.name,
          createdAt: campaign.createdAt,
          exportedAt: new Date().toISOString(),
        },
        players: data.players,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign-${campaign.name.replace(/\s+/g, '-').toLowerCase()}-${campaign.code}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      void alertDialog({
        title: "Couldn't export the campaign",
        message: 'Ask your players to reconnect, then try again.',
      });
    }
  };

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading campaigns…</p>
      </div>
    );
  }

  const totalPlayers = Object.values(playerCounts).reduce(
    (sum, n) => sum + n,
    0
  );
  const openCreateDialog = () => setCreateDialogOpen(true);

  return (
    <div className="bg-surface min-h-screen">
      <AppHeader
        title={<h1 className="type-heading text-heading">Campaigns</h1>}
      />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {campaigns.length === 0 ? (
          <>
            <DmCloudWorkspaceControls campaigns={campaigns} dmId={dmId} />
            <div className="py-12 text-center">
              <h2 className="type-subheading text-heading">
                Create your first campaign
              </h2>
              <p className="type-body text-muted mx-auto mt-2 max-w-md">
                Players join with the campaign code, and their characters appear
                on the campaign page.
              </p>
              <Button
                className="mt-4"
                variant="primary"
                leftIcon={<Plus size={18} aria-hidden />}
                onClick={openCreateDialog}
              >
                Create campaign
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button
                variant="primary"
                leftIcon={<Plus size={18} aria-hidden />}
                onClick={openCreateDialog}
              >
                Create campaign
              </Button>
              <p className="type-small text-muted">
                {`${campaigns.length} ${campaigns.length === 1 ? 'campaign' : 'campaigns'} · ${totalPlayers} ${totalPlayers === 1 ? 'player' : 'players'} connected`}
              </p>
            </div>

            <DmCloudWorkspaceControls campaigns={campaigns} dmId={dmId} />

            <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {campaigns.map(campaign => (
                <CampaignCard
                  key={campaign.code}
                  campaign={campaign}
                  playerCount={playerCounts[campaign.code] ?? 0}
                  onDelete={handleDeleteCampaign}
                  onExport={handleExportCampaign}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <CreateCampaignDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCampaignCreated={handleCampaignCreated}
        dmId={dmId}
      />
    </div>
  );
}

function CampaignCard({
  campaign,
  playerCount,
  onDelete,
  onExport,
}: {
  campaign: CampaignInfo;
  playerCount: number;
  onDelete: (campaign: CampaignInfo) => void;
  onExport: (campaign: CampaignInfo) => void;
}) {
  // Spec R2a: the launcher is flag-gated on the client, but the route it
  // links to (`/dm/migrate/[code]`) independently re-checks the SAME flag,
  // so direct navigation is covered even if this render is ever bypassed.
  const migrationWizardVisible = isMigrationWizardVisible();
  // Once `campaign_settings` is routed off legacy, this campaign has already
  // been through the wizard at least once -- the launcher's copy reflects
  // that instead of inviting the DM to start a migration that already ran.
  //
  // Fix round 1, Minor 5 (coordinator review): `campaignSettingsUsesIndexedDbAuthority`
  // early-returns `false` when the `campaign_settings` family's OWN client
  // flag (`NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE`) is off
  // (`campaignSettingsLegacyProjection.ts`). Harmless here -- this read only
  // picks which LAUNCHER copy to show, and the launcher itself is already
  // gated on the migration wizard's OWN flag above. This is intentionally a
  // DIFFERENT local than the module-level `campaignSettingsRouted` function
  // below: R2b's delete hardening must be independent of the family flag
  // (R8.3), while this launcher-copy read may legitimately fall back to
  // "not yet migrated" copy while the flag is off.
  const campaignSettingsRoutedForLauncherCopy =
    campaignSettingsUsesIndexedDbAuthority(
      typeof window === 'undefined'
        ? { getItem: () => null }
        : window.localStorage,
      campaign.code
    );
  // Spec R2b: flag-independent -- see the `campaignSettingsRouted` doc
  // comment above for why this must not reuse
  // `campaignSettingsUsesIndexedDbAuthority`.
  const routed = campaignSettingsRouted(campaign.code);
  const nameId = `campaign-${campaign.code}-name`;

  return (
    <Card
      data-testid={`campaign-card-${campaign.code}`}
      padding="none"
      className="min-w-0 overflow-hidden"
    >
      {campaign.bannerUrl && (
        <div className="relative h-24 w-full">
          <Image
            src={campaign.bannerUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        </div>
      )}
      <div className="p-4 sm:p-5">
        <h2 id={nameId} className="type-subheading text-heading break-words">
          {campaign.name}
        </h2>
        <p className="type-small text-body mt-1">
          {playerCount} {playerCount === 1 ? 'player' : 'players'} connected
        </p>
        <p className="type-small text-muted mt-1">
          Created {new Date(campaign.createdAt).toLocaleDateString()}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="type-small text-muted">Code</span>
          <CopyCodeButton code={campaign.code} />
          {routed && <Badge variant="success">Synced</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-4">
          {/* Spec R2b: once routed, this campaign's settings are owned by
              the campaign-detail page's IndexedDB-aware controls, not by
              this dashboard -- "Manage" links there instead of offering
              the legacy "Open campaign" affordance. */}
          <Button asChild size="sm" variant={routed ? 'outline' : 'secondary'}>
            <Link
              href={`/dm/campaign/${campaign.code}`}
              aria-describedby={nameId}
            >
              {routed ? 'Manage' : 'Open campaign'}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExport(campaign)}
            aria-label={`Export ${campaign.name}`}
          >
            <Download size={16} aria-hidden />
          </Button>
          {!routed && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete(campaign)}
              aria-label={`Delete ${campaign.name}`}
            >
              <Trash2 size={16} aria-hidden />
            </Button>
          )}
        </div>

        {migrationWizardVisible && (
          <div className="border-divider mt-3 border-t pt-3">
            <Link href={`/dm/migrate/${campaign.code}`}>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                leftIcon={<CloudCog size={15} />}
              >
                {campaignSettingsRoutedForLauncherCopy
                  ? 'Review online backup'
                  : 'Back up campaign online'}
              </Button>
            </Link>
            <p className="text-faint mt-1.5 text-xs">
              {campaignSettingsRoutedForLauncherCopy
                ? 'See what is backed up and finish anything you paused.'
                : 'Save one safety copy, then back up the whole campaign in one guided setup.'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
