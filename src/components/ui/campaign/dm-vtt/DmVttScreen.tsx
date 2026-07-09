'use client';

import { useState } from 'react';

import { ToastContainer } from '@/components/ui/feedback/Toast';

import { DmBattleMapCanvas } from './DmBattleMapCanvas';
import { useDmVttScreen } from './DmVttScreen.hooks';
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
 * `TokenPlacementController`).
 */
export function DmVttScreen({
  campaignCode,
  battleMapId,
  dmId,
  mode,
  onModeChange,
}: DmVttScreenProps) {
  const {
    battleMap,
    linkedEntities,
    placedIndex,
    encounter,
    activeEntity,
    handleNextTurn,
    handlePrevTurn,
    actions,
    viewport,
    status,
    onViewportReady,
    onStatus,
    onSelectionChange,
    tokenConfigRef,
    pendingPlacement,
    armPlacement,
    wasDrag,
    cancelPlacement,
    selectedEntityId,
    selectEntity,
    studioTab,
    setStudioTab,
    drag,
    startDrag,
    getCanvasEl,
    setGridMode,
    toasts,
    dismissToast,
  } = useDmVttScreen({ campaignCode, battleMapId, dmId });

  const [rosterCollapsed, setRosterCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);

  const gridMode: DmVttGridMode = battleMap?.gridEnabled
    ? (battleMap.gridSettings?.gridType ?? 'hex')
    : 'off';

  return (
    <DmBattleMapCanvas
      campaignCode={campaignCode}
      battleMapId={battleMapId}
      dmId={dmId}
      onStatus={onStatus}
      onViewportReady={onViewportReady}
      tokenConfigRef={tokenConfigRef}
      onSelectionChange={onSelectionChange}
    >
      <TokenPlacementController
        pending={pendingPlacement}
        configRef={tokenConfigRef}
        onCancel={cancelPlacement}
      />
      {pendingPlacement && (
        <PlacementBanner
          entityName={pendingPlacement.entityName}
          onCancel={cancelPlacement}
        />
      )}
      <div className="pointer-events-none absolute inset-0 z-10">
        <DmVttTopBar
          campaignCode={campaignCode}
          battleMapId={battleMapId}
          dmId={dmId}
          mapName={battleMap?.name ?? 'Battle Map'}
          status={status}
          gridMode={gridMode}
          onSetGridMode={setGridMode}
          mode={mode}
          onModeChange={onModeChange}
        />
        <RosterTray
          entities={linkedEntities}
          placedIndex={placedIndex}
          armedEntityId={pendingPlacement?.config.entityId ?? null}
          onArmPlacement={entity => !wasDrag() && armPlacement(entity)}
          onSelectEntity={selectEntity}
          onDragStart={startDrag}
          collapsed={rosterCollapsed}
          onToggleCollapsed={() => setRosterCollapsed(v => !v)}
          hasLinkedEncounter={linkedEntities.length > 0}
        />
        <RosterDragGhost drag={drag} />
        {actions && (
          <StudioPanel
            encounter={encounter}
            selectedEntityId={selectedEntityId}
            onSelectEntity={selectEntity}
            actions={actions}
            activeTab={studioTab}
            onTabChange={setStudioTab}
            encounterHref={`/dm/campaign/${campaignCode}/encounters/${encounter?.id ?? ''}`}
            collapsed={studioCollapsed}
            onToggleCollapsed={() => setStudioCollapsed(v => !v)}
          />
        )}
        {encounter?.isActive && (
          <TurnControl
            round={encounter.round}
            activeName={activeEntity?.name ?? '—'}
            onNext={handleNextTurn}
            onPrev={handlePrevTurn}
          />
        )}
        <TokenDragDistanceBadge viewport={viewport} canvasEl={getCanvasEl()} />
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </DmBattleMapCanvas>
  );
}
