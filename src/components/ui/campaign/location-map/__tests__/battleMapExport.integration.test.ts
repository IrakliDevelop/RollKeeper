import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ElementStore,
  createNote,
  createHtmlElement,
  exportImage,
  HtmlPainterRegistry,
  HtmlPainterMissingError,
} from '@fieldnotes/core';
import {
  exportBattleMap,
  type ExportCapableViewport,
} from '../battleMapExport';
import {
  createStandaloneMarkerRegistry,
  MARKER_COLOR_CSS,
} from '../markerPainter';
import {
  MARKER_HTML_TYPE,
  MARKER_HTML_TYPES,
  buildMarkerData,
} from '../markerData';

function vpOver(store: ElementStore): ExportCapableViewport {
  return {
    exportImage: options => exportImage(store, options),
    getVisibleRect: () => ({ x: 0, y: 0, w: 50, h: 50 }),
  };
}

/**
 * jsdom has no canvas: stub getContext/toBlob, capture created canvas sizes.
 * `fillStyle` is upgraded to a recording accessor (get/set via
 * `Object.defineProperty`, the same technique `markerPainter.test.ts` uses
 * for its hand-built fake context) — every assignment is pushed onto a
 * shared array — because jsdom cannot rasterise, so "what colours got
 * assigned" is the only available proof that the marker painter ran. The
 * other context fields stay plain, unobserved fields exactly as before;
 * `widths()`/`heights()` are untouched. `rect` and `clip` are new stub
 * methods (absent before this task, since no prior export test routed an
 * html element to canvas): core's `paintHtmlElement` always clips to the
 * element's rotated rect before invoking the painter, and the marker
 * painter's `door` glyph itself calls `ctx.rect(...)`.
 */
function stubCanvas(): {
  widths: () => number[];
  heights: () => number[];
  fillStyles: () => string[];
} {
  const origCreate = document.createElement.bind(document);
  const created: HTMLCanvasElement[] = [];
  const fillStyleAssignments: string[] = [];
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      created.push(canvas);
      let fillStyleValue = '';
      const ctx: Record<string, unknown> = {
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
        rect: vi.fn(),
        clip: vi.fn(),
        ellipse: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        setLineDash: vi.fn(),
        roundRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 40 }),
        strokeStyle: '',
        lineWidth: 0,
        globalAlpha: 1,
        font: '',
        textBaseline: '',
        textAlign: '',
        lineCap: '',
        lineJoin: '',
      };
      Object.defineProperty(ctx, 'fillStyle', {
        enumerable: true,
        get: () => fillStyleValue,
        set: (value: string) => {
          fillStyleValue = value;
          fillStyleAssignments.push(value);
        },
      });
      vi.spyOn(canvas, 'getContext').mockReturnValue(
        ctx as unknown as CanvasRenderingContext2D
      );
      vi.spyOn(canvas, 'toBlob').mockImplementation((cb, type) => {
        cb(new Blob(['fake'], { type: type ?? 'image/png' }));
      });
    }
    return el;
  });
  return {
    widths: () => created.map(c => c.width),
    heights: () => created.map(c => c.height),
    fillStyles: () => fillStyleAssignments.slice(),
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

function markerElement(overrides: {
  ref: string;
  color: Parameters<typeof buildMarkerData>[0]['color'];
}) {
  return createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    htmlType: MARKER_HTML_TYPE,
    data: {
      ...buildMarkerData({
        kind: 'door',
        ref: overrides.ref,
        color: overrides.color,
      }),
    },
  });
}

describe('battle-map export paints markers with no viewport mounted', () => {
  it('records the marker colour in the exported bytes; a plain note produces no such assignment (positive control)', async () => {
    const markerStore = new ElementStore();
    markerStore.add(markerElement({ ref: 'ref-1', color: 'purple' }));

    const markerStub = stubCanvas();
    await exportBattleMap(vpOver(markerStore), {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 't',
      mapImageSize: { w: 40, h: 40 },
    });
    expect(markerStub.fillStyles()).toContain(MARKER_COLOR_CSS.purple);
    vi.restoreAllMocks();

    // Positive control: a store with only a plain note (no marker painter
    // involved at all) must never incidentally record the marker's colour —
    // otherwise the assertion above would be satisfied by coincidence.
    const noteStore = new ElementStore();
    noteStore.add(
      createNote({ position: { x: 0, y: 0 }, size: { w: 40, h: 40 } })
    );
    const noteStub = stubCanvas();
    await exportBattleMap(vpOver(noteStore), {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 't',
      mapImageSize: { w: 40, h: 40 },
    });
    expect(noteStub.fillStyles()).not.toContain(MARKER_COLOR_CSS.purple);
  });

  it('the player audience filter still drops a dm-only marker; the full audience over the identical store records it (positive control)', async () => {
    const store = new ElementStore();
    const marker = markerElement({ ref: 'ref-2', color: 'amber' });
    store.add(marker);

    const fullStub = stubCanvas();
    await exportBattleMap(vpOver(store), {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 't',
      mapImageSize: { w: 40, h: 40 },
    });
    expect(fullStub.fillStyles()).toContain(MARKER_COLOR_CSS.amber);
    vi.restoreAllMocks();

    const playerStub = stubCanvas();
    await exportBattleMap(vpOver(store), {
      audience: 'player',
      bounds: 'map',
      format: 'png',
      name: 't',
      mapImageSize: { w: 40, h: 40 },
      dmOnlyElements: { [marker.id]: true },
    });
    expect(playerStub.fillStyles()).not.toContain(MARKER_COLOR_CSS.amber);
  });
});

describe('expectedCanvasTypes contract: the only case where it, not expect(), carries weight', () => {
  it('a registry built without expect() still resolves to missing purely from expectedCanvasTypes; createStandaloneMarkerRegistry resolves (positive control)', async () => {
    const store = new ElementStore();
    store.add(markerElement({ ref: 'ref-3', color: 'emerald' }));

    stubCanvas();
    await expect(
      exportImage(store, {
        htmlPainters: new HtmlPainterRegistry(), // no expect(), no register()
        expectedCanvasTypes: MARKER_HTML_TYPES,
        strictMissingCanvasHtml: true,
        region: { x: 0, y: 0, w: 40, h: 40 },
      })
    ).rejects.toBeInstanceOf(HtmlPainterMissingError);
    vi.restoreAllMocks();

    stubCanvas();
    const blob = await exportImage(store, {
      htmlPainters: createStandaloneMarkerRegistry(),
      expectedCanvasTypes: MARKER_HTML_TYPES,
      strictMissingCanvasHtml: true,
      region: { x: 0, y: 0, w: 40, h: 40 },
    });
    expect(blob).not.toBeNull();
  });
});
