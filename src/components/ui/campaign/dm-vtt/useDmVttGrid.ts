'use client';

import { useCallback } from 'react';

import { useBattleMapStore } from '@/store/battleMapStore';
import { pinGridToMapLayer } from '@/components/ui/campaign/location-map/gridPin';

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
      pinGridToMapLayer(vp);

      updateBattleMap(campaignCode, battleMapId, {
        gridEnabled: true,
        gridSettings: settings,
      });
    },
    [battleMap, campaignCode, battleMapId, getViewport, updateBattleMap]
  );

  return { setGridMode };
}
