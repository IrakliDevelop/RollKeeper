import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Viewport } from '@fieldnotes/core';

import BattleMapDisplayPage from '../page';

/**
 * PR04 acceptance A2 on the map-pinned display: after a relay 4403 authority
 * withdrawal (terminal SDK `denied`) the display rebuilds and re-mints with
 * bounded backoff; an unavailable scene is the neutral cover, a bad display
 * key stays "Display link expired". Real battlemapSync/battlemapAuthority.
 */

interface FakeInstance {
  resolveUrl: () => Promise<unknown> | unknown;
  state: { status: string; document: unknown; operations: unknown[] };
  listeners: Set<() => void>;
  stop: ReturnType<typeof vi.fn>;
  publish(): void;
}

const fake = vi.hoisted(() => ({ instances: [] as FakeInstance[] }));

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

const canvasMounts = vi.hoisted(() => ({ count: 0 }));
vi.mock('next/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useParams: () => ({ code: 'CAMP01', id: 'map-m' }),
    useSearchParams: () => new URLSearchParams({ dk: 'key' }),
  };
});

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    FieldNotesCanvas: vi.fn(() => {
      React.useEffect(() => {
        canvasMounts.count += 1;
      }, []);
      return null;
    }),
  };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

vi.mock('@/components/ui/campaign/location-map/fog/fogAppearancePoll', () => ({
  applyFogAppearanceMetadata: vi.fn(),
  fetchAndApplyFogAppearance: vi.fn(),
  startFogAppearancePoll: vi.fn(() => () => {}),
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
  attachFocusReceiver: vi.fn(() => ({ dispose: vi.fn() })),
}));
vi.mock('@/components/ui/campaign/location-map/pathSync', () => ({
  attachRemotePaths: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));
vi.mock('@/components/ui/campaign/location-map/layerSync', () => ({
  makeApplyRemoteLayer: vi.fn(() => vi.fn()),
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
  // Destroyed in afterEach so no render frame outlives the canvas stub.
  viewports.push(vp);
  return vp;
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

describe('BattleMapDisplayPage: recovery after a relay authority withdrawal (A2)', () => {
  const saved = {
    relay: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
    table: process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED,
  };
  let mint: Mint = { ok: true, room: ROOM_X, sceneId: 'scene-x' };

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    fake.instances.length = 0;
    mint = { ok: true, room: ROOM_X, sceneId: 'scene-x' };
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input =>
      String(input).includes('/battlemap-token')
        ? mint.ok
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
            })
        : new Response('{}', { status: 200 })
    );
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
  async function connectFresh() {
    const first = fake.instances.at(-1)!;
    await act(async () => {
      await first.resolveUrl();
      await flush();
    });
    if (fake.instances.at(-1) !== first) await goLive(fake.instances.at(-1)!);
  }
  async function withdraw() {
    const current = fake.instances.at(-1)!;
    await act(async () => {
      current.state = { ...current.state, status: 'denied' };
      current.publish();
      await flush();
    });
  }
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

  it('rebinds to a same-source scene, then shows the neutral cover when unavailable', async () => {
    stubCanvas();
    render(<BattleMapDisplayPage />);
    fireReady(makeViewport());
    await connectFresh();
    expect(cover()).toBeNull();
    mint = { ok: true, room: ROOM_M, sceneId: 'scene-m' };
    await withdraw();
    expect(cover()).not.toMatch(/expired/);
    await rebuild();
    await connectFresh();
    expect(cover()).toBeNull();
    mint = { ok: false, status: 403, error: 'Scene is unavailable' };
    await withdraw();
    await rebuild();
    await act(async () => {
      await fake.instances.at(-1)!.resolveUrl();
      await flush();
    });
    expect(cover()).toBe('Nothing is being shown on this map right now');
  });

  it('an invalid display key keeps the expired message and does not rebuild', async () => {
    mint = { ok: false, status: 403, error: 'Invalid display key' };
    stubCanvas();
    render(<BattleMapDisplayPage />);
    fireReady(makeViewport());
    await act(async () => {
      await fake.instances.at(-1)!.resolveUrl();
      await flush();
    });
    expect(cover()).toBe(
      'Display link expired — reopen it from the battle map editor'
    );
    const count = canvasMounts.count;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(canvasMounts.count).toBe(count);
  });
});
