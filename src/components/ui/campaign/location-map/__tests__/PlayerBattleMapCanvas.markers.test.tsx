import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, cleanup, act } from '@testing-library/react';
import { Viewport, createHtmlElement } from '@fieldnotes/core';

import { PlayerBattleMapCanvas } from '../PlayerBattleMapCanvas';
import DmLocationToolOptions from '../DmLocationToolOptions';
import { ViewportContext } from '@fieldnotes/react';
import MarkerDetailPanel from '../MarkerDetailPanel';
import { MARKER_TOOL_NAME } from '../DmMarkerTool';
import { MARKER_HTML_TYPE, buildMarkerData } from '../markerData';
import type { PublicMarkerDetail } from '@/types/battlemap';

// Task B11 — three negative properties about the player surface, each with a
// same-file, same-harness positive control per CONSTRAINTS-B:
//   1. no marker placement tool (functional tools list + toolbar button list)
//   2. no DM edit affordance in a "ready" panel state (positive control:
//      mode="dm" on the identical resolved state)
//   3. no marker kind/colour picker on the options strip (positive control:
//      DmLocationToolOptions WITH markerControls supplied — the DM path)

let mockActiveTool = 'hand';

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    // The only @fieldnotes mock in this file, and it is @fieldnotes/react's
    // pure DOM-mount component (not @fieldnotes/core): jsdom has no live
    // canvas rendering pipeline. `onReady` is invoked manually below with a
    // REAL `Viewport` built against a stubbed canvas 2D context — see
    // `stubCanvas()`.
    FieldNotesCanvas: vi.fn(() => null),
    // Forced only for the third test of the first describe below (rendering
    // the options strip with activeTool === MARKER_TOOL_NAME): the player
    // tool list never contains a marker tool for real (that is exactly what
    // the FIRST test pins), so there is no way to reach this state through
    // genuine tool activation. Every other test in this file leaves this at
    // the harmless default 'hand'.
    useActiveTool: () => [mockActiveTool, vi.fn()] as const,
  };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

vi.mock('../BattleMapMinimap', () => ({ BattleMapMinimap: () => null }));
vi.mock('../BattleMapExportControl', () => ({
  BattleMapExportControl: () => null,
}));

/** jsdom has no canvas 2D context — stub it so constructing a real `Viewport`
 * doesn't throw. Duplicated (not imported) from `selectionEvents.integration
 * .test.tsx`: stub the browser API, never an @fieldnotes module. */
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

function renderPlayer(
  overrides: Partial<React.ComponentProps<typeof PlayerBattleMapCanvas>> = {}
) {
  return render(
    <PlayerBattleMapCanvas
      campaignCode="CODE"
      battleMapId="map-1"
      characterId="char-1"
      onExportError={() => {}}
      {...overrides}
    />
  );
}

describe('PlayerBattleMapCanvas: no marker placement, no edit affordance, no kind picker', () => {
  beforeEach(() => {
    mockActiveTool = 'hand';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('has no marker tool: the functional tool list omits MARKER_TOOL_NAME (select is present, ruling out an empty list), and the toolbar button list is exhaustively the seven non-marker tools', () => {
    stubCanvas();
    const vp = makeViewport();

    const { unmount } = renderPlayer();
    fireReady(vp);

    const toolsProp = vi.mocked(FieldNotesCanvas).mock.calls.at(-1)?.[0]?.tools;
    const toolNames = (toolsProp ?? []).map(t => t.name);
    expect(toolNames.length).toBeGreaterThan(0);
    expect(toolNames).toContain('select');
    expect(toolNames).not.toContain(MARKER_TOOL_NAME);

    // PLAYER_TOOLS (the toolbar's own button list) is not exported, so pin
    // it through the rendered, already-exported `PlayerToolbar`: an
    // exhaustive label list means an added marker entry would show up here
    // as an unexpected extra button rather than silently passing a
    // "does not contain 'Marker'" check alone.
    const toolbar = screen.getByTestId('player-toolbar');
    const labels = within(toolbar)
      .getAllByRole('button')
      .map(b => b.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Pan',
      'Select',
      'Place token',
      'Draw',
      'Arrow',
      'Measure',
      'Spell template',
    ]);

    unmount();
    vp.destroy();
  });

  it('a "ready" player panel state renders no Save, no Delete, no textarea, and no "DM notes" text; mode="dm" on the identical resolved state is the positive control', () => {
    stubCanvas();
    const vp = makeViewport();
    const activateSpy = vi.spyOn(vp, 'onElementActivate');

    const detail: PublicMarkerDetail = {
      id: 'ref-1',
      title: 'Cellar Door',
      body: 'Locked, needs a key.',
    };
    const { unmount } = renderPlayer({ markers: [detail] });
    fireReady(vp);

    const data = buildMarkerData({ kind: 'door', ref: 'ref-1' });
    const markerEl = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { ...data },
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

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'Save' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(dialog.querySelector('textarea')).toBeNull();
    expect(dialog.textContent).not.toContain('DM notes');
    // Sanity: this really is the "ready" branch, not one of the message
    // states — the live title is on screen.
    expect(within(dialog).getByText('Cellar Door')).toBeInTheDocument();

    unmount();
    vp.destroy();

    // Positive control: the SAME resolved data/detail pair, rendered
    // directly through MarkerDetailPanel in mode="dm", surfaces all four —
    // proving the queries above would have caught it had the player surface
    // also rendered the edit form. Mutation-verified: swapping the player
    // canvas's real mode="player" for mode="dm" fails the negative
    // assertions above (see task-B11-report.md mutation 6).
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data,
          detail: {
            id: detail.id,
            title: detail.title,
            body: detail.body,
            status: detail.status,
            dmNotes: 'Key is under the mat.',
          },
        }}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );
    const dmDialog = screen.getByRole('dialog');
    expect(
      within(dmDialog).getByRole('button', { name: 'Save' })
    ).toBeInTheDocument();
    expect(
      within(dmDialog).getByRole('button', { name: 'Delete' })
    ).toBeInTheDocument();
    expect(dmDialog.querySelectorAll('textarea').length).toBe(2);
    expect(dmDialog.textContent).toContain('DM notes');
  });

  it('the marker kind/colour picker never renders on the player options strip, even with activeTool forced to "marker"; DmLocationToolOptions WITH markerControls supplied (the DM path) is the positive control', () => {
    mockActiveTool = MARKER_TOOL_NAME;
    stubCanvas();
    const vp = makeViewport();

    const { unmount } = renderPlayer();
    fireReady(vp);

    expect(screen.queryByTestId('marker-tool-options')).toBeNull();

    unmount();
    vp.destroy();

    // Positive control needs its own real Viewport in context:
    // `DmLocationToolOptions` unconditionally calls `useSelectionOps()`,
    // which throws outside a `ViewportContext.Provider` — this is not a
    // stand-in, just a second real (empty) viewport to satisfy that hook.
    const controlVp = makeViewport();
    render(
      <ViewportContext.Provider value={controlVp}>
        <DmLocationToolOptions
          mode="battlemap"
          markerControls={{
            kind: 'door',
            color: 'blue',
            onKindChange: () => {},
            onColorChange: () => {},
          }}
        />
      </ViewportContext.Provider>
    );
    expect(screen.getByTestId('marker-tool-options')).toBeInTheDocument();
    controlVp.destroy();
  });
});

/**
 * The `'player'` role argument the surface passes to `resolveMarkerPanelState`.
 * It is what selects `unpublished` over `missing-detail`, and since a player's
 * `markers` list is empty until the DM publishes, it is the branch EVERY
 * marker a player taps resolves through. Nothing else on the branch observes
 * it: the two states share their copy, so only the testid separates them.
 */
describe('PlayerBattleMapCanvas: an unpublished marker resolves in the player role', () => {
  beforeEach(() => {
    mockActiveTool = 'hand';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('tapping a pin with no published detail shows the player "unpublished" state, never the DM "missing-detail" one', () => {
    stubCanvas();
    const vp = makeViewport();
    const activateSpy = vi.spyOn(vp, 'onElementActivate');

    const { unmount } = renderPlayer({ markers: [] });
    fireReady(vp);

    const markerEl = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-unpublished' }) },
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
        pointerType: 'touch',
        gesture: 'single',
      });
    });

    const dialog = screen.getByRole('dialog');
    // The testid is the discriminator: `missing-detail` in player mode renders
    // byte-identical copy under `marker-panel-state-missing-detail`, so a role
    // argument of 'dm' here would leave a text-only assertion green.
    expect(
      within(dialog).getByTestId('marker-panel-state-unpublished')
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByTestId('marker-panel-state-missing-detail')
    ).toBeNull();
    expect(dialog.textContent).toContain('Not published yet');

    unmount();
    vp.destroy();
  });
});

/**
 * Panel staleness. `activeMarkerElement` is a bare render-time
 * `viewport.store.getById(...)` with no store subscription, so when the DM
 * hides a shared marker — the relay sends the player a REMOVE — the open panel
 * would otherwise keep showing the pin's label and body until some unrelated
 * re-render happened to knock it over.
 */
describe('PlayerBattleMapCanvas: an open marker panel does not outlive its element', () => {
  beforeEach(() => {
    mockActiveTool = 'hand';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('removing the active element closes the panel; removing a DIFFERENT element leaves it open', () => {
    stubCanvas();
    const vp = makeViewport();
    const activateSpy = vi.spyOn(vp, 'onElementActivate');

    const { unmount } = renderPlayer({
      markers: [{ id: 'ref-1', title: 'Cellar Door', body: 'Locked.' }],
    });
    fireReady(vp);

    const makePin = (ref: string) =>
      createHtmlElement({
        position: { x: 0, y: 0 },
        size: { w: 40, h: 40 },
        htmlType: MARKER_HTML_TYPE,
        data: { ...buildMarkerData({ kind: 'door', ref }) },
      });
    const active = makePin('ref-1');
    const other = makePin('ref-2');
    act(() => {
      vp.store.add(active);
      vp.store.add(other);
    });

    const listener = activateSpy.mock.calls[0]?.[0];
    if (!listener) {
      throw new Error(
        'expected useMarkerRegistration to have subscribed via onElementActivate'
      );
    }
    act(() => {
      listener({
        element: active,
        world: { x: 0, y: 0 },
        pointerType: 'touch',
        gesture: 'single',
      });
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Positive control FIRST, same harness: an UNRELATED removal must not
    // close the panel, so the assertion below cannot be satisfied by a
    // listener that closes on every remove.
    act(() => {
      vp.store.remove(other.id);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => {
      vp.store.remove(active.id);
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    unmount();
    vp.destroy();
  });
});
