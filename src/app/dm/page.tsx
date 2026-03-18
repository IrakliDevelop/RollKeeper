'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Crown,
  Users,
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  Clock,
  Download,
} from 'lucide-react';
import { useDmStore } from '@/store/dmStore';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CreateCampaignDialog } from '@/components/ui/campaign/CreateCampaignDialog';
import { BannerUpload } from '@/components/ui/campaign/BannerUpload';
import { useHydration } from '@/hooks/useHydration';
import { CampaignInfo } from '@/types/campaign';

export default function DmDashboardPage() {
  const { dmId, campaigns, addCampaign, removeCampaign, updateCampaign } =
    useDmStore();
  const hasHydrated = useHydration();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
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
    if (
      !confirm(
        `Are you sure you want to delete "${campaign.name}"? This will remove it from Redis and your local list.`
      )
    )
      return;

    try {
      await fetch(`/api/campaign/${campaign.code}`, { method: 'DELETE' });
    } catch {
      // Redis data may already be gone
    }

    removeCampaign(campaign.code);
  };

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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
      alert(
        'Could not export campaign data. The campaign may have expired in Redis — players need to re-sync.'
      );
    }
  };

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <div className="text-muted animate-pulse">Loading...</div>
      </div>
    );
  }

  const totalPlayers = Object.values(playerCounts).reduce(
    (sum, n) => sum + n,
    0
  );

  return (
    <div className="bg-surface min-h-screen">
      <header className="border-divider bg-surface-secondary border-b shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  Back to Home
                </Button>
              </Link>
              <div className="ml-6 flex items-center">
                <Crown className="mr-3 h-6 w-6 text-purple-600 dark:text-purple-400" />
                <h1 className="text-heading text-xl font-bold">DM Dashboard</h1>
              </div>
            </div>
            <ThemeToggle showSystemOption />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-heading mb-2 text-3xl font-bold">
              Your Campaigns
            </h1>
            <p className="text-body">
              Create and manage campaigns, track your players in real time
            </p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus size={18} />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Campaign
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="border-accent-purple-border bg-accent-purple-bg rounded-lg border-2 p-6 shadow-md">
            <div className="flex items-center">
              <Crown className="text-accent-purple-text-muted mr-3 h-8 w-8" />
              <div>
                <h3
                  className="text-heading text-2xl font-bold"
                  suppressHydrationWarning
                >
                  {campaigns.length}
                </h3>
                <p className="text-body">Active Campaigns</p>
              </div>
            </div>
          </div>

          <div className="border-accent-blue-border bg-accent-blue-bg rounded-lg border-2 p-6 shadow-md">
            <div className="flex items-center">
              <Users className="text-accent-blue-text-muted mr-3 h-8 w-8" />
              <div>
                <h3
                  className="text-heading text-2xl font-bold"
                  suppressHydrationWarning
                >
                  {totalPlayers}
                </h3>
                <p className="text-body">Total Players</p>
              </div>
            </div>
          </div>

          <div className="border-divider bg-surface-secondary rounded-lg border-2 p-6 shadow-md">
            <div className="flex items-center">
              <Clock className="text-muted mr-3 h-8 w-8" />
              <div>
                <h3
                  className="text-heading text-2xl font-bold"
                  suppressHydrationWarning
                >
                  {campaigns.length > 0
                    ? new Date(
                        campaigns[campaigns.length - 1].createdAt
                      ).toLocaleDateString()
                    : '—'}
                </h3>
                <p className="text-body">Latest Campaign</p>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Grid */}
        {campaigns.length === 0 ? (
          <div className="border-accent-purple-border bg-accent-purple-bg rounded-lg border-2 p-12 text-center shadow-md">
            <Crown size={64} className="text-faint mx-auto mb-6" />
            <h3 className="text-heading mb-2 text-xl font-semibold">
              No Campaigns Yet
            </h3>
            <p className="text-body mb-6">
              Create your first campaign and invite your players to sync their
              characters.
            </p>
            <Button
              variant="primary"
              leftIcon={<Plus size={20} />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map(campaign => (
              <CampaignCard
                key={campaign.code}
                campaign={campaign}
                playerCount={playerCounts[campaign.code] ?? 0}
                copiedCode={copiedCode}
                onCopyCode={handleCopyCode}
                onDelete={handleDeleteCampaign}
                onExport={handleExportCampaign}
                onBannerChange={url =>
                  updateCampaign(campaign.code, { bannerUrl: url })
                }
              />
            ))}
          </div>
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
  copiedCode,
  onCopyCode,
  onDelete,
  onExport,
  onBannerChange,
}: {
  campaign: CampaignInfo;
  playerCount: number;
  copiedCode: string | null;
  onCopyCode: (code: string) => void;
  onDelete: (campaign: CampaignInfo) => void;
  onExport: (campaign: CampaignInfo) => void;
  onBannerChange: (url: string | undefined) => void;
}) {
  return (
    <div className="border-accent-purple-border bg-surface-raised hover:bg-surface-secondary rounded-lg border-2 shadow-md transition-all hover:shadow-xl">
      <BannerUpload
        bannerUrl={campaign.bannerUrl}
        campaignCode={campaign.code}
        onBannerChange={onBannerChange}
        variant="card"
      />
      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-heading mb-2 text-xl font-semibold">
            {campaign.name}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCopyCode(campaign.code)}
              className="cursor-pointer"
              title="Click to copy code"
            >
              <Badge variant="info" className="font-mono tracking-wider">
                {campaign.code}
              </Badge>
            </button>
            {copiedCode === campaign.code && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check size={12} /> Copied
              </span>
            )}
          </div>
        </div>

        <div className="text-body mb-4 space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-muted" />
            <span>
              {playerCount} player{playerCount !== 1 ? 's' : ''} connected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-muted" />
            <span>
              Created {new Date(campaign.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dm/campaign/${campaign.code}`} className="flex-1">
            <Button variant="secondary" fullWidth>
              Open Campaign
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExport(campaign)}
            title="Export Campaign"
          >
            <Download size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(campaign)}
            title="Delete Campaign"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
