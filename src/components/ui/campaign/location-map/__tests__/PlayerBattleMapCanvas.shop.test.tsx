import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { Viewport } from '@fieldnotes/core';

import { PlayerBattleMapCanvas } from '../PlayerBattleMapCanvas';
import { useCharacterStore } from '@/store/characterStore';

import type { CanvasElement } from '@fieldnotes/core';
import type { PublicShop, PublicShopIndexEntry } from '@/types/shop';

// Task 11 (VTT merchants Slice 3): tapping a merchant token opens
// `PlayerShopDialog`. Mirrors `PlayerBattleMapCanvas.markers.test.tsx`'s
// harness — a real `Viewport`, `FieldNotesCanvas` mocked out (jsdom has no
// live canvas pipeline), and the captured `onElementActivate` listener
// invoked directly to drive the surface, exactly like that file's marker
// tests do. Real gesture recognition (tap vs. drag) is proven separately
// against a REAL `ElementActivation`, not re-derived here — see
// `shopTokenActivation.integration.test.tsx`.

let mockActiveTool = 'hand';

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    FieldNotesCanvas: vi.fn(() => null),
    useActiveTool: () => [mockActiveTool, vi.fn()] as const,
  };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

vi.mock('../BattleMapMinimap', () => ({ BattleMapMinimap: () => null }));
vi.mock('../BattleMapExportControl', () => ({
  BattleMapExportControl: () => null,
}));

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

function fireReady(vp: Viewport): void {
  const lastCall = vi.mocked(FieldNotesCanvas).mock.calls.at(-1);
  const onReady = lastCall?.[0]?.onReady;
  if (!onReady) {
    throw new Error('FieldNotesCanvas was not rendered with an onReady prop');
  }
  act(() => onReady(vp));
}

function seedOwnCharacter(): void {
  const base = useCharacterStore.getState().character;
  useCharacterStore.setState({
    character: { ...base, id: 'char-1' },
  });
}

function renderPlayer() {
  return render(
    <PlayerBattleMapCanvas
      campaignCode="CODE"
      battleMapId="map-1"
      characterId="char-1"
      onExportError={() => {}}
    />
  );
}

function tokenEl(overrides: Record<string, unknown>): CanvasElement {
  return {
    id: 'token-el',
    type: 'shape',
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    zIndex: 0,
    locked: false,
    layerId: 'l1',
    ...overrides,
  } as unknown as CanvasElement;
}

/** Any combatant token is activatable at the canvas level (controller ruling
 *  R16) — the merchant/non-merchant distinction happens entirely via the
 *  shop index fetch, not on the element itself. */
function combatantTokenElement(entityId: string): CanvasElement {
  return tokenEl({ tokenKind: 'combatant', entityId });
}

const INDEX_ENTRY: PublicShopIndexEntry = {
  npcId: 'npc-1',
  merchantName: 'Brenn',
  entityIds: ['entity-1'],
};

const OPEN_SHOP: PublicShop = {
  npcId: 'npc-1',
  merchantName: 'Brenn',
  merchantDescription: 'Ironmonger of the Low Market',
  entityIds: ['entity-1'],
  items: [
    {
      id: 'item-1',
      name: 'Rope',
      itemKind: 'inventory',
      priceCopper: 100,
      remainingQuantity: 5,
    },
  ],
};

describe('PlayerBattleMapCanvas: merchant token tap opens the shop dialog', () => {
  beforeEach(() => {
    mockActiveTool = 'hand';
    seedOwnCharacter();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/campaign/CODE/shops') {
          return Promise.resolve({
            json: () => Promise.resolve({ shops: [INDEX_ENTRY] }),
          } as Response);
        }
        if (url.startsWith('/api/campaign/CODE/shops/')) {
          return Promise.resolve({
            json: () => Promise.resolve({ shop: OPEN_SHOP }),
          } as Response);
        }
        // Background marker refresh — irrelevant to these tests.
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ markers: [] }),
        } as Response);
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('opens PlayerShopDialog for a merchant token whose entity id is in the open shop', async () => {
    stubCanvas();
    const vp = makeViewport();
    const activateSpy = vi.spyOn(vp, 'onElementActivate');

    const { unmount } = renderPlayer();
    fireReady(vp);

    const listener = activateSpy.mock.calls[0]?.[0];
    if (!listener) {
      throw new Error(
        'expected useMarkerRegistration to have subscribed via onElementActivate'
      );
    }

    act(() => {
      listener({
        element: combatantTokenElement('entity-1'),
        world: { x: 0, y: 0 },
        pointerType: 'mouse',
        gesture: 'single',
      });
    });

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(
      screen.getByText('Ironmonger of the Low Market')
    ).toBeInTheDocument();

    unmount();
    vp.destroy();
  });

  it('does not open a dialog for a combatant token whose entity id is not in the shop index (no confirm fetch either)', async () => {
    stubCanvas();
    const vp = makeViewport();
    const activateSpy = vi.spyOn(vp, 'onElementActivate');

    const { unmount } = renderPlayer();
    fireReady(vp);

    const listener = activateSpy.mock.calls[0]?.[0];
    if (!listener) {
      throw new Error(
        'expected useMarkerRegistration to have subscribed via onElementActivate'
      );
    }

    act(() => {
      listener({
        element: combatantTokenElement('entity-2'),
        world: { x: 0, y: 0 },
        pointerType: 'mouse',
        gesture: 'single',
      });
    });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    // The index fetch always happens (any combatant token triggers a
    // lookup); the confirm fetch never does, since entity-2 isn't in the
    // index. Waiting for the index call is a real signal to flush past it.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/campaign/CODE/shops')
    );
    // One more explicit flush for the index response's own .then chain to
    // finish deciding "no match" before asserting the negative.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith('/api/campaign/CODE/shops/')
      )
    ).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();

    unmount();
    vp.destroy();
  });
});
