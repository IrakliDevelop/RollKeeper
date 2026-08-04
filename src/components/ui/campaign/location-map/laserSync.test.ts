import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LaserTool, type Camera, type OverlayRenderer } from '@fieldnotes/core';
import type { ToolContext, PointerState } from '@fieldnotes/core';
import { attachLaserBroadcast, attachRemoteLaserTrails } from './laserSync';

// Deterministic raf: callbacks run only when flushFrame() is called.
let rafCallbacks: FrameRequestCallback[];

beforeEach(() => {
  rafCallbacks = [];
  let id = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++id;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function flushFrame(): void {
  const cbs = rafCallbacks;
  rafCallbacks = [];
  for (const cb of cbs) cb(0);
}

function toolCtx(): ToolContext {
  return {
    // Identity camera: screen coords are world coords.
    camera: {
      screenToWorld: (p: { x: number; y: number }) => ({ ...p }),
    } as unknown as Camera,
    store: {} as ToolContext['store'],
    requestRender: vi.fn(),
  };
}

const pt = (x: number, y: number): PointerState => ({
  x,
  y,
  pressure: 0.5,
  pointerType: 'mouse',
  shiftKey: false,
});

describe('attachLaserBroadcast', () => {
  it('forwards coalesced trail emissions as validated laser presence', () => {
    const tool = new LaserTool({ color: '#F4C430', width: 3, fadeMs: 900 });
    const sent: unknown[] = [];
    attachLaserBroadcast(tool, { sendPresence: data => sent.push(data) });

    const ctx = toolCtx();
    tool.onPointerDown(pt(10, 20), ctx);
    tool.onPointerMove(pt(30, 40), ctx);
    expect(sent).toEqual([]); // nothing until the frame tick
    flushFrame();

    expect(sent).toEqual([
      {
        kind: 'laser',
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
        color: '#F4C430',
        width: 3,
        fadeMs: 900,
      },
    ]);
  });

  it('unsubscribe stops broadcasting', () => {
    const tool = new LaserTool();
    const sent: unknown[] = [];
    const unsubscribe = attachLaserBroadcast(tool, {
      sendPresence: data => sent.push(data),
    });
    unsubscribe();

    const ctx = toolCtx();
    tool.onPointerDown(pt(1, 1), ctx);
    flushFrame();
    expect(sent).toEqual([]);
  });
});

describe('attachRemoteLaserTrails', () => {
  function makeViewport() {
    const overlays: OverlayRenderer[] = [];
    let unregisterCalls = 0;
    return {
      overlays,
      get unregisterCalls() {
        return unregisterCalls;
      },
      registerOverlay(draw: OverlayRenderer): () => void {
        overlays.push(draw);
        return () => {
          unregisterCalls += 1;
          const index = overlays.indexOf(draw);
          if (index >= 0) overlays.splice(index, 1);
        };
      },
      requestRender: vi.fn(),
    };
  }

  function makeConnection() {
    const presenceHandlers = new Set<(from: string, data: unknown) => void>();
    const leaveHandlers = new Set<(from: string) => void>();
    return {
      presenceHandlers,
      leaveHandlers,
      onPresence(handler: (from: string, data: unknown) => void): () => void {
        presenceHandlers.add(handler);
        return () => presenceHandlers.delete(handler);
      },
      onPresenceLeave(handler: (from: string) => void): () => void {
        leaveHandlers.add(handler);
        return () => leaveHandlers.delete(handler);
      },
      emitPresence(from: string, data: unknown): void {
        for (const h of [...presenceHandlers]) h(from, data);
      },
      emitLeave(from: string): void {
        for (const h of [...leaveHandlers]) h(from);
      },
    };
  }

  const laser = (x: number, y: number) => ({
    kind: 'laser',
    points: [
      { x, y },
      { x: x + 1, y: y + 1 },
    ],
  });

  /** Count strokes the registered overlay draws on a mock 2d context. */
  function drawnStrokes(overlay: OverlayRenderer | undefined): number {
    let strokes = 0;
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(() => {
        strokes += 1;
      }),
      globalAlpha: 1,
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
      lineJoin: '',
    } as unknown as CanvasRenderingContext2D;
    overlay?.(ctx);
    return strokes;
  }

  it('registers an overlay that renders laser presence and ignores pokes', () => {
    const vp = makeViewport();
    const connection = makeConnection();
    attachRemoteLaserTrails(vp, connection);
    expect(vp.overlays).toHaveLength(1);

    // A hub poke presence frame must not create a trail.
    connection.emitPresence('hub', { kind: 'poke', feature: 'players' });
    expect(drawnStrokes(vp.overlays[0])).toBe(0);
    expect(vp.requestRender).not.toHaveBeenCalled();

    connection.emitPresence('conn-1', laser(0, 0));
    expect(vp.requestRender).toHaveBeenCalled();
    expect(drawnStrokes(vp.overlays[0])).toBe(1);
  });

  it('removes a sender trail immediately on presence-leave', () => {
    const vp = makeViewport();
    const connection = makeConnection();
    attachRemoteLaserTrails(vp, connection);

    connection.emitPresence('conn-1', laser(0, 0));
    connection.emitPresence('conn-2', laser(10, 10));
    expect(drawnStrokes(vp.overlays[0])).toBe(2);

    connection.emitLeave('conn-1');
    expect(drawnStrokes(vp.overlays[0])).toBe(1);
  });

  it('cleanup unsubscribes handlers and disposes the overlay', () => {
    const vp = makeViewport();
    const connection = makeConnection();
    const cleanup = attachRemoteLaserTrails(vp, connection);

    cleanup();
    expect(vp.overlays).toHaveLength(0);
    expect(vp.unregisterCalls).toBe(1);
    expect(connection.presenceHandlers.size).toBe(0);
    expect(connection.leaveHandlers.size).toBe(0);
  });
});
