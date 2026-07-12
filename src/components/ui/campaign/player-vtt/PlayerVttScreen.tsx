'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { PlayerBattleMapCanvas } from '@/components/ui/campaign/location-map/PlayerBattleMapCanvas';
import { TokenDecorationLayer } from '@/components/ui/campaign/token-overlay';
import { usePlayerTokenDecorations } from '@/components/ui/campaign/token-overlay/usePlayerTokenDecorations';
import { useTokenInfoMode } from '@/components/ui/campaign/token-overlay/useTokenInfoToggle';
import { ToastContainer } from '@/components/ui/feedback/Toast';

import { CastingBanner } from './CastingBanner';
import { CharacterDock } from './CharacterDock';
import { CombatPanel } from './CombatPanel';
import { usePlayerVttState } from './PlayerVttScreen.hooks';
import { SpellPlacementController } from './SpellPlacementController';
import { StatusEffectTray } from './StatusEffectTray';

interface PlayerVttScreenProps {
  campaignCode: string;
  battleMapId: string;
  characterId: string;
}

/** Below this viewport width both side panels default to collapsed (spec §1a). */
const COLLAPSE_BREAKPOINT_PX = 1100;
const defaultCollapsed = () =>
  typeof window !== 'undefined' && window.innerWidth < COLLAPSE_BREAKPOINT_PX;

/**
 * Player VTT screen: battle map canvas + combat panel + character dock +
 * status tray, composed as canvas children so they share `useActiveTool`
 * context (required by `SpellPlacementController`).
 */
export function PlayerVttScreen({
  campaignCode,
  battleMapId,
  characterId,
}: PlayerVttScreenProps) {
  const {
    character,
    sharedState,
    refetchNow,
    handleEndTurn,
    pendingPlacement,
    requestPlacement,
    cancelPlacement,
    spellTemplateConfigRef,
    connectionStatus,
    setConnectionStatus,
    toasts,
    addToast,
    dismissToast,
  } = usePlayerVttState(campaignCode, characterId);

  const [combatCollapsed, setCombatCollapsed] = useState(defaultCollapsed);
  const [dockCollapsed, setDockCollapsed] = useState(defaultCollapsed);
  const [tokenInfoMode, cycleTokenInfo] = useTokenInfoMode(
    'rollkeeper-vtt-token-info-player'
  );
  const decorations = usePlayerTokenDecorations(
    sharedState?.initiative ?? null
  );

  const handlePoke = useCallback(
    (feature: string) => {
      if (feature === 'initiative') refetchNow();
    },
    [refetchNow]
  );

  return (
    <PlayerBattleMapCanvas
      campaignCode={campaignCode}
      battleMapId={battleMapId}
      characterId={characterId}
      characterName={character.name}
      characterAvatar={character.avatar}
      hideBackButton
      onStatus={setConnectionStatus}
      onPoke={handlePoke}
      spellTemplateConfigRef={spellTemplateConfigRef}
      tokenInfoToggle={{ mode: tokenInfoMode, onCycle: cycleTokenInfo }}
    >
      <TokenDecorationLayer decorations={decorations} mode={tokenInfoMode} />
      <SpellPlacementController
        pending={pendingPlacement}
        configRef={spellTemplateConfigRef}
        onCancel={cancelPlacement}
      />
      {pendingPlacement && (
        <CastingBanner
          spellName={pendingPlacement.spellName}
          aoe={pendingPlacement.aoe}
          onCancel={cancelPlacement}
        />
      )}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto fixed top-3 left-3 z-10">
          <Link href={`/player/characters/${characterId}`}>
            <Button
              variant="ghost"
              className="flex items-center gap-1.5 text-xs"
            >
              <ArrowLeft size={14} />
              Back to sheet
            </Button>
          </Link>
        </div>
        <CombatPanel
          state={sharedState?.initiative ?? null}
          characterId={characterId}
          onEndTurn={handleEndTurn}
          collapsed={combatCollapsed}
          onToggleCollapsed={() => setCombatCollapsed(v => !v)}
        />
        <CharacterDock
          collapsed={dockCollapsed}
          onToggleCollapsed={() => setDockCollapsed(v => !v)}
          addToast={addToast}
          onCastPlacement={requestPlacement}
          connectionLive={connectionStatus === 'live'}
          hasPendingPlacement={pendingPlacement !== null}
          onCancelPlacement={cancelPlacement}
        />
        <StatusEffectTray />
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </PlayerBattleMapCanvas>
  );
}
