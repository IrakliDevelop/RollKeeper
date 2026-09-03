import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Viewport, createHtmlElement } from '@fieldnotes/core';

import BattleMapDisplayPage from '../page';
import { PlayerBattleMapCanvas } from '@/components/ui/campaign/location-map/PlayerBattleMapCanvas';
import {
  MARKER_HTML_TYPE,
  buildMarkerData,
} from '@/components/ui/campaign/location-map/markerData';

// Task B11 — the negative property under test ("the display page never
// activates") and its positive control ("the player canvas DOES, with
// gesture 'single'") live in this ONE file against the SAME real-Viewport
// harness, per CONSTRAINTS-B's "tests must be able to fail" rule: a bare
// "setActivation was not called" assertion passes for any reason at all,
// including a hook that never ran at all — the positive control proves the
// harness would have caught it.

vi.mock('next/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useParams: () => ({ code: 'CODE', id: 'map-1' }),
    useSearchParams: () => new URLSearchParams(),
  };
});

vi.mock('@/components/ui/campaign/location-map/BattleMapMinimap', () => ({
  BattleMapMinimap: () => null,
}));
vi.mock('@/components/ui/campaign/location-map/BattleMapExportControl', () => ({
  BattleMapExportControl: () => null,
}));

// The only @fieldnotes mock in this file, and it is @fieldnotes/react's pure
// DOM-mount component, not @fieldnotes/core: jsdom has no live canvas
// rendering pipeline, so FieldNotesCanvas is replaced with a capture stub
// that renders nothing. `onReady` is then invoked manually with a REAL
// `Viewport` (constructed against a stubbed canvas 2D context below) — the
// same "stub the browser API, never an @fieldnotes module" seam used by
// `selectionEvents.integration.test.tsx` and `battleMapExport.integration.test.ts`.
vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    FieldNotesCanvas: vi.fn(() => null),
  };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

/** jsdom has no canvas 2D context — stub it so constructing a real `Viewport`
 * doesn't throw. Duplicated (not imported) from `selectionEvents.integration
 * .test.tsx`, matching that file's own note that this stub is a test-only
 * helper and not part of any module's public surface. */
function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
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

function makeViewport(): Viewport {
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
  return new Viewport(container);
}

/** Pulls the `onReady` callback the (mocked) `FieldNotesCanvas` most
 * recently received, and invokes it with a real `Viewport` inside `act`. */
function fireReady(vp: Viewport): void {
  const lastCall = vi.mocked(FieldNotesCanvas).mock.calls.at(-1);
  const onReady = lastCall?.[0]?.onReady;
  if (!onReady) {
    throw new Error('FieldNotesCanvas was not rendered with an onReady prop');
  }
  act(() => onReady(vp));
}

describe('marker activation: the display page never activates; the player canvas is the positive control', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('display page: setActivation is never called, though the marker painter IS registered', () => {
    stubCanvas();
    const vp = makeViewport();
    const activationSpy = vi.spyOn(vp, 'setActivation');

    render(<BattleMapDisplayPage />);
    fireReady(vp);

    expect(activationSpy).not.toHaveBeenCalled();
    expect(vp.getHtmlPainters().getActivePainter(MARKER_HTML_TYPE)).toEqual(
      expect.any(Function)
    );

    vp.destroy();
  });

  it('positive control: the player canvas DOES call setActivation, with gesture "single"', () => {
    stubCanvas();
    const vp = makeViewport();
    const activationSpy = vi.spyOn(vp, 'setActivation');

    render(
      <PlayerBattleMapCanvas
        campaignCode="CODE"
        battleMapId="map-1"
        characterId="char-1"
        onExportError={() => {}}
      />
    );
    fireReady(vp);

    expect(activationSpy).toHaveBeenCalledTimes(1);
    expect(activationSpy.mock.calls[0]?.[0]?.gesture).toBe('single');

    vp.destroy();
  });

  // Task 7 — non-DM portal isolation lockdown. `gesture: null` (asserted
  // above via "setActivation is never called") is the primary guard, but
  // `useMarkerRegistration` still subscribes `onElementActivate`
  // unconditionally (only `setActivation` is gated on `gesture`). This test
  // covers the residual path: if that listener were ever invoked anyway —
  // by a future regression, a shared/misrouted event source, anything — the
  // display page wires no `onActivateMarker` and renders no marker panel at
  // all, so a portal-bearing marker cannot produce a destination link,
  // dialog, or navigation on the TV surface.
  it('portal metadata cannot cause navigation or activation on the display page, even if its onElementActivate listener fires directly', () => {
    stubCanvas();
    const vp = makeViewport();
    const activationSpy = vi.spyOn(vp, 'onElementActivate');

    const { container } = render(<BattleMapDisplayPage />);
    fireReady(vp);

    const listener = activationSpy.mock.calls[0]?.[0];
    if (!listener) {
      throw new Error(
        'expected useMarkerRegistration to have subscribed via onElementActivate'
      );
    }

    // A marker whose (DM-only) detail record would carry a portal target —
    // the display page never resolves or receives detail records, so the
    // portal id below exists purely as a canary: it must never surface
    // anywhere in the rendered output.
    const markerEl = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-portal-canary' }) },
    });
    act(() => {
      vp.store.add(markerEl);
    });
    act(() => {
      listener({
        element: markerEl,
        world: { x: 0, y: 0 },
        pointerType: 'mouse',
        gesture: 'single',
      });
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelectorAll('a[href]').length).toBe(0);
    expect(container.innerHTML).not.toContain('ref-portal-canary');
    expect(container.innerHTML).not.toContain('/dm/campaign/');

    vp.destroy();
  });
});
