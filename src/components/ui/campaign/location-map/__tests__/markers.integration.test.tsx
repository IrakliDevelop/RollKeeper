import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import {
  ElementStore,
  SelectTool,
  Viewport,
  createNote,
  createHtmlElement,
  exportImage,
  resolveHtmlRouting,
  type ExportImageOptions,
  type HtmlElement,
  type HtmlPainter,
} from '@fieldnotes/core';

import {
  createManagedBattleMapConnection,
  type BattleMapTransport,
} from '@/lib/battlemapSync';
import {
  exportBattleMap,
  type ExportCapableViewport,
} from '../battleMapExport';
import { createMarker, guardLocalMarkerAdd } from '../markerWrites';
import type { MarkerWriteDeps } from '../markerWrites';
import { DM_AUDIENCE, MARKER_HTML_TYPE, buildMarkerData } from '../markerData';
import type { MarkerColorKey, MarkerKind } from '../markerData';
import { MARKER_COLOR_CSS } from '../markerPainter';
import { DmMarkerTool, MARKER_TOOL_NAME } from '../DmMarkerTool';
import type { PlaceMarkerRequest } from '../DmMarkerTool';
import {
  CANVAS_WRITING_TOOL_NAMES,
  useMarkerRegistration,
} from '../useMarkerRegistration';

import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';

/**
 * Real-SDK integration suite for map markers (task B12).
 *
 * Zero `@fieldnotes` module mocks anywhere in this file: a real `Viewport`,
 * a real `ElementStore`, the real `HtmlPainterRegistry` a `Viewport` owns,
 * the real `exportImage`, and the real `createManagedBattleMapConnection` /
 * `SyncClient` run end to end. The ONLY stub is the canvas-2D seam
 * (`document.createElement('canvas')` -> `getContext` / `toBlob`), which jsdom
 * does not implement — the same seam `battleMapExport.integration.test.ts` and
 * `selectionEvents.integration.test.tsx` already stub.
 *
 * What each test here proves that no unit test can:
 *  1. the DM audience stamp reaches the WIRE on the marker's very first
 *     outbound upsert — observed by parsing `FakeTransport.sent`, never from
 *     React or product state;
 *  3. markers paint into an export with no `Viewport` constructed at all;
 *  4. a Strict-Mode remount leaves the painter active on a REAL `Viewport`;
 *  5. two REAL `Viewport`s register independently.
 *
 * (2 — six-feature presence coexistence on one connection — lives in
 * `src/lib/battlemapSync.test.ts` beside the five-feature test it extends.)
 *
 * Tests 4 and 5 duplicate `useMarkerRegistration.test.tsx` cases that run
 * against a recording double. The duplication is deliberate: their value here
 * is that a REAL `Viewport`, its real live registry and a real render loop are
 * under them, so a hook that happened to satisfy the double's structural
 * contract but not the SDK's would be caught. Their names say so.
 */

const CODE = 'CAMP1';
const MAP_ID = 'map-1';

// ---------------------------------------------------------------------------
// Canvas-2D seam
// ---------------------------------------------------------------------------

/**
 * jsdom has no canvas 2D context. Stub `getContext`/`toBlob` on every canvas
 * created while the stub is installed, and upgrade `fillStyle` to a recording
 * accessor so "which colours were assigned" is observable — the only available
 * proof that a painter ran, since jsdom cannot rasterise.
 *
 * `rect` and `clip` are NOT optional here: core's `paintHtmlElement` calls
 * `beginPath` -> `rect` -> `clip` before invoking any painter, and a
 * `TypeError` thrown inside that sequence is swallowed into a non-fatal
 * `painter-threw` diagnostic. A stub missing either method turns every painter
 * assertion in this file into a silent false negative (found and fixed in
 * task B9).
 */
function stubCanvas(): { fillStyles: () => string[] } {
  const origCreate = document.createElement.bind(document);
  const fillStyleAssignments: string[] = [];
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      let fillStyleValue = '';
      const ctx: Record<string, unknown> = {
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
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
        createLinearGradient: vi.fn(),
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
  return { fillStyles: () => fillStyleAssignments.slice() };
}

// ---------------------------------------------------------------------------
// Transport-boundary harness
// ---------------------------------------------------------------------------

/**
 * The `BattleMapTransport` subset of the `FakeTransport` harness from
 * `src/lib/battlemapSync.test.ts:49-87` — this copy omits `emitReconnect`
 * and `emitClose`, which nothing in this file exercises.
 * Duplicated rather than imported: importing a `*.test.ts` module would
 * execute its `describe` blocks a second time inside this file's run. Same
 * reasoning as the duplicated fake 2D context in `useMarkerRegistration.test.tsx`.
 */
class FakeTransport implements BattleMapTransport {
  sent: string[] = [];
  closed = false;
  private msgHandlers = new Set<(message: string) => void>();
  private reconnectHandlers = new Set<() => void>();
  private closeHandlers = new Set<(code: number, reason: string) => void>();

  send(message: string): void {
    this.sent.push(message);
  }
  onMessage(handler: (message: string) => void): () => void {
    this.msgHandlers.add(handler);
    return () => this.msgHandlers.delete(handler);
  }
  onReconnect(handler: () => void): () => void {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }
  onClose(handler: (code: number, reason: string) => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }
  close(): void {
    this.closed = true;
    this.msgHandlers.clear();
    this.reconnectHandlers.clear();
    this.closeHandlers.clear();
  }

  emitMessage(message: string): void {
    for (const h of [...this.msgHandlers]) h(message);
  }
}

/** Flush the async token mint. */
const flush = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 0));

const snapshotEnvelope = (to: string): string =>
  JSON.stringify({ from: 'hub', op: { kind: 'snapshot', to, elements: [] } });

interface SentElement {
  id: string;
  audience?: string;
  type?: string;
}
interface SentEnvelope {
  op: { kind: string; element?: SentElement };
}

/**
 * Every upsert that reached the WIRE for `elementId`, oldest first. Index 0 is
 * therefore literally the FIRST outbound upsert for that element — the only
 * frame that can prove there was no one-frame leak before a later re-emit
 * corrected the audience.
 */
function upsertsFor(sent: readonly string[], elementId: string): SentElement[] {
  const elements: SentElement[] = [];
  for (const raw of sent) {
    const envelope = JSON.parse(raw) as SentEnvelope;
    const element = envelope.op.element;
    if (envelope.op.kind !== 'upsert' || !element) continue;
    if (element.id !== elementId) continue;
    elements.push(element);
  }
  return elements;
}

// ---------------------------------------------------------------------------
// Product state
// ---------------------------------------------------------------------------

function battleMapFixture(): BattleMap {
  return {
    id: MAP_ID,
    campaignCode: CODE,
    name: 'Battle map',
    mapImageUrl: 'https://example.test/bm.png',
    mapImageSize: { w: 100, h: 100 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    linkedEncounterIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * `MarkerWriteDeps` bound to the REAL battle-map Zustand store and to the real
 * canvas `ElementStore` — the same binding `useMarkerWrites.makeDeps` performs
 * for the battlemap surface, minus the React layer (which this test must not
 * read). Every accessor reads `useBattleMapStore.getState()` at call time, so
 * `resolveAudience` and `createMarker` observe the same live product state.
 */
function realProductStateDeps(store: ElementStore): MarkerWriteDeps {
  const readMap = () => useBattleMapStore.getState().getBattleMap(CODE, MAP_ID);
  return {
    store,
    transaction: operation => operation(),
    getMarkers: () => readMap()?.markers ?? [],
    setMarkers: next =>
      useBattleMapStore
        .getState()
        .updateBattleMap(CODE, MAP_ID, { markers: next }),
    getDmOnlyElements: () => readMap()?.dmOnlyElements ?? {},
    setDmOnly: (elementId, dmOnly) =>
      useBattleMapStore.getState().setDmOnly(CODE, MAP_ID, elementId, dmOnly),
    setDmOnlyBulk: () => {
      throw new Error('setDmOnlyBulk is not exercised by createMarker');
    },
    reemitAudience: true,
  };
}

// ---------------------------------------------------------------------------
// 1. The first outbound upsert carries the DM audience
// ---------------------------------------------------------------------------

describe('markers over the real sync connection: the DM audience reaches the wire', () => {
  let fakeTransport: FakeTransport;
  // Hoisted so `afterEach` can always dispose it, even when an earlier
  // assertion in the test throws: an inline `conn.stop()` at the end of the
  // test body would never run on failure, leaving the `SyncClient` attached
  // to the `ElementStore` and the transport open for the rest of the file's
  // run.
  let conn: ReturnType<typeof createManagedBattleMapConnection> | undefined;

  beforeEach(() => {
    fakeTransport = new FakeTransport();
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      })
    );
  });

  afterEach(() => {
    conn?.stop();
    conn = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useBattleMapStore.setState({ battleMaps: {} });
  });

  /**
   * A live DM connection over the fake transport, with `resolveAudience` wired
   * exactly as `DmLocationEditor.hooks.ts:623-627` and
   * `DmBattleMapCanvas.hooks.ts` wire it: read `dmOnlyElements` out of product
   * state AT SEND TIME (never a captured snapshot), and stamp `DM_AUDIENCE`,
   * which is now the exact value both shipped call sites import.
   *
   * What this test pins is the WIRE ORDERING — that the audience is already on
   * the marker's first outbound upsert — with a hand-wired `resolveAudience`
   * standing in for the surfaces' own. It does NOT pin that the surfaces send
   * this particular value: that is closed structurally instead, by the two
   * surfaces importing `DM_AUDIENCE` rather than repeating a literal, plus
   * `markerData.test.ts`'s assertion that `DM_AUDIENCE === 'dm'`.
   */
  const startLiveDmConnection = async (store: ElementStore) => {
    conn = createManagedBattleMapConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: CODE,
      battleMapId: MAP_ID,
      store,
      clientId: 'dm-1',
      tokenRequest: { role: 'dm', battleMapId: MAP_ID, dmId: 'dm-1' },
      seedLocal: true,
      resolveAudience: el =>
        useBattleMapStore.getState().battleMaps[CODE]?.[MAP_ID]?.dmOnlyElements[
          el.id
        ]
          ? 'dm'
          : undefined,
      transportFactory: () => fakeTransport,
    });
    await flush();
    fakeTransport.emitMessage(snapshotEnvelope('dm-1'));
    return conn;
  };

  it("the marker's FIRST outbound upsert already carries the DM audience, and an unmarked element's first upsert carries none (positive control)", async () => {
    const store = new ElementStore();
    await startLiveDmConnection(store);

    // Positive control FIRST, over the identical live connection and the
    // identical wire observation: an element created with no DM-only mark
    // reaches the wire with NO audience at all. Without this, "audience ===
    // 'dm'" could be satisfied by a fixture that stamps everything, and the
    // transport observation itself would be unproven.
    const plain = createNote({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
    });
    store.add(plain);
    const plainUpserts = upsertsFor(fakeTransport.sent, plain.id);
    expect(plainUpserts.length).toBeGreaterThan(0);
    expect(plainUpserts[0]?.audience).toBeUndefined();

    // The real §6.7 create path, driven through the function that owns the
    // ordering. Nothing here reads React state.
    const result = createMarker(realProductStateDeps(store), {
      kind: 'trap',
      color: 'purple',
      position: { x: 10, y: 20 },
      size: { w: 40, h: 40 },
      layerId: 'layer-1',
      title: 'Pit trap',
      body: 'DC 15 dex save',
      dmNotes: 'never shared',
    });

    const markerUpserts = upsertsFor(fakeTransport.sent, result.elementId);
    // The marker did reach the wire at all — otherwise "the first upsert is
    // stamped" would be vacuously true over an empty list, and index 0 really
    // is the marker's own creation frame, not some other frame that happens
    // to share an id.
    expect(markerUpserts.length).toBeGreaterThan(0);
    expect(markerUpserts[0]?.type).toBe('html');
    // THE property under test: index 0 — the FIRST frame this element ever
    // produced — already carries the DM audience. A weaker
    // `markerUpserts.some(u => u.audience === DM_AUDIENCE)` would pass
    // identically if a later re-emit corrected the audience after a
    // one-frame leak; asserting on index 0, and on it alone, is what rules
    // that out.
    expect(markerUpserts[0]?.audience).toBe(DM_AUDIENCE);
  });

  it("a DUPLICATED pin's first outbound upsert already carries the DM audience, even though nothing in `createMarker` ran for it", async () => {
    const store = new ElementStore();
    const deps = realProductStateDeps(store);
    // The leak guard, wired exactly as both DM surfaces wire it: on the
    // canvas store, and BEFORE the connection — so the mark lands before the
    // sync client's own `add` listener resolves this element's audience.
    store.on('add', (element, meta) =>
      guardLocalMarkerAdd(deps, element, meta)
    );
    await startLiveDmConnection(store);

    // Positive control on the identical wire observation: an element the
    // guard does not touch reaches the relay with no audience at all, so
    // "audience === 'dm'" below cannot be an artefact of a fixture that
    // stamps everything.
    const plain = createNote({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
    });
    store.add(plain);
    expect(
      upsertsFor(fakeTransport.sent, plain.id)[0]?.audience
    ).toBeUndefined();

    const created = createMarker(deps, {
      kind: 'secret',
      color: 'purple',
      label: 'False wall',
      position: { x: 10, y: 20 },
      size: { w: 40, h: 40 },
      layerId: 'layer-1',
      title: 'False wall',
      body: 'Push the sconce',
      dmNotes: 'never shared',
    });

    // EXACTLY what `@fieldnotes/core`'s `insertClones` does for `mod+d`,
    // paste and the canvas context menu: structuredClone, new id, bare
    // `store.add`. No `createMarker`, no product-state write of its own.
    const original = store.getById(created.elementId) as HtmlElement;
    const clone = structuredClone(original) as HtmlElement;
    clone.id = 'cloned-pin-1';
    store.add(clone);

    const cloneUpserts = upsertsFor(fakeTransport.sent, clone.id);
    // The clone reached the wire at all, so index 0 below is not vacuous.
    expect(cloneUpserts.length).toBeGreaterThan(0);
    expect(cloneUpserts[0]?.type).toBe('html');
    // THE assertion that closes the leak: the FIRST frame this element ever
    // produced is already DM-stamped. A `.some(...)` here would pass just as
    // happily if a later re-emit corrected the audience after one leaked
    // frame had already fanned a `secret` pin out to every player.
    expect(cloneUpserts[0]?.audience).toBe(DM_AUDIENCE);
  });
});

// ---------------------------------------------------------------------------
// 3. Export with no mounted canvas
// ---------------------------------------------------------------------------

function vpOver(store: ElementStore): ExportCapableViewport {
  return {
    exportImage: (options: ExportImageOptions) => exportImage(store, options),
    getVisibleRect: () => ({ x: 0, y: 0, w: 50, h: 50 }),
  };
}

function markerElement(color: 'purple' | 'amber'): HtmlElement {
  return createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    htmlType: MARKER_HTML_TYPE,
    data: { ...buildMarkerData({ kind: 'door', ref: 'ref-1', color }) },
  });
}

describe('markers export with no Viewport constructed at all', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a store-only export records the marker's palette colour; a note-only store records none (positive control)", async () => {
    // No `new Viewport(...)` anywhere in this test: `vpOver` is a two-method
    // object over `exportImage`, so the export path is proven to work with no
    // canvas mounted, after teardown, or from a background path.
    const markerStore = new ElementStore();
    markerStore.add(markerElement('purple'));

    const markerStub = stubCanvas();
    await exportBattleMap(vpOver(markerStore), {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 'map',
      mapImageSize: { w: 40, h: 40 },
    });
    expect(markerStub.fillStyles()).toContain(MARKER_COLOR_CSS.purple);
    vi.restoreAllMocks();

    // Positive control: the identical export over a store holding only a note
    // never incidentally assigns the marker colour, so the assertion above
    // cannot be satisfied by coincidence.
    const noteStore = new ElementStore();
    noteStore.add(
      createNote({ position: { x: 0, y: 0 }, size: { w: 40, h: 40 } })
    );
    const noteStub = stubCanvas();
    await exportBattleMap(vpOver(noteStore), {
      audience: 'full',
      bounds: 'map',
      format: 'png',
      name: 'map',
      mapImageSize: { w: 40, h: 40 },
    });
    // The export actually painted something — otherwise the assertion below
    // would be trivially satisfied by an export that painted nothing at all.
    expect(noteStub.fillStyles().length).toBeGreaterThan(0);
    expect(noteStub.fillStyles()).not.toContain(MARKER_COLOR_CSS.purple);
  });
});

// ---------------------------------------------------------------------------
// 4 + 5. Registration against real Viewports
// ---------------------------------------------------------------------------

function makeContainer(): HTMLDivElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', {
    value: 800,
    configurable: true,
  });
  Object.defineProperty(container, 'clientHeight', {
    value: 600,
    configurable: true,
  });
  document.body.appendChild(container);
  return container;
}

describe('useMarkerRegistration against real Viewports', () => {
  const viewports: Viewport[] = [];
  const containers: HTMLDivElement[] = [];

  const mountViewport = (): Viewport => {
    const container = makeContainer();
    containers.push(container);
    const viewport = new Viewport(container);
    viewports.push(viewport);
    return viewport;
  };

  afterEach(() => {
    cleanup();
    for (const viewport of viewports.splice(0)) viewport.destroy();
    for (const container of containers.splice(0)) container.remove();
    vi.restoreAllMocks();
  });

  it('Strict-Mode remount keeps markers painted on a REAL Viewport (the recording-double twin of this lives in useMarkerRegistration.test.tsx)', () => {
    stubCanvas();
    const viewport = mountViewport();
    const element = markerElement('amber');

    // Negative control on the real registry before anything mounts: the very
    // same element and helper read 'dom', so 'canvas' below cannot be true by
    // construction.
    expect(resolveHtmlRouting(element, viewport.getHtmlPainters())).toBe('dom');

    // Spy that CALLS THROUGH to the real Viewport method (not a module mock):
    // it counts registrations and captures each returned disposer, which is
    // how "the effect genuinely ran twice" is proven below.
    const registerSpy = vi.spyOn(viewport, 'registerHtmlPainter');

    // `reactStrictMode: true`, never a `wrapper: ({children}) => <StrictMode>`
    // indirection — in this React 19 / RTL stack the wrapper form does NOT
    // double-invoke effects, so it would silently reduce this to a plain
    // single-mount test.
    renderHook(() => useMarkerRegistration({ viewport, gesture: 'double' }), {
      reactStrictMode: true,
    });

    // After the double-invoke settles the painter is still active on the
    // viewport's LIVE registry, and markers still route to canvas.
    const painter: HtmlPainter | undefined = viewport
      .getHtmlPainters()
      .getActivePainter(MARKER_HTML_TYPE);
    expect(typeof painter).toBe('function');
    expect(resolveHtmlRouting(element, viewport.getHtmlPainters())).toBe(
      'canvas'
    );

    // The mount->cleanup->remount really happened: two registrations, and two
    // DISTINCT disposers were created. Without this the test would silently
    // degrade into a single-mount test if Strict-Mode ever stopped
    // double-invoking here.
    expect(registerSpy).toHaveBeenCalledTimes(2);
    const disposers = registerSpy.mock.results.map(result => result.value);
    expect(new Set(disposers).size).toBe(2);
  });

  it('two REAL Viewports mounted simultaneously register independently; unmounting one leaves the other at canvas', () => {
    stubCanvas();
    const first = mountViewport();
    const second = mountViewport();
    const element = markerElement('amber');

    expect(resolveHtmlRouting(element, first.getHtmlPainters())).toBe('dom');
    expect(resolveHtmlRouting(element, second.getHtmlPainters())).toBe('dom');

    const firstHook = renderHook(() =>
      useMarkerRegistration({ viewport: first, gesture: 'double' })
    );
    renderHook(() =>
      useMarkerRegistration({ viewport: second, gesture: 'single' })
    );

    // Each viewport's own registry resolves the marker independently.
    expect(resolveHtmlRouting(element, first.getHtmlPainters())).toBe('canvas');
    expect(resolveHtmlRouting(element, second.getHtmlPainters())).toBe(
      'canvas'
    );
    // Two separate painter instances, not one shared module-level painter.
    expect(first.getHtmlPainters().getActivePainter(MARKER_HTML_TYPE)).not.toBe(
      second.getHtmlPainters().getActivePainter(MARKER_HTML_TYPE)
    );

    firstHook.unmount();

    expect(resolveHtmlRouting(element, first.getHtmlPainters())).toBe('dom');
    expect(resolveHtmlRouting(element, second.getHtmlPainters())).toBe(
      'canvas'
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Activation vs. the active tool, over ONE live viewport
// ---------------------------------------------------------------------------

/**
 * Core's `ElementActivation` listens directly on the viewport wrapper and
 * never consults the tool manager, so nothing below the host layer stops a
 * double-tap from opening a marker panel while a canvas-WRITING tool is
 * active. Nothing else on the branch drives a real tool and real activation
 * over the SAME live viewport, which is exactly why the conflict was
 * invisible: the tool tests drive tools with no activation, and the
 * activation tests drive activation with no tools.
 */
describe('marker activation and the active tool, over one live Viewport', () => {
  const viewports: Viewport[] = [];
  const containers: HTMLDivElement[] = [];

  afterEach(() => {
    cleanup();
    for (const viewport of viewports.splice(0)) viewport.destroy();
    for (const container of containers.splice(0)) container.remove();
    vi.restoreAllMocks();
  });

  const mountViewport = (): Viewport => {
    const container = makeContainer();
    containers.push(container);
    const viewport = new Viewport(container);
    viewports.push(viewport);
    return viewport;
  };

  /** Two taps in quick succession on the viewport wrapper — the real gesture
   *  both the tool and `ElementActivation` observe, from the same events. */
  function doubleTap(target: HTMLElement, x: number, y: number): void {
    for (let tap = 0; tap < 2; tap += 1) {
      for (const type of ['pointerdown', 'pointerup']) {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: type === 'pointerdown' ? 1 : 0,
            clientX: x,
            clientY: y,
          })
        );
      }
    }
  }

  it('with the marker tool active a double-tap places pins and opens NO panel; with `select` active the identical gesture opens it', () => {
    stubCanvas();
    const viewport = mountViewport();
    const wrapper = viewport.domLayer.parentElement;
    if (!wrapper) throw new Error('expected the viewport wrapper');

    const placements: PlaceMarkerRequest[] = [];
    const kindRef = { current: 'door' as MarkerKind };
    const colorRef = { current: 'blue' as MarkerColorKey };
    viewport.toolManager.register(new SelectTool());
    viewport.toolManager.register(
      new DmMarkerTool(kindRef, colorRef, request => placements.push(request))
    );

    const activated: string[] = [];
    renderHook(() =>
      useMarkerRegistration({
        viewport,
        gesture: 'double',
        onActivateMarker: event => activated.push(event.element.id),
        // The production predicate, verbatim: read the ACTIVE TOOL at
        // gesture time, never a value captured when the effect ran.
        isActivationSuppressed: () =>
          CANVAS_WRITING_TOOL_NAMES.has(
            viewport.toolManager.activeTool?.name ?? ''
          ),
      })
    );

    const pin = createHtmlElement({
      position: { x: 100, y: 100 },
      size: { w: 40, h: 40 },
      layerId: viewport.layerManager.activeLayerId,
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-1' }) },
    });
    viewport.store.add(pin);

    // POSITIVE CONTROL FIRST, so the suppression case below cannot pass
    // because the gesture never reaches activation at all in this harness.
    // (First, because the marker tool's taps add pins over the same point
    // and would change what the hit test finds.)
    viewport.setTool('select');
    doubleTap(wrapper, 120, 120);
    expect(activated).toEqual([pin.id]);
    expect(placements).toHaveLength(0);

    viewport.setTool(MARKER_TOOL_NAME);
    doubleTap(wrapper, 120, 120);

    // No SECOND panel: activation stayed inert for the whole gesture...
    expect(activated).toEqual([pin.id]);
    // ...while the very same two taps did reach the canvas and place two
    // pins, which is what proves the gesture was delivered rather than
    // swallowed by the harness.
    expect(placements).toHaveLength(2);
  });
});
