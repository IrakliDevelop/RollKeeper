'use client';

import { useCallback } from 'react';

import { useBattleMapStore } from '@/store/battleMapStore';

import type { Viewport } from '@fieldnotes/core';
import type { BattleMap } from '@/types/battlemap';
import type { GridSettings } from '@/types/location';

/** Mirrors the initial useState defaults in DmLocationEditor.hooks.ts:174-181. */
const DEFAULT_GRID: Omit<GridSettings, 'gridType' | 'hexOrientation'> = {
  cellSize: 50,
  strokeColor: '#94a3b8',
  strokeWidth: 1,
  opacity: 0.5,
};

/**
 * Map + grid must live on a layer-locked background so hit-testing skips
 * them, and grid elements must be `locked` so Select can't drag them.
 * Replicated verbatim from `DmLocationEditor.hooks.ts:62-89`
 * (`pinGridToMapBackgroundLayer`) — that helper is module-private there, so
 * it's copied here rather than imported. Keep in sync if the source changes.
 */
function pinGridToMapBackgroundLayer(vp: Viewport): void {
  let layers = vp.layerManager.getLayers();
  if (layers.length === 0) return;

  if (layers.length === 1) {
    vp.layerManager.createLayer('Annotations');
    layers = vp.layerManager.getLayers();
  }

  const bgLayer = layers[0];
  vp.layerManager.renameLayer(bgLayer.id, 'Map Background');

  if (vp.layerManager.activeLayerId === bgLayer.id) {
    const fallback = layers.find(l => l.id !== bgLayer.id);
    if (fallback) vp.layerManager.setActiveLayer(fallback.id);
  }

  vp.layerManager.setLayerLocked(bgLayer.id, true);

  for (const g of vp.store.getElementsByType('grid')) {
    vp.layerManager.moveElementToLayer(g.id, bgLayer.id);
    vp.store.update(g.id, { locked: true });
  }

  vp.requestRender();
}

interface UseDmVttGridOptions {
  campaignCode: string;
  battleMapId: string;
  battleMap: BattleMap | undefined;
  getViewport: () => Viewport | null;
}

/**
 * Grid on/off/type control for the DM VTT studio — mirrors
 * `handleSetGridType`'s persistence exactly (`DmLocationEditor.hooks.ts:
 * 461-547`), but against `useBattleMapStore` instead of `useLocationStore`.
 */
export function useDmVttGrid({
  campaignCode,
  battleMapId,
  battleMap,
  getViewport,
}: UseDmVttGridOptions) {
  const updateBattleMap = useBattleMapStore(s => s.updateBattleMap);

  const setGridMode = useCallback(
    (target: 'hex' | 'square' | 'off') => {
      const vp = getViewport();
      if (!vp || !battleMap) return;

      // Always remove the existing grid first, whatever the target.
      if (battleMap.gridEnabled) vp.removeGrid();

      if (target === 'off') {
        updateBattleMap(campaignCode, battleMapId, { gridEnabled: false });
        return;
      }

      const settings: GridSettings = {
        ...DEFAULT_GRID,
        ...battleMap.gridSettings,
        gridType: target,
        hexOrientation: target === 'hex' ? 'pointy' : undefined,
      };
      vp.addGrid(settings);
      pinGridToMapBackgroundLayer(vp);

      updateBattleMap(campaignCode, battleMapId, {
        gridEnabled: true,
        gridSettings: settings,
      });
    },
    [battleMap, campaignCode, battleMapId, getViewport, updateBattleMap]
  );

  return { setGridMode };
}
