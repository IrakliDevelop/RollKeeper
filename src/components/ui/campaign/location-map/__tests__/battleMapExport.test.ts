import { describe, it, expect, vi } from 'vitest';
import { exportBattleMap } from '../battleMapExport';
import type { ExportCapableViewport } from '../battleMapExport';

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
});
