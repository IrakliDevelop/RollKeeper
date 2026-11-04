'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CampaignHeader } from '@/components/ui/campaign/CampaignHeader';
import { CopyCodeButton } from '@/components/ui/campaign/CopyCodeButton';
import { CampaignNav } from '@/components/ui/campaign/CampaignNav';
import { CampaignBanner } from '@/components/ui/campaign/CampaignBanner';
import { CampaignPlayersSection } from '@/components/ui/campaign/CampaignPlayersSection';
import { CampaignSettingsSection } from '@/components/ui/campaign/CampaignSettingsSection';
import { playerDisplayName } from '@/components/ui/campaign/PlayerRosterRow';
import { PlayerDetailDialog } from '@/components/ui/campaign/PlayerDetailDialog';
import { SendMessageDialog } from '@/components/ui/campaign/SendMessageDialog';
import { AwardXpDialog } from '@/components/ui/campaign/AwardXpDialog';
import { NPCSection } from '@/components/ui/campaign/NPCSection';
import { CampaignSettingsSyncControls } from '@/components/ui/campaign/CampaignSettingsSyncControls';
import { SendItemDialog } from '@/components/ui/campaign/SendItemDialog';
import { useCampaignItemSends } from '@/hooks/useCampaignItemSends';
import { useCampaignSync } from '@/hooks/useCampaignSync';
import { useDmCounterSync } from '@/hooks/useDmCounterSync';
import { useDmSettingsSync } from '@/hooks/useDmSettingsSync';
import { useHydration } from '@/hooks/useHydration';
import { useDmStore } from '@/store/dmStore';
import { ToastContainer, useToast } from '@/components/ui/feedback/Toast';
import { CampaignPlayerData } from '@/types/campaign';

export default function CampaignViewPage() {
  const params = useParams();
  const code = params.code as string;
  const hasHydrated = useHydration();

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
  useDmSettingsSync(code, dmId);

  const [selectedPlayer, setSelectedPlayer] =
    useState<CampaignPlayerData | null>(null);
  const currentSelectedPlayer = selectedPlayer
    ? (players.find(player => player.playerId === selectedPlayer.playerId) ??
      selectedPlayer)
    : null;
  const [messageTarget, setMessageTarget] = useState<
    CampaignPlayerData | null | 'all'
  >(null);
  const { toasts, addToast, dismissToast } = useToast();
  const itemSends = useCampaignItemSends({ code, dmId, players, addToast });
  const knownPlayerIdsRef = useRef<Set<string>>(new Set());

  const [awardXpOpen, setAwardXpOpen] = useState(false);

  const playersSectionOpen =
    localCampaign?.dmDashboardUi?.playersSectionOpen ?? true;
  const houseRulesSectionOpen =
    localCampaign?.dmDashboardUi?.houseRulesSectionOpen ?? false;

  const customCounterLabel = localCampaign?.customCounterLabel;
  const stackableInspiration = localCampaign?.stackableInspiration ?? false;

  const handleToggleStackableInspiration = useCallback(
    (enabled: boolean) => {
      updateCampaign(code, { stackableInspiration: enabled });
    },
    [updateCampaign, code]
  );

  useEffect(() => {
    if (loading) return;

    const currentIds = new Set(players.map(p => p.playerId));
    const known = knownPlayerIdsRef.current;

    if (known.size > 0) {
      for (const player of players) {
        if (!known.has(player.playerId)) {
          addToast({
            type: 'info',
            title: 'Player joined',
            message: `${playerDisplayName(player)} (${player.playerName}) joined the campaign.`,
            duration: 6000,
          });
        }
      }
    }

    knownPlayerIdsRef.current = currentIds;
  }, [players, loading, addToast]);

  const handleRemovePlayer = useCallback(
    async (target: CampaignPlayerData) => {
      const name = playerDisplayName(target);
      try {
        const res = await fetch(
          `/api/campaign/${code}/players/${target.playerId}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dmId }),
          }
        );
        if (!res.ok) throw new Error('Failed to remove player');
      } catch (err) {
        console.error('Failed to remove player:', err);
        addToast({
          type: 'error',
          title: 'Player not removed',
          message: `${name} is still in the campaign. Try again.`,
        });
        return;
      }
      // Keep the known set in step with the refreshed list, so a later
      // rejoin is announced.
      knownPlayerIdsRef.current.delete(target.playerId);
      addToast({
        type: 'success',
        title: 'Player removed',
        message: `${name} was removed from the campaign.`,
      });
      try {
        await refresh();
      } catch (err) {
        console.error('Failed to refresh players:', err);
      }
    },
    [code, dmId, addToast, refresh]
  );

  const displayName = campaignName || localCampaign?.name || 'Campaign';

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading campaign…</p>
      </div>
    );
  }

  const bannerUrl = localCampaign?.bannerUrl;

  return (
    <div className="bg-surface min-h-screen">
      <CampaignHeader
        crumb={{ href: '/dm', label: 'Campaigns' }}
        title={
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="type-heading text-heading truncate">
              {displayName}
            </h1>
            <CopyCodeButton code={code} className="shrink-0" />
          </div>
        }
      />

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:grid-rows-[auto_1fr] lg:px-8">
        {/* Rail: a div, not <aside> inside <main>. */}
        <div className="space-y-4 lg:col-start-2 lg:row-start-1">
          {bannerUrl && (
            <CampaignBanner
              src={bannerUrl}
              className="aspect-[16/7] lg:aspect-video"
            />
          )}
          <CampaignNav code={code} className="lg:hidden" />
          <CampaignNav code={code} vertical className="hidden lg:block" />
        </div>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {localCampaign && (
            <CampaignSettingsSyncControls campaign={localCampaign} />
          )}
          <CampaignPlayersSection
            code={code}
            players={players}
            loading={loading}
            error={error}
            lastFetched={lastFetched}
            onRefresh={refresh}
            open={playersSectionOpen}
            onOpenChange={open =>
              setDmDashboardUi(code, { playersSectionOpen: open })
            }
            customCounterLabel={customCounterLabel}
            playerCounters={localCampaign?.playerCounters}
            onAdjustCounter={(playerId, delta) =>
              adjustPlayerCounter(code, playerId, delta)
            }
            onViewPlayer={setSelectedPlayer}
            onRemovePlayer={handleRemovePlayer}
            onMessageAll={() => setMessageTarget('all')}
            onAwardXp={() => setAwardXpOpen(true)}
          />
          {!loading && !error && (
            <>
              <NPCSection
                campaignCode={code}
                kind="npc"
                showLibraryExtras={false}
                players={itemSends.sendTargets}
                onSendItemToPlayer={itemSends.openNpcItemSend}
              />
              <NPCSection
                campaignCode={code}
                kind="monster"
                showSpellSlotSettings={false}
                players={itemSends.sendTargets}
                onGiveMagicItemToPlayer={itemSends.giveLibraryMagicItem}
                onSendItemToPlayer={itemSends.openNpcItemSend}
              />
            </>
          )}
        </div>

        {/* No settings for a campaign this device doesn't know. */}
        {localCampaign && (
          <div className="lg:col-start-2 lg:row-start-2">
            <CampaignSettingsSection
              campaignCode={code}
              open={houseRulesSectionOpen}
              onOpenChange={open =>
                setDmDashboardUi(code, { houseRulesSectionOpen: open })
              }
              bannerUrl={bannerUrl}
              onBannerChange={url => updateCampaign(code, { bannerUrl: url })}
              stackableInspiration={stackableInspiration}
              onStackableInspirationChange={handleToggleStackableInspiration}
              customCounterLabel={customCounterLabel}
              onCustomCounterLabelChange={label =>
                setCustomCounterLabel(code, label)
              }
            />
          </div>
        )}
      </main>

      {/* Player Detail Dialog */}
      {currentSelectedPlayer && (
        <PlayerDetailDialog
          open={!!currentSelectedPlayer}
          onOpenChange={open => {
            if (!open) setSelectedPlayer(null);
          }}
          player={currentSelectedPlayer}
          customCounterLabel={customCounterLabel}
          counterValue={
            localCampaign?.playerCounters?.[currentSelectedPlayer.playerId] ?? 0
          }
          onAdjustCounter={
            customCounterLabel
              ? delta =>
                  adjustPlayerCounter(
                    code,
                    currentSelectedPlayer.playerId,
                    delta
                  )
              : undefined
          }
          onSendMessage={() => {
            setMessageTarget(currentSelectedPlayer);
            setSelectedPlayer(null);
          }}
          campaignCode={code}
          dmId={dmId}
        />
      )}

      <SendItemDialog {...itemSends.sendItemDialog} />

      <SendMessageDialog
        open={messageTarget !== null}
        onClose={() => setMessageTarget(null)}
        players={players}
        targetPlayer={messageTarget === 'all' ? null : messageTarget}
        campaignCode={code}
        dmId={dmId}
      />

      <AwardXpDialog
        open={awardXpOpen}
        onClose={() => setAwardXpOpen(false)}
        players={players}
        campaignCode={code}
        dmId={dmId}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
