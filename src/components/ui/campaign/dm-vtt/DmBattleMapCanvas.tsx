'use client';

import { useState } from 'react';
import { FieldNotesCanvas, ViewportContext } from '@fieldnotes/react';
import { BattleMapMinimap } from '@/components/ui/campaign/location-map/BattleMapMinimap';
import { BattleMapExportControl } from '@/components/ui/campaign/location-map/BattleMapExportControl';
import { BattleMapViewsControl } from '@/components/ui/campaign/location-map/BattleMapViewsControl';
import { useBattleMapStore } from '@/store/battleMapStore';
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
    handleGoToCameraView,
    handleSendCameraView,
  } = useDmBattleMapCanvas(props);
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
            measureSharing={{
              enabled: measureSharing,
              onChange: handleSetMeasureSharing,
            }}
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
          />
        )}
        {viewport && (
          <BattleMapMinimap placement="bottom-left" defaultCollapsed />
        )}
        {viewport && children}
      </div>
    </ViewportContext.Provider>
  );
}
