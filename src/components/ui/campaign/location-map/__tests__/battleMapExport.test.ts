import { describe, it, expect, vi } from 'vitest';
import {
  HtmlPainterRegistry,
  resolveHtmlRouting,
  createHtmlElement,
} from '@fieldnotes/core';
import { exportBattleMap } from '../battleMapExport';
import type { ExportCapableViewport } from '../battleMapExport';
import { MARKER_HTML_TYPE, MARKER_HTML_TYPES } from '../markerData';

function fakeVp(blob: Blob | null = new Blob(['x'], { type: 'image/png' })) {
  return {
    exportImage: vi.fn().mockResolvedValue(blob),
    getVisibleRect: vi.fn().mockReturnValue({ x: 5, y: 6, w: 70, h: 80 }),
  } satisfies ExportCapableViewport;
}

describe('exportBattleMap', () => {
  it('exports the whole map as a region from mapImageSize', async () => {
    const vp = fakeVp();
    await exportBattleMap(vp, {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 'Cave',
      mapImageSize: { w: 1200, h: 900 },
    });
    expect(vp.exportImage).toHaveBeenCalledWith(
      expect.objectContaining({
        region: { x: 0, y: 0, w: 1200, h: 900 },
        scale: 2,
        scaleMode: 'fit',
        format: 'png',
      })
    );
    const options = vp.exportImage.mock.calls[0][0];
    expect(options.filter).toBeUndefined();
    expect(options.quality).toBeUndefined();
  });

  it('exports the current view via getVisibleRect', async () => {
    const vp = fakeVp();
    await exportBattleMap(vp, {
      audience: 'full',
      bounds: 'view',
      format: 'png',
      name: 'Cave',
    });
    expect(vp.exportImage).toHaveBeenCalledWith(
      expect.objectContaining({ region: { x: 5, y: 6, w: 70, h: 80 } })
    );
  });

  it('falls back to content bounds without mapImageSize', async () => {
    const vp = fakeVp();
    await exportBattleMap(vp, {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 'Cave',
    });
    expect(vp.exportImage.mock.calls[0][0].region).toBeUndefined();
  });

  it('filters dm-only elements for the player-view audience', async () => {
    const vp = fakeVp();
    await exportBattleMap(vp, {
      audience: 'player',
      bounds: 'map',
      format: 'png',
      name: 'Cave',
      mapImageSize: { w: 100, h: 100 },
      dmOnlyElements: { secret: true, revealed: false },
    });
    const filter = vp.exportImage.mock.calls[0][0].filter;
    expect(filter).toBeDefined();
    expect(filter({ id: 'secret' })).toBe(false);
    expect(filter({ id: 'revealed' })).toBe(true);
    expect(filter({ id: 'other' })).toBe(true);
  });

  it('plumbs jpeg quality and builds the filename', async () => {
    const vp = fakeVp(new Blob(['x'], { type: 'image/jpeg' }));
    const { filename } = await exportBattleMap(vp, {
      audience: 'player',
      bounds: 'view',
      format: 'jpeg',
      name: 'Goblin Cave!',
    });
    expect(vp.exportImage).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'jpeg', quality: 0.85 })
    );
    expect(filename).toBe('goblin-cave-player-view.jpg');
  });

  it('labels a full-audience current-view export "view" and a whole-map export "full"', async () => {
    const view = await exportBattleMap(fakeVp(), {
      audience: 'full',
      bounds: 'view',
      format: 'png',
      name: 'Cave',
    });
    expect(view.filename).toBe('cave-view.png');
    const full = await exportBattleMap(fakeVp(), {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 'Cave',
      mapImageSize: { w: 100, h: 100 },
    });
    expect(full.filename).toBe('cave-full.png');
  });

  it('throws when the export yields no blob', async () => {
    const vp = fakeVp(null);
    await expect(
      exportBattleMap(vp, {
        audience: 'full',
        bounds: 'map',
        format: 'png',
        name: 'Cave',
      })
    ).rejects.toThrow('no image');
  });

  it('omits region when mapImageSize width is zero', async () => {
    const vp = fakeVp();
    await exportBattleMap(vp, {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 'Cave',
      mapImageSize: { w: 0, h: 100 },
    });
    const options = vp.exportImage.mock.calls[0][0];
    expect(options.region).toBeUndefined();
  });

  it('defines a filter that returns true for any id when dmOnlyElements is omitted for player audience', async () => {
    const vp = fakeVp();
    await exportBattleMap(vp, {
      audience: 'player',
      bounds: 'map',
      format: 'png',
      name: 'Cave',
      mapImageSize: { w: 100, h: 100 },
    });
    const filter = vp.exportImage.mock.calls[0][0].filter;
    expect(filter).toBeDefined();
    expect(filter({ id: 'anything' })).toBe(true);
  });
});

describe('exportBattleMap marker registry wiring', () => {
  it('passes a standalone HtmlPainterRegistry, expectedCanvasTypes identical to MARKER_HTML_TYPES, and strict mode', async () => {
    const vp = fakeVp();
    await exportBattleMap(vp, {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 'Cave',
      mapImageSize: { w: 100, h: 100 },
    });
    const options = vp.exportImage.mock.calls[0][0];
    expect(options.htmlPainters).toBeInstanceOf(HtmlPainterRegistry);
    // Identity, not structural equality: a future edit that swaps in a new
    // Set with the same members would defeat the intent of "reuse the
    // shared constant" and this must catch it.
    expect(options.expectedCanvasTypes).toBe(MARKER_HTML_TYPES);
    expect(options.strictMissingCanvasHtml).toBe(true);
  });

  it('wires a registry that is live: a marker element routes to canvas and has an active painter', async () => {
    const vp = fakeVp();
    await exportBattleMap(vp, {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 'Cave',
      mapImageSize: { w: 100, h: 100 },
    });
    const options = vp.exportImage.mock.calls[0][0];
    const registry = options.htmlPainters as HtmlPainterRegistry;
    const markerElement = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
    });
    expect(resolveHtmlRouting(markerElement, registry)).toBe('canvas');
    expect(registry.getActivePainter(MARKER_HTML_TYPE)).toBeDefined();
  });

  it('builds a fresh registry per export call', async () => {
    const vp = fakeVp();
    const req = {
      audience: 'full' as const,
      bounds: 'map' as const,
      format: 'png' as const,
      name: 'Cave',
      mapImageSize: { w: 100, h: 100 },
    };
    await exportBattleMap(vp, req);
    await exportBattleMap(vp, req);
    const first = vp.exportImage.mock.calls[0][0].htmlPainters;
    const second = vp.exportImage.mock.calls[1][0].htmlPainters;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
  });
});
