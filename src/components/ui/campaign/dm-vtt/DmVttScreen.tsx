'use client';

import { useState } from 'react';

import { ToastContainer } from '@/components/ui/feedback/Toast';

import { DmBattleMapCanvas } from './DmBattleMapCanvas';
import { useDmVttScreen } from './DmVttScreen.hooks';
import { DmVttNpcDialog } from './DmVttNpcDialog';
import { DmVttTopBar } from './DmVttTopBar';
import { PlacementBanner } from './PlacementBanner';
import { RosterDragGhost } from './RosterDragGhost';
import { RosterTray } from './RosterTray';
import { StudioPanel } from './StudioPanel';
import { TokenDragDistanceBadge } from './TokenDragDistanceBadge';
import { TokenPlacementController } from './TokenPlacementController';
import { TurnControl } from './TurnControl';

import type { DmVttGridMode, DmVttMode } from './DmVttTopBar';

interface DmVttScreenProps {
  campaignCode: string;
  battleMapId: string;
  dmId: string;
  mode: DmVttMode;
  onModeChange: (mode: DmVttMode) => void;
}

/**
 * DM VTT play-mode screen: battle map canvas with the roster tray, studio
 * panel, turn control, drag-distance badge, and top chrome composed as
 * canvas children (so they share `useActiveTool` context, per
 * `TokenPlacementController`). The Selected tab's "View NPC details" action
 * is delegated to `DmVttNpcDialog` (mirrors `EncounterView`'s NPC statblock
 * viewer).
 */
export function DmVttScreen({
  campaignCode,
  battleMapId,
  dmId,
  mode,
  onModeChange,
}: DmVttScreenProps) {
  const vtt = useDmVttScreen({ campaignCode, battleMapId, dmId });
  const [rosterCollapsed, setRosterCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);

  const gridMode: DmVttGridMode = vtt.battleMap?.gridEnabled
    ? (vtt.battleMap.gridSettings?.gridType ?? 'hex')
    : 'off';

  return (
    <DmBattleMapCanvas
      campaignCode={campaignCode}
      battleMapId={battleMapId}
      dmId={dmId}
      onStatus={vtt.onStatus}
      onViewportReady={vtt.onViewportReady}
      tokenConfigRef={vtt.tokenConfigRef}
      onSelectionChange={vtt.onSelectionChange}
    >
      <TokenPlacementController
        pending={vtt.pendingPlacement}
        configRef={vtt.tokenConfigRef}
        onCancel={vtt.cancelPlacement}
      />
      {vtt.pendingPlacement && (
        <PlacementBanner
          entityName={vtt.pendingPlacement.entityName}
          onCancel={vtt.cancelPlacement}
        />
      )}
      <div className="pointer-events-none absolute inset-0 z-10">
        <DmVttTopBar
          campaignCode={campaignCode}
          battleMapId={battleMapId}
          dmId={dmId}
          mapName={vtt.battleMap?.name ?? 'Battle Map'}
          status={vtt.status}
          gridMode={gridMode}
          onSetGridMode={vtt.setGridMode}
          mode={mode}
          onModeChange={onModeChange}
        />
        <RosterTray
          entities={vtt.linkedEntities}
          placedIndex={vtt.placedIndex}
          armedEntityId={vtt.pendingPlacement?.config.entityId ?? null}
          onArmPlacement={entity => !vtt.wasDrag() && vtt.armPlacement(entity)}
          onSelectEntity={vtt.selectEntity}
          onDragStart={vtt.startDrag}
          collapsed={rosterCollapsed}
          onToggleCollapsed={() => setRosterCollapsed(v => !v)}
          hasLinkedEncounter={vtt.linkedEntities.length > 0}
        />
        <RosterDragGhost drag={vtt.drag} />
        {vtt.actions && (
          <StudioPanel
            encounter={vtt.encounter}
            selectedEntityId={vtt.selectedEntityId}
            onSelectEntity={vtt.selectEntity}
            actions={vtt.actions}
            activeTab={vtt.studioTab}
            onTabChange={vtt.setStudioTab}
            encounterHref={`/dm/campaign/${campaignCode}/encounters/${vtt.encounter?.id ?? ''}`}
            collapsed={studioCollapsed}
            onToggleCollapsed={() => setStudioCollapsed(v => !v)}
            followNote={vtt.followNote}
          />
        )}
        {vtt.encounter?.isActive && (
          <TurnControl
            round={vtt.encounter.round}
            activeName={vtt.activeEntity?.name ?? '—'}
            onNext={vtt.handleNextTurn}
            onPrev={vtt.handlePrevTurn}
          />
        )}
        <TokenDragDistanceBadge
          viewport={vtt.viewport}
          canvasEl={vtt.getCanvasEl()}
        />
      </div>
      <ToastContainer toasts={vtt.toasts} onDismiss={vtt.dismissToast} />
      <DmVttNpcDialog
        campaignCode={campaignCode}
        encounterId={vtt.encounter?.id}
        {...vtt.npcDialog}
      />
    </DmBattleMapCanvas>
  );
}
