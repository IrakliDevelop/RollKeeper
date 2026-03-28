'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Crown,
  Copy,
  Check,
  RefreshCw,
  Users,
  Swords,
  Angry,
  CalendarDays,
  MessageSquare,
  Map,
  MapPinned,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PlayerSummaryCard } from '@/components/ui/campaign/PlayerSummaryCard';
import { PlayerDetailDialog } from '@/components/ui/campaign/PlayerDetailDialog';
import { SendMessageDialog } from '@/components/ui/campaign/SendMessageDialog';
import { NPCSection } from '@/components/ui/campaign/NPCSection';
import { useCampaignSync } from '@/hooks/useCampaignSync';
import { useDmCounterSync } from '@/hooks/useDmCounterSync';
import { useDmStore } from '@/store/dmStore';
import { BannerUpload } from '@/components/ui/campaign/BannerUpload';
import { ToastContainer, useToast } from '@/components/ui/feedback/Toast';
import { CampaignPlayerData } from '@/types/campaign';

export default function CampaignViewPage() {
  const params = useParams();
  const code = params.code as string;

  const {
    dmId,
    getCampaign,
    setCustomCounterLabel,
    adjustPlayerCounter,
    updateCampaign,
    setDmDashboardUi,
  } = useDmStore();
  const localCampaign = getCampaign(code);

  const { players, campaignName, loading, error, lastFetched, refresh } =
    useCampaignSync({
      code,
      dmId,
      campaignName: localCampaign?.name ?? 'Campaign',
      createdAt: localCampaign?.createdAt ?? new Date().toISOString(),
      interval: 10000,
    });

  useDmCounterSync(code, dmId);

  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] =
    useState<CampaignPlayerData | null>(null);
  const [editingCounterLabel, setEditingCounterLabel] = useState(false);
  const [counterLabelInput, setCounterLabelInput] = useState('');
  const [messageTarget, setMessageTarget] = useState<
    CampaignPlayerData | null | 'all'
  >(null);
  const { toasts, addToast, dismissToast } = useToast();
  const knownPlayerIdsRef = useRef<Set<string>>(new Set());

  const playersSectionOpen =
    localCampaign?.dmDashboardUi?.playersSectionOpen ?? true;

  const customCounterLabel = localCampaign?.customCounterLabel;

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

  const handleSaveCounterLabel = () => {
    const label = counterLabelInput.trim() || undefined;
    setCustomCounterLabel(code, label);
    setEditingCounterLabel(false);
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
            <div className="flex items-center gap-3">
              <Link
                href={`/dm/campaign/${code}/locations`}
                className="lg:hidden"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<MapPinned size={16} />}
                >
                  Locations
                </Button>
              </Link>
              <Link
                href={`/dm/campaign/${code}/calendar`}
                className="lg:hidden"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<CalendarDays size={16} />}
                >
                  Calendar
                </Button>
              </Link>
              <Link
                href={`/dm/campaign/${code}/encounters`}
                className="lg:hidden"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Swords size={16} />}
                >
                  Encounters
                </Button>
              </Link>
              <Link
                href={`/dm/campaign/${code}/battlemaps`}
                className="lg:hidden"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Map size={16} />}
                >
                  Battle Maps
                </Button>
              </Link>
              <ThemeToggle showSystemOption />
            </div>
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

      {/* Campaign Banner with Side Panels */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-stretch gap-4">
          {/* Locations + Battle Maps (stacked) */}
          <div className="hidden flex-col gap-2 lg:flex lg:w-44">
            <Link
              href={`/dm/campaign/${code}/locations`}
              className="border-accent-emerald-border bg-accent-emerald-bg hover:bg-accent-emerald-bg-strong flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-4 py-2 transition-colors"
            >
              <MapPinned size={22} className="text-accent-emerald-text-muted" />
              <div className="text-accent-emerald-text text-sm font-semibold">
                Locations
              </div>
            </Link>
            <Link
              href={`/dm/campaign/${code}/battlemaps`}
              className="border-accent-orange-border bg-accent-orange-bg flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-4 py-2 transition-colors hover:shadow-md"
            >
              <Map size={22} className="text-accent-orange-text-muted" />
              <div className="text-accent-orange-text text-sm font-semibold">
                Battle Maps
              </div>
            </Link>
          </div>

          {/* Banner */}
          <div className="min-w-0 flex-1 lg:max-w-2xl">
            <BannerUpload
              bannerUrl={localCampaign?.bannerUrl}
              campaignCode={code}
              onBannerChange={url => updateCampaign(code, { bannerUrl: url })}
              variant="hero"
            />
          </div>

          {/* Calendar */}
          <Link
            href={`/dm/campaign/${code}/calendar`}
            className="border-accent-amber-border bg-accent-amber-bg hover:bg-accent-amber-bg-strong hidden flex-col items-center justify-center gap-2 rounded-lg border-2 px-4 py-4 transition-colors lg:flex lg:w-44"
          >
            <CalendarDays size={28} className="text-accent-amber-text-muted" />
            <div className="text-accent-amber-text text-sm font-semibold">
              Calendar
            </div>
          </Link>

          {/* Encounters */}
          <Link
            href={`/dm/campaign/${code}/encounters`}
            className="border-accent-red-border bg-accent-red-bg hover:bg-accent-red-bg-strong hidden flex-col items-center justify-center gap-2 rounded-lg border-2 px-4 py-4 transition-colors lg:flex lg:w-44"
          >
            <Swords size={28} className="text-accent-red-text-muted" />
            <div className="text-accent-red-text text-sm font-semibold">
              Encounters
            </div>
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
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
            {/* Players header + custom counter config */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setDmDashboardUi(code, {
                      playersSectionOpen: !playersSectionOpen,
                    })
                  }
                  className="text-muted hover:text-body hover:bg-surface-secondary shrink-0 rounded-md p-1 transition-colors"
                  aria-expanded={playersSectionOpen}
                  aria-controls="dm-campaign-players-section"
                  title={
                    playersSectionOpen ? 'Collapse players' : 'Expand players'
                  }
                >
                  {playersSectionOpen ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2">
                    <Users size={20} className="text-muted shrink-0" />
                    <h2 className="text-heading text-lg font-semibold">
                      Players ({players.length})
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<MessageSquare size={14} />}
                    onClick={() => setMessageTarget('all')}
                  >
                    Message All
                  </Button>
                </div>
              </div>

              {/* Custom counter label config */}
              <div className="flex items-center gap-2">
                <Angry size={14} className="text-muted" />
                {editingCounterLabel ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={counterLabelInput}
                      onChange={e => setCounterLabelInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveCounterLabel();
                        if (e.key === 'Escape') setEditingCounterLabel(false);
                      }}
                      placeholder="e.g. Desperation Points"
                      className="bg-surface-secondary text-body rounded px-2 py-1 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveCounterLabel}
                    >
                      Save
                    </Button>
                    {customCounterLabel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomCounterLabel(code, undefined);
                          setEditingCounterLabel(false);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setCounterLabelInput(customCounterLabel ?? '');
                      setEditingCounterLabel(true);
                    }}
                    className="text-muted hover:text-body text-sm transition-colors"
                  >
                    {customCounterLabel
                      ? `Custom Counter: ${customCounterLabel}`
                      : 'Add custom player counter...'}
                  </button>
                )}
              </div>
            </div>

            {playersSectionOpen && (
              <div
                id="dm-campaign-players-section"
                className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
                {players.map(player => (
                  <PlayerSummaryCard
                    key={player.playerId}
                    player={player}
                    customCounterLabel={customCounterLabel}
                    counterValue={
                      localCampaign?.playerCounters?.[player.playerId] ?? 0
                    }
                    onAdjustCounter={
                      customCounterLabel
                        ? delta =>
                            adjustPlayerCounter(code, player.playerId, delta)
                        : undefined
                    }
                    onClick={() => setSelectedPlayer(player)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* NPC Management — always visible */}
        {!loading && !error && <NPCSection campaignCode={code} />}
      </main>

      {/* Player Detail Dialog */}
      {selectedPlayer && (
        <PlayerDetailDialog
          open={!!selectedPlayer}
          onOpenChange={open => {
            if (!open) setSelectedPlayer(null);
          }}
          player={selectedPlayer}
          customCounterLabel={customCounterLabel}
          counterValue={
            localCampaign?.playerCounters?.[selectedPlayer.playerId] ?? 0
          }
          onAdjustCounter={
            customCounterLabel
              ? delta =>
                  adjustPlayerCounter(code, selectedPlayer.playerId, delta)
              : undefined
          }
          onSendMessage={() => {
            setMessageTarget(selectedPlayer);
            setSelectedPlayer(null);
          }}
        />
      )}

      <SendMessageDialog
        open={messageTarget !== null}
        onClose={() => setMessageTarget(null)}
        players={players}
        targetPlayer={messageTarget === 'all' ? null : messageTarget}
        campaignCode={code}
        dmId={dmId}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
