import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Viewport, createHtmlElement } from '@fieldnotes/core';

import { PlayerBattleMapCanvas } from '../PlayerBattleMapCanvas';
import { MARKER_HTML_TYPE, buildMarkerData } from '../markerData';
import type { MarkerDetailPanelProps } from '../MarkerDetailPanel/MarkerDetailPanel.types';

// Task 7 — non-DM portal isolation lockdown. `PlayerBattleMapCanvas.markers
// .test.tsx` already proves, behaviourally, that a player's "ready" panel
// renders no Save/Delete/textarea/DM-notes DOM. This file adds a second,
// different-in-kind check on the SAME surface: mock `MarkerDetailPanel`
// itself and capture the exact props the player canvas passes it, so a
// regression that starts computing a `portalState` or wiring an `onSave`
// (even one that happens to render nothing today) fails a direct prop
// assertion rather than relying solely on "no DOM node happened to appear".

let capturedProps: MarkerDetailPanelProps | null = null;

vi.mock('../MarkerDetailPanel', () => ({
  default: (props: MarkerDetailPanelProps) => {
    capturedProps = props;
    return null;
  },
}));

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    // The only @fieldnotes mock in this file, and it is @fieldnotes/react's
    // pure DOM-mount component (not @fieldnotes/core): jsdom has no live
    // canvas rendering pipeline. `onReady` is invoked manually below with a
    // REAL `Viewport` built against a stubbed canvas 2D context.
    FieldNotesCanvas: vi.fn(() => null),
  };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

vi.mock('../BattleMapMinimap', () => ({ BattleMapMinimap: () => null }));
vi.mock('../BattleMapExportControl', () => ({
  BattleMapExportControl: () => null,
}));

/** jsdom has no canvas 2D context — stub it so constructing a real `Viewport`
 * doesn't throw. Duplicated (not imported) from `PlayerBattleMapCanvas
 * .markers.test.tsx`, matching that file's own note: stub the browser API,
 * never an @fieldnotes module. */
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

describe('PlayerBattleMapCanvas: never passes DM-only portal props to MarkerDetailPanel', () => {
  beforeEach(() => {
    capturedProps = null;
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('marker endpoint unavailable')
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('mode is "player", and portalState/onSave/onPersist/onDelete/onAudienceChange/isDmOnly are all absent, for a "ready" panel state', () => {
    stubCanvas();
    const vp = makeViewport();
    const activateSpy = vi.spyOn(vp, 'onElementActivate');

    const { unmount } = render(
      <PlayerBattleMapCanvas
        campaignCode="CODE"
        battleMapId="map-1"
        characterId="char-1"
        onExportError={() => {}}
        markers={[{ id: 'ref-1', title: 'Cellar Door', body: 'Locked.' }]}
      />
    );
    fireReady(vp);

    const markerEl = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-1' }) },
    });
    act(() => {
      vp.store.add(markerEl);
    });

    const listener = activateSpy.mock.calls[0]?.[0];
    if (!listener) {
      throw new Error(
        'expected useMarkerRegistration to have subscribed via onElementActivate'
      );
    }
    act(() => {
      listener({
        element: markerEl,
        world: { x: 0, y: 0 },
        pointerType: 'mouse',
        gesture: 'single',
      });
    });

    if (!capturedProps) {
      throw new Error('expected MarkerDetailPanel to have been rendered');
    }
    // Sanity: this really is the "ready" branch the DM-only props matter for.
    expect(capturedProps.state.kind).toBe('ready');
    expect(capturedProps.mode).toBe('player');
    expect(capturedProps.portalState).toBeUndefined();
    expect(capturedProps.onSave).toBeUndefined();
    expect(capturedProps.onPersist).toBeUndefined();
    expect(capturedProps.onDelete).toBeUndefined();
    expect(capturedProps.onAudienceChange).toBeUndefined();
    expect(capturedProps.isDmOnly).toBeUndefined();

    unmount();
    vp.destroy();
  });
});
