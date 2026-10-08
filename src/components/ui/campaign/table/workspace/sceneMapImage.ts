'use client';

import { useEffect, useRef } from 'react';
import {
  createImage,
  type CanvasElement,
  type ElementStore,
} from '@fieldnotes/core';

import { MAP_LAYER_ID } from '@/components/ui/campaign/location-map/layerContract';
import { assetProxyUrl } from '@/utils/assetProxyUrl';

type ImageElement = Extract<CanvasElement, { type: 'image' }>;
type Size = { w: number; h: number };

/** The scene-adapter writes the map-image steps need (W10, R3-F3). */
export interface SceneMapImageWrites {
  isDmOnly(elementId: string): boolean;
  setDmOnly(elementId: string, dmOnly: boolean): void;
  writeSize(size: Size): void;
}

interface Target {
  store: Pick<ElementStore, 'getAll' | 'add' | 'update' | 'getById'>;
  requestRender?: () => void;
}

/** Every image on the map layer, lowest z first (C6-1 detection). */
export function mapLayerImages(
  store: Pick<ElementStore, 'getAll'>
): ImageElement[] {
  return store
    .getAll()
    .filter(
      (element): element is ImageElement =>
        element.type === 'image' && element.layerId === MAP_LAYER_ID
    )
    .sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0));
}

/** The map image is always public: undo hidden placement for it (C6-1). */
function keepPublic(target: Target, id: string, writes: SceneMapImageWrites) {
  if (!writes.isDmOnly(id)) return;
  writes.setDmOnly(id, false);
  // Re-emit so the sync client re-stamps a public audience.
  target.store.update(id, {});
}

function addMapImage(
  target: Target,
  url: string,
  size: Size,
  writes: SceneMapImageWrites
): void {
  const image = {
    ...createImage({
      position: { x: 0, y: 0 },
      size: { w: size.w, h: size.h },
      src: assetProxyUrl(url),
      layerId: MAP_LAYER_ID,
    }),
    locked: true,
  } as CanvasElement;
  target.store.add(image);
  keepPublic(target, image.id, writes);
  target.requestRender?.();
}

/** Natural size through the same proxied, CORS-safe URL the canvas loads. */
export function decodeMapImageUrl(url: string): Promise<Size> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () =>
      resolve({ w: image.naturalWidth, h: image.naturalHeight });
    image.onerror = () => reject(new Error('undecodable'));
    image.src = assetProxyUrl(url);
  });
}

/**
 * R3-F3: the one idempotent "ensure map image" step. With a map image URL
 * and NO image on the map layer (locked or not), add exactly one locked,
 * public image through the proxied URL at `mapImageSize` (natural size when
 * 0×0, written back through the adapter). Otherwise do nothing.
 */
export async function ensureSceneMapImage(
  target: Target,
  map: { mapImageUrl: string; mapImageSize: Size },
  writes: SceneMapImageWrites,
  decode: (url: string) => Promise<Size> = decodeMapImageUrl
): Promise<'none' | 'present' | 'added'> {
  if (!map.mapImageUrl) return 'none';
  if (mapLayerImages(target.store).length > 0) return 'present';
  let size = map.mapImageSize;
  if (!(size.w > 0 && size.h > 0)) {
    try {
      size = await decode(map.mapImageUrl);
    } catch {
      return 'none';
    }
    if (!(size.w > 0 && size.h > 0)) return 'none';
    writes.writeSize(size);
    // A snapshot may have arrived while decoding.
    if (mapLayerImages(target.store).length > 0) return 'present';
  }
  addMapImage(target, map.mapImageUrl, size, writes);
  return 'added';
}

/**
 * W10(a): replace the lowest-z locked map image (or the lowest-z image when
 * none is locked) in place, keeping exactly one per slot; add one if the
 * map layer has none.
 */
export function replaceSceneMapImage(
  target: Target,
  url: string,
  size: Size,
  writes: SceneMapImageWrites
): 'replaced' | 'added' {
  const images = mapLayerImages(target.store);
  const slot = images.find(image => image.locked) ?? images[0];
  if (!slot) {
    addMapImage(target, url, size, writes);
    return 'added';
  }
  target.store.update(slot.id, {
    src: assetProxyUrl(url),
    size: { w: size.w, h: size.h },
    locked: true,
  } as Partial<CanvasElement>);
  keepPublic(target, slot.id, writes);
  target.requestRender?.();
  return 'replaced';
}

const TERMINAL = new Set(['denied', 'upgrade-required', 'stopped']);

/**
 * C6-1: runs `ensureSceneMapImage` from a React effect AFTER the canvas has
 * applied its initial state — once the relay status `live` committed (the
 * authority handler loads the snapshot synchronously right after reporting
 * it), or after the local load when no relay is configured or the room
 * refused us. Once per (viewport, phase).
 */
export function useEnsureSceneMapImage(options: {
  viewport: Target | null;
  relayConfigured: boolean;
  relayStatus: string;
  map: { mapImageUrl: string; mapImageSize: Size } | null;
  writes: SceneMapImageWrites;
}) {
  const { viewport, relayConfigured, relayStatus, map } = options;
  const latest = useRef(options);
  latest.current = options;
  const done = useRef<{ viewport: unknown; phases: Set<string> }>({
    viewport: null,
    phases: new Set(),
  });
  const phase = !relayConfigured
    ? 'local'
    : relayStatus === 'live'
      ? 'live'
      : TERMINAL.has(relayStatus)
        ? 'local'
        : null;
  const url = map?.mapImageUrl ?? '';
  useEffect(() => {
    if (!viewport || phase === null || !url) return;
    if (done.current.viewport !== viewport)
      done.current = { viewport, phases: new Set() };
    if (done.current.phases.has(phase)) return;
    done.current.phases.add(phase);
    const current = latest.current;
    if (!current.map) return;
    void ensureSceneMapImage(viewport, current.map, current.writes);
  }, [phase, url, viewport]);
}
