import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MeasureTool,
  type Camera,
  type OverlayRenderer,
  type ToolContext,
  type PointerState,
} from '@fieldnotes/core';
import {
  attachMeasureBroadcast,
  attachRemoteMeasurements,
} from './measureSync';

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

// With the identity camera and no grid, start/end pass through unsnapped, so
// a (0,0)->(3,4) drag always yields worldDistance 5 / cells 5 / feet 25 with
// the default MeasureTool color.
const activeFrame = (
  start: { x: number; y: number },
  end: { x: number; y: number }
) => ({
  kind: 'measure',
  start,
  end,
  cells: 5,
  feet: 25,
  color: '#FF5722',
});
const clearedFrame = { kind: 'measure', cleared: true };

describe('attachMeasureBroadcast', () => {
  it('default (sharing off) suppresses all frames', () => {
    const tool = new MeasureTool();
    const sendPresence = vi.fn();
    attachMeasureBroadcast(tool, { sendPresence });

    const ctx = toolCtx();
    tool.onPointerDown(pt(0, 0), ctx);
    tool.onPointerMove(pt(3, 4), ctx);
    flushFrame();
    tool.onPointerUp(pt(3, 4), ctx);

    expect(sendPresence).not.toHaveBeenCalled();
  });

  it('setSharing(true) then drag: active frames sent, cleared on release', () => {
    const tool = new MeasureTool();
    const sendPresence = vi.fn();
    const handle = attachMeasureBroadcast(tool, { sendPresence });
    handle.setSharing(true);

    const ctx = toolCtx();
    tool.onPointerDown(pt(10, 20), ctx);
    tool.onPointerMove(pt(13, 24), ctx);
    flushFrame();
    expect(sendPresence).toHaveBeenNthCalledWith(
      1,
      activeFrame({ x: 10, y: 20 }, { x: 13, y: 24 })
    );

    tool.onPointerUp(pt(13, 24), ctx);
    expect(sendPresence).toHaveBeenNthCalledWith(2, clearedFrame);
    expect(sendPresence).toHaveBeenCalledTimes(2);
  });

  it('setSharing(false) after an active frame (no release) sends exactly one extra cleared frame', () => {
    const tool = new MeasureTool();
    const sendPresence = vi.fn();
    const handle = attachMeasureBroadcast(tool, { sendPresence });
    handle.setSharing(true);

    const ctx = toolCtx();
    tool.onPointerDown(pt(0, 0), ctx);
    tool.onPointerMove(pt(3, 4), ctx);
    flushFrame();
    expect(sendPresence).toHaveBeenCalledTimes(1);

    handle.setSharing(false);
    expect(sendPresence).toHaveBeenCalledTimes(2);
    expect(sendPresence).toHaveBeenLastCalledWith(clearedFrame);

    handle.setSharing(false); // redundant: no extra send
    expect(sendPresence).toHaveBeenCalledTimes(2);
  });

  it('setSharing(false) after a natural release (clear already sent) sends nothing extra', () => {
    const tool = new MeasureTool();
    const sendPresence = vi.fn();
    const handle = attachMeasureBroadcast(tool, { sendPresence });
    handle.setSharing(true);

    const ctx = toolCtx();
    tool.onPointerDown(pt(0, 0), ctx);
    tool.onPointerMove(pt(3, 4), ctx);
    flushFrame();
    tool.onPointerUp(pt(3, 4), ctx);
    expect(sendPresence).toHaveBeenCalledTimes(2); // active + cleared

    handle.setSharing(false);
    expect(sendPresence).toHaveBeenCalledTimes(2);
  });

  it('setSharing(true) mid-suppression resumes on the next emission', () => {
    const tool = new MeasureTool();
    const sendPresence = vi.fn();
    const handle = attachMeasureBroadcast(tool, { sendPresence });

    const ctx = toolCtx();
    tool.onPointerDown(pt(10, 20), ctx);
    tool.onPointerMove(pt(11, 21), ctx);
    flushFrame();
    expect(sendPresence).not.toHaveBeenCalled();

    handle.setSharing(true);
    tool.onPointerMove(pt(13, 24), ctx);
    flushFrame();
    expect(sendPresence).toHaveBeenCalledTimes(1);
    expect(sendPresence).toHaveBeenLastCalledWith(
      activeFrame({ x: 10, y: 20 }, { x: 13, y: 24 })
    );
  });

  it('redundant setSharing(true) twice causes no duplicate behavior', () => {
    const tool = new MeasureTool();
    const sendPresence = vi.fn();
    const handle = attachMeasureBroadcast(tool, { sendPresence });
    handle.setSharing(true);
    handle.setSharing(true);

    const ctx = toolCtx();
    tool.onPointerDown(pt(0, 0), ctx);
    tool.onPointerMove(pt(3, 4), ctx);
    flushFrame();
    expect(sendPresence).toHaveBeenCalledTimes(1);
  });

  it('dispose() after an active frame sends one final cleared frame; further calls/emissions send nothing', () => {
    const tool = new MeasureTool();
    const sendPresence = vi.fn();
    const handle = attachMeasureBroadcast(tool, { sendPresence });
    handle.setSharing(true);

    const ctx = toolCtx();
    tool.onPointerDown(pt(0, 0), ctx);
    tool.onPointerMove(pt(3, 4), ctx);
    flushFrame();
    expect(sendPresence).toHaveBeenCalledTimes(1);

    handle.dispose();
    expect(sendPresence).toHaveBeenCalledTimes(2);
    expect(sendPresence).toHaveBeenLastCalledWith(clearedFrame);

    handle.dispose(); // idempotent
    expect(sendPresence).toHaveBeenCalledTimes(2);

    tool.onPointerMove(pt(5, 5), ctx);
    flushFrame();
    expect(sendPresence).toHaveBeenCalledTimes(2);
  });

  it('replacement-handle contract: a fresh handle keeps sharing on across reattachment', () => {
    const tool = new MeasureTool();
    const sentA: unknown[] = [];
    const handleA = attachMeasureBroadcast(tool, {
      sendPresence: d => sentA.push(d),
    });
    handleA.setSharing(true);
    handleA.dispose(); // no frame emitted yet, so no cleared send here
    expect(sentA).toEqual([]);

    const sentB: unknown[] = [];
    const handleB = attachMeasureBroadcast(tool, {
      sendPresence: d => sentB.push(d),
    });
    handleB.setSharing(true);

    const ctx = toolCtx();
    tool.onPointerDown(pt(1, 1), ctx);
    tool.onPointerMove(pt(4, 5), ctx);
    flushFrame();

    expect(sentB).toEqual([activeFrame({ x: 1, y: 1 }, { x: 4, y: 5 })]);
    expect(sentA).toEqual([]);
  });
});

describe('attachRemoteMeasurements', () => {
  function makeHost() {
    const overlays: OverlayRenderer[] = [];
    return {
      overlays,
      registerOverlay(draw: OverlayRenderer): () => void {
        overlays.push(draw);
        return () => {
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

  const measure = (x: number, y: number) => ({
    kind: 'measure',
    start: { x, y },
    end: { x: x + 5, y },
    cells: 5,
    feet: 25,
  });

  it('applies measure payloads keyed by sender and ignores foreign kinds', () => {
    const host = makeHost();
    const connection = makeConnection();
    const handle = attachRemoteMeasurements(host, connection);

    connection.emitPresence('hub', { kind: 'poke', feature: 'players' });
    connection.emitPresence('conn-1', {
      kind: 'laser',
      points: [{ x: 0, y: 0 }],
    });
    connection.emitPresence('conn-1', { kind: 'ping', x: 0, y: 0 });
    expect(handle.overlay.activeSenderCount).toBe(0);

    connection.emitPresence('conn-1', measure(0, 0));
    expect(handle.overlay.activeSenderCount).toBe(1);
  });

  it('presence-leave removes the sender immediately', () => {
    const host = makeHost();
    const connection = makeConnection();
    const handle = attachRemoteMeasurements(host, connection);

    connection.emitPresence('conn-1', measure(0, 0));
    expect(handle.overlay.activeSenderCount).toBe(1);

    connection.emitLeave('conn-1');
    expect(handle.overlay.activeSenderCount).toBe(0);
  });

  it('dispose() unsubscribes both handlers and disposes the overlay', () => {
    const host = makeHost();
    const connection = makeConnection();
    const handle = attachRemoteMeasurements(host, connection);

    handle.dispose();

    expect(connection.presenceHandlers.size).toBe(0);
    expect(connection.leaveHandlers.size).toBe(0);
    expect(handle.overlay.apply('conn-1', measure(0, 0))).toBe(false);
  });
});
