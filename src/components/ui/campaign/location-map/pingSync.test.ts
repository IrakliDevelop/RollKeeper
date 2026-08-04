import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PingTool, type Camera, type OverlayRenderer } from '@fieldnotes/core';
import type { ToolContext, PointerState } from '@fieldnotes/core';
import { attachPingBroadcast, attachRemotePings } from './pingSync';

// Deterministic raf: callbacks run only when explicitly flushed (unused by
// pings' assertions but keeps overlay animation loops inert).
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

describe('attachPingBroadcast', () => {
  it('forwards accepted taps as validated ping presence', () => {
    const tool = new PingTool({
      color: '#F4C430',
      durationMs: 1500,
      radius: 40,
    });
    const sent: unknown[] = [];
    attachPingBroadcast(tool, { sendPresence: data => sent.push(data) });

    tool.onPointerDown(pt(10, 20), toolCtx());

    expect(sent).toEqual([
      {
        kind: 'ping',
        x: 10,
        y: 20,
        color: '#F4C430',
        durationMs: 1500,
        radius: 40,
      },
    ]);
  });

  it('rate-limited taps broadcast nothing', () => {
    const tool = new PingTool({ minIntervalMs: 10_000 });
    const sent: unknown[] = [];
    attachPingBroadcast(tool, { sendPresence: data => sent.push(data) });

    const ctx = toolCtx();
    tool.onPointerDown(pt(1, 1), ctx);
    tool.onPointerDown(pt(2, 2), ctx); // inside the interval — dropped
    expect(sent).toHaveLength(1);
  });

  it('unsubscribe stops broadcasting', () => {
    const tool = new PingTool();
    const sent: unknown[] = [];
    const unsubscribe = attachPingBroadcast(tool, {
      sendPresence: data => sent.push(data),
    });
    unsubscribe();

    tool.onPointerDown(pt(1, 1), toolCtx());
    expect(sent).toEqual([]);
  });
});

describe('attachRemotePings', () => {
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

  const ping = (x: number, y: number) => ({ kind: 'ping', x, y });

  /** Count distinct pings the registered overlay draws (one fill = one ping
   * center dot on a mock 2d context). */
  function drawnPings(overlay: OverlayRenderer | undefined): number {
    let fills = 0;
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(() => {
        fills += 1;
      }),
      globalAlpha: 1,
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D;
    overlay?.(ctx);
    return fills;
  }

  it('registers an overlay that renders ping presence and ignores pokes and lasers', () => {
    const vp = makeViewport();
    const connection = makeConnection();
    attachRemotePings(vp, connection);
    expect(vp.overlays).toHaveLength(1);

    // Hub pokes and laser trails must not create a ping.
    connection.emitPresence('hub', { kind: 'poke', feature: 'players' });
    connection.emitPresence('conn-1', {
      kind: 'laser',
      points: [{ x: 0, y: 0 }],
    });
    expect(drawnPings(vp.overlays[0])).toBe(0);
    expect(vp.requestRender).not.toHaveBeenCalled();

    connection.emitPresence('conn-1', ping(0, 0));
    expect(vp.requestRender).toHaveBeenCalled();
    expect(drawnPings(vp.overlays[0])).toBe(1);
  });

  it('removes a sender ping immediately on presence-leave', () => {
    const vp = makeViewport();
    const connection = makeConnection();
    attachRemotePings(vp, connection);

    connection.emitPresence('conn-1', ping(0, 0));
    connection.emitPresence('conn-2', ping(10, 10));
    expect(drawnPings(vp.overlays[0])).toBe(2);

    connection.emitLeave('conn-1');
    expect(drawnPings(vp.overlays[0])).toBe(1);
  });

  it('cleanup unsubscribes handlers and disposes the overlay', () => {
    const vp = makeViewport();
    const connection = makeConnection();
    const cleanup = attachRemotePings(vp, connection);

    cleanup();
    expect(vp.overlays).toHaveLength(0);
    expect(vp.unregisterCalls).toBe(1);
    expect(connection.presenceHandlers.size).toBe(0);
    expect(connection.leaveHandlers.size).toBe(0);
  });

  it('coexists with a laser overlay on the same connection — each renders only its kind', () => {
    const vp = makeViewport();
    const connection = makeConnection();
    attachRemotePings(vp, connection);

    // Simulate the laser attachment sharing the connection: both handler sets
    // receive every frame; the ping overlay must only react to pings.
    const seenByOther: unknown[] = [];
    connection.onPresence((_from, data) => seenByOther.push(data));

    connection.emitPresence('conn-1', ping(5, 5));
    connection.emitPresence('conn-1', {
      kind: 'laser',
      points: [{ x: 1, y: 1 }],
    });
    connection.emitPresence('hub', { kind: 'poke', feature: 'players' });

    expect(drawnPings(vp.overlays[0])).toBe(1); // only the ping
    expect(seenByOther).toHaveLength(3); // other subscribers see everything
  });
});
