'use client';

import { useCallback, useEffect, useState } from 'react';
import { FieldNotesCanvas, ViewportContext } from '@fieldnotes/react';
import { BattleMapMinimap } from '@/components/ui/campaign/location-map/BattleMapMinimap';
import { BattleMapExportControl } from '@/components/ui/campaign/location-map/BattleMapExportControl';
import { BattleMapViewsControl } from '@/components/ui/campaign/location-map/BattleMapViewsControl';
import { PresenceControl } from '@/components/ui/campaign/location-map/PresenceControl';
import MarkerDetailPanel from '@/components/ui/campaign/location-map/MarkerDetailPanel';
import { ToastContainer, useToast } from '@/components/ui/feedback/Toast';
import {
  parseFogAppearance,
  resolveFogRendererOptions,
} from '@/components/ui/campaign/location-map/fog';
import { isProceduralFogAppearanceEnabled } from '@/lib/fogOfWar';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { FogAppearanceV1 } from '@/types/battlemap';
import { DmVttToolbar } from './DmVttToolbar';
import {
  useDmBattleMapCanvas,
  type DmBattleMapCanvasProps,
} from './DmBattleMapCanvas.hooks';

export type { DmBattleMapCanvasProps };

/**
 * DM-role battle-map canvas: play tools (pan/select/draw/arrow/measure/
 * template) + a hidden `dmtoken` tool armed from the roster (Task 8), with
 * editor-identical persistence/live-sync and player-canvas-identical
 * provider/toolbar composition. See `DmBattleMapCanvas.hooks.ts` for the
 * init/persistence/connection wiring.
 */
export function DmBattleMapCanvas(props: DmBattleMapCanvasProps) {
  const {
    children,
    sessionControls,
    tokenInfoToggle,
    campaignCode,
    battleMapId,
    onExportError,
  } = props;
  const {
    viewport,
    battleMap,
    tools,
    handleReady,
    handleClearDrawings,
    hiddenPlacementActive,
    handleToggleHiddenPlacement,
    hiddenElementCount,
    handleRevealAll,
    selectedElementId,
    selectedElementIsDmOnly,
    handleToggleSelectedDmOnly,
    measureSharing,
    handleSetMeasureSharing,
    pathSharing,
    handleSetPathSharing,
    movementDash,
    handleSetMovementDash,
    awarenessRoster,
    cursorSharing,
    handleSetCursorSharing,
    showPlayerCursors,
    handleSetShowPlayerCursors,
    handleGoToCameraView,
    handleSendCameraView,
    markerControls,
    selectedElementIsMarker,
    markerAudienceNotice,
    markerPanelOpen,
    markerPanelState,
    markerPanelIsDmOnly,
    handleSetMarkerAudience,
    handleCloseMarkerPanel,
    handleSaveMarkerDetail,
    handleDeleteMarker,
    portalState,
    fogControls,
  } = useDmBattleMapCanvas(props);
  const { toasts, addToast, dismissToast } = useToast();
  const updateBattleMap = useBattleMapStore(s => s.updateBattleMap);
  const proceduralFogEnabled = isProceduralFogAppearanceEnabled();
  const fogAppearance = proceduralFogEnabled
    ? parseFogAppearance(battleMap?.fogAppearance)
    : 'solid';

  useEffect(() => {
    viewport?.setFogStyle(resolveFogRendererOptions(fogAppearance));
  }, [viewport, fogAppearance]);

  const handleFogAppearanceChange = useCallback(
    (appearance: FogAppearanceV1) => {
      viewport?.setFogStyle(resolveFogRendererOptions(appearance));
      updateBattleMap(campaignCode, battleMapId, { fogAppearance: appearance });
      void fetch(
        `/api/campaign/${campaignCode}/battlemaps/${battleMapId}/fog-appearance`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dmId: props.dmId, appearance }),
        }
      ).catch(() => {});
    },
    [viewport, updateBattleMap, campaignCode, battleMapId, props.dmId]
  );
  // Session-scoped only — pure UI state, no connection dependency. Off by
  // default; the DM opts in each session before a focus request can move
  // anyone else's camera.
  const [cameraSharing, setCameraSharing] = useState(false);

  return (
    <ViewportContext.Provider value={viewport}>
      <div className="bg-surface fixed inset-0">
        <FieldNotesCanvas
          tools={tools}
          defaultTool="hand"
          onReady={handleReady}
          className="h-full w-full"
          snapToGrid
          options={{
            fog: resolveFogRendererOptions(fogAppearance),
          }}
        />
        {viewport && (
          <DmVttToolbar
            sessionControls={sessionControls}
            onClearDrawings={handleClearDrawings}
            tokenInfoToggle={tokenInfoToggle}
            hiddenPlacementActive={hiddenPlacementActive}
            onToggleHiddenPlacement={handleToggleHiddenPlacement}
            hiddenElementCount={hiddenElementCount}
            onRevealAll={handleRevealAll}
            selectedElementId={selectedElementId}
            selectedElementIsDmOnly={selectedElementIsDmOnly}
            onToggleSelectedDmOnly={handleToggleSelectedDmOnly}
            selectedElementIsMarker={selectedElementIsMarker}
            markerAudienceNotice={markerAudienceNotice}
            markerControls={markerControls}
            measureSharing={{
              enabled: measureSharing,
              onChange: handleSetMeasureSharing,
            }}
            movementControls={{
              sharing: {
                enabled: pathSharing,
                onChange: handleSetPathSharing,
              },
              dash: {
                enabled: movementDash,
                onChange: handleSetMovementDash,
              },
            }}
            fogControls={fogControls}
            fogAppearance={fogAppearance}
            onFogAppearanceChange={
              proceduralFogEnabled ? handleFogAppearanceChange : undefined
            }
            exportControl={
              <BattleMapExportControl
                getViewport={() => viewport}
                name={battleMap?.name ?? 'battle-map'}
                mapImageSize={battleMap?.mapImageSize}
                getDmOnlyElements={() =>
                  useBattleMapStore
                    .getState()
                    .getBattleMap(campaignCode, battleMapId)?.dmOnlyElements ??
                  {}
                }
                getFogState={() => viewport.fog.getState()}
                onError={onExportError}
              />
            }
            viewsControl={
              <BattleMapViewsControl
                getViewport={() => viewport}
                views={battleMap?.cameraViews ?? []}
                sharingEnabled={cameraSharing}
                onSharingChange={setCameraSharing}
                onSaveView={(view, name) => {
                  const next = [
                    ...(battleMap?.cameraViews ?? []),
                    { id: crypto.randomUUID(), name, view },
                  ];
                  useBattleMapStore
                    .getState()
                    .updateBattleMap(campaignCode, battleMapId, {
                      cameraViews: next,
                    });
                }}
                onGoToView={handleGoToCameraView}
                onSend={handleSendCameraView}
                onRenameView={(id, name) => {
                  const next = (battleMap?.cameraViews ?? []).map(v =>
                    v.id === id ? { ...v, name } : v
                  );
                  useBattleMapStore
                    .getState()
                    .updateBattleMap(campaignCode, battleMapId, {
                      cameraViews: next,
                    });
                }}
                onDeleteView={id => {
                  const next = (battleMap?.cameraViews ?? []).filter(
                    v => v.id !== id
                  );
                  useBattleMapStore
                    .getState()
                    .updateBattleMap(campaignCode, battleMapId, {
                      cameraViews: next,
                    });
                }}
              />
            }
            presenceControl={
              <PresenceControl
                campaignCode={campaignCode}
                roster={awarenessRoster}
                cursorSharing={cursorSharing}
                onCursorSharingChange={handleSetCursorSharing}
                showPlayerCursors={showPlayerCursors}
                onShowPlayerCursorsChange={handleSetShowPlayerCursors}
              />
            }
          />
        )}
        {viewport && (
          <BattleMapMinimap placement="bottom-left" defaultCollapsed />
        )}

        {/* Mounted only while a marker is active. Painting and activation are
            connection-independent, so this panel opens with no relay URL
            configured — see `useMarkerRegistration` in the hook. */}
        {markerPanelOpen && (
          <MarkerDetailPanel
            open
            mode="dm"
            campaignCode={props.campaignCode}
            dmId={props.dmId}
            state={markerPanelState}
            portalState={portalState}
            onClose={handleCloseMarkerPanel}
            onSave={patch => {
              handleSaveMarkerDetail(patch);
              addToast({
                type: 'success',
                title: 'Marker saved',
                message: 'Marker details were updated.',
              });
              handleCloseMarkerPanel();
            }}
            onPersist={handleSaveMarkerDetail}
            onDelete={handleDeleteMarker}
            isDmOnly={markerPanelIsDmOnly}
            onAudienceChange={handleSetMarkerAudience}
            audienceNotice={markerAudienceNotice}
          />
        )}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        {viewport && children}
      </div>
    </ViewportContext.Provider>
  );
}
