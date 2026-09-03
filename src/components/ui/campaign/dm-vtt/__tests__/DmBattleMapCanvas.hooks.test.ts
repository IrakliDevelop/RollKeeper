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
  attachRemotePings: vi.fn(() => ({
    dispose: () => {
      callOrder.push('remotePings.dispose');
    },
    overlay: {},
  })),
}));

vi.mock('@/components/ui/campaign/location-map/measureSync', () => ({
  attachMeasureBroadcast: vi.fn(() => ({
    setSharing: vi.fn(),
    dispose: vi.fn(),
  })),
  attachRemoteMeasurements: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock('@/components/ui/campaign/location-map/pathSync', () => ({
  attachPathBroadcast: vi.fn(() => ({
    setSharing: vi.fn(),
    dispose: () => {
      callOrder.push('pathBroadcast.dispose');
    },
  })),
  attachRemotePaths: vi.fn(() => ({
    dispose: () => {
      callOrder.push('remotePaths.dispose');
    },
    overlay: {},
  })),
}));

vi.mock('@/components/ui/campaign/location-map/layerContract', () => ({
  migrateCanvasToContract: vi.fn(() => false),
  subscribePinCanonicalLayers: vi.fn(() => vi.fn()),
}));

const awarenessHandle = {
  roster: {} as never,
  cursorPeers: vi.fn(() => []),
  announce: vi.fn(),
  setShareCursor: vi.fn(),
  setShowPlayerCursors: vi.fn(),
  setIdentity: vi.fn(),
  dispose: () => {
    callOrder.push('awareness.dispose');
  },
};
vi.mock('@/components/ui/campaign/location-map/awarenessSync', () => ({
  attachAwarenessSync: vi.fn(() => awarenessHandle),
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
import { attachPathBroadcast } from '@/components/ui/campaign/location-map/pathSync';
import { attachAwarenessSync } from '@/components/ui/campaign/location-map/awarenessSync';
import { attachRemoteMeasurements } from '@/components/ui/campaign/location-map/measureSync';
import { createManagedBattleMapConnection } from '@/lib/battlemapSync';
import { useDmStore } from '@/store/dmStore';
import { useDmBattleMapCanvas } from '../DmBattleMapCanvas.hooks';

/** A minimal stand-in for the registered movement `PathTool` — truthy so
 * `getTool<PathTool>('path')` resolves and the hook's movement-commit and
 * path-broadcast wiring actually run (both are gated on it being present). */
function makeFakeMovementTool() {
  return { onPath: vi.fn(() => vi.fn()), onCommit: vi.fn(() => vi.fn()) };
}

function makeVp(): Viewport {
  const fakeMovementTool = makeFakeMovementTool();
  return {
    store: { on: vi.fn(), getById: vi.fn(() => undefined) },
    layerManager: {},
    camera: {},
    domLayer: document.createElement('div'),
    toolManager: {
      getTool: vi.fn((name: string) =>
        name === 'path' ? fakeMovementTool : undefined
      ),
    },
    onSelectionChange: vi.fn(() => vi.fn()),
    getSelectedIds: vi.fn(() => []),
    loadJSON: vi.fn(),
    exportJSON: vi.fn(() => '{}'),
    requestRender: vi.fn(),
    // The hook now registers the marker painter + activation on every
    // viewport, unconditionally (task B10). A real Viewport carries these;
    // this stub only ever lacked them, and no assertion here depends on them —
    // see DmBattleMapCanvas.hooks.markers.test.ts for the marker coverage.
    expectCanvasHtmlTypes: vi.fn(() => () => {}),
    registerHtmlPainter: vi.fn(() => () => {}),
    setActivation: vi.fn(() => () => {}),
    onElementActivate: vi.fn(() => () => {}),
    transaction: <T>(operation: () => T): T => operation(),
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
    useDmStore.setState({ campaigns: [] });
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
    // focus teardown, pushed alongside measureBroadcast's, the path
    // broadcast/receiver teardown, and — pushed last — awareness's own
    // `cleared` frame) BEFORE connectionRef.current?.stop() — cleanup
    // ordering rides the live connection, matching the measure handle's own
    // final clear.
    expect(callOrder).toEqual([
      'remotePings.dispose',
      'remotePaths.dispose',
      'focusBroadcast.dispose',
      'pathBroadcast.dispose',
      'awareness.dispose',
      'localAnimator.dispose',
      'connection.stop',
    ]);
  });

  it('attachPathBroadcast receives OPTION FUNCTIONS that re-read live state — isDmOnlyElement is not a snapshot taken at attach time', () => {
    useBattleMapStore.setState({
      battleMaps: {
        TEST01: {
          'bm-1': {
            id: 'bm-1',
            campaignCode: 'TEST01',
            name: 'Map',
            mapImageUrl: '',
            mapImageSize: { w: 0, h: 0 },
            canvasState: '',
            dmOnlyElements: {},
            gridEnabled: false,
            linkedEncounterIds: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      },
    });
    const vp = makeVp();
    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));

    act(() => {
      result.current.handleReady(vp);
    });

    expect(attachPathBroadcast).toHaveBeenCalledTimes(1);
    const options = vi.mocked(attachPathBroadcast).mock.calls[0]?.[2] as {
      isDmOnlyElement: (id: string) => boolean;
    };
    expect(options.isDmOnlyElement('tok-1')).toBe(false);

    useBattleMapStore.getState().toggleDmOnly('TEST01', 'bm-1', 'tok-1');

    // Same function reference, called again — the answer changed because it
    // re-reads the store live, not because a new closure was built.
    expect(options.isDmOnlyElement('tok-1')).toBe(true);
  });

  it('attaches awareness as DM with cursor OFF, players shown, and disposes it BEFORE connection.stop on unmount', () => {
    const vp = makeVp();
    const { result, unmount } = renderHook(() =>
      useDmBattleMapCanvas(baseProps())
    );
    act(() => result.current.handleReady(vp));
    const [, , options] = vi.mocked(attachAwarenessSync).mock.calls[0]!;
    expect(options.identity).toEqual({
      id: baseProps().dmId,
      name: 'DM',
      role: 'dm',
    });
    expect(options.shareCursor).toBe(false);
    expect(options.showPlayerCursors).toBe(true);
    expect(result.current.awarenessRoster).toBe(awarenessHandle.roster);
    unmount();
    expect(callOrder.indexOf('awareness.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('awareness.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
  });

  it('RE-ATTACH: a second handleReady disposes the OLD attachment BEFORE stopping the OLD connection', () => {
    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    act(() => result.current.handleReady(makeVp()));
    callOrder.length = 0;
    act(() => result.current.handleReady(makeVp()));
    // Old cleanup (awareness + path/focus handles) must precede the old stop —
    // the `cleared` frames ride the still-live socket.
    expect(callOrder.indexOf('awareness.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('pathBroadcast.dispose')).toBeGreaterThanOrEqual(
      0
    );
    expect(callOrder.indexOf('awareness.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.indexOf('pathBroadcast.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.filter(c => c === 'connection.stop')).toHaveLength(1); // the new one is not stopped
    expect(vi.mocked(attachAwarenessSync)).toHaveBeenCalledTimes(2);
  });

  it('announces on every live status and forwards the two switches; re-attach re-applies both', () => {
    const vp = makeVp();
    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    act(() => result.current.handleReady(vp));
    const onStatus = vi.mocked(createManagedBattleMapConnection).mock
      .calls[0]![0].onStatus!;
    act(() => onStatus('live'));
    act(() => onStatus('connecting'));
    act(() => onStatus('live'));
    expect(awarenessHandle.announce).toHaveBeenCalledTimes(2);

    act(() => result.current.handleSetCursorSharing(true));
    expect(awarenessHandle.setShareCursor).toHaveBeenCalledWith(true);
    expect(result.current.cursorSharing).toBe(true);
    act(() => result.current.handleSetShowPlayerCursors(false));
    expect(awarenessHandle.setShowPlayerCursors).toHaveBeenCalledWith(false);
    expect(result.current.showPlayerCursors).toBe(false);

    act(() => result.current.handleReady(makeVp())); // viewport rebuild
    const [, , again] = vi.mocked(attachAwarenessSync).mock.calls.at(-1)!;
    expect(again.shareCursor).toBe(true);
    expect(again.showPlayerCursors).toBe(false);
  });

  it('colorFor reads playerColors LIVE from the DM store', () => {
    const vp = makeVp();
    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    act(() => result.current.handleReady(vp));
    const [, , options] = vi.mocked(attachAwarenessSync).mock.calls[0]!;
    const peer = {
      from: 'c1',
      id: 'char-a',
      cursor: null,
      selection: [],
      tool: null,
    };
    expect(options.colorFor?.(peer)).toBeUndefined();
    useDmStore.setState({
      campaigns: [
        {
          code: baseProps().campaignCode,
          name: 'x',
          createdAt: '',
          playerColors: { 'char-a': '#abcdef' },
        },
      ],
    });
    expect(options.colorFor?.(peer)).toBe('#abcdef');
  });

  it('ATTACH FAULT: when awareness construction throws, every earlier helper is disposed, the NEW connection is stopped, the error surfaces, and unmount does not double-tear-down', () => {
    vi.mocked(attachAwarenessSync).mockImplementationOnce(() => {
      throw new Error('awareness boom');
    });
    const { result, unmount } = renderHook(() =>
      useDmBattleMapCanvas(baseProps())
    );
    expect(() => {
      act(() => result.current.handleReady(makeVp()));
    }).toThrow('awareness boom');
    // Helpers created BEFORE awareness were unwound, then the new socket stopped.
    expect(callOrder.indexOf('remotePaths.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('focusBroadcast.dispose')).toBeGreaterThanOrEqual(
      0
    );
    expect(callOrder.indexOf('pathBroadcast.dispose')).toBeGreaterThanOrEqual(
      0
    );
    expect(callOrder.indexOf('pathBroadcast.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.filter(c => c === 'connection.stop')).toHaveLength(1);
    callOrder.length = 0;
    unmount();
    // Nothing connection-scoped is left to tear down: no second stop, no re-dispose.
    expect(callOrder).not.toContain('connection.stop');
    expect(callOrder).not.toContain('pathBroadcast.dispose');
  });

  it('EARLY RECEIVER FAULT: when a receiver constructor throws, earlier receivers are disposed before connection.stop', () => {
    vi.mocked(attachRemoteMeasurements).mockImplementationOnce(() => {
      throw new Error('measurements boom');
    });
    const { result, unmount } = renderHook(() =>
      useDmBattleMapCanvas(baseProps())
    );
    expect(() => {
      act(() => result.current.handleReady(makeVp()));
    }).toThrow('measurements boom');
    expect(callOrder).toContain('remotePings.dispose');
    expect(callOrder.indexOf('remotePings.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder).not.toContain('remotePaths.dispose');
    expect(callOrder.filter(c => c === 'connection.stop')).toHaveLength(1);
    callOrder.length = 0;
    unmount();
    expect(callOrder).not.toContain('connection.stop');
  });
});
