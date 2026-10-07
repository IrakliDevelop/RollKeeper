import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { SelectTool, Viewport } from '@fieldnotes/core';

import { PlayerBattleMapCanvas } from '../PlayerBattleMapCanvas';

/**
 * PR04 acceptance A2: the relay closes an audience socket with 4403
 * "authority withdrawn" after ANY presentation change, which settles the SDK
 * authority client into terminal `denied` (no re-mint). The player surface
 * must then rebuild its connection with bounded backoff and re-mint: a
 * same-source scene rebinds (with the notice), an unavailable scene shows the
 * neutral cover, and only a genuine credential denial shows "Access denied".
 * Real battlemapSync/battlemapAuthority stack; only the SDK connection is faked.
 */

interface FakeInstance {
  resolveUrl: () => Promise<unknown> | unknown;
  state: { status: string; document: unknown; operations: unknown[] };
  listeners: Set<() => void>;
  stop: ReturnType<typeof vi.fn>;
  publish(): void;
}

const fake = vi.hoisted(() => ({ instances: [] as FakeInstance[] }));
const canvasMounts = vi.hoisted(() => ({ count: 0 }));

vi.mock('@fieldnotes/sync', async importOriginal => ({
  ...(await importOriginal<typeof import('@fieldnotes/sync')>()),
  createManagedAuthorityConnection: (options: {
    resolveUrl: () => unknown;
  }) => {
    const instance: FakeInstance = {
      resolveUrl: options.resolveUrl,
      state: { status: 'connecting', document: null, operations: [] },
      listeners: new Set(),
      stop: vi.fn(),
      publish() {
        for (const listener of [...this.listeners]) listener();
      },
    };
    fake.instances.push(instance);
    return {
      getState: () => instance.state,
      subscribe: (listener: () => void) => {
        instance.listeners.add(listener);
        return () => instance.listeners.delete(listener);
      },
      stop: instance.stop,
      submit: vi.fn(() => ({ status: 'admitted', clientOperationId: 'x' })),
      captureBarrier: vi.fn(),
      waitForAcknowledgements: vi.fn(),
      requestCheckpoint: vi.fn(),
      releaseBarrier: vi.fn(),
    };
  },
}));

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    FieldNotesCanvas: vi.fn(() => {
      // Counts canvas (re)mounts: a rebuild remounts under a new key.
      React.useEffect(() => {
        canvasMounts.count += 1;
      }, []);
      return null;
    }),
    useActiveTool: () => ['select', vi.fn()] as const,
  };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

vi.mock('../BattleMapMinimap', () => ({ BattleMapMinimap: () => null }));
vi.mock('../BattleMapExportControl', () => ({
  BattleMapExportControl: () => null,
}));

vi.mock('../fog/fogAppearancePoll', () => ({
  applyFogAppearanceMetadata: vi.fn(),
  fetchAndApplyFogAppearance: vi.fn(),
  getAppliedFogAppearance: vi.fn(() => 'solid'),
  startFogAppearancePoll: vi.fn(() => () => {}),
}));

vi.mock('@/components/ui/campaign/location-map/laserSync', () => ({
  attachRemoteLaserTrails: vi.fn(() => () => {}),
}));
vi.mock('@/components/ui/campaign/location-map/pingSync', () => ({
  attachRemotePings: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));
vi.mock('@/components/ui/campaign/location-map/measureSync', () => ({
  attachRemoteMeasurements: vi.fn(() => ({ dispose: vi.fn() })),
}));
vi.mock('@/components/ui/campaign/location-map/focusSync', () => ({
  attachFocusReceiver: vi.fn(() => ({ dispose: vi.fn() })),
}));
vi.mock('@/components/ui/campaign/location-map/pathSync', () => ({
  attachPathBroadcast: vi.fn(() => ({ setSharing: vi.fn(), dispose: vi.fn() })),
  attachRemotePaths: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));
vi.mock('@/components/ui/campaign/location-map/awarenessSync', () => ({
  attachAwarenessSync: vi.fn(() => ({
    roster: {},
    cursorPeers: vi.fn(() => []),
    announce: vi.fn(),
    setShareCursor: vi.fn(),
    setShowPlayerCursors: vi.fn(),
    setIdentity: vi.fn(),
    dispose: vi.fn(),
  })),
}));

const ROOM_X = '423e4567-e89b-42d3-a456-426614174000';
const ROOM_M = '523e4567-e89b-42d3-a456-426614174000';
const viewports: Viewport[] = [];

function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
        canvas,
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
  const vp = new Viewport(container);
  viewports.push(vp);
  vp.toolManager.register(new SelectTool());
  vp.toolManager.register({
    name: 'path',
    onCommit: vi.fn(() => vi.fn()),
  } as unknown as Parameters<typeof vp.toolManager.register>[0]);
  return vp;
}

function fireReady(vp: Viewport): void {
  const onReady = vi.mocked(FieldNotesCanvas).mock.calls.at(-1)?.[0]?.onReady;
  if (!onReady) throw new Error('FieldNotesCanvas has no onReady');
  act(() => onReady(vp));
}

async function flush() {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

const liveDocument = {
  elements: [],
  layers: [],
  extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
};

async function goLive(instance: FakeInstance) {
  await act(async () => {
    await instance.resolveUrl();
    await flush();
  });
  await act(async () => {
    instance.state = { status: 'live', document: liveDocument, operations: [] };
    instance.publish();
    await flush();
  });
}

type Mint =
  | { ok: true; room: string; sceneId: string }
  | { ok: false; status: number; error: string };

describe('PlayerBattleMapCanvas: recovery after a relay authority withdrawal (A2)', () => {
  const saved = {
    relay: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
    table: process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED,
  };
  let mint: Mint = { ok: true, room: ROOM_X, sceneId: 'scene-x' };
  let mints = 0;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    fake.instances.length = 0;
    mints = 0;
    mint = { ok: true, room: ROOM_X, sceneId: 'scene-x' };
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      if (String(input).includes('/battlemap-token')) {
        mints += 1;
        return mint.ok
          ? new Response(
              JSON.stringify({
                token: 'token',
                authority: 1,
                room: mint.room,
                sceneId: mint.sceneId,
              }),
              { status: 200 }
            )
          : new Response(JSON.stringify({ error: mint.error }), {
              status: mint.status,
            });
      }
      return new Response(JSON.stringify({ markers: [] }), { status: 200 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    viewports.splice(0).forEach(viewport => viewport.destroy());
    vi.restoreAllMocks();
    vi.clearAllMocks();
    for (const [key, value] of [
      ['NEXT_PUBLIC_BATTLEMAP_RELAY_URL', saved.relay],
      ['NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED', saved.table],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const cover = () =>
    screen.queryByTestId('battlemap-bootstrap-privacy-cover')?.textContent ??
    null;

  function renderPlayer() {
    stubCanvas();
    render(
      <PlayerBattleMapCanvas
        campaignCode="CAMP01"
        battleMapId="map-m"
        characterId="legacy-a"
        onExportError={() => {}}
      />
    );
    fireReady(makeViewport());
  }

  /** First mint after a (re)build: resolves the binding, then goes live. */
  async function connectFresh() {
    const first = fake.instances.at(-1)!;
    await act(async () => {
      await first.resolveUrl();
      await flush();
    });
    if (fake.instances.at(-1) !== first) await goLive(fake.instances.at(-1)!);
  }

  /** The relay closes 4403 → the SDK client settles on terminal denied. */
  async function withdraw() {
    const current = fake.instances.at(-1)!;
    await act(async () => {
      current.state = { ...current.state, status: 'denied' };
      current.publish();
      await flush();
    });
  }

  /** Backoff elapses; the page rebuilds its canvas and connection. */
  async function rebuild() {
    const before = canvasMounts.count;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
      await flush();
    });
    expect(
      canvasMounts.count,
      'the canvas remounts to reconnect'
    ).toBeGreaterThan(before);
    fireReady(makeViewport());
  }

  it('rebinds to a different same-source scene after the withdrawal, with the notice', async () => {
    renderPlayer();
    await connectFresh();
    expect(cover()).toBeNull();
    mint = { ok: true, room: ROOM_M, sceneId: 'scene-m' };
    await withdraw();
    expect(cover()).not.toBe('Access denied');
    await rebuild();
    await connectFresh();
    expect(cover()).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(
      /presented scene changed/i
    );
    for (const instance of fake.instances.slice(0, -1))
      expect(instance.stop).toHaveBeenCalled();
  });

  it('shows the neutral cover (never "Access denied") while the scene is unavailable', async () => {
    renderPlayer();
    await connectFresh();
    mint = { ok: false, status: 403, error: 'Scene is unavailable' };
    await withdraw();
    await rebuild();
    await act(async () => {
      await fake.instances.at(-1)!.resolveUrl();
      await flush();
    });
    expect(cover()).toBe("The DM isn't showing this map right now");
  });

  it('X → M → X recovers each time', async () => {
    renderPlayer();
    await connectFresh();
    for (const [room, sceneId] of [
      [ROOM_M, 'scene-m'],
      [ROOM_X, 'scene-x'],
    ] as const) {
      mint = { ok: true, room, sceneId };
      await withdraw();
      await rebuild();
      await connectFresh();
      expect(cover()).toBeNull();
    }
    expect(mints).toBeGreaterThanOrEqual(3);
  });

  it('a genuine credential denial still shows "Access denied" and does not rebuild', async () => {
    mint = { ok: false, status: 403, error: 'Player is not in this campaign' };
    renderPlayer();
    await act(async () => {
      await fake.instances.at(-1)!.resolveUrl();
      await flush();
    });
    expect(cover()).toBe('Access denied');
    const count = canvasMounts.count;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(canvasMounts.count).toBe(count);
  });
});
