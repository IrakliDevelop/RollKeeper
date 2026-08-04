'use client';

import { FieldNotesCanvas, ViewportContext } from '@fieldnotes/react';
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
  const { children, sessionControls, tokenInfoToggle } = props;
  const {
    viewport,
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
  } = useDmBattleMapCanvas(props);

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
          />
        )}
        {viewport && children}
      </div>
    </ViewportContext.Provider>
  );
}
