import { describe, it, expect, vi } from 'vitest';
import { createShape, toPathPresence } from '@fieldnotes/core';
import type {
  CanvasElement,
  PathEmission,
  OverlayRenderer,
} from '@fieldnotes/core';

import { attachPathBroadcast, attachRemotePaths } from '../pathSync';
import { COMBATANT_TOKEN_KIND } from '../tokenIdentity';

// --- Shared fixtures (from the brief) --------------------------------------

function emitter() {
  let listener: ((e: PathEmission | null) => void) | null = null;
  return {
    onPath(l: (e: PathEmission | null) => void) {
      listener = l;
      return () => {
        listener = null;
      };
    },
    emit(e: PathEmission | null) {
      listener?.(e);
    },
  };
}

function activeEmission(anchorKey?: string): PathEmission {
  return {
    anchorKey,
    waypoints: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ],
    cursor: null,
    segments: [{ cells: 1, feet: 5 }],
    totalCells: 1,
    totalFeet: 5,
    color: '#EF4444',
    rangeBands: [],
  } as unknown as PathEmission;
}

function connection() {
  const sent: unknown[] = [];
  return { sent, sendPresence: (d: unknown) => sent.push(d) };
}

/** A real, minimal movable (combatant) token element. */
function makeToken(entityId: string): CanvasElement {
  const shape = createShape({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    shape: 'ellipse',
    strokeColor: '#000',
    strokeWidth: 1,
    fillColor: '#c0392b',
  });
  const el = {
    ...shape,
    zIndex: 1000,
    tokenKind: COMBATANT_TOKEN_KIND,
    entityId,
  };
  return el as CanvasElement;
}

/** Same id, no tokenKind/entityId — a retyped element under the same key. */
function makePlainElement(id: string): CanvasElement {
  const shape = createShape({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    shape: 'ellipse',
    strokeColor: '#000',
    strokeWidth: 1,
    fillColor: '#2980b9',
  });
  const el = { ...shape, id };
  return el as CanvasElement;
}

const clearedPayload = toPathPresence(null);

describe('attachPathBroadcast', () => {
  // Case 1
  it('DM default is private: no broadcast until sharing is turned on', () => {
    const map = new Map<string, CanvasElement>();
    const token = makeToken('e-1');
    map.set(token.id, token);
    const tool = emitter();
    const conn = connection();
    attachPathBroadcast(tool, conn, {
      role: 'dm',
      isDmOnlyElement: () => false,
      getElement: id => map.get(id) ?? null,
    });

    tool.emit(activeEmission(token.id));

    expect(conn.sent).toEqual([]);
  });

  // Case 2
  it('DM sharing on broadcasts, sharing off sends exactly one cleared frame, then nothing', () => {
    const map = new Map<string, CanvasElement>();
    const token = makeToken('e-1');
    map.set(token.id, token);
    const tool = emitter();
    const conn = connection();
    const handle = attachPathBroadcast(tool, conn, {
      role: 'dm',
      isDmOnlyElement: () => false,
      getElement: id => map.get(id) ?? null,
    });

    handle.setSharing(true);
    const emission = activeEmission(token.id);
    tool.emit(emission);
    expect(conn.sent).toEqual([toPathPresence(emission)]);

    handle.setSharing(false);
    expect(conn.sent).toEqual([toPathPresence(emission), clearedPayload]);

    tool.emit(activeEmission(token.id));
    expect(conn.sent).toHaveLength(2);
  });

  // Case 3
  it('player role always broadcasts without setSharing', () => {
    const map = new Map<string, CanvasElement>();
    const token = makeToken('e-1');
    map.set(token.id, token);
    const tool = emitter();
    const conn = connection();
    attachPathBroadcast(tool, conn, {
      role: 'player',
      isDmOnlyElement: () => false,
      getElement: id => map.get(id) ?? null,
    });

    const emission = activeEmission(token.id);
    tool.emit(emission);

    expect(conn.sent).toEqual([toPathPresence(emission)]);
  });

  // Case 4
  describe('DM-only anchor fails closed', () => {
    it('active emission sends nothing when the anchor is DM-only from the start', () => {
      const map = new Map<string, CanvasElement>();
      const token = makeToken('e-1');
      map.set(token.id, token);
      const tool = emitter();
      const conn = connection();
      const handle = attachPathBroadcast(tool, conn, {
        role: 'dm',
        isDmOnlyElement: () => true,
        getElement: id => map.get(id) ?? null,
      });
      handle.setSharing(true);

      tool.emit(activeEmission(token.id));

      expect(conn.sent).toEqual([]);
    });

    it('anchor turning DM-only mid-path sends exactly one cleared frame', () => {
      const map = new Map<string, CanvasElement>();
      const token = makeToken('e-1');
      map.set(token.id, token);
      let dmOnly = false;
      const tool = emitter();
      const conn = connection();
      const handle = attachPathBroadcast(tool, conn, {
        role: 'dm',
        isDmOnlyElement: () => dmOnly,
        getElement: id => map.get(id) ?? null,
      });
      handle.setSharing(true);

      const emission = activeEmission(token.id);
      tool.emit(emission);
      expect(conn.sent).toEqual([toPathPresence(emission)]);

      dmOnly = true;
      tool.emit(activeEmission(token.id));
      expect(conn.sent).toEqual([toPathPresence(emission), clearedPayload]);

      tool.emit(activeEmission(token.id));
      expect(conn.sent).toHaveLength(2);
    });
  });

  // Case 5
  describe('missing anchorKey fails closed', () => {
    it('active emission with no anchorKey sends nothing', () => {
      const map = new Map<string, CanvasElement>();
      const tool = emitter();
      const conn = connection();
      const handle = attachPathBroadcast(tool, conn, {
        role: 'dm',
        isDmOnlyElement: () => false,
        getElement: id => map.get(id) ?? null,
      });
      handle.setSharing(true);

      tool.emit(activeEmission(undefined));

      expect(conn.sent).toEqual([]);
    });

    it('anchorKey disappearing after a broadcast frame sends exactly one cleared frame', () => {
      const map = new Map<string, CanvasElement>();
      const token = makeToken('e-1');
      map.set(token.id, token);
      const tool = emitter();
      const conn = connection();
      const handle = attachPathBroadcast(tool, conn, {
        role: 'dm',
        isDmOnlyElement: () => false,
        getElement: id => map.get(id) ?? null,
      });
      handle.setSharing(true);

      const emission = activeEmission(token.id);
      tool.emit(emission);
      expect(conn.sent).toEqual([toPathPresence(emission)]);

      tool.emit(activeEmission(undefined));
      expect(conn.sent).toEqual([toPathPresence(emission), clearedPayload]);
    });
  });

  // Case 6
  it('deleted anchor fails closed: next emission clears once, then nothing', () => {
    const map = new Map<string, CanvasElement>();
    const token = makeToken('e-1');
    map.set(token.id, token);
    const tool = emitter();
    const conn = connection();
    const handle = attachPathBroadcast(tool, conn, {
      role: 'dm',
      isDmOnlyElement: () => false,
      getElement: id => map.get(id) ?? null,
    });
    handle.setSharing(true);

    const emission = activeEmission(token.id);
    tool.emit(emission);
    expect(conn.sent).toEqual([toPathPresence(emission)]);

    map.delete(token.id);
    tool.emit(activeEmission(token.id));
    expect(conn.sent).toEqual([toPathPresence(emission), clearedPayload]);

    tool.emit(activeEmission(token.id));
    expect(conn.sent).toHaveLength(2);
  });

  // Case 7
  it('retyped anchor (same id, no tokenKind) fails closed with one cleared frame', () => {
    const map = new Map<string, CanvasElement>();
    const token = makeToken('e-1');
    map.set(token.id, token);
    const tool = emitter();
    const conn = connection();
    const handle = attachPathBroadcast(tool, conn, {
      role: 'dm',
      isDmOnlyElement: () => false,
      getElement: id => map.get(id) ?? null,
    });
    handle.setSharing(true);

    const emission = activeEmission(token.id);
    tool.emit(emission);
    expect(conn.sent).toEqual([toPathPresence(emission)]);

    map.set(token.id, makePlainElement(token.id));
    tool.emit(activeEmission(token.id));
    expect(conn.sent).toEqual([toPathPresence(emission), clearedPayload]);
  });

  // Case 8
  it('natural clear passes through: active then null sends one cleared frame', () => {
    const map = new Map<string, CanvasElement>();
    const token = makeToken('e-1');
    map.set(token.id, token);
    const tool = emitter();
    const conn = connection();
    const handle = attachPathBroadcast(tool, conn, {
      role: 'dm',
      isDmOnlyElement: () => false,
      getElement: id => map.get(id) ?? null,
    });
    handle.setSharing(true);

    const emission = activeEmission(token.id);
    tool.emit(emission);
    tool.emit(null);

    expect(conn.sent).toEqual([toPathPresence(emission), clearedPayload]);
  });

  // Case 9
  it('dispose sends a clear if a frame was active; further emissions are ignored', () => {
    const map = new Map<string, CanvasElement>();
    const token = makeToken('e-1');
    map.set(token.id, token);
    const tool = emitter();
    const conn = connection();
    const handle = attachPathBroadcast(tool, conn, {
      role: 'dm',
      isDmOnlyElement: () => false,
      getElement: id => map.get(id) ?? null,
    });
    handle.setSharing(true);

    const emission = activeEmission(token.id);
    tool.emit(emission);
    expect(conn.sent).toEqual([toPathPresence(emission)]);

    handle.dispose();
    expect(conn.sent).toEqual([toPathPresence(emission), clearedPayload]);

    handle.dispose(); // idempotent
    expect(conn.sent).toHaveLength(2);

    tool.emit(activeEmission(token.id));
    expect(conn.sent).toHaveLength(2);
  });
});

describe('attachRemotePaths', () => {
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

  it('applies a valid path presence payload and requests a render', () => {
    const host = makeHost();
    const conn = makeConnection();
    const handle = attachRemotePaths(host, conn);

    const payload = toPathPresence(activeEmission('e-1'));
    conn.emitPresence('conn-1', payload);

    expect(handle.overlay.activeSenderCount).toBe(1);
    expect(host.requestRender).toHaveBeenCalled();
  });

  it('ignores foreign presence kinds', () => {
    const host = makeHost();
    const conn = makeConnection();
    const handle = attachRemotePaths(host, conn);

    conn.emitPresence('conn-1', { kind: 'laser', points: [{ x: 0, y: 0 }] });

    expect(handle.overlay.activeSenderCount).toBe(0);
  });

  it('presence-leave removes the sender immediately', () => {
    const host = makeHost();
    const conn = makeConnection();
    const handle = attachRemotePaths(host, conn);

    conn.emitPresence('conn-1', toPathPresence(activeEmission('e-1')));
    expect(handle.overlay.activeSenderCount).toBe(1);

    conn.emitLeave('conn-1');
    expect(handle.overlay.activeSenderCount).toBe(0);
  });

  it('dispose unsubscribes both handlers and disposes the overlay', () => {
    const host = makeHost();
    const conn = makeConnection();
    const handle = attachRemotePaths(host, conn);

    handle.dispose();

    expect(conn.presenceHandlers.size).toBe(0);
    expect(conn.leaveHandlers.size).toBe(0);
    expect(
      handle.overlay.apply('conn-1', toPathPresence(activeEmission('e-1')))
    ).toBe(false);
  });
});
