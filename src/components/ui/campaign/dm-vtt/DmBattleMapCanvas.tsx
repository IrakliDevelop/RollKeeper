'use client';

import { FieldNotesCanvas, ViewportContext } from '@fieldnotes/react';
import DmLocationToolOptions from '@/components/ui/campaign/location-map/DmLocationToolOptions';
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
  const { children, tokenInfoToggle } = props;
  const { viewport, tools, handleReady, handleClearDrawings } =
    useDmBattleMapCanvas(props);

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
            onClearDrawings={handleClearDrawings}
            tokenInfoToggle={tokenInfoToggle}
          />
        )}
        {viewport && (
          <div className="border-divider absolute top-[7.25rem] left-1/2 z-10 max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-xl border shadow-lg">
            <DmLocationToolOptions mode="battlemap" />
          </div>
        )}
        {viewport && children}
      </div>
    </ViewportContext.Provider>
  );
}
