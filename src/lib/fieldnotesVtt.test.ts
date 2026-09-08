import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Viewport } from '@fieldnotes/core';
import { FogManager } from '@fieldnotes/vtt';
import {
  createRollKeeperFogPlugin,
  fieldnotesElementRegistry,
  getViewportFogManager,
} from './fieldnotesVtt';

function productionState(fog: unknown, extensionFog: unknown): string {
  return JSON.stringify({
    version: 3,
    camera: { position: { x: 12, y: -4 }, zoom: 1.25 },
    elements: [
      {
        id: 'grid-1',
        type: 'grid',
        position: { x: 0, y: 0 },
        zIndex: -1,
        locked: true,
        layerId: 'default-layer',
        gridType: 'square',
        hexOrientation: 'pointy',
        cellSize: 24,
        strokeColor: '#ccc',
        strokeWidth: 1,
        opacity: 0.5,
      },
      {
        id: 'template-1',
        type: 'template',
        position: { x: 120, y: 96 },
        zIndex: 3,
        locked: false,
        layerId: 'default-layer',
        templateShape: 'cone',
        radius: 72,
        angle: 0.5,
        fillColor: '#ff000040',
        strokeColor: '#f00',
        strokeWidth: 2,
        opacity: 0.8,
        feetPerCell: 5,
        radiusFeet: 15,
        renderStyle: 'cells',
      },
    ],
    layers: [
      {
        id: 'default-layer',
        name: 'Map',
        visible: true,
        locked: false,
        order: 0,
        opacity: 1,
      },
    ],
    activeLayerId: 'default-layer',
    fog,
    extensions: { fog: { version: 1, data: extensionFog } },
  });
}

describe('RollKeeper Field Notes VTT v3 boundary', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    const context = new Proxy(
      { canvas: null, measureText: () => ({ width: 0 }) },
      {
        get: (target, key) =>
          key in target ? target[key as keyof typeof target] : vi.fn(),
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    container = document.createElement('div');
    Object.defineProperties(container, {
      clientWidth: { value: 800 },
      clientHeight: { value: 600 },
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('registers legacy and runtime grid/template shapes in the shared registry', () => {
    expect(fieldnotesElementRegistry.getAdapterByLegacyType('grid')?.type).toBe(
      'vtt:grid'
    );
    expect(
      fieldnotesElementRegistry.getAdapterByLegacyType('template')?.type
    ).toBe('vtt:template');
    expect(fieldnotesElementRegistry.getAdapter('vtt:grid')).toBeDefined();
    expect(fieldnotesElementRegistry.getAdapter('vtt:template')).toBeDefined();
  });

  it('loads a production-shaped v3 map and dual-writes legacy fog and extension fog', () => {
    const legacyManager = new FogManager({
      idFactory: () => 'legacy-generation',
    });
    const extensionManager = new FogManager({
      idFactory: () => 'extension-generation',
    });
    const legacyFog = legacyManager.initialize({
      bounds: { x: 0, y: 0, w: 512, h: 512 },
      base: 'revealed',
      cellSize: 16,
    });
    const extensionFog = extensionManager.initialize({
      bounds: { x: 0, y: 0, w: 512, h: 512 },
      base: 'covered',
      cellSize: 32,
    });
    const plugin = createRollKeeperFogPlugin();
    const viewport = new Viewport(container, {
      elementRegistry: fieldnotesElementRegistry,
      plugins: [plugin],
      requiredCapabilities: ['vtt:fog'],
    });

    viewport.loadJSON(productionState(legacyFog, extensionFog));
    expect(viewport.store.getById('grid-1')).toMatchObject({
      type: 'extension',
      extensionType: 'vtt:grid',
      data: { cellSize: 24 },
    });
    expect(viewport.store.getById('template-1')).toMatchObject({
      type: 'extension',
      extensionType: 'vtt:template',
      data: { templateShape: 'cone', radius: 72 },
    });
    expect(getViewportFogManager(viewport)).toBe(plugin.manager);
    expect(plugin.manager.getState()?.definition.base).toBe('covered');

    const exported = JSON.parse(viewport.exportJSON()) as {
      version: number;
      elements: Array<{ type: string }>;
      extensions: { fog: { version: number; data: unknown } };
      fog: unknown;
    };
    expect(exported.version).toBe(3);
    expect(
      exported.elements.map((element: { type: string }) => element.type)
    ).toEqual(['grid', 'template']);
    expect(exported.extensions.fog).toEqual({ version: 1, data: extensionFog });
    expect(exported.fog).toEqual(extensionFog);
    expect(exported.fog).not.toBe(exported.extensions.fog.data);

    viewport.destroy();
  });
});
