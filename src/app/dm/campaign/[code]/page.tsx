'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Crown, Copy, Check, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PlayerSummaryCard } from '@/components/ui/campaign/PlayerSummaryCard';
import { useCampaignSync } from '@/hooks/useCampaignSync';
import { useDmStore } from '@/store/dmStore';
import { ToastContainer, useToast } from '@/components/ui/feedback/Toast';

export default function CampaignViewPage() {
  const params = useParams();
  const code = params.code as string;

  const { dmId, getCampaign } = useDmStore();
  const localCampaign = getCampaign(code);

  const { players, campaignName, loading, error, lastFetched, refresh } =
    useCampaignSync({
      code,
      dmId,
      campaignName: localCampaign?.name ?? 'Campaign',
      createdAt: localCampaign?.createdAt ?? new Date().toISOString(),
      interval: 10000,
    });

  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toasts, addToast, dismissToast } = useToast();
  const knownPlayerIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;

    const currentIds = new Set(players.map(p => p.playerId));
    const known = knownPlayerIdsRef.current;

    if (known.size > 0) {
      for (const player of players) {
        if (!known.has(player.playerId)) {
          addToast({
            type: 'info',
            title: 'Player Joined',
            message: `${player.characterName} (${player.playerName}) has joined the campaign.`,
            duration: 6000,
          });
        }
      }
    }

    knownPlayerIdsRef.current = currentIds;
  }, [players, loading, addToast]);

  const displayName = campaignName || localCampaign?.name || 'Campaign';

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <div className="bg-surface min-h-screen">
      <header className="border-divider bg-surface-secondary border-b shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/dm">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  Back to Dashboard
                </Button>
              </Link>
              <div className="ml-6 flex items-center gap-3">
                <Crown className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <h1 className="text-heading text-xl font-bold">
                  {displayName}
                </h1>
                <button
                  onClick={handleCopyCode}
                  title="Click to copy campaign code"
                  className="cursor-pointer"
                >
                  <Badge variant="info" className="font-mono tracking-wider">
                    {code}
                  </Badge>
                </button>
                {copied && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <Check size={12} /> Copied
                  </span>
                )}
              </div>
            </div>
            <ThemeToggle showSystemOption />
          </div>
        </div>
      </header>

      {/* Sync Status Bar */}
      <div className="border-divider border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-muted text-sm">
              Auto-refreshing every 10s
              {lastFetched && (
                <span className="ml-2">
                  · Last updated {lastFetched.toLocaleTimeString()}
                </span>
              )}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            leftIcon={
              <RefreshCw
                size={14}
                className={refreshing ? 'animate-spin' : ''}
              />
            }
          >
            Refresh Now
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted animate-pulse text-lg">
              Loading campaign data...
            </div>
          </div>
        ) : error ? (
          <div className="border-accent-red-border bg-accent-red-bg rounded-lg border-2 p-8 text-center">
            <h3 className="text-heading mb-2 text-lg font-semibold">
              Connection Issue
            </h3>
            <p className="text-body mb-4">{error}</p>
            <Button variant="outline" onClick={handleRefresh}>
              Try Again
            </Button>
          </div>
        ) : players.length === 0 ? (
          <div className="border-accent-purple-border bg-accent-purple-bg rounded-lg border-2 p-12 text-center shadow-md">
            <Users size={64} className="text-faint mx-auto mb-6" />
            <h3 className="text-heading mb-2 text-xl font-semibold">
              Waiting for Players
            </h3>
            <p className="text-body mb-6">
              Share the campaign code with your players so they can join and
              sync their characters.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Badge
                variant="info"
                size="lg"
                className="px-6 py-3 font-mono text-2xl tracking-widest"
              >
                {code}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                aria-label="Copy code"
              >
                {copied ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <Copy size={16} />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-2">
              <Users size={20} className="text-muted" />
              <h2 className="text-heading text-lg font-semibold">
                Players ({players.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {players.map(player => (
                <PlayerSummaryCard key={player.playerId} player={player} />
              ))}
            </div>
          </>
        )}
      </main>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
