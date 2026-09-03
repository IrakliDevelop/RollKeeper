import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Viewport, SelectTool, createShape } from '@fieldnotes/core';
import type { AwarenessPresence, PresenceChannel } from '@fieldnotes/core';
import { attachAwarenessSync, CURSOR_RULES } from '../awarenessSync';

// Real SDK end to end: real Viewport (canvas-2D seam stubbed), real
// LocalAwareness/PeerRoster/RemoteCursorOverlay, a fake in-memory channel.
// No @fieldnotes module mocks.

function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      vi.spyOn(el as HTMLCanvasElement, 'getContext').mockReturnValue({
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        strokeRect: vi.fn(),
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
        canvas: el,
      } as unknown as CanvasRenderingContext2D);
    }
    return el;
  });
}

/**
 * Fault seams, counted from 1 per method. The SDK's attachAwareness
 * registers ONE onPresence handler (call 1) and ONE onPresenceLeave handler;
 * the wrapper registers its own onPresence handler afterwards (onPresence
 * call 2) — it registers NO leave handler (departures come from the SDK
 * roster). `presenceThrowsOnCall: 2` therefore exercises the WRAPPER's
 * unwind after the SDK attached and the wrapper's roster.onLeave
 * subscription registered; `leaveThrowsOnCall: 1` exercises the SDK's own.
 */
function makeChannel(
  faults: { presenceThrowsOnCall?: number; leaveThrowsOnCall?: number } = {}
) {
  const sent: AwarenessPresence[] = [];
  const presence = new Set<(from: string, data: unknown) => void>();
  const leave = new Set<(from: string) => void>();
  let presenceCalls = 0;
  let leaveCalls = 0;
  const channel: PresenceChannel = {
    sendPresence: data => sent.push(data as AwarenessPresence),
    onPresence: h => {
      presenceCalls += 1;
      if (presenceCalls === faults.presenceThrowsOnCall)
        throw new Error('presence registration failed');
      presence.add(h);
      return () => presence.delete(h);
    },
    onPresenceLeave: h => {
      leaveCalls += 1;
      if (leaveCalls === faults.leaveThrowsOnCall)
        throw new Error('leave registration failed');
      leave.add(h);
      return () => leave.delete(h);
    },
  };
  return {
    channel,
    sent,
    receive: (from: string, data: unknown) =>
      presence.forEach(h => h(from, data)),
    leaveFrom: (from: string) => leave.forEach(h => h(from)),
    handlerCount: () => presence.size + leave.size,
  };
}

function makeViewport(): { vp: Viewport; container: HTMLDivElement } {
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
  const vp = new Viewport(container);
  return { vp, container };
}

function moveCursor(vp: Viewport, x: number, y: number): void {
  const target = vp.domLayer.parentElement;
  if (!target) throw new Error('wrapper missing');
  target.dispatchEvent(
    new PointerEvent('pointermove', {
      clientX: x,
      clientY: y,
      isPrimary: true,
      bubbles: true,
    })
  );
}

const dmFrame = (from = 'c1-dm', x = 5): [string, unknown] => [
  from,
  {
    kind: 'awareness',
    id: 'dm-1',
    name: 'DM',
    role: 'dm',
    cursor: { x, y: 1 },
  },
];
const playerFrame = (from = 'c2-p', id = 'char-b'): [string, unknown] => [
  from,
  {
    kind: 'awareness',
    id,
    name: 'Bea',
    role: 'player',
    cursor: { x: 2, y: 2 },
  },
];

describe('attachAwarenessSync', () => {
  let vp: Viewport | null = null;
  let container: HTMLDivElement | null = null;
  // The Viewport's own render loop holds a rAF-driven timer for its
  // lifetime, independent of anything attachAwarenessSync does; captured
  // right after construction so unwind assertions can check "back to
  // baseline" rather than an unreachable absolute zero.
  let baselineTimers = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    stubCanvas();
    ({ vp, container } = makeViewport());
    baselineTimers = vi.getTimerCount();
  });
  afterEach(() => {
    vp?.destroy();
    container?.remove();
    vp = null;
    container = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('DM: publishes identity without cursor until the share switch turns on, then carries the retained position', () => {
    const ch = makeChannel();
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'dm-1', name: 'DM', role: 'dm' },
      shareCursor: false,
      showPlayerCursors: true,
    });
    moveCursor(vp!, 100, 50);
    handle.announce();
    vi.advanceTimersByTime(100);
    expect(ch.sent.length).toBeGreaterThan(0);
    expect(ch.sent.every(f => !('cursor' in f))).toBe(true);
    expect(ch.sent.at(-1)).toMatchObject({
      kind: 'awareness',
      id: 'dm-1',
      name: 'DM',
      role: 'dm',
    });

    const before = ch.sent.length;
    handle.setShareCursor(true);
    vi.advanceTimersByTime(100);
    expect(ch.sent.length).toBeGreaterThan(before);
    expect(ch.sent.at(-1)?.cursor).toBeDefined();

    handle.setShareCursor(false);
    vi.advanceTimersByTime(100);
    expect(ch.sent.at(-1)?.cursor).toBeUndefined();
    handle.dispose();
  });

  it('never publishes selection or tool on any role, even while selected', () => {
    for (const role of ['dm', 'player', 'display'] as const) {
      const ch = makeChannel();
      const { vp: v, container: c } = makeViewport();
      const select = new SelectTool();
      v.toolManager.register(select);
      const el = createShape({
        position: { x: 0, y: 0 },
        size: { w: 10, h: 10 },
      });
      v.store.add(el);
      const handle = attachAwarenessSync(v, ch.channel, {
        identity: { id: `${role}-id`, name: role, role },
        shareCursor: true,
        showPlayerCursors: true,
      });
      select.setSelection([el.id]);
      v.setTool('select');
      moveCursor(v, 10, 10);
      handle.announce();
      vi.advanceTimersByTime(200);
      expect(ch.sent.length).toBeGreaterThan(0);
      expect(ch.sent.every(f => !('selection' in f) && !('tool' in f))).toBe(
        true
      );
      handle.dispose();
      v.destroy();
      c.remove();
    }
  });

  it('display: frames carry identity only, even after pointer movement', () => {
    const ch = makeChannel();
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'display-CAMP', name: 'TV display', role: 'display' },
      shareCursor: false,
      showPlayerCursors: true,
    });
    moveCursor(vp!, 30, 30);
    handle.announce();
    vi.advanceTimersByTime(100);
    expect(ch.sent.at(-1)).toEqual({
      kind: 'awareness',
      id: 'display-CAMP',
      name: 'TV display',
      role: 'display',
    });
    handle.dispose();
  });

  it('render book follows CURSOR_RULES by local role; the roster book keeps everyone', () => {
    const cases: Array<['dm' | 'player' | 'display', string[]]> = [
      ['dm', ['dm-1', 'char-b']],
      ['player', ['dm-1']],
      ['display', ['dm-1']],
    ];
    for (const [role, expectedCursorIds] of cases) {
      const ch = makeChannel();
      const { vp: v, container: c } = makeViewport();
      const handle = attachAwarenessSync(v, ch.channel, {
        identity: { id: 'me', name: 'me', role },
        shareCursor: false,
        showPlayerCursors: true,
      });
      ch.receive(...dmFrame());
      ch.receive(...playerFrame());
      ch.receive('c3-x', { kind: 'awareness', id: 'tv', role: 'display' });
      expect(
        handle.roster
          .getPeers()
          .map(p => p.id)
          .sort()
      ).toEqual(['char-b', 'dm-1', 'tv']);
      expect(
        handle
          .cursorPeers()
          .map(p => p.id)
          .sort()
      ).toEqual([...expectedCursorIds].sort());
      handle.dispose();
      v.destroy();
      c.remove();
    }
    expect(CURSOR_RULES.player({ id: 'x', role: 'player' })).toBe(false);
    expect(CURSOR_RULES.dm({ id: 'x' })).toBe(false); // no role → never drawn
  });

  it('"Show player cursors" hides PLAYER rows only, keeps other DMs, and re-projects players from the SDK roster at once', () => {
    const ch = makeChannel();
    const register = vi.spyOn(vp!, 'registerOverlay');
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'dm-1', name: 'DM', role: 'dm' },
      shareCursor: false,
      showPlayerCursors: true,
    });
    expect(register).toHaveBeenCalledTimes(1); // one overlay for the attachment's lifetime
    ch.receive(...dmFrame('c8', 9)); // another DM device
    ch.receive(...playerFrame());
    expect(
      handle
        .cursorPeers()
        .map(p => p.id)
        .sort()
    ).toEqual(['char-b', 'dm-1']);

    handle.setShowPlayerCursors(false);
    expect(handle.cursorPeers().map(p => p.id)).toEqual(['dm-1']);
    ch.receive(...playerFrame('c5', 'char-c')); // arrives while hidden
    expect(handle.cursorPeers().map(p => p.id)).toEqual(['dm-1']);
    expect(
      handle.roster
        .getPeers()
        .map(p => p.id)
        .sort()
    ).toEqual(['char-b', 'char-c', 'dm-1']);

    handle.setShowPlayerCursors(true); // NO new frame from either player
    expect(
      handle
        .cursorPeers()
        .map(p => p.id)
        .sort()
    ).toEqual(['char-b', 'char-c', 'dm-1']);
    expect(handle.cursorPeers().find(p => p.id === 'char-b')?.cursor).toEqual({
      x: 2,
      y: 2,
    });
    expect(register).toHaveBeenCalledTimes(1);
    handle.dispose();
  });

  it('a sender whose new valid frame fails the rule is evicted from the render book (roster keeps it)', () => {
    const ch = makeChannel();
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'me', name: 'me', role: 'player' },
      shareCursor: true,
      showPlayerCursors: true,
    });
    ch.receive('c1', {
      kind: 'awareness',
      id: 'x',
      name: 'X',
      role: 'dm',
      cursor: { x: 1, y: 1 },
    });
    expect(handle.cursorPeers().map(p => p.from)).toEqual(['c1']);
    ch.receive('c1', {
      kind: 'awareness',
      id: 'x',
      name: 'X',
      role: 'player',
      cursor: { x: 1, y: 1 },
    });
    expect(handle.cursorPeers()).toEqual([]);
    expect(handle.roster.getPeer('c1')?.role).toBe('player');
    handle.dispose();
  });

  it('cleared frames and presence-leave drop the peer from both books', () => {
    const ch = makeChannel();
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'me', name: 'me', role: 'player' },
      shareCursor: true,
      showPlayerCursors: true,
    });
    ch.receive(...dmFrame('c1'));
    ch.receive(...playerFrame('c2', 'char-b')); // not drawable on a player surface, but in the roster
    expect(
      handle.roster
        .getPeers()
        .map(p => p.from)
        .sort()
    ).toEqual(['c1', 'c2']);
    expect(handle.cursorPeers().map(p => p.from)).toEqual(['c1']);
    ch.receive('c1', { kind: 'awareness', id: 'dm-1', cleared: true });
    expect(handle.roster.getPeers().map(p => p.from)).toEqual(['c2']);
    expect(handle.cursorPeers()).toEqual([]);
    ch.receive(...dmFrame('c9'));
    expect(handle.cursorPeers().map(p => p.from)).toEqual(['c9']);
    ch.leaveFrom('c9');
    ch.leaveFrom('c2');
    expect(handle.roster.getPeers()).toEqual([]);
    expect(handle.cursorPeers()).toEqual([]);
    handle.dispose();
  });

  it("MULTI-TAB: one identity on two sockets draws ONE cursor — the newest socket wins, the older socket's frames never draw, and closing the newest restores the older one", () => {
    const ch = makeChannel();
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'me', name: 'me', role: 'player' },
      shareCursor: true,
      showPlayerCursors: true,
    });
    ch.receive(...dmFrame('c1', 1)); // tab 1
    ch.receive(...dmFrame('c2', 2)); // tab 2 (newer socket) → winner
    expect(handle.roster.getPeers().map(p => p.from)).toEqual(['c1', 'c2']);
    expect(handle.cursorPeers().map(p => [p.from, p.cursor?.x])).toEqual([
      ['c2', 2],
    ]);
    ch.receive(...dmFrame('c1', 11)); // older tab keeps moving: never drawn, never flips the winner
    expect(handle.cursorPeers().map(p => [p.from, p.cursor?.x])).toEqual([
      ['c2', 2],
    ]);
    ch.receive(...dmFrame('c2', 22));
    expect(handle.cursorPeers().map(p => [p.from, p.cursor?.x])).toEqual([
      ['c2', 22],
    ]);
    ch.leaveFrom('c2'); // newest tab closes → the older socket's LATEST roster state is restored
    expect(handle.cursorPeers().map(p => [p.from, p.cursor?.x])).toEqual([
      ['c1', 11],
    ]);
    ch.receive('c1', { kind: 'awareness', id: 'dm-1', cleared: true });
    expect(handle.cursorPeers()).toEqual([]);
    handle.dispose();
  });

  it('RECONNECT GHOST: after a relay restart the old socket row lingers in the roster until stale, but only the new socket ever draws — before AND after the stale expiry', () => {
    const ch = makeChannel();
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'me', name: 'me', role: 'player' },
      shareCursor: true,
      showPlayerCursors: true,
    });
    ch.receive(...dmFrame('c1', 1)); // pre-restart socket
    ch.receive(...dmFrame('c2', 5)); // the DM's reconnect: new `from`, same id, no presence-leave for c1
    expect(handle.roster.getPeers().map(p => p.from)).toEqual(['c1', 'c2']);
    expect(handle.cursorPeers().map(p => [p.from, p.cursor?.x])).toEqual([
      ['c2', 5],
    ]); // no ghost
    // c2 keeps heartbeating; c1 is silent → the SDK roster expires it at 45 s.
    for (let t = 0; t < 5; t++) {
      vi.advanceTimersByTime(10_000);
      ch.receive(...dmFrame('c2', 5 + t));
      expect(handle.cursorPeers().map(p => p.from)).toEqual(['c2']); // never two rows
    }
    expect(handle.roster.getPeers().map(p => p.from)).toEqual(['c2']); // c1 went stale
    expect(handle.cursorPeers().map(p => [p.from, p.cursor?.x])).toEqual([
      ['c2', 9],
    ]); // the stale expiry did not resurrect/replace anything
    // The expired socket was fully released: a later frame from the same
    // `from` counts as a NEW socket and therefore wins (newest socket rule).
    ch.receive(...dmFrame('c1', 77));
    expect(handle.cursorPeers().map(p => [p.from, p.cursor?.x])).toEqual([
      ['c1', 77],
    ]);
    handle.dispose();
  });

  it('a socket that changes its claimed id keeps at most one render row (the new id), and a NEW socket under the OLD id must not evict it', () => {
    const ch = makeChannel();
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'me', name: 'me', role: 'player' },
      shareCursor: true,
      showPlayerCursors: true,
    });
    ch.receive('c1', {
      kind: 'awareness',
      id: 'dm-1',
      role: 'dm',
      cursor: { x: 1, y: 1 },
    });
    ch.receive('c1', {
      kind: 'awareness',
      id: 'dm-2',
      role: 'dm',
      cursor: { x: 2, y: 2 },
    });
    expect(handle.cursorPeers().map(p => [p.from, p.id])).toEqual([
      ['c1', 'dm-2'],
    ]);
    // If c1 were still recorded under dm-1, this newcomer would "win" dm-1
    // and evict c1's legitimate dm-2 row.
    ch.receive('c9', {
      kind: 'awareness',
      id: 'dm-1',
      role: 'dm',
      cursor: { x: 9, y: 9 },
    });
    expect(
      handle
        .cursorPeers()
        .map(p => [p.from, p.id])
        .sort()
    ).toEqual([
      ['c1', 'dm-2'],
      ['c9', 'dm-1'],
    ]);
    handle.dispose();
  });

  it("WRAPPER unwind: the wrapper's own presence registration throws AFTER the SDK attached and the wrapper's roster.onLeave subscribed → original error, everything cleaned up", () => {
    // onPresence call 1 = the SDK's (succeeds); call 2 = the wrapper's (throws).
    const ch = makeChannel({ presenceThrowsOnCall: 2 });
    const register = vi.spyOn(vp!, 'registerOverlay');
    expect(() =>
      attachAwarenessSync(vp!, ch.channel, {
        identity: { id: 'dm-1', name: 'DM', role: 'dm' },
        shareCursor: true,
        showPlayerCursors: true,
      })
    ).toThrow('presence registration failed');
    // The SDK's two channel handlers are gone (the wrapper disposed the attachment).
    expect(ch.handlerCount()).toBe(0);
    // The SDK attachment was disposed by the wrapper: exactly one `cleared`
    // frame went out and no heartbeat/interval timer survives.
    expect(ch.sent.filter(f => f.cleared === true)).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(baselineTimers);
    // Publisher listeners are gone: a pointer move produces no frame.
    const before = ch.sent.length;
    moveCursor(vp!, 10, 10);
    vi.advanceTimersByTime(200);
    expect(ch.sent.length).toBe(before);
    expect(register).not.toHaveBeenCalled();
  });

  it("SDK unwind stays intact when the SDK's own leave registration throws (call 1): nothing leaks", () => {
    const ch = makeChannel({ leaveThrowsOnCall: 1 }); // the wrapper never registers a leave handler
    expect(() =>
      attachAwarenessSync(vp!, ch.channel, {
        identity: { id: 'dm-1', name: 'DM', role: 'dm' },
        shareCursor: false,
        showPlayerCursors: true,
      })
    ).toThrow('leave registration failed');
    expect(ch.handlerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(baselineTimers);
  });

  it('construction unwinds when the overlay constructor throws (registerOverlay fault): original error, publisher gone', () => {
    const ch = makeChannel();
    vi.spyOn(vp!, 'registerOverlay').mockImplementationOnce(() => {
      throw new Error('overlay boom');
    });
    expect(() =>
      attachAwarenessSync(vp!, ch.channel, {
        identity: { id: 'dm-1', name: 'DM', role: 'dm' },
        shareCursor: true,
        showPlayerCursors: true,
      })
    ).toThrow('overlay boom');
    expect(ch.handlerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(baselineTimers);
    // The publisher was disposed by the unwind: its listeners are gone, so
    // a pointer move produces no frame.
    const before = ch.sent.length;
    moveCursor(vp!, 10, 10);
    vi.advanceTimersByTime(200);
    expect(ch.sent.length).toBe(before);
  });

  it('dispose sends exactly one cleared frame, unsubscribes every handler, and keeps unwinding when a step throws', () => {
    const ch = makeChannel();
    // Fault: the overlay's unregister throws on teardown.
    const realRegister = vp!.registerOverlay.bind(vp!);
    vi.spyOn(vp!, 'registerOverlay').mockImplementationOnce(draw => {
      const unregister = realRegister(draw);
      return () => {
        unregister();
        throw new Error('unregister boom');
      };
    });
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'me', name: 'me', role: 'player' },
      shareCursor: true,
      showPlayerCursors: true,
    });
    expect(ch.handlerCount()).toBeGreaterThan(0);
    expect(() => handle.dispose()).not.toThrow();
    handle.dispose(); // idempotent
    expect(ch.sent.filter(f => f.cleared === true)).toHaveLength(1);
    expect(ch.handlerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(baselineTimers);
  });

  it('setIdentity changes the name on the next frame', () => {
    const ch = makeChannel();
    const handle = attachAwarenessSync(vp!, ch.channel, {
      identity: { id: 'char-a', name: 'Aria', role: 'player' },
      shareCursor: true,
      showPlayerCursors: true,
    });
    handle.setIdentity({ id: 'char-a', name: 'Aria (Sam)', role: 'player' });
    vi.advanceTimersByTime(100);
    expect(ch.sent.at(-1)?.name).toBe('Aria (Sam)');
    handle.dispose();
  });
});
