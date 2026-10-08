import type { Bounds, Camera, Point, Viewport } from '@fieldnotes/core';
import type { GridInfo } from '@fieldnotes/vtt';

import { getVttGridController } from '@/lib/fieldnotesVtt';

/**
 * PR07 P4 / C7-1: calibrated-minis geometry. Scale is C / U where C is the
 * verified CSS px per square and U the scene's square-grid cell size read
 * live from the synced `vtt:grid` element — never a fallback cell unit,
 * the scene record copy or hex spacing.
 */

export interface ZoomLimits {
  min: number;
  max: number;
}

/** Core camera defaults (uncalibrated and unsupported modes). */
export const DEFAULT_ZOOM_LIMITS: ZoomLimits = { min: 0.1, max: 10 };
/** Wider limits only while a calibrated camera is applied. */
export const CALIBRATED_ZOOM_LIMITS: ZoomLimits = { min: 0.02, max: 50 };
export const ZOOM_TOLERANCE = 1e-9;

export type SceneGeometry =
  | { kind: 'square'; cellSize: number; zoom: number }
  | { kind: 'unsupported'; reason: 'grid' | 'range' };

/** P4 gate: square grid, finite positive cell size, scale within limits. */
export function sceneGeometry(
  info: GridInfo | null | undefined,
  cssPxPerSquare: number
): SceneGeometry {
  if (
    !info ||
    info.gridType !== 'square' ||
    typeof info.cellSize !== 'number' ||
    !Number.isFinite(info.cellSize) ||
    info.cellSize <= 0
  )
    return { kind: 'unsupported', reason: 'grid' };
  const zoom = cssPxPerSquare / info.cellSize;
  if (
    !Number.isFinite(zoom) ||
    zoom < CALIBRATED_ZOOM_LIMITS.min ||
    zoom > CALIBRATED_ZOOM_LIMITS.max
  )
    return { kind: 'unsupported', reason: 'range' };
  return { kind: 'square', cellSize: info.cellSize, zoom };
}

/** The scene grid as the display viewport currently holds it, or null. */
export function readGridInfo(viewport: Viewport): GridInfo | null {
  try {
    return getVttGridController(viewport).getInfo();
  } catch {
    return null;
  }
}

export function readSceneGeometry(
  viewport: Viewport,
  cssPxPerSquare: number
): SceneGeometry {
  return sceneGeometry(readGridInfo(viewport), cssPxPerSquare);
}

/**
 * Core types the limits `private readonly`; the installed core assigns them
 * as plain instance fields and reads them on every clamp (C7-1 option a,
 * asserted by test). Changing the limits never changes the current zoom.
 */
type MutableLimits = { minZoom: number; maxZoom: number };

export function setZoomLimits(camera: Camera, limits: ZoomLimits): void {
  const mutable = camera as unknown as MutableLimits;
  mutable.minZoom = limits.min;
  mutable.maxZoom = limits.max;
}

export function zoomLimits(camera: Camera): ZoomLimits {
  const mutable = camera as unknown as MutableLimits;
  return { min: mutable.minZoom, max: mutable.maxZoom };
}

/**
 * Sets the calibrated zoom keeping the world point under `screen` fixed and
 * asserts the camera holds it exactly (no silent clamp). False → the caller
 * must treat the scene as unsupported.
 */
export function applyCalibratedZoom(
  camera: Camera,
  zoom: number,
  screen: Point
): boolean {
  if (
    !Number.isFinite(zoom) ||
    zoom < CALIBRATED_ZOOM_LIMITS.min ||
    zoom > CALIBRATED_ZOOM_LIMITS.max
  )
    return false;
  setZoomLimits(camera, CALIBRATED_ZOOM_LIMITS);
  if (camera.zoom !== zoom) camera.zoomAt(zoom, screen);
  return Math.abs(camera.zoom - zoom) <= ZOOM_TOLERANCE;
}

/** Pans (zoom unchanged) so the bounds' centre sits at the canvas centre. */
export function centreBoundsAt(
  camera: Camera,
  bounds: Bounds,
  size: { w: number; h: number }
): void {
  const zoom = camera.zoom;
  camera.moveTo(
    size.w / 2 - (bounds.x + bounds.w / 2) * zoom,
    size.h / 2 - (bounds.y + bounds.h / 2) * zoom
  );
}
