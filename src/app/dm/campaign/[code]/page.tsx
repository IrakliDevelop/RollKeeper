'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useParams } from 'next/navigation';
import { CampaignHeader } from '@/components/ui/campaign/CampaignHeader';
import { CopyCodeButton } from '@/components/ui/campaign/CopyCodeButton';
import { CampaignNav } from '@/components/ui/campaign/CampaignNav';
import { CampaignBanner } from '@/components/ui/campaign/CampaignBanner';
import { CampaignBannerHero } from '@/components/ui/campaign/CampaignBannerHero';
import {
  LegacyCampaignHeaderLinks,
  LegacyCampaignHero,
} from '@/components/ui/campaign/legacy/LegacyCampaignHero';
import { CampaignPlayersSection } from '@/components/ui/campaign/CampaignPlayersSection';
import {
  CampaignSettingsSection,
  type NpcSpellSlotMode,
} from '@/components/ui/campaign/CampaignSettingsSection';
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
import { cn } from '@/utils/cn';
import { withViewTransition } from '@/utils/viewTransition';
import { CampaignPlayerData, isCampaignPageLayout } from '@/types/campaign';

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

  // Same rule as NPCSpellTab: only this exact flag pair means the tracker.
  const npcSpellSlotMode: NpcSpellSlotMode =
    localCampaign?.dmDashboardUi?.npcInlineSpellSlots === false &&
    localCampaign?.dmDashboardUi?.npcSeparateSpellSlotTracker === true
      ? 'tracker'
      : 'inline';

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
  const storedLayout = localCampaign?.dmDashboardUi?.pageLayout;
  const pageLayout = isCampaignPageLayout(storedLayout)
    ? storedLayout
    : 'standard';
  const showRail = pageLayout === 'standard';
  const handleBannerChange = (url: string | undefined) =>
    updateCampaign(code, { bannerUrl: url });

  // Banner and classic layouts have no rail: the settings heading stays top
  // right, and the page spans the width below it while the settings are closed.
  const settingsBeside = !showRail && houseRulesSectionOpen;
  const handleSettingsOpenChange = (open: boolean) => {
    const apply = () => setDmDashboardUi(code, { houseRulesSectionOpen: open });
    if (showRail) return apply();
    withViewTransition(() => flushSync(apply));
  };

  // No settings for a campaign this device doesn't know.
  const settingsColumn = localCampaign ? (
    <div
      className={cn(
        showRail && 'lg:col-start-2 lg:row-start-2',
        !showRail && 'lg:col-start-2 lg:row-start-1'
      )}
      style={showRail ? undefined : { viewTransitionName: 'campaign-settings' }}
    >
      <CampaignSettingsSection
        campaignCode={code}
        open={houseRulesSectionOpen}
        onOpenChange={handleSettingsOpenChange}
        bannerUrl={bannerUrl}
        onBannerChange={handleBannerChange}
        pageLayout={pageLayout}
        onPageLayoutChange={layout =>
          setDmDashboardUi(code, { pageLayout: layout })
        }
        stackableInspiration={stackableInspiration}
        onStackableInspirationChange={handleToggleStackableInspiration}
        customCounterLabel={customCounterLabel}
        onCustomCounterLabelChange={label => setCustomCounterLabel(code, label)}
        npcSpellSlotMode={npcSpellSlotMode}
        onNpcSpellSlotModeChange={mode =>
          setDmDashboardUi(
            code,
            mode === 'tracker'
              ? {
                  npcInlineSpellSlots: false,
                  npcSeparateSpellSlotTracker: true,
                }
              : {
                  npcInlineSpellSlots: true,
                  npcSeparateSpellSlotTracker: false,
                }
          )
        }
      />
    </div>
  ) : null;

  return (
    <div className="bg-surface min-h-screen">
      <CampaignHeader
        crumb={{ href: '/dm', label: 'Campaigns' }}
        wrapControls={pageLayout === 'classic'}
        actions={
          pageLayout === 'classic' ? (
            <LegacyCampaignHeaderLinks code={code} />
          ) : undefined
        }
        title={
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="type-heading text-heading truncate">
              {displayName}
            </h1>
            <CopyCodeButton code={code} className="shrink-0" />
          </div>
        }
      />

      {pageLayout === 'banner' && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <CampaignBannerHero
            code={code}
            bannerUrl={bannerUrl}
            onBannerChange={handleBannerChange}
          />
        </div>
      )}
      {pageLayout === 'classic' && (
        <LegacyCampaignHero
          code={code}
          bannerUrl={bannerUrl}
          onBannerChange={handleBannerChange}
          lastFetched={lastFetched}
          onRefresh={refresh}
        />
      )}

      <main
        className={cn(
          'mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:px-8',
          'lg:grid-cols-[minmax(0,1fr)_17rem]',
          showRail && 'lg:grid-rows-[auto_1fr]'
        )}
      >
        {!showRail && settingsColumn}
        {/* Rail: a div, not <aside> inside <main>. */}
        {showRail && (
          <div className="space-y-4 lg:col-start-2 lg:row-start-1">
            {bannerUrl && (
              <CampaignBanner
                src={bannerUrl}
                className="aspect-[16/7] max-h-48 lg:aspect-video"
              />
            )}
            <CampaignNav code={code} className="lg:hidden" />
            <CampaignNav code={code} vertical className="hidden lg:block" />
          </div>
        )}

        <div
          className={cn(
            'min-w-0 space-y-8',
            showRail && 'lg:col-start-1 lg:row-span-2 lg:row-start-1',
            settingsBeside && 'lg:col-start-1 lg:row-start-1',
            !showRail && !settingsBeside && 'lg:col-span-2 lg:row-start-2'
          )}
          style={showRail ? undefined : { viewTransitionName: 'campaign-main' }}
        >
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
                players={itemSends.sendTargets}
                onGiveMagicItemToPlayer={itemSends.giveLibraryMagicItem}
                onSendItemToPlayer={itemSends.openNpcItemSend}
              />
            </>
          )}
        </div>

        {showRail && settingsColumn}
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

      <SendItemDialog
        {...itemSends.sendItemDialog}
        emptyMessage="No players in this campaign yet"
      />

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
