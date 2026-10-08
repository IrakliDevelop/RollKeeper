'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { applyCameraView, type Viewport } from '@fieldnotes/core';
import { Maximize, PencilRuler } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import {
  DEFAULT_GRID,
  useDmVttGrid,
} from '@/components/ui/campaign/dm-vtt/useDmVttGrid';
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
  decodeMapImageUrl,
  replaceSceneMapImage,
  type SceneMapImageWrites,
} from './sceneMapImage';

export const EDIT_MAP_PANEL_ID = 'table-edit-map-panel';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tab-order candidates inside `root` (FU-1). */
function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    item => item.tabIndex >= 0
  );
}
const LIVE_EDIT = 'Editing the shown scene — changes are live';
const SCALE_HINT =
  'Changing the grid geometry requires re-verifying the table scale.';

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
  /** PR07 P9: the table reports a verified scale for this (shown) scene. */
  scaleVerifiedHere?: boolean;
  upload?: SceneImageUploader;
  decode?: SceneImageDecoder;
  /** Loads the uploaded image the way the canvas will (F6). */
  probe?: (url: string) => Promise<{ w: number; h: number }>;
  /** F9: image work in flight blocks a scene switch. */
  onBusyChange?: (busy: boolean) => void;
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

  const { onBusyChange } = props;
  // Acceptance A2 / FU-1: the panel is anchored below the button, kept
  // inside the viewport, and follows the anchor (toolbar row, workspace
  // header/dock, scroll, resize) while open.
  const anchorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // R4-3: the dismissal handlers read this; it is set together with the
  // state (never a render behind).
  const busyRef = useRef(busy);
  const updateBusy = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = anchorRef.current;
    const place = () => {
      const rect = anchor?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(288, window.innerWidth - 16);
      const top = rect.bottom + 4;
      const left = Math.max(
        8,
        Math.min(rect.right - width, window.innerWidth - width - 8)
      );
      setPosition(current =>
        current?.top === top && current.left === left ? current : { top, left }
      );
    };
    place();
    // FA2: a pure position shift (e.g. the header growing above the dock
    // row) resizes nothing the observer watches, so also check every frame
    // while open; cancelled on close/unmount.
    let frame = 0;
    const tick = () => {
      place();
      frame = requestAnimationFrame(tick);
    };
    if (typeof requestAnimationFrame === 'function')
      frame = requestAnimationFrame(tick);
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    const targets = [
      anchor,
      anchor?.parentElement,
      anchor?.closest('[data-testid="dm-vtt-command-dock"]'),
    ];
    targets.forEach(target => target && observer?.observe(target));
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  const placed = position !== null;
  useEffect(() => {
    if (!open || !placed) return;
    // FC-4: the first visible control (Set/Replace map image).
    focusables(panelRef.current)[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (busyRef.current) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      setOpen(false);
    };
    // FA1: focus leaving both the button and the panel closes it.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (busyRef.current) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, placed]);

  const onPanelKeyDown = (event: ReactKeyboardEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    if (event.key === 'Escape') {
      // Innermost layer first: an open grid popover handles its own Escape.
      if (panel.querySelector('[aria-expanded="true"]')) return;
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(panel);
    if (event.shiftKey && event.target === items[0]) {
      event.preventDefault();
      buttonRef.current?.focus();
    } else if (!event.shiftKey && event.target === items.at(-1)) {
      event.preventDefault();
      setOpen(false);
      const order = focusables(document.body).filter(
        item => !panel.contains(item)
      );
      const button = buttonRef.current;
      const next = button ? order[order.indexOf(button) + 1] : undefined;
      (next ?? button)?.focus();
    }
  };
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  async function replaceImage(file: File) {
    if (!viewport) return;
    updateBusy(true);
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
      try {
        await (props.probe ?? decodeMapImageUrl)(prepared.url);
      } catch {
        setError('Map image could not be loaded');
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
      updateBusy(false);
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
    <div className="relative" ref={anchorRef}>
      <Button
        ref={buttonRef}
        variant={open ? 'primary' : 'ghost'}
        className="min-h-[44px] px-2"
        aria-expanded={open}
        aria-controls={EDIT_MAP_PANEL_ID}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) setOpen(false);
          // FA1: Tab from the open button enters the portalled panel.
          if (event.key === 'Tab' && !event.shiftKey && open) {
            const first = focusables(panelRef.current)[0];
            if (first) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <PencilRuler size={16} aria-hidden="true" />
        <span className="ml-1.5 text-xs">Edit map</span>
      </Button>
      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            id={EDIT_MAP_PANEL_ID}
            role="group"
            aria-label="Edit map"
            onKeyDown={onPanelKeyDown}
            // Acceptance A2: portalled and fixed so no toolbar strip or dock
            // overflow box can clip it.
            style={{ top: position.top, left: position.left }}
            className="border-divider bg-surface-raised pointer-events-auto fixed z-50 flex w-[min(18rem,calc(100vw-1rem))] flex-col gap-2 rounded-lg border p-3 shadow-lg"
          >
            {props.presentedHere && (
              <p className="text-accent-amber-text text-xs" role="status">
                {LIVE_EDIT}
              </p>
            )}
            {props.scaleVerifiedHere && (
              <p className="text-muted text-xs">{SCALE_HINT}</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              aria-label="Map image file"
              tabIndex={-1}
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
              gridCellSize={settings.cellSize ?? DEFAULT_GRID.cellSize}
              gridColor={settings.strokeColor ?? DEFAULT_GRID.strokeColor}
              gridOpacity={settings.opacity ?? DEFAULT_GRID.opacity}
              onSetGridType={grid.setGridMode}
              onUpdateGridSettings={grid.updateGridSettings}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={fit}
              disabled={!viewport}
            >
              <Maximize size={14} aria-hidden="true" />
              Fit to map
            </Button>
            <p className="text-muted text-xs">
              Notes and text marked DM-only stay private; players never receive
              them.
            </p>
          </div>,
          document.body
        )}
    </div>
  );
}
