import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Viewport } from '@fieldnotes/core';
import { useBattleMapStore } from '@/store/battleMapStore';

/**
 * Ownership-split regression coverage for Task 13: the viewport/connection
 * lifecycle — including `attachFocusBroadcast`/`createLocalCameraAnimator` —
 * must live in THIS hook, not in `DmBattleMapCanvas.tsx`. If that wiring
 * were accidentally dropped, or moved to the component (where there is no
 * connection to attach to), these refs never populate and
 * `handleGoToCameraView`/`handleSendCameraView` silently no-op. This file
 * exercises the hook directly against a live (mocked) connection to catch
 * exactly that regression — component-level tests that stub the hook
 * entirely (see DmBattleMapCanvas.test.tsx) cannot see it.
 */

vi.mock('@fieldnotes/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/core')>();
  return {
    ...actual,
    // AutoSave touches storage adapters/timers irrelevant here.
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

vi.mock('@/components/ui/campaign/location-map/laserSync', () => ({
  attachLaserBroadcast: vi.fn(() => vi.fn()),
  attachRemoteLaserTrails: vi.fn(() => vi.fn()),
}));

vi.mock('@/components/ui/campaign/location-map/pingSync', () => ({
  attachPingBroadcast: vi.fn(() => vi.fn()),
  attachPingInput: vi.fn(() => vi.fn()),
  attachRemotePings: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));

vi.mock('@/components/ui/campaign/location-map/measureSync', () => ({
  attachMeasureBroadcast: vi.fn(() => ({
    setSharing: vi.fn(),
    dispose: vi.fn(),
  })),
  attachRemoteMeasurements: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock('@/components/ui/campaign/location-map/layerContract', () => ({
  migrateCanvasToContract: vi.fn(() => false),
  subscribePinCanonicalLayers: vi.fn(() => vi.fn()),
}));

vi.mock('@/components/ui/campaign/location-map/layerSync', () => ({
  makeApplyRemoteLayer: vi.fn(() => vi.fn()),
  publishOwnedLayers: vi.fn(),
}));

const animatorAnimateTo = vi.fn();
const broadcastSend = vi.fn();

vi.mock('@/components/ui/campaign/location-map/focusSync', () => ({
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

import {
  attachFocusBroadcast,
  createLocalCameraAnimator,
} from '@/components/ui/campaign/location-map/focusSync';
import { useDmBattleMapCanvas } from '../DmBattleMapCanvas.hooks';

function makeVp(): Viewport {
  return {
    store: { on: vi.fn() },
    layerManager: {},
    camera: {},
    domLayer: document.createElement('div'),
    toolManager: { getTool: vi.fn(() => undefined) },
    onSelectionChange: vi.fn(() => vi.fn()),
    getSelectedIds: vi.fn(() => []),
    loadJSON: vi.fn(),
    exportJSON: vi.fn(() => '{}'),
    requestRender: vi.fn(),
  } as unknown as Viewport;
}

function baseProps() {
  return {
    campaignCode: 'TEST01',
    battleMapId: 'bm-1',
    dmId: 'dm-1',
    tokenConfigRef: { current: null },
    tokenInfoToggle: { mode: null, onCycle: vi.fn() },
    onExportError: vi.fn(),
  };
}

describe('useDmBattleMapCanvas — focus lifecycle ownership', () => {
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

  it('attaches focus broadcast + a local animator once the connection comes up', () => {
    const vp = makeVp();
    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));

    act(() => {
      result.current.handleReady(vp);
    });

    expect(createLocalCameraAnimator).toHaveBeenCalledTimes(1);
    expect(createLocalCameraAnimator).toHaveBeenCalledWith(vp);
    expect(attachFocusBroadcast).toHaveBeenCalledTimes(1);
  });

  it('handleGoToCameraView drives the local animator (no remote receiver on DM canvases)', () => {
    const vp = makeVp();
    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    act(() => {
      result.current.handleReady(vp);
    });

    const view = { x: 1, y: 2, w: 3, h: 4 };
    act(() => {
      result.current.handleGoToCameraView(view);
    });

    expect(animatorAnimateTo).toHaveBeenCalledWith(view);
  });

  it('handleSendCameraView broadcasts with the ping-tool color', () => {
    const vp = makeVp();
    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    act(() => {
      result.current.handleReady(vp);
    });

    const view = { x: 5, y: 6, w: 7, h: 8 };
    act(() => {
      result.current.handleSendCameraView(view, 'players');
    });

    expect(broadcastSend).toHaveBeenCalledWith(view, 'players', '#F4C430');
  });

  it('handleGoToCameraView/handleSendCameraView are silent no-ops before handleReady is called (no viewport wired yet)', () => {
    // NOTE: this is about handleReady never having run — not about the
    // relay being unset. Do not read this as "no connection means no local
    // animator either": see the no-relay-configured test below, which
    // proves the local animator IS created (and handleGoToCameraView DOES
    // work) once handleReady runs, with no relay URL at all.
    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    // handleReady never called — refs are still null.
    expect(() =>
      result.current.handleGoToCameraView({ x: 0, y: 0, w: 1, h: 1 })
    ).not.toThrow();
    expect(() =>
      result.current.handleSendCameraView({ x: 0, y: 0, w: 1, h: 1 }, 'all')
    ).not.toThrow();
    expect(animatorAnimateTo).not.toHaveBeenCalled();
    expect(broadcastSend).not.toHaveBeenCalled();
  });

  it('handleGoToCameraView drives the local animator with NO relay URL configured (regression: moving your own camera needs no connection)', () => {
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    const vp = makeVp();
    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));

    act(() => {
      result.current.handleReady(vp);
    });

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
      result.current.handleSendCameraView(view, 'players');
    });
    expect(broadcastSend).not.toHaveBeenCalled();
  });

  it('unmount disposes focus broadcast + local animator BEFORE stopping the connection', () => {
    const vp = makeVp();
    const { result, unmount } = renderHook(() =>
      useDmBattleMapCanvas(baseProps())
    );
    act(() => {
      result.current.handleReady(vp);
    });

    unmount();

    // The unmount effect runs laserCleanupRef.current?.() (which carries the
    // focus teardown, pushed alongside measureBroadcast's) BEFORE
    // connectionRef.current?.stop() — cleanup ordering rides the live
    // connection, matching the measure handle's own final clear.
    expect(callOrder).toEqual([
      'focusBroadcast.dispose',
      'localAnimator.dispose',
      'connection.stop',
    ]);
  });
});
