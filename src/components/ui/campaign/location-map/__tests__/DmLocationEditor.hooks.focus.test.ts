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
  attachRemotePings: vi.fn(() => ({
    dispose: () => {
      callOrder.push('remotePings.dispose');
    },
    overlay: {},
  })),
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
vi.mock('../awarenessSync', () => ({
  attachAwarenessSync: vi.fn(() => awarenessHandle),
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
import { attachAwarenessSync } from '../awarenessSync';
import { attachRemoteMeasurements } from '../measureSync';
import { createManagedBattleMapConnection } from '@/lib/battlemapSync';
import { useDmStore } from '@/store/dmStore';
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
    useDmStore.setState({ campaigns: [] });
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

    // Cleanup ordering rides the live connection: remotePaths (pushed first
    // among laserCleanups), focusBroadcast, and — pushed last, inside the
    // connection scope — awareness's own `cleared` frame, all BEFORE
    // connection.stop.
    expect(callOrder).toEqual([
      'remotePings.dispose',
      'remotePaths.dispose',
      'focusBroadcast.dispose',
      'awareness.dispose',
      'localAnimator.dispose',
      'connection.stop',
    ]);
  });

  it('attaches awareness as DM with cursor OFF, players shown, and disposes it BEFORE connection.stop on unmount', async () => {
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

    const [, , options] = vi.mocked(attachAwarenessSync).mock.calls[0]!;
    expect(options.identity).toEqual({
      id: 'dm-1',
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

  it('RE-ATTACH: a second handleReady disposes the OLD attachment BEFORE stopping the OLD connection', async () => {
    const { result } = await setup();
    callOrder.length = 0;
    await act(async () => {
      await result.current.handleReady(makeStubViewport());
    });
    // Old cleanup (awareness + remotePaths handles) must precede the old
    // stop — the `cleared` frames ride the still-live socket.
    expect(callOrder.indexOf('awareness.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('remotePaths.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('awareness.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.indexOf('remotePaths.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.filter(c => c === 'connection.stop')).toHaveLength(1); // the new one is not stopped
    expect(vi.mocked(attachAwarenessSync)).toHaveBeenCalledTimes(2);
  });

  it('announces on every live status and forwards the two switches; re-attach re-applies both', async () => {
    const { result } = await setup();
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

    await act(async () => {
      await result.current.handleReady(makeStubViewport()); // viewport rebuild
    });
    const [, , again] = vi.mocked(attachAwarenessSync).mock.calls.at(-1)!;
    expect(again.shareCursor).toBe(true);
    expect(again.showPlayerCursors).toBe(false);
  });

  it('colorFor reads playerColors LIVE from the DM store', async () => {
    await setup();
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
          code: 'TEST01',
          name: 'x',
          createdAt: '',
          playerColors: { 'char-a': '#abcdef' },
        },
      ],
    });
    expect(options.colorFor?.(peer)).toBe('#abcdef');
  });

  it('ATTACH FAULT: when awareness construction throws, every earlier helper is disposed, the NEW connection is stopped, the error surfaces, and unmount does not double-tear-down', async () => {
    vi.mocked(attachAwarenessSync).mockImplementationOnce(() => {
      throw new Error('awareness boom');
    });
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

    await expect(
      act(async () => {
        await result.current.handleReady(vp);
      })
    ).rejects.toThrow('awareness boom');

    // Helpers created BEFORE awareness were unwound, then the new socket stopped.
    expect(callOrder.indexOf('remotePaths.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('focusBroadcast.dispose')).toBeGreaterThanOrEqual(
      0
    );
    expect(callOrder.indexOf('focusBroadcast.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.filter(c => c === 'connection.stop')).toHaveLength(1);
    callOrder.length = 0;
    unmount();
    // Nothing connection-scoped is left to tear down: no second stop, no re-dispose.
    expect(callOrder).not.toContain('connection.stop');
    expect(callOrder).not.toContain('focusBroadcast.dispose');
  });

  it('never attaches awareness in location mode (no relay connection at all)', async () => {
    const vp = makeStubViewport();
    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: baseBattleMap,
        campaignCode: 'TEST01',
        dmId: 'dm-1',
        mode: 'location',
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
    expect(attachAwarenessSync).not.toHaveBeenCalled();
  });

  it('EARLY RECEIVER FAULT: when a receiver constructor throws, earlier receivers are disposed before connection.stop', async () => {
    vi.mocked(attachRemoteMeasurements).mockImplementationOnce(() => {
      throw new Error('measurements boom');
    });
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
    await expect(
      act(async () => {
        await result.current.handleReady(vp);
      })
    ).rejects.toThrow('measurements boom');
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
