'use client';

import { useCallback } from 'react';

import { useBattleMapStore } from '@/store/battleMapStore';
import { pinGridToMapLayer } from '@/components/ui/campaign/location-map/gridPin';

import type { Viewport } from '@fieldnotes/core';
import type { BattleMap } from '@/types/battlemap';
import type { GridSettings } from '@/types/location';
import { getVttGridController } from '@/lib/fieldnotesVtt';

/** Mirrors the initial useState defaults in DmLocationEditor.hooks.ts:174-181. */
export const DEFAULT_GRID: Omit<GridSettings, 'gridType' | 'hexOrientation'> = {
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
  /**
   * PR06 W10: where grid fields persist. Absent = the legacy battle-map
   * store (the DM VTT screen); the Table passes its scene adapter writer.
   */
  updateBattleMap?: (updates: Partial<BattleMap>) => void;
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
  updateBattleMap: writeScene,
}: UseDmVttGridOptions) {
  const updateLegacy = useBattleMapStore(s => s.updateBattleMap);
  const updateBattleMap = useCallback(
    (
      _campaignCode: string,
      _battleMapId: string,
      updates: Partial<BattleMap>
    ) =>
      writeScene
        ? writeScene(updates)
        : updateLegacy(_campaignCode, _battleMapId, updates),
    [updateLegacy, writeScene]
  );

  const setGridMode = useCallback(
    (target: 'hex' | 'square' | 'off') => {
      const vp = getViewport();
      if (!vp || !battleMap) return;

      // Always remove the existing grid first, whatever the target.
      if (battleMap.gridEnabled) getVttGridController(vp).remove();

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
      getVttGridController(vp).add(settings);
      pinGridToMapLayer(vp);

      updateBattleMap(campaignCode, battleMapId, {
        gridEnabled: true,
        gridSettings: settings,
      });
    },
    [battleMap, campaignCode, battleMapId, getViewport, updateBattleMap]
  );

  /** Cell size / colour / opacity of the current grid (Edit map, W10). */
  const updateGridSettings = useCallback(
    (settings: Partial<GridSettings>) => {
      const vp = getViewport();
      if (!vp || !battleMap?.gridEnabled) return;
      const current = (battleMap.gridSettings ?? {}) as Partial<GridSettings>;
      const next: GridSettings = {
        ...DEFAULT_GRID,
        gridType: 'square',
        ...current,
        ...settings,
      };
      getVttGridController(vp).update(next);
      updateBattleMap(campaignCode, battleMapId, { gridSettings: next });
    },
    [battleMap, campaignCode, battleMapId, getViewport, updateBattleMap]
  );

  return { setGridMode, updateGridSettings };
}
