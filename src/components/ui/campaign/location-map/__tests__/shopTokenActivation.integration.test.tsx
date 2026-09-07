import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import {
  Viewport,
  SelectTool,
  createImage,
  createHtmlElement,
} from '@fieldnotes/core';

import { PlayerHandTool } from '../PlayerHandTool';
import { useMarkerRegistration } from '../useMarkerRegistration';
import { isCombatantToken } from '../useMerchantShopActivation';
import { MARKER_HTML_TYPE, buildMarkerData } from '../markerData';

/**
 * Real-SDK, real-`ElementActivation` proof for Task 11's two binding
 * requirements:
 *
 *  1. A DRAG on a combatant token — the exact gesture `PlayerHandTool` (the
 *     REAL collision the task-11 brief identifies, not `useTokenInfoMode`)
 *     converts into a hand-off to `SelectTool` and a token move — must never
 *     also register as a tap that could open the shop dialog.
 *  2. Sharing `useMarkerRegistration`'s single `setActivation` slot (via
 *     `isExtraActivatable`/`onActivateExtra`) does not regress the existing
 *     marker single-tap path, proven here against a REAL `Viewport`/
 *     `ElementActivation` rather than the recording double
 *     `useMarkerRegistration.test.tsx` uses.
 *
 * `isCombatantToken` (controller ruling R16) matches ANY combatant token —
 * there is no element-level "merchant" distinction any more (that was the
 * rejected `shopNpcId` stamp). WHICH combatant token actually has an open
 * shop is resolved by `useMerchantShopActivation` against the player-
 * readable shop index, entirely separate from what this file proves: that
 * the gesture reaches `onActivateExtra` at all, exactly once, only for a
 * clean tap, and without breaking markers.
 *
 * No `@fieldnotes` module mocks: a real `Viewport`, real `PlayerHandTool` +
 * `SelectTool`, and real `PointerEvent`s dispatched on the wrapper — mirrors
 * `markers.integration.test.tsx`'s "activation vs. the active tool" suite.
 */

function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
        canvas,
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
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
    }
    return el;
  });
}

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

function tap(target: HTMLElement, x: number, y: number): void {
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

/** Down at (x1,y1), a move well past the 8px default slop, then up at
 *  (x2,y2) — the exact shape of gesture `PlayerHandTool` hands off to
 *  `SelectTool` to drag a grabbable token. */
function drag(
  target: HTMLElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: x1,
      clientY: y1,
    })
  );
  target.dispatchEvent(
    new PointerEvent('pointermove', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1,
      clientX: x2,
      clientY: y2,
    })
  );
  target.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 0,
      clientX: x2,
      clientY: y2,
    })
  );
}

function combatantTokenImage() {
  return {
    ...createImage({
      position: { x: 100, y: 100 },
      size: { w: 40, h: 40 },
      src: 'data:image/png;base64,',
      layerId: 'player-layer',
    }),
    entityId: 'entity-1',
    tokenKind: 'combatant',
  };
}

describe('merchant token tap vs. drag, over a REAL Viewport with the real PlayerHandTool collision surface', () => {
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

  function setupHandAndSelect(viewport: Viewport): void {
    const selectTool = new SelectTool();
    viewport.toolManager.register(selectTool);
    viewport.toolManager.register(new PlayerHandTool(selectTool));
    viewport.setTool('hand'); // the default movement tool on the player canvas
  }

  it('a clean tap on a combatant token fires onActivateExtra, never onActivateMarker', () => {
    stubCanvas();
    const viewport = mountViewport();
    setupHandAndSelect(viewport);
    const wrapper = viewport.domLayer.parentElement;
    if (!wrapper) throw new Error('expected the viewport wrapper');

    const token = combatantTokenImage();
    viewport.store.add(token);

    const activatedExtra: string[] = [];
    const activatedMarker: string[] = [];
    renderHook(() =>
      useMarkerRegistration({
        viewport,
        gesture: 'single',
        onActivateMarker: e => activatedMarker.push(e.element.id),
        isExtraActivatable: isCombatantToken,
        onActivateExtra: e => activatedExtra.push(e.element.id),
      })
    );

    tap(wrapper, 120, 120);

    expect(activatedExtra).toEqual([token.id]);
    expect(activatedMarker).toEqual([]);
  });

  it('a drag on a combatant token (the real PlayerHandTool hand-off) does NOT fire onActivateExtra', () => {
    stubCanvas();
    const viewport = mountViewport();
    setupHandAndSelect(viewport);
    const wrapper = viewport.domLayer.parentElement;
    if (!wrapper) throw new Error('expected the viewport wrapper');

    const token = combatantTokenImage();
    viewport.store.add(token);

    const activatedExtra: string[] = [];
    renderHook(() =>
      useMarkerRegistration({
        viewport,
        gesture: 'single',
        isExtraActivatable: isCombatantToken,
        onActivateExtra: e => activatedExtra.push(e.element.id),
      })
    );

    // Confirm the collision is real: the press on the token hands the
    // gesture off to select (PlayerHandTool's job), proving this is
    // genuinely the drag gesture the brief describes — not a no-op.
    drag(wrapper, 120, 120, 260, 260);
    expect(viewport.toolManager.activeTool?.name).toBe('select');

    expect(activatedExtra).toEqual([]);
  });

  it('a tap on a non-combatant element (no tokenKind/entityId) fires neither callback', () => {
    stubCanvas();
    const viewport = mountViewport();
    setupHandAndSelect(viewport);
    const wrapper = viewport.domLayer.parentElement;
    if (!wrapper) throw new Error('expected the viewport wrapper');

    const plainShape = createImage({
      position: { x: 100, y: 100 },
      size: { w: 40, h: 40 },
      src: 'data:image/png;base64,',
      layerId: 'player-layer',
    });
    viewport.store.add(plainShape);

    const activatedExtra: string[] = [];
    const activatedMarker: string[] = [];
    renderHook(() =>
      useMarkerRegistration({
        viewport,
        gesture: 'single',
        onActivateMarker: e => activatedMarker.push(e.element.id),
        isExtraActivatable: isCombatantToken,
        onActivateExtra: e => activatedExtra.push(e.element.id),
      })
    );

    tap(wrapper, 120, 120);

    expect(activatedExtra).toEqual([]);
    expect(activatedMarker).toEqual([]);
  });

  it('regression: a marker single-tap still opens with BOTH the marker and combatant-token predicates registered together', () => {
    stubCanvas();
    const viewport = mountViewport();
    setupHandAndSelect(viewport);
    const wrapper = viewport.domLayer.parentElement;
    if (!wrapper) throw new Error('expected the viewport wrapper');

    const pin = createHtmlElement({
      position: { x: 100, y: 100 },
      size: { w: 40, h: 40 },
      layerId: viewport.layerManager.activeLayerId,
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-1' }) },
    });
    viewport.store.add(pin);

    const activatedExtra: string[] = [];
    const activatedMarker: string[] = [];
    renderHook(() =>
      useMarkerRegistration({
        viewport,
        gesture: 'single',
        onActivateMarker: e => activatedMarker.push(e.element.id),
        isExtraActivatable: isCombatantToken,
        onActivateExtra: e => activatedExtra.push(e.element.id),
      })
    );

    tap(wrapper, 120, 120);

    expect(activatedMarker).toEqual([pin.id]);
    expect(activatedExtra).toEqual([]);
  });
});
