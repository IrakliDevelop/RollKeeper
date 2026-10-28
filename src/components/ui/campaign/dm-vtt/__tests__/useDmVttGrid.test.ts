import { cleanup, renderHook } from '@testing-library/react';
import { ElementStore, LayerManager, type Viewport } from '@fieldnotes/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';

const grid = vi.hoisted(() => ({
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@/lib/fieldnotesVtt', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/fieldnotesVtt')>()),
  getVttGridController: () => grid,
}));

import { useDmVttGrid } from '../useDmVttGrid';

const map = {
  id: 'map-1',
  gridEnabled: false,
  gridSettings: undefined,
} as unknown as BattleMap;

function viewport(): Viewport {
  const store = new ElementStore();
  return {
    store,
    layerManager: new LayerManager(store),
    requestRender: vi.fn(),
  } as unknown as Viewport;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useDmVttGrid (W10 refactor, legacy caller unchanged)', () => {
  it('writes the legacy battle-map store when no writer is supplied', () => {
    const updateBattleMap = vi.fn();
    useBattleMapStore.setState({ updateBattleMap });
    const vp = viewport();
    const { result } = renderHook(() =>
      useDmVttGrid({
        campaignCode: 'CAMP',
        battleMapId: 'map-1',
        battleMap: map,
        getViewport: () => vp,
      })
    );
    result.current.setGridMode('square');
    expect(updateBattleMap).toHaveBeenCalledWith('CAMP', 'map-1', {
      gridEnabled: true,
      gridSettings: expect.objectContaining({ gridType: 'square' }),
    });
  });

  it('writes only through the supplied scene writer (Table)', () => {
    const legacy = vi.fn();
    useBattleMapStore.setState({ updateBattleMap: legacy });
    const write = vi.fn();
    const vp = viewport();
    const { result } = renderHook(() =>
      useDmVttGrid({
        campaignCode: 'CAMP',
        battleMapId: 'scene-1',
        battleMap: { ...map, gridEnabled: true } as BattleMap,
        getViewport: () => vp,
        updateBattleMap: write,
      })
    );
    result.current.updateGridSettings({ cellSize: 60, opacity: 0.4 });
    expect(grid.update).toHaveBeenCalledWith(
      expect.objectContaining({ cellSize: 60, opacity: 0.4 })
    );
    expect(write).toHaveBeenCalledWith({
      gridSettings: expect.objectContaining({ cellSize: 60, opacity: 0.4 }),
    });
    result.current.setGridMode('off');
    expect(grid.remove).toHaveBeenCalled();
    expect(write).toHaveBeenLastCalledWith({ gridEnabled: false });
    expect(legacy).not.toHaveBeenCalled();
  });
});
