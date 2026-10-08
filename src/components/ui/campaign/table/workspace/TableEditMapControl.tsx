'use client';

import { useCallback, useReducer, useEffect, useRef, useState } from 'react';
import { applyCameraView, type Viewport } from '@fieldnotes/core';
import { Maximize, PencilRuler } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { useDmVttGrid } from '@/components/ui/campaign/dm-vtt/useDmVttGrid';
import DmLocationGridPopover from '@/components/ui/campaign/location-map/DmLocationGridPopover';
import {
  reconcileMapFogBounds,
  resolveMapImageBounds,
} from '@/components/ui/campaign/location-map/fog';
import { getViewportFogManager } from '@/lib/fieldnotesVtt';
import type { TableSceneAdapter } from '@/lib/table/sceneAdapter';
import {
  prepareSceneImage,
  type SceneImageDecoder,
  type SceneImageUploader,
} from '@/lib/table/sceneImage';
import type { GridSettings } from '@/types/location';

import {
  replaceSceneMapImage,
  type SceneMapImageWrites,
} from './sceneMapImage';

export const EDIT_MAP_PANEL_ID = 'table-edit-map-panel';
const LIVE_EDIT = 'Editing the shown scene — changes are live';

/**
 * W10 "Edit map" tool group (A4 subset): set/replace the map image, grid
 * on/off/type/size/colour/opacity and fit to map. A tool choice on the one
 * Table canvas — no Setup/Play state, no presentation effect. Every write
 * goes through the scene adapter (and the canvas' own op path), never the
 * legacy battle-map store.
 */
export function TableEditMapControl(props: {
  adapter: TableSceneAdapter;
  viewport: Viewport | null;
  /** The selected scene is the shown, unblanked one (PR04 wording). */
  presentedHere: boolean;
  upload?: SceneImageUploader;
  decode?: SceneImageDecoder;
}) {
  const { adapter, viewport } = props;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  useEffect(() => adapter.subscribe(refresh), [adapter]);
  const fileRef = useRef<HTMLInputElement>(null);
  const battleMap = adapter.getBattleMap();
  const getViewport = useCallback(() => viewport, [viewport]);
  // Scene records hold JSON only (e.g. square grids carry an undefined
  // `hexOrientation`), so grid writes are normalized before persisting.
  const write = useCallback(
    (updates: Parameters<TableSceneAdapter['updateBattleMap']>[0]) =>
      adapter.updateBattleMap(JSON.parse(JSON.stringify(updates))),
    [adapter]
  );
  const grid = useDmVttGrid({
    campaignCode: battleMap?.campaignCode ?? '',
    battleMapId: adapter.sceneId,
    battleMap,
    getViewport,
    updateBattleMap: write,
  });
  const settings = (battleMap?.gridSettings ?? {}) as Partial<GridSettings>;

  const writes: SceneMapImageWrites = {
    isDmOnly: id => adapter.getBattleMap()?.dmOnlyElements[id] === true,
    setDmOnly: (id, dmOnly) => adapter.setDmOnly(id, dmOnly),
    writeSize: size => adapter.updateBattleMap({ mapImageSize: size }),
  };

  async function replaceImage(file: File) {
    if (!viewport) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareSceneImage(file, {
        assetId: `scene-${adapter.sceneId}-${Date.now()}`,
        upload: props.upload,
        decode: props.decode,
      });
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      replaceSceneMapImage(viewport, prepared.url, prepared.size, writes);
      adapter.updateBattleMap({
        mapImageUrl: prepared.url,
        mapImageSize: prepared.size,
      });
      try {
        reconcileMapFogBounds(
          getViewportFogManager(viewport),
          resolveMapImageBounds(viewport.store, prepared.size)
        );
      } catch {
        // Fog bounds stay as they were; fog tools report it.
      }
    } finally {
      setBusy(false);
    }
  }

  const fit = () => {
    if (!viewport) return;
    try {
      const bounds = resolveMapImageBounds(
        viewport.store,
        battleMap?.mapImageSize ?? { w: 1024, h: 1024 }
      );
      const size = viewport.getCanvasSize();
      applyCameraView(viewport.camera, bounds, size.w, size.h);
      viewport.requestRender();
    } catch {
      // No usable map bounds yet.
    }
  };

  return (
    <div className="relative">
      <Button
        variant={open ? 'primary' : 'ghost'}
        className="min-h-[44px] px-2"
        aria-expanded={open}
        aria-controls={EDIT_MAP_PANEL_ID}
        onClick={() => setOpen(value => !value)}
      >
        <PencilRuler size={16} aria-hidden="true" />
        <span className="ml-1.5 text-xs">Edit map</span>
      </Button>
      {open && (
        <div
          id={EDIT_MAP_PANEL_ID}
          role="group"
          aria-label="Edit map"
          className="border-divider bg-surface-raised absolute top-full right-0 z-30 mt-1 flex w-[min(18rem,calc(100vw-1rem))] flex-col gap-2 rounded-lg border p-3 shadow-lg"
        >
          {props.presentedHere && (
            <p className="text-accent-amber-text text-xs" role="status">
              {LIVE_EDIT}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-label="Map image file"
            className="sr-only"
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void replaceImage(file);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !viewport}
            onClick={() => fileRef.current?.click()}
          >
            {battleMap?.mapImageUrl ? 'Replace map image' : 'Set map image'}
          </Button>
          {error && (
            <p role="alert" className="text-accent-red-text text-xs">
              {error}
            </p>
          )}
          <DmLocationGridPopover
            gridEnabled={battleMap?.gridEnabled ?? false}
            gridType={settings.gridType === 'hex' ? 'hex' : 'square'}
            gridCellSize={settings.cellSize ?? 50}
            gridColor={settings.strokeColor ?? '#94a3b8'}
            gridOpacity={settings.opacity ?? 0.5}
            onSetGridType={grid.setGridMode}
            onUpdateGridSettings={grid.updateGridSettings}
          />
          <Button size="sm" variant="ghost" onClick={fit} disabled={!viewport}>
            <Maximize size={14} aria-hidden="true" />
            Fit to map
          </Button>
          <p className="text-muted text-xs">
            Notes and text marked DM-only stay private; players never receive
            them.
          </p>
        </div>
      )}
    </div>
  );
}
