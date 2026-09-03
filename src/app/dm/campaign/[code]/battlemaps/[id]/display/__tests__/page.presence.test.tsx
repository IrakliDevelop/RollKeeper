import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Viewport } from '@fieldnotes/core';

import BattleMapDisplayPage from '../page';

/**
 * Task 10 — shared presence on the TV display surface, mirroring the DM
 * (Tasks 7-8) and player (Task 9) coverage: the display is identity-only
 * (no cursor of its own — `shareCursor: false`), draws only the DM's cursor
 * (awarenessSync CURSOR_RULES.display), renders no PresenceControl UI, and
 * the re-attach/unmount teardown order disposes connection-scoped handles
 * (awareness included) BEFORE stopping the connection.
 *
 * Mount scaffolding (mocked FieldNotesCanvas + a real Viewport driven
 * through a manually-fired onReady) is copied from
 * page.markerActivation.test.tsx. The connection-scoped sync helpers +
 * awarenessSync are mocked the way DmBattleMapCanvas.hooks.test.ts and
 * PlayerBattleMapCanvas.presence.test.tsx mock them (Task 7/8/9 precedent)
 * so `attachConnectionScope`'s real dispose/stop ordering is exercised
 * against these mocks rather than the network.
 */

let mockSearchParams = new URLSearchParams({ dk: 'key' });

vi.mock('next/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useParams: () => ({ code: 'CAMP01', id: 'bm-1' }),
    useSearchParams: () => mockSearchParams,
  };
});

vi.mock('@/components/ui/campaign/location-map/BattleMapMinimap', () => ({
  BattleMapMinimap: () => null,
}));
vi.mock('@/components/ui/campaign/location-map/BattleMapExportControl', () => ({
  BattleMapExportControl: () => null,
}));

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    // jsdom has no live canvas rendering pipeline — onReady is invoked
    // manually below with a REAL Viewport built against a stubbed canvas 2D
    // context (see stubCanvas()), same precedent as the marker-activation
    // test file next to this one.
    FieldNotesCanvas: vi.fn(() => null),
  };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

const callOrder: string[] = [];

vi.mock('@/lib/battlemapSync', () => ({
  createManagedBattleMapConnection: vi.fn(() => ({
    stop: () => {
      callOrder.push('connection.stop');
    },
    sendPresence: vi.fn(),
  })),
}));

vi.mock('@/components/ui/campaign/location-map/laserSync', () => ({
  attachRemoteLaserTrails: vi.fn(() => vi.fn()),
}));

vi.mock('@/components/ui/campaign/location-map/pingSync', () => ({
  attachRemotePings: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));

vi.mock('@/components/ui/campaign/location-map/measureSync', () => ({
  attachRemoteMeasurements: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock('@/components/ui/campaign/location-map/focusSync', () => ({
  attachFocusReceiver: vi.fn(() => ({
    dispose: vi.fn(),
    receiver: {},
    animator: {},
  })),
}));

vi.mock('@/components/ui/campaign/location-map/pathSync', () => ({
  attachRemotePaths: vi.fn(() => ({
    dispose: () => {
      callOrder.push('remotePaths.dispose');
    },
    overlay: {},
  })),
}));

vi.mock('@/components/ui/campaign/location-map/layerSync', () => ({
  makeApplyRemoteLayer: vi.fn(() => vi.fn()),
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

import { attachAwarenessSync } from '@/components/ui/campaign/location-map/awarenessSync';
import { createManagedBattleMapConnection } from '@/lib/battlemapSync';

/** jsdom has no canvas 2D context — stub it so constructing a real
 * `Viewport` doesn't throw. Duplicated (not imported) from
 * page.markerActivation.test.tsx: stub the browser API, never an
 * @fieldnotes module. */
function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
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

/** Pulls the `onReady` callback the (mocked) `FieldNotesCanvas` most
 * recently received, and invokes it with a real `Viewport` inside `act`. */
function fireReady(vp: Viewport): void {
  const lastCall = vi.mocked(FieldNotesCanvas).mock.calls.at(-1);
  const onReady = lastCall?.[0]?.onReady;
  if (!onReady) {
    throw new Error('FieldNotesCanvas was not rendered with an onReady prop');
  }
  act(() => onReady(vp));
}

describe('BattleMapDisplayPage: shared presence', () => {
  const savedRelayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    mockSearchParams = new URLSearchParams({ dk: 'key' });
    callOrder.length = 0;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    if (savedRelayUrl === undefined) {
      delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    } else {
      process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = savedRelayUrl;
    }
  });

  it('attaches awareness as display: identity-only (no cursor share), announce on live, no share/viewer UI, dispose before stop on unmount', () => {
    stubCanvas();
    const vp = makeViewport();

    const { unmount, container } = render(<BattleMapDisplayPage />);
    fireReady(vp);

    const [, , options] = vi.mocked(attachAwarenessSync).mock.calls[0]!;
    expect(options.identity).toEqual({
      id: 'display-CAMP01',
      name: 'TV display',
      role: 'display',
    });
    expect(options.shareCursor).toBe(false);
    expect(options.showPlayerCursors).toBe(true);
    expect(options.colorFor).toBeUndefined();

    const onStatus = vi.mocked(createManagedBattleMapConnection).mock
      .calls[0]![0].onStatus!;
    act(() => onStatus('live'));
    expect(awarenessHandle.announce).toHaveBeenCalledTimes(1);

    expect(container.querySelector('[role="switch"]')).toBeNull();
    expect(container.querySelector('button')).toBeNull();

    unmount();
    expect(callOrder.indexOf('awareness.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('awareness.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    vp.destroy();
  });

  it('RE-ATTACH: a second onReady disposes the old attachment before stopping the old connection', () => {
    stubCanvas();
    const vp1 = makeViewport();
    const vp2 = makeViewport();

    const { unmount } = render(<BattleMapDisplayPage />);
    fireReady(vp1);
    callOrder.length = 0;

    fireReady(vp2);

    expect(callOrder.indexOf('awareness.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('remotePaths.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('awareness.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.indexOf('remotePaths.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.filter(c => c === 'connection.stop')).toHaveLength(1);
    expect(vi.mocked(attachAwarenessSync)).toHaveBeenCalledTimes(2);

    unmount();
    vp1.destroy();
    vp2.destroy();
  });

  it('ATTACH FAULT: awareness throwing disposes the earlier helpers (remotePaths), stops the new connection, surfaces the error; unmount does not stop twice', () => {
    stubCanvas();
    const vp = makeViewport();

    vi.mocked(attachAwarenessSync).mockImplementationOnce(() => {
      throw new Error('awareness boom');
    });

    const { unmount } = render(<BattleMapDisplayPage />);
    expect(() => fireReady(vp)).toThrow('awareness boom');

    expect(callOrder.indexOf('remotePaths.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('remotePaths.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.filter(c => c === 'connection.stop')).toHaveLength(1);

    callOrder.length = 0;
    unmount();
    expect(callOrder).not.toContain('connection.stop');

    vp.destroy();
  });

  it('with no dk query param, nothing attaches', () => {
    stubCanvas();
    mockSearchParams = new URLSearchParams();
    const vp = makeViewport();

    render(<BattleMapDisplayPage />);
    fireReady(vp);

    expect(createManagedBattleMapConnection).not.toHaveBeenCalled();
    expect(attachAwarenessSync).not.toHaveBeenCalled();

    vp.destroy();
  });
});
