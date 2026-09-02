import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ElementStore, LayerManager, createShape } from '@fieldnotes/core';
import type { Viewport } from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';

/**
 * Ownership-split regression coverage for Task 13's second surface: the
 * location editor's `attachFocusBroadcast`/`createLocalCameraAnimator`
 * lifecycle must live in `DmLocationEditor.hooks.ts` (battlemap mode, next
 * to the existing laser/ping/measure attachments), not in the component.
 * Mirrors DmBattleMapCanvas.hooks.test.ts's approach: mock everything the
 * connected branch touches except focusSync (mocked with trackable test
 * doubles) so the hook's own wiring — and unmount teardown ordering — is
 * exercised directly against a live (mocked) connection.
 */

vi.mock('@fieldnotes/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/core')>();
  return {
    ...actual,
    AutoSave: class {
      start = vi.fn();
      stop = vi.fn();
      clear = vi.fn(async () => {});
    },
  };
});

const callOrder: string[] = [];

vi.mock('@/lib/battlemapSync', () => ({
  createManagedBattleMapConnection: vi.fn(() => ({
    stop: () => {
      callOrder.push('connection.stop');
    },
    sendPresence: vi.fn(),
    publishLayerUpsert: vi.fn(),
    publishLayerRemove: vi.fn(),
  })),
}));

vi.mock('../laserSync', () => ({
  attachLaserBroadcast: vi.fn(() => vi.fn()),
  attachRemoteLaserTrails: vi.fn(() => vi.fn()),
}));

vi.mock('../pingSync', () => ({
  attachPingBroadcast: vi.fn(() => vi.fn()),
  attachPingInput: vi.fn(() => vi.fn()),
  attachRemotePings: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));

vi.mock('../measureSync', () => ({
  attachMeasureBroadcast: vi.fn(() => ({
    setSharing: vi.fn(),
    dispose: vi.fn(),
  })),
  attachRemoteMeasurements: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock('../pathSync', () => ({
  attachPathBroadcast: vi.fn(() => ({
    setSharing: vi.fn(),
    dispose: vi.fn(),
  })),
  attachRemotePaths: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));

vi.mock('../layerSync', () => ({
  makeApplyRemoteLayer: vi.fn(() => vi.fn()),
  publishOwnedLayers: vi.fn(),
}));

const animatorAnimateTo = vi.fn();
const broadcastSend = vi.fn();

vi.mock('../focusSync', () => ({
  attachFocusBroadcast: vi.fn(() => ({
    send: (...args: unknown[]) => broadcastSend(...args),
    dispose: () => {
      callOrder.push('focusBroadcast.dispose');
    },
  })),
  createLocalCameraAnimator: vi.fn(() => ({
    animateTo: (...args: unknown[]) => animatorAnimateTo(...args),
    dispose: () => {
      callOrder.push('localAnimator.dispose');
    },
  })),
}));

import { attachFocusBroadcast, createLocalCameraAnimator } from '../focusSync';
import { useDmLocationEditor } from '../DmLocationEditor.hooks';

/** Trimmed from DmLocationEditor.hooks.test.ts's makeStubViewport — real
 * ElementStore/LayerManager (handleReady runs ensureCanonicalLayers /
 * migrateCanvasToContract / subscribePinCanonicalLayers unconditionally,
 * left real here), everything else stubbed. */
function makeStubViewport() {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);
  const el = createShape({ position: { x: 0, y: 0 }, size: { w: 10, h: 10 } });
  store.add(el);

  const selectionListeners = new Set<() => void>();
  const vp = {
    store,
    layerManager,
    domLayer: document.createElement('div'),
    toolManager: {
      getTool: vi.fn(() => undefined),
      onChange: vi.fn(),
      activeTool: { name: 'select' },
    },
    getSelectedIds: vi.fn(() => [] as string[]),
    onSelectionChange: vi.fn((listener: () => void) => {
      selectionListeners.add(listener);
      return () => selectionListeners.delete(listener);
    }),
    camera: {
      setZoom: vi.fn(),
      moveTo: vi.fn(),
      screenToWorld: vi.fn(() => ({ x: 0, y: 0 })),
    },
    loadJSON: vi.fn(),
    exportJSON: vi.fn(() => '{}'),
    addImage: vi.fn(),
    removeGrid: vi.fn(),
    addGrid: vi.fn(),
    updateGrid: vi.fn(),
    removeElements: vi.fn(() => 0),
    requestRender: vi.fn(),
    // The hook now registers the marker painter + activation on every
    // viewport, unconditionally (task B10). A real Viewport carries these;
    // this stub only ever lacked them, and no assertion here depends on them.
    expectCanvasHtmlTypes: vi.fn(() => () => {}),
    registerHtmlPainter: vi.fn(() => () => {}),
    setActivation: vi.fn(() => () => {}),
    onElementActivate: vi.fn(() => () => {}),
    transaction: <T>(operation: () => T): T => operation(),
  };
  return vp as unknown as Viewport;
}

const baseBattleMap: BattleMap = {
  id: 'bm-1',
  campaignCode: 'TEST01',
  name: 'Test Map',
  mapImageUrl: '', // skip _initializeBackground's image path
  mapImageSize: { w: 100, h: 100 },
  canvasState: '', // skip the loadJSON path
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function setup() {
  const vp = makeStubViewport();
  const { result } = renderHook(() =>
    useDmLocationEditor({
      location: baseBattleMap,
      campaignCode: 'TEST01',
      dmId: 'dm-1',
      mode: 'battlemap',
      onSave: vi.fn(),
      onSyncToPlayers: vi.fn(),
    })
  );
  result.current.canvasRef.current = {
    viewport: vp,
  } as unknown as FieldNotesCanvasRef;
  await act(async () => {
    await result.current.handleReady(vp);
  });
  return { vp, result };
}

describe('useDmLocationEditor — focus lifecycle ownership (battlemap mode)', () => {
  const savedRelayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    useBattleMapStore.setState({ battleMaps: {} });
    callOrder.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedRelayUrl !== undefined) {
      process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = savedRelayUrl;
    } else {
      delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    }
  });

  it('attaches focus broadcast + a local animator once the connection comes up', async () => {
    const { vp } = await setup();
    expect(createLocalCameraAnimator).toHaveBeenCalledTimes(1);
    expect(createLocalCameraAnimator).toHaveBeenCalledWith(vp);
    expect(attachFocusBroadcast).toHaveBeenCalledTimes(1);
  });

  it('handleGoToCameraView drives the local animator', async () => {
    const { result } = await setup();
    const view = { x: 1, y: 2, w: 3, h: 4 };
    act(() => {
      result.current.handleGoToCameraView(view);
    });
    expect(animatorAnimateTo).toHaveBeenCalledWith(view);
  });

  it('handleSendCameraView broadcasts with the ping-tool color', async () => {
    const { result } = await setup();
    const view = { x: 5, y: 6, w: 7, h: 8 };
    act(() => {
      result.current.handleSendCameraView(view, 'display');
    });
    expect(broadcastSend).toHaveBeenCalledWith(view, 'display', '#F4C430');
  });

  it('handleGoToCameraView drives the local animator with NO relay URL configured (regression: moving your own camera needs no connection)', async () => {
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    const { vp, result } = await setup();

    // The local animator is created regardless of relay configuration...
    expect(createLocalCameraAnimator).toHaveBeenCalledTimes(1);
    expect(createLocalCameraAnimator).toHaveBeenCalledWith(vp);
    // ...while broadcast — which genuinely needs a connection — correctly
    // stays off.
    expect(attachFocusBroadcast).not.toHaveBeenCalled();

    const view = { x: 1, y: 2, w: 3, h: 4 };
    act(() => {
      result.current.handleGoToCameraView(view);
    });
    expect(animatorAnimateTo).toHaveBeenCalledWith(view);

    act(() => {
      result.current.handleSendCameraView(view, 'display');
    });
    expect(broadcastSend).not.toHaveBeenCalled();
  });

  it('unmount disposes focus broadcast + local animator BEFORE stopping the connection', async () => {
    const vp = makeStubViewport();
    const { result, unmount } = renderHook(() =>
      useDmLocationEditor({
        location: baseBattleMap,
        campaignCode: 'TEST01',
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(vp);
    });
    callOrder.length = 0;

    unmount();

    expect(callOrder).toEqual([
      'focusBroadcast.dispose',
      'localAnimator.dispose',
      'connection.stop',
    ]);
  });
});
