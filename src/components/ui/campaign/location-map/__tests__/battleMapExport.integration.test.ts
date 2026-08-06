import { describe, it, expect, vi, afterEach } from 'vitest';
import { ElementStore, createNote, exportImage } from '@fieldnotes/core';
import {
  exportBattleMap,
  type ExportCapableViewport,
} from '../battleMapExport';

function vpOver(store: ElementStore): ExportCapableViewport {
  return {
    exportImage: options => exportImage(store, options),
    getVisibleRect: () => ({ x: 0, y: 0, w: 50, h: 50 }),
  };
}

/** jsdom has no canvas: stub getContext/toBlob, capture created canvas sizes. */
function stubCanvas(): { widths: () => number[]; heights: () => number[] } {
  const origCreate = document.createElement.bind(document);
  const created: HTMLCanvasElement[] = [];
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      created.push(canvas);
      vi.spyOn(canvas, 'getContext').mockReturnValue({
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        fillRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        ellipse: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        setLineDash: vi.fn(),
        roundRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 40 }),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        globalAlpha: 1,
        font: '',
        textBaseline: '',
        textAlign: '',
        lineCap: '',
        lineJoin: '',
      } as unknown as CanvasRenderingContext2D);
      vi.spyOn(canvas, 'toBlob').mockImplementation((cb, type) => {
        cb(new Blob(['fake'], { type: type ?? 'image/png' }));
      });
    }
    return el;
  });
  return {
    widths: () => created.map(c => c.width),
    heights: () => created.map(c => c.height),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('battle-map export against the real SDK pipeline', () => {
  it('player-view export omits a dm-only element that full export includes', async () => {
    const store = new ElementStore();
    const visible = createNote({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
    });
    const secret = createNote({
      position: { x: 200, y: 200 },
      size: { w: 40, h: 40 },
    });
    store.add(visible);
    store.add(secret);

    // No region (no mapImageSize) → real SDK content bounds: the dm-only note at
    // (200,200) stretches the full export; filtering it must shrink the player export.
    const fullStub = stubCanvas();
    const full = await exportBattleMap(vpOver(store), {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 't',
    });
    const fullWidth = Math.max(...fullStub.widths());
    const fullHeight = Math.max(...fullStub.heights());
    vi.restoreAllMocks();

    const playerStub = stubCanvas();
    const player = await exportBattleMap(vpOver(store), {
      audience: 'player',
      bounds: 'map',
      format: 'png',
      name: 't',
      dmOnlyElements: { [secret.id]: true },
    });
    const playerWidth = Math.max(...playerStub.widths());
    const playerHeight = Math.max(...playerStub.heights());

    expect(full.filename).toBe('t-full.png');
    expect(player.filename).toBe('t-player-view.png');
    expect(fullWidth).toBe(480); // (0..240) content bounds × scale 2
    expect(fullHeight).toBe(480); // (0..240) content bounds × scale 2
    expect(playerWidth).toBe(80); // (0..40) × scale 2 — secret note excluded
    expect(playerHeight).toBe(80); // (0..40) × scale 2 — secret note excluded
    expect(fullWidth).toBeGreaterThan(playerWidth);
  });
});
