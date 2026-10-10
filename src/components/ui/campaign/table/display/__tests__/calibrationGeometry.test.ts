import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Camera, HandTool, type Viewport } from '@fieldnotes/core';
import { createGrid, gridElementTypeDefinition } from '@fieldnotes/vtt';

import {
  fieldnotesElementRegistry,
  getVttGridController,
} from '@/lib/fieldnotesVtt';
import {
  mountRealViewport,
  type RealViewportHarness,
} from '@/test/realViewport';
import {
  CALIBRATED_ZOOM_LIMITS,
  DEFAULT_ZOOM_LIMITS,
  applyCalibratedZoom,
  centreBoundsAt,
  readSceneGeometry,
  sceneGeometry,
  setZoomLimits,
  zoomLimits,
} from '../calibration/geometry';

/**
 * P4 geometry gate and C7-1 zoom limits against the real core camera and
 * the real @fieldnotes/vtt grid controller on a real jsdom Viewport.
 */

const harnesses: RealViewportHarness[] = [];
function mount(): Viewport {
  const harness = mountRealViewport({
    elementRegistry: fieldnotesElementRegistry,
  });
  harness.viewport.toolManager.register(new HandTool());
  harness.viewport.setTool('hand');
  harnesses.push(harness);
  return harness.viewport;
}

/** Adds a synced-looking `vtt:grid` envelope with a raw (unvalidated) cell size. */
function addGrid(
  viewport: Viewport,
  gridType: 'square' | 'hex',
  cellSize: number
) {
  const adapter = fieldnotesElementRegistry.getAdapter('vtt:grid')!;
  const envelope = adapter.wrap(
    createGrid({ gridType, cellSize: 50, layerId: 'map' })
  ) as unknown as { data: Record<string, unknown> };
  envelope.data = { ...envelope.data, cellSize };
  viewport.store.add(envelope as never, { origin: 'remote' });
}

afterEach(() => {
  cleanup();
  for (const harness of harnesses.splice(0)) harness.destroy();
});

describe('square-grid geometry gate (P4)', () => {
  it('square cell 50 with C = 96 → scale 1.92 exactly', () => {
    const viewport = mount();
    addGrid(viewport, 'square', 50);
    const geometry = readSceneGeometry(viewport, 96);
    expect(geometry).toEqual({ kind: 'square', cellSize: 50, zoom: 1.92 });
    expect(applyCalibratedZoom(viewport.camera, 1.92, { x: 500, y: 400 })).toBe(
      true
    );
    expect(viewport.camera.zoom).toBe(1.92);
    // C CSS px per square: zoom × U.
    expect(viewport.camera.zoom * 50).toBeCloseTo(96, 12);
  });

  it.each([
    ['hex', 'hex', 50],
    ['NaN', 'square', Number.NaN],
    ['Infinity', 'square', Number.POSITIVE_INFINITY],
    ['zero', 'square', 0],
    ['negative', 'square', -50],
  ] as const)('%s grid → unsupported', (_name, gridType, cellSize) => {
    const viewport = mount();
    addGrid(viewport, gridType, cellSize);
    expect(readSceneGeometry(viewport, 96)).toEqual({
      kind: 'unsupported',
      reason: 'grid',
    });
  });

  it('grid off, DM-only (never delivered) or missing → unsupported, never a 40 fallback', () => {
    const viewport = mount();
    expect(getVttGridController(viewport).getInfo()).toBeNull();
    expect(readSceneGeometry(viewport, 96)).toEqual({
      kind: 'unsupported',
      reason: 'grid',
    });
    // A grid removed in place (grid "off").
    addGrid(viewport, 'square', 50);
    expect(readSceneGeometry(viewport, 96).kind).toBe('square');
    getVttGridController(viewport).remove();
    expect(readSceneGeometry(viewport, 96)).toEqual({
      kind: 'unsupported',
      reason: 'grid',
    });
  });

  it('never applies hex spacing: hex info is rejected before any scale is derived', () => {
    expect(
      sceneGeometry(
        {
          gridType: 'hex',
          hexOrientation: 'pointy',
          cellSize: 50,
          cellRadius: 50,
        },
        96
      )
    ).toEqual({ kind: 'unsupported', reason: 'grid' });
    expect(sceneGeometry(null, 96)).toEqual({
      kind: 'unsupported',
      reason: 'grid',
    });
  });

  it('a scale outside [0.02, 50] is unsupported (no silent clamp)', () => {
    const info = (cellSize: number) => ({
      gridType: 'square' as const,
      hexOrientation: 'pointy' as const,
      cellSize,
      cellRadius: cellSize / 2,
    });
    expect(sceneGeometry(info(10), 1000)).toEqual({
      kind: 'unsupported',
      reason: 'range',
    });
    expect(sceneGeometry(info(1000), 8)).toEqual({
      kind: 'unsupported',
      reason: 'range',
    });
    expect(sceneGeometry(info(20), 1000)).toEqual({
      kind: 'square',
      cellSize: 20,
      zoom: 50,
    });
    // The apply assertion rejects anything the camera would clamp.
    const camera = new Camera();
    expect(applyCalibratedZoom(camera, 60, { x: 0, y: 0 })).toBe(false);
  });
});

describe('runtime zoom limits (C7-1 option a)', () => {
  it('the installed core honours runtime-assigned limits', () => {
    const camera = new Camera();
    expect(zoomLimits(camera)).toEqual(DEFAULT_ZOOM_LIMITS);
    camera.setZoom(40);
    expect(camera.zoom).toBe(10);
    setZoomLimits(camera, CALIBRATED_ZOOM_LIMITS);
    expect(zoomLimits(camera)).toEqual(CALIBRATED_ZOOM_LIMITS);
    camera.setZoom(40);
    expect(camera.zoom).toBe(40);
    camera.setZoom(0.03);
    expect(camera.zoom).toBe(0.03);
  });

  it('changing the limits never changes the current zoom or translation', () => {
    const camera = new Camera();
    setZoomLimits(camera, CALIBRATED_ZOOM_LIMITS);
    camera.setZoom(25);
    camera.moveTo(-123.25, 456.5);
    const before = { ...camera.position, zoom: camera.zoom };
    setZoomLimits(camera, DEFAULT_ZOOM_LIMITS);
    expect({ ...camera.position, zoom: camera.zoom }).toEqual(before);
  });

  it('uncalibrated wheel zoom on a real viewport stays clamped to [0.1, 10]', () => {
    const viewport = mount();
    const wrapper = viewport.domLayer.parentElement!;
    for (let index = 0; index < 200; index += 1)
      wrapper.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -500,
          clientX: 10,
          clientY: 10,
          bubbles: true,
          cancelable: true,
        })
      );
    expect(viewport.camera.zoom).toBe(10);
    for (let index = 0; index < 400; index += 1)
      wrapper.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: 500,
          clientX: 10,
          clientY: 10,
          bubbles: true,
          cancelable: true,
        })
      );
    expect(viewport.camera.zoom).toBe(0.1);
  });

  it('calibrated zoom keeps the world point under the given screen point', () => {
    const camera = new Camera();
    camera.moveTo(37, -12);
    const centre = { x: 500, y: 400 };
    const world = camera.screenToWorld(centre);
    expect(applyCalibratedZoom(camera, 1.92, centre)).toBe(true);
    const after = camera.worldToScreen(world);
    expect(after.x).toBeCloseTo(centre.x, 9);
    expect(after.y).toBeCloseTo(centre.y, 9);
  });

  it('arrival camera centres content bounds at the canvas centre at fixed zoom', () => {
    const camera = new Camera();
    applyCalibratedZoom(camera, 1.92, { x: 0, y: 0 });
    centreBoundsAt(
      camera,
      { x: 100, y: 200, w: 400, h: 300 },
      { w: 1000, h: 800 }
    );
    expect(camera.zoom).toBe(1.92);
    const centre = camera.worldToScreen({ x: 300, y: 350 });
    expect(centre.x).toBeCloseTo(500, 9);
    expect(centre.y).toBeCloseTo(400, 9);
  });
});

it('grid definition stays the installed vtt codec', () => {
  expect(gridElementTypeDefinition.type).toBe('vtt:grid');
});
